/*
<MODULE_CONTRACT>
<purpose>Creates and caches the web context — projection store, search index, manifest metadata — for serving the web application from materialized output.</purpose>
<non-goals>
  <item>Does not materialize — reads pre-materialized dist output only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: WebContext type, createWebContext with caching and search index initialization.</item>
</CHANGE_SUMMARY>
*/
import { openProjection, type ProjectionStore } from "@roguelike-games-ib/projection-sdk";
import { buildSearchIndex, type SearchIndex } from "@roguelike-games-ib/search";
import type { MaterializationManifest } from "@roguelike-games-ib/materializer";
import { readManifest, isManifestSupported, SUPPORTED_MANIFEST_SCHEMA } from "@roguelike-games-ib/projection-sdk";
import { join } from "node:path";

export interface WebContext {
  distDir: string;
  manifest: MaterializationManifest;
  store: ProjectionStore;
  searchIndex: SearchIndex;
  canonicalHash: string;
  license: string;
  datasetId: string;
  datasetVersion: string;
  modelVersion: string;
}

let _cachedDistDir: string | null = null;
let _cachedPromise: Promise<WebContext> | null = null;

export async function createWebContext(distDir: string): Promise<WebContext> {
  if (_cachedDistDir === distDir && _cachedPromise) return _cachedPromise;
  _cachedDistDir = distDir;
  _cachedPromise = (async () => {
    const manifest = readManifest(distDir);
    if (!isManifestSupported(manifest)) {
      throw new Error(
        `Unsupported materialization manifest schema: ${manifest.schema}. Expected ${SUPPORTED_MANIFEST_SCHEMA}.`,
      );
    }

    const store = openProjection(distDir);
    const dbPath = join(distDir, "knowledge.sqlite");
    const searchIndex = await buildSearchIndex({
      dbPath,
      canonicalHash: manifest.canonicalHash,
    });

    return {
      distDir,
      manifest,
      store,
      searchIndex,
      canonicalHash: manifest.canonicalHash,
      license: manifest.license,
      datasetId: manifest.datasetId,
      datasetVersion: manifest.datasetVersion,
      modelVersion: manifest.modelVersion,
    };
  })();
  return _cachedPromise;
}
