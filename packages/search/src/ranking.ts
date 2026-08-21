/*
<MODULE_CONTRACT>
<purpose>Computes and ranks search scores from lexical, vector, and graph boost components with stable tie-breaking by key and ID.</purpose>
<non-goals>
  <item>Does not perform search — score computation and ranking only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: computeScores, rankHits, ftsScoreMap, vectorScoreMap, mergeCandidateIds, buildHits.</item>
</CHANGE_SUMMARY>
*/
import type { FtsHit, ScoreComponents, SearchHit, SearchRecord, VectorMatch } from "./types.ts";

/**
 * Combine lexical and vector scores with graph boost into final score.
 * All components are returned separately — no opaque blending.
 */
export function computeScores(
  lexicalScore: number,
  vectorScore: number,
  graphBoost: number,
): ScoreComponents {
  const finalScore = lexicalScore + vectorScore + graphBoost;
  return {
    lexical_score: lexicalScore,
    vector_score: vectorScore,
    graph_boost: graphBoost,
    final_score: finalScore,
  };
}

/**
 * Rank hits with stable tie-breaker: key ASC, then id ASC.
 */
export function rankHits(hits: SearchHit[]): SearchHit[] {
  return [...hits].sort((a, b) => {
    const scoreCmp = b.scores.final_score - a.scores.final_score;
    if (scoreCmp !== 0) return scoreCmp;
    const keyCmp = a.record.key.localeCompare(b.record.key);
    if (keyCmp !== 0) return keyCmp;
    return a.record.id.localeCompare(b.record.id);
  });
}

/**
 * Convert FTS hits to a map of recordId → lexical score.
 * FTS5 bm25 returns negative values (lower = better), so we negate.
 */
export function ftsScoreMap(ftsHits: FtsHit[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const hit of ftsHits) {
    map.set(hit.recordId, -hit.score);
  }
  return map;
}

/**
 * Convert vector matches to a map of recordId → vector score.
 */
export function vectorScoreMap(vectorMatches: VectorMatch[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const match of vectorMatches) {
    map.set(match.recordId, match.score);
  }
  return map;
}

/**
 * Merge candidate IDs from multiple retrieval layers.
 */
export function mergeCandidateIds(
  ftsHits: FtsHit[],
  vectorMatches: VectorMatch[],
  graphBoostedIds: Set<string>,
): string[] {
  const ids = new Set<string>();
  for (const hit of ftsHits) ids.add(hit.recordId);
  for (const match of vectorMatches) ids.add(match.recordId);
  for (const id of graphBoostedIds) ids.add(id);
  return [...ids];
}

/**
 * Build search hits from candidate IDs, score maps, and record lookup.
 */
export function buildHits(
  candidateIds: string[],
  recordMap: Map<string, SearchRecord>,
  ftsScores: Map<string, number>,
  vecScores: Map<string, number>,
  graphBoosts: Map<string, number>,
): SearchHit[] {
  const hits: SearchHit[] = [];

  for (const id of candidateIds) {
    const record = recordMap.get(id);
    if (!record) continue;

    const lexicalScore = ftsScores.get(id) ?? 0;
    const vectorScore = vecScores.get(id) ?? 0;
    const graphBoost = graphBoosts.get(id) ?? 0;

    hits.push({
      record,
      scores: computeScores(lexicalScore, vectorScore, graphBoost),
    });
  }

  return hits;
}
