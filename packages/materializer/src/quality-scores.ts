/*
<MODULE_CONTRACT>
<purpose>Computes concept quality scores (coverage, evidence, richness) from canonical state during materialization.</purpose>
<non-goals>
  <item>Does not modify canonical records — scoring is a projection applied in memory before writing to dist.</item>
  <item>Does not compute scores for non-concept records.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-0009: Initial creation — computeQualityScores, DEFAULT_QUALITY_SCORING_CONFIG.</item>
</CHANGE_SUMMARY>
*/
import { CanonicalState, QualityScore, QualityScoringConfig } from "./types.ts";

export const DEFAULT_QUALITY_SCORING_CONFIG: QualityScoringConfig = {
  evidence_target: 10,
  richness_target: 20,
  richness_other_target: 5,
  weights: { coverage: 0.4, evidence: 0.3, richness: 0.3 },
};

const DESIGN_PRIMITIVE_RICHNESS_TYPES = new Set([
  "HAS_MUTATION_VECTOR",
  "IMPLEMENTED_AS",
  "HAS_COUNTERPLAY",
  "CAN_FAIL_AS",
]);

const DESIGN_SCOPES = new Set(["design", "cross_game"]);

export function computeQualityScores(
  state: CanonicalState,
  config: QualityScoringConfig = DEFAULT_QUALITY_SCORING_CONFIG,
): Map<string, QualityScore> {
  const allSourceIds = new Set(state.bindings.map((b) => b.source_id));
  const recordIds = new Set(state.records.map((r) => r.id));
  const scores = new Map<string, QualityScore>();

  for (const record of state.records) {
    if (record.record_type !== "concept") continue;

    const coverage = computeCoverage(record, allSourceIds);
    const evidence = computeEvidence(record, recordIds, config.evidence_target);
    const richness = computeRichness(record, state, config);

    const overall =
      Math.round(
        (coverage * config.weights.coverage +
          evidence * config.weights.evidence +
          richness * config.weights.richness) *
          100,
      ) / 100;

    scores.set(record.id, { coverage, evidence, richness, overall });
  }

  return scores;
}

function computeCoverage(
  record: Record<string, unknown>,
  allSourceIds: Set<string>,
): number {
  if (allSourceIds.size === 0) return 0;
  const ancestry = record["ancestry"] as Record<string, unknown> | undefined;
  const sourceGames = (ancestry?.["source_games"] as string[]) ?? [];
  if (sourceGames.length === 0) return 0;

  let covered = 0;
  for (const game of sourceGames) {
    if (allSourceIds.has(game)) covered++;
  }
  return covered / allSourceIds.size;
}

function computeEvidence(
  record: Record<string, unknown>,
  recordIds: Set<string>,
  target: number,
): number {
  const implRefs = record["implementation_refs"] as string[] | undefined;
  if (!implRefs || implRefs.length === 0) return 0;

  let validCount = 0;
  for (const ref of implRefs) {
    if (recordIds.has(ref)) validCount++;
  }
  return Math.min(validCount / target, 1.0);
}

function computeRichness(
  record: Record<string, unknown>,
  state: CanonicalState,
  config: QualityScoringConfig,
): number {
  const conceptType = record["concept_type"] as string | undefined;
  const recordId = record["id"] as string;

  if (conceptType === "design_primitive") {
    let count = 0;
    for (const rel of state.relations) {
      if (
        rel.source_record_id === recordId &&
        DESIGN_PRIMITIVE_RICHNESS_TYPES.has(rel.relation_type)
      ) {
        count++;
      }
    }
    return Math.min(count / config.richness_target, 1.0);
  }

  const connectedIds = new Set<string>();
  for (const rel of state.relations) {
    if (!DESIGN_SCOPES.has(rel.relation_scope)) continue;
    if (rel.source_record_id === recordId) {
      connectedIds.add(rel.target_record_id);
    } else if (rel.target_record_id === recordId) {
      connectedIds.add(rel.source_record_id);
    }
  }
  return Math.min(connectedIds.size / config.richness_other_target, 1.0);
}
