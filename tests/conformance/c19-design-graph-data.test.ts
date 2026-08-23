import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const WORKSPACE = resolve(__dirname, "../..");
const CANONICAL_ROOT = join(WORKSPACE, "knowledge");
const CONCEPT_DIR = join(CANONICAL_ROOT, "concept", "cross-game", "concept");
const RELATION_DIR = join(CANONICAL_ROOT, "relation", "cross-game", "relation");

function readJsonlDir(dir: string): any[] {
  if (!existsSync(dir)) return [];
  const records: any[] = [];
  function walk(d: string) {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (entry.name.endsWith(".jsonl")) {
        try {
          records.push(JSON.parse(readFileSync(p, "utf-8")));
        } catch { /* skip */ }
      }
    }
  }
  walk(dir);
  return records;
}

describe("RFC-0015: Design space visualization — graph data", () => {
  const allConcepts = readJsonlDir(CONCEPT_DIR);
  const allRelations = readJsonlDir(RELATION_DIR);

  const expectedConceptTypes = [
    "design_primitive",
    "design_pressure",
    "design_pattern",
    "mutation_vector",
    "design_knob",
    "counterplay_pattern",
    "failure_mode",
  ];

  const expectedRelationTypes = [
    "CREATES_PRESSURE",
    "tensions_with",
    "HAS_MUTATION_VECTOR",
    "IMPLEMENTED_AS",
    "HAS_COUNTERPLAY",
    "CAN_FAIL_AS",
    "TRIGGERED_BY_COMBINATION",
  ];

  it("concept data contains all concept types referenced in RFC-0015 D3 color table", () => {
    const presentTypes = new Set(allConcepts.map((c) => c.concept_type));
    for (const ct of expectedConceptTypes) {
      expect(presentTypes.has(ct), `concept type "${ct}" should be present in canonical data`).toBe(true);
    }
  });

  it("relation data contains all relation types from designRelationTypes set", () => {
    const presentTypes = new Set(allRelations.map((r) => r.relation_type));
    for (const rt of expectedRelationTypes) {
      expect(presentTypes.has(rt), `relation type "${rt}" should be present in canonical data`).toBe(true);
    }
  });

  it("buildGraphData function is exported from graph-data.ts", async () => {
    const mod = await import("../../apps/web/src/lib/graph-data.ts");
    expect(typeof mod.buildGraphData).toBe("function");
  });
});
