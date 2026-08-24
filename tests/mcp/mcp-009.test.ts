import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { setupMcpWorkspace, testId, type TestSetup } from "./helpers";
import { getDatasetInfo } from "@roguelike-games-ib/mcp";

const records = [
  { id: testId(1), key: "goblin", record_type: "creature", title: "Goblin", source_identity: { source_id: "src-a", native_id: "goblin", path: "data.json" } },
];

const keys = [{ id: testId(1), key: "goblin", record_type: "creature" }];

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

describe("MCP-009: MCP exposes CC-BY-4.0 metadata", () => {
  let setup: TestSetup;

  beforeEach(async () => {
    setup = await setupMcpWorkspace({
      kbId: "mcp009-test",
      records,
      keys,
      bindings,
    });
  });

  afterEach(() => setup.cleanup());

  it("get_dataset_info returns CC-BY-4.0 license", async () => {
    const result = await getDatasetInfo(setup.ctx);
    expect(result.data.license).toBe("CC-BY-4.0");
  });

  it("response envelope includes license", async () => {
    const result = await getDatasetInfo(setup.ctx);
    expect(result.dataset.license).toBe("CC-BY-4.0");
  });

  it("response envelope includes canonical hash", async () => {
    const result = await getDatasetInfo(setup.ctx);
    expect(result.dataset.canonical_hash).toBe(setup.canonicalHash);
  });

  it("dataset info includes source count and record counts", async () => {
    const result = await getDatasetInfo(setup.ctx);
    expect(result.data.source_count).toBe(1);
    expect(result.data.record_counts).toBeTruthy();
    expect(result.data.total_records).toBeGreaterThan(0);
  });
});
