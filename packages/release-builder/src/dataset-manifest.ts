import {
  resolveKnowledgePaths,
} from "@roguelike-games-ib/knowledge-core";
import type { DatasetManifest } from "./types.ts";

export function createDatasetManifest(
  workspaceRoot: string,
  canonicalHash: string,
): DatasetManifest {
  const paths = resolveKnowledgePaths(workspaceRoot);
  return {
    title: "Roguelike Games Knowledge Base",
    id: paths.manifest.id,
    version: paths.manifest.dataset_version,
    license: "CC-BY-4.0",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    attribution: "Roguelike Games Knowledge Base contributors / WarpGogol",
    canonicalHash,
    modelVersion: paths.manifest.model_version,
  };
}
