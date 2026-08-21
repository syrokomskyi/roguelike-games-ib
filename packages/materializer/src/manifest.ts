import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { canonicalJsonStringify } from "@roguelike-games-ib/knowledge-core";
import { MaterializationManifest } from "./types.ts";

/**
 * Create the materialization manifest.
 */
export function createManifest(params: {
  datasetId: string;
  datasetVersion: string;
  modelVersion: string;
  canonicalHash: string;
  license: string;
  recordCounts: Record<string, number>;
  builtFromBindings: Record<string, string>;
  logicalDumpHash: string;
}): MaterializationManifest {
  return {
    schema: "rgkb/materialization-manifest@2",
    datasetId: params.datasetId,
    datasetVersion: params.datasetVersion,
    modelVersion: params.modelVersion,
    canonicalHash: params.canonicalHash,
    license: params.license,
    recordCounts: params.recordCounts,
    builtFromBindings: params.builtFromBindings,
    logicalDumpHash: params.logicalDumpHash,
    builtAt: "1970-01-01T00:00:00.000Z",
  };
}

/**
 * Write the manifest to the dist directory.
 */
export function writeManifest(distDir: string, manifest: MaterializationManifest): string {
  const path = join(distDir, "manifest.json");
  writeFileSync(path, canonicalJsonStringify(manifest) + "\n", "utf-8");
  return path;
}
