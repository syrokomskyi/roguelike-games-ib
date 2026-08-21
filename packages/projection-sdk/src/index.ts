/*
<MODULE_CONTRACT>
<purpose>Barrel export for projection-sdk — open, manifest, records, sources, graph, claims, evidence, coverage, and authority modules.</purpose>
<non-goals>
  <item>Does not implement business logic — re-exports from submodules.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: projection-sdk barrel exporting all public types and functions.</item>
</CHANGE_SUMMARY>
*/
export { openProjection, resolveRecord, resolveRecordById, resolveRecordByKey, resolveRecordByAlias } from "./open.ts";
export type { ProjectionStore } from "./open.ts";
export { readManifest, isManifestSupported, SUPPORTED_MANIFEST_SCHEMA } from "./manifest.ts";
export { readRecords, findRecordById, findRecordByKey, readKeyMap, readAliasMap, resolveKeyToId, resolveAliasToKey, resolveAliasToId } from "./records.ts";
export type { KeyMap, AliasMap } from "./records.ts";
export { readSources, findSourceById } from "./sources.ts";
export { readRelations, relationsForRecord, groupRelationsByType } from "./graph.ts";
export { readClaims, claimsForRecord, claimsReferencingRecord } from "./claims.ts";
export { readPublicEvidence, evidenceForClaim, isRestricted, buildEvidenceUrl } from "./evidence.ts";
export { readCoverage, coverageForSource } from "./coverage.ts";
export { canonicalAuthority, laboratoryAuthority, isCanonical, isLaboratory } from "./authority.ts";
export type { Authority, AuthorityContext } from "./authority.ts";
