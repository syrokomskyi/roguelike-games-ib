import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { setupMcpWorkspace, testId, type TestSetup } from "./helpers";
import { getRecord } from "@roguelike-games-ib/mcp";

const records = [
  { id: testId(1), key: "goblin", record_type: "creature", title: "Goblin", source_identity: { source_id: "src-a", native_id: "goblin", path: "data.json" } },
  { id: testId(2), key: "kobold", record_type: "creature", title: "Kobold", source_identity: { source_id: "src-a", native_id: "kobold", path: "data.json" } },
];

const keys = [
  { id: testId(1), key: "goblin", record_type: "creature" },
  { id: testId(2), key: "kobold", record_type: "creature" },
];

const aliases = [
  { key: "gremlin", retired_to: "goblin", retired_at: "2026-01-01T00:00:00Z" },
];

describe("MCP-002: get_record by id and key agrees", () => {
  let setup: TestSetup;

  beforeEach(async () => {
    setup = await setupMcpWorkspace({
      kbId: "mcp002-test",
      records,
      keys,
      aliases,
      bindings: [{ source_id: "src-a", source_unit_path: "src-a", declared_version: "1.0.0", version_scheme: "semver", metadata_origin: "package.json", fingerprint: { algorithm: "sha256-tree-v1", value: "abc123" }, vcs: null, binding_digest: "abc123" }],
    });
  });

  afterEach(() => setup.cleanup());

  it("get_record by id and by key return same record", () => {
    const byId = getRecord(setup.ctx, { id: testId(1) });
    const byKey = getRecord(setup.ctx, { key: "goblin" });

    expect(byId.data.record_id).toBe(byKey.data.record_id);
    expect(byId.data.record_key).toBe(byKey.data.record_key);
    expect(byId.data.record).toEqual(byKey.data.record);
  });

  it("get_record by id and by key agree for second record", () => {
    const byId = getRecord(setup.ctx, { id: testId(2) });
    const byKey = getRecord(setup.ctx, { key: "kobold" });

    expect(byId.data.record_id).toBe(testId(2));
    expect(byKey.data.record_id).toBe(testId(2));
    expect(byId.data.record).toEqual(byKey.data.record);
  });

  it("response includes dataset and authority metadata", () => {
    const result = getRecord(setup.ctx, { key: "goblin" });
    expect(result.dataset.canonical_hash).toBe(setup.canonicalHash);
    expect(result.dataset.license).toBe("CC-BY-4.0");
    expect(result.authority).toBe("canonical");
  });
});
