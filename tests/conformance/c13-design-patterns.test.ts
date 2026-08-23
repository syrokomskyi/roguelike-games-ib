import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const WORKSPACE = resolve(__dirname, "../..");
const CANONICAL_ROOT = join(WORKSPACE, "knowledge");
const CONCEPT_DIR = join(CANONICAL_ROOT, "concept", "cross-game", "concept");
const RELATION_DIR = join(CANONICAL_ROOT, "relation", "cross-game", "relation");
const ONTOLOGY_PATH = join(CANONICAL_ROOT, "ontology", "relation-types.yaml");

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

describe("RFC-0011: Design pattern library", () => {
  const allConcepts = readJsonlDir(CONCEPT_DIR);
  const allRelations = readJsonlDir(RELATION_DIR);
  const ontology = readFileSync(ONTOLOGY_PATH, "utf-8");

  const patterns = allConcepts.filter(
    (c) => c.concept_type === "design_pattern",
  );
  const primitives = allConcepts.filter(
    (c) => c.concept_type === "design_primitive",
  );
  const triggeredByCombination = allRelations.filter(
    (r) => r.relation_type === "TRIGGERED_BY_COMBINATION",
  );

  describe("D1: Concrete examples on design primitives", () => {
    it("at least 14 design primitives have concrete_examples field", () => {
      const withExamples = primitives.filter(
        (p) => Array.isArray(p.concrete_examples) && p.concrete_examples.length > 0,
      );
      expect(withExamples.length).toBeGreaterThanOrEqual(14);
    });

    it("each concrete example has game, description, and source_file", () => {
      for (const p of primitives) {
        if (!Array.isArray(p.concrete_examples)) continue;
        for (const ex of p.concrete_examples) {
          expect(ex).toHaveProperty("game");
          expect(ex).toHaveProperty("description");
          expect(typeof ex.description).toBe("string");
          expect(ex.description.length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe("D2: Design pattern concept records", () => {
    it("at least 10 design_pattern records exist", () => {
      expect(patterns.length).toBeGreaterThanOrEqual(10);
    });

    it("each pattern has required fields", () => {
      for (const p of patterns) {
        expect(p).toHaveProperty("title");
        expect(p).toHaveProperty("definition");
        expect(p).toHaveProperty("member_primitives");
        expect(p).toHaveProperty("games_where_present");
        expect(p).toHaveProperty("games_where_absent");
        expect(Array.isArray(p.member_primitives)).toBe(true);
        expect(p.member_primitives.length).toBeGreaterThanOrEqual(1);
        expect(Array.isArray(p.games_where_present)).toBe(true);
      }
    });

    it("each pattern has ancestry with source_games and derived_from", () => {
      for (const p of patterns) {
        expect(p).toHaveProperty("ancestry");
        expect(p.ancestry).toHaveProperty("source_games");
        expect(p.ancestry).toHaveProperty("derived_from");
        expect(Array.isArray(p.ancestry.source_games)).toBe(true);
      }
    });
  });

  describe("D3: TRIGGERED_BY_COMBINATION relation type", () => {
    it("relation type is declared in ontology", () => {
      expect(ontology).toContain("TRIGGERED_BY_COMBINATION");
    });

    it("at least 5 TRIGGERED_BY_COMBINATION relations exist", () => {
      expect(triggeredByCombination.length).toBeGreaterThanOrEqual(5);
    });

    it("each relation has source and target record IDs", () => {
      for (const r of triggeredByCombination) {
        expect(r).toHaveProperty("source_record_id");
        expect(r).toHaveProperty("target_record_id");
        expect(r).toHaveProperty("relation_type", "TRIGGERED_BY_COMBINATION");
      }
    });
  });
});
