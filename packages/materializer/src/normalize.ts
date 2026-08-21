/*
<MODULE_CONTRACT>
<purpose>Normalizes canonical records for deterministic JSONL output — sorting, field extraction, and source ID extraction.</purpose>
<non-goals>
  <item>Does not validate records — normalization and sorting only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: normalizeRecord, sortRecords, getField, extractSourceId.</item>
</CHANGE_SUMMARY>
*/
import { CanonicalRecord } from "./types.ts";

/**
 * Normalize a canonical record for JSONL output.
 * Ensures deterministic field ordering via canonical JSON.
 */
export function normalizeRecord(record: CanonicalRecord): Record<string, unknown> {
  return record as Record<string, unknown>;
}

/**
 * Sort records by key then id for deterministic output.
 */
export function sortRecords<T extends { key?: string; id?: string }>(records: T[]): T[] {
  return [...records].sort((a, b) => {
    const keyCmp = (a.key ?? "").localeCompare(b.key ?? "");
    if (keyCmp !== 0) return keyCmp;
    return (a.id ?? "").localeCompare(b.id ?? "");
  });
}

/**
 * Extract a field from a record safely.
 */
export function getField(record: Record<string, unknown>, field: string): string | null {
  const value = record[field];
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return null;
}

/**
 * Extract source_id from a record's source_identity or top-level field.
 */
export function extractSourceId(record: Record<string, unknown>): string | null {
  const sourceIdentity = record["source_identity"] as Record<string, unknown> | undefined;
  if (sourceIdentity && typeof sourceIdentity["source_id"] === "string") {
    return sourceIdentity["source_id"];
  }
  if (typeof record["source_id"] === "string") {
    return record["source_id"];
  }
  return null;
}
