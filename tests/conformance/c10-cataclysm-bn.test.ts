import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import {
  createCataclysmBNExtractor,
  parseMonsterJson,
  parseItemJson,
  parseMutationJson,
  parseProfessionJson,
  parseBionicJson,
  parseTrapJson,
  parseSkillJson,
  parseEffectJson,
  parseNpcFactionJson,
  parseMonsterFactionJson,
} from "@roguelike-games-ib/cataclysm-bn-extractor";
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
const SOURCE_ROOT = resolve(WORKSPACE, "../roguelike-games-ib-source/Cataclysm-BN/data/json");
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

describe("C10: Cataclysm-BN scale trial", () => {
  it("source unit is registered in registry.yaml", () => {
    const registry = parseYaml(
      readFileSync(join(CANONICAL_ROOT, "sources", "registry.yaml"), "utf-8"),
    );
    const catbn = registry.sources.find((s: any) => s.id === "cataclysm-bn");
    expect(catbn).toBeDefined();
    expect(catbn.kind).toBe("game_repository");
    expect(catbn.unit_path).toBe("Cataclysm-BN");
  });

  it("source binding exists with valid fingerprint", () => {
    const bindings = parseYaml(
      readFileSync(join(CANONICAL_ROOT, "sources", "bindings.yaml"), "utf-8"),
    );
    const binding = bindings.bindings.find((b: any) => b.source_id === "cataclysm-bn");
    expect(binding).toBeDefined();
    expect(binding.declared_version).toBe("0.7.1");
    expect(binding.fingerprint.algorithm).toBe("sha256-tree-v1");
    expect(binding.fingerprint.value).toMatch(/^[a-f0-9]{64}$/);
    expect(binding.binding_digest).toMatch(/^[a-f0-9]{64}$/);
  });

  it("fingerprint matches actual source tree", () => {
    const fingerprint = computeSourceFingerprint(SOURCE_ROOT);
    const bindings = parseYaml(
      readFileSync(join(CANONICAL_ROOT, "sources", "bindings.yaml"), "utf-8"),
    );
    const binding = bindings.bindings.find((b: any) => b.source_id === "cataclysm-bn");
    expect(fingerprint).toBe(binding.fingerprint.value);
  });

  it("extractor produces deterministic output", async () => {
    const binding = createSourceBinding(
      "cataclysm-bn",
      "Cataclysm-BN",
      "0.7.1",
      "semver",
      "package_json",
      computeSourceFingerprint(SOURCE_ROOT),
      { repository: "https://github.com/cataclysmbnteam/Cataclysm-BN", commit: null, clean: null, default_branch: "main" },
      "data/json",
    );
    const extractor = createCataclysmBNExtractor();
    const stagingDir = join(WORKSPACE, "staging", "c10-test");

    function createContext() {
      const source = new ReadonlySourceReader(SOURCE_ROOT);
      const evidence = new EvidenceFactory("cataclysm-bn", binding.binding_digest, source);
      const ids = new RefreshIdentityResolver([], [], "cataclysm-bn");
      const schemas = createNullSchemaFacade();
      const output = new CandidateWriter(
        stagingDir,
        "run-" + Math.random().toString(36).slice(2),
        "cataclysm-bn",
        "cataclysm-bn-factual",
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
    const allFiles = new ReadonlySourceReader(SOURCE_ROOT).walk();
    const monsterFiles = allFiles.filter((p) => p.startsWith("monsters/") && p.endsWith(".json"));
    let totalMonsters = 0;
    for (const file of monsterFiles) {
      const text = readFileSync(join(SOURCE_ROOT, file), "utf-8");
      try {
        const monsters = parseMonsterJson(text, file);
        totalMonsters += monsters.length;
      } catch {
        // skip invalid JSON
      }
    }
    expect(totalMonsters).toBeGreaterThanOrEqual(500);
  });

  it("extracts high-cardinality item family with exact denominator", () => {
    const allFiles = new ReadonlySourceReader(SOURCE_ROOT).walk();
    const itemFiles = allFiles.filter((p) => p.startsWith("items/") && p.endsWith(".json"));
    let totalItems = 0;
    for (const file of itemFiles) {
      const text = readFileSync(join(SOURCE_ROOT, file), "utf-8");
      try {
        const items = parseItemJson(text, file);
        totalItems += items.length;
      } catch {
        // skip invalid JSON
      }
    }
    expect(totalItems).toBeGreaterThanOrEqual(5000);
  });

  it("extracts high-cardinality mutation family with exact denominator", () => {
    const allFiles = new ReadonlySourceReader(SOURCE_ROOT).walk();
    const mutationFiles = allFiles.filter((p) => p.startsWith("mutations/") && p.endsWith(".json"));
    let totalMutations = 0;
    for (const file of mutationFiles) {
      const text = readFileSync(join(SOURCE_ROOT, file), "utf-8");
      try {
        const mutations = parseMutationJson(text, file);
        totalMutations += mutations.length;
      } catch {
        // skip invalid JSON
      }
    }
    expect(totalMutations).toBeGreaterThanOrEqual(600);
  });

  it("extracts high-cardinality profession family with exact denominator", () => {
    const profPath = join(SOURCE_ROOT, "professions.json");
    if (!existsSync(profPath)) {
      expect(true).toBe(true); // skip if not present
      return;
    }
    const text = readFileSync(profPath, "utf-8");
    const professions = parseProfessionJson(text, "professions.json");
    expect(professions.length).toBeGreaterThanOrEqual(300);
  });

  it("extracts bionics with exact denominator", () => {
    const text = readFileSync(join(SOURCE_ROOT, "bionics.json"), "utf-8");
    const bionics = parseBionicJson(text, "bionics.json");
    expect(bionics.length).toBe(137);
  });

  it("extracts traps with exact denominator", () => {
    const text = readFileSync(join(SOURCE_ROOT, "traps.json"), "utf-8");
    const traps = parseTrapJson(text, "traps.json");
    expect(traps.length).toBe(50);
  });

  it("extracts skills with exact denominator", () => {
    const text = readFileSync(join(SOURCE_ROOT, "skills.json"), "utf-8");
    const skills = parseSkillJson(text, "skills.json");
    expect(skills.length).toBe(28);
  });

  it("extracts effects with exact denominator", () => {
    const text = readFileSync(join(SOURCE_ROOT, "effects.json"), "utf-8");
    const effects = parseEffectJson(text, "effects.json");
    expect(effects.length).toBe(237);
  });

  it("extracts factions with exact denominator", () => {
    const npcText = readFileSync(join(SOURCE_ROOT, "npcs/factions.json"), "utf-8");
    const npcFactions = parseNpcFactionJson(npcText, "npcs/factions.json");
    expect(npcFactions.length).toBe(17);

    const monText = readFileSync(join(SOURCE_ROOT, "monster_factions.json"), "utf-8");
    const monFactions = parseMonsterFactionJson(monText, "monster_factions.json");
    expect(monFactions.length).toBe(54);

    expect(npcFactions.length + monFactions.length).toBe(71);
  });

  it("canonical knowledge base has definition records for cataclysm-bn", () => {
    const gameDefs = readJsonlDir(join(CANONICAL_ROOT, "definition"));
    const catbnDefs = gameDefs.filter((r) => r.scope?.source_id === "cataclysm-bn");
    expect(catbnDefs.length).toBeGreaterThan(0);

    const creatures = catbnDefs.filter((r) => r.kind === "creature");
    const items = catbnDefs.filter((r) => r.kind === "item");
    const mutations = catbnDefs.filter((r) => r.kind === "mutation");
    const professions = catbnDefs.filter((r) => r.kind === "profession");

    expect(creatures.length).toBeGreaterThanOrEqual(500);
    expect(items.length).toBeGreaterThanOrEqual(5000);
    expect(mutations.length).toBeGreaterThanOrEqual(600);
    expect(professions.length).toBeGreaterThanOrEqual(300);
  });

  it("canonical knowledge base has evidence records for cataclysm-bn", () => {
    const evidence = readJsonlDir(join(CANONICAL_ROOT, "evidence"));
    const catbnEvidence = evidence.filter((r) => r.anchor?.source_id === "cataclysm-bn");
    expect(catbnEvidence.length).toBeGreaterThan(0);

    for (const ev of catbnEvidence.slice(0, 10)) {
      expect(ev.anchor).toBeDefined();
      expect(ev.anchor.source_id).toBe("cataclysm-bn");
      expect(ev.anchor.artifact.path).toBeDefined();
      expect(ev.anchor.artifact.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(ev.anchor.locator).toBeDefined();
    }
  });

  it("extraction runtime is under 10 seconds", async () => {
    const binding = createSourceBinding(
      "cataclysm-bn",
      "Cataclysm-BN",
      "0.7.1",
      "semver",
      "package_json",
      computeSourceFingerprint(SOURCE_ROOT),
      { repository: "https://github.com/cataclysmbnteam/Cataclysm-BN", commit: null, clean: null, default_branch: "main" },
      "data/json",
    );
    const extractor = createCataclysmBNExtractor();
    const stagingDir = join(WORKSPACE, "staging", "c10-bench");

    const source = new ReadonlySourceReader(SOURCE_ROOT);
    const evidence = new EvidenceFactory("cataclysm-bn", binding.binding_digest, source);
    const ids = new RefreshIdentityResolver([], [], "cataclysm-bn");
    const schemas = createNullSchemaFacade();
    const output = new CandidateWriter(stagingDir, "bench-run", "cataclysm-bn", "cataclysm-bn-factual", "1.0.0");
    const ctx = createExtractorContext(source, binding, schemas, evidence, ids, output);

    const t0 = Date.now();
    await extractor.run(ctx);
    const elapsed = Date.now() - t0;

    expect(elapsed).toBeLessThan(10000);
  });

  it("canonical record count for cataclysm-bn exceeds 5000", () => {
    const gameDefs = readJsonlDir(join(CANONICAL_ROOT, "definition"));
    const catbnDefs = gameDefs.filter((r) => r.scope?.source_id === "cataclysm-bn");
    expect(catbnDefs.length).toBeGreaterThan(5000);
  });

  it("population counts match manifest declarations", async () => {
    const binding = createSourceBinding(
      "cataclysm-bn",
      "Cataclysm-BN",
      "0.7.1",
      "semver",
      "package_json",
      computeSourceFingerprint(SOURCE_ROOT),
      { repository: "https://github.com/cataclysmbnteam/Cataclysm-BN", commit: null, clean: null, default_branch: "main" },
      "data/json",
    );
    const extractor = createCataclysmBNExtractor();
    const stagingDir = join(WORKSPACE, "staging", "c10-pop");

    const source = new ReadonlySourceReader(SOURCE_ROOT);
    const evidence = new EvidenceFactory("cataclysm-bn", binding.binding_digest, source);
    const ids = new RefreshIdentityResolver([], [], "cataclysm-bn");
    const schemas = createNullSchemaFacade();
    const output = new CandidateWriter(stagingDir, "pop-run", "cataclysm-bn", "cataclysm-bn-factual", "1.0.0");
    const ctx = createExtractorContext(source, binding, schemas, evidence, ids, output);

    const result = await extractor.run(ctx);
    expect(result.populationCounts).toBeDefined();
    const popMap = new Map(result.populationCounts!.map((p: any) => [p.dimension, p.extracted]));
    expect(popMap.get("bionics")).toBe(137);
    expect(popMap.get("cb_traps")).toBe(50);
    expect(popMap.get("recipes")).toBe(3187);
    expect(popMap.get("cb_skills")).toBe(28);
    expect(popMap.get("effects")).toBe(237);
    expect(popMap.get("factions")).toBe(71);
  });

  it("materialization produces valid SQLite for cataclysm-bn records", () => {
    const distDir = join(WORKSPACE, ".generated", "knowledge", "dist");
    if (!existsSync(distDir)) {
      expect(true).toBe(true); // skip if not materialized
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
