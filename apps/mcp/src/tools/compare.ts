/*
<MODULE_CONTRACT>
<purpose>Compares 2–10 records side by side, or 2–8 games (sources) with optional concept-key filter and concept coverage.</purpose>
<non-goals>
  <item>Does not compute semantic similarity — returns structural counts and metadata only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: compare_records and compare_games tool handlers.</item>
  <item>RFC-0004: Added include_concepts parameter to compare_games for concept coverage per game.</item>
</CHANGE_SUMMARY>
*/
import type { McpContext } from "../context.ts";
import { envelope } from "../envelope.ts";
import { NotFoundError, ValidationError } from "../errors.ts";
import { getConceptSourceIds } from "./derived.ts";

export function compareRecords(
  ctx: McpContext,
  input: { record_ids: string[] },
) {
  if (input.record_ids.length < 2 || input.record_ids.length > 10) {
    throw new ValidationError("compare_records requires 2..10 record_ids");
  }

  const records = [];
  for (const id of input.record_ids) {
    const record = ctx.store.resolveRecordById(id);
    if (!record) {
      throw new NotFoundError(`Record not found: ${id}`);
    }
    const claims = ctx.store.claimsForRecord(id);
    const { outgoing, incoming } = ctx.store.relationsForRecord(id);
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
  input: { source_ids: string[]; concept_key?: string; include_concepts?: boolean },
) {
  if (input.source_ids.length < 2 || input.source_ids.length > 8) {
    throw new ValidationError("compare_games requires 2..8 source_ids");
  }

  const concepts = input.include_concepts
    ? ctx.store.records.filter((r) => r.record_type === "concept")
    : [];

  const games = [];
  for (const sourceId of input.source_ids) {
    const source = ctx.store.findSourceById(sourceId);
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

    const gameEntry: Record<string, unknown> = {
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
    };

    if (input.include_concepts) {
      const gameConcepts = concepts.filter((c) => getConceptSourceIds(ctx, c).has(sourceId));
      const byType: Record<string, string[]> = {};
      for (const c of gameConcepts) {
        const ct = (c as unknown as Record<string, unknown>)["concept_type"] as string ?? "unknown";
        if (!byType[ct]) byType[ct] = [];
        byType[ct].push(c.key);
      }
      const conceptCoverage: Record<string, unknown> = {};
      for (const [ct, keys] of Object.entries(byType)) {
        conceptCoverage[ct] = keys;
        conceptCoverage[`${ct}_count`] = keys.length;
      }
      gameEntry["concept_coverage"] = conceptCoverage;
    }

    games.push(gameEntry);
  }

  return envelope(ctx, { games });
}
