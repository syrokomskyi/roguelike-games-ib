/*
<MODULE_CONTRACT>
<purpose>Canonical JSON serialization with sorted keys, JSONL utilities, and deterministic record ordering.</purpose>
<non-goals>
  <item>Does not validate JSON schema — canonicalization only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: canonical JSON stringify/parse, JSONL line/parse/serialize utilities.</item>
</CHANGE_SUMMARY>
*/
/**
 * Canonical JSON serialization per RFC-8785-like rules.
 * - UTF-8
 * - No extra whitespace
 * - Sorted object keys (recursive)
 * - No trailing newline in the stringify output
 */

export function canonicalJsonStringify(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value));
}

export function canonicalJsonParse(text: string): unknown {
  return sortKeysDeep(JSON.parse(text));
}

function sortKeysDeep(value: unknown): unknown {
  if (value === null || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }

  const sorted: Record<string, unknown> = {};
  const keys = Object.keys(value as Record<string, unknown>).sort();
  for (const key of keys) {
    sorted[key] = sortKeysDeep((value as Record<string, unknown>)[key]);
  }
  return sorted;
}

/**
 * Serialize a single record to a canonical JSONL line.
 * One JSON object per line, no trailing newline.
 */
export function toJsonlLine(record: unknown): string {
  return canonicalJsonStringify(record);
}

/**
 * Parse JSONL text into an array of records.
 * Empty lines are skipped.
 */
export function parseJsonl(text: string): unknown[] {
  const lines = text.split("\n");
  const records: unknown[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === "") continue;
    records.push(canonicalJsonParse(trimmed));
  }
  return records;
}

/**
 * Serialize an array of records to canonical JSONL.
 * Records are sorted by `key` then `id` (if present).
 * Each record is one line, lines separated by \n, with a trailing newline.
 */
export function serializeJsonl(records: unknown[]): string {
  const sorted = [...records].sort((a, b) => {
    const aKey = (a as Record<string, unknown>)?.key as string | undefined;
    const bKey = (b as Record<string, unknown>)?.key as string | undefined;
    const aId = (a as Record<string, unknown>)?.id as string | undefined;
    const bId = (b as Record<string, unknown>)?.id as string | undefined;

    const keyCmp = (aKey ?? "").localeCompare(bKey ?? "");
    if (keyCmp !== 0) return keyCmp;
    return (aId ?? "").localeCompare(bId ?? "");
  });

  return sorted.map((r) => toJsonlLine(r)).join("\n") + "\n";
}
