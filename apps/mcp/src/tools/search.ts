/*
<MODULE_CONTRACT>
<purpose>Searches records using hybrid/lexical/vector retrieval with cursor validation and relevance-score disclaimers.</purpose>
<non-goals>
  <item>Does not guarantee score semantics — scores are relevance signals, not confidence or truth values.</item>
  <item>Does not implement the search index — delegates to the search package.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: search_records tool handler with mode selection and cursor validation.</item>
</CHANGE_SUMMARY>
*/
import type { McpContext } from "../context.ts";
import { envelope } from "../envelope.ts";
import type { SearchFilters } from "@roguelike-games-ib/search";
import { StaleCursorError, InvalidCursorError } from "../errors.ts";
import { validateCursor } from "@roguelike-games-ib/search";

export async function searchRecords(
  ctx: McpContext,
  input: {
    query: string;
    filters?: SearchFilters;
    mode?: "hybrid" | "lexical" | "vector";
    cursor?: string;
    limit?: number;
  },
) {
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 100);

  if (input.cursor) {
    const validation = validateCursor(input.cursor, ctx.canonicalHash);
    if (!validation.valid) {
      if (validation.offset === 0) {
        throw new InvalidCursorError("Invalid or stale cursor");
      }
      throw new StaleCursorError();
    }
  }

  const result = await ctx.searchBackend.search({
    text: input.query,
    filters: input.filters,
    limit,
    cursor: input.cursor,
  });

  return envelope(ctx, {
    hits: result.hits.map((hit) => ({
      record_id: hit.record.id,
      record_key: hit.record.key,
      record_type: hit.record.record_type,
      title: hit.record.title,
      summary: hit.record.summary,
      scores: {
        lexical_score: hit.scores.lexical_score,
        vector_score: hit.scores.vector_score,
        graph_boost: hit.scores.graph_boost,
        final_score: hit.scores.final_score,
      },
    })),
    total: result.total,
    cursor: result.cursor,
    canonical_hash: result.canonicalHash,
    score_disclaimer: "Scores are retrieval relevance signals, not confidence or truth values.",
  });
}
