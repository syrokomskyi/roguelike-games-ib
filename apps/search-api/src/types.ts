export interface VectorMetadata {
  key: string;
  record_type: string;
  source_id: string;
  title: string;
  summary: string;
  concept_type?: string;
  source_games?: string[];
  mutation_dimensions?: string[];
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
  id: string;
  key: string;
  record_type: string;
  source_id: string;
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
  EMBEDDING_DIMENSIONS: string;
  CORS_ORIGIN: string;
}
