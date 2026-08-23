/*
<MODULE_CONTRACT>
<purpose>Barrel export for materializer — build, types, verification, public evidence, SQLite, manifest, checksums, JSONL, and normalize modules.</purpose>
<non-goals>
  <item>Does not implement business logic — re-exports from submodules.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: materializer barrel exporting all public types and functions.</item>
</CHANGE_SUMMARY>
*/
export { materialize, readState, verifyState } from "./build.ts";
export type { MaterializationOptions, MaterializationResult, MaterializationManifest, CanonicalRecord, CanonicalState, VerificationResult, QualityScore, QualityScoringConfig } from "./types.ts";
export { readCanonicalState, verifyCanonicalState } from "./verify-input.ts";
export { redactPublicEvidence, isPublicEvidence, isRestrictedEvidence } from "./public-evidence.ts";
export type { PublicEvidence } from "./public-evidence.ts";
export { buildSqlite, verifySqliteIntegrity, computeLogicalDumpHash } from "./sqlite.ts";
export type { SqliteBuildResult } from "./sqlite.ts";
export { createManifest, writeManifest } from "./manifest.ts";
export { computeChecksums, fileSha256 } from "./checksums.ts";
export {
  writeRecordsJsonl,
  writeClaimsJsonl,
  writeRelationsJsonl,
  writePublicEvidenceJsonl,
  writeSourcesJson,
  writeCoverageJson,
  writeKeyMapJson,
  writeAliasMapJson,
  readJsonlFile,
} from "./records-jsonl.ts";
export { sortRecords, normalizeRecord, getField, extractSourceId } from "./normalize.ts";
export { computeQualityScores, DEFAULT_QUALITY_SCORING_CONFIG } from "./quality-scores.ts";
