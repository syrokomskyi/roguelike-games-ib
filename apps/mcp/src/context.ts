/*
<MODULE_CONTRACT>
<purpose>Builds the MCP server context — loads projection store, search index, and materialization manifest from a dist directory.</purpose>
<non-goals>
  <item>Does not implement tool handlers — those live in tools/.</item>
  <item>Does not manage MCP transport or session lifecycle.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: MCP context with projection store, search index, and dataset envelope.</item>
  <item>RFC-0020: McpContext uses IProjectionStore and SearchBackend interfaces instead of concrete classes.</item>
</CHANGE_SUMMARY>
*/
import { openProjection } from "@roguelike-games-ib/projection-sdk";
import type { IProjectionStore } from "@roguelike-games-ib/projection-sdk";
import { buildSearchIndex, LocalSearchBackend, type SearchBackend } from "@roguelike-games-ib/search";
import type { MaterializationManifest } from "@roguelike-games-ib/materializer";
import { join } from "node:path";

export interface McpContext {
  manifest: MaterializationManifest;
  store: IProjectionStore;
  searchBackend: SearchBackend;
  canonicalHash: string;
  license: string;
  datasetId: string;
  datasetVersion: string;
  modelVersion: string;
}

export async function createMcpContext(distDir: string): Promise<McpContext> {
  const store = openProjection(distDir);
  const manifest = store.manifest;
  const dbPath = join(distDir, "knowledge.sqlite");
  const searchIndex = await buildSearchIndex({
    dbPath,
    canonicalHash: manifest.canonicalHash,
  });
  const searchBackend = new LocalSearchBackend(searchIndex);

  return {
    manifest,
    store,
    searchBackend,
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
