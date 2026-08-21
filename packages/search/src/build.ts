/*
<MODULE_CONTRACT>
<purpose>Builds a search index from a materialized SQLite database with optional vector index, providing exact lookup, FTS, graph expansion, and hybrid search.</purpose>
<non-goals>
  <item>Does not materialize the database — uses pre-materialized SQLite.</item>
  <item>Does not implement individual search strategies — delegates to submodules.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: buildSearchIndex, writeSearchManifest, SqliteSearchIndex class.</item>
</CHANGE_SUMMARY>
*/
import Database from "better-sqlite3";
import { existsSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { canonicalJsonStringify, sha256 } from "@roguelike-games-ib/knowledge-core";
import type {
  SearchIndex,
  SearchIndexManifest,
  SearchQuery,
  SearchResult,
  SearchRecord,
  ExactLookupQuery,
  FtsHit,
  GraphExpansionOptions,
  GraphExpansionResult,
  VectorMatch,
} from "./types.ts";
import { exactLookup } from "./exact.ts";
import { ftsSearch } from "./fts.ts";
import { graphExpand } from "./graph.ts";
import { hybridSearch } from "./hybrid.ts";
import { createVectorMetadata, NullVectorIndex } from "./vectors.ts";
import type { VectorIndex } from "./types.ts";
import { validateCursor } from "./cursor.ts";

export interface BuildSearchIndexOptions {
  dbPath: string;
  canonicalHash: string;
  vectorIndex?: VectorIndex;
  records?: SearchRecord[];
}

/**
 * Build a search index from a materialized SQLite database.
 * Optionally builds a vector index from the records.
 */
export async function buildSearchIndex(options: BuildSearchIndexOptions): Promise<SearchIndex> {
  const db = new Database(options.dbPath, { readonly: true });
  const vectorIndex = options.vectorIndex ?? new NullVectorIndex();

  if (options.records && vectorIndex.size() === 0) {
    await vectorIndex.build(options.records);
  }

  const recordCount = (
    db.prepare("SELECT COUNT(*) as count FROM records").get() as { count: number }
  ).count;

  const manifest = createVectorMetadata(vectorIndex, options.canonicalHash, recordCount);

  return new SqliteSearchIndex(db, manifest, vectorIndex, options.canonicalHash);
}

/**
 * Write the search index manifest to disk.
 */
export function writeSearchManifest(outputDir: string, manifest: SearchIndexManifest): string {
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }
  const path = join(outputDir, "search-manifest.json");
  writeFileSync(path, canonicalJsonStringify(manifest) + "\n", "utf-8");
  return path;
}

class SqliteSearchIndex implements SearchIndex {
  constructor(
    private readonly db: Database.Database,
    private readonly _manifest: SearchIndexManifest,
    private readonly vectorIndex: VectorIndex,
    private readonly _canonicalHash: string,
  ) {}

  get canonicalHash(): string {
    return this._canonicalHash;
  }

  get manifest(): SearchIndexManifest {
    return this._manifest;
  }

  exactLookup(query: ExactLookupQuery): SearchRecord | null {
    return exactLookup(this.db, query);
  }

  ftsSearch(text: string, limit?: number): FtsHit[] {
    return ftsSearch(this.db, text, limit);
  }

  graphExpand(recordId: string, options?: GraphExpansionOptions): GraphExpansionResult {
    return graphExpand(this.db, recordId, options);
  }

  async vectorSearch(text: string, k?: number): Promise<VectorMatch[]> {
    const vector = await this.vectorIndex.embed(text);
    if (vector.length === 0) return [];
    return this.vectorIndex.search(vector, k ?? 20);
  }

  async search(query: SearchQuery): Promise<SearchResult> {
    if (query.cursor) {
      const validation = validateCursor(query.cursor, this._canonicalHash);
      if (!validation.valid) {
        throw new Error("Stale search cursor: canonical hash mismatch");
      }
      if (query.offset === undefined) {
        query = { ...query, offset: validation.offset };
      }
    }

    return hybridSearch(
      {
        db: this.db,
        canonicalHash: this._canonicalHash,
        vectorIndex: this.vectorIndex,
      },
      query,
    );
  }

  close(): void {
    this.db.close();
  }
}
