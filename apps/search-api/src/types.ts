/*
<MODULE_CONTRACT>
<purpose>Type definitions for the search-api Cloudflare Worker — VectorMetadata, API response shapes, request/response interfaces, and Env bindings.</purpose>
<non-goals>
  <item>Does not define runtime logic — types only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: all shared types for the search API.</item>
</CHANGE_SUMMARY>
*/
export interface VectorMetadata {
  canonical_id: string;
  key: string;
  record_type: string;
  source_id: string;
  content_language: string;
  title: string;
  summary: string;
  concept_type: string;
  source_games: string;
  mutation_dimensions: string;
  [key: string]: string | number | boolean;
}

export interface SearchApiResponse {
  hits: SearchApiHit[];
  total: number;
  query: string;
  mode: "semantic" | "design";
}

export interface SearchApiHit {
  key: string;
  record_type: string;
  source_id: string;
  title: string;
  summary: string;
  score: number;
  concept_type?: string;
  source_games?: string[];
  mutation_dimensions?: string[];
}

export interface DesignSearchApiResponse {
  concepts: DesignConceptHit[];
  relations: DesignRelationHit[];
  query: string;
}

export interface DesignConceptHit {
  key: string;
  title: string;
  definition: string;
  concept_type: string;
  source_games: string[];
  mutation_dimensions: string[];
  score: number;
}

export interface DesignRelationHit {
  source_key: string;
  target_key: string;
  relation_type: string;
  rationale: string;
  source_score: number;
}

export interface IndexRequest {
  records: IndexRecord[];
}

export interface IndexRecord {
  vector_id: string;
  canonical_id: string;
  key: string;
  record_type: string;
  source_id: string;
  content_language: string;
  title: string;
  summary: string;
  concept_type?: string;
  source_games?: string[];
  mutation_dimensions?: string[];
}

export interface IndexResponse {
  indexed: number;
  errors: string[];
}

export interface Env {
  AI: Ai;
  VECTOR_INDEX: VectorizeIndex;
  EMBEDDING_MODEL: string;
  ALLOWED_ORIGINS: string;
  INDEXING_TOKEN: string;
}
