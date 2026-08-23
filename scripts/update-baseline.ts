import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const WORKSPACE = resolve(__dirname, "..");
const MANIFEST_FILE = join(WORKSPACE, ".generated", "knowledge", "dist", "manifest.json");
const BASELINE_FILE = join(WORKSPACE, "knowledge", "baselines", "record-counts-baseline.json");

if (!existsSync(MANIFEST_FILE)) {
  console.error("Error: Materialized manifest not found. Run `pnpm materialize` first.");
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(MANIFEST_FILE, "utf-8"));
const counts = manifest.recordCounts;

writeFileSync(BASELINE_FILE, JSON.stringify(counts, null, 2) + "\n", "utf-8");

console.log("=== Baseline Updated ===");
console.log("File:", BASELINE_FILE);
console.log("Counts:", JSON.stringify(counts, null, 2));
