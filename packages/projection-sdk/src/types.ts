/*
<MODULE_CONTRACT>
<purpose>Defines the IProjectionStore interface that abstracts projection data access, enabling both filesystem-backed (ProjectionStore) and D1-backed (D1ProjectionStore) implementations.</purpose>
<non-goals>
  <item>Does not implement data access — interface definitions only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: IProjectionStore interface, RecordFilter, RelationFilter types — extracted from ProjectionStore class for RFC-0020.</item>
</CHANGE_SUMMARY>
*/
import type { CanonicalRecord } from "@roguelike-games-ib/materializer";
import type { MaterializationManifest } from "@roguelike-games-ib/materializer";
import type { RelationRecord, ClaimRecord, SourceBinding, CoverageRecord } from "@roguelike-games-ib/knowledge-core";
import type { PublicEvidence } from "@roguelike-games-ib/materializer";

export interface RecordFilter {
  record_type?: string;
  semantic_type?: string;
  kind?: string;
  source_id?: string;
  concept_type?: string;
}

export interface RelationFilter {
  relation_scope?: string;
  relation_types?: string[];
  record_id?: string;
}

export interface IProjectionStore {
  readonly manifest: MaterializationManifest;
  readonly canonicalHash: string;

  resolveRecordById(id: string): Promise<CanonicalRecord | undefined>;
  resolveRecordByKey(key: string): Promise<CanonicalRecord | undefined>;
  resolveRecord(identifier: string): Promise<CanonicalRecord | undefined>;

  findRecords(filter: RecordFilter): Promise<CanonicalRecord[]>;
  findAllRecords(): Promise<CanonicalRecord[]>;

  claimsForRecord(recordId: string): Promise<ClaimRecord[]>;
  claimsReferencingRecord(recordId: string): Promise<ClaimRecord[]>;
  findClaimsByPredicate(predicate: string, sourceId?: string, assertionState?: string): Promise<ClaimRecord[]>;
  findAllClaims(): Promise<ClaimRecord[]>;

  relationsForRecord(recordId: string): Promise<{ outgoing: RelationRecord[]; incoming: RelationRecord[] }>;
  findRelations(filter: RelationFilter): Promise<RelationRecord[]>;
  findAllRelations(): Promise<RelationRecord[]>;

  findEvidenceById(id: string): Promise<PublicEvidence | undefined>;
  evidenceForClaim(evidenceRefs: string[]): Promise<PublicEvidence[]>;

  findCoverageBySource(sourceId: string): Promise<CoverageRecord[]>;

  findSourceById(sourceId: string): Promise<SourceBinding | undefined>;
  findAllSources(): Promise<SourceBinding[]>;
}
