import { describe, it, expect } from "vitest";
import { werkstattKnowledgePlugin } from "@warpgogol/werkstatt-knowledge";

describe("FORGE-002: plugin id/profile match knowledge contract", () => {
  it("has id 'werkstatt-knowledge'", () => {
    expect(werkstattKnowledgePlugin.id).toBe("werkstatt-knowledge");
  });

  it("has profileId 'knowledge-typescript-turborepo'", () => {
    expect(werkstattKnowledgePlugin.profileId).toBe("knowledge-typescript-turborepo");
  });

  it("has knowledge path conventions", () => {
    expect(werkstattKnowledgePlugin.paths.contentDir).toBe("knowledge");
    expect(werkstattKnowledgePlugin.paths.entryPoints).toContain("knowledge/manifest.yaml");
    expect(werkstattKnowledgePlugin.paths.entryPoints).toContain(
      "knowledge/ontology/schema-registry.yaml",
    );
  });
});
