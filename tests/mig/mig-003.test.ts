import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import {
  createBrogueCEExtractor,
  parseMonsterCatalog,
  parseTileCatalog,
  parseItemTable,
} from "@roguelike-games-ib/broguece-extractor";
import {
  ReadonlySourceReader,
  EvidenceFactory,
  CandidateWriter,
  createNullSchemaFacade,
  createExtractorContext,
  RefreshIdentityResolver,
  runExtractorDeterministic,
} from "@roguelike-games-ib/extractor-sdk";
import {
  createSourceBinding,
  computeSourceFingerprint,
  computeBindingDigest,
  canonicalJsonStringify,
} from "@roguelike-games-ib/knowledge-core";

const WORKSPACE = resolve(__dirname, "../..");
const SOURCE_ROOT = resolve(WORKSPACE, "../roguelike-games-ib-source/BrogueCE/source");
const SOURCE_UNIT = resolve(WORKSPACE, "../roguelike-games-ib-source/BrogueCE");
const CANONICAL_ROOT = join(WORKSPACE, "knowledge");

const GLOBALS_C = "src/brogue/Globals.c";
const ROGUE_H = "src/brogue/Rogue.h";

function readJsonlDir(dir: string): any[] {
  if (!existsSync(dir)) return [];
  const records: any[] = [];
  function walk(d: string) {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        walk(join(d, entry.name));
      } else if (entry.name.endsWith(".jsonl")) {
        const text = readFileSync(join(d, entry.name), "utf-8");
        for (const line of text.split("\n").filter(Boolean)) {
          records.push(JSON.parse(line));
        }
      }
    }
  }
  walk(dir);
  return records;
}

describe("C9: BrogueCE vertical slice", () => {
  it("source unit is registered in registry.yaml", () => {
    const registry = parseYaml(
      readFileSync(join(CANONICAL_ROOT, "sources", "registry.yaml"), "utf-8"),
    );
    const broguece = registry.sources.find((s: any) => s.id === "broguece");
    expect(broguece).toBeDefined();
    expect(broguece.kind).toBe("game_repository");
    expect(broguece.unit_path).toBe("BrogueCE");
  });

  it("source binding exists with valid fingerprint", () => {
    const bindings = parseYaml(
      readFileSync(join(CANONICAL_ROOT, "sources", "bindings.yaml"), "utf-8"),
    );
    const binding = bindings.bindings.find((b: any) => b.source_id === "broguece");
    expect(binding).toBeDefined();
    expect(binding.declared_version).toBe("1.15.1");
    expect(binding.fingerprint.algorithm).toBe("sha256-tree-v1");
    expect(binding.fingerprint.value).toMatch(/^[a-f0-9]{64}$/);
    expect(binding.binding_digest).toMatch(/^[a-f0-9]{64}$/);
  });

  it("source metadata is readable from package.json", () => {
    const pkgJson = JSON.parse(
      readFileSync(join(SOURCE_UNIT, "package.json"), "utf-8"),
    );
    expect(pkgJson.werkstattSource).toBeDefined();
    expect(pkgJson.werkstattSource.id).toBe("broguece");
    expect(pkgJson.werkstattSource.schema).toBe("werkstatt/source-unit@1");
    expect(pkgJson.version).toBe("1.15.1");
  });

  it("fingerprint matches actual source tree", () => {
    const fingerprint = computeSourceFingerprint(SOURCE_ROOT);
    const bindings = parseYaml(
      readFileSync(join(CANONICAL_ROOT, "sources", "bindings.yaml"), "utf-8"),
    );
    const binding = bindings.bindings.find((b: any) => b.source_id === "broguece");
    expect(fingerprint).toBe(binding.fingerprint.value);
  });

  it("extractor produces deterministic output", async () => {
    const binding = createSourceBinding(
      "broguece",
      "BrogueCE",
      "1.15.1",
      "semver",
      "package_json",
      computeSourceFingerprint(SOURCE_ROOT),
      { repository: "https://github.com/tmewett/BrogueCE", commit: null, clean: null, default_branch: "master" },
      "source",
    );
    const extractor = createBrogueCEExtractor();
    const stagingDir = join(WORKSPACE, "staging", "c9-test");

    function createContext() {
      const source = new ReadonlySourceReader(SOURCE_ROOT);
      const evidence = new EvidenceFactory("broguece", binding.binding_digest, source);
      const ids = new RefreshIdentityResolver([], [], "broguece");
      const schemas = createNullSchemaFacade();
      const output = new CandidateWriter(
        stagingDir,
        "run-" + Math.random().toString(36).slice(2),
        "broguece",
        "broguece-factual",
        "1.0.0",
      );
      return createExtractorContext(source, binding, schemas, evidence, ids, output);
    }

    const det = await runExtractorDeterministic(extractor, createContext);
    expect(det.deterministic).toBe(true);
    expect(det.run1.recordCount).toBeGreaterThan(0);
  });

  it("extracts exhaustive factual dimensions for creatures", () => {
    const globalsC = readFileSync(join(SOURCE_ROOT, GLOBALS_C), "utf-8");
    const monsters = parseMonsterCatalog(globalsC);
    expect(monsters.length).toBeGreaterThanOrEqual(60);
    const rat = monsters.find((m) => m.name === "rat");
    expect(rat).toBeDefined();
    expect(rat!.maxHp).toBeGreaterThan(0);
    expect(rat!.accuracy).toBeGreaterThan(0);
  });

  it("extracts exhaustive factual dimensions for terrain", () => {
    const globalsC = readFileSync(join(SOURCE_ROOT, GLOBALS_C), "utf-8");
    const tiles = parseTileCatalog(globalsC);
    expect(tiles.length).toBeGreaterThanOrEqual(100);
    const floor = tiles.find((t) => t.nativeId === "FLOOR");
    expect(floor).toBeDefined();
    expect(floor!.drawPriority).toBeGreaterThan(0);
  });

  it("extracts exhaustive factual dimensions for items", () => {
    const globalsC = readFileSync(join(SOURCE_ROOT, GLOBALS_C), "utf-8");
    const weapons = parseItemTable(globalsC, "weapon", "weaponTable");
    expect(weapons.length).toBeGreaterThanOrEqual(10);
    const dagger = weapons.find((w) => w.name === "dagger");
    expect(dagger).toBeDefined();
    expect(dagger!.marketValue).toBeGreaterThan(0);
    expect(dagger!.description.length).toBeGreaterThan(20);
  });

  it("canonical knowledge base has ≥10 semantic records with claim-level evidence", () => {
    const semanticRecords = readJsonlDir(join(CANONICAL_ROOT, "semantic_record"));
    expect(semanticRecords.length).toBeGreaterThanOrEqual(10);

    for (const sr of semanticRecords) {
      expect(sr.semantic_type).toBeDefined();
      expect(sr.title).toBeDefined();
      expect(sr.summary).toBeDefined();
      expect(sr.evidence_refs).toBeDefined();
      expect(sr.evidence_refs.length).toBeGreaterThan(0);
    }
  });

  it("canonical knowledge base has definition records for creatures, terrain, and items", () => {
    const gameDefs = readJsonlDir(join(CANONICAL_ROOT, "definition"));
    const creatures = gameDefs.filter((r) => r.kind === "creature");
    const terrain = gameDefs.filter((r) => r.kind === "terrain");
    const items = gameDefs.filter((r) => r.kind === "item");

    expect(creatures.length).toBeGreaterThanOrEqual(60);
    expect(terrain.length).toBeGreaterThanOrEqual(100);
    expect(items.length).toBeGreaterThanOrEqual(30);
  });

  it("canonical knowledge base has evidence records with valid anchors", () => {
    const evidence = readJsonlDir(join(CANONICAL_ROOT, "evidence"));
    expect(evidence.length).toBeGreaterThan(0);

    const brogueceEvidence = evidence.filter((ev) => ev.anchor?.source_id === "broguece");
    expect(brogueceEvidence.length).toBeGreaterThan(0);

    for (const ev of brogueceEvidence) {
      expect(ev.anchor).toBeDefined();
      expect(ev.anchor.source_id).toBe("broguece");
      expect(ev.anchor.artifact.path).toBeDefined();
      expect(ev.anchor.artifact.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(ev.anchor.locator).toBeDefined();
    }
  });

  it("canonical knowledge base has claims with evidence refs", () => {
    const claims = readJsonlDir(join(CANONICAL_ROOT, "claim"));
    expect(claims.length).toBeGreaterThanOrEqual(1);

    for (const claim of claims) {
      expect(claim.subject_id).toBeDefined();
      expect(claim.predicate).toBeDefined();
      expect(claim.assertion_state).toBeDefined();
      expect(claim.evidence_refs).toBeDefined();
      expect(claim.evidence_refs.length).toBeGreaterThan(0);
    }
  });

  it("canonical knowledge base has one cross-game-ready concept candidate", () => {
    const concepts = readJsonlDir(join(CANONICAL_ROOT, "concept"));
    const crossGame = concepts.filter((c) => c.concept_type === "cross_game_mechanic");
    expect(crossGame.length).toBeGreaterThanOrEqual(1);

    const concept = crossGame[0];
    expect(concept.title).toBeDefined();
    expect(concept.definition).toBeDefined();
    expect(concept.inclusion_criteria).toBeDefined();
    expect(concept.exclusion_criteria).toBeDefined();
    expect(concept.evidence_refs).toBeDefined();
    expect(concept.evidence_refs.length).toBeGreaterThan(0);
  });

  it("canonical knowledge base has one Creator design primitive with ancestry", () => {
    const concepts = readJsonlDir(join(CANONICAL_ROOT, "concept"));
    const designPrimitives = concepts.filter((c) => c.concept_type === "design_primitive");
    expect(designPrimitives.length).toBeGreaterThanOrEqual(1);

    const dp = designPrimitives[0];
    expect(dp.title).toBeDefined();
    expect(dp.definition).toBeDefined();
    expect(dp.ancestry).toBeDefined();
    expect(dp.ancestry.source_games).toBeDefined();
    expect(dp.ancestry.source_games).toContain("broguece");
    expect(dp.ancestry.derived_from).toBeDefined();
    expect(dp.ancestry.derived_from.length).toBeGreaterThan(0);
    expect(dp.ancestry.mutation_dimensions).toBeDefined();
    expect(dp.ancestry.mutation_dimensions.length).toBeGreaterThan(0);
  });

  it("canonical knowledge base has relations between records", () => {
    const relations = readJsonlDir(join(CANONICAL_ROOT, "relation"));
    expect(relations.length).toBeGreaterThanOrEqual(1);

    for (const rel of relations) {
      expect(rel.relation_type).toBeDefined();
      expect(rel.source_record_id).toBeDefined();
      expect(rel.target_record_id).toBeDefined();
      expect(rel.evidence_refs).toBeDefined();
    }
  });
});
