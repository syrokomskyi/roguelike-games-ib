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

const RUN_ID = "design-run-001";
const ACTOR_ID = "design-primitives";

function slugify(s: string): string {
  return s
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

function makeRelationEnvelope(key: string, id: string, relationType: string, sourceId: string, targetId: string, scope: string, qualifiers: Record<string, unknown>, evidenceRefs: string[] = []) {
  return {
    schema: "rgkb/relation@2",
    id,
    key,
    record_type: "relation",
    language: "en",
    scope: { source_id: "cross-game", scope_kind: "cross_game" as const },
    origin: { kind: "derived" as const, actor_id: ACTOR_ID, run_id: RUN_ID },
    epistemic: { status: "observed" as const, confidence: "inferred" as const },
    aliases: [] as string[],
    relation_type: relationType,
    source_record_id: sourceId,
    target_record_id: targetId,
    relation_scope: scope,
    evidence_refs: evidenceRefs,
    qualifiers,
  };
}

function makeEvidenceEnvelope(key: string, id: string) {
  return {
    schema: "rgkb/evidence@2",
    id,
    key,
    record_type: "evidence",
    language: "en",
    scope: { source_id: "cross-game", scope_kind: "cross_game" as const },
    origin: { kind: "curated" as const, actor_id: ACTOR_ID, run_id: RUN_ID },
    epistemic: { status: "observed" as const, confidence: "inferred" as const },
    aliases: [] as string[],
    record_id: null,
    anchor: {
      artifact_path: "docs/plans/plan-003-knowledge-base-enrichment.md",
      locator: {
        symbol: "PLAN-003",
        line_start: 1,
        line_end: 234,
        byte_start: null,
        byte_end: null,
        data_key: "design-primitives",
      },
    },
  };
}

function cleanDesignData() {
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
  // Also clean relations from this actor
  const relDir = join(CANONICAL_ROOT, "relation");
  if (existsSync(relDir)) {
    function walkAndCleanRels(dirPath: string) {
      const entries = readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const childPath = join(dirPath, entry.name);
        if (entry.isDirectory()) {
          walkAndCleanRels(childPath);
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
    walkAndCleanRels(relDir);
  }
  if (removed > 0) console.log(`Cleaned ${removed} previous design files from ${ACTOR_ID}`);
}

interface DesignPrimitive {
  slug: string;
  title: string;
  definition: string;
  concept_type: string;
  inclusion_criteria: string[];
  exclusion_criteria: string[];
  mutation_dimensions: string[];
  pressures: string[];
}

const DESIGN_PRIMITIVES: DesignPrimitive[] = [
  {
    slug: "permadeath",
    title: "Permadeath",
    definition: "A game mechanic where character death is permanent — the player loses all progress and must start a new game. This creates extreme stakes for every decision and fundamentally shapes the risk/reward calculus of gameplay.",
    concept_type: "design_primitive",
    inclusion_criteria: [
      "Character death results in permanent loss of the character",
      "No respawn or continue option after death",
      "Progress (items, levels, map knowledge) is lost on death",
      "Player must start a new game after death",
    ],
    exclusion_criteria: [
      "Games with respawn mechanics or extra lives",
      "Save-scumming as an intended mechanic",
      "Temporary death with resurrection",
    ],
    mutation_dimensions: ["death_finality", "progression_retention", "meta_progression", "death_frequency"],
    pressures: ["risk_aversion", "resource_hoarding", "cautious_exploration"],
  },
  {
    slug: "procedural_generation",
    title: "Procedural Generation",
    definition: "A game mechanic where game content (levels, items, monsters, maps) is generated algorithmically rather than hand-designed. This creates unique playthroughs and high replayability but reduces designer control over specific experiences.",
    concept_type: "design_primitive",
    inclusion_criteria: [
      "Game levels or maps are generated by algorithms",
      "Each playthrough produces different content layouts",
      "Content generation uses random seeds with deterministic algorithms",
      "Player cannot predict exact layout before exploration",
    ],
    exclusion_criteria: [
      "Fixed/pre-designed levels without randomization",
      "Cosmetic randomization that doesn't affect gameplay",
      "Player-created content (not procedural)",
    ],
    mutation_dimensions: ["generation_algorithm", "randomness_degree", "content_variety", "seed_control"],
    pressures: ["exploration_tension", "adaptation_requirement", "unfairness_risk"],
  },
  {
    slug: "inventory_management",
    title: "Inventory Management",
    definition: "A game system where players must manage limited inventory space, creating strategic decisions about what to carry, what to discard, and what to prioritize. Inventory constraints create tension between exploration preparedness and loot acquisition.",
    concept_type: "design_primitive",
    inclusion_criteria: [
      "Player has finite inventory capacity",
      "Items take up space in inventory",
      "Player must choose which items to carry vs discard",
      "Inventory limits create strategic trade-offs",
    ],
    exclusion_criteria: [
      "Unlimited inventory with no capacity constraints",
      "Inventory that is purely cosmetic without gameplay impact",
      "Crafting-only systems without carry limits",
    ],
    mutation_dimensions: ["capacity_limit", "stacking_rules", "weight_system", "container_nesting"],
    pressures: ["resource_scarcity", "decision_paralysis", "opportunity_cost"],
  },
  {
    slug: "turn_based_combat",
    title: "Turn-Based Combat",
    definition: "A combat system where actions are resolved in discrete turns, giving players unlimited time to consider each action. This creates a tactical puzzle-solving experience rather than a reflex-based one.",
    concept_type: "design_primitive",
    inclusion_criteria: [
      "Combat actions are resolved in discrete turns",
      "Player has unlimited time to decide each action",
      "Action order is deterministic or queue-based",
      "Positioning and timing within turn order matters",
    ],
    exclusion_criteria: [
      "Real-time combat with action clocks",
      "Combat where reflexes matter more than strategy",
      "Simultaneous resolution without turn structure",
    ],
    mutation_dimensions: ["action_points", "turn_order", "simultaneous_actions", "interrupt_mechanics"],
    pressures: ["tactical_depth", "analysis_paralysis", "pacing_tension"],
  },
  {
    slug: "identification_system",
    title: "Item Identification System",
    definition: "A game mechanic where items must be identified before their properties are known. This creates information asymmetry and risk — using an unknown item may be beneficial or harmful. Identification consumes resources or creates gameplay decisions.",
    concept_type: "design_primitive",
    inclusion_criteria: [
      "Items have unknown properties until identified",
      "Identification requires resources, spells, or actions",
      "Using unidentified items carries risk",
      "Identification creates strategic decisions (identify now vs later)",
    ],
    exclusion_criteria: [
      "Items with always-visible properties",
      "Identification that is free and instantaneous",
      "Items that are purely cosmetic without hidden properties",
    ],
    mutation_dimensions: ["identification_cost", "identification_methods", "risk_of_use", "curse_mechanics"],
    pressures: ["information_asymmetry", "resource_scarcity", "risk_assessment"],
  },
  {
    slug: "hunger_clock",
    title: "Hunger Clock",
    definition: "A game mechanic that imposes a time pressure on the player through a hunger, food, or deterioration system. The player must find sustenance or resources periodically, preventing indefinite stalling and forcing exploration.",
    concept_type: "design_primitive",
    inclusion_criteria: [
      "Player has a depleting resource (hunger, food, light, fuel)",
      "Resource must be replenished periodically",
      "Resource depletion causes negative effects or death",
      "Creates time pressure preventing indefinite stalling",
    ],
    exclusion_criteria: [
      "Games without any time pressure mechanic",
      "Optional food/healing that doesn't create pressure",
      "Purely cosmetic hunger without gameplay consequences",
    ],
    mutation_dimensions: ["depletion_rate", "replenishment_difficulty", "penalty_severity", "resource_abundance"],
    pressures: ["time_pressure", "resource_scarcity", "exploration_urgency"],
  },
  {
    slug: "stealth_and_awareness",
    title: "Stealth and Awareness System",
    definition: "A game mechanic where visibility and detection affect gameplay — creatures can be aware or unaware of the player, and stealth tactics can avoid or delay combat. Line-of-sight, lighting, and noise create tactical depth.",
    concept_type: "design_primitive",
    inclusion_criteria: [
      "Creatures have awareness states (asleep, awake, alerted)",
      "Player can avoid detection through stealth",
      "Line-of-sight or lighting affects visibility",
      "Stealth creates tactical options beyond direct combat",
    ],
    exclusion_criteria: [
      "Games where all creatures are always aware of the player",
      "Pure combat games without stealth options",
      "Visibility that is purely cosmetic",
    ],
    mutation_dimensions: ["detection_range", "alertness_persistence", "stealth_methods", "lighting_impact"],
    pressures: ["information_asymmetry", "positional_advantage", "risk_vs_reward"],
  },
];

async function main() {
  console.log("Cleaning previous design data...");
  cleanDesignData();

  console.log("Reading canonical state...");
  const state = readCanonicalState(CANONICAL_ROOT);
  console.log(`Found ${state.records.length} records`);

  // Find existing concept records to link to
  const existingConcepts = state.records.filter((r) => r.record_type === "concept");
  console.log(`Found ${existingConcepts.length} existing concepts`);

  const concepts: any[] = [];
  const relations: any[] = [];
  const evidenceList: any[] = [];

  // Create one evidence record for the design analysis
  const designEvId = createRecordId();
  const designEvKey = `cross-game/evidence/design-analysis`;
  evidenceList.push({
    ...makeEvidenceEnvelope(designEvKey, designEvId),
  });

  // Track pressure concept IDs by key to avoid duplicate concepts with different IDs
  const pressureConceptIds = new Map<string, string>();

  // Create design primitive concepts
  for (const dp of DESIGN_PRIMITIVES) {
    const conceptId = createRecordId();
    const key = `cross-game/concept/design-${dp.slug}`;

    concepts.push({
      ...makeConceptEnvelope(key, conceptId),
      concept_type: dp.concept_type,
      title: dp.title,
      definition: dp.definition,
      inclusion_criteria: dp.inclusion_criteria,
      exclusion_criteria: dp.exclusion_criteria,
      implementation_refs: [],
      decision_refs: [],
      evidence_refs: [],
      ancestry: {
        source_games: ["broguece", "cataclysm-bn", "crawl", "nethack"],
        observed_in: ["cross-game design analysis"],
        derived_from: [],
        mutation_dimensions: dp.mutation_dimensions,
      },
    });

    // Create design pressure concepts and relations
    for (const pressureName of dp.pressures) {
      const pressureSlug = slugify(pressureName);
      const pressureKey = `cross-game/concept/pressure-${pressureSlug}`;

      // Dedup: reuse existing pressure concept if already created by another primitive
      let pressureId = pressureConceptIds.get(pressureKey);
      if (!pressureId) {
        pressureId = createRecordId();
        pressureConceptIds.set(pressureKey, pressureId);

        concepts.push({
          ...makeConceptEnvelope(pressureKey, pressureId),
          concept_type: "design_pressure",
          title: pressureName.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
          definition: `A design pressure created by ${dp.title.toLowerCase()} that forces players to make meaningful strategic decisions.`,
          inclusion_criteria: [`Pressure arises from ${dp.title} mechanic`],
          exclusion_criteria: ["Pressures from unrelated game systems"],
          implementation_refs: [conceptId],
          decision_refs: [],
          evidence_refs: [],
          ancestry: {
            source_games: ["broguece", "cataclysm-bn", "crawl", "nethack"],
            observed_in: [`${dp.title} design analysis`],
            derived_from: [conceptId],
            mutation_dimensions: [],
          },
        });
      }

      // CREATES_PRESSURE relation: primitive → pressure
      const relId = createRecordId();
      const relKey = `cross-game/relation/${dp.slug}-creates_pressure-${pressureSlug}`;
      relations.push({
        ...makeRelationEnvelope(relKey, relId, "CREATES_PRESSURE", conceptId, pressureId, "cross_game", {
          design_primitive: dp.slug,
          pressure: pressureSlug,
        }, [designEvId]),
      });
    }
  }

  // Create tensions between pressures from different primitives
  const tensionPairs: [string, string, string][] = [
    ["risk_aversion", "exploration_urgency", "Permadeath makes exploration risky, but hunger clock forces exploration"],
    ["resource_scarcity", "information_asymmetry", "Limited resources force choices, but unidentified items add uncertainty"],
    ["tactical_depth", "time_pressure", "Turn-based combat rewards thinking, but hunger clock punishes delays"],
    ["risk_aversion", "resource_hoarding", "Permadeath encourages caution, but inventory limits force discarding items"],
  ];

  for (const [pressure1, pressure2, description] of tensionPairs) {
    const p1Id = pressureConceptIds.get(`cross-game/concept/pressure-${slugify(pressure1)}`);
    const p2Id = pressureConceptIds.get(`cross-game/concept/pressure-${slugify(pressure2)}`);
    if (!p1Id || !p2Id) continue;

    const relId = createRecordId();
    const relKey = `cross-game/relation/tension-${slugify(pressure1)}-${slugify(pressure2)}`;
    relations.push({
      ...makeRelationEnvelope(relKey, relId, "tensions_with", p1Id, p2Id, "cross_game", {
        description,
      }, [designEvId]),
    });
  }

  console.log(`Created ${concepts.length} design concepts (${DESIGN_PRIMITIVES.length} primitives + pressure concepts)`);
  console.log(`Created ${relations.length} design-space relations`);

  // Build transaction
  const ops: TransactionOperation[] = [];
  const seenKeys = new Set<string>();
  let dupCount = 0;

  for (const concept of concepts) {
    const opKey = `concept/${concept.key}`;
    if (seenKeys.has(opKey)) {
      dupCount++;
      continue;
    }
    seenKeys.add(opKey);
    ops.push({ type: "create", record_id: concept.id, record_type: "concept", key: concept.key, data: concept });
  }
  for (const rel of relations) {
    const opKey = `relation/${rel.key}`;
    if (seenKeys.has(opKey)) {
      dupCount++;
      continue;
    }
    seenKeys.add(opKey);
    ops.push({ type: "create", record_id: rel.id, record_type: "relation", key: rel.key, data: rel });
  }
  for (const ev of evidenceList) {
    const opKey = `evidence/${ev.key}`;
    if (seenKeys.has(opKey)) {
      dupCount++;
      continue;
    }
    seenKeys.add(opKey);
    ops.push({ type: "create", record_id: ev.id, record_type: "evidence", key: ev.key, data: ev });
  }

  if (dupCount > 0) console.log(`  Skipped ${dupCount} duplicate-key operations`);
  console.log(`Total operations: ${ops.length}`);

  if (ops.length === 0) {
    console.log("No operations to apply. Done.");
    return;
  }

  const txId = "design-tx-001";
  const plan = preparePromotion(txId, null, ops, {});
  const applyResult = applyPromotionTransaction(plan, CANONICAL_ROOT, STAGING_ROOT);

  console.log("Transaction status:", applyResult.status);
  if (applyResult.status !== "COMMITTED") {
    console.error("Transaction failed:", JSON.stringify(applyResult.plan.diagnostics, null, 2));
    process.exit(1);
  }

  console.log(`Promoted ${concepts.length} design concepts and ${relations.length} relations to canonical.`);
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
