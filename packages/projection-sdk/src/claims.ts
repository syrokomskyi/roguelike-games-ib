/*
<MODULE_CONTRACT>
<purpose>Reads claims from materialized output.</purpose>
<non-goals>
  <item>Does not validate claims — reading only.</item>
  <item>Does not provide query helpers — use ProjectionStore methods.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: readClaims, claimsForRecord, claimsReferencingRecord.</item>
  <item>Removed query helpers — use ProjectionStore.claimsForRecord and ProjectionStore.claimsReferencingRecord.</item>
</CHANGE_SUMMARY>
*/
import { readJsonlFile } from "@roguelike-games-ib/materializer";
import { join } from "node:path";
import type { ClaimRecord } from "@roguelike-games-ib/knowledge-core";

export function readClaims(distDir: string): ClaimRecord[] {
  return readJsonlFile(join(distDir, "claims.jsonl")) as unknown as ClaimRecord[];
}
