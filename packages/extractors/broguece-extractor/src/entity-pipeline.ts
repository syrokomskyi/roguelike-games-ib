/*
<MODULE_CONTRACT>
<purpose>Entity Pipeline — owns the parse→resolve→envelope→attributes→evidence→count flow for all BrogueCE entity kinds. Each entity kind is a declarative specification processed by the pipeline.</purpose>
<non-goals>
  <item>Does not parse C source — receives parsed entries from the caller's spec.</item>
  <item>Does not own sprite extraction — receives a SpritePipeline adapter for sprite-aware entity kinds.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: extracted from extractor.ts run() to unify record writing behind a single pipeline.</item>
</CHANGE_SUMMARY>
*/
import type { ExtractorContext } from "@roguelike-games-ib/extractor-sdk";
import { createRecordEnvelope } from "@roguelike-games-ib/extractor-sdk";
import type { SpritePipeline } from "./sprite-pipeline.ts";

export interface EntitySpec<E> {
  kind: string;
  nativeKind: string;
  sourcePath: string;
  symbolName: string;
  entries: E[];
  getSlug: (entry: E) => string;
  getNativeId: (entry: E) => string;
  getCanonicalName: (entry: E) => string;
  getOriginalName: (entry: E) => string;
  getAttributes: (entry: E, sprite: SpritePipeline | null) => Promise<Record<string, unknown>>;
  getLineRange: (entry: E) => { lineStart: number; lineEnd: number };
  getDataKey: (entry: E) => string;
  skip?: (entry: E) => boolean;
  spriteSlugPrefix?: (entry: E) => string;
}

export interface PopulationEntry {
  dimension: string;
  expected: number;
  extracted: number;
}

export async function runEntityPipeline(
  ctx: ExtractorContext,
  specs: EntitySpec<any>[],
  sprite: SpritePipeline | null,
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
      const resolved = ctx.ids.resolveOrCreate(spec.kind as never, slug, nativeId);
      const envelope = createRecordEnvelope(
        ctx.binding.source_id,
        resolved.key,
        resolved.id,
        "broguece-factual",
      );

      const attributes = await spec.getAttributes(entry, sprite);
      const { lineStart, lineEnd } = spec.getLineRange(entry);

      const record = {
        ...envelope,
        kind: spec.kind,
        native_kind: spec.nativeKind,
        name: { canonical: spec.getCanonicalName(entry), original: spec.getOriginalName(entry) },
        source_identity: {
          source_id: ctx.binding.source_id,
          native_id: nativeId,
          path: spec.sourcePath,
        },
        activation: "active" as const,
        attributes,
        evidence_refs: [] as string[],
      };

      ctx.output.writeRecord(record);

      const evidence = ctx.evidence.create({
        artifactPath: spec.sourcePath,
        locator: {
          symbol: spec.symbolName,
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
