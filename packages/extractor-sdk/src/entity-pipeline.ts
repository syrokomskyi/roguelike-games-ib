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

export interface EntitySpec<E> {
  kind: string;
  nativeKind: string;
  originActorId: string;
  entries: E[];
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
}

export interface PopulationEntry {
  dimension: string;
  expected: number;
  extracted: number;
}

export async function runEntityPipeline(
  ctx: ExtractorContext,
  specs: EntitySpec<any>[],
): Promise<{ counts: number[]; populations: PopulationEntry[] }> {
  const counts: number[] = [];
  const populations: PopulationEntry[] = [];

  for (let idx = 0; idx < specs.length; idx++) {
    const spec = specs[idx];
    let count = 0;

    for (const entry of spec.entries) {
      if (spec.skip?.(entry)) continue;

      const slug = spec.getSlug(entry);
      const nativeId = spec.getNativeId(entry);
      const sourcePath = spec.getSourcePath(entry);
      const resolved = ctx.ids.resolveOrCreate(spec.kind as never, slug, nativeId);
      const envelope = createRecordEnvelope(
        ctx.binding.source_id,
        resolved.key,
        resolved.id,
        spec.originActorId,
      );

      const attributes = await spec.getAttributes(entry);
      const { lineStart, lineEnd } = spec.getLineRange(entry);

      const record = {
        ...envelope,
        kind: spec.kind,
        native_kind: spec.nativeKind,
        name: { canonical: spec.getCanonicalName(entry), original: spec.getOriginalName(entry) },
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
          symbol: spec.getSymbolName(entry),
          line_start: lineStart,
          line_end: lineEnd,
          byte_start: null,
          byte_end: null,
          data_key: spec.getDataKey(entry),
        },
        fragmentLines: { lineStart, lineEnd },
      });
      ctx.output.writeEvidence(resolved.id, evidence);
      count++;
    }

    counts[idx] = count;
  }

  return { counts, populations };
}
