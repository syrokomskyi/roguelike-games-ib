/*
<MODULE_CONTRACT>
<purpose>Pre-release checks — license, source drift, canonical integrity, stale projection, source payload exclusion, secret scanning, interrupted transaction detection.</purpose>
<non-goals>
  <item>Does not build releases — check-only with blockers and warnings.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: checkRelease with 7 check functions and secret pattern matching.</item>
</CHANGE_SUMMARY>
*/
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import {
  resolveKnowledgePaths,
  readKnowledgeManifest,
  detectSourceDrift,
  computeSourceFingerprint,
  computeCanonicalHash,
  validateCanonicalGraph,
  parseJsonl,
  type SourceBinding,
} from "@roguelike-games-ib/knowledge-core";
import { readCanonicalState, verifyCanonicalState } from "@roguelike-games-ib/materializer";
import type { ReleaseCheckResult } from "./types.ts";

const SECRET_PATTERNS = [
  /(?:api[_-]?key|apikey|secret|password|passwd|token|credential|private[_-]?key)\s*[:=]\s*["'][A-Za-z0-9+/=_-]{16,}["']/i,
  /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/,
  /AKIA[0-9A-Z]{16}/,
  /gh[pousr]_[A-Za-z0-9]{36}/,
  /xox[baprs]-[A-Za-z0-9-]+/,
  /sk-[A-Za-z0-9]{20,}/,
];

const MAX_SECRET_FILE_SIZE = 1024 * 1024;

export function checkRelease(workspaceRoot: string): ReleaseCheckResult {
  const blockers: string[] = [];
  const warnings: string[] = [];

  const paths = resolveKnowledgePaths(workspaceRoot);
  const manifest = paths.manifest;

  checkLicense(paths, blockers);
  checkSourceDrift(paths, blockers);
  checkCanonicalIntegrity(paths, blockers);
  checkStaleProjection(paths, blockers);
  checkSourcePayloadExclusion(paths, blockers);
  checkSecrets(paths, blockers);
  checkInterruptedTransaction(paths, blockers);

  return {
    passed: blockers.length === 0,
    blockers,
    warnings,
  };
}

function checkLicense(
  paths: ReturnType<typeof resolveKnowledgePaths>,
  blockers: string[],
): void {
  const licenseFile = join(paths.workspaceRoot, "LICENSES", "CC-BY-4.0.txt");
  if (!existsSync(licenseFile)) {
    blockers.push("CC-BY-4.0 license file missing from LICENSES/");
  }

  const noticeFile = join(paths.workspaceRoot, "NOTICE.dataset.md");
  if (!existsSync(noticeFile)) {
    blockers.push("NOTICE.dataset.md missing");
  }

  if (paths.config.publication.dataset_license !== "CC-BY-4.0") {
    blockers.push(`Dataset license is not CC-BY-4.0 (got: ${paths.config.publication.dataset_license})`);
  }
}

function checkSourceDrift(
  paths: ReturnType<typeof resolveKnowledgePaths>,
  blockers: string[],
): void {
  const bindingsPath = join(paths.canonicalRoot, "sources", "bindings.yaml");
  if (!existsSync(bindingsPath)) {
    blockers.push("Source bindings file missing");
    return;
  }

  const bindings = parseYaml(readFileSync(bindingsPath, "utf-8")) as {
    bindings: SourceBinding[];
  };

  for (const binding of bindings.bindings) {
    const sourceUnitPath = resolve(paths.sourceRoot, binding.source_unit_path);
    const payloadPath = join(sourceUnitPath, binding.payload_path ?? "source");

    if (!existsSync(payloadPath)) {
      blockers.push(`Source payload missing for ${binding.source_id}`);
      continue;
    }

    const currentFingerprint = computeSourceFingerprint(payloadPath);
    const drift = detectSourceDrift(
      {
        fingerprint: { value: binding.fingerprint.value },
        declared_version: binding.declared_version,
        binding_digest: binding.binding_digest,
      },
      currentFingerprint,
      binding.declared_version,
    );

    if (drift.drifted) {
      blockers.push(`Source drift detected for ${binding.source_id}: ${drift.reason}`);
    }
  }
}

function checkCanonicalIntegrity(
  paths: ReturnType<typeof resolveKnowledgePaths>,
  blockers: string[],
): void {
  const state = readCanonicalState(paths.canonicalRoot);
  const verification = verifyCanonicalState(state);
  if (!verification.valid) {
    blockers.push(`Invalid canonical state: ${verification.errors.join("; ")}`);
  }
}

function checkStaleProjection(
  paths: ReturnType<typeof resolveKnowledgePaths>,
  blockers: string[],
): void {
  const distDir = join(paths.generatedRoot, "dist");
  const manifestPath = join(distDir, "manifest.json");

  if (!existsSync(manifestPath)) {
    blockers.push("Materialization manifest missing — run materialize first");
    return;
  }

  const matManifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
  if (matManifest.schema !== "rgkb/materialization-manifest@2") {
    blockers.push(`Unsupported materialization manifest schema: ${matManifest.schema}`);
  }

  const state = readCanonicalState(paths.canonicalRoot);
  const currentHash = computeCanonicalHash([
    ...state.records,
    ...state.claims,
    ...state.relations,
    ...state.contradictions,
  ]);

  if (matManifest.canonicalHash !== currentHash) {
    blockers.push("Stale materialization — canonical hash mismatch");
  }
}

function checkSourcePayloadExclusion(
  paths: ReturnType<typeof resolveKnowledgePaths>,
  blockers: string[],
): void {
  const releaseDir = join(paths.generatedRoot, "release");
  if (!existsSync(releaseDir)) return;

  const sourceRootName = paths.sourceRoot.split("/").pop();
  function checkDir(dir: string) {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (entry.name === sourceRootName || entry.name.includes("-source")) {
          blockers.push(`Source payload directory found in release: ${join(dir, entry.name)}`);
        }
        checkDir(join(dir, entry.name));
      }
    }
  }
  checkDir(releaseDir);
}

function checkSecrets(
  paths: ReturnType<typeof resolveKnowledgePaths>,
  blockers: string[],
): void {
  const canonicalRoot = paths.canonicalRoot;
  function scanDir(dir: string) {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(fullPath);
      } else if (entry.isFile()) {
        const stat = statSync(fullPath);
        if (stat.size > MAX_SECRET_FILE_SIZE) continue;
        if (entry.name.endsWith(".jsonl") || entry.name.endsWith(".json") || entry.name.endsWith(".yaml") || entry.name.endsWith(".md")) {
          const content = readFileSync(fullPath, "utf-8");
          for (const pattern of SECRET_PATTERNS) {
            if (pattern.test(content)) {
              blockers.push(`Potential secret detected in ${fullPath}`);
              break;
            }
          }
        }
      }
    }
  }
  if (existsSync(canonicalRoot)) {
    scanDir(canonicalRoot);
  }
}

function checkInterruptedTransaction(
  paths: ReturnType<typeof resolveKnowledgePaths>,
  blockers: string[],
): void {
  const lockFile = join(paths.canonicalRoot, ".transaction-lock");
  if (existsSync(lockFile)) {
    blockers.push("Interrupted transaction detected — recover before release");
  }
}
