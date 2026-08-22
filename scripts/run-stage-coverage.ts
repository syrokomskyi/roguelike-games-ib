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
    makeDimension("semantic_records", "qualitative", null, 6, 6, "qualitative", "6 semantic records covering mutation, faction, crafting, profession, species, encumbrance systems"),
    makeDimension("concepts", "qualitative", null, 2, 2, "qualitative", "2 concepts: mutation progression tree, faction-based emergent infighting"),
  ];
  const catbnCoverage = computeCoverage("cataclysm-bn", "a8b27380f9ca96a859a50604569e6993c3da98bd1c8507f9a8421f5f5d979cbd", catbnDims);

  // === NetHack ===
  const nethackDims = [
    makeDimension("creatures", "extractor_population", 379, 376, 376, "extractor_population", "All monsters in monsters.h; 376 of 379 extracted (3 missing)"),
    makeDimension("items", "extractor_population", 430, 458, 458, "extractor_population", "Items from objects.h; 458 of 430 expected extracted"),
    makeDimension("semantic_records", "qualitative", null, 6, 6, "qualitative", "6 semantic records covering difficulty, identification, resistance, alignment, artifact, genocide systems"),
    makeDimension("concepts", "qualitative", null, 2, 2, "qualitative", "2 concepts: corpse-conveyed resistance, risk-reward item identification"),
  ];
  const nethackCoverage = computeCoverage("nethack", "bb2d375f5feea0baa2e24b7848786a6100b7504febb2419ba24b42df701b2b7f", nethackDims);

  // === Dungeon Crawl Stone Soup ===
  const crawlDims = [
    makeDimension("monsters", "extractor_population", 680, 680, 680, "extractor_population", "All monster YAML files in dat/mons/ (excluding README and TEST*)"),
    makeDimension("species", "extractor_population", 48, 48, 48, "extractor_population", "All species YAML files in dat/species/"),
    makeDimension("jobs", "extractor_population", 26, 26, 26, "extractor_population", "All job YAML files in dat/jobs/"),
    makeDimension("vaults", "extractor_population", 6246, 6246, 6246, "extractor_population", "All NAME: blocks in .des files under dat/des/ (excluding test/)"),
  ];
  const crawlCoverage = computeCoverage("crawl", "de8b21b4beb5654ebb656bdb6f8947d286bf5bf8f31729816e38074471b1ec4a", crawlDims);

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
