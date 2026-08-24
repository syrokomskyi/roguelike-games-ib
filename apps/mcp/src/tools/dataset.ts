/*
<MODULE_CONTRACT>
<purpose>Returns dataset-level metadata: id, version, canonical hash, license, source count, and record counts.</purpose>
<non-goals>
  <item>Does not return per-record or per-source details — those are separate tools.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: get_dataset_info tool handler.</item>
</CHANGE_SUMMARY>
*/
import type { McpContext } from "../context.ts";
import { envelope } from "../envelope.ts";

export async function getDatasetInfo(ctx: McpContext) {
  const recordCounts = ctx.manifest.recordCounts;
  const totalRecords = Object.values(recordCounts).reduce((a, b) => a + b, 0);
  const sources = await ctx.store.findAllSources();
  return envelope(ctx, {
    dataset_id: ctx.datasetId,
    dataset_version: ctx.datasetVersion,
    model_version: ctx.modelVersion,
    canonical_hash: ctx.canonicalHash,
    license: ctx.license,
    source_count: sources.length,
    record_counts: recordCounts,
    total_records: totalRecords,
  });
}
