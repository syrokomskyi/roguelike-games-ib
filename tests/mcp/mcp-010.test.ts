import { describe, it, expect } from "vitest";
import { createMcpToolRegistry, assertNoWriteTools, REQUIRED_TOOLS } from "@roguelike-games-ib/mcp";

describe("MCP-010: no canonical write tool registered", () => {
  it("no tool name contains write/mutate/delete/create/update", () => {
    const registry = createMcpToolRegistry();
    const names = registry.list().map((t) => t.name);

    const writePatterns = ["write", "mutate", "delete", "create", "update", "insert", "promote", "apply", "commit"];
    for (const name of names) {
      const lower = name.toLowerCase();
      for (const pattern of writePatterns) {
        expect(lower).not.toContain(pattern);
      }
    }
  });

  it("assertNoWriteTools returns no violations", () => {
    const registry = createMcpToolRegistry();
    const violations = assertNoWriteTools(registry);
    expect(violations).toEqual([]);
  });

  it("no lab_write or lab_generate tool is registered", () => {
    const registry = createMcpToolRegistry();
    expect(registry.has("lab_write")).toBe(false);
    expect(registry.has("lab_generate")).toBe(false);
    expect(registry.has("lab_generate_seed")).toBe(false);
    expect(registry.has("write_record")).toBe(false);
    expect(registry.has("create_record")).toBe(false);
    expect(registry.has("delete_record")).toBe(false);
    expect(registry.has("promote_candidate")).toBe(false);
  });

  it("all registered tools are read-only", () => {
    const registry = createMcpToolRegistry();
    for (const [name, def] of registry.tools) {
      expect(def.readOnly, `Tool ${name} is not read-only`).toBe(true);
    }
  });

  it("required tools list does not include any write tools", () => {
    const writePatterns = ["write", "mutate", "delete", "create", "update", "insert", "promote", "apply", "commit"];
    for (const name of REQUIRED_TOOLS) {
      const lower = name.toLowerCase();
      for (const pattern of writePatterns) {
        expect(lower).not.toContain(pattern);
      }
    }
  });
});
