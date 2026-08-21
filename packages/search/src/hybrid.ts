import Database from "better-sqlite3";
import type {
  FtsHit,
  GraphExpansionOptions,
  SearchFilters,
  SearchHit,
  SearchQuery,
  SearchRecord,
  SearchResult,
  VectorMatch,
} from "./types.ts";
import { ftsSearch } from "./fts.ts";
import { filterRecordIds } from "./filters.ts";
import { graphExpand } from "./graph.ts";
import {
  ftsScoreMap,
  vectorScoreMap,
  mergeCandidateIds,
  buildHits,
  rankHits,
} from "./ranking.ts";
import { createCursor, validateCursor, encodeCursor } from "./cursor.ts";
import type { VectorIndex } from "./types.ts";

export interface HybridSearchOptions {
  db: Database.Database;
  canonicalHash: string;
  vectorIndex: VectorIndex;
  graphExpansion?: GraphExpansionOptions;
  enableGraphBoost?: boolean;
}

/**
 * Hybrid retrieval combining FTS, vector, and graph expansion.
 * Returns components separately in each hit's scores field.
 */
export async function hybridSearch(
  options: HybridSearchOptions,
  query: SearchQuery,
): Promise<SearchResult> {
  const { db, canonicalHash, vectorIndex } = options;
  const limit = query.limit ?? 20;
  const offset = query.offset ?? 0;

  if (query.cursor) {
    const validation = validateCursor(query.cursor, canonicalHash);
    if (!validation.valid) {
      throw new Error(`Stale search cursor: canonical hash mismatch`);
    }
  }

  const allRecords = loadAllRecords(db);
  const recordMap = new Map<string, SearchRecord>();
  for (const r of allRecords) {
    recordMap.set(r.id, r);
  }

  let ftsHits: FtsHit[] = [];
  let vectorMatches: VectorMatch[] = [];

  if (query.text) {
    ftsHits = ftsSearch(db, query.text, limit * 3);
    const queryVector = await vectorIndex.embed(query.text);
    if (queryVector.length > 0) {
      vectorMatches = await vectorIndex.search(queryVector, limit * 3);
    }
  }

  const ftsScores = ftsScoreMap(ftsHits);
  const vecScores = vectorScoreMap(vectorMatches);

  const graphBoosts = new Map<string, number>();
  const graphBoostedIds = new Set<string>();

  if (options.enableGraphBoost !== false && (ftsHits.length > 0 || vectorMatches.length > 0)) {
    const seedIds = mergeCandidateIds(ftsHits, vectorMatches, new Set());
    for (const seedId of seedIds.slice(0, 10)) {
      const expansion = graphExpand(db, seedId, options.graphExpansion ?? { maxDepth: 1 });
      for (const edge of expansion.edges) {
        graphBoostedIds.add(edge.recordId);
        const current = graphBoosts.get(edge.recordId) ?? 0;
        graphBoosts.set(edge.recordId, current + 0.1);
      }
    }
  }

  let candidateIds = mergeCandidateIds(ftsHits, vectorMatches, graphBoostedIds);

  if (query.filters) {
    candidateIds = filterRecordIds(db, candidateIds, query.filters);
  }

  let hits = buildHits(candidateIds, recordMap, ftsScores, vecScores, graphBoosts);
  hits = rankHits(hits);

  const total = hits.length;
  const paged = hits.slice(offset, offset + limit);

  const nextCursor = offset + limit < total
    ? encodeCursor(canonicalHash, offset + limit)
    : null;

  return {
    hits: paged,
    total,
    cursor: nextCursor,
    canonicalHash,
  };
}

function loadAllRecords(db: Database.Database): SearchRecord[] {
  const rows = db
    .prepare("SELECT id, key, record_type, source_id, kind, title, summary, epistemic_status, json FROM records")
    .all() as Array<{
      id: string;
      key: string;
      record_type: string;
      source_id: string | null;
      kind: string | null;
      title: string | null;
      summary: string | null;
      epistemic_status: string | null;
      json: string;
    }>;

  return rows.map((row) => ({
    id: row.id,
    key: row.key,
    record_type: row.record_type,
    source_id: row.source_id,
    kind: row.kind,
    title: row.title,
    summary: row.summary,
    epistemic_status: row.epistemic_status,
    json: row.json,
  }));
}
