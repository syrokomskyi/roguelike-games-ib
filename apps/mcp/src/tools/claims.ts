import type { McpContext } from "../context.ts";
import { envelope } from "../envelope.ts";
import { claimsForRecord } from "@roguelike-games-ib/projection-sdk";
import { resolveRecordById } from "@roguelike-games-ib/projection-sdk";
import { NotFoundError } from "../errors.ts";

export function getClaims(
  ctx: McpContext,
  input: { record_id: string; predicate?: string; cursor?: string; limit?: number },
) {
  const record = resolveRecordById(ctx.store, input.record_id);
  if (!record) {
    throw new NotFoundError(`Record not found: ${input.record_id}`);
  }

  const limit = Math.min(Math.max(input.limit ?? 20, 1), 100);

  let claims = claimsForRecord(ctx.store.claims, input.record_id);
  if (input.predicate) {
    claims = claims.filter((c) => c.predicate === input.predicate);
  }

  const sorted = [...claims].sort((a, b) => {
    if (a.id < b.id) return -1;
    if (a.id > b.id) return 1;
    return 0;
  });

  const page = sorted.slice(0, limit);
  const hasMore = limit < sorted.length;

  return envelope(ctx, {
    record_id: input.record_id,
    record_key: record.key,
    claims: page.map((c) => ({
      claim_id: c.id,
      predicate: c.predicate,
      object_ref: c.object_ref ?? null,
      value: c.value ?? null,
      assertion_state: c.assertion_state,
      evidence_refs: c.evidence_refs,
    })),
    cursor: hasMore ? null : null,
  });
}
