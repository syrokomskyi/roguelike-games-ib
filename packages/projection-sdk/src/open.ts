import { join } from "node:path";
import { readManifest, isManifestSupported } from "./manifest.ts";
import { readRecords, readKeyMap, readAliasMap, type KeyMap, type AliasMap } from "./records.ts";
import { readSources } from "./sources.ts";
import { readRelations } from "./graph.ts";
import { readClaims } from "./claims.ts";
import { readPublicEvidence } from "./evidence.ts";
import { readCoverage } from "./coverage.ts";
import { canonicalAuthority, type AuthorityContext } from "./authority.ts";
import type { CanonicalRecord } from "@roguelike-games-ib/materializer";
import type { RelationRecord, ClaimRecord, SourceBinding, CoverageRecord } from "@roguelike-games-ib/knowledge-core";
import type { PublicEvidence } from "@roguelike-games-ib/materializer";

export interface ProjectionStore {
  distDir: string;
  canonicalHash: string;
  authority: AuthorityContext;
  records: CanonicalRecord[];
  keyMap: KeyMap;
  aliasMap: AliasMap;
  sources: SourceBinding[];
  relations: RelationRecord[];
  claims: ClaimRecord[];
  evidence: PublicEvidence[];
  coverage: CoverageRecord[];
}

export function openProjection(distDir: string): ProjectionStore {
  const manifest = readManifest(distDir);
  if (!isManifestSupported(manifest)) {
    throw new Error(
      `Unsupported materialization manifest schema: ${manifest.schema}. Expected ${"rgkb/materialization-manifest@2"}.`,
    );
  }

  return {
    distDir,
    canonicalHash: manifest.canonicalHash,
    authority: canonicalAuthority(manifest.canonicalHash),
    records: readRecords(distDir),
    keyMap: readKeyMap(distDir),
    aliasMap: readAliasMap(distDir),
    sources: readSources(distDir),
    relations: readRelations(distDir),
    claims: readClaims(distDir),
    evidence: readPublicEvidence(distDir),
    coverage: readCoverage(distDir),
  };
}

export function resolveRecordById(store: ProjectionStore, id: string): CanonicalRecord | undefined {
  return store.records.find((r) => r.id === id);
}

export function resolveRecordByKey(store: ProjectionStore, key: string): CanonicalRecord | undefined {
  return store.records.find((r) => r.key === key);
}

export function resolveRecordByAlias(store: ProjectionStore, oldKey: string): CanonicalRecord | undefined {
  const currentKey = store.aliasMap[oldKey];
  if (!currentKey) return undefined;
  return resolveRecordByKey(store, currentKey);
}

export function resolveRecord(store: ProjectionStore, identifier: string): CanonicalRecord | undefined {
  return resolveRecordById(store, identifier)
    ?? resolveRecordByKey(store, identifier)
    ?? resolveRecordByAlias(store, identifier);
}
