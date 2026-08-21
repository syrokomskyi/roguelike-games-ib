import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { canonicalJsonParse } from "@roguelike-games-ib/knowledge-core";
import type { MaterializationManifest } from "@roguelike-games-ib/materializer";

export const SUPPORTED_MANIFEST_SCHEMA = "rgkb/materialization-manifest@2";

export function readManifest(distDir: string): MaterializationManifest {
  const path = join(distDir, "manifest.json");
  if (!existsSync(path)) {
    throw new Error(`Materialization manifest not found: ${path}`);
  }
  const raw = readFileSync(path, "utf-8");
  return canonicalJsonParse(raw) as MaterializationManifest;
}

export function isManifestSupported(manifest: MaterializationManifest): boolean {
  return manifest.schema === SUPPORTED_MANIFEST_SCHEMA;
}
