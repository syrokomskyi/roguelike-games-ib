import type { McpContext } from "../context.ts";
import { envelope } from "../envelope.ts";

export function getDatasetInfo(ctx: McpContext) {
  const recordCounts = ctx.manifest.recordCounts;
  const totalRecords = Object.values(recordCounts).reduce((a, b) => a + b, 0);
  return envelope(ctx, {
    dataset_id: ctx.datasetId,
    dataset_version: ctx.datasetVersion,
    model_version: ctx.modelVersion,
    canonical_hash: ctx.canonicalHash,
    license: ctx.license,
    source_count: ctx.store.sources.length,
    record_counts: recordCounts,
    total_records: totalRecords,
  });
}
