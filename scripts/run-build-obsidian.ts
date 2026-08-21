import { buildObsidianVault } from "../packages/obsidian-builder/src/build.ts";

const WORKSPACE = "/home/syrokomskyi/projects/roguelike-games-ib";

const result = buildObsidianVault({ workspaceRoot: WORKSPACE });

console.log("=== Obsidian Vault Build Results ===");
console.log("Vault root:", result.vaultRoot);
console.log("Note count:", result.noteCount);
console.log("Source note count:", result.sourceNoteCount);
console.log("Record counts:", JSON.stringify(result.manifest.recordCounts, null, 2));
console.log("Done.");
