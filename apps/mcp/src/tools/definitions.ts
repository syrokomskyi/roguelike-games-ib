/*
<MODULE_CONTRACT>
<purpose>Lists definition records for a specific source with optional kind filter and cursor-based pagination.</purpose>
<non-goals>
  <item>Does not resolve aliases or traverse relations — returns flat record list.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: list_definitions tool handler with source and kind filters.</item>
</CHANGE_SUMMARY>
*/
import type { McpContext } from "../context.ts";
import { envelope } from "../envelope.ts";
import { paginate } from "../pagination.ts";

export function listDefinitions(
  ctx: McpContext,
  input: { source_id: string; kind?: string; cursor?: string; limit?: number },
) {
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 100);
  const filters: Record<string, unknown> = { source_id: input.source_id };
  if (input.kind) filters.kind = input.kind;

  let records = ctx.store.records.filter((r) => {
    const sourceIdentity = (r as unknown as Record<string, unknown>)["source_identity"] as
      Record<string, unknown> | undefined;
    if (sourceIdentity?.["source_id"] !== input.source_id) return false;
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
    definitions: items.map((r) => ({
      record_id: r.id,
      record_key: r.key,
      record_type: r.record_type,
      title: (r as unknown as Record<string, unknown>)["title"] ?? null,
      summary: (r as unknown as Record<string, unknown>)["summary"] ?? null,
      kind: (r as unknown as Record<string, unknown>)["kind"] ?? null,
    })),
    cursor: nextCursor,
  });
}
