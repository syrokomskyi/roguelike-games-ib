/*
<MODULE_CONTRACT>
<purpose>Returns claims for a record with optional predicate filter and limit-based pagination.</purpose>
<non-goals>
  <item>Does not validate claim truthfulness — returns claims as authored.</item>
  <item>Does not implement cursor-based pagination — uses simple limit slicing.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: get_claims tool handler with predicate filter and limit.</item>
</CHANGE_SUMMARY>
*/
import type { McpContext } from "../context.ts";
import { envelope } from "../envelope.ts";
import { NotFoundError } from "../errors.ts";

export async function getClaims(
  ctx: McpContext,
  input: { record_id: string; predicate?: string; cursor?: string; limit?: number },
) {
  const record = await ctx.store.resolveRecordById(input.record_id);
  if (!record) {
    throw new NotFoundError(`Record not found: ${input.record_id}`);
  }

  const limit = Math.min(Math.max(input.limit ?? 20, 1), 100);

  let claims = await ctx.store.claimsForRecord(input.record_id);
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
