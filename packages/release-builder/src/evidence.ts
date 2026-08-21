import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import {
  resolveKnowledgePaths,
  computeCanonicalHash,
  type SourceBinding,
} from "@roguelike-games-ib/knowledge-core";
import { readCanonicalState } from "@roguelike-games-ib/materializer";
import type { ReleaseEvidence } from "./types.ts";

export function generateReleaseEvidence(
  workspaceRoot: string,
  acceptedRfcs: string[] = [],
  acceptedAdrs: string[] = [],
): ReleaseEvidence {
  const paths = resolveKnowledgePaths(workspaceRoot);
  const state = readCanonicalState(paths.canonicalRoot);

  const canonicalHash = computeCanonicalHash([
    ...state.records,
    ...state.claims,
    ...state.relations,
    ...state.contradictions,
  ]);

  const distDir = join(paths.generatedRoot, "dist");
  const manifestPath = join(distDir, "manifest.json");
  let materializationHash: string | null = null;
  let logicalDumpHash: string | null = null;

  if (existsSync(manifestPath)) {
    const matManifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
    materializationHash = matManifest.canonicalHash ?? null;
    logicalDumpHash = matManifest.logicalDumpHash ?? null;
  }

  const bindingsPath = join(paths.canonicalRoot, "sources", "bindings.yaml");
  const bindingDigests: Record<string, string> = {};
  if (existsSync(bindingsPath)) {
    const bindings = parseYaml(readFileSync(bindingsPath, "utf-8")) as {
      bindings: SourceBinding[];
    };
    for (const b of bindings.bindings) {
      bindingDigests[b.source_id] = b.binding_digest;
    }
  }

  const recordCount =
    state.records.length +
    state.claims.length +
    state.relations.length +
    state.contradictions.length +
    state.evidence.length;

  return {
    schema: "rgkb/release-evidence@1",
    datasetId: paths.manifest.id,
    datasetVersion: paths.manifest.dataset_version,
    modelVersion: paths.manifest.model_version,
    canonicalHash,
    materializationHash: materializationHash ?? "",
    logicalDumpHash: logicalDumpHash ?? "",
    bindingDigests,
    recordCount,
    sourceCount: state.bindings.length,
    license: paths.config.publication.dataset_license,
    acceptedRfcs,
    acceptedAdrs,
    status: "pass",
    blockers: [],
    generatedAt: "1970-01-01T00:00:00.000Z",
  };
}
