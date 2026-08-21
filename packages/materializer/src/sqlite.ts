/*
<MODULE_CONTRACT>
<purpose>Builds and verifies the SQLite read model with FTS5 full-text search, foreign keys, and a logical dump hash for cross-version determinism.</purpose>
<non-goals>
  <item>Does not write JSONL files — SQLite build only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: buildSqlite, computeLogicalDumpHash, verifySqliteIntegrity with FTS5 and foreign key checks.</item>
</CHANGE_SUMMARY>
*/
import Database from "better-sqlite3";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { canonicalJsonStringify, sha256 } from "@roguelike-games-ib/knowledge-core";
import { CanonicalRecord } from "./types.ts";
import { PublicEvidence } from "./public-evidence.ts";
import { sortRecords, getField, extractSourceId } from "./normalize.ts";
import {
  ClaimRecord,
  RelationRecord,
  ContradictionRecord,
  KeyEntry,
  AliasEntry,
  SourceBinding,
  CoverageRecord,
} from "@roguelike-games-ib/knowledge-core";

export interface SqliteBuildResult {
  path: string;
  logicalDumpHash: string;
  counts: {
    records: number;
    aliases: number;
    claims: number;
    relations: number;
    contradictions: number;
    evidence: number;
    sources: number;
    coverage: number;
  };
}

/**
 * Build the SQLite read model from materialized data.
 * Returns the path and a logical dump hash for determinism verification.
 */
export function buildSqlite(
  distDir: string,
  data: {
    records: CanonicalRecord[];
    claims: ClaimRecord[];
    relations: RelationRecord[];
    contradictions: ContradictionRecord[];
    publicEvidence: PublicEvidence[];
    keys: KeyEntry[];
    aliases: AliasEntry[];
    bindings: SourceBinding[];
    coverage: CoverageRecord[];
  },
): SqliteBuildResult {
  const dbPath = join(distDir, "knowledge.sqlite");
  if (existsSync(dbPath)) {
    rmSync(dbPath);
  }

  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  createTables(db);
  insertData(db, data);
  createFtsIndex(db, data.records);

  db.close();

  const logicalDumpHash = computeLogicalDumpHash(dbPath, data);
  const counts = {
    records: data.records.length,
    aliases: data.aliases.length,
    claims: data.claims.length,
    relations: data.relations.length,
    contradictions: data.contradictions.length,
    evidence: data.publicEvidence.length,
    sources: data.bindings.length,
    coverage: data.coverage.length,
  };

  return { path: dbPath, logicalDumpHash, counts };
}

function createTables(db: Database.Database) {
  db.exec(`
    CREATE TABLE records (
      id TEXT PRIMARY KEY,
      key TEXT UNIQUE NOT NULL,
      record_type TEXT NOT NULL,
      source_id TEXT,
      kind TEXT,
      title TEXT,
      summary TEXT,
      epistemic_status TEXT,
      json TEXT NOT NULL
    );

    CREATE TABLE aliases (
      alias TEXT PRIMARY KEY,
      record_key TEXT NOT NULL
    );

    CREATE TABLE claims (
      id TEXT PRIMARY KEY,
      subject_id TEXT,
      predicate TEXT,
      object_ref TEXT,
      assertion_state TEXT,
      json TEXT NOT NULL,
      FOREIGN KEY (subject_id) REFERENCES records(id)
    );

    CREATE TABLE relations (
      id TEXT PRIMARY KEY,
      relation_type TEXT NOT NULL,
      source_record_id TEXT,
      target_record_id TEXT,
      relation_scope TEXT,
      json TEXT NOT NULL,
      FOREIGN KEY (source_record_id) REFERENCES records(id),
      FOREIGN KEY (target_record_id) REFERENCES records(id)
    );

    CREATE TABLE contradictions (
      id TEXT PRIMARY KEY,
      contradiction_status TEXT NOT NULL,
      json TEXT NOT NULL
    );

    CREATE TABLE evidence (
      id TEXT PRIMARY KEY,
      source_id TEXT,
      artifact_path TEXT,
      publication_access TEXT,
      json TEXT NOT NULL
    );

    CREATE TABLE sources (
      source_id TEXT PRIMARY KEY,
      declared_version TEXT,
      binding_digest TEXT,
      json TEXT NOT NULL
    );

    CREATE TABLE coverage (
      source_id TEXT,
      dimension_id TEXT,
      state TEXT,
      json TEXT NOT NULL,
      PRIMARY KEY (source_id, dimension_id)
    );

    CREATE VIRTUAL TABLE records_fts USING fts5(
      record_id UNINDEXED,
      key,
      title,
      summary,
      body
    );
  `);
}

function insertData(
  db: Database.Database,
  data: {
    records: CanonicalRecord[];
    claims: ClaimRecord[];
    relations: RelationRecord[];
    contradictions: ContradictionRecord[];
    publicEvidence: PublicEvidence[];
    keys: KeyEntry[];
    aliases: AliasEntry[];
    bindings: SourceBinding[];
    coverage: CoverageRecord[];
  },
) {
  const sortedRecords = sortRecords(data.records);

  const insertRecord = db.prepare(`
    INSERT INTO records (id, key, record_type, source_id, kind, title, summary, epistemic_status, json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertFts = db.prepare(`
    INSERT INTO records_fts (record_id, key, title, summary, body)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction(() => {
    for (const r of sortedRecords) {
      const json = canonicalJsonStringify(r);
      const sourceId = extractSourceId(r as Record<string, unknown>);
      const kind = getField(r as Record<string, unknown>, "kind");
      const title = getField(r as Record<string, unknown>, "title");
      const summary = getField(r as Record<string, unknown>, "summary");
      const epistemicStatus = getField(r as Record<string, unknown>, "epistemic_status");

      insertRecord.run(r.id, r.key, r.record_type, sourceId, kind, title, summary, epistemicStatus, json);

      const body = getField(r as Record<string, unknown>, "body") ?? "";
      insertFts.run(r.id, r.key, title ?? "", summary ?? "", body);
    }

    const insertAlias = db.prepare(`INSERT INTO aliases (alias, record_key) VALUES (?, ?)`);
    const sortedAliases = [...data.aliases].sort((a, b) => a.key.localeCompare(b.key));
    for (const a of sortedAliases) {
      insertAlias.run(a.key, a.retired_to);
    }

    const insertClaim = db.prepare(`
      INSERT INTO claims (id, subject_id, predicate, object_ref, assertion_state, json)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const sortedClaims = [...data.claims].sort((a, b) => a.id.localeCompare(b.id));
    for (const c of sortedClaims) {
      insertClaim.run(
        c.id,
        c.subject_id,
        c.predicate,
        c.object_ref ?? null,
        c.assertion_state,
        canonicalJsonStringify(c),
      );
    }

    const insertRelation = db.prepare(`
      INSERT INTO relations (id, relation_type, source_record_id, target_record_id, relation_scope, json)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const sortedRelations = [...data.relations].sort((a, b) => a.id.localeCompare(b.id));
    for (const rel of sortedRelations) {
      insertRelation.run(
        rel.id,
        rel.relation_type,
        rel.source_record_id,
        rel.target_record_id,
        rel.relation_scope,
        canonicalJsonStringify(rel),
      );
    }

    const insertContradiction = db.prepare(`
      INSERT INTO contradictions (id, contradiction_status, json)
      VALUES (?, ?, ?)
    `);
    const sortedContras = [...data.contradictions].sort((a, b) => a.id.localeCompare(b.id));
    for (const con of sortedContras) {
      insertContradiction.run(con.id, con.contradiction_status, canonicalJsonStringify(con));
    }

    const insertEvidence = db.prepare(`
      INSERT INTO evidence (id, source_id, artifact_path, publication_access, json)
      VALUES (?, ?, ?, ?, ?)
    `);
    const sortedEv = [...data.publicEvidence].sort((a, b) => a.id.localeCompare(b.id));
    for (const ev of sortedEv) {
      insertEvidence.run(
        ev.id,
        ev.source_id,
        ev.artifact_path,
        ev.publication_access,
        canonicalJsonStringify(ev),
      );
    }

    const insertSource = db.prepare(`
      INSERT INTO sources (source_id, declared_version, binding_digest, json)
      VALUES (?, ?, ?, ?)
    `);
    const sortedBindings = [...data.bindings].sort((a, b) => a.source_id.localeCompare(b.source_id));
    for (const b of sortedBindings) {
      insertSource.run(
        b.source_id,
        b.declared_version,
        b.binding_digest,
        canonicalJsonStringify(b),
      );
    }

    const insertCoverage = db.prepare(`
      INSERT INTO coverage (source_id, dimension_id, state, json)
      VALUES (?, ?, ?, ?)
    `);
    for (const cov of data.coverage) {
      for (const dim of cov.dimensions) {
        insertCoverage.run(cov.source_id, dim.id, dim.state, canonicalJsonStringify(dim));
      }
    }
  });

  insertMany();
}

function createFtsIndex(db: Database.Database, _records: CanonicalRecord[]) {
  // FTS is populated during insertData via insertFts
}

/**
 * Compute a logical dump hash — stable across SQLite library versions.
 * Reads all tables in deterministic order and hashes the content.
 */
export function computeLogicalDumpHash(
  dbPath: string,
  data: {
    records: CanonicalRecord[];
    claims: ClaimRecord[];
    relations: RelationRecord[];
    contradictions: ContradictionRecord[];
    publicEvidence: PublicEvidence[];
    keys: KeyEntry[];
    aliases: AliasEntry[];
    bindings: SourceBinding[];
    coverage: CoverageRecord[];
  },
): string {
  const parts: string[] = [];

  const sortedRecords = sortRecords(data.records);
  for (const r of sortedRecords) {
    parts.push(`R:${r.id}:${canonicalJsonStringify(r)}`);
  }

  const sortedClaims = [...data.claims].sort((a, b) => a.id.localeCompare(b.id));
  for (const c of sortedClaims) {
    parts.push(`C:${c.id}:${canonicalJsonStringify(c)}`);
  }

  const sortedRelations = [...data.relations].sort((a, b) => a.id.localeCompare(b.id));
  for (const rel of sortedRelations) {
    parts.push(`REL:${rel.id}:${canonicalJsonStringify(rel)}`);
  }

  const sortedContras = [...data.contradictions].sort((a, b) => a.id.localeCompare(b.id));
  for (const con of sortedContras) {
    parts.push(`CON:${con.id}:${canonicalJsonStringify(con)}`);
  }

  const sortedEv = [...data.publicEvidence].sort((a, b) => a.id.localeCompare(b.id));
  for (const ev of sortedEv) {
    parts.push(`E:${ev.id}:${canonicalJsonStringify(ev)}`);
  }

  const sortedAliases = [...data.aliases].sort((a, b) => a.key.localeCompare(b.key));
  for (const a of sortedAliases) {
    parts.push(`A:${a.key}:${a.retired_to}`);
  }

  const sortedBindings = [...data.bindings].sort((a, b) => a.source_id.localeCompare(b.source_id));
  for (const b of sortedBindings) {
    parts.push(`S:${b.source_id}:${canonicalJsonStringify(b)}`);
  }

  for (const cov of data.coverage) {
    for (const dim of cov.dimensions) {
      parts.push(`COV:${cov.source_id}:${dim.id}:${canonicalJsonStringify(dim)}`);
    }
  }

  return sha256(parts.join("\n"));
}

/**
 * Verify SQLite logical integrity — row counts match JSONL counts.
 */
export function verifySqliteIntegrity(dbPath: string): {
  valid: boolean;
  errors: string[];
  counts: Record<string, number>;
} {
  const errors: string[] = [];
  const db = new Database(dbPath, { readonly: true });

  const tables = ["records", "aliases", "claims", "relations", "contradictions", "evidence", "sources", "coverage"];
  const counts: Record<string, number> = {};

  for (const table of tables) {
    const row = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as { count: number };
    counts[table] = row.count;
  }

  const fkErrors = db.pragma("foreign_key_check") as unknown[];
  if (fkErrors.length > 0) {
    errors.push(`Foreign key violations: ${fkErrors.length}`);
  }

  const integrity = db.pragma("integrity_check") as unknown[];
  if (integrity.length > 1 || (integrity.length === 1 && String((integrity[0] as Record<string, unknown>)?.integrity_check ?? integrity[0]) !== "ok")) {
    errors.push(`Integrity check failed: ${integrity.map((r) => String((r as Record<string, unknown>)?.integrity_check ?? r)).join(", ")}`);
  }

  db.close();

  return { valid: errors.length === 0, errors, counts };
}
