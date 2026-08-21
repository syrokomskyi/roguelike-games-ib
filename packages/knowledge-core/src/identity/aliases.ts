/*
<MODULE_CONTRACT>
<purpose>Reads, writes, and validates the alias registry — retired keys mapped to current keys with collision detection.</purpose>
<non-goals>
  <item>Does not create aliases — registry management only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: AliasEntry type, readAliasRegistry, writeAliasRegistry, assertNoAliasCollisions, resolveAlias.</item>
</CHANGE_SUMMARY>
*/
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { canonicalJsonStringify, parseJsonl } from "../canonical-json.ts";
import { IdentityError } from "../errors.ts";

export interface AliasEntry {
  key: string;
  retired_to: string;
  retired_at: string;
}

/**
 * Read the alias registry from aliases.jsonl.
 */
export function readAliasRegistry(aliasesPath: string): AliasEntry[] {
  if (!existsSync(aliasesPath)) return [];
  const text = readFileSync(aliasesPath, "utf-8");
  return parseJsonl(text) as AliasEntry[];
}

/**
 * Write the alias registry to aliases.jsonl (canonical sorted JSONL).
 */
export function writeAliasRegistry(aliasesPath: string, entries: AliasEntry[]): void {
  const sorted = [...entries].sort((a, b) => a.key.localeCompare(b.key));
  const lines = sorted.map((e) => canonicalJsonStringify(e));
  writeFileSync(aliasesPath, lines.join("\n") + (lines.length > 0 ? "\n" : ""), "utf-8");
}

/**
 * Check for alias collisions.
 * An alias key must not be in use as a current key or another alias.
 */
export function assertNoAliasCollisions(
  aliases: AliasEntry[],
  currentKeys: string[],
): void {
  const aliasKeys = new Set(aliases.map((a) => a.key));
  const currentKeySet = new Set(currentKeys);

  // No alias key can be a current key
  for (const aliasKey of aliasKeys) {
    if (currentKeySet.has(aliasKey)) {
      throw new IdentityError(
        `Alias key '${aliasKey}' collides with a current key`,
      );
    }
  }

  // No duplicate alias keys
  const seen = new Set<string>();
  for (const alias of aliases) {
    if (seen.has(alias.key)) {
      throw new IdentityError(`Duplicate alias key: ${alias.key}`);
    }
    seen.add(alias.key);
  }
}

/**
 * Resolve an old key through the alias registry to its current key.
 */
export function resolveAlias(aliases: AliasEntry[], oldKey: string): string | null {
  const entry = aliases.find((a) => a.key === oldKey);
  return entry?.retired_to ?? null;
}
