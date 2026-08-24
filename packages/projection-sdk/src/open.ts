/*
<MODULE_CONTRACT>
<purpose>Opens a projection store from materialized dist directory — deep module with query methods for record resolution, claims, relations, evidence, coverage, and sources.</purpose>
<non-goals>
  <item>Does not materialize — reads pre-materialized output only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: ProjectionStore type, openProjection, resolveRecordById, resolveRecordByKey, resolveRecordByAlias, resolveRecord.</item>
  <item>Deepened: ProjectionStore is now a class with query methods; read functions are private implementation; manifest exposed through store; authority removed.</item>
  <item>RFC-0020: ProjectionStore implements IProjectionStore; all query methods are async; added findRecords, findAllRecords, findClaimsByPredicate, findAllClaims, findRelations, findAllRelations, findEvidenceById, findCoverageBySource, findAllSources.</item>
</CHANGE_SUMMARY>
*/
import { readManifest, isManifestSupported, SUPPORTED_MANIFEST_SCHEMA } from "./manifest.ts";
import type { MaterializationManifest } from "@roguelike-games-ib/materializer";
import { readRecords, readKeyMap, readAliasMap, type KeyMap, type AliasMap } from "./records.ts";
import { readSources } from "./sources.ts";
import { readRelations } from "./graph.ts";
import { readClaims } from "./claims.ts";
import { readPublicEvidence } from "./evidence.ts";
import { readCoverage } from "./coverage.ts";
import type { CanonicalRecord } from "@roguelike-games-ib/materializer";
import type { RelationRecord, ClaimRecord, SourceBinding, CoverageRecord } from "@roguelike-games-ib/knowledge-core";
import type { PublicEvidence } from "@roguelike-games-ib/materializer";
import type { IProjectionStore, RecordFilter, RelationFilter } from "./types.ts";

export class ProjectionStore implements IProjectionStore {
  readonly distDir: string;
  readonly canonicalHash: string;
  readonly manifest: MaterializationManifest;
  readonly records: CanonicalRecord[];
  readonly keyMap: KeyMap;
  readonly aliasMap: AliasMap;
  readonly sources: SourceBinding[];
  readonly relations: RelationRecord[];
  readonly claims: ClaimRecord[];
  readonly evidence: PublicEvidence[];
  readonly coverage: CoverageRecord[];

  private constructor(params: {
    distDir: string;
    manifest: MaterializationManifest;
    records: CanonicalRecord[];
    keyMap: KeyMap;
    aliasMap: AliasMap;
    sources: SourceBinding[];
    relations: RelationRecord[];
    claims: ClaimRecord[];
    evidence: PublicEvidence[];
    coverage: CoverageRecord[];
  }) {
    this.distDir = params.distDir;
    this.manifest = params.manifest;
    this.canonicalHash = params.manifest.canonicalHash;
    this.records = params.records;
    this.keyMap = params.keyMap;
    this.aliasMap = params.aliasMap;
    this.sources = params.sources;
    this.relations = params.relations;
    this.claims = params.claims;
    this.evidence = params.evidence;
    this.coverage = params.coverage;
  }

  static open(distDir: string): ProjectionStore {
    const manifest = readManifest(distDir);
    if (!isManifestSupported(manifest)) {
      throw new Error(
        `Unsupported materialization manifest schema: ${manifest.schema}. Expected ${SUPPORTED_MANIFEST_SCHEMA}.`,
      );
    }
    return new ProjectionStore({
      distDir,
      manifest,
      records: readRecords(distDir),
      keyMap: readKeyMap(distDir),
      aliasMap: readAliasMap(distDir),
      sources: readSources(distDir),
      relations: readRelations(distDir),
      claims: readClaims(distDir),
      evidence: readPublicEvidence(distDir),
      coverage: readCoverage(distDir),
    });
  }

  async resolveRecordById(id: string): Promise<CanonicalRecord | undefined> {
    return this.records.find((r) => r.id === id);
  }

  async resolveRecordByKey(key: string): Promise<CanonicalRecord | undefined> {
    return this.records.find((r) => r.key === key);
  }

  async resolveRecordByAlias(oldKey: string): Promise<CanonicalRecord | undefined> {
    const currentKey = this.aliasMap[oldKey];
    if (!currentKey) return undefined;
    return this.resolveRecordByKey(currentKey);
  }

  async resolveRecord(identifier: string): Promise<CanonicalRecord | undefined> {
    return (await this.resolveRecordById(identifier))
      ?? (await this.resolveRecordByKey(identifier))
      ?? (await this.resolveRecordByAlias(identifier));
  }

  async findRecords(filter: RecordFilter): Promise<CanonicalRecord[]> {
    return this.records.filter((r) => {
      if (filter.record_type && r.record_type !== filter.record_type) return false;
      if (filter.kind && (r as unknown as Record<string, unknown>)["kind"] !== filter.kind) return false;
      if (filter.source_id) {
        const si = (r as unknown as Record<string, unknown>)["source_identity"] as Record<string, unknown> | undefined;
        const scope = (r as unknown as Record<string, unknown>)["scope"] as Record<string, unknown> | undefined;
        const sid = si?.["source_id"] ?? scope?.["source_id"];
        if (sid !== filter.source_id) return false;
      }
      if (filter.semantic_type) {
        const st = (r as unknown as Record<string, unknown>)["semantic_type"];
        if (st !== filter.semantic_type) return false;
      }
      if (filter.concept_type) {
        const ct = (r as unknown as Record<string, unknown>)["concept_type"];
        if (ct !== filter.concept_type) return false;
      }
      return true;
    });
  }

  async findAllRecords(): Promise<CanonicalRecord[]> {
    return this.records;
  }

  async claimsForRecord(recordId: string): Promise<ClaimRecord[]> {
    return this.claims.filter((c) => c.subject_id === recordId);
  }

  async claimsReferencingRecord(recordId: string): Promise<ClaimRecord[]> {
    return this.claims.filter((c) => c.object_ref === recordId);
  }

  async findClaimsByPredicate(predicate: string, sourceId?: string, assertionState?: string): Promise<ClaimRecord[]> {
    let claims = this.claims.filter((c) => c.predicate === predicate);
    if (sourceId) {
      claims = claims.filter((c) => {
        const record = this.records.find((r) => r.id === c.subject_id);
        if (!record) return false;
        const si = (record as unknown as Record<string, unknown>)["source_identity"] as Record<string, unknown> | undefined;
        return si?.["source_id"] === sourceId;
      });
    }
    if (assertionState) {
      claims = claims.filter((c) => c.assertion_state === assertionState);
    }
    return claims;
  }

  async findAllClaims(): Promise<ClaimRecord[]> {
    return this.claims;
  }

  async relationsForRecord(recordId: string): Promise<{ outgoing: RelationRecord[]; incoming: RelationRecord[] }> {
    const outgoing = this.relations.filter((r) => r.source_record_id === recordId);
    const incoming = this.relations.filter((r) => r.target_record_id === recordId);
    return { outgoing, incoming };
  }

  async findRelations(filter: RelationFilter): Promise<RelationRecord[]> {
    return this.relations.filter((r) => {
      if (filter.relation_scope && r.relation_scope !== filter.relation_scope) return false;
      if (filter.relation_types && !filter.relation_types.includes(r.relation_type)) return false;
      if (filter.record_id && r.source_record_id !== filter.record_id && r.target_record_id !== filter.record_id) return false;
      return true;
    });
  }

  async findAllRelations(): Promise<RelationRecord[]> {
    return this.relations;
  }

  async findEvidenceById(id: string): Promise<PublicEvidence | undefined> {
    return this.evidence.find((e) => e.id === id);
  }

  async evidenceForClaim(evidenceRefs: string[]): Promise<PublicEvidence[]> {
    const refSet = new Set(evidenceRefs);
    return this.evidence.filter((e) => refSet.has(e.id));
  }

  async findCoverageBySource(sourceId: string): Promise<CoverageRecord[]> {
    return this.coverage.filter((c) => c.source_id === sourceId);
  }

  async findSourceById(sourceId: string): Promise<SourceBinding | undefined> {
    return this.sources.find((s) => s.source_id === sourceId);
  }

  async findAllSources(): Promise<SourceBinding[]> {
    return this.sources;
  }

  coverageForSource(sourceId: string): CoverageRecord[] {
    return this.coverage.filter((c) => c.source_id === sourceId);
  }
}

export function openProjection(distDir: string): ProjectionStore {
  return ProjectionStore.open(distDir);
}
