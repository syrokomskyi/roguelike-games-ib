import type { SearchFilters } from "./types.ts";

/**
 * Build a SQL WHERE clause from structured filters.
 * Returns the clause (without "WHERE") and bound parameters.
 */
export function buildFilterClause(filters: SearchFilters | undefined): { clause: string; params: string[] } {
  if (!filters) return { clause: "", params: [] };

  const conditions: string[] = [];
  const params: string[] = [];

  if (filters.source_id) {
    conditions.push("r.source_id = ?");
    params.push(filters.source_id);
  }
  if (filters.record_type) {
    conditions.push("r.record_type = ?");
    params.push(filters.record_type);
  }
  if (filters.kind) {
    conditions.push("r.kind = ?");
    params.push(filters.kind);
  }
  if (filters.epistemic_status) {
    conditions.push("r.epistemic_status = ?");
    params.push(filters.epistemic_status);
  }

  if (conditions.length === 0) return { clause: "", params: [] };

  return { clause: conditions.join(" AND "), params };
}

/**
 * Apply filters to a set of record IDs by querying the records table.
 */
export function filterRecordIds(
  db: import("better-sqlite3").Database,
  recordIds: string[],
  filters: SearchFilters | undefined,
): string[] {
  if (!filters || recordIds.length === 0) return recordIds;

  const { clause, params } = buildFilterClause(filters);
  if (!clause) return recordIds;

  const placeholders = recordIds.map(() => "?").join(",");
  const rows = db
    .prepare(`SELECT r.id FROM records r WHERE r.id IN (${placeholders}) AND ${clause}`)
    .all(...recordIds, ...params) as Array<{ id: string }>;

  const matchingSet = new Set(rows.map((r) => r.id));
  return recordIds.filter((id) => matchingSet.has(id));
}
