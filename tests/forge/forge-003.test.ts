import { describe, it, expect } from "vitest";
import { werkstattKnowledgePlugin } from "@warpgogol/werkstatt-knowledge";

describe("FORGE-003: web does not register second plugin", () => {
  it("does not have a 'werkstatt-site' or 'werkstatt-web' plugin id", () => {
    expect(werkstattKnowledgePlugin.id).not.toBe("werkstatt-site");
    expect(werkstattKnowledgePlugin.id).not.toBe("werkstatt-web");
  });

  it("plugin id is specifically knowledge, not a web/site plugin", () => {
    expect(werkstattKnowledgePlugin.id).toBe("werkstatt-knowledge");
  });

  it("does not declare deployAdapters (deployment is workspace infrastructure)", () => {
    expect(werkstattKnowledgePlugin.deployAdapters).toBeUndefined();
  });
});
