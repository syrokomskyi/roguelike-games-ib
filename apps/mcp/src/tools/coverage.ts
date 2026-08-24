/*
<MODULE_CONTRACT>
<purpose>Returns coverage dimensions (expected vs extracted vs validated) for a specific source.</purpose>
<non-goals>
  <item>Does not compute aggregate coverage across sources — single source only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: get_coverage tool handler.</item>
</CHANGE_SUMMARY>
*/
import type { McpContext } from "../context.ts";
import { envelope } from "../envelope.ts";
import { NotFoundError } from "../errors.ts";

export async function getCoverage(
  ctx: McpContext,
  input: { source_id: string },
) {
  const source = await ctx.store.findSourceById(input.source_id);
  if (!source) {
    throw new NotFoundError(`Source not found: ${input.source_id}`);
  }

  const coverage = await ctx.store.findCoverageBySource(input.source_id);

  return envelope(ctx, {
    source_id: input.source_id,
    binding_digest: source.binding_digest,
    dimensions: coverage.flatMap((c) =>
      c.dimensions.map((d) => ({
        dimension_id: d.id,
        state: d.state,
        basis: d.basis,
        expected: d.expected,
        extracted: d.extracted,
        validated: d.validated,
        unresolved: d.unresolved,
        notes: d.notes,
      })),
    ),
  });
}
