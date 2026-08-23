import type { McpContext } from "../context.ts";
import { envelope } from "../envelope.ts";
import { paginate } from "../pagination.ts";

export function findSemanticRecords(
  ctx: McpContext,
  input: {
    source_id?: string;
    semantic_type?: string;
    kind?: string;
    cursor?: string;
    limit?: number;
  },
) {
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 100);
  const filters: Record<string, unknown> = {};
  if (input.source_id) filters.source_id = input.source_id;
  if (input.semantic_type) filters.semantic_type = input.semantic_type;
  if (input.kind) filters.kind = input.kind;

  let records = ctx.store.records.filter((r) => {
    if (r.record_type !== "semantic_record") return false;
    if (input.semantic_type) {
      const st = (r as unknown as Record<string, unknown>)["semantic_type"];
      if (st !== input.semantic_type) return false;
    }
    if (input.source_id) {
      const scope = (r as unknown as Record<string, unknown>)["scope"] as Record<string, unknown> | undefined;
      const sid = scope?.["source_id"];
      if (sid !== input.source_id) return false;
    }
    if (input.kind) {
      const body = (r as unknown as Record<string, unknown>)["body"];
      const recordKind = typeof body === "object" && body !== null
        ? (body as Record<string, unknown>)["kind"]
        : undefined;
      if (recordKind !== input.kind) return false;
    }
    return true;
  });

  const { items, nextCursor } = paginate(
    records.map((r) => ({ ...r, key: r.key, id: r.id })),
    ctx.canonicalHash,
    filters,
    input.cursor,
    limit,
  );

  return envelope(ctx, {
    semantic_records: items.map((r) => ({
      record_id: r.id,
      record_key: r.key,
      semantic_type: (r as unknown as Record<string, unknown>)["semantic_type"] ?? null,
      title: (r as unknown as Record<string, unknown>)["title"] ?? null,
      summary: (r as unknown as Record<string, unknown>)["summary"] ?? null,
    })),
    cursor: nextCursor,
  });
}

export function getDerivedSummary(
  ctx: McpContext,
  _input: unknown,
) {
  const records = ctx.store.records;
  const claims = ctx.store.claims;
  const relations = ctx.store.relations;

  const recordCounts: Record<string, number> = {};
  for (const r of records) {
    recordCounts[r.record_type] = (recordCounts[r.record_type] ?? 0) + 1;
  }

  const conceptCounts: Record<string, number> = {};
  for (const r of records) {
    if (r.record_type === "concept") {
      const ct = (r as unknown as Record<string, unknown>)["concept_type"] as string ?? "unknown";
      conceptCounts[ct] = (conceptCounts[ct] ?? 0) + 1;
    }
  }

  const semanticCounts: Record<string, number> = {};
  for (const r of records) {
    if (r.record_type === "semantic_record") {
      const st = (r as unknown as Record<string, unknown>)["semantic_type"] as string ?? "unknown";
      semanticCounts[st] = (semanticCounts[st] ?? 0) + 1;
    }
  }

  const relationCounts: Record<string, number> = {};
  for (const r of relations) {
    relationCounts[r.relation_type] = (relationCounts[r.relation_type] ?? 0) + 1;
  }

  const claimPredicates: Record<string, number> = {};
  for (const c of claims) {
    claimPredicates[c.predicate] = (claimPredicates[c.predicate] ?? 0) + 1;
  }

  const topPredicates = Object.entries(claimPredicates)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);

  return envelope(ctx, {
    record_counts: recordCounts,
    concept_counts: conceptCounts,
    semantic_record_counts: semanticCounts,
    relation_counts: relationCounts,
    total_claims: claims.length,
    total_relations: relations.length,
    top_claim_predicates: topPredicates.map(([predicate, count]) => ({ predicate, count })),
  });
}
