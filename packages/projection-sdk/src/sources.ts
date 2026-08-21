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
