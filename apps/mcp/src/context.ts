import { openProjection, type ProjectionStore } from "@roguelike-games-ib/projection-sdk";
import { buildSearchIndex, type SearchIndex } from "@roguelike-games-ib/search";
import type { MaterializationManifest } from "@roguelike-games-ib/materializer";
import { readManifest } from "@roguelike-games-ib/projection-sdk";
import { join } from "node:path";

export interface McpContext {
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

export async function createMcpContext(distDir: string): Promise<McpContext> {
  const manifest = readManifest(distDir);
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

export function datasetEnvelope(ctx: McpContext) {
  return {
    id: ctx.datasetId,
    dataset_version: ctx.datasetVersion,
    model_version: ctx.modelVersion,
    canonical_hash: ctx.canonicalHash,
    license: ctx.license,
  };
}
