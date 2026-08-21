/*
<MODULE_CONTRACT>
<purpose>Defines core types for the search package — SearchRecord, SearchHit, SearchQuery, SearchFilters, SearchResult, VectorIndex, GraphExpansion, and SearchIndex interfaces.</purpose>
<non-goals>
  <item>Does not implement search logic — type definitions only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: SearchRecord, ScoreComponents, SearchHit, SearchQuery, SearchFilters, SearchResult, SearchIndexManifest, VectorIndex, VectorMatch, GraphExpansionOptions, GraphEdge, GraphExpansionResult, SearchIndex, ExactLookupQuery, FtsHit types.</item>
</CHANGE_SUMMARY>
*/
export interface SearchRecord {
  id: string;
  key: string;
  record_type: string;
  source_id: string | null;
  kind: string | null;
  title: string | null;
  summary: string | null;
  epistemic_status: string | null;
  json: string;
}

export interface ScoreComponents {
  lexical_score: number;
  vector_score: number;
  graph_boost: number;
  final_score: number;
}

export interface SearchHit {
  record: SearchRecord;
  scores: ScoreComponents;
}

export interface SearchQuery {
  text?: string;
  filters?: SearchFilters;
  limit?: number;
  offset?: number;
  cursor?: string;
}

export interface SearchFilters {
  source_id?: string;
  record_type?: string;
  kind?: string;
  epistemic_status?: string;
  authority?: string;
}

export interface SearchResult {
  hits: SearchHit[];
  total: number;
  cursor: string | null;
  canonicalHash: string;
}

export interface SearchIndexManifest {
  schema: string;
  canonicalHash: string;
  embeddingModel: string | null;
  embeddingDimensionality: number | null;
  embeddingProvider: string | null;
  inputNormalizationVersion: string;
  recordCount: number;
  builtAt: string;
}

export interface VectorIndex {
  readonly modelId: string;
  readonly provider: string;
  readonly dimensionality: number;
  readonly inputNormalizationVersion: string;

  embed(text: string): Promise<Float32Array>;
  search(vector: Float32Array, k: number): Promise<VectorMatch[]>;
  build(records: SearchRecord[]): Promise<void>;
  size(): number;
}

export interface VectorMatch {
  recordId: string;
  score: number;
}

export interface GraphExpansionOptions {
  relationTypes?: string[];
  maxDepth?: number;
  direction?: "outgoing" | "incoming" | "both";
}

export interface GraphEdge {
  relationType: string;
  direction: "outgoing" | "incoming";
  recordId: string;
  recordKey: string;
  recordType: string;
}

export interface GraphExpansionResult {
  rootId: string;
  edges: GraphEdge[];
  visited: Set<string>;
}

export interface SearchIndex {
  readonly canonicalHash: string;
  readonly manifest: SearchIndexManifest;

  exactLookup(query: ExactLookupQuery): SearchRecord | null;
  ftsSearch(text: string, limit?: number): FtsHit[];
  graphExpand(recordId: string, options?: GraphExpansionOptions): GraphExpansionResult;
  vectorSearch(text: string, k?: number): Promise<VectorMatch[]>;
  search(query: SearchQuery): Promise<SearchResult>;
}

export interface ExactLookupQuery {
  id?: string;
  key?: string;
  alias?: string;
}

export interface FtsHit {
  recordId: string;
  key: string;
  score: number;
}
