/*
<MODULE_CONTRACT>
<purpose>Derived data tools: semantic record search, derived summary, coverage matrix, concept coverage, concept implementation comparison, concept gap analysis, concept quality scoring, and semantic design-space search.</purpose>
<non-goals>
  <item>Does not mutate or create records — all tools are read-only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: find_semantic_records and get_derived_summary tool handlers.</item>
  <item>RFC-0004: Added get_coverage_matrix, get_concept_coverage, compare_concept_implementations, find_concept_gaps tools.</item>
  <item>RFC-0009: Added get_concept_quality tool for concept quality scoring.</item>
  <item>RFC-0010: Added search_design_space tool for semantic concept search.</item>
  <item>RFC-0011: Added find_design_patterns and get_pattern_examples tools for design pattern library.</item>
</CHANGE_SUMMARY>
*/
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_QUALITY_SCORING_CONFIG } from "@roguelike-games-ib/materializer";
import type { McpContext } from "../context.ts";
import { envelope } from "../envelope.ts";
import { paginate } from "../pagination.ts";
import { NotFoundError, ValidationError } from "../errors.ts";

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

export function getConceptSourceIds(ctx: McpContext, concept: typeof ctx.store.records[number]): Set<string> {
  const result = new Set<string>();
  const ancestry = (concept as unknown as Record<string, unknown>)["ancestry"] as
    Record<string, unknown> | undefined;
  const sourceGames = (ancestry?.["source_games"] as string[]) ?? [];
  for (const sid of sourceGames) result.add(sid);

  const implRefs = (concept as unknown as Record<string, unknown>)["implementation_refs"] as string[] | undefined;
  if (implRefs) {
    for (const refId of implRefs) {
      const refRecord = ctx.store.resolveRecordById(refId);
      if (refRecord) {
        const si = (refRecord as unknown as Record<string, unknown>)["source_identity"] as
          Record<string, unknown> | undefined;
        if (si?.["source_id"]) result.add(si["source_id"] as string);
      }
    }
  }
  return result;
}

function resolveRefsBySource(ctx: McpContext, refIds: string[], sourceId: string) {
  return refIds
    .map((refId) => ctx.store.resolveRecordById(refId))
    .filter((r): r is NonNullable<typeof r> => {
      if (!r) return false;
      const si = (r as unknown as Record<string, unknown>)["source_identity"] as
        Record<string, unknown> | undefined;
      return si?.["source_id"] === sourceId;
    });
}

export function getCoverageMatrix(ctx: McpContext, _input: Record<string, never>) {
  const concepts = ctx.store.records.filter((r) => r.record_type === "concept");
  const sourceIds = ctx.store.sources.map((s) => s.source_id).sort();
  const conceptTypes = new Set<string>();
  const matrix: Record<string, Record<string, number>> = {};
  for (const sid of sourceIds) {
    matrix[sid] = {};
  }

  for (const concept of concepts) {
    const ct = (concept as unknown as Record<string, unknown>)["concept_type"] as string ?? "unknown";
    conceptTypes.add(ct);
    const coveredGames = getConceptSourceIds(ctx, concept);
    for (const sid of coveredGames) {
      if (matrix[sid]) {
        matrix[sid][ct] = (matrix[sid][ct] ?? 0) + 1;
      }
    }
  }

  return envelope(ctx, {
    matrix,
    concept_types: [...conceptTypes].sort(),
    source_ids: sourceIds,
  });
}

export function getConceptCoverage(
  ctx: McpContext,
  input: { record_id?: string; key?: string; limit?: number },
) {
  if (!input.record_id && !input.key) {
    throw new ValidationError("Exactly one of record_id or key is required");
  }
  if (input.record_id && input.key) {
    throw new ValidationError("Only one of record_id or key is allowed");
  }

  let concept;
  if (input.record_id) {
    concept = ctx.store.resolveRecordById(input.record_id);
  } else {
    concept = ctx.store.resolveRecordByKey(input.key!);
  }

  if (!concept) {
    throw new NotFoundError(`Concept not found: ${input.record_id ?? input.key}`);
  }
  if (concept.record_type !== "concept") {
    throw new ValidationError(`Record is not a concept: ${concept.record_type}`);
  }

  const limit = Math.min(Math.max(input.limit ?? 10, 1), 100);
  const ancestry = (concept as unknown as Record<string, unknown>)["ancestry"] as
    Record<string, unknown> | undefined;
  const observedIn = (ancestry?.["observed_in"] as string[]) ?? [];
  const sourceGames = (ancestry?.["source_games"] as string[]) ?? [];
  const implRefs = (concept as unknown as Record<string, unknown>)["implementation_refs"] as string[] | undefined;
  const derivedFrom = (ancestry?.["derived_from"] as string[]) ?? [];
  const allRefs = [...new Set([...(implRefs ?? []), ...derivedFrom])];

  const allSourceIds = ctx.store.sources.map((s) => s.source_id);
  const coverageByGame: Record<string, unknown> = {};
  const gaps: string[] = [];

  for (const sid of allSourceIds) {
    const gameRecords = resolveRefsBySource(ctx, allRefs, sid);

    const hasSourceGame = sourceGames.includes(sid);

    if (gameRecords.length === 0 && !hasSourceGame) {
      coverageByGame[sid] = {
        member_count: 0,
        sample_records: [],
        observed_in_notes: [],
      };
      gaps.push(sid);
    } else {
      coverageByGame[sid] = {
        member_count: gameRecords.length,
        sample_records: gameRecords.slice(0, limit).map((r) => ({
          record_id: r.id,
          record_key: r.key,
          title: (r as unknown as Record<string, unknown>)["title"] ?? null,
        })),
        observed_in_notes: observedIn,
      };
    }
  }

  return envelope(ctx, {
    concept: {
      record_id: concept.id,
      record_key: concept.key,
      concept_type: (concept as unknown as Record<string, unknown>)["concept_type"] ?? null,
      title: (concept as unknown as Record<string, unknown>)["title"] ?? null,
      definition: (concept as unknown as Record<string, unknown>)["definition"] ?? null,
    },
    coverage_by_game: coverageByGame,
    gaps,
  });
}

interface ImplementationNote {
  summary: string;
  distinguishingAttributes: Record<string, string>;
}

let implementationNotesCache: Record<string, Record<string, ImplementationNote>> | null = null;

function loadImplementationNotes(): Record<string, Record<string, ImplementationNote>> {
  if (implementationNotesCache !== null) return implementationNotesCache;
  try {
    const filePath = join(import.meta.dirname ?? ".", "concept-implementations.json");
    const content = readFileSync(filePath, "utf-8");
    implementationNotesCache = JSON.parse(content) as Record<string, Record<string, ImplementationNote>>;
  } catch {
    implementationNotesCache = {};
  }
  return implementationNotesCache;
}

export function compareConceptImplementations(
  ctx: McpContext,
  input: { concept_key: string; source_ids?: string[] },
) {
  if (!input.concept_key) {
    throw new ValidationError("concept_key is required");
  }

  const concept = ctx.store.resolveRecordByKey(input.concept_key);
  if (!concept) {
    throw new NotFoundError(`Concept not found: ${input.concept_key}`);
  }
  if (concept.record_type !== "concept") {
    throw new ValidationError(`Record is not a concept: ${concept.record_type}`);
  }

  const notes = loadImplementationNotes();
  const allSourceIds = input.source_ids ?? ctx.store.sources.map((s) => s.source_id);
  const implRefs = (concept as unknown as Record<string, unknown>)["implementation_refs"] as string[] | undefined;
  const derivedFrom = ((concept as unknown as Record<string, unknown>)["ancestry"] as
    Record<string, unknown> | undefined)?.["derived_from"] as string[] | undefined;
  const allRefs = [...new Set([...(implRefs ?? []), ...(derivedFrom ?? [])])];

  const comparisons = allSourceIds.map((sid) => {
    const note = notes[input.concept_key]?.[sid];
    const exemplarRecords = resolveRefsBySource(ctx, allRefs, sid)
      .slice(0, 5)
      .map((r) => ({
        record_id: r.id,
        record_key: r.key,
        title: (r as unknown as Record<string, unknown>)["title"] ?? null,
      }));

    return {
      source_id: sid,
      implementation_summary: note?.summary ?? null,
      distinguishing_attributes: note?.distinguishingAttributes ?? {},
      exemplar_records: exemplarRecords,
    };
  });

  return envelope(ctx, {
    concept: {
      record_id: concept.id,
      record_key: concept.key,
      title: (concept as unknown as Record<string, unknown>)["title"] ?? null,
    },
    comparisons,
  });
}

export function findConceptGaps(
  ctx: McpContext,
  input: { concept_type?: string; source_id?: string },
) {
  let concepts = ctx.store.records.filter((r) => r.record_type === "concept");
  if (input.concept_type) {
    concepts = concepts.filter(
      (r) => (r as unknown as Record<string, unknown>)["concept_type"] === input.concept_type,
    );
  }

  const allSourceIds = ctx.store.sources.map((s) => s.source_id);
  const gaps: Array<{
    concept_key: string;
    concept_title: string | null;
    concept_type: string | null;
    missing_from: string[];
    present_in: string[];
  }> = [];

  const gapCounts: Record<string, number> = {};
  for (const sid of allSourceIds) gapCounts[sid] = 0;

  for (const concept of concepts) {
    const coveredGames = getConceptSourceIds(ctx, concept);
    const missing = allSourceIds.filter((sid) => !coveredGames.has(sid));
    const present = allSourceIds.filter((sid) => coveredGames.has(sid));

    if (input.source_id) {
      if (!coveredGames.has(input.source_id)) {
        gaps.push({
          concept_key: concept.key,
          concept_title: (concept as unknown as Record<string, unknown>)["title"] as string ?? null,
          concept_type: (concept as unknown as Record<string, unknown>)["concept_type"] as string ?? null,
          missing_from: missing,
          present_in: present,
        });
        gapCounts[input.source_id] = (gapCounts[input.source_id] ?? 0) + 1;
      }
    } else if (missing.length > 0) {
      gaps.push({
        concept_key: concept.key,
        concept_title: (concept as unknown as Record<string, unknown>)["title"] as string ?? null,
        concept_type: (concept as unknown as Record<string, unknown>)["concept_type"] as string ?? null,
        missing_from: missing,
        present_in: present,
      });
      for (const sid of missing) {
        gapCounts[sid] = (gapCounts[sid] ?? 0) + 1;
      }
    }
  }

  const gamesWithMostGaps = Object.entries(gapCounts)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([sid, count]) => [sid, count] as [string, number]);

  return envelope(ctx, {
    gaps,
    summary: {
      total_concepts: concepts.length,
      concepts_with_gaps: gaps.length,
      games_with_most_gaps: gamesWithMostGaps,
    },
  });
}

export function getConceptQuality(
  ctx: McpContext,
  input: { record_id?: string; key?: string; min_score?: number },
) {
  if (input.record_id && input.key) {
    throw new ValidationError("Only one of record_id or key is allowed");
  }

  if (input.record_id || input.key) {
    let concept;
    if (input.record_id) {
      concept = ctx.store.resolveRecordById(input.record_id!);
    } else {
      concept = ctx.store.resolveRecordByKey(input.key!);
    }

    if (!concept) {
      throw new NotFoundError(`Concept not found: ${input.record_id ?? input.key}`);
    }
    if (concept.record_type !== "concept") {
      throw new ValidationError(`Record is not a concept: ${concept.record_type}`);
    }

    const qualityScore = (concept as unknown as Record<string, unknown>)["quality_score"] as
      | { coverage: number; evidence: number; richness: number; overall: number }
      | undefined;

    if (!qualityScore) {
      return envelope(ctx, {
        concept_key: concept.key,
        quality_score: null,
        message: "Quality scores not available. Run `pnpm materialize` to compute.",
      });
    }

    return envelope(ctx, {
      concept_key: concept.key,
      quality_score: qualityScore,
      coverage_detail: buildCoverageDetail(ctx, concept),
      evidence_detail: buildEvidenceDetail(ctx, concept),
      richness_detail: buildRichnessDetail(ctx, concept),
    });
  }

  const minScore = input.min_score ?? 0;
  const concepts = ctx.store.records.filter((r) => r.record_type === "concept");
  const results = concepts
    .map((c) => ({
      concept_key: c.key,
      concept_type: (c as unknown as Record<string, unknown>)["concept_type"] ?? null,
      quality_score: (c as unknown as Record<string, unknown>)["quality_score"] as
        | { coverage: number; evidence: number; richness: number; overall: number }
        | undefined,
    }))
    .filter((c) => c.quality_score && c.quality_score.overall >= minScore)
    .sort((a, b) => (b.quality_score!.overall - a.quality_score!.overall));

  return envelope(ctx, {
    concepts: results,
    total: results.length,
  });
}

function buildCoverageDetail(
  ctx: McpContext,
  concept: typeof ctx.store.records[number],
): { covered_games: string[]; missing_games: string[] } {
  const ancestry = (concept as unknown as Record<string, unknown>)["ancestry"] as
    Record<string, unknown> | undefined;
  const sourceGames = (ancestry?.["source_games"] as string[]) ?? [];
  const allSourceIds = ctx.store.sources.map((s) => s.source_id);
  const covered = sourceGames.filter((g) => allSourceIds.includes(g));
  const missing = allSourceIds.filter((sid) => !sourceGames.includes(sid));
  return { covered_games: covered, missing_games: missing };
}

function buildEvidenceDetail(
  ctx: McpContext,
  concept: typeof ctx.store.records[number],
): { ref_count: number; target: number } {
  const implRefs = (concept as unknown as Record<string, unknown>)["implementation_refs"] as
    string[] | undefined;
  if (!implRefs) return { ref_count: 0, target: DEFAULT_QUALITY_SCORING_CONFIG.evidence_target };
  let validCount = 0;
  for (const ref of implRefs) {
    if (ctx.store.resolveRecordById(ref)) validCount++;
  }
  return { ref_count: validCount, target: DEFAULT_QUALITY_SCORING_CONFIG.evidence_target };
}

function buildRichnessDetail(
  ctx: McpContext,
  concept: typeof ctx.store.records[number],
): { mutation_vectors: number; knobs: number; counterplay: number; failure_modes: number } {
  const detail = { mutation_vectors: 0, knobs: 0, counterplay: 0, failure_modes: 0 };
  const conceptType = (concept as unknown as Record<string, unknown>)["concept_type"] as string | undefined;
  if (conceptType !== "design_primitive") return detail;

  for (const rel of ctx.store.relations) {
    if (rel.source_record_id !== concept.id) continue;
    switch (rel.relation_type) {
      case "HAS_MUTATION_VECTOR": detail.mutation_vectors++; break;
      case "IMPLEMENTED_AS": detail.knobs++; break;
      case "HAS_COUNTERPLAY": detail.counterplay++; break;
      case "CAN_FAIL_AS": detail.failure_modes++; break;
    }
  }
  return detail;
}

export async function searchDesignSpace(
  ctx: McpContext,
  input: {
    query: string;
    concept_type?: string;
    limit?: number;
  },
) {
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 100);
  const overfetchLimit = input.concept_type ? limit * 3 : limit;

  const result = await ctx.searchIndex.search({
    text: input.query,
    filters: { record_type: "concept" },
    limit: overfetchLimit,
  });

  const concepts = result.hits
    .map((hit) => {
      const stored = ctx.store.resolveRecordById(hit.record.id);
      const fullRecord = (stored as unknown as Record<string, unknown>)
        ?? (JSON.parse(hit.record.json) as Record<string, unknown>);
      const conceptType = fullRecord["concept_type"] as string | undefined;

      if (input.concept_type && conceptType !== input.concept_type) return null;

      const qualityScore = fullRecord["quality_score"] as
        | { coverage: number; evidence: number; richness: number; overall: number }
        | undefined;

      return {
        record_id: hit.record.id,
        key: hit.record.key,
        title: hit.record.title,
        concept_type: conceptType ?? "concept",
        quality_score: qualityScore ?? null,
        score: hit.scores.final_score,
      };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null)
    .slice(0, limit);

  return envelope(ctx, {
    concepts,
    total: concepts.length,
    query: input.query,
  });
}

export function findDesignPatterns(
  ctx: McpContext,
  input: { game?: string; primitive_key?: string },
) {
  let patterns = ctx.store.records.filter((r) => {
    if (r.record_type !== "concept") return false;
    const ct = (r as unknown as Record<string, unknown>)["concept_type"] as string | undefined;
    return ct === "design_pattern";
  });

  if (input.game) {
    patterns = patterns.filter((r) => {
      const gamesPresent = (r as unknown as Record<string, unknown>)["games_where_present"] as string[] | undefined;
      return gamesPresent?.includes(input.game!);
    });
  }

  if (input.primitive_key) {
    patterns = patterns.filter((r) => {
      const memberPrimitives = (r as unknown as Record<string, unknown>)["member_primitives"] as string[] | undefined;
      return memberPrimitives?.includes(input.primitive_key!);
    });
  }

  const result = patterns.map((r) => {
    const ra = r as unknown as Record<string, unknown>;
    return {
      record_id: r.id,
      key: r.key,
      title: ra["title"] as string | null,
      definition: ra["definition"] as string | null,
      member_primitives: (ra["member_primitives"] as string[]) ?? [],
      member_pressures: (ra["member_pressures"] as string[]) ?? [],
      games_where_present: (ra["games_where_present"] as string[]) ?? [],
      games_where_absent: (ra["games_where_absent"] as string[]) ?? [],
      quality_score: ra["quality_score"] as { coverage: number; evidence: number; richness: number; overall: number } | undefined,
    };
  });

  return envelope(ctx, {
    patterns: result,
    total: result.length,
  });
}

export function getPatternExamples(
  ctx: McpContext,
  input: { pattern_key: string },
) {
  if (!input.pattern_key) {
    throw new ValidationError("pattern_key is required");
  }

  const pattern = ctx.store.resolveRecordByKey(input.pattern_key);
  if (!pattern) {
    throw new NotFoundError(`Pattern not found: ${input.pattern_key}`);
  }
  if (pattern.record_type !== "concept") {
    throw new ValidationError(`Record is not a concept: ${pattern.record_type}`);
  }

  const patternRa = pattern as unknown as Record<string, unknown>;
  const ct = patternRa["concept_type"] as string | undefined;
  if (ct !== "design_pattern") {
    throw new ValidationError(`Record is not a design_pattern: ${ct}`);
  }

  const memberPrimitiveKeys = (patternRa["member_primitives"] as string[]) ?? [];
  const examplesByGame: Record<string, Array<{ primitive_key: string; description: string; record_refs: string[]; source_file: string }>> = {};

  for (const primKey of memberPrimitiveKeys) {
    const primRecord = ctx.store.resolveRecordByKey(primKey);
    if (!primRecord) continue;
    const concreteExamples = (primRecord as unknown as Record<string, unknown>)["concrete_examples"] as
      | Array<{ game: string; description: string; record_refs: string[]; source_file: string }>
      | undefined;
    if (!concreteExamples) continue;

    for (const ex of concreteExamples) {
      if (!examplesByGame[ex.game]) examplesByGame[ex.game] = [];
      examplesByGame[ex.game].push({
        primitive_key: primKey,
        description: ex.description,
        record_refs: ex.record_refs ?? [],
        source_file: ex.source_file ?? "",
      });
    }
  }

  return envelope(ctx, {
    pattern: {
      record_id: pattern.id,
      key: pattern.key,
      title: patternRa["title"] as string | null,
    },
    examples_by_game: examplesByGame,
  });
}
