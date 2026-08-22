import {
  createSourceBinding,
  createRecordId,
  preparePromotion,
  applyPromotionTransaction,
  parseJsonl,
  type TransactionOperation,
} from "../packages/knowledge-core/src/index.ts";
import {
  EvidenceFactory,
  ReadonlySourceReader,
} from "../packages/extractor-sdk/src/index.ts";
import { readCanonicalState } from "../packages/materializer/src/index.ts";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const WORKSPACE = "/home/syrokomskyi/projects/roguelike-games-ib";
const CANONICAL_ROOT = join(WORKSPACE, "knowledge");
const STAGING_ROOT = join(WORKSPACE, "staging");

const CATBN_SOURCE_ROOT = "/home/syrokomskyi/projects/roguelike-games-ib-source/Cataclysm-BN/data/json";
const NETHACK_SOURCE_ROOT = "/home/syrokomskyi/projects/roguelike-games-ib-source/NetHack/include";

const CATBN_FINGERPRINT = "0747e1f4fd386b076663592f1a2ffafaf625b93c140117ae609e18b30c8e2713";
const CATBN_BINDING_DIGEST = "a8b27380f9ca96a859a50604569e6993c3da98bd1c8507f9a8421f5f5d979cbd";
const NETHACK_FINGERPRINT = "b500ce40aaef968e7dd8d6b4ba423d754ab5cf9a2d142975a7a584fd65fb537b";
const NETHACK_BINDING_DIGEST = "bb2d375f5feea0baa2e24b7848786a6100b7504febb2419ba24b42df701b2b7f";

interface SemanticData {
  records: any[];
  evidence: any[];
  claims: any[];
  relations: any[];
  concepts: any[];
}

function makeEnvelope(recordType: string, key: string, id: string, sourceId: string, runId: string) {
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
    scope: { source_id: sourceId, scope_kind: "source" },
    origin: { kind: "extractor", actor_id: `${sourceId}-factual`, run_id: runId },
    epistemic: { status: "observed", confidence: "verified" },
    aliases: [] as string[],
  };
}

function createCatBnSemanticRecords(
  evidenceFactory: EvidenceFactory,
  factualRecords: readonly any[],
  runId: string,
): SemanticData {
  const records: any[] = [];
  const evidenceList: any[] = [];
  const claims: any[] = [];
  const relations: any[] = [];
  const concepts: any[] = [];
  const sourceId = "cataclysm-bn";

  function ev(artifactPath: string, symbol: string, lineStart: number, lineEnd: number, dataKey: string) {
    const anchor = evidenceFactory.create({
      artifactPath,
      locator: { symbol, line_start: lineStart, line_end: lineEnd, byte_start: null, byte_end: null, data_key: dataKey },
      fragmentLines: { lineStart, lineEnd },
    });
    const evId = createRecordId();
    const evRecord = {
      ...makeEnvelope("evidence", `${sourceId}/evidence/${evId.split(":").pop()}`, evId, sourceId, runId),
      record_id: null,
      anchor,
    };
    evidenceList.push(evRecord);
    return evId;
  }

  function findRecord(key: string): string {
    return factualRecords.find((r) => r.key === key)?.id ?? "";
  }

  // === Semantic Record 1: Mutation system ===
  const sr1Id = createRecordId();
  const sr1Ev = ev("mutations/mutation_appearance.json", "mutation", 1, 50, "mutations");
  records.push({
    ...makeEnvelope("semantic_record", `${sourceId}/semantic/mutation-system`, sr1Id, sourceId, runId),
    semantic_type: "system",
    title: "Mutation System",
    summary: "Cataclysm-BN implements a mutation system with 625+ mutations categorized by type (animal, plant, insect, fish, slime, human, TROUBLE, medical, rat, lizard, bird, spider, crustacean, cephalopod, elf, dwarf, troglobite, medical, plant, fungal, slime, bird, spider, crustacean, cephalopod, elf, dwarf, troglobite). Mutations grant passive abilities, body modifications, and can lead to further mutations via leads_to chains.",
    claim_refs: [],
    evidence_refs: [sr1Ev],
    participant_refs: [],
    body: "Mutations in Cataclysm-BN are defined in data/json/mutations/*.json. Each mutation has an id, name, type (category), points (character points cost), visibility (how noticeable), and leads_to (chain progression). Categories include animal types (BEAST, BIRD, INSECT, FISH, SLIME, SPIDER, LIZARD, RAT, etc.), medical mutations, and TROUBLE mutations. Mutations can be positive (buffs) or negative (debilitating). The mutation system creates emergent character builds through category-based progression.",
  });

  // === Semantic Record 2: Monster faction and aggression system ===
  const sr2Id = createRecordId();
  const sr2Ev = ev("monsters/mammal.json", "MONSTER", 1, 30, "monsters");
  records.push({
    ...makeEnvelope("semantic_record", `${sourceId}/semantic/monster-faction-system`, sr2Id, sourceId, runId),
    semantic_type: "system",
    title: "Monster Faction and Aggression System",
    summary: "Cataclysm-BN monsters have faction membership (default_faction), aggression levels, morale, and species classification. Monsters of the same faction are allied; different factions may be hostile. Aggression determines attack behavior; morale determines flee thresholds.",
    claim_refs: [],
    evidence_refs: [sr2Ev],
    participant_refs: [],
    body: "Each monster in data/json/monsters/*.json has a default_faction (e.g., 'zombie', 'animal', 'nether', 'mutant', 'triffid', 'fungus'), aggression (0-100), morale (0-100), and species (e.g., 'MAMMAL', 'ZOMBIE', 'INSECT', 'PLANT', 'FUNGUS', 'NETHER', 'ABERRATION', 'FISH', 'BIRD', 'REPTILE'). The faction system creates emergent infighting between hostile factions. Aggression controls whether monsters attack on sight; morale controls whether they flee when wounded.",
  });

  // === Semantic Record 3: Crafting and item material system ===
  const sr3Id = createRecordId();
  const sr3Ev = ev("items/ammo.json", "ITEM", 1, 30, "items");
  records.push({
    ...makeEnvelope("semantic_record", `${sourceId}/semantic/crafting-material-system`, sr3Id, sourceId, runId),
    semantic_type: "system",
    title: "Crafting and Item Material System",
    summary: "Cataclysm-BN items have material composition (iron, steel, copper, wood, plastic, leather, etc.), volume, weight, and flags that determine crafting compatibility. The crafting system uses these properties to gate recipes and determine tool durability.",
    claim_refs: [],
    evidence_refs: [sr3Ev],
    participant_refs: [],
    body: "Items in data/json/items/**/*.json have material (array of material types), volume (ml), weight (g), and flags (e.g., 'FIRESTARTER', 'WATERPROOF', 'CONDUCTIVE', 'FRAGILE'). Materials determine interaction with fire, electricity, and crafting recipes. The 5886+ items span weapons, armor, tools, food, books, drugs, and vehicle parts. Item flags like 'UNREPAIRABLE' and 'NO_SALVAGE' constrain crafting interactions.",
  });

  // === Semantic Record 4: Profession and skill system ===
  const sr4Id = createRecordId();
  const sr4Ev = ev("professions.json", "profession", 1, 30, "professions");
  records.push({
    ...makeEnvelope("semantic_record", `${sourceId}/semantic/profession-system`, sr4Id, sourceId, runId),
    semantic_type: "mechanic",
    title: "Profession and Starting Condition System",
    summary: "Cataclysm-BN professions (339+) define starting items, skills, traits, and scenario conditions. Each profession creates a distinct early-game play style through item grants and skill bonuses.",
    claim_refs: [],
    evidence_refs: [sr4Ev],
    participant_refs: [],
    body: "Professions in data/json/professions.json define starting conditions with items (weapons, armor, tools, food), skills (melee, guns, crafting, survival, medical), and traits. Professions range from combat-focused (Martial Artist, Soldier, Police Officer) to survival-focused (Survivor, Woodsman, Farmer) to technical (Mechanic, Electrician, Chemist) to medical (Doctor, Paramedic). Each profession creates a unique early-game experience.",
  });

  // === Semantic Record 5: Monster species and weakness system ===
  const sr5Id = createRecordId();
  const sr5Ev = ev("monsters/insect_spider.json", "MONSTER", 1, 30, "species");
  records.push({
    ...makeEnvelope("semantic_record", `${sourceId}/semantic/monster-species-weakness-system`, sr5Id, sourceId, runId),
    semantic_type: "mechanic",
    title: "Monster Species and Weakness System",
    summary: "Cataclysm-BN monsters are classified by species (MAMMAL, ZOMBIE, INSECT, PLANT, FUNGUS, NETHER, ABERRATION, FISH, BIRD, REPTILE, MOLLUSK, AMPHIBIAN, WEB_SPIDER). Species determines damage vulnerabilities (e.g., insecticide vs insects, fire vs plants/fungus, cold vs nether) and behavioral patterns.",
    claim_refs: [],
    evidence_refs: [sr5Ev],
    participant_refs: [],
    body: "The species field in monster definitions controls damage type vulnerabilities. Insects take bonus damage from insecticide weapons. Plants and fungi are vulnerable to fire. Nether creatures resist cold. Zombies are immune to pain and bleeding. The species system creates tactical depth where players must match weapon types to enemy species.",
  });

  // === Semantic Record 6: Item volume and weight encumbrance system ===
  const sr6Id = createRecordId();
  const sr6Ev = ev("items/battery.json", "ITEM", 1, 30, "encumbrance");
  records.push({
    ...makeEnvelope("semantic_record", `${sourceId}/semantic/encumbrance-system`, sr6Id, sourceId, runId),
    semantic_type: "invariant",
    title: "Volume and Weight Encumbrance Invariant",
    summary: "Cataclysm-BN enforces encumbrance through item volume (ml) and weight (g). Storage containers have limited volume capacity; character strength determines carry weight. This creates a permanent inventory management tension between utility and mobility.",
    claim_refs: [],
    evidence_refs: [sr6Ev],
    participant_refs: [],
    body: "Every item has volume (in ml) and weight (in grams). Containers (backpacks, pockets, vehicles) have max volume. Character strength stat determines max carry weight. Exceeding weight limits reduces movement speed and causes stamina drain. This invariant creates the core survival tension: players cannot carry everything they find, forcing prioritization and strategic decisions about what to craft, wear, or abandon.",
  });

  // === Claims ===
  const zombieRecord = factualRecords.find((r) => r.key === `${sourceId}/creature/zombie`);
  if (zombieRecord) {
    const claim1Id = createRecordId();
    const claim1Ev = ev("monsters/feral_humans.json", "MONSTER", 1, 30, "mon_zombie");
    claims.push({
      ...makeEnvelope("claim", `${sourceId}/claim/zombie-species`, claim1Id, sourceId, runId),
      subject_id: zombieRecord.id,
      predicate: "has_species",
      assertion_state: "asserted",
      value: "ZOMBIE",
      evidence_refs: [claim1Ev],
    });
  }

  const mutRecord = factualRecords.find((r) => r.key?.startsWith(`${sourceId}/mutation/`) && r.attributes?.category === "ANIMAL");
  if (mutRecord) {
    const claim2Id = createRecordId();
    const claim2Ev = ev("mutations/mutation_appearance.json", "mutation", 1, 50, mutRecord.source_identity?.native_id ?? "mutation");
    claims.push({
      ...makeEnvelope("claim", `${sourceId}/claim/mutation-category`, claim2Id, sourceId, runId),
      subject_id: mutRecord.id,
      predicate: "has_mutation_category",
      assertion_state: "asserted",
      value: "ANIMAL",
      evidence_refs: [claim2Ev],
    });
  }

  // === Relations ===
  const profRecord = factualRecords.find((r) => r.key?.startsWith(`${sourceId}/profession/`));
  if (profRecord && sr4Id) {
    const rel1Id = createRecordId();
    const rel1Ev = ev("professions.json", "profession", 1, 30, profRecord.source_identity?.native_id ?? "profession");
    relations.push({
      ...makeEnvelope("relation", `${sourceId}/relation/profession-defines-starting-conditions`, rel1Id, sourceId, runId),
      relation_type: "PART_OF",
      source_record_id: profRecord.id,
      target_record_id: sr4Id,
      relation_scope: "source",
      evidence_refs: [rel1Ev],
      qualifiers: { role: "instance_of_system" },
    });
  }

  // === Concepts ===
  const concept1Id = createRecordId();
  const concept1Ev = ev("mutations/mutation_category.json", "mutation", 1, 50, "mutation-concept");
  concepts.push({
    ...makeEnvelope("concept", `${sourceId}/concept/mutation-progression-tree`, concept1Id, sourceId, runId),
    concept_type: "design_primitive",
    title: "Mutation Progression Tree",
    definition: "A character progression system where mutations unlock via category-based chains (leads_to), creating branching specialization paths. Each mutation can lead to more extreme mutations in the same category, creating emergent character builds.",
    inclusion_criteria: [
      "Mutations have a leads_to field creating chain progression",
      "Mutations are categorized by type (animal, plant, medical, etc.)",
      "Progression is one-directional (mutations don't revert)",
      "Category membership gates which mutations are available next",
    ],
    exclusion_criteria: [
      "Skill-based progression without body modification",
      "Class-based systems with fixed progression paths",
      "Temporary buffs that expire",
    ],
    implementation_refs: [sr1Id],
    decision_refs: [],
    evidence_refs: [concept1Ev],
    ancestry: {
      source_games: [sourceId],
      observed_in: ["mutations/mutations.json leads_to chains", "mutation category system"],
      derived_from: [sr1Id],
      mutation_dimensions: ["chain_depth", "category_count", "reversibility", "point_cost"],
    },
  });

  const concept2Id = createRecordId();
  const concept2Ev = ev("monsters/fungus.json", "MONSTER", 1, 30, "faction-concept");
  concepts.push({
    ...makeEnvelope("concept", `${sourceId}/concept/faction-based-emergent-infighting`, concept2Id, sourceId, runId),
    concept_type: "cross_game_mechanic",
    title: "Faction-Based Emergent Infighting",
    definition: "A monster AI system where creatures belong to factions, and faction relationships determine hostile/neutral behavior. This creates emergent infighting where different enemy types attack each other, giving players tactical opportunities.",
    inclusion_criteria: [
      "Monsters have a faction identifier",
      "Faction relationships determine hostility",
      "Monsters can attack each other based on faction",
      "Players can exploit infighting tactically",
    ],
    exclusion_criteria: [
      "All monsters are uniformly hostile to player only",
      "Faction is purely cosmetic/lore without gameplay effect",
      "Infighting is scripted rather than emergent",
    ],
    implementation_refs: [sr2Id, sr5Id],
    decision_refs: [],
    evidence_refs: [concept2Ev],
    ancestry: {
      source_games: [sourceId],
      observed_in: ["monster default_faction field", "species-based vulnerability system"],
      derived_from: [sr2Id, sr5Id],
      mutation_dimensions: ["faction_count", "relationship_complexity", "neutral_factions", "player_reputation"],
    },
  });

  return { records, evidence: evidenceList, claims, relations, concepts };
}

function createNethackSemanticRecords(
  evidenceFactory: EvidenceFactory,
  factualRecords: readonly any[],
  runId: string,
): SemanticData {
  const records: any[] = [];
  const evidenceList: any[] = [];
  const claims: any[] = [];
  const relations: any[] = [];
  const concepts: any[] = [];
  const sourceId = "nethack";

  function ev(artifactPath: string, symbol: string, lineStart: number, lineEnd: number, dataKey: string) {
    const anchor = evidenceFactory.create({
      artifactPath,
      locator: { symbol, line_start: lineStart, line_end: lineEnd, byte_start: null, byte_end: null, data_key: dataKey },
      fragmentLines: { lineStart, lineEnd },
    });
    const evId = createRecordId();
    const evRecord = {
      ...makeEnvelope("evidence", `${sourceId}/evidence/${evId.split(":").pop()}`, evId, sourceId, runId),
      record_id: null,
      anchor,
    };
    evidenceList.push(evRecord);
    return evId;
  }

  function findRecord(key: string): string {
    return factualRecords.find((r) => r.key === key)?.id ?? "";
  }

  // === Semantic Record 1: Monster difficulty and progression system ===
  const sr1Id = createRecordId();
  const sr1Ev = ev("monsters.h", "MON", 1, 50, "monsters");
  records.push({
    ...makeEnvelope("semantic_record", `${sourceId}/semantic/monster-difficulty-system`, sr1Id, sourceId, runId),
    semantic_type: "system",
    title: "Monster Difficulty and Progression System",
    summary: "NetHack monsters have a difficulty level (1-50+) that scales with stats (HP, armor class, attack damage). Higher difficulty monsters appear deeper in the dungeon. The difficulty value also determines genocide point cost and generation probability.",
    claim_refs: [],
    evidence_refs: [sr1Ev],
    participant_refs: [],
    body: "Each MON() entry in monsters.h defines a monster with difficulty (1-50+), level (base HD for HP calculation), armor class (lower = better), move speed, alignment, and attack patterns. Difficulty controls dungeon depth appearance, generation weight, and genocide point cost. The 379 monsters span from trivial (grid bug, difficulty 1) to endgame threats (Demogorgon, difficulty 50+).",
  });

  // === Semantic Record 2: Item identification mechanic ===
  const sr2Id = createRecordId();
  const sr2Ev = ev("objects.h", "OBJECT", 1, 50, "objects");
  records.push({
    ...makeEnvelope("semantic_record", `${sourceId}/semantic/item-identification-mechanic`, sr2Id, sourceId, runId),
    semantic_type: "mechanic",
    title: "Scroll and Potion Identification Mechanic",
    summary: "NetHack items (potions, scrolls, rings, wands, spellbooks) are generated with randomized appearances. Players must identify items through use, scrolls of identify, or price identification. Wrong identification can be lethal (drinking poisoned potions, reading cursed scrolls).",
    claim_refs: [],
    evidence_refs: [sr2Ev],
    participant_refs: [],
    body: "The objects.h file defines item classes (WEAPON, ARMOR, RING, POTION, SCROLL, SPELL, WAND, FOOD, AMULET, TOOL, GEM) with probability, weight, cost, material, and color. Potions, scrolls, rings, and spellbooks have randomized descriptions each game. The identification mechanic creates strategic tension: using unknown items risks harmful effects, but identifying them costs resources (scrolls of identify, altars, price-checking).",
  });

  // === Semantic Record 3: Monster resistance and conveyance system ===
  const sr3Id = createRecordId();
  const sr3Ev = ev("monsters.h", "MON", 1, 50, "resistances");
  records.push({
    ...makeEnvelope("semantic_record", `${sourceId}/semantic/resistance-conveyance-system`, sr3Id, sourceId, runId),
    semantic_type: "system",
    title: "Monster Resistance and Conveyance System",
    summary: "NetHack monsters have resistance flags (fire, cold, sleep, disintegration, poison, acid, stone) and conveyance flags (what the player gains by eating the monster's corpse). This creates a tactical eating system where consuming corpses grants resistances.",
    claim_refs: [],
    evidence_refs: [sr3Ev],
    participant_refs: [],
    body: "Each monster in monsters.h has resistance flags (MR_FIRE, MR_COLD, MR_SLEEP, MR_DISINT, MR_POISON, MR_ACID, MR_STONE) and conveyance flags (what eating the corpse grants). For example, eating a red dragon corpse conveys fire resistance. This creates a strategic eating system where players hunt specific monsters to gain resistances needed for deeper dungeon levels.",
  });

  // === Semantic Record 4: Alignment and sacrifice system ===
  const sr4Id = createRecordId();
  const sr4Ev = ev("monsters.h", "MON", 1, 50, "alignment");
  records.push({
    ...makeEnvelope("semantic_record", `${sourceId}/semantic/alignment-sacrifice-system`, sr4Id, sourceId, runId),
    semantic_type: "mechanic",
    title: "Alignment and Sacrifice System",
    summary: "NetHack monsters have alignment (chaotic, neutral, lawful). Killing monsters of opposing alignment shifts player alignment. Corpses can be sacrificed on altars to gain favor with the player's god. Alignment affects which artifacts can be used and divine intervention.",
    claim_refs: [],
    evidence_refs: [sr4Ev],
    participant_refs: [],
    body: "Each monster has an alignment value (chaotic=-1, neutral=0, lawful=1). Killing monsters of opposite alignment shifts player alignment toward the killer's alignment. Sacrificing corpses on altars grants piety with the corresponding god. Chaotic gods accept chaotic sacrifices; lawful gods accept lawful ones. The alignment system creates three distinct playthrough styles with different artifact access and divine support.",
  });

  // === Semantic Record 5: Artifact and named item system ===
  const sr5Id = createRecordId();
  const sr5Ev = ev("objects.h", "ARTIFACT", 1, 30, "artifacts");
  records.push({
    ...makeEnvelope("semantic_record", `${sourceId}/semantic/artifact-system`, sr5Id, sourceId, runId),
    semantic_type: "system",
    title: "Artifact and Named Item System",
    summary: "NetHack artifacts are unique named items with special properties (Sting, Orcrist, Excalibur, Mjollnir, etc.). Artifacts have alignment restrictions, special attack effects, and can only be generated once per game. Some artifacts are gifted by gods; others must be found or created.",
    claim_refs: [],
    evidence_refs: [sr5Ev],
    participant_refs: [],
    body: "Artifacts in NetHack are defined with unique names, alignment restrictions, and special effects. Excalibur is obtained by dipping a long sword into a fountain (lawful only). Mjollnir is a lightning hammer (neutral, thrown by Valkyries). Sting and Orcrist glow near orcs. The artifact system creates unique late-game goals and alignment-specific rewards.",
  });

  // === Semantic Record 6: Genocide system ===
  const sr6Id = createRecordId();
  const sr6Ev = ev("monsters.h", "MON", 1, 50, "geno_flags");
  records.push({
    ...makeEnvelope("semantic_record", `${sourceId}/semantic/genocide-system`, sr6Id, sourceId, runId),
    semantic_type: "mechanic",
    title: "Genocide and Extinction Mechanic",
    summary: "NetHack allows players to genocide monster species via scrolls of genocide, permanently removing them from generation. Monsters have geno_flags (G_GENO, G_NOGEN, G_UNIQ) controlling eligibility. Genociding unique monsters is dangerous. This creates a strategic resource management tension.",
    claim_refs: [],
    evidence_refs: [sr6Ev],
    participant_refs: [],
    body: "Each monster has geno_flags: G_GENO (can be genocided), G_NOGEN (never generated normally), G_UNIQ (unique, only one exists). Scrolls of genocide allow eliminating an entire monster class (e.g., all 'r' for rodents) or individual species. Genociding too many species can prevent food sources. Genociding unique monsters (Demogorgon, Asmodeus) removes endgame threats but costs significant resources.",
  });

  // === Claims ===
  const gridBugRecord = factualRecords.find((r) => r.key === `${sourceId}/creature/grid_bug`);
  if (gridBugRecord) {
    const claim1Id = createRecordId();
    const claim1Ev = ev("monsters.h", "MON", 1, 5, "grid_bug");
    claims.push({
      ...makeEnvelope("claim", `${sourceId}/claim/grid-bug-difficulty`, claim1Id, sourceId, runId),
      subject_id: gridBugRecord.id,
      predicate: "has_difficulty",
      assertion_state: "asserted",
      value: 1,
      evidence_refs: [claim1Ev],
    });
  }

  const dragonRecord = factualRecords.find((r) => r.key === `${sourceId}/creature/red_dragon` || r.key === `${sourceId}/creature/young_red_dragon`);
  if (dragonRecord) {
    const claim2Id = createRecordId();
    const claim2Ev = ev("monsters.h", "MON", 1, 50, dragonRecord.source_identity?.native_id ?? "dragon");
    claims.push({
      ...makeEnvelope("claim", `${sourceId}/claim/dragon-fire-resistance`, claim2Id, sourceId, runId),
      subject_id: dragonRecord.id,
      predicate: "has_resistance",
      assertion_state: "asserted",
      value: "MR_FIRE",
      evidence_refs: [claim2Ev],
    });
  }

  // === Relations ===
  const artifactRecord = factualRecords.find((r) => r.key?.startsWith(`${sourceId}/item/`) && r.attributes?.description?.includes("artifact"));
  if (artifactRecord && sr5Id) {
    const rel1Id = createRecordId();
    const rel1Ev = ev("objects.h", "OBJECT", 1, 30, artifactRecord.source_identity?.native_id ?? "artifact");
    relations.push({
      ...makeEnvelope("relation", `${sourceId}/relation/artifact-is-unique`, rel1Id, sourceId, runId),
      relation_type: "PART_OF",
      source_record_id: artifactRecord.id,
      target_record_id: sr5Id,
      relation_scope: "source",
      evidence_refs: [rel1Ev],
      qualifiers: { role: "instance_of_system" },
    });
  }

  // === Concepts ===
  const concept1Id = createRecordId();
  const concept1Ev = ev("monsters.h", "MON", 1, 50, "resistance-concept");
  concepts.push({
    ...makeEnvelope("concept", `${sourceId}/concept/corpse-conveyed-resistance`, concept1Id, sourceId, runId),
    concept_type: "design_primitive",
    title: "Corpse-Conveyed Resistance",
    definition: "A progression system where eating monster corpses grants the player permanent resistances that the monster possessed. This creates a strategic hunting system where players seek specific monsters to build resistance portfolios for deeper dungeon levels.",
    inclusion_criteria: [
      "Monsters have resistance flags",
      "Eating corpses can convey those resistances to the player",
      "Resistances are permanent once conveyed",
      "Different monsters convey different resistances",
    ],
    exclusion_criteria: [
      "Temporary buff systems that expire",
      "Resistance gained through items rather than consumption",
      "Skill-based resistance progression",
    ],
    implementation_refs: [sr3Id],
    decision_refs: [],
    evidence_refs: [concept1Ev],
    ancestry: {
      source_games: [sourceId],
      observed_in: ["monsters.h resistance flags", "monsters.h conveys flags"],
      derived_from: [sr3Id],
      mutation_dimensions: ["resistance_count", "corpse_rot_timer", "conveyance_probability", "stacking_rules"],
    },
  });

  const concept2Id = createRecordId();
  const concept2Ev = ev("objects.h", "OBJECT", 1, 50, "identification-concept");
  concepts.push({
    ...makeEnvelope("concept", `${sourceId}/concept/risk-reward-identification`, concept2Id, sourceId, runId),
    concept_type: "cross_game_mechanic",
    title: "Risk-Reward Item Identification",
    definition: "An item system where consumables (potions, scrolls) have randomized appearances each game. Players must identify items through risky trial-and-error or resource expenditure. Using an unknown item can be beneficial or lethal, creating strategic tension.",
    inclusion_criteria: [
      "Item appearances are randomized per game",
      "Items must be identified through use or resources",
      "Using unknown items carries risk (harmful effects)",
      "Identification resources are scarce",
    ],
    exclusion_criteria: [
      "Items with fixed, known properties",
      "Identification is free or trivial",
      "All unknown items are beneficial",
    ],
    implementation_refs: [sr2Id],
    decision_refs: [],
    evidence_refs: [concept2Ev],
    ancestry: {
      source_games: [sourceId],
      observed_in: ["objects.h item classes", "potion/scroll randomization"],
      derived_from: [sr2Id],
      mutation_dimensions: ["randomization_scope", "risk_severity", "identification_cost", "item_count"],
    },
  });

  return { records, evidence: evidenceList, claims, relations, concepts };
}

async function main() {
  console.log("Reading canonical state...");
  const state = readCanonicalState(CANONICAL_ROOT);

  const catbnRecords = state.records.filter((r) => {
    const si = (r as any).source_identity;
    return si?.source_id === "cataclysm-bn";
  });
  const nethackRecords = state.records.filter((r) => {
    const si = (r as any).source_identity;
    return si?.source_id === "nethack";
  });

  console.log(`Found ${catbnRecords.length} Cataclysm-BN factual records`);
  console.log(`Found ${nethackRecords.length} NetHack factual records`);

  const catbnEvidence = new EvidenceFactory("cataclysm-bn", CATBN_BINDING_DIGEST, new ReadonlySourceReader(CATBN_SOURCE_ROOT));
  const nethackEvidence = new EvidenceFactory("nethack", NETHACK_BINDING_DIGEST, new ReadonlySourceReader(NETHACK_SOURCE_ROOT));

  const catbnRunId = "cataclysm-bn-semantic-run";
  const nethackRunId = "nethack-semantic-run";

  console.log("Creating Cataclysm-BN semantic records...");
  const catbnSemantic = createCatBnSemanticRecords(catbnEvidence, catbnRecords, catbnRunId);
  console.log(`  ${catbnSemantic.records.length} semantic records, ${catbnSemantic.claims.length} claims, ${catbnSemantic.relations.length} relations, ${catbnSemantic.concepts.length} concepts, ${catbnSemantic.evidence.length} evidence`);

  console.log("Creating NetHack semantic records...");
  const nethackSemantic = createNethackSemanticRecords(nethackEvidence, nethackRecords, nethackRunId);
  console.log(`  ${nethackSemantic.records.length} semantic records, ${nethackSemantic.claims.length} claims, ${nethackSemantic.relations.length} relations, ${nethackSemantic.concepts.length} concepts, ${nethackSemantic.evidence.length} evidence`);

  const ops: TransactionOperation[] = [];

  for (const source of [catbnSemantic, nethackSemantic]) {
    for (const record of source.records) {
      ops.push({ type: "create", record_id: record.id, record_type: record.record_type, key: record.key, data: record });
    }
    for (const ev of source.evidence) {
      ops.push({ type: "create", record_id: ev.id, record_type: "evidence", key: ev.key, data: ev });
    }
    for (const claim of source.claims) {
      ops.push({ type: "create", record_id: claim.id, record_type: "claim", key: claim.key, data: claim });
    }
    for (const rel of source.relations) {
      ops.push({ type: "create", record_id: rel.id, record_type: "relation", key: rel.key, data: rel });
    }
    for (const concept of source.concepts) {
      ops.push({ type: "create", record_id: concept.id, record_type: "concept", key: concept.key, data: concept });
    }
  }

  console.log(`Total operations: ${ops.length}`);

  const txId = "semantic-layer-tx";
  const plan = preparePromotion(txId, "cataclysm-bn", ops, {});
  const applyResult = applyPromotionTransaction(plan, CANONICAL_ROOT, STAGING_ROOT);

  console.log("Transaction status:", applyResult.status);
  if (applyResult.status !== "COMMITTED") {
    console.error("Transaction failed:", JSON.stringify(applyResult.plan.diagnostics, null, 2));
    process.exit(1);
  }

  console.log(`Promoted ${ops.length} semantic records to canonical.`);
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
