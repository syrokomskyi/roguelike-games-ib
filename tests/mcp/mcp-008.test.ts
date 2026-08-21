import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { setupMcpWorkspace, testId, type TestSetup } from "./helpers";
import { searchRecords } from "@roguelike-games-ib/mcp";

const records = [
  { id: testId(1), key: "goblin", record_type: "creature", title: "Goblin", summary: "A small green creature", source_identity: { source_id: "src-a", native_id: "goblin", path: "data.json" } },
  { id: testId(2), key: "kobold", record_type: "creature", title: "Kobold", summary: "A small reptilian creature", source_identity: { source_id: "src-a", native_id: "kobold", path: "data.json" } },
];

const keys = [
  { id: testId(1), key: "goblin", record_type: "creature" },
  { id: testId(2), key: "kobold", record_type: "creature" },
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

describe("MCP-008: search score not represented as confidence", () => {
  let setup: TestSetup;

  beforeEach(async () => {
    setup = await setupMcpWorkspace({
      kbId: "mcp008-test",
      records,
      keys,
      bindings,
    });
  });

  afterEach(() => setup.cleanup());

  it("search result includes score disclaimer", async () => {
    const result = await searchRecords(setup.ctx, { query: "creature" });
    expect(result.data.score_disclaimer).toBeTruthy();
    expect(result.data.score_disclaimer).toContain("not confidence");
  });

  it("scores are labeled as relevance signals, not confidence", async () => {
    const result = await searchRecords(setup.ctx, { query: "creature" });
    for (const hit of result.data.hits) {
      expect(hit.scores).toHaveProperty("lexical_score");
      expect(hit.scores).toHaveProperty("vector_score");
      expect(hit.scores).toHaveProperty("graph_boost");
      expect(hit.scores).toHaveProperty("final_score");
      expect(hit.scores).not.toHaveProperty("confidence");
      expect(hit.scores).not.toHaveProperty("truth");
      expect(hit.scores).not.toHaveProperty("accuracy");
    }
  });

  it("response envelope includes authority=canonical", async () => {
    const result = await searchRecords(setup.ctx, { query: "creature" });
    expect(result.authority).toBe("canonical");
  });
});
