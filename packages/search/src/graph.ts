import Database from "better-sqlite3";
import type { GraphEdge, GraphExpansionOptions, GraphExpansionResult } from "./types.ts";

/**
 * Typed graph expansion using canonical relation edges only.
 * Traverses the relations table, filtering by relation_type and direction.
 * Only typed canonical edges (from the relations table) are followed —
 * no inferred or vector-derived edges.
 */
export function graphExpand(
  db: Database.Database,
  recordId: string,
  options?: GraphExpansionOptions,
): GraphExpansionResult {
  const maxDepth = options?.maxDepth ?? 1;
  const direction = options?.direction ?? "both";
  const allowedTypes = options?.relationTypes ? new Set(options.relationTypes) : null;

  const edges: GraphEdge[] = [];
  const visited = new Set<string>([recordId]);
  const queue: Array<{ id: string; depth: number }> = [{ id: recordId, depth: 0 }];

  while (queue.length > 0) {
    const { id, depth } = queue.shift()!;
    if (depth >= maxDepth) continue;

    const outgoing = direction !== "incoming"
      ? getOutgoingEdges(db, id, allowedTypes)
      : [];
    const incoming = direction !== "outgoing"
      ? getIncomingEdges(db, id, allowedTypes)
      : [];

    for (const edge of [...outgoing, ...incoming]) {
      if (!visited.has(edge.recordId)) {
        visited.add(edge.recordId);
        edges.push(edge);
        queue.push({ id: edge.recordId, depth: depth + 1 });
      }
    }
  }

  return { rootId: recordId, edges, visited };
}

interface RawEdge {
  relation_type: string;
  target_id: string;
  target_key: string;
  target_type: string;
}

interface RawEdgeIncoming {
  relation_type: string;
  source_id: string;
  source_key: string;
  source_type: string;
}

function getOutgoingEdges(
  db: Database.Database,
  recordId: string,
  allowedTypes: Set<string> | null,
): GraphEdge[] {
  let sql = `
    SELECT rel.relation_type, r.id, r.key, r.record_type
    FROM relations rel
    JOIN records r ON r.id = rel.target_record_id
    WHERE rel.source_record_id = ?
  `;
  const params: (string | number)[] = [recordId];

  if (allowedTypes) {
    const placeholders = Array.from(allowedTypes).map(() => "?").join(",");
    sql += ` AND rel.relation_type IN (${placeholders})`;
    params.push(...allowedTypes);
  }

  const rows = db.prepare(sql).all(...params) as Array<{
    relation_type: string;
    id: string;
    key: string;
    record_type: string;
  }>;

  return rows.map((row) => ({
    relationType: row.relation_type,
    direction: "outgoing" as const,
    recordId: row.id,
    recordKey: row.key,
    recordType: row.record_type,
  }));
}

function getIncomingEdges(
  db: Database.Database,
  recordId: string,
  allowedTypes: Set<string> | null,
): GraphEdge[] {
  let sql = `
    SELECT rel.relation_type, r.id, r.key, r.record_type
    FROM relations rel
    JOIN records r ON r.id = rel.source_record_id
    WHERE rel.target_record_id = ?
  `;
  const params: (string | number)[] = [recordId];

  if (allowedTypes) {
    const placeholders = Array.from(allowedTypes).map(() => "?").join(",");
    sql += ` AND rel.relation_type IN (${placeholders})`;
    params.push(...allowedTypes);
  }

  const rows = db.prepare(sql).all(...params) as Array<{
    relation_type: string;
    id: string;
    key: string;
    record_type: string;
  }>;

  return rows.map((row) => ({
    relationType: row.relation_type,
    direction: "incoming" as const,
    recordId: row.id,
    recordKey: row.key,
    recordType: row.record_type,
  }));
}
