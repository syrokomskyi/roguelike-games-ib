import { createBrogueCEExtractor } from "../packages/extractors/broguece-extractor/src/index.ts";
import {
  ReadonlySourceReader,
  EvidenceFactory,
  CandidateWriter,
  createNullSchemaFacade,
  createExtractorContext,
  RefreshIdentityResolver,
} from "../packages/extractor-sdk/src/index.ts";
import {
  createSourceBinding,
  createRecordId,
  canonicalJsonStringify,
  computeRecordHash,
  preparePromotion,
  applyPromotionTransaction,
  type TransactionOperation,
} from "../packages/knowledge-core/src/index.ts";
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";

const WORKSPACE = "/home/syrokomskyi/projects/roguelike-games-ib";
const SOURCE_ROOT = "/home/syrokomskyi/projects/roguelike-games-ib-source/BrogueCE/source";
const CANONICAL_ROOT = join(WORKSPACE, "knowledge");
const STAGING_ROOT = join(WORKSPACE, "staging");

const FINGERPRINT = "42215a96064d48187a9d05c6470136187b3b987348e263be9d9da0b0cdcc084c";
const BINDING_DIGEST = "5fb1793f11b3fda3bee098aa6af7dda7166111cc06cffcaeeceae4fa7d1fb5b2";
const GLOBALS_C = "src/brogue/Globals.c";
const ROGUE_H = "src/brogue/Rogue.h";

async function main() {
  const binding = createSourceBinding(
    "broguece",
    "BrogueCE",
    "1.15.1",
    "semver",
    "package_json",
    FINGERPRINT,
    { repository: "https://github.com/tmewett/BrogueCE", commit: null, clean: null, default_branch: "master" },
    "source",
  );

  const extractor = createBrogueCEExtractor();
  const runId = "broguece-stage9-run";
  const stagingRunDir = join(STAGING_ROOT, runId);
  mkdirSync(stagingRunDir, { recursive: true });

  const source = new ReadonlySourceReader(SOURCE_ROOT);
  const evidence = new EvidenceFactory("broguece", BINDING_DIGEST, source);
  const ids = new RefreshIdentityResolver([], [], "broguece");
  const schemas = createNullSchemaFacade();
  const output = new CandidateWriter(STAGING_ROOT, runId, "broguece", "broguece-factual", "1.0.0");

  const ctx = createExtractorContext(source, binding, schemas, evidence, ids, output);
  const result = await extractor.run(ctx);
  console.log("Extraction result:", JSON.stringify(result, null, 2));

  const factualRecords = output.getRecords();
  const factualEvidence = output.getEvidence();

  const ops: TransactionOperation[] = [];

  for (const record of factualRecords) {
    ops.push({
      type: "create",
      record_id: record.id,
      record_type: "definition",
      key: record.key,
      data: record,
    });
  }

  for (const ev of factualEvidence) {
    const evRecord = {
      schema: "rgkb/evidence@2",
      id: createRecordId(),
      key: `broguece/evidence/${(ev as any).record_id.split(":").pop()}`,
      record_type: "evidence",
      language: "en",
      scope: { source_id: "broguece", scope_kind: "source" },
      origin: { kind: "extractor", actor_id: "broguece-factual", run_id: runId },
      epistemic: { status: "observed", confidence: "verified" },
      aliases: [],
      record_id: (ev as any).record_id,
      anchor: (ev as any).anchor,
    };
    ops.push({
      type: "create",
      record_id: evRecord.id,
      record_type: "evidence",
      key: evRecord.key,
      data: evRecord,
    });
  }

  const semanticData = createSemanticRecords(BINDING_DIGEST, SOURCE_ROOT, evidence, factualRecords);
  for (const record of semanticData.records) {
    ops.push({
      type: "create",
      record_id: record.id,
      record_type: record.record_type,
      key: record.key,
      data: record,
    });
  }
  for (const ev of semanticData.evidence) {
    ops.push({
      type: "create",
      record_id: ev.id,
      record_type: "evidence",
      key: ev.key,
      data: ev,
    });
  }
  for (const claim of semanticData.claims) {
    ops.push({
      type: "create",
      record_id: claim.id,
      record_type: "claim",
      key: claim.key,
      data: claim,
    });
  }
  for (const rel of semanticData.relations) {
    ops.push({
      type: "create",
      record_id: rel.id,
      record_type: "relation",
      key: rel.key,
      data: rel,
    });
  }
  for (const concept of semanticData.concepts) {
    ops.push({
      type: "create",
      record_id: concept.id,
      record_type: "concept",
      key: concept.key,
      data: concept,
    });
  }

  const txId = "broguece-stage9-tx";
  const plan = preparePromotion(txId, "broguece", ops, {});
  const applyResult = applyPromotionTransaction(plan, CANONICAL_ROOT, STAGING_ROOT);
  console.log("Transaction status:", applyResult.status);
  if (applyResult.status !== "COMMITTED") {
    console.error("Transaction failed:", JSON.stringify(applyResult.plan.diagnostics, null, 2));
    process.exit(1);
  }

  console.log(`Promoted ${ops.length} records to canonical.`);
  console.log("Done.");
}

interface SemanticData {
  records: any[];
  evidence: any[];
  claims: any[];
  relations: any[];
  concepts: any[];
}

function createSemanticRecords(
  bindingDigest: string,
  sourceRoot: string,
  evidenceFactory: EvidenceFactory,
  factualRecords: readonly any[],
): SemanticData {
  const records: any[] = [];
  const evidenceList: any[] = [];
  const claims: any[] = [];
  const relations: any[] = [];
  const concepts: any[] = [];

  function makeEnvelope(recordType: string, key: string, id: string) {
    return {
      schema:
        recordType === "semantic_record"
          ? "rgkb/semantic-record@2"
          : recordType === "claim"
            ? "rgkb/claim@2"
            : recordType === "relation"
              ? "rgkb/relation@2"
              : recordType === "concept"
                ? "rgkb/concept@2"
                : "rgkb/evidence@2",
      id,
      key,
      record_type: recordType,
      language: "en",
      scope: { source_id: "broguece", scope_kind: "source" },
      origin: { kind: "extractor", actor_id: "broguece-factual", run_id: "broguece-stage9-run" },
      epistemic: { status: "observed", confidence: "verified" },
      aliases: [] as string[],
    };
  }

  function ev(artifactPath: string, symbol: string, lineStart: number, lineEnd: number, dataKey: string) {
    const anchor = evidenceFactory.create({
      artifactPath,
      locator: { symbol, line_start: lineStart, line_end: lineEnd, byte_start: null, byte_end: null, data_key: dataKey },
      fragmentLines: { lineStart, lineEnd },
    });
    const evId = createRecordId();
    const evRecord = {
      ...makeEnvelope("evidence", `broguece/evidence/${evId.split(":").pop()}`, evId),
      record_id: null,
      anchor,
    };
    evidenceList.push(evRecord);
    return evId;
  }

  // === Semantic Record 1: Monster progression system ===
  const sr1Id = createRecordId();
  const sr1Ev = ev(GLOBALS_C, "monsterCatalog", 1025, 1165, "monsterCatalog");
  records.push({
    ...makeEnvelope("semantic_record", "broguece/semantic/monster-progression-system", sr1Id),
    semantic_type: "system",
    title: "Monster Progression System",
    summary: "BrogueCE uses a monsterCatalog indexed by monsterTypes enum, defining HP, defense, accuracy, damage, regen, speed, and ability flags for each creature. Monsters are organized by depth tier with increasing stats.",
    claim_refs: [],
    evidence_refs: [sr1Ev],
    participant_refs: [],
    body: "The monsterCatalog array in Globals.c defines creatureType structs for each monster type. Each entry contains maxHP, defense, accuracy, damage range, turnsBetweenRegen, movementSpeed, attackSpeed, bloodType, intrinsicLightType, isLarge, DFChance, DFType, bolts, flags, and abilityFlags. The catalog is indexed by the monsterTypes enum defined in Rogue.h.",
  });

  // === Semantic Record 2: Terrain tile system ===
  const sr2Id = createRecordId();
  const sr2Ev = ev(GLOBALS_C, "tileCatalog", 315, 579, "tileCatalog");
  records.push({
    ...makeEnvelope("semantic_record", "broguece/semantic/terrain-tile-system", sr2Id),
    semantic_type: "system",
    title: "Terrain Tile System",
    summary: "BrogueCE uses a tileCatalog indexed by tileType enum, defining display character, colors, draw priority, flammability, promotion chains, light emission, flags, and mechanical flags for each terrain type.",
    claim_refs: [],
    evidence_refs: [sr2Ev],
    participant_refs: [],
    body: "The tileCatalog array in Globals.c defines floorTileType structs for each tile type. Each entry contains displayChar, foreColor, backColor, drawPriority, chanceToIgnite, fireType, discoverType, promoteType, promoteChance, glowLight, flags, mechFlags, description, and flavorText. Tiles are organized in layers: dungeon features, surface, fire, gas, and special.",
  });

  // === Semantic Record 3: Item identification mechanic ===
  const sr3Id = createRecordId();
  const sr3Ev = ev(ROGUE_H, "itemCategory", 748, 787, "itemCategory");
  records.push({
    ...makeEnvelope("semantic_record", "broguece/semantic/item-identification-mechanic", sr3Id),
    semantic_type: "mechanic",
    title: "Item Identification Mechanic",
    summary: "BrogueCE categorizes items into 13 categories (FOOD, WEAPON, ARMOR, POTION, SCROLL, STAFF, WAND, RING, CHARM, GOLD, AMULET, GEM, KEY) with bitmask flags for intrinsic polarity, detectability, enchantability, and identifiability.",
    claim_refs: [],
    evidence_refs: [sr3Ev],
    participant_refs: [],
    body: "The itemCategory enum in Rogue.h defines item categories as bitmask flags. Composite flags like HAS_INTRINSIC_POLARITY, CAN_BE_DETECTED, CAN_BE_ENCHANTED, PRENAMED_CATEGORY, NEVER_IDENTIFIABLE, and CAN_BE_SWAPPED define behavioral properties of item groups. Potions, scrolls, rings, wands, and staves have intrinsic polarity (can be cursed or blessed).",
  });

  // === Semantic Record 4: Fire spread algorithm ===
  const sr4Id = createRecordId();
  const sr4Ev = ev(GLOBALS_C, "tileCatalog", 491, 499, "fire-tiles");
  records.push({
    ...makeEnvelope("semantic_record", "broguece/semantic/fire-spread-algorithm", sr4Id),
    semantic_type: "algorithm",
    title: "Fire Spread and Terrain Promotion Algorithm",
    summary: "BrogueCE implements fire as a terrain overlay that spreads via chanceToIgnite and promoteChance properties. Burning tiles promote to other tile types (e.g., PLAIN_FIRE promotes to EMBERS) creating dynamic terrain state transitions.",
    claim_refs: [],
    evidence_refs: [sr4Ev],
    participant_refs: [],
    body: "Each tile in tileCatalog has a chanceToIgnite percentage and fireType dungeon feature. When a fire tile is adjacent, the tile may ignite. Burning tiles have a promoteChance per turn to transition to a promoteType tile. This creates emergent gameplay where fire spreads through flammable terrain, bridges burn and collapse, and lava cools into obsidian.",
  });

  // === Semantic Record 5: Stealth and sneak attack mechanic ===
  const sr5Id = createRecordId();
  const sr5Ev = ev(GLOBALS_C, "weaponTable", 1582, 1603, "weaponTable");
  records.push({
    ...makeEnvelope("semantic_record", "broguece/semantic/stealth-sneak-attack-mechanic", sr5Id),
    semantic_type: "mechanic",
    title: "Stealth and Sneak Attack Mechanic",
    summary: "BrogueCE weapons have special attack modifiers: daggers deal quintuple damage on sneak attacks, rapiers perform lunge attacks at triple damage, and whips reach up to 5 spaces. These create a stealth-based combat triangle.",
    claim_refs: [],
    evidence_refs: [sr5Ev],
    participant_refs: [],
    body: "The weaponTable in Globals.c defines weapon properties including damage ranges and strength requirements. The dagger description explicitly states 'Daggers will deal quintuple damage upon a successful sneak attack instead of triple damage.' The rapier performs a 'devastating lunge attack, which deals triple damage and never misses' when there is one space between the player and enemy. The whip 'will reach opponents up to five spaces away.'",
  });

  // === Semantic Record 6: Gas propagation system ===
  const sr6Id = createRecordId();
  const sr6Ev = ev(GLOBALS_C, "tileCatalog", 501, 510, "gas-tiles");
  records.push({
    ...makeEnvelope("semantic_record", "broguece/semantic/gas-propagation-system", sr6Id),
    semantic_type: "system",
    title: "Gas Propagation System",
    summary: "BrogueCE models 8 gas types (poison, confusion, rot, stench, paralysis, methane, steam, darkness, healing) as terrain overlays with TM_GAS_DISSIPATES flags. Gases spread through connected open tiles and dissipate over time.",
    claim_refs: [],
    evidence_refs: [sr6Ev],
    participant_refs: [],
    body: "Gas tiles in tileCatalog use mechFlags TM_GAS_DISSIPATES or TM_GAS_DISSIPATES_QUICKLY to control dissipation rate. The T_OBSTRUCTS_GAS flag on walls and doors blocks gas permeation. Poison gas causes damage, confusion gas confuses, paralysis gas paralyzes, methane gas is explosive, steam causes damage, and healing clouds heal. Gas traps (poison, paralysis) are hidden until triggered.",
  });

  // === Semantic Record 7: Monster ability flag system ===
  const sr7Id = createRecordId();
  const sr7Ev = ev(GLOBALS_C, "monsterBehaviorCatalog", 1667, 1690, "monsterBehaviorCatalog");
  records.push({
    ...makeEnvelope("semantic_record", "broguece/semantic/monster-ability-flag-system", sr7Id),
    semantic_type: "system",
    title: "Monster Ability and Behavior Flag System",
    summary: "BrogueCE monsters have two flag sets: flags (MONST_*) for intrinsic properties like fire immunity, flight, invisibility, and abilityFlags (MA_*) for combat behaviors like summoning, transference, and area attacks.",
    claim_refs: [],
    evidence_refs: [sr7Ev],
    participant_refs: [],
    body: "The monsterBehaviorCatalog in Globals.c maps flag bits to human-readable descriptions. MONST_IMMUNE_TO_FIRE, MONST_FLIES, MONST_INVISIBLE, MONST_INANIMATE, MONST_FLEES_NEAR_DEATH, MONST_MAINTAINS_DISTANCE, MONST_FIERY, MONST_INVULNERABLE are examples of intrinsic flags. MA_CAST_SUMMON, MA_TRANSFERENCE, MA_ATTACKS_ALL_ADJACENT, MA_ATTACKS_PENETRATE, MA_CLONE_SELF_ON_DEFEND, MA_REFLECT_100 are examples of ability flags.",
  });

  // === Semantic Record 8: Weapon enchantment system ===
  const sr8Id = createRecordId();
  const sr8Ev = ev(ROGUE_H, "weaponEnchants", 834, 847, "weaponEnchants");
  records.push({
    ...makeEnvelope("semantic_record", "broguece/semantic/weapon-enchantment-system", sr8Id),
    semantic_type: "mechanic",
    title: "Weapon Runic Enchantment System",
    summary: "BrogueCE weapons can have 10 runic enchantments (speed, quietus, paralysis, multiplicity, slowing, confusion, force, slaying, mercy, plenty) that trigger special effects on hit, adding strategic depth to weapon choice.",
    claim_refs: [],
    evidence_refs: [sr8Ev],
    participant_refs: [],
    body: "The weaponEnchants enum in Rogue.h defines 10 runic weapon enchantment types. Each has a unique effect: speed grants extra turns, quietus instantly kills, paralysis freezes the target, multiplicity creates phantom blades, slowing reduces speed, confusion causes random movement, force knocks back, slaying deals bonus vs specific monster types, mercy makes enemies flee, and plenty creates food on kill.",
  });

  // === Semantic Record 9: Dungeon generation invariant ===
  const sr9Id = createRecordId();
  const sr9Ev = ev(GLOBALS_C, "tileCatalog", 315, 414, "dungeon-features");
  records.push({
    ...makeEnvelope("semantic_record", "broguece/semantic/dungeon-generation-invariant", sr9Id),
    semantic_type: "invariant",
    title: "Dungeon Feature Layering Invariant",
    summary: "BrogueCE terrain uses a layered model where dungeon features (walls, doors, stairs, traps) form the base layer, surface effects (blood, grass, rubble) overlay on top, and gases/fire float above. Draw priority governs visual and replacement ordering.",
    claim_refs: [],
    evidence_refs: [sr9Ev],
    participant_refs: [],
    body: "The tileCatalog entries are organized in layers: dungeon features (lines 315-413), surface layer (lines 440-489), fire tiles (lines 491-499), gas layer (lines 501-510), bloodwort pods (lines 512-514), shrine accoutrements (516-517), algae (519-522), and special terrain. The drawPriority field (lower = higher priority) governs which tile is displayed when multiple occupy the same cell. T_OBSTRUCTS_SURFACE_EFFECTS prevents surface overlays.",
  });

  // === Semantic Record 10: Emergent trap interaction ===
  const sr10Id = createRecordId();
  const sr10Ev = ev(ROGUE_H, "tileType", 439, 498, "trap-tiles");
  records.push({
    ...makeEnvelope("semantic_record", "broguece/semantic/emergent-trap-interaction", sr10Id),
    semantic_type: "emergence",
    title: "Emergent Trap-Terrain Interactions",
    summary: "BrogueCE traps (poison gas, trap door, paralysis gas, fire dart, spear, net, alarm, summon) are hidden tiles that trigger dungeon features when stepped on. Gas traps interact with fire (gas ignites), trap doors interact with chasm (fall damage), creating emergent chain reactions.",
    claim_refs: [],
    evidence_refs: [sr10Ev],
    participant_refs: [],
    body: "The tileType enum includes GAS_TRAP_POISON_HIDDEN, TRAP_DOOR_HIDDEN, GAS_TRAP_PARALYSIS_HIDDEN, and other trap types. When triggered, these tiles promote to their visible counterparts and spawn dungeon features. Gas traps create gas clouds that can be ignited by nearby fire. Trap doors create chasms that cause fall damage. These interactions create emergent gameplay where environmental hazards chain together.",
  });

  // === Semantic Record 11: Staff magic system ===
  const sr11Id = createRecordId();
  const sr11Ev = ev(GLOBALS_C, "staffTable", 1641, 1654, "staffTable");
  records.push({
    ...makeEnvelope("semantic_record", "broguece/semantic/staff-magic-system", sr11Id),
    semantic_type: "system",
    title: "Staff Magic Bolt System",
    summary: "BrogueCE staves fire magical bolts with 11 types (lightning, firebolt, poison, tunneling, blinking, entrancement, obstruction, discord, conjuration, healing, haste, protection). Bolts travel in straight lines and have polarity (positive/negative) affecting self-use.",
    claim_refs: [],
    evidence_refs: [sr11Ev],
    participant_refs: [],
    body: "The staffTable in Globals.c defines 12 staff types with their bolt types. Staves with negative magicPolarity (healing, haste, protection) cannot be used on self except by reflecting the bolt. Staves recharge over time. The lightning bolt hits multiple creatures in a line, firebolt ignites terrain, poison bolt applies damage-over-time, tunneling bolt destroys walls, blinking teleports, entrancement mind-controls, obstruction creates crystal walls, discord causes infighting, conjuration summons phantom blades.",
  });

  // === Semantic Record 12: Ring buff/debuff system ===
  const sr12Id = createRecordId();
  const sr12Ev = ev(GLOBALS_C, "ringTable", 1656, 1665, "ringTable");
  records.push({
    ...makeEnvelope("semantic_record", "broguece/semantic/ring-buff-debuff-system", sr12Id),
    semantic_type: "mechanic",
    title: "Ring Buff/Debuff and Curse System",
    summary: "BrogueCE rings provide passive buffs (clairvoyance, stealth, regeneration, transference, light, awareness, wisdom, reaping) but cursed rings invert their effects. Rings have magic polarity that determines if they are blessed or cursed.",
    claim_refs: [],
    evidence_refs: [sr12Ev],
    participant_refs: [],
    body: "The ringTable defines 8 ring types. Each ring has a magicPolarity of 1 (positive) by default, but when found cursed, the polarity is -1, inverting the effect. Cursed clairvoyance blinds, cursed stealth increases detection range, cursed regeneration halts healing, cursed transference drains health, cursed wisdom slows recharge, cursed reaping drains staffs. Rings must be identified before the player knows if they are cursed.",
  });

  // === Claims ===
  const claim1Id = createRecordId();
  const claim1Ev = ev(GLOBALS_C, "monsterCatalog", 1027, 1029, "MK_RAT");
  claims.push({
    ...makeEnvelope("claim", "broguece/claim/rat-max-hp", claim1Id),
    subject_id: factualRecords.find((r: any) => r.key === "broguece/creature/rat")?.id ?? "",
    predicate: "has_max_hp",
    assertion_state: "asserted",
    value: 6,
    evidence_refs: [claim1Ev],
  });

  const claim2Id = createRecordId();
  const claim2Ev = ev(GLOBALS_C, "tileCatalog", 420, 421, "LAVA");
  claims.push({
    ...makeEnvelope("claim", "broguece/claim/lava-insta-death", claim2Id),
    subject_id: factualRecords.find((r: any) => r.key === "broguece/terrain/lava")?.id ?? "",
    predicate: "has_flag",
    assertion_state: "asserted",
    value: "T_LAVA_INSTA_DEATH",
    evidence_refs: [claim2Ev],
  });

  const claim3Id = createRecordId();
  const claim3Ev = ev(GLOBALS_C, "weaponTable", 1582, 1583, "dagger");
  claims.push({
    ...makeEnvelope("claim", "broguece/claim/dagger-sneak-attack", claim3Id),
    subject_id: factualRecords.find((r: any) => r.key === "broguece/item/weapon/dagger")?.id ?? "",
    predicate: "has_special_ability",
    assertion_state: "asserted",
    value: "quintuple_damage_on_sneak_attack",
    evidence_refs: [claim3Ev],
  });

  // === Relations ===
  const rel1Id = createRecordId();
  const rel1Ev = ev(GLOBALS_C, "monsterCatalog", 1127, 1128, "goblin_warlord");
  relations.push({
    ...makeEnvelope("relation", "broguece/relation/goblin-warlord-summons", rel1Id),
    relation_type: "HAS_ABILITY",
    source_record_id: factualRecords.find((r: any) => r.key === "broguece/creature/goblin_warlord")?.id ?? "",
    target_record_id: sr7Id,
    relation_scope: "source",
    evidence_refs: [rel1Ev],
    qualifiers: { ability: "MA_CAST_SUMMON" },
  });

  const rel2Id = createRecordId();
  const rel2Ev = ev(GLOBALS_C, "tileCatalog", 491, 499, "fire-tiles");
  relations.push({
    ...makeEnvelope("relation", "broguece/relation/fire-spreads-to-flammable", rel2Id),
    relation_type: "INTERACTS_WITH",
    source_record_id: sr4Id,
    target_record_id: sr9Id,
    relation_scope: "source",
    evidence_refs: [rel2Ev],
    qualifiers: { interaction: "fire_ignites_flammable_terrain" },
  });

  // === Concept: Cross-game-ready design primitive ===
  const concept1Id = createRecordId();
  const concept1Ev = ev(GLOBALS_C, "tileCatalog", 315, 579, "tileCatalog-concept");
  concepts.push({
    ...makeEnvelope("concept", "broguece/concept/layered-terrain-promotion", concept1Id),
    concept_type: "design_primitive",
    title: "Layered Terrain Promotion",
    definition: "A terrain system where tiles exist in layers (base, surface, gas, fire) and can promote from one type to another based on probabilistic triggers (promoteChance), creating dynamic environmental states without explicit state machines.",
    inclusion_criteria: [
      "Terrain has a promotion chain (promoteType)",
      "Promotion is probabilistic (promoteChance per turn)",
      "Multiple terrain layers coexist (base, surface, overlay)",
      "Draw priority governs visual and replacement ordering",
    ],
    exclusion_criteria: [
      "Static terrain that never changes",
      "Terrain changes triggered only by explicit player action",
      "Single-layer terrain without overlay system",
    ],
    implementation_refs: [sr4Id, sr9Id],
    decision_refs: [],
    evidence_refs: [concept1Ev],
    ancestry: {
      source_games: ["broguece"],
      observed_in: ["tileCatalog fire spread", "tileCatalog gas dissipation", "tileCatalog bridge collapse"],
      derived_from: [sr4Id, sr9Id],
      mutation_dimensions: ["promotion_probability", "layer_count", "chain_length", "trigger_type"],
    },
  });

  // === Concept: Cross-game mechanic candidate ===
  const concept2Id = createRecordId();
  const concept2Ev = ev(ROGUE_H, "weaponEnchants", 834, 847, "weaponEnchants-concept");
  concepts.push({
    ...makeEnvelope("concept", "broguece/concept/runic-weapon", concept2Id),
    concept_type: "cross_game_mechanic",
    title: "Runic Weapon Enchantments",
    definition: "Weapons can have a secondary enchantment property that triggers special effects on hit, independent of the weapon's base damage. The enchantment is a separate axis from weapon material and damage type.",
    inclusion_criteria: [
      "Weapons have enchantments as a separate property from damage",
      "Enchantments trigger probabilistically on hit",
      "Multiple enchantment types exist (≥5)",
      "Enchantments can be positive or negative",
    ],
    exclusion_criteria: [
      "Enchantments that only modify damage numbers",
      "Weapon materials that are the only differentiator",
      "Skill-based special attacks (not enchantment-based)",
    ],
    implementation_refs: [sr8Id, sr5Id],
    decision_refs: [],
    evidence_refs: [concept2Ev],
    ancestry: {
      source_games: ["broguece"],
      observed_in: ["weaponEnchants enum", "weaponTable descriptions"],
      derived_from: [sr8Id, sr5Id],
      mutation_dimensions: ["trigger_probability", "effect_type", "stacking_rules", "identification_requirement"],
    },
  });

  return { records, evidence: evidenceList, claims, relations, concepts };
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
