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

export async function createWebContext(distDir: string): Promise<WebContext> {
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
}
