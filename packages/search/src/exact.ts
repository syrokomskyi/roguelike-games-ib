/*
<MODULE_CONTRACT>
<purpose>Performs exact deterministic lookups by ID, key, or alias against the SQLite records table with no scoring.</purpose>
<non-goals>
  <item>Does not perform fuzzy or full-text search — exact match only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: exactLookup with id/key/alias resolution order.</item>
</CHANGE_SUMMARY>
*/
import Database from "better-sqlite3";
import type { ExactLookupQuery, SearchRecord } from "./types.ts";

/**
 * Exact id/key/alias lookup — deterministic, no scoring.
 * Resolution order: id → key → alias.
 */
export function exactLookup(db: Database.Database, query: ExactLookupQuery): SearchRecord | null {
  if (query.id) {
    const row = db
      .prepare("SELECT id, key, record_type, source_id, kind, title, summary, epistemic_status, json FROM records WHERE id = ?")
      .get(query.id) as SearchRecordRow | undefined;
    if (row) return rowToRecord(row);
  }

  if (query.key) {
    const row = db
      .prepare("SELECT id, key, record_type, source_id, kind, title, summary, epistemic_status, json FROM records WHERE key = ?")
      .get(query.key) as SearchRecordRow | undefined;
    if (row) return rowToRecord(row);
  }

  if (query.alias) {
    const aliasRow = db
      .prepare("SELECT record_key FROM aliases WHERE alias = ?")
      .get(query.alias) as { record_key: string } | undefined;
    if (aliasRow) {
      const row = db
        .prepare("SELECT id, key, record_type, source_id, kind, title, summary, epistemic_status, json FROM records WHERE key = ?")
        .get(aliasRow.record_key) as SearchRecordRow | undefined;
      if (row) return rowToRecord(row);
    }
  }

  return null;
}

interface SearchRecordRow {
  id: string;
  key: string;
  record_type: string;
  source_id: string | null;
  kind: string | null;
  title: string | null;
  summary: string | null;
  epistemic_status: string | null;
  json: string;
}

function rowToRecord(row: SearchRecordRow): SearchRecord {
  return {
    id: row.id,
    key: row.key,
    record_type: row.record_type,
    source_id: row.source_id,
    kind: row.kind,
    title: row.title,
    summary: row.summary,
    epistemic_status: row.epistemic_status,
    json: row.json,
  };
}
