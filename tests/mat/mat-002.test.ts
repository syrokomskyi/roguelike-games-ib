import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { materialize } from "@roguelike-games-ib/materializer";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { setupCanonicalWorkspace, testId } from "./helpers";

const records = [
  {
    id: testId(1),
    key: "alpha",
    record_type: "creature",
    name: "Alpha",
    title: "Alpha Creature",
    summary: "First creature",
    source_identity: { source_id: "src-a", native_id: "alpha", path: "data.json" },
  },
  {
    id: testId(2),
    key: "beta",
    record_type: "creature",
    name: "Beta",
    title: "Beta Creature",
    summary: "Second creature",
    source_identity: { source_id: "src-a", native_id: "beta", path: "data.json" },
  },
  {
    id: testId(3),
    key: "gamma",
    record_type: "mechanic",
    name: "Gamma",
    title: "Gamma Mechanic",
    summary: "A game mechanic",
    source_identity: { source_id: "src-a", native_id: "gamma", path: "mechanics.json" },
  },
];

const keys = [
  { id: testId(1), key: "alpha", record_type: "creature" },
  { id: testId(2), key: "beta", record_type: "creature" },
  { id: testId(3), key: "gamma", record_type: "mechanic" },
];

describe("MAT-002: JSONL output deterministic", () => {
  let setup: ReturnType<typeof setupCanonicalWorkspace>;

  beforeEach(() => {
    setup = setupCanonicalWorkspace({
      kbId: "mat002-test",
      records,
      keys,
    });
  });

  afterEach(() => {
    setup.cleanup();
  });

  it("produces byte-identical JSONL on two builds from same canonical state", () => {
    const result1 = materialize({ workspaceRoot: setup.workspace, distDir: join(setup.workspace, ".gen1") });
    const result2 = materialize({ workspaceRoot: setup.workspace, distDir: join(setup.workspace, ".gen2") });

    for (const file of ["records.jsonl", "claims.jsonl", "relations.jsonl", "evidence.public.jsonl", "sources.json", "coverage.json", "key-map.json", "alias-map.json", "manifest.json"]) {
      const content1 = readFileSync(join(result1.distDir, file), "utf-8");
      const content2 = readFileSync(join(result2.distDir, file), "utf-8");
      expect(content1).toBe(content2);
    }

    expect(result1.canonicalHash).toBe(result2.canonicalHash);
    expect(result1.logicalDumpHash).toBe(result2.logicalDumpHash);
  });

  it("records.jsonl is sorted by key then id", () => {
    const result = materialize({ workspaceRoot: setup.workspace });
    const content = readFileSync(join(result.distDir, "records.jsonl"), "utf-8");
    const lines = content.trim().split("\n");
    const parsed = lines.map((l) => JSON.parse(l) as { key: string; id: string });
    const keys = parsed.map((r) => r.key);
    const sortedKeys = [...keys].sort();
    expect(keys).toEqual(sortedKeys);
  });
});
