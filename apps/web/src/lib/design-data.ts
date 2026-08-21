import type { ProjectionStore } from "@roguelike-games-ib/projection-sdk";

export function buildDesignData(store: ProjectionStore) {
  const allConcepts = store.records.filter((r) => r.record_type === "concept");
  const concepts = allConcepts.filter(
    (r) => (r as Record<string, unknown>)["concept_type"] !== "design_primitive",
  );
  const primitives = allConcepts.filter(
    (r) => (r as Record<string, unknown>)["concept_type"] === "design_primitive",
  );
  const designRelations = store.relations.filter(
    (r) => r.relation_scope === "design",
  );
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
  };
}
