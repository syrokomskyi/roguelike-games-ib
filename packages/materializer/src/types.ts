/*
<MODULE_CONTRACT>
<purpose>Defines core types for the materializer — CanonicalRecord, CanonicalState, VerificationResult, MaterializationManifest, MaterializationOptions, MaterializationResult, QualityScore, QualityScoringConfig.</purpose>
<non-goals>
  <item>Does not implement materialization logic — type definitions only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: CanonicalRecord, CanonicalState, VerificationResult, MaterializationManifest, MaterializationOptions, MaterializationResult types.</item>
  <item>RFC-0009: Added QualityScore and QualityScoringConfig types for concept quality scoring.</item>
</CHANGE_SUMMARY>
*/
import { ClaimRecord } from "@roguelike-games-ib/knowledge-core";
import { RelationRecord } from "@roguelike-games-ib/knowledge-core";
import { ContradictionRecord } from "@roguelike-games-ib/knowledge-core";
import { EvidenceAnchor } from "@roguelike-games-ib/knowledge-core";
import { KeyEntry, AliasEntry } from "@roguelike-games-ib/knowledge-core";
import { SourceBinding } from "@roguelike-games-ib/knowledge-core";
import { CoverageRecord } from "@roguelike-games-ib/knowledge-core";
import { RelationTypeDefinition } from "@roguelike-games-ib/knowledge-core";

export interface CanonicalRecord {
  id: string;
  key: string;
  record_type: string;
  [key: string]: unknown;
}

export interface CanonicalState {
  records: CanonicalRecord[];
  claims: ClaimRecord[];
  relations: RelationRecord[];
  contradictions: ContradictionRecord[];
  evidence: EvidenceAnchor[];
  keys: KeyEntry[];
  aliases: AliasEntry[];
  bindings: SourceBinding[];
  coverage: CoverageRecord[];
  relationTypes: Map<string, RelationTypeDefinition>;
}

export interface VerificationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface MaterializationManifest {
  schema: string;
  datasetId: string;
  datasetVersion: string;
  modelVersion: string;
  canonicalHash: string;
  license: string;
  recordCounts: Record<string, number>;
  builtFromBindings: Record<string, string>;
  logicalDumpHash: string;
  builtAt: string;
}

export interface MaterializationOptions {
  workspaceRoot: string;
  distDir?: string;
}

export interface MaterializationResult {
  manifest: MaterializationManifest;
  canonicalHash: string;
  logicalDumpHash: string;
  recordCounts: Record<string, number>;
  outputFiles: string[];
  distDir: string;
}

export interface QualityScore {
  coverage: number;
  evidence: number;
  richness: number;
  overall: number;
}

export interface QualityScoringConfig {
  evidence_target: number;
  richness_target: number;
  richness_other_target: number;
  weights: { coverage: number; evidence: number; richness: number };
}
