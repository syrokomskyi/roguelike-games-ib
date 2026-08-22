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
    makeDimension("creatures", "extractor_population", 67, 67, 67, "extractor_population", "All monsters in monsterCatalog"),
    makeDimension("terrain", "extractor_population", 214, 214, 214, "extractor_population", "All tile types in tileCatalog"),
    makeDimension("items", "extractor_population", 46, 46, 46, "extractor_population", "Items from weapon/armor/food/key/staff/ring tables"),
    makeDimension("semantic_records", "qualitative", null, 12, 12, "qualitative", "12 semantic records covering core BrogueCE systems and mechanics"),
    makeDimension("concepts", "qualitative", null, 2, 2, "qualitative", "2 cross-game concepts: layered terrain promotion, runic weapon"),
  ];
  const brogueceCoverage = computeCoverage("broguece", "5fb1793f11b3fda3bee098aa6af7dda7166111cc06cffcaeeceae4fa7d1fb5b2", brogueceDims);

  // === Cataclysm-BN ===
  const catbnDims = [
    makeDimension("monsters", "extractor_population", 597, 597, 597, "extractor_population", "All monster entries in data/json/monsters/*.json"),
    makeDimension("items", "extractor_population", 5886, 5838, 5838, "extractor_population", "Items from data/json/items/**/*.json; 5838 of 5886 extracted (48 missing)"),
    makeDimension("mutations", "extractor_population", 625, 621, 621, "extractor_population", "Mutations from data/json/mutations/*.json; 621 of 625 extracted"),
    makeDimension("professions", "extractor_population", 339, 339, 339, "extractor_population", "All profession entries in professions.json"),
    makeDimension("bionics", "extractor_population", 137, 137, 137, "extractor_population", "All bionic entries with type=bionic in data/json/bionics.json"),
    makeDimension("cb_traps", "extractor_population", 50, 50, 50, "extractor_population", "All trap entries with type=trap in data/json/traps.json"),
    makeDimension("recipes", "extractor_population", 3187, 3187, 3187, "extractor_population", "All recipe entries with type=recipe in data/json/recipes/**/*.json"),
    makeDimension("cb_skills", "extractor_population", 28, 28, 28, "extractor_population", "All skill entries with type=skill in data/json/skills.json"),
    makeDimension("effects", "extractor_population", 237, 237, 237, "extractor_population", "All effect entries with type=effect_type in data/json/effects.json"),
    makeDimension("factions", "extractor_population", 71, 71, 71, "extractor_population", "All faction entries: 17 NPC factions (npcs/factions.json) + 54 monster factions (monster_factions.json)"),
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
  ];
  const crawlCoverage = computeCoverage("crawl", "ed51ed562b68f13972eb4cf3f2a43c275d266ed468260ab0c2635dc5cb2260a0", crawlDims);

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
