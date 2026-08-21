import { describe, it, expect } from "vitest";
import { werkstattKnowledgePlugin } from "@warpgogol/werkstatt-knowledge";

describe("FORGE-005: diagnostics use canonical Werkstatt schema", () => {
  it("plugin schema is werkstatt/plugin@1", () => {
    expect(werkstattKnowledgePlugin.schema).toBe("werkstatt/plugin@1");
  });

  it("invariants are present and use stable IDs", () => {
    const invariants = werkstattKnowledgePlugin.invariants;
    expect(invariants).toBeDefined();
    expect(invariants!.length).toBeGreaterThan(0);

    for (const inv of invariants!) {
      expect(inv.id).toMatch(/^KNO-\d{3}$/);
      expect(inv.description).toBeTruthy();
    }
  });

  it("KNO-024 invariant declares sole plugin resolution", () => {
    const inv = werkstattKnowledgePlugin.invariants!.find((i) => i.id === "KNO-024");
    expect(inv).toBeDefined();
    expect(inv!.description).toContain("sole current Werkstatt plugin");
  });
});
