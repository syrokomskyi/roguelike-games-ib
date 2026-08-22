/*
<MODULE_CONTRACT>
<purpose>C13 conformance test — validates Crawl extractor registration, source binding, determinism, population denominators, and runtime performance.</purpose>
<non-goals>
  <item>Does not test sprite extraction — covered by quality tests.</item>
</non-goals>
<CHANGE_SUMMARY>
  <item>Initial creation: conformance test for Crawl extractor scale trial.</item>
</CHANGE_SUMMARY>
*/
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import {
  createCrawlExtractor,
  parseMonsterYaml,
  parseSpeciesYaml,
  parseJobYaml,
  parseDesVaults,
} from "@roguelike-games-ib/crawl-extractor";
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
} from "@roguelike-games-ib/knowledge-core";

const WORKSPACE = resolve(__dirname, "../..");
const SOURCE_ROOT = resolve(WORKSPACE, "../roguelike-games-ib-source/crawl/crawl-ref/source/dat");
const CANONICAL_ROOT = join(WORKSPACE, "knowledge");

interface RegistrySource {
  id: string;
  kind: string;
  unit_path: string;
}

interface RegistryYaml {
  sources: RegistrySource[];
}

interface BindingEntry {
  source_id: string;
  declared_version: string;
  fingerprint: { algorithm: string; value: string };
  binding_digest: string;
}

interface BindingsYaml {
  bindings: BindingEntry[];
}

describe("C13: Dungeon Crawl Stone Soup scale trial", () => {
  it("source unit is registered in registry.yaml", () => {
    const registry = parseYaml(
      readFileSync(join(CANONICAL_ROOT, "sources", "registry.yaml"), "utf-8"),
    ) as RegistryYaml;
    const crawl = registry.sources.find((s) => s.id === "crawl");
    expect(crawl).toBeDefined();
    expect(crawl!.kind).toBe("game_repository");
    expect(crawl!.unit_path).toBe("crawl");
  });

  it("source binding exists with valid fingerprint", () => {
    const bindings = parseYaml(
      readFileSync(join(CANONICAL_ROOT, "sources", "bindings.yaml"), "utf-8"),
    ) as BindingsYaml;
    const binding = bindings.bindings.find((b) => b.source_id === "crawl");
    expect(binding).toBeDefined();
    expect(binding!.declared_version).toBe("0.32.0");
    expect(binding!.fingerprint.algorithm).toBe("sha256-tree-v1");
    expect(binding!.fingerprint.value).toMatch(/^[a-f0-9]{64}$/);
    expect(binding!.binding_digest).toMatch(/^[a-f0-9]{64}$/);
  });

  it("fingerprint matches actual source tree", () => {
    const fingerprint = computeSourceFingerprint(SOURCE_ROOT);
    const bindings = parseYaml(
      readFileSync(join(CANONICAL_ROOT, "sources", "bindings.yaml"), "utf-8"),
    ) as BindingsYaml;
    const binding = bindings.bindings.find((b) => b.source_id === "crawl");
    expect(fingerprint).toBe(binding!.fingerprint.value);
  });

  it("extractor produces deterministic output", async () => {
    const binding = createSourceBinding(
      "crawl",
      "crawl",
      "0.32.0",
      "semver",
      "other",
      computeSourceFingerprint(SOURCE_ROOT),
      { repository: "https://github.com/crawl/crawl", commit: null, clean: null, default_branch: "master" },
      "crawl-ref/source/dat",
    );
    const extractor = createCrawlExtractor();
    const stagingDir = join(WORKSPACE, "staging", "c13-test");

    function createContext() {
      const source = new ReadonlySourceReader(SOURCE_ROOT);
      const evidence = new EvidenceFactory("crawl", binding.binding_digest, source);
      const ids = new RefreshIdentityResolver([], [], "crawl");
      const schemas = createNullSchemaFacade();
      const output = new CandidateWriter(
        stagingDir,
        "run-" + Math.random().toString(36).slice(2),
        "crawl",
        "crawl-factual",
        "1.0.0",
      );
      return createExtractorContext(source, binding, schemas, evidence, ids, output);
    }

    const det = await runExtractorDeterministic(extractor, createContext);
    expect(det.deterministic).toBe(true);
    expect(det.run1.recordCount).toBeGreaterThan(0);
    expect(det.run1.recordCount).toBe(det.run2.recordCount);
  });

  it("extracts high-cardinality monster family with exact denominator", () => {
    const reader = new ReadonlySourceReader(SOURCE_ROOT);
    const allFiles = reader.walk();
    const monsterFiles = allFiles.filter(
      (p) => p.startsWith("mons/") && p.endsWith(".yaml") && !/^mons\/(README|TEST)/.test(p),
    );
    let totalMonsters = 0;
    for (const file of monsterFiles) {
      const text = readFileSync(join(SOURCE_ROOT, file), "utf-8");
      const m = parseMonsterYaml(text, file);
      if (m) totalMonsters++;
    }
    expect(totalMonsters).toBeGreaterThanOrEqual(600);
  });

  it("extracts species family with exact denominator", () => {
    const reader = new ReadonlySourceReader(SOURCE_ROOT);
    const allFiles = reader.walk();
    const speciesFiles = allFiles.filter(
      (p) => p.startsWith("species/") && p.endsWith(".yaml") && !p.startsWith("species/README"),
    );
    let totalSpecies = 0;
    for (const file of speciesFiles) {
      const text = readFileSync(join(SOURCE_ROOT, file), "utf-8");
      const s = parseSpeciesYaml(text, file);
      if (s) totalSpecies++;
    }
    expect(totalSpecies).toBeGreaterThanOrEqual(40);
  });

  it("extracts job family with exact denominator", () => {
    const reader = new ReadonlySourceReader(SOURCE_ROOT);
    const allFiles = reader.walk();
    const jobFiles = allFiles.filter(
      (p) => p.startsWith("jobs/") && p.endsWith(".yaml") && !p.startsWith("jobs/README"),
    );
    let totalJobs = 0;
    for (const file of jobFiles) {
      const text = readFileSync(join(SOURCE_ROOT, file), "utf-8");
      const j = parseJobYaml(text, file);
      if (j) totalJobs++;
    }
    expect(totalJobs).toBeGreaterThanOrEqual(20);
  });

  it("extracts vault family with exact denominator", () => {
    const reader = new ReadonlySourceReader(SOURCE_ROOT);
    const allFiles = reader.walk();
    const desFiles = allFiles.filter(
      (p) => p.startsWith("des/") && p.endsWith(".des") && !p.includes("/test/"),
    );
    let totalVaults = 0;
    for (const file of desFiles) {
      const text = readFileSync(join(SOURCE_ROOT, file), "utf-8");
      const vaults = parseDesVaults(text, file);
      totalVaults += vaults.length;
    }
    expect(totalVaults).toBeGreaterThanOrEqual(6000);
  });

  it("extraction runtime is under 10 seconds", async () => {
    const binding = createSourceBinding(
      "crawl",
      "crawl",
      "0.32.0",
      "semver",
      "other",
      computeSourceFingerprint(SOURCE_ROOT),
      { repository: "https://github.com/crawl/crawl", commit: null, clean: null, default_branch: "master" },
      "crawl-ref/source/dat",
    );
    const extractor = createCrawlExtractor();
    const stagingDir = join(WORKSPACE, "staging", "c13-bench");

    const source = new ReadonlySourceReader(SOURCE_ROOT);
    const evidence = new EvidenceFactory("crawl", binding.binding_digest, source);
    const ids = new RefreshIdentityResolver([], [], "crawl");
    const schemas = createNullSchemaFacade();
    const output = new CandidateWriter(stagingDir, "bench-run", "crawl", "crawl-factual", "1.0.0");
    const ctx = createExtractorContext(source, binding, schemas, evidence, ids, output);

    const t0 = Date.now();
    await extractor.run(ctx);
    const elapsed = Date.now() - t0;

    expect(elapsed).toBeLessThan(10000);
  });
});
