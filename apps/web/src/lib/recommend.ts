/*
<MODULE_CONTRACT>
<purpose>Build-time and client-side recommendation logic — extracts game/concept data from ProjectionStore and computes ranked game recommendations by sensations.</purpose>
<non-goals>
  <item>Does not fetch or mutate data — pure projection over ProjectionStore and client-side computation.</item>
  <item>Does not handle semantic search fallback for unknown sensations — client-side uses SENSATION_MAP only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-0016: Initial creation — buildRecommendationData and computeRecommendations for /recommend page.</item>
</CHANGE_SUMMARY>
*/
import type { ProjectionStore } from "@roguelike-games-ib/projection-sdk";
import { SENSATION_MAP } from "./sensation-map";

export interface RecommendationConcept {
  key: string;
  concept_type: string;
  title: string;
  quality_score: { overall: number } | null;
  games_where_present: string[];
  ancestry_source_games: string[];
  member_primitives: string[];
}

export interface RecommendationGame {
  source_id: string;
  display_name: string;
}

export interface RecommendationData {
  sensations: Array<{ key: string; label: string }>;
  games: RecommendationGame[];
  concepts: RecommendationConcept[];
  sensationMap: Record<string, { pressures: string[]; primitives: string[]; patterns: string[] }>;
}

export interface RecommendationItem {
  source_id: string;
  score: number;
  matched_patterns: Array<{ key: string; title: string }>;
  matched_primitives: Array<{ key: string; title: string }>;
  rationale: string;
}

function formatSensationLabel(key: string): string {
  return key
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function buildRecommendationData(store: ProjectionStore): RecommendationData {
  const games: RecommendationGame[] = store.sources.map((s) => ({
    source_id: s.source_id,
    display_name: s.source_id.charAt(0).toUpperCase() + s.source_id.slice(1),
  }));

  const concepts: RecommendationConcept[] = store.records
    .filter((r) => r.record_type === "concept")
    .map((r) => {
      const ra = r as unknown as Record<string, unknown>;
      const conceptType = ra["concept_type"] as string | undefined;
      if (!conceptType) return null;

      const qualityScore = ra["quality_score"] as
        | { coverage: number; evidence: number; richness: number; overall: number }
        | undefined;

      const gamesWherePresent = (ra["games_where_present"] as string[]) ?? [];
      const ancestry = ra["ancestry"] as Record<string, unknown> | undefined;
      const ancestrySourceGames = (ancestry?.["source_games"] as string[]) ?? [];
      const memberPrimitives = (ra["member_primitives"] as string[]) ?? [];

      return {
        key: r.key,
        concept_type: conceptType,
        title: (ra["title"] as string) ?? r.key,
        quality_score: qualityScore ? { overall: qualityScore.overall } : null,
        games_where_present: gamesWherePresent,
        ancestry_source_games: ancestrySourceGames,
        member_primitives: memberPrimitives,
      };
    })
    .filter((c): c is RecommendationConcept => c !== null);

  const sensations = Object.keys(SENSATION_MAP).map((key) => ({
    key,
    label: formatSensationLabel(key),
  }));

  const sensationMap: Record<string, { pressures: string[]; primitives: string[]; patterns: string[] }> = {};
  for (const [key, entry] of Object.entries(SENSATION_MAP)) {
    sensationMap[key] = {
      pressures: entry.pressures,
      primitives: entry.primitives,
      patterns: entry.patterns,
    };
  }

  return { sensations, games, concepts, sensationMap };
}

export function computeRecommendations(
  data: RecommendationData,
  sensations: string[],
): RecommendationItem[] {
  if (!sensations || sensations.length === 0) return [];

  const conceptByKey = new Map<string, RecommendationConcept>();
  for (const c of data.concepts) conceptByKey.set(c.key, c);

  type ConceptRef = { key: string; concept_type: string };
  const sensationConceptsMap = new Map<string, ConceptRef[]>();

  for (const sensation of sensations) {
    const lowerSensation = sensation.toLowerCase();
    const entry = data.sensationMap[lowerSensation];
    const concepts: ConceptRef[] = [];

    if (entry) {
      for (const key of entry.patterns) concepts.push({ key, concept_type: "design_pattern" });
      for (const key of entry.primitives) concepts.push({ key, concept_type: "design_primitive" });
      for (const key of entry.pressures) concepts.push({ key, concept_type: "design_pressure" });
    }

    sensationConceptsMap.set(sensation, concepts);
  }

  const recommendations: RecommendationItem[] = [];

  for (const game of data.games) {
    const sourceId = game.source_id;
    const perSensationScores: number[] = [];
    const allMatchedPatterns = new Map<string, string>();
    const allMatchedPrimitives = new Map<string, string>();
    let totalMatchedCount = 0;
    let totalCount = 0;

    for (const [, concepts] of sensationConceptsMap) {
      let weightedSum = 0;
      let totalWeight = 0;
      let matchedCount = 0;

      for (const conceptRef of concepts) {
        const concept = conceptByKey.get(conceptRef.key);
        if (!concept) continue;

        const weight = concept.quality_score?.overall ?? 1.0;

        let present = false;
        if (conceptRef.concept_type === "design_pattern") {
          present = concept.games_where_present.includes(sourceId);
        } else {
          present = concept.ancestry_source_games.includes(sourceId);
        }

        totalWeight += weight;
        if (present) {
          weightedSum += weight;
          matchedCount++;
          totalCount++;

          if (conceptRef.concept_type === "design_pattern") {
            allMatchedPatterns.set(conceptRef.key, concept.title);
          } else if (conceptRef.concept_type === "design_primitive") {
            allMatchedPrimitives.set(conceptRef.key, concept.title);
          }
        }
      }

      const sensationScore = totalWeight > 0 ? weightedSum / totalWeight : 0;
      perSensationScores.push(sensationScore);
      totalMatchedCount += matchedCount;
    }

    if (perSensationScores.length === 0) continue;

    const finalScore = perSensationScores.reduce((a, b) => a + b, 0) / perSensationScores.length;
    if (finalScore < 0.1) continue;

    const matchedPatterns = Array.from(allMatchedPatterns.entries()).map(([key, title]) => ({ key, title }));
    const matchedPrimitives = Array.from(allMatchedPrimitives.entries()).map(([key, title]) => ({ key, title }));

    const scorePercent = Math.round(finalScore * 100);
    const sensationsList = sensations.join(", ");

    let rationale: string;
    if (matchedPatterns.length > 0) {
      const patternTitles = matchedPatterns.map((p) => p.title).join(", ");
      const patternDetails = matchedPatterns.map((p) => {
        const pattern = conceptByKey.get(p.key);
        if (!pattern) return p.title;
        const primitiveNames = pattern.member_primitives
          .map((mk) => {
            const prim = conceptByKey.get(mk);
            return prim ? prim.title : mk;
          })
          .join(" + ");
        return `${p.title} (${primitiveNames})`;
      }).join("; ");
      rationale = `${sourceId} scores ${scorePercent}% for [${sensationsList}] because it implements ${patternTitles} (${patternDetails}). ${totalMatchedCount} of ${totalCount} relevant concepts are present.`;
    } else {
      rationale = `${sourceId} scores ${scorePercent}% for [${sensationsList}] based on ${totalMatchedCount} of ${totalCount} relevant design primitives.`;
    }

    recommendations.push({
      source_id: sourceId,
      score: finalScore,
      matched_patterns: matchedPatterns,
      matched_primitives: matchedPrimitives,
      rationale,
    });
  }

  recommendations.sort((a, b) => b.score - a.score);
  return recommendations;
}
