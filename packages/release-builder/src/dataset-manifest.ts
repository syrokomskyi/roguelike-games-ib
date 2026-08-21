/*
<MODULE_CONTRACT>
<purpose>Creates the dataset manifest with title, ID, version, license, attribution, and canonical hash from knowledge paths.</purpose>
<non-goals>
  <item>Does not verify manifest — creation only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: createDatasetManifest function.</item>
</CHANGE_SUMMARY>
*/
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
