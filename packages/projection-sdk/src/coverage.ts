/*
<MODULE_CONTRACT>
<purpose>Reads coverage records from materialized output.</purpose>
<non-goals>
  <item>Does not compute coverage — reading only.</item>
  <item>Does not provide query helpers — use ProjectionStore.coverageForSource.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: readCoverage, coverageForSource.</item>
  <item>Removed coverageForSource — use ProjectionStore.coverageForSource.</item>
</CHANGE_SUMMARY>
*/
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
