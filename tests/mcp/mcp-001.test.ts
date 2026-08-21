import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { setupMcpWorkspace, testId, type TestSetup } from "./helpers";
import { createMcpToolRegistry, REQUIRED_TOOLS, assertNoWriteTools } from "@roguelike-games-ib/mcp";

describe("MCP-001: server exposes required read-only tools", () => {
  let setup: TestSetup;

  beforeEach(async () => {
    setup = await setupMcpWorkspace({
      kbId: "mcp001-test",
      records: [
        { id: testId(1), key: "goblin", record_type: "creature", title: "Goblin", source_identity: { source_id: "src-a", native_id: "goblin", path: "data.json" } },
      ],
      keys: [{ id: testId(1), key: "goblin", record_type: "creature" }],
      bindings: [{ source_id: "src-a", source_unit_path: "src-a", declared_version: "1.0.0", version_scheme: "semver", metadata_origin: "package.json", fingerprint: { algorithm: "sha256-tree-v1", value: "abc123" }, vcs: null, binding_digest: "abc123" }],
    });
  });

  afterEach(() => setup.cleanup());

  it("registers all required tools", () => {
    const registry = createMcpToolRegistry();
    for (const name of REQUIRED_TOOLS) {
      expect(registry.has(name), `Missing tool: ${name}`).toBe(true);
    }
  });

  it("all tools are read-only", () => {
    const registry = createMcpToolRegistry();
    const violations = assertNoWriteTools(registry);
    expect(violations).toEqual([]);
  });

  it("tool list includes all required names", () => {
    const registry = createMcpToolRegistry();
    const names = registry.list().map((t) => t.name);
    for (const required of REQUIRED_TOOLS) {
      expect(names).toContain(required);
    }
  });

  it("each tool has description and input schema", () => {
    const registry = createMcpToolRegistry();
    for (const tool of registry.list()) {
      expect(tool.description).toBeTruthy();
      expect(tool.inputSchema).toBeTruthy();
      expect(tool.inputSchema.type).toBe("object");
    }
  });
});
