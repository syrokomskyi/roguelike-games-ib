import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { materialize, verifySqliteIntegrity } from "@roguelike-games-ib/materializer";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { setupCanonicalWorkspace, testId } from "./helpers";

const records = [
  {
    id: testId(1),
    key: "goblin",
    record_type: "creature",
    title: "Goblin",
    summary: "A small creature",
    source_identity: { source_id: "src-a", native_id: "goblin", path: "data.json" },
  },
  {
    id: testId(2),
    key: "kobold",
    record_type: "creature",
    title: "Kobold",
    summary: "Another small creature",
    source_identity: { source_id: "src-a", native_id: "kobold", path: "data.json" },
  },
];

const claims = [
  {
    id: testId(10),
    subject_id: testId(1),
    predicate: "has_hp",
    value: 3,
    assertion_state: "supported",
    evidence_refs: [],
  },
  {
    id: testId(11),
    subject_id: testId(2),
    predicate: "has_hp",
    value: 2,
    assertion_state: "supported",
    evidence_refs: [],
  },
];

const relations = [
  {
    id: testId(20),
    relation_type: "similar_to",
    source_record_id: testId(1),
    target_record_id: testId(2),
    relation_scope: "game",
    evidence_refs: [],
  },
];

const keys = [
  { id: testId(1), key: "goblin", record_type: "creature" },
  { id: testId(2), key: "kobold", record_type: "creature" },
];

describe("MAT-004: SQLite logical integrity mirrors JSONL counts", () => {
  let setup: ReturnType<typeof setupCanonicalWorkspace>;
  let result: ReturnType<typeof materialize>;

  beforeEach(() => {
    setup = setupCanonicalWorkspace({
      kbId: "mat004-test",
      records,
      claims,
      relations,
      keys,
    });
    result = materialize({ workspaceRoot: setup.workspace });
  });

  afterEach(() => {
    setup.cleanup();
  });

  it("SQLite record count matches records.jsonl line count", () => {
    const dbPath = join(result.distDir, "knowledge.sqlite");
    const verification = verifySqliteIntegrity(dbPath);
    expect(verification.valid).toBe(true);

    const recordsJsonl = readFileSync(join(result.distDir, "records.jsonl"), "utf-8");
    const recordLines = recordsJsonl.trim().split("\n").filter((l) => l.trim() !== "");
    expect(verification.counts.records).toBe(recordLines.length);
  });

  it("SQLite claims count matches claims.jsonl line count", () => {
    const dbPath = join(result.distDir, "knowledge.sqlite");
    const verification = verifySqliteIntegrity(dbPath);

    const claimsJsonl = readFileSync(join(result.distDir, "claims.jsonl"), "utf-8");
    const claimLines = claimsJsonl.trim().split("\n").filter((l) => l.trim() !== "");
    expect(verification.counts.claims).toBe(claimLines.length);
  });

  it("SQLite relations count matches relations.jsonl line count", () => {
    const dbPath = join(result.distDir, "knowledge.sqlite");
    const verification = verifySqliteIntegrity(dbPath);

    const relationsJsonl = readFileSync(join(result.distDir, "relations.jsonl"), "utf-8");
    const relationLines = relationsJsonl.trim().split("\n").filter((l) => l.trim() !== "");
    expect(verification.counts.relations).toBe(relationLines.length);
  });

  it("SQLite foreign key integrity passes", () => {
    const dbPath = join(result.distDir, "knowledge.sqlite");
    const verification = verifySqliteIntegrity(dbPath);
    expect(verification.valid).toBe(true);
  });

  it("SQLite data matches JSONL content", () => {
    const dbPath = join(result.distDir, "knowledge.sqlite");
    const db = new Database(dbPath, { readonly: true });
    const rows = db.prepare("SELECT id, key, record_type, title, summary FROM records ORDER BY key").all() as Array<{ id: string; key: string; record_type: string; title: string; summary: string }>;
    db.close();

    expect(rows).toHaveLength(2);
    expect(rows[0].key).toBe("goblin");
    expect(rows[0].title).toBe("Goblin");
    expect(rows[1].key).toBe("kobold");
    expect(rows[1].title).toBe("Kobold");
  });
});
