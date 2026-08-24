/*
<MODULE_CONTRACT>
<purpose>Barrel export for search — build, exact, filters, fts, graph, hybrid, ranking, cursor, vectors, and types.</purpose>
<non-goals>
  <item>Does not implement business logic — re-exports from submodules.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: search barrel exporting all public types and functions.</item>
</CHANGE_SUMMARY>
*/
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
export { LocalSearchBackend, RemoteSearchBackend } from "./search-backend.ts";
export type { SearchBackend } from "./search-backend.ts";

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
