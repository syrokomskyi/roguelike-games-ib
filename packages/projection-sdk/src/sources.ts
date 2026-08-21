/*
<MODULE_CONTRACT>
<purpose>Reads source bindings from materialized output and finds sources by ID.</purpose>
<non-goals>
  <item>Does not create bindings — reading and querying only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: readSources, findSourceById.</item>
</CHANGE_SUMMARY>
*/
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { canonicalJsonParse } from "@roguelike-games-ib/knowledge-core";
import type { SourceBinding } from "@roguelike-games-ib/knowledge-core";

export function readSources(distDir: string): SourceBinding[] {
  const path = join(distDir, "sources.json");
  if (!existsSync(path)) return [];
  const raw = readFileSync(path, "utf-8");
  const parsed = canonicalJsonParse(raw) as { sources: SourceBinding[] };
  return parsed.sources;
}

export function findSourceById(sources: SourceBinding[], sourceId: string): SourceBinding | undefined {
  return sources.find((s) => s.source_id === sourceId);
}
