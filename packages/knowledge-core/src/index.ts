/*
<MODULE_CONTRACT>
<purpose>Barrel export for knowledge-core — config, errors, serialization, hashing, source, identity, evidence, graph, coverage, and transaction modules.</purpose>
<non-goals>
  <item>Does not implement business logic — re-exports from submodules.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: knowledge-core barrel exporting all public types and functions.</item>
</CHANGE_SUMMARY>
*/
// Config & paths
export { readKnowledgeConfig, readKnowledgeManifest, resolveKnowledgePaths, resolveSourceRoot } from "./config.ts";
export type { KnowledgeConfig, KnowledgeManifest } from "./config.ts";

// Errors
export {
  KnowledgeCoreError,
  SourceRootError,
  SourceMetadataError,
  IdentityError,
  EvidenceError,
  GraphIntegrityError,
  TransactionError,
  SchemaValidationError,
} from "./errors.ts";

// Canonical serialization
export { canonicalJsonStringify, canonicalJsonParse, toJsonlLine, parseJsonl, serializeJsonl } from "./canonical-json.ts";
export { canonicalYamlStringify, canonicalYamlParse } from "./canonical-yaml.ts";

// Hashing
export {
  sha256,
  sha256File,
  computeRecordHash,
  computeCanonicalHash,
  computeSourceFingerprint,
  computeBindingDigest,
  computeFragmentHash,
} from "./hash.ts";

// Source
export { resolveSourceBundleRoot, validateSourcePath, assertNoSourceOverride } from "./source/root.ts";
export type { ResolvedSourceRoot } from "./source/root.ts";
export { readSourceMetadata } from "./source/metadata.ts";
export type { SourceMetadata } from "./source/metadata.ts";
export { createFingerprintResult } from "./source/fingerprint.ts";
export type { FingerprintResult } from "./source/fingerprint.ts";
export { createSourceBinding } from "./source/binding.ts";
export type { SourceBinding } from "./source/binding.ts";
export { detectSourceDrift } from "./source/drift.ts";
export type { DriftResult } from "./source/drift.ts";
export { ReadonlySource } from "./source/read-guard.ts";

// Identity
export { createRecordId, isValidRecordId } from "./identity/ids.ts";
export { readKeyRegistry, writeKeyRegistry, assertNoDuplicates, resolveRecordKey } from "./identity/keys.ts";
export type { KeyEntry } from "./identity/keys.ts";
export { readAliasRegistry, writeAliasRegistry, assertNoAliasCollisions, resolveAlias } from "./identity/aliases.ts";
export type { AliasEntry } from "./identity/aliases.ts";
export { matchDefinitionOnRefresh } from "./identity/refresh-match.ts";
export type { RefreshMatchResult } from "./identity/refresh-match.ts";

// Evidence
export { createEvidenceAnchor, validateEvidenceAnchor } from "./evidence/resolve.ts";
export type { EvidenceAnchor } from "./evidence/resolve.ts";
export { reanchorEvidence } from "./evidence/reanchor.ts";
export type { ReanchorResult } from "./evidence/reanchor.ts";
export { defaultPublicPolicy, defaultPrivatePolicy, validatePublicationPolicy } from "./evidence/publication.ts";
export type { PublicationPolicy, ExcerptPolicy, AccessLevel } from "./evidence/publication.ts";

// Graph
export { validateClaims } from "./graph/claims.ts";
export type { ClaimRecord } from "./graph/claims.ts";
export { validateRelations } from "./graph/relations.ts";
export type { RelationRecord, RelationTypeDefinition } from "./graph/relations.ts";
export { validateContradictions } from "./graph/contradictions.ts";
export type { ContradictionRecord } from "./graph/contradictions.ts";
export { validateReferences, isCanonicalRecordId, collectReferences } from "./graph/references.ts";

// Coverage
export { computeDimensionState, computeCoverage, assertNoCompleteBoolean } from "./coverage/compute.ts";
export type { CoverageDimension, CoverageState, DenominatorKind, CoverageRecord } from "./coverage/dimensions.ts";

// Transaction
export { createCandidateBatch } from "./transaction/candidate.ts";
export type { CandidateRecord, CandidateBatch } from "./transaction/candidate.ts";
export { preparePromotion } from "./transaction/plan.ts";
export type { TransactionOperation, TransactionPlan, TransactionDiagnostic, TransactionStatus } from "./transaction/plan.ts";
export { TransactionLock } from "./transaction/lock.ts";
export { applyPromotionTransaction } from "./transaction/apply.ts";
export { recoverInterruptedTransaction } from "./transaction/recover.ts";

// Graph validation convenience
export { validateCanonicalGraph } from "./graph/validate.ts";
