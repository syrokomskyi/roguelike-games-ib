import {
  computeCoverage,
  computeDimensionState,
  type CoverageDimension,
  type DenominatorKind,
} from "../packages/knowledge-core/src/index.ts";
import { join } from "node:path";
import { writeFileSync, mkdirSync } from "node:fs";

const WORKSPACE = "/home/syrokomskyi/projects/roguelike-games-ib";
const CANONICAL_ROOT = join(WORKSPACE, "knowledge");

function makeDimension(
  id: string,
  denominatorKind: DenominatorKind,
  expected: number | null,
  extracted: number | null,
  validated: number | null,
  basis: string,
  notes: string | null = null,
): CoverageDimension {
  const state = computeDimensionState(
    denominatorKind,
    expected,
    extracted,
    validated,
    0,
    false,
  );
  return {
    id,
    state,
    basis,
    expected,
    extracted,
    validated,
    unresolved: 0,
    notes,
  };
}

async function main() {
  // === BrogueCE ===
  const brogueceDims = [
    makeDimension("creatures", "extractor_population", 67, 67, 67, "extractor_population", "All monsters in monsterCatalog (excluding MK_YOU and NUMBER_MONSTER_KINDS)"),
    makeDimension("terrain", "extractor_population", 214, 214, 214, "extractor_population", "All tile types in tileCatalog"),
    makeDimension("items", "extractor_population", 97, 97, 97, "extractor_population", "All items across weapon/armor/food/key/staff/ring/potion/scroll/wand/charm tables"),
    makeDimension("dungeon_features", "extractor_population", 145, 145, 145, "extractor_population", "All unique tile types in dungeonFeatureCatalog"),
    makeDimension("lights", "extractor_population", 60, 60, 60, "extractor_population", "All entries in lightCatalog"),
    makeDimension("mutations", "extractor_population", 8, 8, 8, "extractor_population", "All entries in mutationCatalog"),
    makeDimension("monster_classes", "extractor_population", 15, 15, 15, "extractor_population", "All entries in monsterClassCatalog"),
    makeDimension("status_effects", "extractor_population", 26, 26, 26, "extractor_population", "All entries in statusEffectCatalog"),
    makeDimension("monster_behaviors", "extractor_population", 29, 29, 29, "extractor_population", "All entries in monsterBehaviorCatalog"),
    makeDimension("monster_abilities", "extractor_population", 18, 18, 18, "extractor_population", "All entries in monsterAbilityCatalog"),
    makeDimension("image_assets", "extractor_population", 4, 4, 4, "extractor_population", "Image assets (icon.png, tiles.png) from bin/assets and source/bin/assets"),
    makeDimension("semantic_records", "qualitative", null, 12, 12, "qualitative", "12 semantic records covering core BrogueCE systems and mechanics"),
    makeDimension("concepts", "qualitative", null, 2, 2, "qualitative", "2 cross-game concepts: layered terrain promotion, runic weapon"),
  ];
  const brogueceCoverage = computeCoverage("broguece", "5fb1793f11b3fda3bee098aa6af7dda7166111cc06cffcaeeceae4fa7d1fb5b2", brogueceDims);

  // === Cataclysm-BN ===
  const catbnDims = [
    makeDimension("monsters", "extractor_population", 597, 597, 597, "extractor_population", "All monster entries in data/json/monsters/*.json"),
    makeDimension("items", "extractor_population", 5886, 5886, 5886, "extractor_population", "All item entries with id in data/json/items/**/*.json"),
    makeDimension("mutations", "extractor_population", 625, 625, 625, "extractor_population", "All mutation entries with id in data/json/mutations/*.json"),
    makeDimension("professions", "extractor_population", 339, 339, 339, "extractor_population", "All profession entries in professions.json"),
    makeDimension("bionics", "extractor_population", 137, 137, 137, "extractor_population", "All bionic entries with type=bionic in data/json/bionics.json"),
    makeDimension("cb_traps", "extractor_population", 50, 50, 50, "extractor_population", "All trap entries with type=trap in data/json/traps.json"),
    makeDimension("recipes", "extractor_population", 3187, 3187, 3187, "extractor_population", "All recipe entries with type=recipe in data/json/recipes/**/*.json"),
    makeDimension("cb_skills", "extractor_population", 28, 28, 28, "extractor_population", "All skill entries with type=skill in data/json/skills.json"),
    makeDimension("effects", "extractor_population", 237, 237, 237, "extractor_population", "All effect entries with type=effect_type in data/json/effects.json"),
    makeDimension("factions", "extractor_population", 71, 71, 71, "extractor_population", "All faction entries: 17 NPC factions (npcs/factions.json) + 54 monster factions (monster_factions.json)"),
    makeDimension("martial_arts", "extractor_population", 31, 31, 31, "extractor_population", "All martial_art entries in martialarts.json"),
    makeDimension("npc_classes", "extractor_population", 30, 30, 30, "extractor_population", "All npc_class entries in npcs/classes.json"),
    makeDimension("monster_groups", "extractor_population", 200, 200, 200, "extractor_population", "All monstergroup entries in monstergroups/*.json"),
    makeDimension("semantic_records", "qualitative", null, 6, 6, "qualitative", "6 semantic records covering mutation, faction, crafting, profession, species, encumbrance systems"),
    makeDimension("concepts", "qualitative", null, 2, 2, "qualitative", "2 concepts: mutation progression tree, faction-based emergent infighting"),
  ];
  const catbnCoverage = computeCoverage("cataclysm-bn", "a8b27380f9ca96a859a50604569e6993c3da98bd1c8507f9a8421f5f5d979cbd", catbnDims);

  // === NetHack ===
  // Expected counts aligned with nethack-extractor manifest exhaustivePopulations.
  // Previous values (creatures=379, items=430) were source-tree counts; now match
  // extractor-expected counts (376, 454) per RFC-0001 Principle 5.
  const nethackDims = [
    makeDimension("creatures", "extractor_population", 376, 376, 376, "extractor_population", "All monsters in monsters.h (MON() entries, excluding NUMMONS terminator and duplicates)"),
    makeDimension("items", "extractor_population", 454, 454, 454, "extractor_population", "All items in objects.h (WEAPON, ARMOR, RING, POTION, SCROLL, SPELL, WAND, FOOD, AMULET, TOOL, GEM entries, excluding #if 0 blocks)"),
    makeDimension("artifacts", "extractor_population", 33, 33, 33, "extractor_population", "All artifacts in artilist.h (A() entries, excluding dummy #0, #if 0 Palantir, and terminator)"),
    makeDimension("traps", "extractor_population", 25, 25, 25, "extractor_population", "All trap types in trap.h (enum trap_types entries 1-25, excluding sentinels)"),
    makeDimension("roles", "extractor_population", 13, 13, 13, "extractor_population", "All roles in role.c (struct Role entries, excluding UNDEFINED_ROLE terminator)"),
    makeDimension("races", "extractor_population", 5, 5, 5, "extractor_population", "All races in role.c (struct Race entries, excluding UNDEFINED_RACE terminator)"),
    makeDimension("branches", "extractor_population", 9, 9, 9, "extractor_population", "All dungeon branches in dungeon.lua (top-level entries in dungeon table)"),
    makeDimension("skills", "extractor_population", 37, 37, 37, "extractor_population", "All skills in skills.h (enum p_skills entries P_DAGGER through P_RIDING, excluding sentinels)"),
    makeDimension("attack_types", "extractor_population", 17, 17, 17, "extractor_population", "All AT_* #define entries in monattk.h (excluding AT_ANY wildcard)"),
    makeDimension("monster_abilities", "extractor_population", 72, 72, 72, "extractor_population", "All M1_*/M2_*/M3_* #define entries in monflag.h (excluding composite aliases)"),
    makeDimension("semantic_records", "qualitative", null, 6, 6, "qualitative", "6 semantic records covering difficulty, identification, resistance, alignment, artifact, genocide systems"),
    makeDimension("concepts", "qualitative", null, 2, 2, "qualitative", "2 concepts: corpse-conveyed resistance, risk-reward item identification"),
  ];
  const nethackCoverage = computeCoverage("nethack", "40dde88fe3b4529a92a27cce53ba855682346cdb9b3715383850f0bf1ec1fc78", nethackDims);

  // === Dungeon Crawl Stone Soup ===
  const crawlDims = [
    makeDimension("monsters", "extractor_population", 680, 680, 680, "extractor_population", "All monster YAML files in dat/mons/ (excluding README and TEST*)"),
    makeDimension("species", "extractor_population", 48, 48, 48, "extractor_population", "All species YAML files in dat/species/"),
    makeDimension("jobs", "extractor_population", 26, 26, 26, "extractor_population", "All job YAML files in dat/jobs/"),
    makeDimension("vaults", "extractor_population", 6246, 6246, 6246, "extractor_population", "All NAME: blocks in .des files under dat/des/ (excluding test/)"),
    makeDimension("spells", "extractor_population", 418, 418, 418, "extractor_population", "All spell entries in spelldata[] array in spl-data.h"),
    makeDimension("branches", "extractor_population", 41, 41, 41, "extractor_population", "All branch entries in branches[] array in branch-data.h (TAG_MAJOR_VERSION == 34)"),
    makeDimension("forms", "extractor_population", 35, 35, 35, "extractor_population", "All form YAML files in dat/forms/"),
    makeDimension("abilities", "extractor_population", 216, 216, 216, "extractor_population", "All ABIL_* enum entries in ability-type.h (TAG_MAJOR_VERSION == 34, excluding aliases, sentinels, and WIZARD-only entries)"),
    makeDimension("gods", "extractor_population", 27, 27, 27, "extractor_population", "All GOD_* enum entries in religion.h (TAG_MAJOR_VERSION == 34)"),
    makeDimension("brands", "extractor_population", 37, 37, 37, "extractor_population", "All brand enum entries in brand.h (TAG_MAJOR_VERSION == 34)"),
    makeDimension("item_types", "extractor_population", 20, 20, 20, "extractor_population", "All object class type enum entries in object.h (TAG_MAJOR_VERSION == 34)"),
    makeDimension("clouds", "extractor_population", 40, 40, 40, "extractor_population", "All cloud type enum entries in cloud.h (TAG_MAJOR_VERSION == 34)"),
  ];
  const crawlCoverage = computeCoverage("crawl", "6c24cee475930276f51300c052b34522b6a97f7cb2b75b0bedf8ae7f5605f61b", crawlDims);

  // Write coverage files directly to canonical
  const coverageDir = join(CANONICAL_ROOT, "coverage");
  mkdirSync(coverageDir, { recursive: true });

  const coverages = [brogueceCoverage, catbnCoverage, nethackCoverage, crawlCoverage];
  for (const cov of coverages) {
    const filePath = join(coverageDir, `${cov.source_id}.jsonl`);
    writeFileSync(filePath, JSON.stringify(cov) + "\n");
    console.log(`Wrote ${filePath} (${cov.dimensions.length} dimensions)`);
    for (const dim of cov.dimensions) {
      console.log(`  ${dim.id}: ${dim.state} (expected=${dim.expected}, extracted=${dim.extracted}, validated=${dim.validated})`);
    }
  }

  console.log(`\nCreated ${coverages.length} coverage records.`);
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
