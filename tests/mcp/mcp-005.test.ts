import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { setupMcpWorkspace, testId, type TestSetup } from "./helpers";
import { createMcpToolRegistry, REQUIRED_TOOLS } from "@roguelike-games-ib/mcp";

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

describe("MCP-005: arbitrary source file access impossible", () => {
  let setup: TestSetup;

  beforeEach(async () => {
    setup = await setupMcpWorkspace({
      kbId: "mcp005-test",
      records,
      keys,
      bindings,
    });
  });

  afterEach(() => setup.cleanup());

  it("no tool name suggests file access capability", () => {
    const registry = createMcpToolRegistry();
    const toolNames = registry.list().map((t) => t.name);

    const forbiddenPatterns = ["read_file", "read_source", "get_file", "list_files", "browse", "fs", "filesystem", "open_file"];
    for (const pattern of forbiddenPatterns) {
      for (const name of toolNames) {
        expect(name.toLowerCase()).not.toContain(pattern);
      }
    }
  });

  it("no tool accepts a file path parameter", () => {
    const registry = createMcpToolRegistry();
    for (const tool of registry.list()) {
      const props = (tool.inputSchema.properties ?? {}) as Record<string, unknown>;
      const propNames = Object.keys(props);
      for (const propName of propNames) {
        const lower = propName.toLowerCase();
        expect(lower).not.toContain("path");
        expect(lower).not.toContain("file");
        expect(lower).not.toContain("filename");
      }
    }
  });

  it("get_evidence does not expose raw artifact file content", async () => {
    const { getEvidence } = await import("@roguelike-games-ib/mcp");
    const store = setup.ctx.store as unknown as { evidence: Array<{ id: string }> };
    const evidence = store.evidence;
    if (evidence.length > 0) {
      const result = await getEvidence(setup.ctx, { evidence_id: evidence[0].id });
      expect(result.data.artifact_path).not.toContain("..");
      expect(result.data).not.toHaveProperty("file_content");
      expect(result.data).not.toHaveProperty("raw_bytes");
    }
  });

  it("all required tools are semantic, not filesystem-oriented", () => {
    for (const name of REQUIRED_TOOLS) {
      expect(name).not.toMatch(/file|path|fs|dir|browse/i);
    }
  });
});
