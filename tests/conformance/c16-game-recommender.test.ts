import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { setupMcpWorkspace, testId, type TestSetup } from "../mcp/helpers";
import {
  createMcpToolRegistry,
  assertNoWriteTools,
  REQUIRED_TOOLS,
  recommendGames,
} from "@roguelike-games-ib/mcp";

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

const records = [
  {
    id: id1, key: "cross-game/concept/design-permadeath", record_type: "concept", title: "Permadeath",
    concept_type: "design_primitive", definition: "character death is permanent",
    ancestry: { derived_from: [], source_games: ["crawl", "broguece"] },
    quality_score: { coverage: 0.9, evidence: 0.8, richness: 0.7, overall: 0.8 },
  },
  {
    id: id2, key: "cross-game/concept/design-identification_system", record_type: "concept", title: "Identification System",
    concept_type: "design_primitive", definition: "items have unknown properties until identified",
    ancestry: { derived_from: [], source_games: ["crawl", "nethack"] },
    quality_score: { coverage: 0.8, evidence: 0.7, richness: 0.6, overall: 0.7 },
  },
  {
    id: id3, key: "cross-game/concept/design-procedural_generation", record_type: "concept", title: "Procedural Generation",
    concept_type: "design_primitive", definition: "levels are generated algorithmically",
    ancestry: { derived_from: [], source_games: ["crawl", "broguece"] },
    quality_score: null,
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
    games_where_present: ["crawl", "nethack"],
    games_where_absent: ["broguece"],
    member_primitives: ["cross-game/concept/design-identification_system", "cross-game/concept/design-permadeath", "cross-game/concept/design-procedural_generation"],
    quality_score: { coverage: 0.9, evidence: 0.8, richness: 0.7, overall: 0.85 },
  },
  {
    id: id9, key: "cross-game/concept/design-inventory_management", record_type: "concept", title: "Inventory Management",
    concept_type: "design_primitive", definition: "managing limited inventory space",
    ancestry: { derived_from: [], source_games: ["crawl", "nethack"] },
  },
  {
    id: id10, key: "cross-game/concept/design-skill_training", record_type: "concept", title: "Skill Training",
    concept_type: "design_primitive", definition: "training skills through repetition",
    ancestry: { derived_from: [], source_games: ["crawl", "nethack"] },
  },
];

const keys = records.map((r) => ({ id: r.id, key: r.key, record_type: r.record_type }));

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

describe("C16: Game recommender (RFC-0016)", () => {
  let setup: TestSetup;

  beforeEach(async () => {
    setup = await setupMcpWorkspace({
      kbId: "c16-test",
      records,
      keys,
      bindings,
    });
  });

  afterEach(() => setup.cleanup());

  it("recommend_games is in REQUIRED_TOOLS", () => {
    expect(REQUIRED_TOOLS).toContain("recommend_games");
  });

  it("recommend_games is registered in the tool registry", () => {
    const registry = createMcpToolRegistry();
    expect(registry.has("recommend_games")).toBe(true);
  });

  it("recommend_games is read-only", () => {
    const registry = createMcpToolRegistry();
    const violations = assertNoWriteTools(registry);
    expect(violations).toEqual([]);
  });

  it("returns ranked recommendations for known sensations", async () => {
    const result = await recommendGames(setup.ctx, { sensations: ["dread"] });
    const data = result.data as { recommendations: Array<{ source_id: string; score: number; matched_patterns: unknown[]; matched_primitives: unknown[]; rationale: string }>; total: number };

    expect(data.total).toBeGreaterThan(0);
    expect(data.recommendations.length).toBeGreaterThan(0);

    const first = data.recommendations[0];
    expect(first.source_id).toBeTruthy();
    expect(first.score).toBeGreaterThan(0);
    expect(first.score).toBeLessThanOrEqual(1);
    expect(first.matched_patterns).toBeDefined();
    expect(first.matched_primitives).toBeDefined();
    expect(first.rationale).toContain(first.source_id);
    expect(first.rationale).toContain("%");
  });

  it("recommendations are sorted by score descending", async () => {
    const result = await recommendGames(setup.ctx, { sensations: ["dread", "discovery"] });
    const data = result.data as { recommendations: Array<{ score: number }> };

    for (let i = 1; i < data.recommendations.length; i++) {
      expect(data.recommendations[i - 1].score).toBeGreaterThanOrEqual(data.recommendations[i].score);
    }
  });

  it("handles unknown sensation without throwing", async () => {
    const result = await recommendGames(setup.ctx, { sensations: ["boredom"] });
    const data = result.data as { recommendations: unknown[]; total: number };

    expect(data).toBeDefined();
    expect(data.total).toBeGreaterThanOrEqual(0);
  });

  it("handles empty sensations array", async () => {
    const result = await recommendGames(setup.ctx, { sensations: [] });
    const data = result.data as { recommendations: unknown[]; total: number };

    expect(data.recommendations).toEqual([]);
    expect(data.total).toBe(0);
  });

  it("uses weight=1.0 fallback for concepts without quality_score", async () => {
    const result = await recommendGames(setup.ctx, { sensations: ["dread"] });
    const data = result.data as { recommendations: Array<{ source_id: string; score: number }> };

    const broguece = data.recommendations.find((r) => r.source_id === "broguece");
    if (broguece) {
      expect(broguece.score).toBeGreaterThan(0);
    }

    const crawl = data.recommendations.find((r) => r.source_id === "crawl");
    expect(crawl).toBeDefined();
    expect(crawl!.score).toBeGreaterThan(0);
  });

  it("respects min_score filter", async () => {
    const result = await recommendGames(setup.ctx, { sensations: ["dread"], min_score: 0.99 });
    const data = result.data as { recommendations: Array<{ score: number }> };

    for (const rec of data.recommendations) {
      expect(rec.score).toBeGreaterThanOrEqual(0.99);
    }
  });

  it("respects limit parameter", async () => {
    const result = await recommendGames(setup.ctx, { sensations: ["dread"], limit: 1 });
    const data = result.data as { recommendations: unknown[]; total: number };

    expect(data.recommendations.length).toBeLessThanOrEqual(1);
  });

  it("rationale contains pattern details when patterns match", async () => {
    const result = await recommendGames(setup.ctx, { sensations: ["dread"] });
    const data = result.data as { recommendations: Array<{ source_id: string; rationale: string; matched_patterns: Array<{ key: string; title: string }> }> };

    const crawl = data.recommendations.find((r) => r.source_id === "crawl");
    if (crawl && crawl.matched_patterns.length > 0) {
      expect(crawl.rationale).toContain("implements");
      expect(crawl.rationale).toContain("Knowledge Through Risk");
    }
  });
});
