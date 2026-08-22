/*
<MODULE_CONTRACT>
<purpose>Creates and writes the Obsidian build manifest with canonical hash, note counts, and record type counts.</purpose>
<non-goals>
  <item>Does not build the vault — manifest creation and writing only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: ObsidianBuildManifest type, createBuildManifest, writeBuildManifest.</item>
</CHANGE_SUMMARY>
*/
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { canonicalJsonStringify } from "@roguelike-games-ib/knowledge-core";

export interface ObsidianBuildManifest {
  schema: string;
  canonicalHash: string;
  noteCount: number;
  sourceNoteCount: number;
  recordCounts: Record<string, number>;
  builtAt: string;
}

export function createBuildManifest(params: {
  canonicalHash: string;
  noteCount: number;
  sourceNoteCount: number;
  recordCounts: Record<string, number>;
}): ObsidianBuildManifest {
  return {
    schema: "rgkb/obsidian-build-manifest@1",
    canonicalHash: params.canonicalHash,
    noteCount: params.noteCount,
    sourceNoteCount: params.sourceNoteCount,
    recordCounts: params.recordCounts,
    builtAt: "1970-01-01T00:00:00.000Z",
  };
}

export function writeBuildManifest(vaultRoot: string, manifest: ObsidianBuildManifest): string {
  const path = join(vaultRoot, "BUILD-MANIFEST.yaml");
  const yamlText = `schema: ${manifest.schema}\ncanonical_hash: "${manifest.canonicalHash}"\nnote_count: ${manifest.noteCount}\nsource_note_count: ${manifest.sourceNoteCount}\nrecord_counts:\n${Object.entries(manifest.recordCounts).map(([k, v]) => `  ${k}: ${v}`).join("\n")}\nbuilt_at: "${manifest.builtAt}"\n`;
  writeFileSync(path, yamlText, "utf-8");
  return path;
}
