/*
  Pipeline: checks for source drift, re-extracts if needed, materializes, and ensures
  the web dev server has fresh data.

  Usage:
    tsx scripts/run-pipeline.ts          # check + materialize
    tsx scripts/run-pipeline.ts --force  # force re-extract all sources
*/
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import {
  computeSourceFingerprint,
  detectSourceDrift,
  resolveSourceBundleRoot,
  type SourceBinding,
} from "../packages/knowledge-core/src/index.ts";
import { materialize } from "../packages/materializer/src/index.ts";

const WORKSPACE = "/home/syrokomskyi/projects/roguelike-games-ib";
const KB_ID = "roguelike-games-ib";
const BINDINGS_PATH = join(WORKSPACE, "knowledge", "sources", "bindings.yaml");
const DIST_DIR = join(WORKSPACE, ".generated", "knowledge", "dist");

interface SourceBindings {
  schema: string;
  bindings: SourceBinding[];
}

function readBindings(): SourceBinding[] {
  if (!existsSync(BINDINGS_PATH)) return [];
  const raw = readFileSync(BINDINGS_PATH, "utf-8");
  const parsed = parseYaml(raw) as SourceBindings;
  return parsed.bindings ?? [];
}

function checkDrift(binding: SourceBinding): { drifted: boolean; reason: string; currentFingerprint: string } {
  const sourceRoot = resolveSourceBundleRoot(WORKSPACE, KB_ID);
  const sourceUnitPath = join(sourceRoot.path, binding.source_unit_path, binding.payload_path);

  if (!existsSync(sourceUnitPath)) {
    return { drifted: false, reason: "source not found, skipping", currentFingerprint: binding.fingerprint.value };
  }

  const currentFingerprint = computeSourceFingerprint(sourceUnitPath);
  const drift = detectSourceDrift(binding, currentFingerprint, binding.declared_version);

  return {
    drifted: drift.drifted,
    reason: drift.reason,
    currentFingerprint,
  };
}

function isDistStale(): boolean {
  if (!existsSync(DIST_DIR)) return true;
  if (!existsSync(join(DIST_DIR, "manifest.json"))) return true;
  return false;
}

async function main() {
  const force = process.argv.includes("--force");
  const bindings = readBindings();

  console.log("=== Pipeline: freshness check ===");
  console.log(`Sources: ${bindings.length}`);

  let staleSources: string[] = [];
  let upToDate: string[] = [];

  for (const binding of bindings) {
    const drift = checkDrift(binding);
    if (force || drift.drifted) {
      staleSources.push(binding.source_id);
      console.log(`  [STALE] ${binding.source_id}: ${drift.reason}`);
    } else {
      upToDate.push(binding.source_id);
      console.log(`  [OK]    ${binding.source_id}`);
    }
  }

  if (staleSources.length > 0) {
    console.log(`\n=== Re-extraction needed for: ${staleSources.join(", ")} ===`);
    console.log("NOTE: Re-extraction requires running the stage scripts manually:");
    for (const src of staleSources) {
      if (src === "broguece") {
        console.log(`  pnpm exec tsx scripts/run-stage9.ts`);
      } else if (src === "cataclysm-bn") {
        console.log(`  pnpm exec tsx scripts/run-stage10.ts`);
      } else if (src === "nethack") {
        console.log(`  pnpm exec tsx scripts/run-stage12-nethack.ts`);
      } else {
        console.log(`  (no stage script for ${src})`);
      }
    }
    console.log("\nSkipping re-extraction in pipeline mode. Run the stage scripts above, then re-run this pipeline.");
  } else {
    console.log("\n=== All sources up to date ===");
  }

  console.log("\n=== Materialize ===");
  const distStale = isDistStale();
  if (distStale || staleSources.length > 0 || force) {
    console.log("Dist is stale or sources changed — running materialize...");
    const result = materialize({ workspaceRoot: WORKSPACE });
    console.log("Materialized:", JSON.stringify(result.recordCounts, null, 2));
    console.log("Canonical hash:", result.canonicalHash);
    console.log("Output files:", result.outputFiles.length);
  } else {
    console.log("Dist is up to date — skipping materialize.");
  }

  console.log("\n=== Pipeline complete ===");
  console.log(`Up to date: ${upToDate.length} | Stale: ${staleSources.length} | Dist: ${isDistStale() ? "stale" : "fresh"}`);
}

main().catch((err) => {
  console.error("Pipeline failed:", err);
  process.exit(1);
});
