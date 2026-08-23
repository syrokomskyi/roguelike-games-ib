/*
<MODULE_CONTRACT>
<purpose>Derived data helpers for the design explorer page — concepts, primitives, design relations, realizations, coverage matrix, and per-game concept coverage.</purpose>
<non-goals>
  <item>Does not fetch or mutate data — pure projection over ProjectionStore.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: buildDesignData with concepts, primitives, design relations, realizations.</item>
  <item>RFC-0005: Fixed relation scope filter to include cross_game scope. Added designRelationTypes filter matching MCP queryDesignSpace. Added buildConceptsByType, buildCoverageMatrix, buildGameConceptCoverage. Exported designRelationTypes for reuse.</item>
  <item>RFC-0009: Added qualityScore to ConceptCard and conceptCards/primitiveCards in buildDesignData.</item>
</CHANGE_SUMMARY>
*/
import type { ProjectionStore } from "@roguelike-games-ib/projection-sdk";
import { getSourceId } from "./page-data";

export const designRelationTypes = new Set([
  "CREATES_PRESSURE", "tensions_with", "pressures", "synergizes_with",
  "HAS_MUTATION_VECTOR", "IMPLEMENTED_AS", "HAS_COUNTERPLAY", "CAN_FAIL_AS",
]);

export function buildDesignData(store: ProjectionStore) {
  const allConcepts = store.records.filter((r) => r.record_type === "concept");
  const concepts = allConcepts.filter(
    (r) => (r as Record<string, unknown>)["concept_type"] !== "design_primitive",
  );
  const primitives = allConcepts.filter(
    (r) => (r as Record<string, unknown>)["concept_type"] === "design_primitive",
  );
  const designRelations = store.relations.filter(
    (r) => r.relation_scope === "design" || r.relation_scope === "cross_game",
  ).filter((r) => designRelationTypes.has(r.relation_type));
  const realizesRelations = store.relations.filter(
    (r) => r.relation_type === "REALIZES_CONCEPT",
  );

  const idToKey = new Map(store.records.map((r) => [r.id, r.key]));
  const idToRecord = new Map(store.records.map((r) => [r.id, r]));

  function extractAncestry(r: Record<string, unknown>) {
    const anc = r["ancestry"] as Record<string, unknown> | undefined;
    return {
      sourceGames: (anc?.["source_games"] as string[]) ?? [],
      mutationDimensions: (anc?.["mutation_dimensions"] as string[]) ?? [],
    };
  }

  const conceptCards = concepts.map((r) => {
    const ra = r as Record<string, unknown>;
    const a = extractAncestry(ra);
    return {
      key: r.key,
      title: (ra["title"] as string | null) ?? r.key,
      definition: ra["definition"] as string | null,
      sourceGames: a.sourceGames,
      mutationDimensions: a.mutationDimensions,
      qualityScore: (ra["quality_score"] as { coverage: number; evidence: number; richness: number; overall: number } | undefined) ?? null,
    };
  });

  const primitiveCards = primitives.map((r) => {
    const ra = r as Record<string, unknown>;
    const a = extractAncestry(ra);
    return {
      key: r.key,
      title: (ra["title"] as string | null) ?? r.key,
      definition: ra["definition"] as string | null,
      sourceGames: a.sourceGames,
      mutationDimensions: a.mutationDimensions,
      qualityScore: (ra["quality_score"] as { coverage: number; evidence: number; richness: number; overall: number } | undefined) ?? null,
    };
  });

  const designRelationCards = designRelations.map((rel) => {
    const ra = rel as unknown as Record<string, unknown>;
    const qualifiers = ra["qualifiers"] as Record<string, unknown> | undefined;
    return {
      sourceKey: idToKey.get(rel.source_record_id) ?? rel.source_record_id,
      targetKey: idToKey.get(rel.target_record_id) ?? rel.target_record_id,
      relationType: rel.relation_type,
      rationale: qualifiers?.["rationale"] as string | undefined,
    };
  });

  const realizesCards = realizesRelations.map((rel) => ({
    sourceKey: idToKey.get(rel.source_record_id) ?? rel.source_record_id,
    targetKey: idToKey.get(rel.target_record_id) ?? rel.target_record_id,
    sourceRecordType: idToRecord.get(rel.source_record_id)?.record_type ?? "record",
    targetRecordType: idToRecord.get(rel.target_record_id)?.record_type ?? "record",
  }));

  return {
    concepts,
    primitives,
    conceptCards,
    primitiveCards,
    designRelationCards,
    realizesCards,
    idToKey,
    idToRecord,
  };
}

export interface ConceptCard {
  key: string;
  title: string;
  definition: string | null;
  conceptType: string;
  sourceGames: string[];
  mutationDimensions: string[];
  inclusionCriteria: string[] | null;
  exclusionCriteria: string[] | null;
  implementationRefs: string[];
  observedIn: string[];
  qualityScore: { coverage: number; evidence: number; richness: number; overall: number } | null;
}

function extractConceptCard(r: Record<string, unknown>): ConceptCard {
  const anc = r["ancestry"] as Record<string, unknown> | undefined;
  return {
    key: r["key"] as string,
    title: (r["title"] as string | null) ?? (r["key"] as string),
    definition: r["definition"] as string | null,
    conceptType: (r["concept_type"] as string) ?? "unknown",
    sourceGames: (anc?.["source_games"] as string[]) ?? [],
    mutationDimensions: (anc?.["mutation_dimensions"] as string[]) ?? [],
    inclusionCriteria: (r["inclusion_criteria"] as string[] | null) ?? null,
    exclusionCriteria: (r["exclusion_criteria"] as string[] | null) ?? null,
    implementationRefs: (r["implementation_refs"] as string[]) ?? [],
    observedIn: (anc?.["observed_in"] as string[]) ?? [],
    qualityScore: (r["quality_score"] as { coverage: number; evidence: number; richness: number; overall: number } | undefined) ?? null,
  };
}

export function buildConceptsByType(store: ProjectionStore): { type: string; concepts: ConceptCard[] }[] {
  const allConcepts = store.records.filter((r) => r.record_type === "concept");
  const byType = new Map<string, ConceptCard[]>();
  for (const r of allConcepts) {
    const ra = r as Record<string, unknown>;
    const card = extractConceptCard({ ...ra, key: r.key });
    const list = byType.get(card.conceptType) ?? [];
    list.push(card);
    byType.set(card.conceptType, list);
  }
  return [...byType.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([type, concepts]) => ({ type, concepts }));
}

export interface CoverageMatrixOutput {
  matrix: Record<string, Record<string, number>>;
  conceptTypes: string[];
  sourceIds: string[];
}

export function buildCoverageMatrix(store: ProjectionStore): CoverageMatrixOutput {
  const allConcepts = store.records.filter((r) => r.record_type === "concept");
  const idToRecord = new Map(store.records.map((r) => [r.id, r]));
  const sourceIds = [...new Set(store.sources.map((s) => s.source_id))].sort();
  const conceptTypes = [...new Set(allConcepts.map((r) => (r as Record<string, unknown>)["concept_type"] as string))].sort();

  const matrix: Record<string, Record<string, number>> = {};
  for (const sid of sourceIds) {
    matrix[sid] = {};
    for (const ct of conceptTypes) {
      matrix[sid][ct] = 0;
    }
  }

  for (const r of allConcepts) {
    const ra = r as Record<string, unknown>;
    const ct = ra["concept_type"] as string;
    const anc = ra["ancestry"] as Record<string, unknown> | undefined;
    const sourceGames = (anc?.["source_games"] as string[]) ?? [];
    const implRefs = (ra["implementation_refs"] as string[]) ?? [];

    const games = new Set<string>(sourceGames);
    for (const refId of implRefs) {
      const refRecord = idToRecord.get(refId);
      if (refRecord) {
        const refSid = getSourceId(refRecord as Record<string, unknown>);
        if (refSid) games.add(refSid);
      }
    }

    for (const sid of games) {
      if (matrix[sid] && matrix[sid][ct] !== undefined) {
        matrix[sid][ct]++;
      }
    }
  }

  return { matrix, conceptTypes, sourceIds };
}

export interface GameConceptCoverage {
  designPrimitives: ConceptCard[];
  crossGameMechanics: ConceptCard[];
  designPressures: ConceptCard[];
}

export function buildGameConceptCoverage(store: ProjectionStore, sourceId: string): GameConceptCoverage {
  const allConcepts = store.records.filter((r) => r.record_type === "concept");
  const idToRecord = new Map(store.records.map((r) => [r.id, r]));

  function coversGame(r: Record<string, unknown>): boolean {
    const anc = r["ancestry"] as Record<string, unknown> | undefined;
    const sourceGames = (anc?.["source_games"] as string[]) ?? [];
    if (sourceGames.includes(sourceId)) return true;
    const implRefs = (r["implementation_refs"] as string[]) ?? [];
    for (const refId of implRefs) {
      const refRecord = idToRecord.get(refId);
      if (refRecord) {
        const refSid = getSourceId(refRecord as Record<string, unknown>);
        if (refSid === sourceId) return true;
      }
    }
    return false;
  }

  const result: GameConceptCoverage = { designPrimitives: [], crossGameMechanics: [], designPressures: [] };
  for (const r of allConcepts) {
    const ra = r as Record<string, unknown>;
    if (!coversGame(ra)) continue;
    const card = extractConceptCard({ ...ra, key: r.key });
    const ct = card.conceptType;
    if (ct === "design_primitive") result.designPrimitives.push(card);
    else if (ct === "cross_game_mechanic") result.crossGameMechanics.push(card);
    else if (ct === "design_pressure") result.designPressures.push(card);
  }
  return result;
}
