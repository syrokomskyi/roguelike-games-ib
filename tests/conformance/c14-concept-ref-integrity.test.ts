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

describe("C14: Concept implementation reference integrity", () => {
  const conceptDir = join(CANONICAL_ROOT, "concept", "cross-game");
  const definitionDir = join(CANONICAL_ROOT, "definition");

  const concepts = readJsonlDir(conceptDir);
  const definitions = readJsonlDir(definitionDir);

  const allRecordIds = new Set<string>();
  for (const def of definitions) allRecordIds.add(def.id);
  for (const con of concepts) allRecordIds.add(con.id);

  it("every concept implementation_ref resolves to an existing record", () => {
    const unresolved: string[] = [];
    for (const concept of concepts) {
      const refs = concept.implementation_refs ?? [];
      for (const ref of refs) {
        if (!allRecordIds.has(ref)) {
          unresolved.push(`${concept.key} -> ${ref}`);
        }
      }
    }
    expect(unresolved, `Unresolved implementation_refs: ${unresolved.slice(0, 10).join("; ")}`).toEqual([]);
  });

  it("every concept ancestry.derived_from resolves to an existing record", () => {
    const unresolved: string[] = [];
    for (const concept of concepts) {
      const derivedFrom = concept.ancestry?.derived_from ?? [];
      for (const ref of derivedFrom) {
        if (!allRecordIds.has(ref)) {
          unresolved.push(`${concept.key} -> ${ref}`);
        }
      }
    }
    expect(unresolved, `Unresolved derived_from refs: ${unresolved.slice(0, 10).join("; ")}`).toEqual([]);
  });
});
