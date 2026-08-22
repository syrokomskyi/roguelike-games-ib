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

export class ProjectionStore {
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

  resolveRecordById(id: string): CanonicalRecord | undefined {
    return this.records.find((r) => r.id === id);
  }

  resolveRecordByKey(key: string): CanonicalRecord | undefined {
    return this.records.find((r) => r.key === key);
  }

  resolveRecordByAlias(oldKey: string): CanonicalRecord | undefined {
    const currentKey = this.aliasMap[oldKey];
    if (!currentKey) return undefined;
    return this.resolveRecordByKey(currentKey);
  }

  resolveRecord(identifier: string): CanonicalRecord | undefined {
    return this.resolveRecordById(identifier)
      ?? this.resolveRecordByKey(identifier)
      ?? this.resolveRecordByAlias(identifier);
  }

  claimsForRecord(recordId: string): ClaimRecord[] {
    return this.claims.filter((c) => c.subject_id === recordId);
  }

  claimsReferencingRecord(recordId: string): ClaimRecord[] {
    return this.claims.filter((c) => c.object_ref === recordId);
  }

  relationsForRecord(recordId: string): {
    outgoing: RelationRecord[];
    incoming: RelationRecord[];
  } {
    const outgoing = this.relations.filter((r) => r.source_record_id === recordId);
    const incoming = this.relations.filter((r) => r.target_record_id === recordId);
    return { outgoing, incoming };
  }

  evidenceForClaim(evidenceRefs: string[]): PublicEvidence[] {
    const refSet = new Set(evidenceRefs);
    return this.evidence.filter((e) => refSet.has(e.id));
  }

  coverageForSource(sourceId: string): CoverageRecord[] {
    return this.coverage.filter((c) => c.source_id === sourceId);
  }

  findSourceById(sourceId: string): SourceBinding | undefined {
    return this.sources.find((s) => s.source_id === sourceId);
  }
}

export function openProjection(distDir: string): ProjectionStore {
  return ProjectionStore.open(distDir);
}
