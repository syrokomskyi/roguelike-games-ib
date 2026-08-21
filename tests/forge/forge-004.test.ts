import { describe, it, expect } from "vitest";
import { werkstattKnowledgePlugin } from "@warpgogol/werkstatt-knowledge";

describe("FORGE-004: knowledge commands declare source paths as reads only", () => {
  it("moduleLoaders are present for all 5 knowledge modules", () => {
    const loaders = werkstattKnowledgePlugin.moduleLoaders;
    expect(loaders["knowledge-source"]).toBeDefined();
    expect(loaders["knowledge-core"]).toBeDefined();
    expect(loaders["knowledge-extract"]).toBeDefined();
    expect(loaders["knowledge-materialize"]).toBeDefined();
    expect(loaders["knowledge-release"]).toBeDefined();
  });

  it("path conventions point to knowledge/ not source/", () => {
    expect(werkstattKnowledgePlugin.paths.contentDir).toBe("knowledge");
    expect(werkstattKnowledgePlugin.paths.distDir).toBe(".generated/knowledge/dist");
  });
});
