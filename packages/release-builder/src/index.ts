/*
<MODULE_CONTRACT>
<purpose>Barrel export for release-builder — check, evidence, dataset manifest, build, and types.</purpose>
<non-goals>
  <item>Does not implement business logic — re-exports from submodules.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: release-builder barrel exporting all public types and functions.</item>
</CHANGE_SUMMARY>
*/
export { checkRelease } from "./check.ts";
export { generateReleaseEvidence } from "./evidence.ts";
export { createDatasetManifest } from "./dataset-manifest.ts";
export { buildRelease } from "./build.ts";
export type {
  ReleaseEvidence,
  DatasetManifest,
  ReleaseCheckResult,
  ReleaseBundleResult,
  ReleaseOptions,
} from "./types.ts";
