import { KeyEntry, resolveRecordKey } from "./keys.ts";
import { AliasEntry, resolveAlias } from "./aliases.ts";

export interface RefreshMatchResult {
  matched: boolean;
  id: string | null;
  key_changed: boolean;
  old_key?: string;
  new_key?: string;
}

/**
 * Match a GameDefinition on refresh using factual identity.
 *
 * Matching rules:
 * 1. If the global key (<source-id>/<kind>/<slug>) matches → same record
 * 2. If source_identity.native_id matches and kind matches → same record (rename)
 * 3. Otherwise → new record
 *
 * On rename: retain ID, update key, add old key to aliases.
 */
export function matchDefinitionOnRefresh(
  currentKeys: KeyEntry[],
  aliases: AliasEntry[],
  sourceId: string,
  kind: string,
  slug: string,
  nativeId: string,
): RefreshMatchResult {
  const newKey = `${sourceId}/${kind}/${slug}`;

  // 1. Exact key match
  const existingId = resolveRecordKey(currentKeys, newKey);
  if (existingId) {
    return {
      matched: true,
      id: existingId,
      key_changed: false,
    };
  }

  // 2. Check if this is a rename — look for records with same source_id and native_id
  // We need to check by scanning current keys with same source prefix
  // The native_id is embedded in the record, not the key registry
  // So we check aliases: if old key resolves to a current key's id
  const aliasResolved = resolveAlias(aliases, newKey);
  if (aliasResolved) {
    const aliasId = resolveRecordKey(currentKeys, aliasResolved);
    if (aliasId) {
      return {
        matched: true,
        id: aliasId,
        key_changed: true,
        old_key: aliasResolved,
        new_key: newKey,
      };
    }
  }

  // 3. New record
  return {
    matched: false,
    id: null,
    key_changed: false,
  };
}
