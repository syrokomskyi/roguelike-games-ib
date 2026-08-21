import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { setupSearchWorkspace, testId } from "./helpers";

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
    key: "fireball",
    record_type: "mechanic",
    title: "Fireball",
    summary: "A spell that deals fire damage",
    source_identity: { source_id: "src-b", native_id: "fireball", path: "data.json" },
  },
  {
    id: testId(4),
    key: "sword",
    record_type: "mechanic",
    title: "Sword Strike",
    summary: "A melee weapon attack",
    source_identity: { source_id: "src-b", native_id: "sword", path: "data.json" },
  },
];

const relations = [
  {
    id: testId(20),
    relation_type: "similar_to",
    source_record_id: testId(1),
    target_record_id: testId(2),
    relation_scope: "game",
    evidence_refs: [],
  },
  {
    id: testId(21),
    relation_type: "implements",
    source_record_id: testId(1),
    target_record_id: testId(3),
    relation_scope: "game",
    evidence_refs: [],
  },
  {
    id: testId(22),
    relation_type: "related_to",
    source_record_id: testId(4),
    target_record_id: testId(3),
    relation_scope: "game",
    evidence_refs: [],
  },
];

const keys = [
  { id: testId(1), key: "goblin", record_type: "creature" },
  { id: testId(2), key: "kobold", record_type: "creature" },
  { id: testId(3), key: "fireball", record_type: "mechanic" },
  { id: testId(4), key: "sword", record_type: "mechanic" },
];

describe("SEARCH-005: graph expansion uses typed canonical edges only", () => {
  let setup: Awaited<ReturnType<typeof setupSearchWorkspace>>;

  beforeEach(async () => {
    setup = await setupSearchWorkspace({
      kbId: "search005-test",
      records,
      relations,
      keys,
    });
  });

  afterEach(() => {
    setup.cleanup();
  });

  it("expands from goblin to kobold (similar_to) and fireball (implements)", () => {
    const result = setup.index.graphExpand(testId(1));
    expect(result.rootId).toBe(testId(1));
    expect(result.edges.length).toBe(2);

    const edgeKeys = result.edges.map((e) => e.recordKey).sort();
    expect(edgeKeys).toEqual(["fireball", "kobold"]);
  });

  it("edges have relation type and direction", () => {
    const result = setup.index.graphExpand(testId(1));
    for (const edge of result.edges) {
      expect(edge.relationType).toBeTruthy();
      expect(["outgoing", "incoming"]).toContain(edge.direction);
    }
  });

  it("filters by relation type", () => {
    const result = setup.index.graphExpand(testId(1), {
      relationTypes: ["similar_to"],
    });
    expect(result.edges.length).toBe(1);
    expect(result.edges[0].recordKey).toBe("kobold");
    expect(result.edges[0].relationType).toBe("similar_to");
  });

  it("incoming direction finds reverse edges", () => {
    const result = setup.index.graphExpand(testId(3), {
      direction: "incoming",
    });
    expect(result.edges.length).toBe(2);
    const keys = result.edges.map((e) => e.recordKey).sort();
    expect(keys).toEqual(["goblin", "sword"]);
  });

  it("does not invent edges — only canonical relations are followed", () => {
    const result = setup.index.graphExpand(testId(2), { direction: "both" });
    expect(result.edges.length).toBe(1);
    expect(result.edges[0].recordKey).toBe("goblin");
  });

  it("maxDepth=1 does not traverse beyond direct neighbors", () => {
    const result = setup.index.graphExpand(testId(4), { maxDepth: 1 });
    expect(result.edges.length).toBe(1);
    expect(result.edges[0].recordKey).toBe("fireball");
  });

  it("maxDepth=2 traverses two hops", () => {
    const result = setup.index.graphExpand(testId(4), { maxDepth: 2 });
    expect(result.edges.length).toBeGreaterThanOrEqual(2);
    const keys = result.edges.map((e) => e.recordKey);
    expect(keys).toContain("fireball");
    expect(keys).toContain("goblin");
  });
});
