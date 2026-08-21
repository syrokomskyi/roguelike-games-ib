import { materialize } from "../packages/materializer/src/index.ts";
import { buildObsidianVault } from "../packages/obsidian-builder/src/build.ts";

const WORKSPACE = "/home/syrokomskyi/projects/roguelike-games-ib";

console.log("Step 1: Materialize...");
const matResult = materialize({ workspaceRoot: WORKSPACE });
console.log("Materialized:", JSON.stringify(matResult.recordCounts, null, 2));

console.log("Step 2: Build Obsidian vault...");
const obsResult = buildObsidianVault({ workspaceRoot: WORKSPACE });
console.log("Obsidian vault:", obsResult.noteCount, "notes at", obsResult.vaultRoot);

console.log("Done. Web build requires `pnpm build:web` from apps/web directory.");
