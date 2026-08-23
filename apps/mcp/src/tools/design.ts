/*
<MODULE_CONTRACT>
<purpose>Queries cross-game concepts, design primitives, and design-space relations with optional filters and pagination.</purpose>
<non-goals>
  <item>Does not compute design-space tensions or knobs — returns stored relations only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: find_cross_game_concepts, find_design_primitives, and query_design_space tool handlers.</item>
</CHANGE_SUMMARY>
*/
import type { McpContext } from "../context.ts";
import { envelope } from "../envelope.ts";
import { paginate } from "../pagination.ts";

export function findCrossGameConcepts(
  ctx: McpContext,
  input: { concept_type?: string; cursor?: string; limit?: number },
) {
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 100);
  const filters: Record<string, unknown> = {};
  if (input.concept_type) filters.concept_type = input.concept_type;

  let concepts = ctx.store.records.filter((r) => r.record_type === "concept");
  if (input.concept_type) {
    concepts = concepts.filter(
      (r) => (r as unknown as Record<string, unknown>)["concept_type"] === input.concept_type,
    );
  }

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

export function findDesignPrimitives(
  ctx: McpContext,
  input: { cursor?: string; limit?: number },
) {
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 100);
  const filters: Record<string, unknown> = {};

  const primitives = ctx.store.records.filter(
    (r) =>
      r.record_type === "concept" &&
      (r as unknown as Record<string, unknown>)["concept_type"] === "design_primitive",
  );

  const { items, nextCursor } = paginate(
    primitives.map((r) => ({ ...r, key: r.key, id: r.id })),
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

export function queryDesignSpace(
  ctx: McpContext,
  input: {
    primitive_key?: string;
    relation_types?: string[];
    cursor?: string;
    limit?: number;
  },
) {
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 100);

  let designRelations = ctx.store.relations.filter(
    (r) => r.relation_scope === "design" || r.relation_scope === "cross_game",
  );

  // Further filter to design-space relation types only
  const designRelationTypes = new Set(["CREATES_PRESSURE", "tensions_with", "pressures", "synergizes_with"]);
  designRelations = designRelations.filter((r) => designRelationTypes.has(r.relation_type));

  if (input.primitive_key) {
    const primitive = ctx.store.records.find((r) => r.key === input.primitive_key);
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

  return envelope(ctx, {
    relations: page.map((r) => {
      const source = resolveRecordByIdSafe(ctx, r.source_record_id);
      const target = resolveRecordByIdSafe(ctx, r.target_record_id);
      return {
        relation_id: r.id,
        relation_type: r.relation_type,
        source: source ? { record_id: source.id, record_key: source.key, record_type: source.record_type } : null,
        target: target ? { record_id: target.id, record_key: target.key, record_type: target.record_type } : null,
      };
    }),
    count: page.length,
  });
}

function resolveRecordByIdSafe(ctx: McpContext, id: string) {
  return ctx.store.records.find((r) => r.id === id);
}
