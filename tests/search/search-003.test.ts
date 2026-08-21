import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { setupSearchWorkspace, testId } from "./helpers";
import { InMemoryVectorIndex } from "@roguelike-games-ib/search";

const records = [
  {
    id: testId(1),
    key: "goblin",
    record_type: "creature",
    title: "Goblin",
    summary: "A small green creature",
    source_identity: { source_id: "src-a", native_id: "goblin", path: "data.json" },
  },
  {
    id: testId(2),
    key: "kobold",
    record_type: "creature",
    title: "Kobold",
    summary: "A small reptilian creature",
    source_identity: { source_id: "src-a", native_id: "kobold", path: "data.json" },
  },
  {
    id: testId(3),
    key: "dragon",
    record_type: "creature",
    title: "Dragon",
    summary: "A large winged creature",
    source_identity: { source_id: "src-b", native_id: "dragon", path: "data.json" },
  },
];

const keys = [
  { id: testId(1), key: "goblin", record_type: "creature" },
  { id: testId(2), key: "kobold", record_type: "creature" },
  { id: testId(3), key: "dragon", record_type: "creature" },
];

function makeMockVectorIndex(): InMemoryVectorIndex {
  return new InMemoryVectorIndex({
    modelId: "mock-model",
    provider: "test",
    dimensionality: 3,
    embedFn: async (text: string) => {
      if (text.includes("goblin")) return new Float32Array([1, 0, 0]);
      if (text.includes("kobold")) return new Float32Array([0, 1, 0]);
      if (text.includes("dragon")) return new Float32Array([0, 0, 1]);
      return new Float32Array([0, 0, 0]);
    },
  });
}

describe("SEARCH-003: hybrid scores expose components separately", () => {
  let setup: Awaited<ReturnType<typeof setupSearchWorkspace>>;

  beforeEach(async () => {
    setup = await setupSearchWorkspace({
      kbId: "search003-test",
      records,
      keys,
    });
  });

  afterEach(() => {
    setup.cleanup();
  });

  it("each hit has lexical_score, vector_score, graph_boost, final_score", async () => {
    const result = await setup.index.search({ text: "goblin", limit: 10 });
    expect(result.hits.length).toBeGreaterThan(0);

    for (const hit of result.hits) {
      expect(hit.scores).toHaveProperty("lexical_score");
      expect(hit.scores).toHaveProperty("vector_score");
      expect(hit.scores).toHaveProperty("graph_boost");
      expect(hit.scores).toHaveProperty("final_score");
      expect(typeof hit.scores.lexical_score).toBe("number");
      expect(typeof hit.scores.vector_score).toBe("number");
      expect(typeof hit.scores.graph_boost).toBe("number");
      expect(typeof hit.scores.final_score).toBe("number");
    }
  });

  it("final_score equals sum of components", async () => {
    const result = await setup.index.search({ text: "creature", limit: 10 });
    for (const hit of result.hits) {
      const sum = hit.scores.lexical_score + hit.scores.vector_score + hit.scores.graph_boost;
      expect(hit.scores.final_score).toBeCloseTo(sum, 5);
    }
  });

  it("lexical-only hit has zero vector_score", async () => {
    const result = await setup.index.search({ text: "creature", limit: 10 });
    const lexicalOnly = result.hits.find(
      (h) => h.scores.lexical_score !== 0 && h.scores.vector_score === 0,
    );
    expect(lexicalOnly).toBeDefined();
  });
});
