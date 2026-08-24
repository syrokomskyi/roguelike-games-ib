/*
<MODULE_CONTRACT>
<purpose>Renders Obsidian markdown notes for canonical records with frontmatter, properties, relations, claims, and evidence sections.</purpose>
<non-goals>
  <item>Does not render source notes — use render-source module.</item>
  <item>Does not render MOC — use moc module.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: renderRecordNote with properties, relations, claims, and evidence rendering.</item>
</CHANGE_SUMMARY>
*/
import type { CanonicalRecord } from "@roguelike-games-ib/materializer";
import type { ClaimRecord, RelationRecord } from "@roguelike-games-ib/knowledge-core";
import type { PublicEvidence } from "@roguelike-games-ib/materializer";
import type { ProjectionStore, IProjectionStore } from "@roguelike-games-ib/projection-sdk";
import { buildEvidenceUrl } from "@roguelike-games-ib/projection-sdk";
import { groupRelationsByType } from "@roguelike-games-ib/projection-sdk";
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

function renderConceptDetails(
  store: IProjectionStore,
  resolver: PathResolver,
  aliasMap: AliasMap,
  record: CanonicalRecord,
): string {
  if (record.record_type !== "concept") return "";

  const sections: string[] = [];

  const conceptType = (record as Record<string, unknown>).concept_type as string | undefined;
  const definition = (record as Record<string, unknown>).definition as string | undefined;
  const inclusionCriteria = (record as Record<string, unknown>).inclusion_criteria as string[] | undefined;
  const exclusionCriteria = (record as Record<string, unknown>).exclusion_criteria as string[] | undefined;
  const implementationRefs = (record as Record<string, unknown>).implementation_refs as string[] | undefined;
  const ancestry = (record as Record<string, unknown>).ancestry as Record<string, unknown> | undefined;

  if (conceptType) {
    sections.push(`> **Concept type**: \`${conceptType}\``);
  }
  if (definition) {
    sections.push("", "## Definition", definition, "");
  }
  if (inclusionCriteria && inclusionCriteria.length > 0) {
    sections.push("## Inclusion Criteria");
    for (const c of inclusionCriteria) sections.push(`- ${c}`);
    sections.push("");
  }
  if (exclusionCriteria && exclusionCriteria.length > 0) {
    sections.push("## Exclusion Criteria");
    for (const c of exclusionCriteria) sections.push(`- ${c}`);
    sections.push("");
  }
  if (implementationRefs && implementationRefs.length > 0) {
    sections.push("## Implementation References");
    for (const ref of implementationRefs) {
      const link = makeWikiLink(resolver, aliasMap, ref);
      sections.push(`- ${link ?? ref}`);
    }
    sections.push("");
  }
  if (ancestry) {
    const sourceGames = ancestry.source_games as string[] | undefined;
    const mutationDims = ancestry.mutation_dimensions as string[] | undefined;
    const observedIn = ancestry.observed_in as string[] | undefined;

    sections.push("## Ancestry");
    if (sourceGames && sourceGames.length > 0) {
      sections.push(`- **Source games**: ${sourceGames.join(", ")}`);
    }
    if (observedIn && observedIn.length > 0) {
      sections.push(`- **Observed in**: ${observedIn.join(", ")}`);
    }
    if (mutationDims && mutationDims.length > 0) {
      sections.push(`- **Mutation dimensions**: ${mutationDims.join(", ")}`);
    }
    sections.push("");
  }

  return sections.join("\n");
}

async function renderRelations(
  store: IProjectionStore,
  resolver: PathResolver,
  aliasMap: AliasMap,
  recordId: string,
): Promise<string> {
  const { outgoing, incoming } = await store.relationsForRecord(recordId);
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

async function renderClaims(
  store: IProjectionStore,
  resolver: PathResolver,
  aliasMap: AliasMap,
  recordId: string,
): Promise<string> {
  const claims = await store.claimsForRecord(recordId);
  const refClaims = await store.claimsReferencingRecord(recordId);
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

    const ev = await store.evidenceForClaim(claim.evidence_refs);
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

async function renderEvidence(
  store: ProjectionStore,
  record: CanonicalRecord,
): Promise<string> {
  const recordEvidenceRefs = ((record as Record<string, unknown>)["evidence_refs"] as string[]) ?? [];
  const claims = await store.claimsForRecord(record.id);
  const claimEvidenceRefs = claims.flatMap((c) => c.evidence_refs);
  const allRefs = [...recordEvidenceRefs, ...claimEvidenceRefs];
  if (allRefs.length === 0) return "";

  const ev = await store.evidenceForClaim(allRefs);
  if (ev.length === 0) return "";

  const lines: string[] = ["## Evidence"];
  for (const e of ev) {
    const url = buildEvidenceUrl(e, store.sources);
    const link = url ? ` ([GitHub](${url}))` : "";

    if (e.evidence_kind === "asset" && e.media) {
      const altText = e.media.alt_text ?? e.artifact_path;
      const dims = e.media.width && e.media.height
        ? ` (${e.media.width}x${e.media.height})`
        : "";
      lines.push(`- **[${altText}]${dims}**`);
      if (url) {
        lines.push(`  ![](${url})`);
      }
      lines.push(`  - Path: \`${e.artifact_path}\``);
      lines.push(`  - SHA-256: \`${e.artifact_sha256}\``);
      continue;
    }

    const excerpt = e.excerpt ? ` — *"${e.excerpt}"*` : "";
    lines.push(`- [${e.id}]${excerpt}${link}`);
  }
  return lines.join("\n");
}

export async function renderRecordNote(
  store: ProjectionStore,
  resolver: PathResolver,
  record: CanonicalRecord,
): Promise<string> {
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

  const conceptDetails = renderConceptDetails(store, resolver, aliasMap, record);
  if (conceptDetails) {
    sections.push(conceptDetails);
  }

  const rels = await renderRelations(store, resolver, aliasMap, record.id);
  if (rels) {
    sections.push(rels, "");
  }

  const claims = await renderClaims(store, resolver, aliasMap, record.id);
  if (claims) {
    sections.push(claims, "");
  }

  const evidence = await renderEvidence(store, record);
  if (evidence) {
    sections.push(evidence, "");
  }

  return sections.join("\n");
}
