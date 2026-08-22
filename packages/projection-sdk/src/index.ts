/*
<MODULE_CONTRACT>
<purpose>Barrel export for projection-sdk — ProjectionStore class, openProjection factory, manifest validation, and standalone helpers.</purpose>
<non-goals>
  <item>Does not implement business logic — re-exports from submodules.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: projection-sdk barrel exporting all public types and functions.</item>
  <item>Deepened: exports ProjectionStore class with query methods; removed shallow satellite exports.</item>
  <item>Removed authority module exports.</item>
  <item>Removed dead resolution API exports.</item>
</CHANGE_SUMMARY>
*/
export { openProjection } from "./open.ts";
export type { ProjectionStore } from "./open.ts";
export { readManifest, isManifestSupported, SUPPORTED_MANIFEST_SCHEMA } from "./manifest.ts";
export type { KeyMap, AliasMap } from "./records.ts";
export { groupRelationsByType } from "./graph.ts";
export { isRestricted, buildEvidenceUrl } from "./evidence.ts";
