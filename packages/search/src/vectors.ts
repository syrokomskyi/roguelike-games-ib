/*
<MODULE_CONTRACT>
<purpose>Provides vector index implementations — NullVectorIndex for disabled mode and InMemoryVectorIndex with cosine similarity for local/testing, plus manifest metadata creation.</purpose>
<non-goals>
  <item>Does not provide production vector search — use @orama/orama for production.</item>
  <item>Does not perform text search — vector embeddings and similarity only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: NullVectorIndex, InMemoryVectorIndex, cosineSimilarity, createVectorMetadata.</item>
</CHANGE_SUMMARY>
*/
import type { SearchIndexManifest, SearchRecord, VectorIndex, VectorMatch } from "./types.ts";

/**
 * Null vector index — no embeddings, returns empty results.
 * Used when vector search is disabled or for testing without network access.
 */
export class NullVectorIndex implements VectorIndex {
  readonly modelId = "null";
  readonly provider = "null";
  readonly dimensionality = 0;
  readonly inputNormalizationVersion = "1";

  async embed(_text: string): Promise<Float32Array> {
    return new Float32Array(0);
  }

  async search(_vector: Float32Array, _k: number): Promise<VectorMatch[]> {
    return [];
  }

  async build(_records: SearchRecord[]): Promise<void> {}

  size(): number {
    return 0;
  }
}

/**
 * In-memory vector index using cosine similarity.
 * Embeddings are provided externally (no network access required).
 * This is the test/local backend — production uses @orama/orama.
 */
export class InMemoryVectorIndex implements VectorIndex {
  readonly modelId: string;
  readonly provider: string;
  readonly dimensionality: number;
  readonly inputNormalizationVersion: string;

  private embeddings: Map<string, Float32Array> = new Map();
  private embedFn: (text: string) => Promise<Float32Array>;

  constructor(options: {
    modelId?: string;
    provider?: string;
    dimensionality?: number;
    inputNormalizationVersion?: string;
    embedFn: (text: string) => Promise<Float32Array>;
  }) {
    this.modelId = options.modelId ?? "in-memory";
    this.provider = options.provider ?? "local";
    this.dimensionality = options.dimensionality ?? 0;
    this.inputNormalizationVersion = options.inputNormalizationVersion ?? "1";
    this.embedFn = options.embedFn;
  }

  async embed(text: string): Promise<Float32Array> {
    return this.embedFn(text);
  }

  async search(vector: Float32Array, k: number): Promise<VectorMatch[]> {
    const results: VectorMatch[] = [];

    for (const [recordId, emb] of this.embeddings) {
      const score = cosineSimilarity(vector, emb);
      results.push({ recordId, score });
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, k);
  }

  async build(records: SearchRecord[]): Promise<void> {
    this.embeddings.clear();
    for (const record of records) {
      const text = [record.title, record.summary].filter(Boolean).join(" ");
      if (text) {
        const emb = await this.embedFn(text);
        this.embeddings.set(record.id, emb);
      }
    }
  }

  size(): number {
    return this.embeddings.size;
  }
}

/**
 * Compute cosine similarity between two vectors.
 */
function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;

  return dot / denom;
}

/**
 * Create vector index metadata for the search index manifest.
 */
export function createVectorMetadata(
  vectorIndex: VectorIndex,
  canonicalHash: string,
  recordCount: number,
): SearchIndexManifest {
  return {
    schema: "rgkb/search-index-manifest@1",
    canonicalHash,
    embeddingModel: vectorIndex.modelId,
    embeddingDimensionality: vectorIndex.dimensionality,
    embeddingProvider: vectorIndex.provider,
    inputNormalizationVersion: vectorIndex.inputNormalizationVersion,
    recordCount,
    builtAt: "1970-01-01T00:00:00.000Z",
  };
}
