/*
<MODULE_CONTRACT>
<purpose>Lists all registered sources with pagination, and returns per-source status including coverage dimensions and record counts.</purpose>
<non-goals>
  <item>Does not return records within a source — use list_definitions or find_mechanics for that.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: list_sources and get_source_status tool handlers.</item>
</CHANGE_SUMMARY>
*/
import type { McpContext } from "../context.ts";
import { envelope } from "../envelope.ts";
import { paginate } from "../pagination.ts";
import { NotFoundError } from "../errors.ts";

export async function listSources(
  ctx: McpContext,
  input: { cursor?: string; limit?: number },
) {
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 100);
  const filters: Record<string, unknown> = {};
  const sources = await ctx.store.findAllSources();
  const { items, nextCursor } = paginate(
    sources.map((s) => ({
      ...s,
      key: s.source_id,
      id: s.source_id,
    })),
    ctx.canonicalHash,
    filters,
    input.cursor,
    limit,
  );
  return envelope(ctx, {
    sources: items.map((s) => ({
      source_id: s.source_id,
      declared_version: s.declared_version,
      version_scheme: s.version_scheme,
      binding_digest: s.binding_digest,
      fingerprint_algorithm: s.fingerprint.algorithm,
      fingerprint_value: s.fingerprint.value,
    })),
    cursor: nextCursor,
  });
}

export async function getSourceStatus(
  ctx: McpContext,
  input: { source_id: string },
) {
  const source = await ctx.store.findSourceById(input.source_id);
  if (!source) {
    throw new NotFoundError(`Source not found: ${input.source_id}`);
  }

  const coverage = await ctx.store.findCoverageBySource(input.source_id);
  const records = await ctx.store.findRecords({ source_id: input.source_id });
  const recordCount = records.length;

  return envelope(ctx, {
    source_id: source.source_id,
    declared_version: source.declared_version,
    binding_digest: source.binding_digest,
    fingerprint: source.fingerprint,
    vcs: source.vcs,
    record_count: recordCount,
    coverage_dimensions: coverage.flatMap((c) =>
      c.dimensions.map((d) => ({
        dimension_id: d.id,
        state: d.state,
        basis: d.basis,
        expected: d.expected,
        extracted: d.extracted,
        validated: d.validated,
        unresolved: d.unresolved,
      })),
    ),
  });
}
