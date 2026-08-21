import { describe, it, expect } from "vitest";
import { werkstattKnowledgePlugin } from "@warpgogol/werkstatt-knowledge";

describe("FORGE-001: exactly one Werkstatt plugin resolves", () => {
  it("resolves a single werkstatt-knowledge plugin", () => {
    expect(werkstattKnowledgePlugin).toBeDefined();
    expect(werkstattKnowledgePlugin.schema).toBe("werkstatt/plugin@1");
    expect(werkstattKnowledgePlugin.id).toBe("werkstatt-knowledge");
  });

  it("has no second plugin registered", () => {
    const plugins = [werkstattKnowledgePlugin];
    expect(plugins.length).toBe(1);
  });
});
