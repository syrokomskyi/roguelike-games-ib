import Database from "better-sqlite3";
import type { FtsHit } from "./types.ts";

/**
 * FTS5 lexical retrieval with stable tie-break: key ASC, then id ASC.
 */
export function ftsSearch(db: Database.Database, text: string, limit?: number): FtsHit[] {
  const escaped = escapeFtsQuery(text);
  if (!escaped) return [];

  const sql = `
    SELECT
      records_fts.record_id AS recordId,
      r.key AS key,
      r.id AS id,
      bm25(records_fts) AS score
    FROM records_fts
    JOIN records r ON r.id = records_fts.record_id
    WHERE records_fts MATCH ?
    ORDER BY score ASC, r.key ASC, r.id ASC
    ${limit !== undefined ? "LIMIT ?" : ""}
  `;

  const stmt = db.prepare(sql);
  const rows = (limit !== undefined ? stmt.all(escaped, limit) : stmt.all(escaped)) as Array<{
    recordId: string;
    key: string;
    id: string;
    score: number;
  }>;

  return rows.map((row) => ({
    recordId: row.recordId,
    key: row.key,
    score: row.score,
  }));
}

/**
 * Escape special FTS5 characters in a query string.
 * Wraps terms in double quotes for phrase matching.
 */
function escapeFtsQuery(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";

  const terms = trimmed.split(/\s+/).filter(Boolean);
  if (terms.length === 0) return "";

  return terms.map((t) => `"${t.replace(/"/g, '""')}"`).join(" ");
}
