import type { McpContext } from "../context.ts";
import { envelope } from "../envelope.ts";
import { coverageForSource } from "@roguelike-games-ib/projection-sdk";
import { NotFoundError } from "../errors.ts";

export function getCoverage(
  ctx: McpContext,
  input: { source_id: string },
) {
  const source = ctx.store.sources.find((s) => s.source_id === input.source_id);
  if (!source) {
    throw new NotFoundError(`Source not found: ${input.source_id}`);
  }

  const coverage = coverageForSource(ctx.store.coverage, input.source_id);

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
