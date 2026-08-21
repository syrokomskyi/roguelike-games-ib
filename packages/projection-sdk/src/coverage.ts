import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { canonicalJsonParse } from "@roguelike-games-ib/knowledge-core";
import type { CoverageRecord } from "@roguelike-games-ib/knowledge-core";

export function readCoverage(distDir: string): CoverageRecord[] {
  const path = join(distDir, "coverage.json");
  if (!existsSync(path)) return [];
  const raw = readFileSync(path, "utf-8");
  const parsed = canonicalJsonParse(raw) as { records: CoverageRecord[] };
  return parsed.records;
}

export function coverageForSource(coverage: CoverageRecord[], sourceId: string): CoverageRecord[] {
  return coverage.filter((c) => c.source_id === sourceId);
}
