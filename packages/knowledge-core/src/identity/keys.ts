/*
<MODULE_CONTRACT>
<purpose>Reads, writes, and validates the key registry — record IDs mapped to keys with duplicate detection.</purpose>
<non-goals>
  <item>Does not generate record IDs — use ids module.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: KeyEntry type, readKeyRegistry, writeKeyRegistry, assertNoDuplicates, resolveRecordKey.</item>
</CHANGE_SUMMARY>
*/
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { canonicalJsonStringify, parseJsonl } from "../canonical-json.ts";
import { IdentityError } from "../errors.ts";

export interface KeyEntry {
  id: string;
  key: string;
  record_type: string;
}

/**
 * Read the key registry from keys.jsonl.
 */
export function readKeyRegistry(keysPath: string): KeyEntry[] {
  if (!existsSync(keysPath)) return [];
  const text = readFileSync(keysPath, "utf-8");
  return parseJsonl(text) as KeyEntry[];
}

/**
 * Write the key registry to keys.jsonl (canonical sorted JSONL).
 */
export function writeKeyRegistry(keysPath: string, entries: KeyEntry[]): void {
  const sorted = [...entries].sort((a, b) => a.key.localeCompare(b.key));
  const lines = sorted.map((e) => canonicalJsonStringify(e));
  writeFileSync(keysPath, lines.join("\n") + (lines.length > 0 ? "\n" : ""), "utf-8");
}

/**
 * Check for duplicate IDs or keys in the registry.
 * Throws IdentityError on collision.
 */
export function assertNoDuplicates(entries: KeyEntry[]): void {
  const seenIds = new Set<string>();
  const seenKeys = new Set<string>();

  for (const entry of entries) {
    if (seenIds.has(entry.id)) {
      throw new IdentityError(`Duplicate record ID: ${entry.id}`, { entry });
    }
    if (seenKeys.has(entry.key)) {
      throw new IdentityError(`Duplicate record key: ${entry.key}`, { entry });
    }
    seenIds.add(entry.id);
    seenKeys.add(entry.key);
  }
}

/**
 * Resolve a record key to its ID from the registry.
 */
export function resolveRecordKey(entries: KeyEntry[], key: string): string | null {
  const entry = entries.find((e) => e.key === key);
  return entry?.id ?? null;
}
