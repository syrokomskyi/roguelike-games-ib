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

const RUN_ID = "concepts-run-001";
const ACTOR_ID = "cross-game-concepts";

// Semantic equivalence mappings: attributes from different games that represent the same concept
// Format: { conceptName, attrMapping: [{ games: [sourceIds], attr: attributeName }] }
const SEMANTIC_EQUIVALENCES: {
  conceptName: string;
  kind: string;
  description: string;
  attrMapping: { sourceId: string; attr: string }[];
}[] = [
  {
    conceptName: "Fire Resistance",
    kind: "creature",
    description: "Creatures that resist or are immune to fire damage across roguelike games.",
    attrMapping: [
      { sourceId: "broguece", attr: "conveys" },
      { sourceId: "nethack", attr: "resistances" },
      { sourceId: "crawl", attr: "resists" },
      { sourceId: "cataclysm-bn", attr: "flags" },
    ],
  },
  {
    conceptName: "Cold Resistance",
    kind: "creature",
    description: "Creatures that resist or are immune to cold damage across roguelike games.",
    attrMapping: [
      { sourceId: "broguece", attr: "conveys" },
      { sourceId: "nethack", attr: "resistances" },
      { sourceId: "crawl", attr: "resists" },
    ],
  },
  {
    conceptName: "Poison Resistance",
    kind: "creature",
    description: "Creatures that resist or are immune to poison across roguelike games.",
    attrMapping: [
      { sourceId: "broguece", attr: "conveys" },
      { sourceId: "nethack", attr: "resistances" },
      { sourceId: "crawl", attr: "resists" },
    ],
  },
  {
    conceptName: "Electricity Resistance",
    kind: "creature",
    description: "Creatures that resist or are immune to electrical damage across roguelike games.",
    attrMapping: [
      { sourceId: "broguece", attr: "conveys" },
      { sourceId: "nethack", attr: "resistances" },
      { sourceId: "crawl", attr: "resists" },
    ],
  },
  {
    conceptName: "Faction Membership",
    kind: "creature",
    description: "Creatures that belong to a faction or group, determining hostile/neutral behavior toward other creatures.",
    attrMapping: [
      { sourceId: "cataclysm-bn", attr: "default_faction" },
      { sourceId: "crawl", attr: "holiness" },
    ],
  },
  {
    conceptName: "Creature Alignment",
    kind: "creature",
    description: "Creatures with an alignment or moral axis that affects gameplay interactions.",
    attrMapping: [
      { sourceId: "nethack", attr: "alignment" },
      { sourceId: "crawl", attr: "holiness" },
    ],
  },
  {
    conceptName: "Mutation System",
    kind: "mutation",
    description: "Character modification systems where mutations grant new abilities or change properties, often with progression chains.",
    attrMapping: [
      { sourceId: "broguece", attr: "conveys" },
      { sourceId: "cataclysm-bn", attr: "leads_to" },
    ],
  },
  {
    conceptName: "Item Material",
    kind: "item",
    description: "Items categorized by material composition, affecting properties like durability and interactions.",
    attrMapping: [
      { sourceId: "nethack", attr: "material" },
      { sourceId: "broguece", attr: "category" },
    ],
  },
];

// Value normalization: map game-specific values to canonical concept values
const VALUE_NORMALIZATIONS: Record<string, Record<string, string>> = {
  "Fire Resistance": {
    "fire": "fire",
    "rf": "fire",
    "resist_fire": "fire",
    "fire_resist": "fire",
    "rfire": "fire",
    "RESIST_FIRE": "fire",
    "FIRE_RES": "fire",
    "FIREY": "fire",
    "FIRE": "fire",
  },
  "Cold Resistance": {
    "cold": "cold",
    "rc": "cold",
    "resist_cold": "cold",
    "cold_resist": "cold",
    "rcold": "cold",
    "RESIST_COLD": "cold",
    "COLD_RES": "cold",
    "COLDY": "cold",
    "COLD": "cold",
  },
  "Poison Resistance": {
    "poison": "poison",
    "rp": "poison",
    "resist_poison": "poison",
    "poison_resist": "poison",
    "rpois": "poison",
    "RESIST_POISON": "poison",
    "POISON_RES": "poison",
    "POISONOUS": "poison",
    "POISON": "poison",
  },
  "Electricity Resistance": {
    "electricity": "electricity",
    "relec": "electricity",
    "resist_electric": "electricity",
    "elec_resist": "electricity",
    "rlec": "electricity",
    "RESIST_ELECTRIC": "electricity",
    "ELEC_RES": "electricity",
    "ELECTRIC": "electricity",
    "LIGHTNING": "electricity",
  },
};

function slugify(s: unknown): string {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 60);
}

function makeConceptEnvelope(key: string, id: string) {
  return {
    schema: "rgkb/concept@2",
    id,
    key,
    record_type: "concept",
    language: "en",
    scope: { source_id: "cross-game", scope_kind: "cross_game" as const },
    origin: { kind: "derived" as const, actor_id: ACTOR_ID, run_id: RUN_ID },
    epistemic: { status: "observed" as const, confidence: "inferred" as const },
    aliases: [] as string[],
  };
}

function cleanConceptData() {
  const conceptDir = join(CANONICAL_ROOT, "concept");
  if (!existsSync(conceptDir)) return;
  let removed = 0;
  function walkAndClean(dirPath: string) {
    const entries = readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const childPath = join(dirPath, entry.name);
      if (entry.isDirectory()) {
        walkAndClean(childPath);
        try {
          if (readdirSync(childPath).length === 0) rmSync(childPath, { recursive: true });
        } catch { /* not empty */ }
      } else if (entry.isFile() && entry.name.endsWith(".jsonl")) {
        try {
          const raw = readFileSync(childPath, "utf-8");
          const d = JSON.parse(raw);
          const actorId = d?.origin?.actor_id ?? "";
          if (actorId === ACTOR_ID) {
            rmSync(childPath);
            removed++;
          }
        } catch { /* skip */ }
      }
    }
  }
  walkAndClean(conceptDir);
  if (removed > 0) console.log(`Cleaned ${removed} previous concept files from ${ACTOR_ID}`);
}

function normalizeValue(conceptName: string, value: string): string | null {
  const normMap = VALUE_NORMALIZATIONS[conceptName];
  if (normMap) {
    const lower = value.toLowerCase();
    for (const [key, canonical] of Object.entries(normMap)) {
      if (lower === key || lower.includes(key)) return canonical;
    }
  }
  return null;
}

function generateExactMatchConcepts(records: any[]): any[] {
  const concepts: any[] = [];

  // Group by (kind, attribute, valueSlug) across games
  const groups = new Map<string, { kind: string; attr: string; value: string; valueSlug: string; members: any[]; sourceIds: Set<string> }>();

  for (const record of records) {
    if (record.record_type !== "definition") continue;
    const attrs = record.attributes as Record<string, unknown> | undefined;
    if (!attrs) continue;

    const sourceId = record.scope?.source_id ?? record.source_identity?.source_id ?? "";
    if (!sourceId) continue;

    const kind = record.kind ?? "unknown";

    for (const [attrName, attrValue] of Object.entries(attrs)) {
      if (attrValue === null || attrValue === undefined || attrValue === "") continue;

      const values = Array.isArray(attrValue) ? attrValue : [attrValue];
      for (const v of values) {
        if (typeof v !== "string" && typeof v !== "number" && typeof v !== "boolean") continue;
        const vStr = String(v);
        if (!vStr || vStr.length < 2) continue;
        const vSlug = slugify(v);
        if (!vSlug) continue;
        const groupKey = `${kind}|${attrName}|${vSlug}`;
        const group = groups.get(groupKey);
        if (group) {
          group.members.push(record);
          group.sourceIds.add(sourceId);
        } else {
          groups.set(groupKey, { kind, attr: attrName, value: vStr, valueSlug: vSlug, members: [record], sourceIds: new Set([sourceId]) });
        }
      }
    }
  }

  // Create concepts for groups spanning 2+ games with 5+ members
  for (const group of groups.values()) {
    if (group.sourceIds.size < 2) continue;
    if (group.members.length < 5) continue;

    // Limit implementation refs to 20 per game to keep concepts manageable
    const refsByGame = new Map<string, string[]>();
    for (const member of group.members) {
      const sid = member.scope?.source_id ?? member.source_identity?.source_id ?? "";
      const refs = refsByGame.get(sid) ?? [];
      if (refs.length < 20) refs.push(member.id);
      refsByGame.set(sid, refs);
    }
    const implementationRefs = [...refsByGame.values()].flat();

    const gameList = [...group.sourceIds].sort().join(", ");
    const conceptName = `${group.value} ${group.attr.replace(/_/g, " ")} (${group.kind})`;
    const conceptSlug = slugify(`${group.kind}-${group.attr}-${group.valueSlug}`);

    const conceptId = createRecordId();
    const key = `cross-game/concept/${conceptSlug}`;

    concepts.push({
      ...makeConceptEnvelope(key, conceptId),
      concept_type: "cross_game_mechanic",
      title: conceptName.charAt(0).toUpperCase() + conceptName.slice(1),
      definition: `${group.value} as a ${group.attr.replace(/_/g, " ")} value appears in ${group.kind} records across ${group.sourceIds.size} games (${gameList}). This represents a shared game mechanic or property that is implemented differently in each game but shares the same semantic category.`,
      inclusion_criteria: [
        `Record kind is ${group.kind}`,
        `Record has attribute ${group.attr} with value matching "${group.value}"`,
        `Record appears in 2 or more games`,
      ],
      exclusion_criteria: [
        `Records where ${group.attr} is only superficially similar but has different gameplay semantics`,
        `Single-game occurrences without cross-game relevance`,
      ],
      implementation_refs: implementationRefs,
      decision_refs: [],
      evidence_refs: [],
      ancestry: {
        source_games: [...group.sourceIds].sort(),
        observed_in: [`${group.attr} attribute on ${group.kind} records`],
        derived_from: implementationRefs.slice(0, 10),
        mutation_dimensions: ["implementation_method", "effect_magnitude", "stacking_rules", "acquisition_method"],
      },
    });
  }

  return concepts;
}

function generateSemanticEquivalenceConcepts(records: any[]): any[] {
  const concepts: any[] = [];

  for (const equiv of SEMANTIC_EQUIVALENCES) {
    const membersByGame = new Map<string, any[]>();

    for (const mapping of equiv.attrMapping) {
      const gameRecords = records.filter(
        (r) =>
          r.record_type === "definition" &&
          r.kind === equiv.kind &&
          (r.scope?.source_id ?? r.source_identity?.source_id) === mapping.sourceId,
      );

      const matched: any[] = [];
      for (const record of gameRecords) {
        const attrs = record.attributes as Record<string, unknown> | undefined;
        if (!attrs) continue;
        const attrValue = attrs[mapping.attr];
        if (attrValue === null || attrValue === undefined || attrValue === "") continue;

        const values = Array.isArray(attrValue) ? attrValue : [attrValue];
        for (const v of values) {
          if (typeof v !== "string") continue;
          const normalized = normalizeValue(equiv.conceptName, v);
          if (normalized) {
            matched.push(record);
            break;
          }
        }
      }

      if (matched.length > 0) {
        membersByGame.set(mapping.sourceId, matched);
      }
    }

    // Need at least 2 games with matches
    if (membersByGame.size < 2) continue;

    const implementationRefs: string[] = [];
    for (const [, members] of membersByGame) {
      implementationRefs.push(...members.slice(0, 20).map((m) => m.id));
    }

    const gameList = [...membersByGame.keys()].sort().join(", ");
    const conceptSlug = slugify(equiv.conceptName);
    const conceptId = createRecordId();
    const key = `cross-game/concept/${conceptSlug}`;

    const memberCount = [...membersByGame.values()].reduce((sum, members) => sum + members.length, 0);

    concepts.push({
      ...makeConceptEnvelope(key, conceptId),
      concept_type: "cross_game_mechanic",
      title: equiv.conceptName,
      definition: `${equiv.description} Found in ${memberCount} records across ${membersByGame.size} games (${gameList}). Each game implements this concept through different attribute names and value systems, but the underlying mechanic is semantically equivalent.`,
      inclusion_criteria: [
        `Record kind is ${equiv.kind}`,
        `Record has a resistance/immunity attribute matching the concept's element`,
        `Record appears in 2 or more games with semantically equivalent attributes`,
      ],
      exclusion_criteria: [
        `Records with only superficial value name matches but different gameplay semantics`,
        `Temporary or conditional resistances that are not intrinsic properties`,
      ],
      implementation_refs: implementationRefs,
      decision_refs: [],
      evidence_refs: [],
      ancestry: {
        source_games: [...membersByGame.keys()].sort(),
        observed_in: equiv.attrMapping.map((m) => `${m.sourceId}: ${m.attr}`),
        derived_from: implementationRefs.slice(0, 10),
        mutation_dimensions: ["resistance_magnitude", "stacking_rules", "acquisition_method", "immunity_vs_partial"],
      },
    });
  }

  return concepts;
}

async function main() {
  console.log("Cleaning previous auto-generated concepts...");
  cleanConceptData();

  console.log("Reading canonical state...");
  const state = readCanonicalState(CANONICAL_ROOT);
  console.log(`Found ${state.records.length} records`);

  const definitions = state.records.filter((r) => r.record_type === "definition");
  console.log(`Processing ${definitions.length} definition records...`);

  // Generate concepts via exact attribute matching
  console.log("Generating exact-match cross-game concepts...");
  const exactConcepts = generateExactMatchConcepts(definitions);
  console.log(`  ${exactConcepts.length} exact-match concepts`);

  // Generate concepts via semantic equivalence mappings
  console.log("Generating semantic-equivalence cross-game concepts...");
  const semanticConcepts = generateSemanticEquivalenceConcepts(definitions);
  console.log(`  ${semanticConcepts.length} semantic-equivalence concepts`);

  // Combine and dedup by key
  const allConcepts = [...exactConcepts, ...semanticConcepts];
  const seenKeys = new Set<string>();
  const uniqueConcepts = allConcepts.filter((c) => {
    if (seenKeys.has(c.key)) return false;
    seenKeys.add(c.key);
    return true;
  });
  console.log(`  ${uniqueConcepts.length} unique concepts (after dedup)`);

  if (uniqueConcepts.length === 0) {
    console.log("No concepts to create. Done.");
    return;
  }

  // Build transaction
  const ops: TransactionOperation[] = [];
  for (const concept of uniqueConcepts) {
    ops.push({ type: "create", record_id: concept.id, record_type: "concept", key: concept.key, data: concept });
  }

  console.log(`Total operations: ${ops.length}`);

  const txId = "concepts-tx-001";
  const plan = preparePromotion(txId, null, ops, {});
  const applyResult = applyPromotionTransaction(plan, CANONICAL_ROOT, STAGING_ROOT);

  console.log("Transaction status:", applyResult.status);
  if (applyResult.status !== "COMMITTED") {
    console.error("Transaction failed:", JSON.stringify(applyResult.plan.diagnostics, null, 2));
    process.exit(1);
  }

  console.log(`Promoted ${uniqueConcepts.length} cross-game concepts to canonical.`);
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
