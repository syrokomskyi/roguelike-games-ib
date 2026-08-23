import { materialize } from "../packages/materializer/src/index.ts";
import { writeFileSync, appendFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

const WORKSPACE = "/home/syrokomskyi/projects/roguelike-games-ib";
const GENERATED_KB_DIR = join(WORKSPACE, ".generated", "knowledge");
const HASH_FILE = join(GENERATED_KB_DIR, "canonical-hash.txt");
const HASH_HISTORY = join(GENERATED_KB_DIR, "canonical-hash-history.jsonl");

const result = materialize({ workspaceRoot: WORKSPACE });

console.log("=== Materialization Results ===");
console.log("Dist dir:", result.distDir);
console.log("Record counts:", JSON.stringify(result.recordCounts, null, 2));
console.log("Canonical hash:", result.canonicalHash);
console.log("Logical dump hash:", result.logicalDumpHash);
console.log("Output files:", result.outputFiles.length);

if (!existsSync(GENERATED_KB_DIR)) {
  mkdirSync(GENERATED_KB_DIR, { recursive: true });
}

writeFileSync(HASH_FILE, result.canonicalHash, "utf-8");
console.log("Hash file written:", HASH_FILE);

let commitSha = "unknown";
try {
  commitSha = execSync("git rev-parse HEAD", { cwd: WORKSPACE, encoding: "utf-8" }).trim();
} catch {
  // Not in a git repo or git not available
}

const historyEntry = {
  hash: result.canonicalHash,
  timestamp: new Date().toISOString(),
  commit_sha: commitSha,
  record_count: result.recordCounts.records ?? result.recordCounts.definitions ?? 0,
  claim_count: result.recordCounts.claims ?? 0,
  relation_count: result.recordCounts.relations ?? 0,
};

appendFileSync(HASH_HISTORY, JSON.stringify(historyEntry) + "\n", "utf-8");
console.log("Hash history appended:", HASH_HISTORY);

console.log("Done.");
