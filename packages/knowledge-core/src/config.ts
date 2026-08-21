import { readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { parse as parseYaml } from "yaml";
import { KnowledgeCoreError } from "./errors.ts";

export interface KnowledgeConfig {
  schema: string;
  knowledge_base_id: string;
  canonical_root: string;
  staging_root: string;
  laboratory_root: string;
  generated_root: string;
  source_root: {
    strategy: string;
    suffix: string;
  };
  publication: {
    dataset_mode: string;
    dataset_license: string;
  };
  projections?: Record<string, unknown>;
  search?: Record<string, unknown>;
}

export interface KnowledgeManifest {
  schema: string;
  id: string;
  model_version: string;
  dataset_version: string;
  canonical_language: string;
  source_root: {
    strategy: string;
    suffix: string;
  };
  authority: {
    canonical_root: string;
    staging_root: string;
    laboratory_root: string;
  };
  publication: {
    dataset_mode: string;
    dataset_license: string;
    canonical_language_only?: boolean;
  };
  decision_policy?: {
    ontology_change: string;
    cross_game_concept: string;
  };
}

export function readKnowledgeConfig(workspaceRoot: string): KnowledgeConfig {
  const configPath = join(workspaceRoot, "knowledge.config.yaml");
  const raw = readFileSync(configPath, "utf-8");
  const config = parseYaml(raw) as KnowledgeConfig;

  if (!config.knowledge_base_id) {
    throw new KnowledgeCoreError(
      "knowledge.config.yaml missing knowledge_base_id",
      "CONFIG_MISSING_ID",
    );
  }

  return config;
}

export function readKnowledgeManifest(workspaceRoot: string): KnowledgeManifest {
  const manifestPath = join(workspaceRoot, "knowledge", "manifest.yaml");
  const raw = readFileSync(manifestPath, "utf-8");
  const manifest = parseYaml(raw) as KnowledgeManifest;

  if (!manifest.id) {
    throw new KnowledgeCoreError(
      "knowledge/manifest.yaml missing id",
      "MANIFEST_MISSING_ID",
    );
  }

  if (!manifest.source_root || manifest.source_root.strategy !== "sibling_suffix") {
    throw new KnowledgeCoreError(
      "manifest source_root.strategy must be 'sibling_suffix'",
      "MANIFEST_INVALID_SOURCE_STRATEGY",
    );
  }

  return manifest;
}

export function resolveKnowledgePaths(workspaceRoot: string) {
  const config = readKnowledgeConfig(workspaceRoot);
  const manifest = readKnowledgeManifest(workspaceRoot);

  const canonicalRoot = resolve(workspaceRoot, manifest.authority.canonical_root);
  const stagingRoot = resolve(workspaceRoot, manifest.authority.staging_root);
  const laboratoryRoot = resolve(workspaceRoot, manifest.authority.laboratory_root);
  const generatedRoot = resolve(workspaceRoot, config.generated_root);
  const sourceRoot = resolveSourceRoot(workspaceRoot, manifest.id, manifest.source_root.suffix);

  return {
    workspaceRoot: resolve(workspaceRoot),
    canonicalRoot,
    stagingRoot,
    laboratoryRoot,
    generatedRoot,
    sourceRoot,
    config,
    manifest,
  };
}

export function resolveSourceRoot(
  workspaceRoot: string,
  kbId: string,
  suffix: string,
): string {
  if (suffix !== "-source") {
    throw new KnowledgeCoreError(
      `source_root.suffix must be '-source', got '${suffix}'`,
      "INVALID_SOURCE_SUFFIX",
    );
  }

  const parent = resolve(workspaceRoot, "..");
  const sourceDirName = `${kbId}${suffix}`;
  return resolve(parent, sourceDirName);
}
