import {
  createRecordId,
  preparePromotion,
  applyPromotionTransaction,
  type TransactionOperation,
} from "../packages/knowledge-core/src/index.ts";
import {
  EvidenceFactory,
  ReadonlySourceReader,
} from "../packages/extractor-sdk/src/index.ts";
import { readCanonicalState } from "../packages/materializer/src/index.ts";
import { join } from "node:path";

const WORKSPACE = "/home/syrokomskyi/projects/roguelike-games-ib";
const CANONICAL_ROOT = join(WORKSPACE, "knowledge");
const STAGING_ROOT = join(WORKSPACE, "staging");

const BROGUECE_SOURCE_ROOT = "/home/syrokomskyi/projects/roguelike-games-ib-source/BrogueCE/source";
const BROGUECE_BINDING_DIGEST = "5fb1793f11b3fda3bee098aa6af7dda7166111cc06cffcaeeceae4fa7d1fb5b2";
const NETHACK_SOURCE_ROOT = "/home/syrokomskyi/projects/roguelike-games-ib-source/NetHack/include";
const NETHACK_BINDING_DIGEST = "bb2d375f5feea0baa2e24b7848786a6100b7504febb2419ba24b42df701b2b7f";

const RUN_ID = "design-enrichment-1";
const ACTOR_ID = "design-curator";

function makeEnvelope(
  recordType: string,
  key: string,
  id: string,
  scope: { scope_kind: string; source_id?: string },
  origin: { kind: string; actor_id: string; run_id: string },
  epistemic: { status: string; confidence: string } = { status: "observed", confidence: "verified" },
) {
  const schemaMap: Record<string, string> = {
    semantic_record: "rgkb/semantic-record@2",
    claim: "rgkb/claim@2",
    relation: "rgkb/relation@2",
    concept: "rgkb/concept@2",
    evidence: "rgkb/evidence@2",
  };
  return {
    schema: schemaMap[recordType] ?? "rgkb/evidence@2",
    id,
    key,
    record_type: recordType,
    language: "en",
    scope,
    origin,
    epistemic,
    aliases: [] as string[],
  };
}

async function main() {
  console.log("Reading canonical state...");
  const state = readCanonicalState(CANONICAL_ROOT);

  const recordByKey = new Map(state.records.map((r: any) => [r.key, r]));
  const relationByKey = new Map(state.relations.map((r: any) => [r.key, r]));

  // Existing concept IDs
  const runicWeapon = recordByKey.get("broguece/concept/runic-weapon");
  const corpseResistance = recordByKey.get("nethack/concept/corpse-conveyed-resistance");
  const riskRewardId = recordByKey.get("nethack/concept/risk-reward-identification");
  const mutationTree = recordByKey.get("cataclysm-bn/concept/mutation-progression-tree");
  const factionInfighting = recordByKey.get("cataclysm-bn/concept/faction-based-emergent-infighting");
  const layeredTerrain = recordByKey.get("broguece/concept/layered-terrain-promotion");

  // Existing semantic record IDs
  const fireSpread = recordByKey.get("broguece/semantic/fire-spread-algorithm");
  const gasPropagation = recordByKey.get("broguece/semantic/gas-propagation-system");
  const weaponEnchantment = recordByKey.get("broguece/semantic/weapon-enchantment-system");
  const nethackArtifact = recordByKey.get("nethack/semantic/artifact-system");
  const nethackItemIdent = recordByKey.get("nethack/semantic/item-identification-mechanic");
  const nethackResistConvey = recordByKey.get("nethack/semantic/resistance-conveyance-system");

  console.log("Existing records found:");
  console.log(`  runicWeapon: ${runicWeapon?.id ?? "NOT FOUND"}`);
  console.log(`  corpseResistance: ${corpseResistance?.id ?? "NOT FOUND"}`);
  console.log(`  riskReward: ${riskRewardId?.id ?? "NOT FOUND"}`);
  console.log(`  fireSpread: ${fireSpread?.id ?? "NOT FOUND"}`);
  console.log(`  gasPropagation: ${gasPropagation?.id ?? "NOT FOUND"}`);
  console.log(`  weaponEnchantment: ${weaponEnchantment?.id ?? "NOT FOUND"}`);
  console.log(`  nethackArtifact: ${nethackArtifact?.id ?? "NOT FOUND"}`);

  const brogueceEvidence = new EvidenceFactory("broguece", BROGUECE_BINDING_DIGEST, new ReadonlySourceReader(BROGUECE_SOURCE_ROOT));
  const nethackEvidence = new EvidenceFactory("nethack", NETHACK_BINDING_DIGEST, new ReadonlySourceReader(NETHACK_SOURCE_ROOT));

  const concepts: any[] = [];
  const relations: any[] = [];
  const evidenceList: any[] = [];

  function createEv(
    factory: EvidenceFactory,
    sourceId: string,
    artifactPath: string,
    symbol: string,
    lineStart: number,
    lineEnd: number,
    dataKey: string,
  ): string {
    const anchor = factory.create({
      artifactPath,
      locator: { symbol, line_start: lineStart, line_end: lineEnd, byte_start: null, byte_end: null, data_key: dataKey },
      fragmentLines: { lineStart, lineEnd },
    });
    const evId = createRecordId();
    evidenceList.push({
      ...makeEnvelope("evidence", `${sourceId}/evidence/${evId.split(":").pop()}`, evId,
        { scope_kind: "source", source_id: sourceId },
        { kind: "curator", actor_id: ACTOR_ID, run_id: RUN_ID }),
      record_id: null,
      anchor,
    });
    return evId;
  }

  // ===================================================================
  // NEW DESIGN PRIMITIVE CONCEPTS (from BrogueCE semantic records)
  // ===================================================================

  // 1. Fire Spread Propagation
  const fireSpreadConceptId = createRecordId();
  const fireSpreadEv = createEv(brogueceEvidence, "broguece", "src/brogue/Rogue.h", "tileCatalog", 1, 100, "fire-spread-concept");
  concepts.push({
    ...makeEnvelope("concept", "broguece/concept/fire-spread-propagation", fireSpreadConceptId,
      { scope_kind: "source", source_id: "broguece" },
      { kind: "extractor", actor_id: "broguece-factual", run_id: RUN_ID }),
    concept_type: "design_primitive",
    title: "Fire Spread Propagation",
    definition: "A terrain system where fire spreads probabilistically between adjacent flammable tiles. Each tile has ignition probability and burn state transitions (burning to embers to scorched). Fire creates dynamic area-denial that reshapes tactical terrain during play without explicit state machines.",
    inclusion_criteria: [
      "Tiles have ignition probability (chanceToIgnite)",
      "Fire spreads to adjacent flammable tiles",
      "Burning tiles have state transitions (promote to other tile types)",
      "Fire can destroy terrain features (bridges, vegetation)",
    ],
    exclusion_criteria: [
      "Fire that only damages entities without terrain spread",
      "Static fire hazards that don't spread",
      "Fire triggered only by explicit player action",
    ],
    implementation_refs: fireSpread ? [fireSpread.id] : [],
    decision_refs: [],
    evidence_refs: [fireSpreadEv],
    ancestry: {
      source_games: ["broguece"],
      observed_in: ["tileCatalog fire properties", "promoteChance per turn", "chanceToIgnite field"],
      derived_from: fireSpread ? [fireSpread.id] : [],
      mutation_dimensions: ["spread_probability", "burn_duration", "damage_per_turn", "fuel_consumption"],
    },
  });

  // 2. Gas Dissipation Dynamics
  const gasConceptId = createRecordId();
  const gasEv = createEv(brogueceEvidence, "broguece", "src/brogue/Rogue.h", "tileCatalog", 1, 100, "gas-dissipation-concept");
  concepts.push({
    ...makeEnvelope("concept", "broguece/concept/gas-dissipation-dynamics", gasConceptId,
      { scope_kind: "source", source_id: "broguece" },
      { kind: "extractor", actor_id: "broguece-factual", run_id: RUN_ID }),
    concept_type: "design_primitive",
    title: "Gas Dissipation Dynamics",
    definition: "A terrain overlay system where gases spread through connected open tiles and dissipate over time. Different gas types (poison, confusion, paralysis, methane, steam, healing) create temporary area-denial or benefit zones. Gas dissipation rate creates time-limited tactical windows that players must exploit or escape.",
    inclusion_criteria: [
      "Gas spreads through connected open tiles",
      "Gas dissipates over time (dissipation flags)",
      "Multiple gas types with different effects (>=3)",
      "Terrain features can block gas (walls, doors)",
    ],
    exclusion_criteria: [
      "Permanent area effects that don't dissipate",
      "Gas that only affects the triggering tile",
      "Single gas type without variety",
    ],
    implementation_refs: gasPropagation ? [gasPropagation.id] : [],
    decision_refs: [],
    evidence_refs: [gasEv],
    ancestry: {
      source_games: ["broguece"],
      observed_in: ["TM_GAS_DISSIPATES flags", "T_OBSTRUCTS_GAS blocking", "8 gas types in tileCatalog"],
      derived_from: gasPropagation ? [gasPropagation.id] : [],
      mutation_dimensions: ["dissipation_rate", "spread_speed", "gas_variety", "effect_duration"],
    },
  });

  // ===================================================================
  // NEW CROSS-GAME MECHANIC CONCEPT
  // ===================================================================

  // 3. Enchanted Weapon Properties (cross_game_mechanic)
  const enchantedWeaponId = createRecordId();
  const enchEv = createEv(brogueceEvidence, "broguece", "src/brogue/Rogue.h", "weaponEnchants", 1, 50, "enchanted-weapon-concept");
  concepts.push({
    ...makeEnvelope("concept", "design/concept/enchanted-weapon-properties", enchantedWeaponId,
      { scope_kind: "cross_game" },
      { kind: "curator", actor_id: ACTOR_ID, run_id: RUN_ID }),
    concept_type: "cross_game_mechanic",
    title: "Enchanted Weapon Properties",
    definition: "A weapon system where items can possess secondary enchantment or naming properties beyond base damage. Enchantments trigger special effects (elemental damage, instant kill, speed changes, glow detection) and create strategic weapon selection depth. Both BrogueCE runics and NetHack artifacts realize this pattern.",
    inclusion_criteria: [
      "Weapons have enchantment or naming as a separate property from damage",
      "Enchantments trigger special effects on hit or wield",
      "Multiple enchantment types exist (>=5)",
      "Enchanted or named weapons are rare or unique",
    ],
    exclusion_criteria: [
      "Enchantments that only modify damage numbers",
      "Weapon materials as the only differentiator",
      "Skill-based special attacks (not enchantment-based)",
    ],
    implementation_refs: [
      ...(weaponEnchantment ? [weaponEnchantment.id] : []),
      ...(nethackArtifact ? [nethackArtifact.id] : []),
    ],
    decision_refs: [],
    evidence_refs: [enchEv],
    ancestry: {
      source_games: ["broguece", "nethack"],
      observed_in: ["BrogueCE weaponEnchants enum (10 types)", "NetHack artifact system (Sting, Orcrist, Excalibur, Mjollnir)"],
      derived_from: [
        ...(weaponEnchantment ? [weaponEnchantment.id] : []),
        ...(nethackArtifact ? [nethackArtifact.id] : []),
      ],
      mutation_dimensions: ["enchantment_count", "trigger_probability", "effect_severity", "uniqueness"],
    },
  });

  // ===================================================================
  // DESIGN-SCOPE RELATIONS (concept -> concept, relation_scope: "design")
  // ===================================================================

  // 4. Fire spread pressures corpse-conveyed resistance
  if (fireSpreadConceptId && corpseResistance) {
    relations.push({
      ...makeEnvelope("relation", "design/relation/fire-spread-pressures-corpse-resistance", createRecordId(),
        { scope_kind: "cross_game" },
        { kind: "curator", actor_id: ACTOR_ID, run_id: RUN_ID },
        { status: "inferred", confidence: "reasoned" }),
      relation_type: "pressures",
      source_record_id: fireSpreadConceptId,
      target_record_id: corpseResistance.id,
      relation_scope: "design",
      evidence_refs: [],
      qualifiers: { rationale: "Dynamic fire hazards pressure players to seek permanent fire resistance through corpse consumption, creating a progression incentive from environmental threat." },
    });
  }

  // 5. Gas dissipation pressures risk-reward identification
  if (gasConceptId && riskRewardId) {
    relations.push({
      ...makeEnvelope("relation", "design/relation/gas-dissipation-pressures-identification", createRecordId(),
        { scope_kind: "cross_game" },
        { kind: "curator", actor_id: ACTOR_ID, run_id: RUN_ID },
        { status: "inferred", confidence: "reasoned" }),
      relation_type: "pressures",
      source_record_id: gasConceptId,
      target_record_id: riskRewardId.id,
      relation_scope: "design",
      evidence_refs: [],
      qualifiers: { rationale: "Unpredictable gas clouds create pressure for item identification: knowing which potions grant resistance or cure effects becomes critical survival knowledge when facing gas hazards." },
    });
  }

  // 6. Runic weapon tensions_with risk-reward identification
  if (runicWeapon && riskRewardId) {
    relations.push({
      ...makeEnvelope("relation", "design/relation/runic-tensions-identification", createRecordId(),
        { scope_kind: "cross_game" },
        { kind: "curator", actor_id: ACTOR_ID, run_id: RUN_ID },
        { status: "inferred", confidence: "reasoned" }),
      relation_type: "tensions_with",
      source_record_id: runicWeapon.id,
      target_record_id: riskRewardId.id,
      relation_scope: "design",
      evidence_refs: [],
      qualifiers: { rationale: "Powerful weapon enchantments reduce identification pressure (known powerful weapon) while item identification mechanic increases it (unknown items risky) — creating opposing design forces around weapon knowledge." },
    });
  }

  // 7. Enchanted weapon properties pressures risk-reward identification
  if (enchantedWeaponId && riskRewardId) {
    relations.push({
      ...makeEnvelope("relation", "design/relation/enchanted-weapon-pressures-identification", createRecordId(),
        { scope_kind: "cross_game" },
        { kind: "curator", actor_id: ACTOR_ID, run_id: RUN_ID },
        { status: "inferred", confidence: "reasoned" }),
      relation_type: "pressures",
      source_record_id: enchantedWeaponId,
      target_record_id: riskRewardId.id,
      relation_scope: "design",
      evidence_refs: [],
      qualifiers: { rationale: "The prospect of finding enchanted weapons pressures players to identify weapons rather than discard unknown items, increasing identification tension and creating opportunity cost for skipping identification." },
    });
  }

  // 8. Gas dissipation tensions_with fire spread propagation
  if (gasConceptId && fireSpreadConceptId) {
    relations.push({
      ...makeEnvelope("relation", "design/relation/gas-tensions-fire-spread", createRecordId(),
        { scope_kind: "cross_game" },
        { kind: "curator", actor_id: ACTOR_ID, run_id: RUN_ID },
        { status: "inferred", confidence: "reasoned" }),
      relation_type: "tensions_with",
      source_record_id: gasConceptId,
      target_record_id: fireSpreadConceptId,
      relation_scope: "design",
      evidence_refs: [],
      qualifiers: { rationale: "Gas dissipation creates temporary tactical zones while fire spread creates permanent terrain destruction — one creates fleeting opportunities, the other irreversible consequences, tensioning pacing of environmental hazards." },
    });
  }

  // 9. Layered terrain promotion pressures corpse-conveyed resistance
  if (layeredTerrain && corpseResistance) {
    relations.push({
      ...makeEnvelope("relation", "design/relation/terrain-promotion-pressures-corpse-resistance", createRecordId(),
        { scope_kind: "cross_game" },
        { kind: "curator", actor_id: ACTOR_ID, run_id: RUN_ID },
        { status: "inferred", confidence: "reasoned" }),
      relation_type: "pressures",
      source_record_id: layeredTerrain.id,
      target_record_id: corpseResistance.id,
      relation_scope: "design",
      evidence_refs: [],
      qualifiers: { rationale: "Dynamic terrain hazards pressure players to seek permanent power sources like corpse-conveyed resistances as survival tools." },
    });
  }

  // 10. Layered terrain promotion tensions_with corpse-conveyed resistance
  if (layeredTerrain && corpseResistance) {
    relations.push({
      ...makeEnvelope("relation", "design/relation/terrain-promotion-tensions-corpse-resistance", createRecordId(),
        { scope_kind: "cross_game" },
        { kind: "curator", actor_id: ACTOR_ID, run_id: RUN_ID },
        { status: "inferred", confidence: "reasoned" }),
      relation_type: "tensions_with",
      source_record_id: layeredTerrain.id,
      target_record_id: corpseResistance.id,
      relation_scope: "design",
      evidence_refs: [],
      qualifiers: { rationale: "Permanent progression from corpse consumption tensions with ephemeral terrain dynamics: one creates lasting character power, the other creates momentary tactical opportunities." },
    });
  }

  // ===================================================================
  // CROSS-GAME REALIZES_CONCEPT RELATIONS (semantic_record -> concept)
  // ===================================================================

  // 9. BrogueCE weapon enchantment realizes enchanted weapon properties
  if (weaponEnchantment && enchantedWeaponId) {
    const relEv = createEv(brogueceEvidence, "broguece", "src/brogue/Rogue.h", "weaponEnchants", 1, 50, "runic-realizes");
    relations.push({
      ...makeEnvelope("relation", "broguece/relation/runic-realizes-enchanted-weapon", createRecordId(),
        { scope_kind: "cross_game" },
        { kind: "curator", actor_id: ACTOR_ID, run_id: RUN_ID }),
      relation_type: "REALIZES_CONCEPT",
      source_record_id: weaponEnchantment.id,
      target_record_id: enchantedWeaponId,
      relation_scope: "cross_game",
      evidence_refs: [relEv],
      qualifiers: { role: "implementation_of" },
    });
  }

  // 10. NetHack artifact realizes enchanted weapon properties
  if (nethackArtifact && enchantedWeaponId) {
    const relEv = createEv(nethackEvidence, "nethack", "objects.h", "ARTIFACT", 1, 30, "artifact-realizes");
    relations.push({
      ...makeEnvelope("relation", "nethack/relation/artifact-realizes-enchanted-weapon", createRecordId(),
        { scope_kind: "cross_game" },
        { kind: "curator", actor_id: ACTOR_ID, run_id: RUN_ID }),
      relation_type: "REALIZES_CONCEPT",
      source_record_id: nethackArtifact.id,
      target_record_id: enchantedWeaponId,
      relation_scope: "cross_game",
      evidence_refs: [relEv],
      qualifiers: { role: "implementation_of" },
    });
  }

  // 11. BrogueCE fire spread realizes fire spread propagation concept
  if (fireSpread && fireSpreadConceptId) {
    const relEv = createEv(brogueceEvidence, "broguece", "src/brogue/Rogue.h", "tileCatalog", 1, 100, "fire-realizes");
    relations.push({
      ...makeEnvelope("relation", "broguece/relation/fire-spread-realizes-propagation", createRecordId(),
        { scope_kind: "cross_game" },
        { kind: "curator", actor_id: ACTOR_ID, run_id: RUN_ID }),
      relation_type: "REALIZES_CONCEPT",
      source_record_id: fireSpread.id,
      target_record_id: fireSpreadConceptId,
      relation_scope: "cross_game",
      evidence_refs: [relEv],
      qualifiers: { role: "implementation_of" },
    });
  }

  // 12. BrogueCE gas propagation realizes gas dissipation concept
  if (gasPropagation && gasConceptId) {
    const relEv = createEv(brogueceEvidence, "broguece", "src/brogue/Rogue.h", "tileCatalog", 1, 100, "gas-realizes");
    relations.push({
      ...makeEnvelope("relation", "broguece/relation/gas-propagation-realizes-dissipation", createRecordId(),
        { scope_kind: "cross_game" },
        { kind: "curator", actor_id: ACTOR_ID, run_id: RUN_ID }),
      relation_type: "REALIZES_CONCEPT",
      source_record_id: gasPropagation.id,
      target_record_id: gasConceptId,
      relation_scope: "cross_game",
      evidence_refs: [relEv],
      qualifiers: { role: "implementation_of" },
    });
  }

  // ===================================================================
  // PROMOTE TO CANONICAL
  // ===================================================================

  const ops: TransactionOperation[] = [];

  for (const concept of concepts) {
    ops.push({ type: "create", record_id: concept.id, record_type: "concept", key: concept.key, data: concept });
  }
  for (const rel of relations) {
    ops.push({ type: "create", record_id: rel.id, record_type: "relation", key: rel.key, data: rel });
  }
  for (const ev of evidenceList) {
    ops.push({ type: "create", record_id: ev.id, record_type: "evidence", key: ev.key, data: ev });
  }

  console.log(`\nCreating ${concepts.length} concepts, ${relations.length} relations, ${evidenceList.length} evidence records`);
  console.log(`Total operations: ${ops.length}`);

  console.log("\nConcepts:");
  for (const c of concepts) {
    console.log(`  ${c.key} (${c.concept_type})`);
  }
  console.log("\nRelations:");
  for (const r of relations) {
    console.log(`  ${r.key} (${r.relation_type}, ${r.relation_scope})`);
  }

  const txId = "design-enrichment-tx";
  const plan = preparePromotion(txId, null, ops, {});
  const applyResult = applyPromotionTransaction(plan, CANONICAL_ROOT, STAGING_ROOT);

  console.log("\nTransaction status:", applyResult.status);
  if (applyResult.status !== "COMMITTED") {
    console.error("Transaction failed:", JSON.stringify(applyResult.plan.diagnostics, null, 2));
    process.exit(1);
  }

  console.log(`Promoted ${ops.length} design enrichment records to canonical.`);
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
