/*
<MODULE_CONTRACT>
<purpose>Reads source bindings from materialized output.</purpose>
<non-goals>
  <item>Does not create bindings — reading only.</item>
  <item>Does not provide query helpers — use ProjectionStore.findSourceById.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: readSources, findSourceById.</item>
  <item>Removed findSourceById — use ProjectionStore.findSourceById.</item>
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
