export { materialize, readState, verifyState } from "./build.ts";
export type { MaterializationOptions, MaterializationResult, MaterializationManifest, CanonicalRecord, CanonicalState, VerificationResult } from "./types.ts";
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
