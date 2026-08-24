import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { setupMcpWorkspace, testId, type TestSetup } from "./helpers";
import {
  createMcpToolRegistry,
  assertNoWriteTools,
  REQUIRED_TOOLS,
  compareGames,
  getCoverageMatrix,
  getConceptCoverage,
  compareConceptImplementations,
  findConceptGaps,
} from "@roguelike-games-ib/mcp";

const id1 = testId(1);
const id2 = testId(2);
const id3 = testId(3);
const id4 = testId(4);
const id5 = testId(5);
const id6 = testId(6);
const id7 = testId(7);

const records = [
  {
    id: id1, key: "goblin", record_type: "creature", title: "Goblin",
    source_identity: { source_id: "src-a", native_id: "goblin", path: "data.json" },
    attributes: { flags: ["FIREPROOF", "COLDPROOF"], hp: 10 },
  },
  {
    id: id2, key: "dragon", record_type: "creature", title: "Dragon",
    source_identity: { source_id: "src-b", native_id: "dragon", path: "data.json" },
    attributes: { flags: ["FIREPROOF"], hp: 50 },
  },
  {
    id: id3, key: "ice-troll", record_type: "creature", title: "Ice Troll",
    source_identity: { source_id: "src-b", native_id: "ice_troll", path: "data.json" },
    attributes: { flags: ["COLDPROOF"], hp: 30 },
  },
  {
    id: id4, key: "fire-resistance", record_type: "concept", title: "Fire Resistance",
    concept_type: "cross_game_mechanic",
    implementation_refs: [id1, id2],
    ancestry: {
      derived_from: [id1, id2],
      source_games: ["src-a", "src-b"],
      observed_in: ["monsters.h resistance flags", "monsters.h conveys flags"],
    },
  },
  {
    id: id5, key: "shop-and-economy", record_type: "concept", title: "Shop and Economy",
    concept_type: "design_primitive",
    ancestry: { derived_from: [], source_games: ["src-a"] },
  },
  {
    id: id6, key: "permadeath", record_type: "concept", title: "Permadeath",
    concept_type: "design_primitive",
    ancestry: { derived_from: [], source_games: [] },
  },
  {
    id: id7, key: "cold-resistance", record_type: "concept", title: "Cold Resistance",
    concept_type: "cross_game_mechanic",
    implementation_refs: [id1, id3],
    ancestry: {
      derived_from: [id1, id3],
      source_games: ["src-a", "src-b"],
      observed_in: ["monsters.h resistance flags"],
    },
  },
];

const keys = records.map((r) => ({ id: r.id, key: r.key, record_type: r.record_type }));

const bindings = [
  {
    source_id: "src-a", source_unit_path: "src-a", declared_version: "1.0.0",
    version_scheme: "semver", metadata_origin: "package.json",
    fingerprint: { algorithm: "sha256-tree-v1", value: "abc123" },
    vcs: null, binding_digest: "abc123",
  },
  {
    source_id: "src-b", source_unit_path: "src-b", declared_version: "1.0.0",
    version_scheme: "semver", metadata_origin: "package.json",
    fingerprint: { algorithm: "sha256-tree-v1", value: "def456" },
    vcs: null, binding_digest: "def456",
  },
];

describe("MCP-012: cross-game analysis tools (RFC-0004)", () => {
  let setup: TestSetup;

  beforeEach(async () => {
    setup = await setupMcpWorkspace({
      kbId: "mcp012-test",
      records,
      keys,
      bindings,
    });
  });

  afterEach(() => setup.cleanup());

  // --- Tool registration ---

  it("registers all 4 new tools", () => {
    const registry = createMcpToolRegistry();
    expect(registry.has("get_coverage_matrix")).toBe(true);
    expect(registry.has("get_concept_coverage")).toBe(true);
    expect(registry.has("compare_concept_implementations")).toBe(true);
    expect(registry.has("find_concept_gaps")).toBe(true);
  });

  it("new tools are in REQUIRED_TOOLS", () => {
    expect(REQUIRED_TOOLS).toContain("get_coverage_matrix");
    expect(REQUIRED_TOOLS).toContain("get_concept_coverage");
    expect(REQUIRED_TOOLS).toContain("compare_concept_implementations");
    expect(REQUIRED_TOOLS).toContain("find_concept_gaps");
  });

  it("new tools are read-only", () => {
    const registry = createMcpToolRegistry();
    const violations = assertNoWriteTools(registry);
    expect(violations).toEqual([]);
  });

  it("new tool names do not contain write patterns", () => {
    const writePatterns = ["write", "mutate", "delete", "create", "update", "insert", "promote", "apply", "commit"];
    const newTools = ["get_coverage_matrix", "get_concept_coverage", "compare_concept_implementations", "find_concept_gaps"];
    for (const name of newTools) {
      for (const pattern of writePatterns) {
        expect(name.toLowerCase()).not.toContain(pattern);
      }
    }
  });

  it("each new tool has description and input schema", () => {
    const registry = createMcpToolRegistry();
    for (const name of ["get_coverage_matrix", "get_concept_coverage", "compare_concept_implementations", "find_concept_gaps"]) {
      const tool = registry.tools.get(name);
      expect(tool).toBeDefined();
      expect(tool!.description).toBeTruthy();
      expect(tool!.inputSchema.type).toBe("object");
    }
  });

  it("REQUIRED_TOOLS has 35 entries", () => {
    expect(REQUIRED_TOOLS).toHaveLength(35);
  });

  // --- D1: compare_games with include_concepts ---

  it("compare_games with include_concepts returns concept_coverage per game", () => {
    const result = compareGames(setup.ctx, { source_ids: ["src-a", "src-b"], include_concepts: true });
    const games = result.data.games as Array<Record<string, unknown>>;
    expect(games).toHaveLength(2);
    const gameA = games.find((g) => g.source_id === "src-a");
    expect(gameA).toBeDefined();
    expect(gameA!.concept_coverage).toBeDefined();
    const coverage = gameA!.concept_coverage as Record<string, unknown>;
    expect(coverage["cross_game_mechanic"]).toBeDefined();
    expect(coverage["cross_game_mechanic_count"]).toBe(2);
  });

  it("compare_games without include_concepts does not have concept_coverage", () => {
    const result = compareGames(setup.ctx, { source_ids: ["src-a", "src-b"] });
    const games = result.data.games as Array<Record<string, unknown>>;
    const gameA = games.find((g) => g.source_id === "src-a");
    expect(gameA!.concept_coverage).toBeUndefined();
  });

  // --- D2: get_coverage_matrix ---

  it("get_coverage_matrix returns correct counts", () => {
    const result = getCoverageMatrix(setup.ctx, {});
    expect(result.data.source_ids).toContain("src-a");
    expect(result.data.source_ids).toContain("src-b");
    expect(result.data.concept_types).toContain("cross_game_mechanic");
    expect(result.data.concept_types).toContain("design_primitive");
    const matrix = result.data.matrix as Record<string, Record<string, number>>;
    expect(matrix["src-a"]["cross_game_mechanic"]).toBe(2);
    expect(matrix["src-b"]["cross_game_mechanic"]).toBe(2);
    expect(matrix["src-a"]["design_primitive"]).toBe(1);
  });

  it("get_coverage_matrix includes all registered source_ids", () => {
    const result = getCoverageMatrix(setup.ctx, {});
    expect(result.data.source_ids).toHaveLength(2);
  });

  // --- D3: get_concept_coverage ---

  it("get_concept_coverage returns member counts and observed_in_notes per game", () => {
    const result = getConceptCoverage(setup.ctx, { key: "fire-resistance" });
    expect(result.data.concept.record_key).toBe("fire-resistance");
    const coverage = result.data.coverage_by_game as Record<string, Record<string, unknown>>;
    expect(coverage["src-a"]).toBeDefined();
    expect(coverage["src-a"].member_count).toBe(1);
    expect(coverage["src-b"].member_count).toBe(1);
    const observedIn = coverage["src-a"].observed_in_notes as string[];
    expect(observedIn).toContain("monsters.h resistance flags");
  });

  it("get_concept_coverage identifies gaps correctly", () => {
    const result = getConceptCoverage(setup.ctx, { key: "shop-and-economy" });
    expect(result.data.gaps).toContain("src-b");
    expect(result.data.gaps).not.toContain("src-a");
  });

  it("get_concept_coverage handles concept with no ancestry (no error)", () => {
    const result = getConceptCoverage(setup.ctx, { key: "permadeath" });
    expect(result.data.gaps).toContain("src-a");
    expect(result.data.gaps).toContain("src-b");
    const coverage = result.data.coverage_by_game as Record<string, Record<string, unknown>>;
    expect(coverage["src-a"].member_count).toBe(0);
    expect(coverage["src-b"].member_count).toBe(0);
  });

  it("get_concept_coverage works with record_id", () => {
    const result = getConceptCoverage(setup.ctx, { record_id: id4 });
    expect(result.data.concept.record_key).toBe("fire-resistance");
  });

  it("get_concept_coverage rejects non-concept record", () => {
    expect(() => getConceptCoverage(setup.ctx, { key: "goblin" })).toThrow();
  });

  // --- D4: compare_concept_implementations ---

  it("compare_concept_implementations returns summaries for games with curated notes", () => {
    const result = compareConceptImplementations(setup.ctx, { concept_key: "permadeath", source_ids: ["src-a"] });
    expect(result.data.concept.record_key).toBe("permadeath");
    const comparisons = result.data.comparisons as Array<Record<string, unknown>>;
    expect(comparisons).toHaveLength(1);
  });

  it("compare_concept_implementations returns null summary for games without curated notes", () => {
    const result = compareConceptImplementations(setup.ctx, { concept_key: "fire-resistance", source_ids: ["src-a"] });
    const comparisons = result.data.comparisons as Array<Record<string, unknown>>;
    expect(comparisons[0].implementation_summary).toBeNull();
  });

  it("compare_concept_implementations defaults to all sources", () => {
    const result = compareConceptImplementations(setup.ctx, { concept_key: "permadeath" });
    const comparisons = result.data.comparisons as Array<Record<string, unknown>>;
    expect(comparisons).toHaveLength(2);
  });

  it("compare_concept_implementations rejects non-concept record", () => {
    expect(() => compareConceptImplementations(setup.ctx, { concept_key: "goblin" })).toThrow();
  });

  // --- D5: find_concept_gaps ---

  it("find_concept_gaps identifies concepts missing from specific games", () => {
    const result = findConceptGaps(setup.ctx, {});
    const gaps = result.data.gaps as Array<Record<string, unknown>>;
    expect(gaps.length).toBeGreaterThan(0);
    const shopGap = gaps.find((g) => g.concept_key === "shop-and-economy");
    expect(shopGap).toBeDefined();
    expect(shopGap!.missing_from).toEqual(["src-b"]);
    expect(shopGap!.present_in).toEqual(["src-a"]);
  });

  it("find_concept_gaps filters by concept_type", () => {
    const result = findConceptGaps(setup.ctx, { concept_type: "design_primitive" });
    const gaps = result.data.gaps as Array<Record<string, unknown>>;
    for (const g of gaps) {
      expect(g.concept_type).toBe("design_primitive");
    }
  });

  it("find_concept_gaps filters by source_id", () => {
    const result = findConceptGaps(setup.ctx, { source_id: "src-b" });
    const gaps = result.data.gaps as Array<Record<string, unknown>>;
    for (const g of gaps) {
      expect((g.missing_from as string[])).toContain("src-b");
    }
  });

  it("find_concept_gaps summary has correct counts", () => {
    const result = findConceptGaps(setup.ctx, {});
    const summary = result.data.summary as Record<string, unknown>;
    expect(summary.total_concepts).toBe(4);
    expect(summary.concepts_with_gaps).toBeGreaterThan(0);
    const gamesWithMostGaps = summary.games_with_most_gaps as Array<[string, number]>;
    expect(gamesWithMostGaps.length).toBeGreaterThan(0);
  });

  it("find_concept_gaps handles concept with no ancestry as gap for all games", () => {
    const result = findConceptGaps(setup.ctx, { concept_type: "design_primitive" });
    const gaps = result.data.gaps as Array<Record<string, unknown>>;
    const permadeathGap = gaps.find((g) => g.concept_key === "permadeath");
    expect(permadeathGap).toBeDefined();
    expect((permadeathGap!.missing_from as string[]).sort()).toEqual(["src-a", "src-b"]);
  });
});
