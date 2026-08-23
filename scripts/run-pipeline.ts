/*
  Pipeline: checks for source drift, re-extracts if needed, runs derive/concepts/design,
  materializes, builds Obsidian vault and web app, and runs tests.

  Usage:
    tsx scripts/run-pipeline.ts          # full 8-step pipeline
    tsx scripts/run-pipeline.ts --force  # force re-extract all sources
    tsx scripts/run-pipeline.ts --skip-derive --skip-concepts --skip-design --skip-build-obsidian --skip-build-web --skip-tests
                                        # drift check + materialize only (equivalent to old behavior)
*/
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { execSync } from "node:child_process";
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

interface StepResult {
  step: string;
  durationMs: number;
  counts?: Record<string, number>;
  success: boolean;
  skipped: boolean;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--skip-${name}`);
}

function runScript(scriptPath: string): void {
  execSync(`pnpm exec tsx ${scriptPath}`, { cwd: WORKSPACE, stdio: "inherit" });
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

function logStepResult(result: StepResult): void {
  const status = result.skipped ? "SKIP" : result.success ? "PASS" : "FAIL";
  const duration = `${(result.durationMs / 1000).toFixed(1)}s`;
  console.log(`  [${status}] ${result.step} — ${duration}`);
}

async function main() {
  const force = process.argv.includes("--force");
  const bindings = readBindings();
  const results: StepResult[] = [];

  console.log("=== Pipeline: 8-step orchestration ===");
  console.log(`Sources: ${bindings.length}`);
  console.log(`Flags: ${process.argv.filter(a => a.startsWith("--")).join(" ") || "(none)"}`);
  console.log();

  // Step 1: Extract (drift check)
  const step1Start = Date.now();
  console.log("=== Step 1: Extract (drift check) ===");
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
    console.log(`\nRe-extraction needed for: ${staleSources.join(", ")}`);
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
    console.log("\nAll sources up to date.");
  }

  results.push({
    step: "1. Extract (drift check)",
    durationMs: Date.now() - step1Start,
    success: true,
    skipped: false,
  });

  // Step 2: Derive
  const step2Start = Date.now();
  const skipDerive = hasFlag("derive");
  console.log("\n=== Step 2: Derive ===");
  if (skipDerive) {
    console.log("  Skipped (--skip-derive)");
    results.push({ step: "2. Derive", durationMs: 0, success: true, skipped: true });
  } else {
    try {
      runScript("scripts/run-stage-deriver.ts");
      results.push({ step: "2. Derive", durationMs: Date.now() - step2Start, success: true, skipped: false });
    } catch (err) {
      results.push({ step: "2. Derive", durationMs: Date.now() - step2Start, success: false, skipped: false });
      console.error("Derive step failed:", err);
      printSummary(results);
      process.exit(1);
    }
  }

  // Step 3: Concepts
  const step3Start = Date.now();
  const skipConcepts = hasFlag("concepts");
  console.log("\n=== Step 3: Concepts ===");
  if (skipConcepts) {
    console.log("  Skipped (--skip-concepts)");
    results.push({ step: "3. Concepts", durationMs: 0, success: true, skipped: true });
  } else {
    try {
      runScript("scripts/run-stage-concepts.ts");
      results.push({ step: "3. Concepts", durationMs: Date.now() - step3Start, success: true, skipped: false });
    } catch (err) {
      results.push({ step: "3. Concepts", durationMs: Date.now() - step3Start, success: false, skipped: false });
      console.error("Concepts step failed:", err);
      printSummary(results);
      process.exit(1);
    }
  }

  // Step 4: Design
  const step4Start = Date.now();
  const skipDesign = hasFlag("design");
  console.log("\n=== Step 4: Design ===");
  if (skipDesign) {
    console.log("  Skipped (--skip-design)");
    results.push({ step: "4. Design", durationMs: 0, success: true, skipped: true });
  } else {
    if (!process.env.OPENAI_API_KEY) {
      console.warn("  WARNING: OPENAI_API_KEY not found. Design stage may fail or produce fallback results.");
    }
    try {
      runScript("scripts/run-stage-design.ts");
      results.push({ step: "4. Design", durationMs: Date.now() - step4Start, success: true, skipped: false });
    } catch (err) {
      results.push({ step: "4. Design", durationMs: Date.now() - step4Start, success: false, skipped: false });
      console.error("Design step failed:", err);
      printSummary(results);
      process.exit(1);
    }
  }

  // Step 5: Materialize
  const step5Start = Date.now();
  const skipMaterialize = hasFlag("materialize");
  console.log("\n=== Step 5: Materialize ===");
  if (skipMaterialize) {
    console.log("  Skipped (--skip-materialize)");
    results.push({ step: "5. Materialize", durationMs: 0, success: true, skipped: true });
  } else {
    const distStale = isDistStale();
    if (distStale || staleSources.length > 0 || force) {
      console.log("Dist is stale or sources changed — running materialize...");
      const result = materialize({ workspaceRoot: WORKSPACE });
      console.log("Materialized:", JSON.stringify(result.recordCounts, null, 2));
      console.log("Canonical hash:", result.canonicalHash);
      console.log("Output files:", result.outputFiles.length);
      results.push({
        step: "5. Materialize",
        durationMs: Date.now() - step5Start,
        counts: result.recordCounts,
        success: true,
        skipped: false,
      });
    } else {
      console.log("Dist is up to date — skipping materialize.");
      results.push({ step: "5. Materialize", durationMs: Date.now() - step5Start, success: true, skipped: true });
    }
  }

  // Step 6: Build Obsidian vault
  const step6Start = Date.now();
  const skipBuildObsidian = hasFlag("build-obsidian");
  console.log("\n=== Step 6: Build Obsidian vault ===");
  if (skipBuildObsidian) {
    console.log("  Skipped (--skip-build-obsidian)");
    results.push({ step: "6. Build Obsidian", durationMs: 0, success: true, skipped: true });
  } else {
    try {
      runScript("scripts/run-build-obsidian.ts");
      results.push({ step: "6. Build Obsidian", durationMs: Date.now() - step6Start, success: true, skipped: false });
    } catch (err) {
      results.push({ step: "6. Build Obsidian", durationMs: Date.now() - step6Start, success: false, skipped: false });
      console.error("Build Obsidian step failed:", err);
      printSummary(results);
      process.exit(1);
    }
  }

  // Step 7: Build web app
  const step7Start = Date.now();
  const skipBuildWeb = hasFlag("build-web");
  console.log("\n=== Step 7: Build web app ===");
  if (skipBuildWeb) {
    console.log("  Skipped (--skip-build-web)");
    results.push({ step: "7. Build web", durationMs: 0, success: true, skipped: true });
  } else {
    try {
      runScript("scripts/run-build-web.ts");
      results.push({ step: "7. Build web", durationMs: Date.now() - step7Start, success: true, skipped: false });
    } catch (err) {
      results.push({ step: "7. Build web", durationMs: Date.now() - step7Start, success: false, skipped: false });
      console.error("Build web step failed:", err);
      printSummary(results);
      process.exit(1);
    }
  }

  // Step 8: Run tests
  const step8Start = Date.now();
  const skipTests = hasFlag("tests");
  console.log("\n=== Step 8: Run tests ===");
  if (skipTests) {
    console.log("  Skipped (--skip-tests)");
    results.push({ step: "8. Tests", durationMs: 0, success: true, skipped: true });
  } else {
    try {
      execSync("pnpm exec vitest --run", { cwd: WORKSPACE, stdio: "inherit" });
      results.push({ step: "8. Tests", durationMs: Date.now() - step8Start, success: true, skipped: false });
    } catch (err) {
      results.push({ step: "8. Tests", durationMs: Date.now() - step8Start, success: false, skipped: false });
      console.error("Tests step failed:", err);
      printSummary(results);
      process.exit(1);
    }
  }

  printSummary(results);
}

function printSummary(results: StepResult[]): void {
  console.log("\n=== Pipeline Summary ===");
  for (const r of results) {
    logStepResult(r);
  }
  const totalMs = results.reduce((sum, r) => sum + r.durationMs, 0);
  const passed = results.filter(r => r.success && !r.skipped).length;
  const skipped = results.filter(r => r.skipped).length;
  const failed = results.filter(r => !r.success).length;
  console.log(`\nTotal: ${(totalMs / 1000).toFixed(1)}s | Pass: ${passed} | Skip: ${skipped} | Fail: ${failed}`);
}

main().catch((err) => {
  console.error("Pipeline failed:", err);
  process.exit(1);
});
