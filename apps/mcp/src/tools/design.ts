/*
<MODULE_CONTRACT>
<purpose>Queries cross-game concepts, design primitives, and design-space relations with optional filters and pagination.</purpose>
<non-goals>
  <item>Does not compute design-space tensions or knobs — returns stored relations only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: find_cross_game_concepts, find_design_primitives, and query_design_space tool handlers.</item>
  <item>RFC-0003: Added HAS_MUTATION_VECTOR, IMPLEMENTED_AS, HAS_COUNTERPLAY, CAN_FAIL_AS to designRelationTypes.</item>
  <item>RFC-0009: find_cross_game_concepts and find_design_primitives now sort by quality_score.overall descending.</item>
</CHANGE_SUMMARY>
*/
import type { McpContext } from "../context.ts";
import type { CanonicalRecord } from "@roguelike-games-ib/materializer";
import { envelope } from "../envelope.ts";
import { paginate } from "../pagination.ts";

export async function findCrossGameConcepts(
  ctx: McpContext,
  input: { concept_type?: string; cursor?: string; limit?: number },
) {
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 100);
  const filters: Record<string, unknown> = {};
  if (input.concept_type) filters.concept_type = input.concept_type;

  let concepts = await ctx.store.findRecords({ record_type: "concept" });
  if (input.concept_type) {
    concepts = concepts.filter(
      (r) => (r as unknown as Record<string, unknown>)["concept_type"] === input.concept_type,
    );
  }

  concepts = sortByQuality(concepts);

  const { items, nextCursor } = paginate(
    concepts.map((r) => ({ ...r, key: r.key, id: r.id })),
    ctx.canonicalHash,
    filters,
    input.cursor,
    limit,
  );

  return envelope(ctx, {
    concepts: items.map((r) => ({
      record_id: r.id,
      record_key: r.key,
      concept_type: (r as unknown as Record<string, unknown>)["concept_type"] ?? null,
      title: (r as unknown as Record<string, unknown>)["title"] ?? null,
      definition: (r as unknown as Record<string, unknown>)["definition"] ?? null,
    })),
    cursor: nextCursor,
  });
}

export async function findDesignPrimitives(
  ctx: McpContext,
  input: { cursor?: string; limit?: number },
) {
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 100);
  const filters: Record<string, unknown> = {};

  const allConcepts = await ctx.store.findRecords({ record_type: "concept" });
  const primitives = allConcepts.filter(
    (r) =>
      (r as unknown as Record<string, unknown>)["concept_type"] === "design_primitive",
  );

  const sortedPrimitives = sortByQuality(primitives);

  const { items, nextCursor } = paginate(
    sortedPrimitives.map((r) => ({ ...r, key: r.key, id: r.id })),
    ctx.canonicalHash,
    filters,
    input.cursor,
    limit,
  );

  return envelope(ctx, {
    design_primitives: items.map((r) => ({
      record_id: r.id,
      record_key: r.key,
      title: (r as unknown as Record<string, unknown>)["title"] ?? null,
      definition: (r as unknown as Record<string, unknown>)["definition"] ?? null,
    })),
    cursor: nextCursor,
  });
}

export async function queryDesignSpace(
  ctx: McpContext,
  input: {
    primitive_key?: string;
    relation_types?: string[];
    cursor?: string;
    limit?: number;
  },
) {
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 100);

  let designRelations = (await ctx.store.findRelations({ relation_scope: "design" }))
    .concat(await ctx.store.findRelations({ relation_scope: "cross_game" }));

  // Further filter to design-space relation types only
  const designRelationTypes = new Set([
    "CREATES_PRESSURE", "tensions_with", "pressures", "synergizes_with",
    "HAS_MUTATION_VECTOR", "IMPLEMENTED_AS", "HAS_COUNTERPLAY", "CAN_FAIL_AS",
  ]);
  designRelations = designRelations.filter((r) => designRelationTypes.has(r.relation_type));

  if (input.primitive_key) {
    const primitive = await ctx.store.resolveRecordByKey(input.primitive_key);
    if (primitive) {
      designRelations = designRelations.filter(
        (r) => r.source_record_id === primitive.id || r.target_record_id === primitive.id,
      );
    }
  }

  if (input.relation_types) {
    const typeSet = new Set(input.relation_types);
    designRelations = designRelations.filter((r) => typeSet.has(r.relation_type));
  }

  const sorted = [...designRelations].sort((a, b) => {
    if (a.id < b.id) return -1;
    if (a.id > b.id) return 1;
    return 0;
  });

  const page = sorted.slice(0, limit);

  const relationsWithRecords = await Promise.all(
    page.map(async (r) => {
      const source = await resolveRecordByIdSafe(ctx, r.source_record_id);
      const target = await resolveRecordByIdSafe(ctx, r.target_record_id);
      return {
        relation_id: r.id,
        relation_type: r.relation_type,
        source: source ? { record_id: source.id, record_key: source.key, record_type: source.record_type } : null,
        target: target ? { record_id: target.id, record_key: target.key, record_type: target.record_type } : null,
      };
    }),
  );

  return envelope(ctx, {
    relations: relationsWithRecords,
    count: page.length,
  });
}

async function resolveRecordByIdSafe(ctx: McpContext, id: string) {
  return ctx.store.resolveRecordById(id);
}

function sortByQuality(records: CanonicalRecord[]) {
  return [...records].sort((a, b) => {
    const aScore = (a as unknown as Record<string, unknown>)["quality_score"] as
      | { overall: number }
      | undefined;
    const bScore = (b as unknown as Record<string, unknown>)["quality_score"] as
      | { overall: number }
      | undefined;
    const aOverall = aScore?.overall ?? -1;
    const bOverall = bScore?.overall ?? -1;
    return bOverall - aOverall;
  });
}
