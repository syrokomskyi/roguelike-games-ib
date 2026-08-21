import type { CanonicalRecord } from "@roguelike-games-ib/materializer";
import type { ClaimRecord, RelationRecord } from "@roguelike-games-ib/knowledge-core";
import type { PublicEvidence } from "@roguelike-games-ib/materializer";
import type { ProjectionStore } from "@roguelike-games-ib/projection-sdk";
import { claimsForRecord, claimsReferencingRecord, evidenceForClaim, buildEvidenceUrl } from "@roguelike-games-ib/projection-sdk";
import { relationsForRecord, groupRelationsByType } from "@roguelike-games-ib/projection-sdk";
import { createFrontmatter, serializeFrontmatter } from "./frontmatter.ts";
import type { PathResolver } from "./paths.ts";
import { makeWikiLink } from "./links.ts";
import type { AliasMap } from "@roguelike-games-ib/projection-sdk";

function extractDisplayName(record: CanonicalRecord): string {
  if (typeof record.name === "string") return record.name;
  if (typeof record.label === "string") return record.label;
  if (typeof record.title === "string") return record.title;
  return record.key.split("/").pop() ?? record.key;
}

function renderProperties(record: CanonicalRecord): string {
  const skip = new Set(["id", "key", "record_type", "source_identity", "name", "label", "title"]);
  const lines: string[] = [];
  for (const [k, v] of Object.entries(record)) {
    if (skip.has(k)) continue;
    if (v === null || v === undefined) continue;
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
      lines.push(`- **${k}**: ${v}`);
    } else if (Array.isArray(v) && v.length === 0) {
      continue;
    } else {
      lines.push(`- **${k}**: ${JSON.stringify(v)}`);
    }
  }
  return lines.join("\n");
}

function renderRelations(
  store: ProjectionStore,
  resolver: PathResolver,
  aliasMap: AliasMap,
  recordId: string,
): string {
  const { outgoing, incoming } = relationsForRecord(store.relations, recordId);
  if (outgoing.length === 0 && incoming.length === 0) return "";

  const lines: string[] = ["## Relations"];
  if (outgoing.length > 0) {
    const grouped = groupRelationsByType(outgoing);
    lines.push("### Outgoing");
    for (const [type, rels] of grouped) {
      lines.push(`**${type}**:`);
      for (const rel of rels) {
        const link = makeWikiLink(resolver, aliasMap, rel.target_record_id);
        lines.push(`- ${link ?? rel.target_record_id}`);
      }
    }
  }
  if (incoming.length > 0) {
    const grouped = groupRelationsByType(incoming);
    lines.push("### Incoming");
    for (const [type, rels] of grouped) {
      lines.push(`**${type}**:`);
      for (const rel of rels) {
        const link = makeWikiLink(resolver, aliasMap, rel.source_record_id);
        lines.push(`- ${link ?? rel.source_record_id}`);
      }
    }
  }
  return lines.join("\n");
}

function renderClaims(
  store: ProjectionStore,
  resolver: PathResolver,
  aliasMap: AliasMap,
  recordId: string,
): string {
  const claims = claimsForRecord(store.claims, recordId);
  const refClaims = claimsReferencingRecord(store.claims, recordId);
  if (claims.length === 0 && refClaims.length === 0) return "";

  const lines: string[] = ["## Claims"];
  for (const claim of claims) {
    const state = claim.assertion_state === "contested" ? " ⚠️ **contested**" : "";
    let valueStr = "";
    if (claim.object_ref) {
      const link = makeWikiLink(resolver, aliasMap, claim.object_ref);
      valueStr = link ?? claim.object_ref;
    } else if (claim.value !== undefined) {
      valueStr = String(claim.value);
    }
    lines.push(`- **${claim.predicate}**: ${valueStr}${state}`);

    const ev = evidenceForClaim(store.evidence, claim.evidence_refs);
    if (ev.length > 0) {
      for (const e of ev) {
        const excerpt = e.excerpt ? ` — *"${e.excerpt}"*` : "";
        lines.push(`  - Evidence: [${e.id}]${excerpt}`);
      }
    }
  }
  for (const claim of refClaims) {
    const subjectLink = makeWikiLink(resolver, aliasMap, claim.subject_id);
    lines.push(`- Referenced by: ${subjectLink ?? claim.subject_id} — **${claim.predicate}**`);
  }
  return lines.join("\n");
}

function renderEvidence(
  store: ProjectionStore,
  record: CanonicalRecord,
): string {
  const recordEvidenceRefs = ((record as Record<string, unknown>)["evidence_refs"] as string[]) ?? [];
  const claimEvidenceRefs = claimsForRecord(store.claims, record.id).flatMap((c) => c.evidence_refs);
  const allRefs = [...recordEvidenceRefs, ...claimEvidenceRefs];
  if (allRefs.length === 0) return "";

  const ev = evidenceForClaim(store.evidence, allRefs);
  if (ev.length === 0) return "";

  const lines: string[] = ["## Evidence"];
  for (const e of ev) {
    const excerpt = e.excerpt ? ` — *"${e.excerpt}"*` : "";
    const url = buildEvidenceUrl(e, store.sources);
    const link = url ? ` ([GitHub](${url}))` : "";
    lines.push(`- [${e.id}]${excerpt}${link}`);
  }
  return lines.join("\n");
}

export function renderRecordNote(
  store: ProjectionStore,
  resolver: PathResolver,
  record: CanonicalRecord,
): string {
  const aliasMap = store.aliasMap;
  const fm = createFrontmatter(record, store.canonicalHash);
  const fmText = serializeFrontmatter(fm);
  const name = extractDisplayName(record);

  const sections: string[] = [fmText, "", `# ${name}`, ""];
  sections.push(`> **Record type**: \`${record.record_type}\`  `);
  sections.push(`> **Key**: \`${record.key}\`  `);
  sections.push(`> **ID**: \`${record.id}\``, "");

  const props = renderProperties(record);
  if (props) {
    sections.push("## Properties", props, "");
  }

  const rels = renderRelations(store, resolver, aliasMap, record.id);
  if (rels) {
    sections.push(rels, "");
  }

  const claims = renderClaims(store, resolver, aliasMap, record.id);
  if (claims) {
    sections.push(claims, "");
  }

  const evidence = renderEvidence(store, record);
  if (evidence) {
    sections.push(evidence, "");
  }

  return sections.join("\n");
}
