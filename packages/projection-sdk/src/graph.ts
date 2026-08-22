/*
<MODULE_CONTRACT>
<purpose>Reads relations from materialized output and provides grouping utility.</purpose>
<non-goals>
  <item>Does not validate relations — reading only.</item>
  <item>Does not provide per-record query helpers — use ProjectionStore.relationsForRecord.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: readRelations, relationsForRecord, groupRelationsByType.</item>
  <item>Removed relationsForRecord — use ProjectionStore.relationsForRecord.</item>
</CHANGE_SUMMARY>
*/
import { readJsonlFile } from "@roguelike-games-ib/materializer";
import { join } from "node:path";
import type { RelationRecord } from "@roguelike-games-ib/knowledge-core";

export function readRelations(distDir: string): RelationRecord[] {
  return readJsonlFile(join(distDir, "relations.jsonl")) as unknown as RelationRecord[];
}

export function groupRelationsByType(relations: RelationRecord[]): Map<string, RelationRecord[]> {
  const map = new Map<string, RelationRecord[]>();
  for (const rel of relations) {
    const list = map.get(rel.relation_type) ?? [];
    list.push(rel);
    map.set(rel.relation_type, list);
  }
  return map;
}
