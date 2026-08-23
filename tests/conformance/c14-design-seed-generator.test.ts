import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { setupMcpWorkspace, testId, type TestSetup } from "../mcp/helpers";
import {
  createMcpToolRegistry,
  assertNoWriteTools,
  REQUIRED_TOOLS,
  generateDesignSeed,
  ValidationError,
} from "@roguelike-games-ib/mcp";
import { SENSATION_MAP } from "../../apps/mcp/src/tools/sensation-map";

const WORKSPACE = resolve(__dirname, "../..");
const CANONICAL_ROOT = join(WORKSPACE, "knowledge");

function readConceptKeys(): Set<string> {
  const keys = new Set<string>();
  const conceptDir = join(CANONICAL_ROOT, "concept");
  if (!existsSync(conceptDir)) return keys;
  function walk(d: string) {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        walk(join(d, entry.name));
      } else if (entry.name.endsWith(".jsonl")) {
        const text = readFileSync(join(d, entry.name), "utf-8");
        for (const line of text.split("\n").filter(Boolean)) {
          const record = JSON.parse(line);
          if (record.key) keys.add(record.key);
        }
      }
    }
  }
  walk(conceptDir);
  return keys;
}

const id1 = testId(1);
const id2 = testId(2);
const id3 = testId(3);
const id4 = testId(4);
const id5 = testId(5);
const id6 = testId(6);
const id7 = testId(7);
const id8 = testId(8);
const id9 = testId(9);
const id10 = testId(10);
const id11 = testId(11);

const records = [
  {
    id: id1, key: "cross-game/concept/design-permadeath", record_type: "concept", title: "Permadeath",
    concept_type: "design_primitive", definition: "character death is permanent",
    ancestry: { derived_from: [], source_games: ["crawl", "broguece"] },
    concrete_examples: [{ game: "crawl", description: "Death ends the run permanently" }],
  },
  {
    id: id2, key: "cross-game/concept/design-identification_system", record_type: "concept", title: "Identification System",
    concept_type: "design_primitive", definition: "items have unknown properties until identified",
    ancestry: { derived_from: [], source_games: ["crawl", "nethack"] },
  },
  {
    id: id3, key: "cross-game/concept/design-procedural_generation", record_type: "concept", title: "Procedural Generation",
    concept_type: "design_primitive", definition: "levels are generated algorithmically",
    ancestry: { derived_from: [], source_games: ["crawl", "broguece"] },
  },
  {
    id: id4, key: "cross-game/concept/pressure-risk_of_loss", record_type: "concept", title: "Risk of Loss",
    concept_type: "design_pressure", definition: "the possibility of losing progress",
    ancestry: { derived_from: [], source_games: ["crawl"] },
  },
  {
    id: id5, key: "cross-game/concept/pressure-risk_aversion", record_type: "concept", title: "Risk Aversion",
    concept_type: "design_pressure", definition: "player tendency to avoid risky actions",
    ancestry: { derived_from: [], source_games: ["crawl"] },
  },
  {
    id: id6, key: "cross-game/concept/pressure-unfairness_risk", record_type: "concept", title: "Unfairness Risk",
    concept_type: "design_pressure", definition: "the possibility of unwinnable situations",
    ancestry: { derived_from: [], source_games: ["crawl"] },
  },
  {
    id: id7, key: "cross-game/concept/design-hunger_clock", record_type: "concept", title: "Hunger Clock",
    concept_type: "design_primitive", definition: "a timer that forces the player to keep moving",
    ancestry: { derived_from: [], source_games: ["crawl", "nethack"] },
  },
  {
    id: id8, key: "cross-game/concept/pattern-knowledge_through_risk", record_type: "concept", title: "Knowledge Through Risk",
    concept_type: "design_pattern", definition: "gaining information requires taking risks",
    ancestry: { derived_from: [], source_games: ["crawl", "nethack"] },
  },
  {
    id: id9, key: "cross-game/concept/mutation-identification_approach", record_type: "concept", title: "Identification Approach",
    concept_type: "mutation_vector", definition: "how identification is triggered",
    ancestry: { derived_from: [], source_games: ["crawl", "nethack"] },
  },
  {
    id: id10, key: "cross-game/concept/knob-identification_system-identification_methods-scroll_identify", record_type: "concept", title: "Scroll Identify",
    concept_type: "design_knob", definition: "identification via consumable scroll",
    ancestry: { derived_from: [], source_games: ["nethack"] },
  },
  {
    id: id11, key: "cross-game/concept/design-inventory_management", record_type: "concept", title: "Inventory Management",
    concept_type: "design_primitive", definition: "managing limited inventory space",
    ancestry: { derived_from: [], source_games: ["crawl", "nethack"] },
  },
];

const keys = records.map((r) => ({ id: r.id, key: r.key, record_type: r.record_type }));

const relations = [
  {
    id: testId(20), source_record_id: id1, target_record_id: id9,
    relation_type: "HAS_MUTATION_VECTOR", relation_scope: "design", evidence_refs: [],
  },
  {
    id: testId(21), source_record_id: id9, target_record_id: id10,
    relation_type: "IMPLEMENTED_AS", relation_scope: "design", evidence_refs: [],
  },
  {
    id: testId(22), source_record_id: id4, target_record_id: id5,
    relation_type: "tensions_with", relation_scope: "design", evidence_refs: [],
    qualifiers: { rationale: "Risk of loss creates tension with risk aversion" },
  },
];

const bindings = [
  {
    source_id: "crawl", source_unit_path: "crawl", declared_version: "1.0.0",
    version_scheme: "semver", metadata_origin: "package.json",
    fingerprint: { algorithm: "sha256-tree-v1", value: "abc123" },
    vcs: null, binding_digest: "abc123",
  },
  {
    source_id: "nethack", source_unit_path: "nethack", declared_version: "1.0.0",
    version_scheme: "semver", metadata_origin: "package.json",
    fingerprint: { algorithm: "sha256-tree-v1", value: "def456" },
    vcs: null, binding_digest: "def456",
  },
  {
    source_id: "broguece", source_unit_path: "broguece", declared_version: "1.0.0",
    version_scheme: "semver", metadata_origin: "package.json",
    fingerprint: { algorithm: "sha256-tree-v1", value: "ghi789" },
    vcs: null, binding_digest: "ghi789",
  },
];

describe("C14: Design seed generator (RFC-0013)", () => {
  let setup: TestSetup;

  beforeEach(async () => {
    setup = await setupMcpWorkspace({
      kbId: "c14-test",
      records,
      keys,
      relations,
      bindings,
    });
  });

  afterEach(() => setup.cleanup());

  it("SENSATION_MAP has 15 entries", () => {
    expect(Object.keys(SENSATION_MAP).length).toBe(15);
  });

  it("all SENSATION_MAP keys resolve to existing concept records in the knowledge base", () => {
    const conceptKeys = readConceptKeys();
    if (conceptKeys.size === 0) return; // skip if knowledge base not present
    const allKeys = new Set<string>();
    for (const entry of Object.values(SENSATION_MAP)) {
      for (const k of entry.primitives) allKeys.add(k);
      for (const k of entry.pressures) allKeys.add(k);
      for (const k of entry.patterns) allKeys.add(k);
    }
    for (const key of allKeys) {
      expect(conceptKeys.has(key), `SENSATION_MAP key "${key}" not found in knowledge/concept/`).toBe(true);
    }
  });

  it("registers generate_design_seed tool", () => {
    const registry = createMcpToolRegistry();
    expect(registry.has("generate_design_seed")).toBe(true);
  });

  it("tool is in REQUIRED_TOOLS", () => {
    expect(REQUIRED_TOOLS).toContain("generate_design_seed");
  });

  it("tool is read-only", () => {
    const registry = createMcpToolRegistry();
    const violations = assertNoWriteTools(registry);
    expect(violations).not.toContain("generate_design_seed");
  });

  it("generates dossier for known sensation 'dread'", async () => {
    const result = await generateDesignSeed(setup.ctx, { sensation: "dread" });
    const data = result.data as {
      sensation: string;
      dossier: {
        relevant_primitives: { key: string }[];
        relevant_pressures: { key: string }[];
        ancestry_trail: { step: number; type: string }[];
      };
    };
    expect(data.sensation).toBe("dread");
    expect(data.dossier.relevant_primitives.length).toBeGreaterThan(0);
    expect(data.dossier.relevant_pressures.length).toBeGreaterThan(0);
    const primKeys = data.dossier.relevant_primitives.map((p) => p.key);
    expect(primKeys).toContain("cross-game/concept/design-permadeath");
  });

  it("returns dossier with mutation vectors and ancestry trail", async () => {
    const result = await generateDesignSeed(setup.ctx, { sensation: "dread" });
    const data = result.data as {
      dossier: {
        mutation_vectors: { key: string; title: string; available_knobs: string[] }[];
        ancestry_trail: { step: number; type: string; ref: string }[];
      };
    };
    expect(data.dossier.mutation_vectors.length).toBeGreaterThan(0);
    expect(data.dossier.ancestry_trail.length).toBeGreaterThan(0);
    const trailTypes = data.dossier.ancestry_trail.map((t) => t.type);
    expect(trailTypes).toContain("source_structure");
    expect(trailTypes).toContain("mutation");
    expect(trailTypes).toContain("possibility");
  });

  it("returns concrete examples from primitives", async () => {
    const result = await generateDesignSeed(setup.ctx, { sensation: "dread" });
    const data = result.data as {
      dossier: { concrete_examples: { game: string; primitive: string; example: string }[] };
    };
    expect(data.dossier.concrete_examples.length).toBeGreaterThan(0);
    const example = data.dossier.concrete_examples[0];
    expect(example.game).toBeTruthy();
    expect(example.primitive).toBeTruthy();
    expect(example.example).toBeTruthy();
  });

  it("returns design tensions from pressures", async () => {
    const result = await generateDesignSeed(setup.ctx, { sensation: "dread" });
    const data = result.data as {
      dossier: { design_tensions: { tension: string; description: string }[] };
    };
    expect(data.dossier.design_tensions.length).toBeGreaterThan(0);
    expect(data.dossier.design_tensions[0].tension).toContain("↔");
  });

  it("filters excluded mechanics from results", async () => {
    const result = await generateDesignSeed(setup.ctx, {
      sensation: "dread",
      excluded: ["permadeath"],
    });
    const data = result.data as {
      dossier: {
        relevant_primitives: { key: string }[];
        excluded_mechanics_filtered: { requested_exclusion: string; filtered_concepts: string[] }[];
      };
    };
    const primKeys = data.dossier.relevant_primitives.map((p) => p.key);
    expect(primKeys).not.toContain("cross-game/concept/design-permadeath");
    expect(data.dossier.excluded_mechanics_filtered.length).toBeGreaterThan(0);
  });

  it("handles empty dossier when all primitives are excluded", async () => {
    const result = await generateDesignSeed(setup.ctx, {
      sensation: "dread",
      excluded: ["permadeath", "identification", "procedural"],
    });
    const data = result.data as {
      dossier: {
        relevant_primitives: { key: string }[];
        relevant_pressures: { key: string }[];
      };
    };
    expect(data.dossier.relevant_primitives.length).toBe(0);
  });

  it("throws ValidationError for missing sensation", async () => {
    await expect(
      generateDesignSeed(setup.ctx, { sensation: "" }),
    ).rejects.toThrow(ValidationError);
  });

  it("falls back to semantic search for unknown sensation", async () => {
    const result = await generateDesignSeed(setup.ctx, { sensation: "curiosity" });
    const data = result.data as {
      sensation: string;
      dossier: { relevant_primitives: unknown[] };
    };
    expect(data.sensation).toBe("curiosity");
  });
});
