import { readJsonlFile } from "@roguelike-games-ib/materializer";
import { join } from "node:path";
import type { RelationRecord } from "@roguelike-games-ib/knowledge-core";

export function readRelations(distDir: string): RelationRecord[] {
  return readJsonlFile(join(distDir, "relations.jsonl")) as unknown as RelationRecord[];
}

export function relationsForRecord(relations: RelationRecord[], recordId: string): {
  outgoing: RelationRecord[];
  incoming: RelationRecord[];
} {
  const outgoing = relations.filter((r) => r.source_record_id === recordId);
  const incoming = relations.filter((r) => r.target_record_id === recordId);
  return { outgoing, incoming };
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
