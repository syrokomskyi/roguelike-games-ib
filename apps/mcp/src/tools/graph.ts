import type { McpContext } from "../context.ts";
import { envelope } from "../envelope.ts";
import { relationsForRecord, groupRelationsByType } from "@roguelike-games-ib/projection-sdk";
import { resolveRecordById } from "@roguelike-games-ib/projection-sdk";
import { NotFoundError, ValidationError } from "../errors.ts";

const MAX_DEPTH = 3;

export function traverseRelations(
  ctx: McpContext,
  input: {
    record_id: string;
    relation_types?: string[];
    direction?: "out" | "in" | "both";
    depth?: number;
    limit?: number;
  },
) {
  const record = resolveRecordById(ctx.store, input.record_id);
  if (!record) {
    throw new NotFoundError(`Record not found: ${input.record_id}`);
  }

  const depth = Math.min(input.depth ?? 1, MAX_DEPTH);
  if (depth < 1 || depth > MAX_DEPTH) {
    throw new ValidationError(`Depth must be between 1 and ${MAX_DEPTH}`);
  }

  const limit = Math.min(input.limit ?? 50, 200);
  const direction = input.direction ?? "both";

  const visited = new Set<string>([input.record_id]);
  const edges: Array<{
    relation_type: string;
    direction: "outgoing" | "incoming";
    record_id: string;
    record_key: string;
    record_type: string;
    depth: number;
  }> = [];

  const queue: Array<{ id: string; depth: number }> = [{ id: input.record_id, depth: 0 }];

  while (queue.length > 0 && edges.length < limit) {
    const { id, depth: currentDepth } = queue.shift()!;
    if (currentDepth >= depth) continue;

    const { outgoing, incoming } = relationsForRecord(ctx.store.relations, id);

    const filterByType = (rels: typeof outgoing) =>
      input.relation_types
        ? rels.filter((r) => input.relation_types!.includes(r.relation_type))
        : rels;

    if (direction !== "in") {
      for (const rel of filterByType(outgoing)) {
        if (edges.length >= limit) break;
        if (visited.has(rel.target_record_id)) continue;
        visited.add(rel.target_record_id);
        const target = resolveRecordById(ctx.store, rel.target_record_id);
        edges.push({
          relation_type: rel.relation_type,
          direction: "outgoing",
          record_id: rel.target_record_id,
          record_key: target?.key ?? "",
          record_type: target?.record_type ?? "",
          depth: currentDepth + 1,
        });
        queue.push({ id: rel.target_record_id, depth: currentDepth + 1 });
      }
    }

    if (direction !== "out") {
      for (const rel of filterByType(incoming)) {
        if (edges.length >= limit) break;
        if (visited.has(rel.source_record_id)) continue;
        visited.add(rel.source_record_id);
        const source = resolveRecordById(ctx.store, rel.source_record_id);
        edges.push({
          relation_type: rel.relation_type,
          direction: "incoming",
          record_id: rel.source_record_id,
          record_key: source?.key ?? "",
          record_type: source?.record_type ?? "",
          depth: currentDepth + 1,
        });
        queue.push({ id: rel.source_record_id, depth: currentDepth + 1 });
      }
    }
  }

  return envelope(ctx, {
    root_record_id: input.record_id,
    root_record_key: record.key,
    edges,
    max_depth: depth,
    truncated: edges.length >= limit,
  });
}
