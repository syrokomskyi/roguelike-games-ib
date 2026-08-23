import {
  createRecordId,
  preparePromotion,
  applyPromotionTransaction,
  type TransactionOperation,
} from "../packages/knowledge-core/src/index.ts";
import { readCanonicalState } from "../packages/materializer/src/index.ts";
import { join } from "node:path";
import { existsSync, rmSync, readdirSync, readFileSync } from "node:fs";

const WORKSPACE = "/home/syrokomskyi/projects/roguelike-games-ib";
const CANONICAL_ROOT = join(WORKSPACE, "knowledge");
const STAGING_ROOT = join(WORKSPACE, "staging");

const RUN_ID = "deriver-run-001";

// Attributes that are display metadata — not gameplay-relevant
const SKIP_ATTRIBUTES = new Set([
  "symbol", "color", "glyph", "sprite_path", "tile_coords",
  "description", "path", "flavor_text", "draw_priority",
  "special_attacks", "specialAttacks",
]);

// Attributes that reference other records by native_id → relation
const CROSS_REF_ATTRIBUTES: Record<string, { relationType: string; refType: string }> = {
  leads_to: { relationType: "TRANSFORMS_INTO", refType: "mutation" },
  equivalent_mons: { relationType: "EQUIVALENT_TO", refType: "mons" },
  quest_artifact: { relationType: "REQUIRES", refType: "artifact" },
  talisman: { relationType: "USES_ITEM", refType: "item" },
  monster_index: { relationType: "RELATED_TO", refType: "creature" },
  leader_index: { relationType: "RELATED_TO", refType: "creature" },
  nemesis_index: { relationType: "RELATED_TO", refType: "creature" },
  default_faction: { relationType: "BELONGS_TO", refType: "faction" },
  result: { relationType: "PRODUCES", refType: "item" },
  tools: { relationType: "REQUIRES", refType: "item" },
  components: { relationType: "REQUIRES", refType: "item" },
};

// Grouping attributes → semantic records + PART_OF relations
const GROUPING_ATTRIBUTES = [
  "species", "default_faction", "categories", "category",
  "material", "flags", "resistances", "conveys", "geno_flags",
  "alignment", "holiness", "size", "shape", "blood_type",
  "ability_flags", "flags1", "flags2", "flags3",
  "is_buff", "is_always_active",
  "schools", "parent_branch", "artifact_type", "trap_value", "skill_value",
  "god",
];

interface DerivedData {
  claims: any[];
  relations: any[];
  semanticRecords: any[];
}

function slugify(s: unknown): string {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 60);
}

function recordSlug(recordKey: string): string {
  const parts = recordKey.split("/");
  return parts[parts.length - 1] ?? recordKey;
}

function makeEnvelope(recordType: string, key: string, id: string, sourceId: string, scopeKind: "source" | "cross_game" = "source") {
  const schemaMap: Record<string, string> = {
    claim: "rgkb/claim@2",
    relation: "rgkb/relation@2",
    semantic_record: "rgkb/semantic-record@2",
  };
  return {
    schema: schemaMap[recordType] ?? "rgkb/record@2",
    id,
    key,
    record_type: recordType,
    language: "en",
    scope: { source_id: sourceId, scope_kind: scopeKind },
    origin: { kind: "derived" as const, actor_id: `${sourceId}-deriver`, run_id: RUN_ID },
    epistemic: { status: "observed" as const, confidence: "verified" as const },
    aliases: [] as string[],
  };
}

function buildEvidenceIndex(evidence: any[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const ev of evidence) {
    const recordId = ev.record_id as string | undefined;
    const evId = ev.id as string | undefined;
    if (!recordId || !evId) continue;
    const list = map.get(recordId) ?? [];
    list.push(evId);
    map.set(recordId, list);
  }
  return map;
}

function buildNativeIdIndex(records: any[]): Map<string, any> {
  const map = new Map<string, any>();
  for (const r of records) {
    const si = r.source_identity;
    if (si?.native_id) {
      map.set(si.native_id, r);
    }
  }
  return map;
}

function flattenObject(
  obj: Record<string, unknown>,
  prefix: string,
  depth: number,
): { predicateSuffix: string; value: string | number | boolean }[] {
  const results: { predicateSuffix: string; value: string | number | boolean }[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined || v === "") continue;
    const suffix = `${prefix}_${slugify(k)}`;
    if (typeof v === "object" && !Array.isArray(v) && depth < 2) {
      results.push(...flattenObject(v as Record<string, unknown>, suffix, depth + 1));
    } else if (Array.isArray(v)) {
      for (const elem of v) {
        if (elem === null || elem === undefined || elem === "") continue;
        if (typeof elem === "object") continue;
        results.push({ predicateSuffix: suffix, value: elem as string | number | boolean });
      }
    } else if (typeof v !== "object") {
      results.push({ predicateSuffix: suffix, value: v as string | number | boolean });
    }
  }
  return results;
}

function deriveClaims(
  records: any[],
  evidenceByRecordId: Map<string, string[]>,
): any[] {
  const claims: any[] = [];

  for (const record of records) {
    if (record.record_type !== "definition") continue;
    const attrs = record.attributes as Record<string, unknown> | undefined;
    if (!attrs) continue;

    const sourceId = record.scope?.source_id ?? record.source_identity?.source_id ?? "";
    if (!sourceId) continue;

    const evidenceIds = evidenceByRecordId.get(record.id) ?? [];
    if (evidenceIds.length === 0) continue;

    const rSlug = recordSlug(record.key);

    for (const [attrName, attrValue] of Object.entries(attrs)) {
      if (SKIP_ATTRIBUTES.has(attrName)) continue;
      if (attrValue === null || attrValue === undefined || attrValue === "") continue;

      const predicate = `has_${attrName}`;

      if (Array.isArray(attrValue)) {
        for (const element of attrValue) {
          if (element === null || element === undefined || element === "") continue;
          if (typeof element === "object") continue;
          const vSlug = slugify(element);
          if (!vSlug) continue;
          const claimId = createRecordId();
          const key = `${sourceId}/claim/${rSlug}/${predicate}/${vSlug}`;
          claims.push({
            ...makeEnvelope("claim", key, claimId, sourceId),
            subject_id: record.id,
            predicate,
            assertion_state: "supported",
            value: element,
            evidence_refs: evidenceIds,
          });
        }
      } else if (typeof attrValue === "object") {
        const flattened = flattenObject(attrValue as Record<string, unknown>, attrName, 1);
        for (const { predicateSuffix, value: fValue } of flattened) {
          const vSlug = slugify(fValue);
          if (!vSlug) continue;
          const predicate = `has_${predicateSuffix}`;
          const claimId = createRecordId();
          const key = `${sourceId}/claim/${rSlug}/${predicate}/${vSlug}`;
          claims.push({
            ...makeEnvelope("claim", key, claimId, sourceId),
            subject_id: record.id,
            predicate,
            assertion_state: "supported",
            value: fValue,
            evidence_refs: evidenceIds,
          });
        }
      } else {
        const vSlug = slugify(attrValue);
        if (!vSlug) continue;
        const claimId = createRecordId();
        const key = `${sourceId}/claim/${rSlug}/${predicate}/${vSlug}`;
        claims.push({
          ...makeEnvelope("claim", key, claimId, sourceId),
          subject_id: record.id,
          predicate,
          assertion_state: "supported",
          value: attrValue,
          evidence_refs: evidenceIds,
        });
      }
    }
  }

  return claims;
}

function deriveRelations(
  records: any[],
  evidenceByRecordId: Map<string, string[]>,
  nativeIdIndex: Map<string, any>,
): any[] {
  const relations: any[] = [];

  for (const record of records) {
    if (record.record_type !== "definition") continue;
    const attrs = record.attributes as Record<string, unknown> | undefined;
    if (!attrs) continue;

    const sourceId = record.scope?.source_id ?? record.source_identity?.source_id ?? "";
    if (!sourceId) continue;

    const evidenceIds = evidenceByRecordId.get(record.id) ?? [];
    if (evidenceIds.length === 0) continue;

    const rSlug = recordSlug(record.key);

    for (const [attrName, config] of Object.entries(CROSS_REF_ATTRIBUTES)) {
      const attrValue = attrs[attrName];
      if (!attrValue) continue;

      const values = Array.isArray(attrValue) ? attrValue : [attrValue];
      for (const refValue of values) {
        if (typeof refValue !== "string") continue;
        // Try to find target record by native_id — try configured refType first,
        // then a broader set of common native_id prefixes as fallbacks
        const possibleNativeIds = [
          `${config.refType}:${refValue}`,
          `mutation:${refValue}`,
          `creature:${refValue}`,
          `mons:${refValue}`,
          `item:${refValue}`,
          `artifact:${refValue}`,
          `faction:${refValue}`,
          `monster:${refValue}`,
          `species:${refValue}`,
          `class:${refValue}`,
          `profession:${refValue}`,
          `spell:${refValue}`,
          `branch:${refValue}`,
          `trap:${refValue}`,
          `skill:${refValue}`,
          `effect:${refValue}`,
          `recipe:${refValue}`,
          `bionic:${refValue}`,
          `form:${refValue}`,
          `ability:${refValue}`,
          `job:${refValue}`,
        ];
        let targetRecord: any = null;
        for (const nid of possibleNativeIds) {
          targetRecord = nativeIdIndex.get(nid);
          if (targetRecord) break;
        }
        if (!targetRecord) continue;

        const targetSlug = recordSlug(targetRecord.key);
        const relId = createRecordId();
        const key = `${sourceId}/relation/${rSlug}-${config.relationType}-${targetSlug}`;
        relations.push({
          ...makeEnvelope("relation", key, relId, sourceId),
          relation_type: config.relationType,
          source_record_id: record.id,
          target_record_id: targetRecord.id,
          relation_scope: "game",
          evidence_refs: evidenceIds,
          qualifiers: { via_attribute: attrName },
        });
      }
    }
  }

  return relations;
}

function deriveSemanticRecords(
  records: any[],
  evidenceByRecordId: Map<string, string[]>,
): { semanticRecords: any[]; relations: any[] } {
  const semanticRecords: any[] = [];
  const relations: any[] = [];

  // Group records by (sourceId, kind, attribute, slugified-value)
  // Use slugified value in group key to prevent duplicate semantic record keys
  // when values differ only in case (e.g., ZOMBIE vs zombie)
  const groups = new Map<string, { sourceId: string; kind: string; attr: string; value: string; valueSlug: string; members: any[] }>();

  for (const record of records) {
    if (record.record_type !== "definition") continue;
    const attrs = record.attributes as Record<string, unknown> | undefined;
    if (!attrs) continue;

    const sourceId = record.scope?.source_id ?? record.source_identity?.source_id ?? "";
    if (!sourceId) continue;

    const kind = record.kind ?? "unknown";

    for (const groupAttr of GROUPING_ATTRIBUTES) {
      const attrValue = attrs[groupAttr];
      if (attrValue === null || attrValue === undefined || attrValue === "") continue;

      const values = Array.isArray(attrValue) ? attrValue : [attrValue];
      for (const v of values) {
        if (typeof v !== "string" && typeof v !== "number" && typeof v !== "boolean") continue;
        const vStr = String(v);
        if (!vStr) continue;
        const vSlug = slugify(v);
        if (!vSlug) continue;
        const groupKey = `${sourceId}|${kind}|${groupAttr}|${vSlug}`;
        const group = groups.get(groupKey);
        if (group) {
          group.members.push(record);
        } else {
          groups.set(groupKey, { sourceId, kind, attr: groupAttr, value: vStr, valueSlug: vSlug, members: [record] });
        }
      }
    }
  }

  // Create semantic records for groups with 2+ members
  // Dedup by semantic record key — if key already exists, reuse the existing ID
  const srKeyToId = new Map<string, string>();

  for (const group of groups.values()) {
    if (group.members.length < 2) continue;

    const sourceId = group.sourceId;
    const attrSlug = slugify(group.attr);
    const valueSlug = group.valueSlug;
    const key = `${sourceId}/semantic/${group.kind}-${attrSlug}-${valueSlug}`;

    // Dedup: if we already created a semantic record with this key, reuse its ID
    let srId = srKeyToId.get(key);
    if (!srId) {
      srId = createRecordId();
      srKeyToId.set(key, srId);

      const participantRefs = group.members.map((m) => m.id);
      const evidenceRefs = group.members.flatMap((m) => evidenceByRecordId.get(m.id) ?? []).slice(0, 50);

      const title = `${group.value} ${group.attr.replace(/_/g, " ")} group (${group.kind})`;
      const summary = `${group.members.length} ${group.kind} records in ${sourceId} with ${group.attr} = ${group.value}`;

      semanticRecords.push({
        ...makeEnvelope("semantic_record", key, srId, sourceId),
        semantic_type: "system",
        title,
        summary,
        claim_refs: [],
        evidence_refs: evidenceRefs,
        participant_refs: participantRefs,
        body: {
          grouping_attribute: group.attr,
          grouping_value: group.value,
          kind: group.kind,
          member_count: group.members.length,
        },
      });
    }

    // Create PART_OF relations from each member to the semantic record
    for (const member of group.members) {
      const mSlug = recordSlug(member.key);
      const evidenceIds = evidenceByRecordId.get(member.id) ?? [];
      if (evidenceIds.length === 0) continue;

      const relId = createRecordId();
      const relKey = `${sourceId}/relation/${mSlug}-PART_OF-${valueSlug}-${attrSlug}`;
      relations.push({
        ...makeEnvelope("relation", relKey, relId, sourceId),
        relation_type: "PART_OF",
        source_record_id: member.id,
        target_record_id: srId,
        relation_scope: "game",
        evidence_refs: evidenceIds,
        qualifiers: { via_attribute: group.attr, group_value: group.value },
      });
    }
  }

  // === Cross-game semantic records (D-4) ===
  // Group records by (kind, attribute, valueSlug) across ALL games
  const crossGameGroups = new Map<string, { kind: string; attr: string; value: string; valueSlug: string; members: any[]; sourceIds: Set<string> }>();

  for (const record of records) {
    if (record.record_type !== "definition") continue;
    const attrs = record.attributes as Record<string, unknown> | undefined;
    if (!attrs) continue;

    const sourceId = record.scope?.source_id ?? record.source_identity?.source_id ?? "";
    if (!sourceId) continue;

    const kind = record.kind ?? "unknown";

    for (const groupAttr of GROUPING_ATTRIBUTES) {
      const attrValue = attrs[groupAttr];
      if (attrValue === null || attrValue === undefined || attrValue === "") continue;

      const values = Array.isArray(attrValue) ? attrValue : [attrValue];
      for (const v of values) {
        if (typeof v !== "string" && typeof v !== "number" && typeof v !== "boolean") continue;
        const vStr = String(v);
        if (!vStr) continue;
        const vSlug = slugify(v);
        if (!vSlug) continue;
        const crossKey = `${kind}|${groupAttr}|${vSlug}`;
        const group = crossGameGroups.get(crossKey);
        if (group) {
          group.members.push(record);
          group.sourceIds.add(sourceId);
        } else {
          crossGameGroups.set(crossKey, { kind, attr: groupAttr, value: vStr, valueSlug: vSlug, members: [record], sourceIds: new Set([sourceId]) });
        }
      }
    }
  }

  // Create cross-game semantic records for groups spanning 2+ games
  const CROSS_GAME_SOURCE_ID = "cross-game";
  for (const group of crossGameGroups.values()) {
    if (group.sourceIds.size < 2) continue;
    if (group.members.length < 2) continue;

    const attrSlug = slugify(group.attr);
    const valueSlug = group.valueSlug;
    const key = `${CROSS_GAME_SOURCE_ID}/semantic/${group.kind}-${attrSlug}-${valueSlug}`;

    let srId = srKeyToId.get(key);
    if (!srId) {
      srId = createRecordId();
      srKeyToId.set(key, srId);

      const participantRefs = group.members.map((m) => m.id);
      const evidenceRefs = group.members.flatMap((m) => evidenceByRecordId.get(m.id) ?? []).slice(0, 50);
      const gameList = [...group.sourceIds].sort().join(", ");

      const title = `${group.value} ${group.attr.replace(/_/g, " ")} (${group.kind}, cross-game)`;
      const summary = `${group.members.length} ${group.kind} records across ${group.sourceIds.size} games (${gameList}) with ${group.attr} = ${group.value}`;

      semanticRecords.push({
        ...makeEnvelope("semantic_record", key, srId, CROSS_GAME_SOURCE_ID, "cross_game"),
        semantic_type: "cross_game",
        title,
        summary,
        claim_refs: [],
        evidence_refs: evidenceRefs,
        participant_refs: participantRefs,
        body: {
          grouping_attribute: group.attr,
          grouping_value: group.value,
          kind: group.kind,
          member_count: group.members.length,
          source_games: [...group.sourceIds].sort(),
        },
      });
    }

    // Create PART_OF relations from each member to the cross-game semantic record
    for (const member of group.members) {
      const mSlug = recordSlug(member.key);
      const evidenceIds = evidenceByRecordId.get(member.id) ?? [];
      if (evidenceIds.length === 0) continue;

      const memberSourceId = member.scope?.source_id ?? member.source_identity?.source_id ?? "";
      const relId = createRecordId();
      const relKey = `${CROSS_GAME_SOURCE_ID}/relation/${mSlug}-PART_OF-${valueSlug}-${attrSlug}`;
      relations.push({
        ...makeEnvelope("relation", relKey, relId, CROSS_GAME_SOURCE_ID, "cross_game"),
        relation_type: "PART_OF",
        source_record_id: member.id,
        target_record_id: srId,
        relation_scope: "cross_game",
        evidence_refs: evidenceIds,
        qualifiers: { via_attribute: group.attr, group_value: group.value, source_game: memberSourceId },
      });
    }
  }

  return { semanticRecords, relations };
}

function cleanDerivedData() {
  const derivedDirs = ["claim", "relation", "semantic_record", "concept"];
  let removed = 0;
  for (const dir of derivedDirs) {
    const fullPath = join(CANONICAL_ROOT, dir);
    if (!existsSync(fullPath)) continue;
    // Walk and remove only files with origin.actor_id containing "deriver"
    function walkAndClean(dirPath: string) {
      const entries = readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const childPath = join(dirPath, entry.name);
        if (entry.isDirectory()) {
          walkAndClean(childPath);
          // Remove empty directories
          try {
            if (readdirSync(childPath).length === 0) rmSync(childPath, { recursive: true });
          } catch { /* not empty */ }
        } else if (entry.isFile() && entry.name.endsWith(".jsonl")) {
          try {
            const raw = readFileSync(childPath, "utf-8");
            const d = JSON.parse(raw);
            const actorId = d?.origin?.actor_id ?? "";
            if (actorId.includes("deriver")) {
              rmSync(childPath);
              removed++;
            }
          } catch { /* skip unparseable */ }
        }
      }
    }
    walkAndClean(fullPath);
  }
  if (removed > 0) console.log(`Cleaned ${removed} derived files`);
}

async function main() {
  console.log("Cleaning previous derived data...");
  cleanDerivedData();

  console.log("Reading canonical state...");
  const state = readCanonicalState(CANONICAL_ROOT);

  console.log(`Found ${state.records.length} records, ${state.evidence.length} evidence, ${state.claims.length} claims, ${state.relations.length} relations`);

  // Build indexes
  const evidenceByRecordId = buildEvidenceIndex(state.evidence);
  const nativeIdIndex = buildNativeIdIndex(state.records);

  console.log(`Evidence index: ${evidenceByRecordId.size} records with evidence`);
  console.log(`Native ID index: ${nativeIdIndex.size} records`);

  // Filter definition records (exclude existing semantic records)
  const definitions = state.records.filter((r) => r.record_type === "definition");
  console.log(`Processing ${definitions.length} definition records...`);

  // Derive claims
  console.log("Deriving claims from attributes...");
  const claims = deriveClaims(definitions, evidenceByRecordId);
  console.log(`  ${claims.length} claims`);

  // Derive relations from cross-references
  console.log("Deriving relations from cross-references...");
  const crossRefRelations = deriveRelations(definitions, evidenceByRecordId, nativeIdIndex);
  console.log(`  ${crossRefRelations.length} cross-reference relations`);

  // Derive semantic records and grouping relations
  console.log("Deriving semantic records from groupings...");
  const { semanticRecords, relations: groupRelations } = deriveSemanticRecords(definitions, evidenceByRecordId);
  console.log(`  ${semanticRecords.length} semantic records`);
  console.log(`  ${groupRelations.length} grouping relations`);

  // Combine all relations
  const allRelations = [...crossRefRelations, ...groupRelations];
  console.log(`  Total relations: ${allRelations.length}`);

  // Build transaction operations with key deduplication
  const ops: TransactionOperation[] = [];
  const seenKeys = new Set<string>();
  let dupCount = 0;

  function addOp(record: any, recordType: string) {
    const opKey = `${recordType}/${record.key}`;
    if (seenKeys.has(opKey)) {
      dupCount++;
      return;
    }
    seenKeys.add(opKey);
    ops.push({ type: "create", record_id: record.id, record_type: recordType, key: record.key, data: record });
  }

  for (const claim of claims) addOp(claim, "claim");
  for (const rel of allRelations) addOp(rel, "relation");
  for (const sr of semanticRecords) addOp(sr, "semantic_record");

  if (dupCount > 0) console.log(`  Skipped ${dupCount} duplicate-key operations`);
  console.log(`Total operations: ${ops.length}`);

  if (ops.length === 0) {
    console.log("No operations to apply. Done.");
    return;
  }

  // Apply transaction
  const txId = "deriver-tx-001";
  const plan = preparePromotion(txId, null, ops, {});
  const applyResult = applyPromotionTransaction(plan, CANONICAL_ROOT, STAGING_ROOT);

  console.log("Transaction status:", applyResult.status);
  if (applyResult.status !== "COMMITTED") {
    console.error("Transaction failed:", JSON.stringify(applyResult.plan.diagnostics, null, 2));
    process.exit(1);
  }

  console.log(`Promoted ${ops.length} derived records to canonical.`);
  console.log(`  ${claims.length} claims`);
  console.log(`  ${allRelations.length} relations`);
  console.log(`  ${semanticRecords.length} semantic records`);
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
