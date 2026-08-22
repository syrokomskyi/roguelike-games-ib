/*
<MODULE_CONTRACT>
<purpose>Builds path resolvers mapping canonical record IDs and keys to Obsidian vault file paths with slugification and disambiguation.</purpose>
<non-goals>
  <item>Does not render notes — path resolution only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: PathResolver type, buildPathResolver, resolvePathById, resolvePathByKey, resolvePathByAlias.</item>
</CHANGE_SUMMARY>
*/
import type { CanonicalRecord } from "@roguelike-games-ib/materializer";

export interface PathResolver {
  idToPath: Map<string, string>;
  keyToPath: Map<string, string>;
  pathToId: Map<string, string>;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function extractSourceId(record: CanonicalRecord): string | null {
  const si = record.source_identity as Record<string, unknown> | undefined;
  if (si && typeof si.source_id === "string") return si.source_id;
  if (typeof record.source_id === "string") return record.source_id;
  return null;
}

function extractScope(record: CanonicalRecord): string {
  const sourceId = extractSourceId(record);
  if (sourceId) return `games/${sourceId}`;
  const scope = record.scope as string | undefined;
  if (scope === "cross_game" || scope === "cross-game") return "cross-game";
  if (scope === "design") return "design";
  return "cross-game";
}

export function buildPathResolver(records: CanonicalRecord[]): PathResolver {
  const idToPath = new Map<string, string>();
  const keyToPath = new Map<string, string>();
  const pathToId = new Map<string, string>();

  for (const record of records) {
    const scope = extractScope(record);
    const typeSlug = slugify(record.record_type);
    const keySlug = slugify(record.key.split("/").pop() ?? record.key);
    const notePath = `${scope}/${typeSlug}/${keySlug}.md`;

    if (pathToId.has(notePath)) {
      const existingId = pathToId.get(notePath)!;
      throw new Error(`Path collision: "${notePath}" mapped by both "${existingId}" and "${record.id}"`);
    } else {
      idToPath.set(record.id, notePath);
      keyToPath.set(record.key, notePath);
      pathToId.set(notePath, record.id);
    }
  }

  return { idToPath, keyToPath, pathToId };
}

export function resolvePathById(resolver: PathResolver, id: string): string | undefined {
  return resolver.idToPath.get(id);
}

export function resolvePathByKey(resolver: PathResolver, key: string): string | undefined {
  return resolver.keyToPath.get(key);
}

export function resolvePathByAlias(
  resolver: PathResolver,
  aliasMap: Record<string, string>,
  oldKey: string,
): string | undefined {
  const currentKey = aliasMap[oldKey];
  if (!currentKey) return undefined;
  return resolvePathByKey(resolver, currentKey);
}
