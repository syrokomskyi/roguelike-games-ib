import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { setupMcpWorkspace, testId, type TestSetup } from "./helpers";
import { traverseRelations } from "@roguelike-games-ib/mcp";
import { ValidationError } from "@roguelike-games-ib/mcp";

const records = [
  { id: testId(1), key: "goblin", record_type: "creature", title: "Goblin", source_identity: { source_id: "src-a", native_id: "goblin", path: "data.json" } },
  { id: testId(2), key: "kobold", record_type: "creature", title: "Kobold", source_identity: { source_id: "src-a", native_id: "kobold", path: "data.json" } },
  { id: testId(3), key: "dragon", record_type: "creature", title: "Dragon", source_identity: { source_id: "src-a", native_id: "dragon", path: "data.json" } },
  { id: testId(4), key: "wraith", record_type: "creature", title: "Wraith", source_identity: { source_id: "src-a", native_id: "wraith", path: "data.json" } },
];

const keys = [
  { id: testId(1), key: "goblin", record_type: "creature" },
  { id: testId(2), key: "kobold", record_type: "creature" },
  { id: testId(3), key: "dragon", record_type: "creature" },
  { id: testId(4), key: "wraith", record_type: "creature" },
];

const relations = [
  { id: "rel-001", relation_type: "similar_to", source_record_id: testId(1), target_record_id: testId(2), relation_scope: "game", evidence_refs: [] },
  { id: "rel-002", relation_type: "similar_to", source_record_id: testId(2), target_record_id: testId(3), relation_scope: "game", evidence_refs: [] },
  { id: "rel-003", relation_type: "similar_to", source_record_id: testId(3), target_record_id: testId(4), relation_scope: "game", evidence_refs: [] },
];

const bindings = [{
  source_id: "src-a",
  source_unit_path: "src-a",
  declared_version: "1.0.0",
  version_scheme: "semver",
  metadata_origin: "package.json",
  fingerprint: { algorithm: "sha256-tree-v1", value: "abc123" },
  vcs: null,
  binding_digest: "abc123",
}];

describe("MCP-007: traversal depth hard max enforced", () => {
  let setup: TestSetup;

  beforeEach(async () => {
    setup = await setupMcpWorkspace({
      kbId: "mcp007-test",
      records,
      keys,
      relations,
      bindings,
    });
  });

  afterEach(() => setup.cleanup());

  it("depth 1 returns only direct neighbors", async () => {
    const result = await traverseRelations(setup.ctx, { record_id: testId(1), depth: 1 });
    expect(result.data.edges).toHaveLength(1);
    expect(result.data.edges[0].record_key).toBe("kobold");
    expect(result.data.edges[0].depth).toBe(1);
  });

  it("depth 2 returns neighbors and their neighbors", async () => {
    const result = await traverseRelations(setup.ctx, { record_id: testId(1), depth: 2 });
    const keys = result.data.edges.map((e) => e.record_key);
    expect(keys).toContain("kobold");
    expect(keys).toContain("dragon");
    expect(result.data.edges.some((e) => e.depth === 2)).toBe(true);
  });

  it("depth 3 returns up to 3 hops", async () => {
    const result = await traverseRelations(setup.ctx, { record_id: testId(1), depth: 3 });
    const keys = result.data.edges.map((e) => e.record_key);
    expect(keys).toContain("kobold");
    expect(keys).toContain("dragon");
    expect(keys).toContain("wraith");
  });

  it("depth 4 is clamped to hard max 3", async () => {
    const result = await traverseRelations(setup.ctx, { record_id: testId(1), depth: 4 });
    expect(result.data.max_depth).toBe(3);
    const keys = result.data.edges.map((e) => e.record_key);
    expect(keys).toContain("wraith");
  });

  it("depth 0 throws ValidationError", async () => {
    await expect(traverseRelations(setup.ctx, { record_id: testId(1), depth: 0 })).rejects.toThrow(ValidationError);
  });

  it("depth negative throws ValidationError", async () => {
    await expect(traverseRelations(setup.ctx, { record_id: testId(1), depth: -1 })).rejects.toThrow(ValidationError);
  });
});
