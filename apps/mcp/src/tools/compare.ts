import type { McpContext } from "../context.ts";
import { envelope } from "../envelope.ts";
import { resolveRecordById } from "@roguelike-games-ib/projection-sdk";
import { claimsForRecord } from "@roguelike-games-ib/projection-sdk";
import { relationsForRecord } from "@roguelike-games-ib/projection-sdk";
import { NotFoundError, ValidationError } from "../errors.ts";

export function compareRecords(
  ctx: McpContext,
  input: { record_ids: string[] },
) {
  if (input.record_ids.length < 2 || input.record_ids.length > 10) {
    throw new ValidationError("compare_records requires 2..10 record_ids");
  }

  const records = [];
  for (const id of input.record_ids) {
    const record = resolveRecordById(ctx.store, id);
    if (!record) {
      throw new NotFoundError(`Record not found: ${id}`);
    }
    const claims = claimsForRecord(ctx.store.claims, id);
    const { outgoing, incoming } = relationsForRecord(ctx.store.relations, id);
    records.push({
      record_id: record.id,
      record_key: record.key,
      record_type: record.record_type,
      title: (record as unknown as Record<string, unknown>)["title"] ?? null,
      summary: (record as unknown as Record<string, unknown>)["summary"] ?? null,
      claim_count: claims.length,
      outgoing_relation_count: outgoing.length,
      incoming_relation_count: incoming.length,
    });
  }

  return envelope(ctx, { records });
}

export function compareGames(
  ctx: McpContext,
  input: { source_ids: string[]; concept_key?: string },
) {
  if (input.source_ids.length < 2 || input.source_ids.length > 8) {
    throw new ValidationError("compare_games requires 2..8 source_ids");
  }

  const games = [];
  for (const sourceId of input.source_ids) {
    const source = ctx.store.sources.find((s) => s.source_id === sourceId);
    if (!source) {
      throw new NotFoundError(`Source not found: ${sourceId}`);
    }

    let records = ctx.store.records.filter((r) => {
      const si = (r as unknown as Record<string, unknown>)["source_identity"] as Record<string, unknown> | undefined;
      return si?.["source_id"] === sourceId;
    });

    if (input.concept_key) {
      records = records.filter((r) => r.key === input.concept_key);
    }

    games.push({
      source_id: sourceId,
      declared_version: source.declared_version,
      record_count: records.length,
      record_types: records.reduce((acc, r) => {
        acc[r.record_type] = (acc[r.record_type] ?? 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      records: records.map((r) => ({
        record_id: r.id,
        record_key: r.key,
        record_type: r.record_type,
        title: (r as unknown as Record<string, unknown>)["title"] ?? null,
      })),
    });
  }

  return envelope(ctx, { games });
}
