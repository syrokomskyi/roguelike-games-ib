import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const WORKSPACE = resolve(__dirname, "..");
const MANIFEST_FILE = join(WORKSPACE, ".generated", "knowledge", "dist", "manifest.json");
const HASH_FILE = join(WORKSPACE, ".generated", "knowledge", "canonical-hash.txt");
const BASELINE_FILE = join(WORKSPACE, "knowledge", "baselines", "record-counts-baseline.json");

function readJson(path: string): Record<string, unknown> | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return null;
  }
}

function main(): void {
  if (!existsSync(MANIFEST_FILE)) {
    console.log("=== Knowledge Base Health ===");
    console.log("WARNING: Materialized data not found. Run `pnpm materialize` first.");
    return;
  }

  const manifest = readJson(MANIFEST_FILE);
  if (!manifest) {
    console.error("ERROR: Failed to read manifest.json");
    process.exit(1);
  }

  const counts = (manifest.recordCounts ?? {}) as Record<string, number>;
  const canonicalHash = (manifest.canonicalHash ?? "unknown") as string;

  const baseline = readJson(BASELINE_FILE) as Record<string, number> | null;

  const hashFromFile = existsSync(HASH_FILE)
    ? readFileSync(HASH_FILE, "utf-8").trim()
    : null;

  console.log("=== Knowledge Base Health ===");

  const keys = baseline ? Object.keys(baseline) : Object.keys(counts);
  for (const key of keys) {
    const current = counts[key] ?? 0;
    if (baseline) {
      const base = baseline[key] ?? 0;
      const delta = current - base;
      console.log(`${key.padEnd(16)} ${current.toLocaleString()} (baseline: ${base.toLocaleString()}, delta: ${delta >= 0 ? "+" : ""}${delta})`);
    } else {
      console.log(`${key.padEnd(16)} ${current.toLocaleString()}`);
    }
  }

  console.log();
  if (baseline && hashFromFile) {
    const baselineHash = (readJson(BASELINE_FILE) as Record<string, unknown>)?.canonicalHash;
    const hashMatch = hashFromFile === canonicalHash;
    console.log(`Canonical hash: ${canonicalHash.slice(0, 16)}... (hash file: ${hashMatch ? "match" : "MISMATCH"})`);
  } else {
    console.log(`Canonical hash: ${canonicalHash.slice(0, 16)}...`);
  }

  if (!baseline) {
    console.log("WARNING: Baseline file not found. Run `pnpm exec tsx scripts/update-baseline.ts` to create it.");
  }
}

main();
