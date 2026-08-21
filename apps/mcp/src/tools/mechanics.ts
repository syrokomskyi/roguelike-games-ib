import type { McpContext } from "../context.ts";
import { envelope } from "../envelope.ts";
import { paginate } from "../pagination.ts";

export function findMechanics(
  ctx: McpContext,
  input: { source_id?: string; kind?: string; cursor?: string; limit?: number },
) {
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 100);
  const filters: Record<string, unknown> = {};
  if (input.source_id) filters.source_id = input.source_id;
  if (input.kind) filters.kind = input.kind;

  let records = ctx.store.records.filter((r) => {
    if (r.record_type !== "mechanic") return false;
    if (input.source_id) {
      const si = (r as unknown as Record<string, unknown>)["source_identity"] as Record<string, unknown> | undefined;
      if (si?.["source_id"] !== input.source_id) return false;
    }
    if (input.kind && (r as unknown as Record<string, unknown>)["kind"] !== input.kind) return false;
    return true;
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

export function findSystems(
  ctx: McpContext,
  input: { source_id?: string; kind?: string; cursor?: string; limit?: number },
) {
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 100);
  const filters: Record<string, unknown> = {};
  if (input.source_id) filters.source_id = input.source_id;
  if (input.kind) filters.kind = input.kind;

  let records = ctx.store.records.filter((r) => {
    if (r.record_type !== "system") return false;
    if (input.source_id) {
      const si = (r as unknown as Record<string, unknown>)["source_identity"] as Record<string, unknown> | undefined;
      if (si?.["source_id"] !== input.source_id) return false;
    }
    if (input.kind && (r as unknown as Record<string, unknown>)["kind"] !== input.kind) return false;
    return true;
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
