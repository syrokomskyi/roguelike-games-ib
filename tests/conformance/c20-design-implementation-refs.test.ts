import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const WORKSPACE = resolve(__dirname, "../..");
const CANONICAL_ROOT = join(WORKSPACE, "knowledge");

function readJsonlDir(dir: string): any[] {
  if (!existsSync(dir)) return [];
  const records: any[] = [];
  function walk(d: string) {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        walk(join(d, entry.name));
      } else if (entry.name.endsWith(".jsonl")) {
        try {
          const raw = readFileSync(join(d, entry.name), "utf-8");
          records.push(JSON.parse(raw));
        } catch { /* skip */ }
      }
    }
  }
  walk(dir);
  return records;
}

describe("C20: Design implementation references", () => {
  const conceptDir = join(CANONICAL_ROOT, "concept", "cross-game");
  const definitionDir = join(CANONICAL_ROOT, "definition");

  const concepts = readJsonlDir(conceptDir);
  const definitions = readJsonlDir(definitionDir);

  const allRecordIds = new Set<string>();
  for (const def of definitions) allRecordIds.add(def.id);
  for (const con of concepts) allRecordIds.add(con.id);

  const designPrimitives = concepts.filter(
    (c) => c.concept_type === "design_primitive",
  );
  const designPatterns = concepts.filter(
    (c) => c.concept_type === "design_pattern",
  );

  it("all design primitives have non-empty implementation_refs", () => {
    const empty: string[] = [];
    for (const prim of designPrimitives) {
      const refs = prim.implementation_refs ?? [];
      if (refs.length === 0) {
        empty.push(prim.key);
      }
    }
    expect(
      empty,
      `Design primitives with empty implementation_refs: ${empty.join(", ")}`,
    ).toEqual([]);
  });

  it("all design patterns have non-empty implementation_refs", () => {
    const empty: string[] = [];
    for (const pat of designPatterns) {
      const refs = pat.implementation_refs ?? [];
      if (refs.length === 0) {
        empty.push(pat.key);
      }
    }
    expect(
      empty,
      `Design patterns with empty implementation_refs: ${empty.join(", ")}`,
    ).toEqual([]);
  });

  it("all design primitive implementation_refs resolve to existing records", () => {
    const unresolved: string[] = [];
    for (const prim of designPrimitives) {
      const refs = prim.implementation_refs ?? [];
      for (const ref of refs) {
        if (!allRecordIds.has(ref)) {
          unresolved.push(`${prim.key} -> ${ref}`);
        }
      }
    }
    expect(
      unresolved,
      `Unresolved implementation_refs: ${unresolved.slice(0, 10).join("; ")}`,
    ).toEqual([]);
  });

  it("all design pattern implementation_refs resolve to existing records", () => {
    const unresolved: string[] = [];
    for (const pat of designPatterns) {
      const refs = pat.implementation_refs ?? [];
      for (const ref of refs) {
        if (!allRecordIds.has(ref)) {
          unresolved.push(`${pat.key} -> ${ref}`);
        }
      }
    }
    expect(
      unresolved,
      `Unresolved implementation_refs: ${unresolved.slice(0, 10).join("; ")}`,
    ).toEqual([]);
  });

  it("concrete_examples have non-empty record_refs for at least 2 games per primitive", () => {
    const insufficient: string[] = [];
    for (const prim of designPrimitives) {
      const examples = prim.concrete_examples ?? [];
      const gamesWithRefs = examples.filter(
        (ex: any) => (ex.record_refs ?? []).length > 0,
      ).length;
      if (gamesWithRefs < 2) {
        insufficient.push(
          `${prim.key} (${gamesWithRefs} games with refs)`,
        );
      }
    }
    expect(
      insufficient,
      `Primitives with fewer than 2 games having record_refs: ${insufficient.join(", ")}`,
    ).toEqual([]);
  });

  it("all concrete_examples record_refs resolve to existing records", () => {
    const unresolved: string[] = [];
    for (const prim of designPrimitives) {
      const examples = prim.concrete_examples ?? [];
      for (const ex of examples) {
        const refs = ex.record_refs ?? [];
        for (const ref of refs) {
          if (!allRecordIds.has(ref)) {
            unresolved.push(`${prim.key}/${ex.game} -> ${ref}`);
          }
        }
      }
    }
    expect(
      unresolved,
      `Unresolved record_refs: ${unresolved.slice(0, 10).join("; ")}`,
    ).toEqual([]);
  });
});
