/*
<MODULE_CONTRACT>
<purpose>Reads claims from materialized output and provides query helpers for finding claims by subject or object reference.</purpose>
<non-goals>
  <item>Does not validate claims — reading and querying only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: readClaims, claimsForRecord, claimsReferencingRecord.</item>
</CHANGE_SUMMARY>
*/
import { readJsonlFile } from "@roguelike-games-ib/materializer";
import { join } from "node:path";
import type { ClaimRecord } from "@roguelike-games-ib/knowledge-core";

export function readClaims(distDir: string): ClaimRecord[] {
  return readJsonlFile(join(distDir, "claims.jsonl")) as unknown as ClaimRecord[];
}

export function claimsForRecord(claims: ClaimRecord[], recordId: string): ClaimRecord[] {
  return claims.filter((c) => c.subject_id === recordId);
}

export function claimsReferencingRecord(claims: ClaimRecord[], recordId: string): ClaimRecord[] {
  return claims.filter((c) => c.object_ref === recordId);
}
