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
    title: "Alpha",
    summary: "First",
    source_identity: { source_id: "src-a", native_id: "alpha", path: "data.json" },
  },
  {
    id: testId(2),
    key: "beta",
    record_type: "creature",
    title: "Beta",
    summary: "Second",
    source_identity: { source_id: "src-a", native_id: "beta", path: "data.json" },
  },
];

const claims = [
  {
    id: testId(10),
    subject_id: testId(1),
    predicate: "related_to",
    object_ref: testId(2),
    assertion_state: "supported",
    evidence_refs: [],
  },
];

const keys = [
  { id: testId(1), key: "alpha", record_type: "creature" },
  { id: testId(2), key: "beta", record_type: "creature" },
];

describe("MAT-007: materialized build from same hash is logically identical", () => {
  let setup: ReturnType<typeof setupCanonicalWorkspace>;

  beforeEach(() => {
    setup = setupCanonicalWorkspace({
      kbId: "mat007-test",
      records,
      claims,
      keys,
    });
  });

  afterEach(() => {
    setup.cleanup();
  });

  it("two builds produce same canonical hash", () => {
    const r1 = materialize({ workspaceRoot: setup.workspace, distDir: join(setup.workspace, ".gen1") });
    const r2 = materialize({ workspaceRoot: setup.workspace, distDir: join(setup.workspace, ".gen2") });
    expect(r1.canonicalHash).toBe(r2.canonicalHash);
  });

  it("two builds produce same logical dump hash", () => {
    const r1 = materialize({ workspaceRoot: setup.workspace, distDir: join(setup.workspace, ".gen1") });
    const r2 = materialize({ workspaceRoot: setup.workspace, distDir: join(setup.workspace, ".gen2") });
    expect(r1.logicalDumpHash).toBe(r2.logicalDumpHash);
  });

  it("two builds produce identical JSONL files", () => {
    const r1 = materialize({ workspaceRoot: setup.workspace, distDir: join(setup.workspace, ".gen1") });
    const r2 = materialize({ workspaceRoot: setup.workspace, distDir: join(setup.workspace, ".gen2") });

    const files = ["records.jsonl", "claims.jsonl", "relations.jsonl", "evidence.public.jsonl", "manifest.json", "key-map.json", "alias-map.json", "sources.json", "coverage.json"];
    for (const f of files) {
      const c1 = readFileSync(join(r1.distDir, f), "utf-8");
      const c2 = readFileSync(join(r2.distDir, f), "utf-8");
      expect(c1).toBe(c2);
    }
  });

  it("manifest records same canonical and logical dump hash across builds", () => {
    const r1 = materialize({ workspaceRoot: setup.workspace, distDir: join(setup.workspace, ".gen1") });
    const r2 = materialize({ workspaceRoot: setup.workspace, distDir: join(setup.workspace, ".gen2") });

    expect(r1.manifest.canonicalHash).toBe(r2.manifest.canonicalHash);
    expect(r1.manifest.logicalDumpHash).toBe(r2.manifest.logicalDumpHash);
  });
});
