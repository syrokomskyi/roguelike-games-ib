/*
<MODULE_CONTRACT>
<purpose>SearchBackend interface and implementations — abstracts search operations for local (SearchIndex) and remote (search API) modes.</purpose>
<non-goals>
  <item>Does not implement the search index — delegates to SearchIndex or remote API.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: SearchBackend interface, LocalSearchBackend, RemoteSearchBackend — RFC-0020.</item>
</CHANGE_SUMMARY>
*/
import type { SearchIndex, SearchQuery, SearchResult, SearchHit, SearchRecord, ScoreComponents } from "./types.ts";

export interface SearchBackend {
  readonly canonicalHash: string;
  search(query: SearchQuery): Promise<SearchResult>;
}

export class LocalSearchBackend implements SearchBackend {
  constructor(
    private readonly searchIndex: SearchIndex,
  ) {}

  get canonicalHash(): string {
    return this.searchIndex.canonicalHash;
  }

  async search(query: SearchQuery): Promise<SearchResult> {
    return this.searchIndex.search(query);
  }
}

export class RemoteSearchBackend implements SearchBackend {
  constructor(
    private readonly apiUrl: string,
    private readonly _canonicalHash: string,
  ) {}

  get canonicalHash(): string {
    return this._canonicalHash;
  }

  async search(query: SearchQuery): Promise<SearchResult> {
    const params = new URLSearchParams();
    if (query.text) params.set("q", query.text);
    if (query.filters?.source_id) params.set("source", query.filters.source_id);
    if (query.filters?.record_type) params.set("type", query.filters.record_type);
    if (query.filters?.kind) params.set("kind", query.filters.kind);
    if (query.limit) params.set("limit", String(query.limit));

    const response = await fetch(`${this.apiUrl}/api/search?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`Search API returned ${response.status}: ${await response.text()}`);
    }

    const data = (await response.json()) as {
      hits: Array<{
        key: string;
        record_type: string;
        source_id: string;
        title: string;
        summary: string;
        score: number;
        kind?: string;
        semantic_type?: string;
        concept_type?: string;
      }>;
      total: number;
      query: string;
      mode: string;
    };

    const hits: SearchHit[] = data.hits.map((hit) => {
      const record: SearchRecord = {
        id: hit.key,
        key: hit.key,
        record_type: hit.record_type,
        source_id: hit.source_id,
        kind: hit.kind ?? null,
        title: hit.title,
        summary: hit.summary,
        epistemic_status: null,
        json: JSON.stringify({
          key: hit.key,
          record_type: hit.record_type,
          source_id: hit.source_id,
          title: hit.title,
          summary: hit.summary,
          kind: hit.kind,
          semantic_type: hit.semantic_type,
          concept_type: hit.concept_type,
        }),
      };

      const scores: ScoreComponents = {
        lexical_score: 0,
        vector_score: hit.score,
        graph_boost: 0,
        final_score: hit.score,
      };

      return { record, scores };
    });

    return {
      hits,
      total: data.total,
      cursor: null,
      canonicalHash: this._canonicalHash,
    };
  }
}
