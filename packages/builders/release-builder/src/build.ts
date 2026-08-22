/*
<MODULE_CONTRACT>
<purpose>Builds a release bundle — runs pre-release checks, copies canonical/materialized output, generates evidence and dataset manifest, computes checksums.</purpose>
<non-goals>
  <item>Does not publish releases — bundle assembly only.</item>
  <item>Does not materialize — uses pre-materialized dist output.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: buildRelease with directory copy, evidence generation, manifest creation, checksum computation.</item>
</CHANGE_SUMMARY>
*/
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync, copyFileSync, rmSync } from "node:fs";
import { join, resolve, relative } from "node:path";
import {
  resolveKnowledgePaths,
  canonicalJsonStringify,
} from "@roguelike-games-ib/knowledge-core";
import { readCanonicalState } from "@roguelike-games-ib/materializer";
import { checkRelease } from "./check.ts";
import { generateReleaseEvidence } from "./evidence.ts";
import { createDatasetManifest } from "./dataset-manifest.ts";
import type { ReleaseBundleResult, ReleaseOptions, ReleaseEvidence, DatasetManifest } from "./types.ts";

export function buildRelease(options: ReleaseOptions): ReleaseBundleResult {
  const paths = resolveKnowledgePaths(options.workspaceRoot);
  const datasetVersion = options.datasetVersion ?? paths.manifest.dataset_version;
  const releaseDir = resolve(options.distDir ?? join(paths.generatedRoot, "release", datasetVersion));

  const checkResult = checkRelease(options.workspaceRoot);
  if (!checkResult.passed) {
    throw new Error(`Release blocked: ${checkResult.blockers.join("; ")}`);
  }

  if (existsSync(releaseDir)) {
    rmSync(releaseDir, { recursive: true });
  }
  mkdirSync(releaseDir, { recursive: true });

  const canonicalDir = join(releaseDir, "canonical", "knowledge");
  mkdirSync(canonicalDir, { recursive: true });
  copyDirectory(paths.canonicalRoot, canonicalDir);

  const materializedDir = join(releaseDir, "materialized");
  mkdirSync(materializedDir, { recursive: true });
  const distDir = join(paths.generatedRoot, "dist");
  if (existsSync(distDir)) {
    copyDirectory(distDir, materializedDir);
  }

  const licensesDir = join(releaseDir, "LICENSES");
  mkdirSync(licensesDir, { recursive: true });
  const licenseSrc = join(paths.workspaceRoot, "LICENSES", "CC-BY-4.0.txt");
  if (existsSync(licenseSrc)) {
    copyFileSync(licenseSrc, join(licensesDir, "CC-BY-4.0.txt"));
  }

  const noticeSrc = join(paths.workspaceRoot, "NOTICE.dataset.md");
  if (existsSync(noticeSrc)) {
    copyFileSync(noticeSrc, join(releaseDir, "NOTICE.dataset.md"));
  }

  const evidence = generateReleaseEvidence(
    options.workspaceRoot,
    options.acceptedRfcs ?? [],
    options.acceptedAdrs ?? [],
  );

  const manifest = createDatasetManifest(options.workspaceRoot, evidence.canonicalHash);

  const evidencePath = join(releaseDir, "RELEASE-EVIDENCE.json");
  writeFileSync(evidencePath, canonicalJsonStringify(evidence) + "\n", "utf-8");

  const manifestPath = join(releaseDir, "DATASET-MANIFEST.json");
  writeFileSync(manifestPath, canonicalJsonStringify(manifest) + "\n", "utf-8");

  const files = collectFiles(releaseDir);
  const checksums = computeChecksums(releaseDir, files);
  const checksumsPath = join(releaseDir, "SHA256SUMS.txt");
  writeFileSync(checksumsPath, formatChecksums(checksums), "utf-8");

  return {
    releaseDir,
    evidence,
    manifest,
    checksums,
    files,
  };
}

function copyDirectory(src: string, dest: string): void {
  const entries = readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    if (entry.isDirectory()) {
      mkdirSync(destPath, { recursive: true });
      copyDirectory(srcPath, destPath);
    } else if (entry.isFile()) {
      copyFileSync(srcPath, destPath);
    }
  }
}

function collectFiles(dir: string): string[] {
  const files: string[] = [];
  function walk(d: string) {
    const entries = readdirSync(d, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(d, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  }
  walk(dir);
  return files.sort();
}

function computeChecksums(baseDir: string, files: string[]): Record<string, string> {
  const checksums: Record<string, string> = {};
  for (const file of files) {
    const relPath = relative(baseDir, file);
    const buf = readFileSync(file);
    checksums[relPath] = createHash("sha256").update(buf).digest("hex");
  }
  return checksums;
}

function formatChecksums(checksums: Record<string, string>): string {
  const lines: string[] = [];
  for (const [path, hash] of Object.entries(checksums).sort(([a], [b]) => a.localeCompare(b))) {
    lines.push(`${hash}  ${path}`);
  }
  return lines.join("\n") + "\n";
}
