/*
<MODULE_CONTRACT>
<purpose>Lists mechanic and system records with optional source-id and kind filters, using cursor-based pagination.</purpose>
<non-goals>
  <item>Does not traverse relations or return claims — flat record listing only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: find_mechanics and find_systems tool handlers.</item>
</CHANGE_SUMMARY>
*/
import type { McpContext } from "../context.ts";
import { envelope } from "../envelope.ts";
import { paginate } from "../pagination.ts";

export async function findMechanics(
  ctx: McpContext,
  input: { source_id?: string; kind?: string; cursor?: string; limit?: number },
) {
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 100);
  const filters: Record<string, unknown> = {};
  if (input.source_id) filters.source_id = input.source_id;
  if (input.kind) filters.kind = input.kind;

  let records = await ctx.store.findRecords({
    record_type: "semantic_record",
    semantic_type: "mechanic",
    source_id: input.source_id,
    kind: input.kind,
  });

  const { items, nextCursor } = paginate(
    records.map((r) => ({ ...r, key: r.key, id: r.id })),
    ctx.canonicalHash,
    filters,
    input.cursor,
    limit,
  );

  return envelope(ctx, {
    mechanics: items,
    cursor: nextCursor,
  });
}

export async function findSystems(
  ctx: McpContext,
  input: { source_id?: string; kind?: string; cursor?: string; limit?: number },
) {
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 100);
  const filters: Record<string, unknown> = {};
  if (input.source_id) filters.source_id = input.source_id;
  if (input.kind) filters.kind = input.kind;

  let records = await ctx.store.findRecords({
    record_type: "semantic_record",
    semantic_type: "system",
    source_id: input.source_id,
    kind: input.kind,
  });

  const { items, nextCursor } = paginate(
    records.map((r) => ({ ...r, key: r.key, id: r.id })),
    ctx.canonicalHash,
    filters,
    input.cursor,
    limit,
  );

  return envelope(ctx, {
    systems: items,
    cursor: nextCursor,
  });
}
