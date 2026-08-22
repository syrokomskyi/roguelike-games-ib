/*
<MODULE_CONTRACT>
<purpose>Entity Pipeline — owns the parse→resolve→envelope→attributes→evidence→count flow for all extractor entity kinds. Each entity kind is a declarative specification processed by the pipeline.</purpose>
<non-goals>
  <item>Does not parse source files — receives parsed entries from the caller's spec.</item>
  <item>Does not own sprite extraction or any domain-specific adapter — callers close over adapters in their spec builders.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: lifted from broguece-extractor/src/entity-pipeline.ts, generalized originActorId and removed sprite coupling.</item>
</CHANGE_SUMMARY>
*/
import type { ExtractorContext } from "./types.ts";
import { createRecordEnvelope } from "./envelope.ts";

export interface EntityAdapter<E> {
  nativeKind: string;
  originActorId: string;
  getSourcePath: (entry: E) => string;
  getSymbolName: (entry: E) => string;
  getSlug: (entry: E) => string;
  getNativeId: (entry: E) => string;
  getCanonicalName: (entry: E) => string;
  getOriginalName: (entry: E) => string;
  getAttributes: (entry: E) => Promise<Record<string, unknown>> | Record<string, unknown>;
  getLineRange: (entry: E) => { lineStart: number; lineEnd: number };
  getDataKey: (entry: E) => string;
  skip?: (entry: E) => boolean;
  populationDimension?: string;
}

export interface EntitySpec<E> {
  kind: string;
  entries: E[];
  adapter: EntityAdapter<E>;
}

export interface PopulationEntry {
  dimension: string;
  expected: number;
  extracted: number;
}

export async function runEntityPipeline(
  ctx: ExtractorContext,
  specs: EntitySpec<any>[],
): Promise<{ counts: number[]; dimensionCounts: Map<string, number> }> {
  const counts: number[] = [];
  const dimensionCounts = new Map<string, number>();

  for (let idx = 0; idx < specs.length; idx++) {
    const spec = specs[idx];
    const adapter = spec.adapter;
    let count = 0;

    for (const entry of spec.entries) {
      if (adapter.skip?.(entry)) continue;

      const slug = adapter.getSlug(entry);
      const nativeId = adapter.getNativeId(entry);
      const sourcePath = adapter.getSourcePath(entry);
      const resolved = ctx.ids.resolveOrCreate(spec.kind as never, slug, nativeId);
      const envelope = createRecordEnvelope(
        ctx.binding.source_id,
        resolved.key,
        resolved.id,
        adapter.originActorId,
      );

      const attributes = await adapter.getAttributes(entry);
      const { lineStart, lineEnd } = adapter.getLineRange(entry);

      const record = {
        ...envelope,
        kind: spec.kind,
        native_kind: adapter.nativeKind,
        name: { canonical: adapter.getCanonicalName(entry), original: adapter.getOriginalName(entry) },
        source_identity: {
          source_id: ctx.binding.source_id,
          native_id: nativeId,
          path: sourcePath,
        },
        activation: "active" as const,
        attributes,
        evidence_refs: [] as string[],
      };

      ctx.output.writeRecord(record);

      const evidence = ctx.evidence.create({
        artifactPath: sourcePath,
        locator: {
          symbol: adapter.getSymbolName(entry),
          line_start: lineStart,
          line_end: lineEnd,
          byte_start: null,
          byte_end: null,
          data_key: adapter.getDataKey(entry),
        },
        fragmentLines: { lineStart, lineEnd },
      });
      ctx.output.writeEvidence(resolved.id, evidence);
      count++;
    }

    counts[idx] = count;
    if (adapter.populationDimension) {
      const prev = dimensionCounts.get(adapter.populationDimension) ?? 0;
      dimensionCounts.set(adapter.populationDimension, prev + count);
    }
  }

  return { counts, dimensionCounts };
}
