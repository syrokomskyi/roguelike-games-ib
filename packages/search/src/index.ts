export { buildSearchIndex, writeSearchManifest } from "./build.ts";
export type { BuildSearchIndexOptions } from "./build.ts";
export { exactLookup } from "./exact.ts";
export { buildFilterClause, filterRecordIds } from "./filters.ts";
export { ftsSearch } from "./fts.ts";
export { graphExpand } from "./graph.ts";
export { NullVectorIndex, InMemoryVectorIndex, createVectorMetadata } from "./vectors.ts";
export { computeScores, rankHits, ftsScoreMap, vectorScoreMap, mergeCandidateIds, buildHits } from "./ranking.ts";
export { hybridSearch } from "./hybrid.ts";
export type { HybridSearchOptions } from "./hybrid.ts";
export { encodeCursor, validateCursor, createCursor, computeCursorHash } from "./cursor.ts";

export type {
  SearchRecord,
  ScoreComponents,
  SearchHit,
  SearchQuery,
  SearchFilters,
  SearchResult,
  SearchIndexManifest,
  VectorIndex,
  VectorMatch,
  GraphExpansionOptions,
  GraphEdge,
  GraphExpansionResult,
  SearchIndex,
  ExactLookupQuery,
  FtsHit,
} from "./types.ts";
