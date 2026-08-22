/*
<MODULE_CONTRACT>
<purpose>Derived data helpers for web pages — compare rows, source-filtered record lists, stats, and record counts by source.</purpose>
<non-goals>
  <item>Does not fetch or mutate data — pure projection over ProjectionStore.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: compare rows, source record lists, mechanics/systems helpers, stats.</item>
  <item>Added countRecordsBySource helper to deduplicate recordsBySource logic across pages.</item>
</CHANGE_SUMMARY>
*/
import type { ProjectionStore } from "@roguelike-games-ib/projection-sdk";

export function getSpritePath(record: Record<string, unknown>): string | null {
  const attrs = record["attributes"] as Record<string, unknown> | undefined;
  return (attrs?.["sprite_path"] as string | null) ?? null;
}

export function getSourceId(record: Record<string, unknown>): string {
  const si = record["source_identity"] as Record<string, unknown> | undefined;
  const scope = record["scope"] as Record<string, unknown> | undefined;
  return (si?.["source_id"] as string | undefined) ?? (scope?.["source_id"] as string | undefined) ?? "";
}

export interface CompareRow {
  record_id: string;
  record_key: string;
  record_type: string;
  kind: string | null;
  title: string | null;
  summary: string | null;
  claim_count: number;
  outgoing_relation_count: number;
  incoming_relation_count: number;
  source_id: string;
  sprite_path: string | null;
}

export function buildCompareRows(store: ProjectionStore): CompareRow[] {
  return store.records.map((r) => {
    const claims = store.claimsForRecord(r.id);
    const { outgoing, incoming } = store.relationsForRecord(r.id);
    const ra = r as Record<string, unknown>;
    const source_id = getSourceId(ra) || "all";
    return {
      record_id: r.id,
      record_key: r.key,
      record_type: r.record_type,
      kind: (ra["kind"] as string | null) ?? null,
      title: (ra["title"] as string | null) ?? null,
      summary: (ra["summary"] as string | null) ?? null,
      claim_count: claims.length,
      outgoing_relation_count: outgoing.length,
      incoming_relation_count: incoming.length,
      source_id,
      sprite_path: getSpritePath(ra),
    };
  });
}

export interface GameRecord {
  id: string;
  key: string;
  record_type: string;
  source_id: string;
  sprite_path: string | null;
}

export function recordsForSource(store: ProjectionStore, sourceId: string): GameRecord[] {
  return store.records.filter((r) => {
    const ra = r as Record<string, unknown>;
    return getSourceId(ra) === sourceId;
  }).map((r) => {
    const ra = r as Record<string, unknown>;
    return {
      id: r.id,
      key: r.key,
      record_type: r.record_type,
      source_id: getSourceId(ra),
      sprite_path: getSpritePath(ra),
    };
  });
}

export interface SimpleRecord {
  key: string;
  title: string | undefined;
  summary: string | undefined;
  sprite_path: string | null;
}

export function mechanicsForSource(store: ProjectionStore, sourceId: string): SimpleRecord[] {
  return store.records.filter((r) => {
    const ra = r as Record<string, unknown>;
    const isMechanic = r.record_type === "mechanic" || (r.record_type === "semantic_record" && ra["semantic_type"] === "mechanic");
    if (!isMechanic) return false;
    return getSourceId(ra) === sourceId;
  }).map((r) => {
    const ra = r as Record<string, unknown>;
    return {
      key: r.key,
      title: ra["title"] as string | undefined,
      summary: ra["summary"] as string | undefined,
      sprite_path: getSpritePath(ra),
    };
  });
}

export function systemsForSource(store: ProjectionStore, sourceId: string): SimpleRecord[] {
  return store.records.filter((r) => {
    const ra = r as Record<string, unknown>;
    const isSystem = r.record_type === "system" || (r.record_type === "semantic_record" && ra["semantic_type"] === "system");
    if (!isSystem) return false;
    return getSourceId(ra) === sourceId;
  }).map((r) => {
    const ra = r as Record<string, unknown>;
    return {
      key: r.key,
      title: ra["title"] as string | undefined,
      summary: ra["summary"] as string | undefined,
      sprite_path: getSpritePath(ra),
    };
  });
}

export function defRecordsForSourceKind(store: ProjectionStore, sourceId: string, kind: string): { key: string; sprite_path: string | null }[] {
  return store.records.filter((r) => {
    const ra = r as Record<string, unknown>;
    return getSourceId(ra) === sourceId && r.record_type === kind;
  }).map((r) => {
    const ra = r as Record<string, unknown>;
    return { key: r.key, sprite_path: getSpritePath(ra) };
  });
}

export function kindsForSource(store: ProjectionStore, sourceId: string): string[] {
  const sourceRecords = store.records.filter((r) => {
    const ra = r as Record<string, unknown>;
    return getSourceId(ra) === sourceId;
  });
  return [...new Set(sourceRecords.map((r) => r.record_type))].sort();
}

export interface AncestryNode {
  record_id: string;
  record_key: string;
  record_type: string;
  title: string | null;
  depth: number;
  sprite_path: string | null;
  source_id: string;
}

export function getStats(store: ProjectionStore) {
  const records = store.records;
  return {
    records: records.length,
    sources: store.sources.length,
    claims: store.claims.length,
    relations: store.relations.length,
    concepts: records.filter((r) => r.record_type === "concept").length,
    mechanics: records.filter((r) => {
      const ra = r as Record<string, unknown>;
      return r.record_type === "semantic_record" && ra["semantic_type"] === "mechanic";
    }).length,
    systems: records.filter((r) => {
      const ra = r as Record<string, unknown>;
      return r.record_type === "semantic_record" && ra["semantic_type"] === "system";
    }).length,
  };
}

export function countRecordsBySource(store: ProjectionStore): Map<string, number> {
  const map = new Map<string, number>();
  for (const r of store.records) {
    const sid = getSourceId(r as Record<string, unknown>);
    if (sid) map.set(sid, (map.get(sid) ?? 0) + 1);
  }
  return map;
}
