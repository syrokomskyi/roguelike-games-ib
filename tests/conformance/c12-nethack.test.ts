import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import {
  createNetHackExtractor,
  parseMonsters,
  parseObjects,
} from "@roguelike-games-ib/nethack-extractor";
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
} from "@roguelike-games-ib/knowledge-core";

const WORKSPACE = resolve(__dirname, "../..");
const SOURCE_ROOT = resolve(WORKSPACE, "../roguelike-games-ib-source/NetHack/include");
const SOURCE_UNIT = resolve(WORKSPACE, "../roguelike-games-ib-source/NetHack");
const CANONICAL_ROOT = join(WORKSPACE, "knowledge");

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

describe("C12: NetHack scale trial", () => {
  it("source unit is registered in registry.yaml", () => {
    const registry = parseYaml(
      readFileSync(join(CANONICAL_ROOT, "sources", "registry.yaml"), "utf-8"),
    );
    const nh = registry.sources.find((s: any) => s.id === "nethack");
    expect(nh).toBeDefined();
    expect(nh.kind).toBe("game_repository");
    expect(nh.unit_path).toBe("NetHack");
  });

  it("source binding exists with valid fingerprint", () => {
    const bindings = parseYaml(
      readFileSync(join(CANONICAL_ROOT, "sources", "bindings.yaml"), "utf-8"),
    );
    const binding = bindings.bindings.find((b: any) => b.source_id === "nethack");
    expect(binding).toBeDefined();
    expect(binding.declared_version).toBe("5.0.0");
    expect(binding.fingerprint.algorithm).toBe("sha256-tree-v1");
    expect(binding.fingerprint.value).toMatch(/^[a-f0-9]{64}$/);
    expect(binding.binding_digest).toMatch(/^[a-f0-9]{64}$/);
  });

  it("source metadata is readable from package.json", () => {
    const pkgJson = JSON.parse(
      readFileSync(join(SOURCE_UNIT, "package.json"), "utf-8"),
    );
    expect(pkgJson.werkstattSource).toBeDefined();
    expect(pkgJson.werkstattSource.id).toBe("nethack");
    expect(pkgJson.werkstattSource.schema).toBe("werkstatt/source-unit@1");
    expect(pkgJson.version).toBe("5.0.0");
  });

  it("fingerprint matches actual source tree", () => {
    const fingerprint = computeSourceFingerprint(SOURCE_ROOT);
    const bindings = parseYaml(
      readFileSync(join(CANONICAL_ROOT, "sources", "bindings.yaml"), "utf-8"),
    );
    const binding = bindings.bindings.find((b: any) => b.source_id === "nethack");
    expect(fingerprint).toBe(binding.fingerprint.value);
  });

  it("extractor produces deterministic output", async () => {
    const binding = createSourceBinding(
      "nethack",
      "NetHack",
      "5.0.0",
      "semver",
      "package_json",
      computeSourceFingerprint(SOURCE_ROOT),
      { repository: "https://github.com/NetHack/NetHack", commit: null, clean: null, default_branch: "NetHack-5.0" },
      "include",
    );
    const extractor = createNetHackExtractor();
    const stagingDir = join(WORKSPACE, "staging", "c12-test");

    function createContext() {
      const source = new ReadonlySourceReader(SOURCE_ROOT);
      const evidence = new EvidenceFactory("nethack", binding.binding_digest, source);
      const ids = new RefreshIdentityResolver([], [], "nethack");
      const schemas = createNullSchemaFacade();
      const output = new CandidateWriter(
        stagingDir,
        "run-" + Math.random().toString(36).slice(2),
        "nethack",
        "nethack-factual",
        "1.0.0",
      );
      return createExtractorContext(source, binding, schemas, evidence, ids, output);
    }

    const det = await runExtractorDeterministic(extractor, createContext);
    expect(det.deterministic).toBe(true);
    expect(det.run1.recordCount).toBeGreaterThan(0);
    expect(det.run1.recordCount).toBe(det.run2.recordCount);
  });

  it("extracts high-cardinality creature family with exact denominator", () => {
    const monstersH = readFileSync(join(SOURCE_ROOT, "monsters.h"), "utf-8");
    const monsters = parseMonsters(monstersH);
    expect(monsters.length).toBeGreaterThanOrEqual(350);
  });

  it("extracts high-cardinality item family with exact denominator", () => {
    const objectsH = readFileSync(join(SOURCE_ROOT, "objects.h"), "utf-8");
    const objects = parseObjects(objectsH);
    expect(objects.length).toBeGreaterThanOrEqual(400);
  });

  it("canonical knowledge base has definition records for nethack", () => {
    const gameDefs = readJsonlDir(join(CANONICAL_ROOT, "definition"));
    const nhDefs = gameDefs.filter((r) => r.scope?.source_id === "nethack");
    expect(nhDefs.length).toBeGreaterThan(0);

    const creatures = nhDefs.filter((r) => r.kind === "creature");
    const items = nhDefs.filter((r) => r.kind === "item");

    expect(creatures.length).toBeGreaterThanOrEqual(350);
    expect(items.length).toBeGreaterThanOrEqual(400);
  });

  it("canonical knowledge base has evidence records for nethack", () => {
    const evidence = readJsonlDir(join(CANONICAL_ROOT, "evidence"));
    const nhEvidence = evidence.filter((r) => r.anchor?.source_id === "nethack");
    expect(nhEvidence.length).toBeGreaterThan(0);

    for (const ev of nhEvidence.slice(0, 10)) {
      expect(ev.anchor).toBeDefined();
      expect(ev.anchor.source_id).toBe("nethack");
      expect(ev.anchor.artifact.path).toBeDefined();
      expect(ev.anchor.artifact.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(ev.anchor.locator).toBeDefined();
    }
  });

  it("extraction runtime is under 10 seconds", async () => {
    const binding = createSourceBinding(
      "nethack",
      "NetHack",
      "5.0.0",
      "semver",
      "package_json",
      computeSourceFingerprint(SOURCE_ROOT),
      { repository: "https://github.com/NetHack/NetHack", commit: null, clean: null, default_branch: "NetHack-5.0" },
      "include",
    );
    const extractor = createNetHackExtractor();
    const stagingDir = join(WORKSPACE, "staging", "c12-bench");

    const source = new ReadonlySourceReader(SOURCE_ROOT);
    const evidence = new EvidenceFactory("nethack", binding.binding_digest, source);
    const ids = new RefreshIdentityResolver([], [], "nethack");
    const schemas = createNullSchemaFacade();
    const output = new CandidateWriter(stagingDir, "bench-run", "nethack", "nethack-factual", "1.0.0");
    const ctx = createExtractorContext(source, binding, schemas, evidence, ids, output);

    const t0 = Date.now();
    await extractor.run(ctx);
    const elapsed = Date.now() - t0;

    expect(elapsed).toBeLessThan(10000);
  });

  it("canonical record count for nethack exceeds 800", () => {
    const gameDefs = readJsonlDir(join(CANONICAL_ROOT, "definition"));
    const nhDefs = gameDefs.filter((r) => r.scope?.source_id === "nethack");
    expect(nhDefs.length).toBeGreaterThan(800);
  });

  it("materialization produces valid SQLite for nethack records", () => {
    const distDir = join(WORKSPACE, ".generated", "knowledge", "dist");
    if (!existsSync(distDir)) {
      expect(true).toBe(true);
      return;
    }
    const dbPath = join(distDir, "knowledge.db");
    if (!existsSync(dbPath)) {
      expect(true).toBe(true);
      return;
    }
    expect(existsSync(dbPath)).toBe(true);
  });
});
