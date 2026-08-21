/*
<MODULE_CONTRACT>
<purpose>Builds the materialized read model from canonical state — writes JSONL, SQLite, manifest, and verifies integrity.</purpose>
<non-goals>
  <item>Does not extract or transform source data — materialization only.</item>
  <item>Does not serve the read model — build-time only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: materialize, readState, verifyState functions.</item>
</CHANGE_SUMMARY>
*/
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  resolveKnowledgePaths,
  computeCanonicalHash,
  type KnowledgeManifest,
} from "@roguelike-games-ib/knowledge-core";
import { CanonicalState, MaterializationResult, MaterializationOptions } from "./types.ts";
import { readCanonicalState, verifyCanonicalState } from "./verify-input.ts";
import { redactPublicEvidence } from "./public-evidence.ts";
import {
  writeRecordsJsonl,
  writeClaimsJsonl,
  writeRelationsJsonl,
  writePublicEvidenceJsonl,
  writeSourcesJson,
  writeCoverageJson,
  writeKeyMapJson,
  writeAliasMapJson,
} from "./records-jsonl.ts";
import { buildSqlite, verifySqliteIntegrity } from "./sqlite.ts";
import { createManifest, writeManifest } from "./manifest.ts";
import { KnowledgeCoreError } from "@roguelike-games-ib/knowledge-core";

/**
 * Build the materialized read model from canonical state.
 *
 * Steps:
 * 1. Resolve workspace paths
 * 2. Read canonical state
 * 3. Verify canonical integrity (refuse if invalid)
 * 4. Compute canonical hash
 * 5. Write JSONL outputs (deterministic, sorted)
 * 6. Build SQLite read model
 * 7. Verify SQLite integrity
 * 8. Write manifest with canonical hash, license, counts
 *
 * @throws KnowledgeCoreError if canonical state is invalid
 */
export function materialize(options: MaterializationOptions): MaterializationResult {
  const paths = resolveKnowledgePaths(options.workspaceRoot);
  const distDir = resolve(options.distDir ?? join(paths.generatedRoot, "dist"));

  if (existsSync(distDir)) {
    rmSync(distDir, { recursive: true });
  }
  mkdirSync(distDir, { recursive: true });

  const state = readCanonicalState(paths.canonicalRoot);

  const verification = verifyCanonicalState(state);
  if (!verification.valid) {
    throw new KnowledgeCoreError(
      `Canonical state verification failed: ${verification.errors.join("; ")}`,
      "CANONICAL_STATE_INVALID",
      { errors: verification.errors },
    );
  }

  const canonicalHash = computeCanonicalHash([
    ...state.records,
    ...state.claims,
    ...state.relations,
    ...state.contradictions,
  ]);

  const outputFiles: string[] = [];

  outputFiles.push(writeRecordsJsonl(distDir, state.records));
  outputFiles.push(writeClaimsJsonl(distDir, state.claims));
  outputFiles.push(writeRelationsJsonl(distDir, state.relations));

  const publicEvidence = redactPublicEvidence(state.evidence);
  outputFiles.push(writePublicEvidenceJsonl(distDir, publicEvidence));

  outputFiles.push(writeSourcesJson(distDir, state.bindings));
  outputFiles.push(writeCoverageJson(distDir, state.coverage));
  outputFiles.push(writeKeyMapJson(distDir, state.keys));
  outputFiles.push(writeAliasMapJson(distDir, state.aliases));

  const sqliteResult = buildSqlite(distDir, {
    records: state.records,
    claims: state.claims,
    relations: state.relations,
    contradictions: state.contradictions,
    publicEvidence,
    keys: state.keys,
    aliases: state.aliases,
    bindings: state.bindings,
    coverage: state.coverage,
  });
  outputFiles.push(sqliteResult.path);

  const sqliteVerification = verifySqliteIntegrity(sqliteResult.path);
  if (!sqliteVerification.valid) {
    throw new KnowledgeCoreError(
      `SQLite integrity check failed: ${sqliteVerification.errors.join("; ")}`,
      "SQLITE_INTEGRITY_FAILED",
      { errors: sqliteVerification.errors },
    );
  }

  const recordCounts: Record<string, number> = {
    records: state.records.length,
    claims: state.claims.length,
    relations: state.relations.length,
    contradictions: state.contradictions.length,
    evidence_public: publicEvidence.length,
    evidence_total: state.evidence.length,
    sources: state.bindings.length,
    coverage: state.coverage.length,
    keys: state.keys.length,
    aliases: state.aliases.length,
  };

  const builtFromBindings: Record<string, string> = {};
  for (const b of state.bindings) {
    builtFromBindings[b.source_id] = b.binding_digest;
  }

  const manifest = createManifest({
    datasetId: paths.manifest.id,
    datasetVersion: paths.manifest.dataset_version,
    modelVersion: paths.manifest.model_version,
    canonicalHash,
    license: paths.config.publication.dataset_license,
    recordCounts,
    builtFromBindings,
    logicalDumpHash: sqliteResult.logicalDumpHash,
  });

  outputFiles.push(writeManifest(distDir, manifest));

  return {
    manifest,
    canonicalHash,
    logicalDumpHash: sqliteResult.logicalDumpHash,
    recordCounts,
    outputFiles,
    distDir,
  };
}

/**
 * Read canonical state without materializing.
 * Useful for pre-flight checks.
 */
export function readState(workspaceRoot: string): CanonicalState {
  const paths = resolveKnowledgePaths(workspaceRoot);
  return readCanonicalState(paths.canonicalRoot);
}

/**
 * Verify canonical state without materializing.
 */
export function verifyState(workspaceRoot: string): ReturnType<typeof verifyCanonicalState> {
  const paths = resolveKnowledgePaths(workspaceRoot);
  const state = readCanonicalState(paths.canonicalRoot);
  return verifyCanonicalState(state);
}
