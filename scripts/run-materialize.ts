import { materialize } from "../packages/materializer/src/index.ts";

const WORKSPACE = "/home/syrokomskyi/projects/roguelike-games-ib";

const result = materialize({ workspaceRoot: WORKSPACE });

console.log("=== Materialization Results ===");
console.log("Dist dir:", result.distDir);
console.log("Record counts:", JSON.stringify(result.recordCounts, null, 2));
console.log("Canonical hash:", result.canonicalHash);
console.log("Logical dump hash:", result.logicalDumpHash);
console.log("Output files:", result.outputFiles.length);
console.log("Done.");
