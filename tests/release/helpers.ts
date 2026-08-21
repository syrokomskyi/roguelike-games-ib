import { writeFileSync, mkdirSync, existsSync, copyFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { createTestWorkspace, cleanupTempWorkspace } from "@roguelike-games-ib/test-fixtures";
import { canonicalJsonStringify, createSourceBinding, computeSourceFingerprint } from "@roguelike-games-ib/knowledge-core";
import { materialize } from "@roguelike-games-ib/materializer";
import { parse as parseYaml } from "yaml";
import { writeFileSync as wfs, readFileSync as rfs } from "node:fs";

export interface ReleaseTestSetup {
  workspace: string;
  canonicalRoot: string;
  distDir: string;
  cleanup: () => void;
}

export function testId(n: number): string {
  const hex = n.toString(16).padStart(12, "0");
  return `00000000-0000-7000-8000-${hex}00000000`;
}

export function setupReleaseWorkspace(options?: {
  kbId?: string;
  records?: Array<Record<string, unknown>>;
  keys?: Array<{ id: string; key: string; record_type: string }>;
  bindings?: Array<{
    source_id: string;
    source_unit_path: string;
    declared_version: string;
    payload_path?: string;
  }>;
  skipMaterialize?: boolean;
  skipLicense?: boolean;
  skipNotice?: boolean;
  extraFiles?: Array<{ path: string; content: string }>;
}): ReleaseTestSetup {
  const kbId = options?.kbId ?? "rel-test";
  const workspace = createTestWorkspace({ kbId });
  const canonicalRoot = join(workspace, "knowledge");
  const distDir = join(workspace, ".generated", "knowledge", "dist");

  for (const record of options?.records ?? []) {
    const dir = join(canonicalRoot, record.record_type as string);
    mkdirSync(dir, { recursive: true });
    wfs(join(dir, `${record.key}.jsonl`), canonicalJsonStringify(record) + "\n", "utf-8");
  }

  if (options?.keys && options.keys.length > 0) {
    const keysPath = join(canonicalRoot, "identity", "keys.jsonl");
    const lines = options.keys.map((k) => canonicalJsonStringify(k));
    wfs(keysPath, lines.join("\n") + "\n", "utf-8");
  }

  const ontologyDir = join(canonicalRoot, "ontology");
  if (existsSync(ontologyDir)) {
    wfs(
      join(ontologyDir, "relation-types.yaml"),
      `schema: rgkb/relation-ontology@2\nmodel_version: 2.0.0\nrelations:\n- id: similar_to\n  semantics: Source record is similar to target record.\n  direction: symmetric\n  evidence_required: false\n  domain:\n  - creature\n  range:\n  - creature\n`,
      "utf-8",
    );
  }

  if (options?.bindings && options.bindings.length > 0) {
    const sourceRoot = resolve(workspace, "..", `${kbId}-source`);
    const bindingsYaml: string[] = [`schema: rgkb/source-bindings@2`, `bindings:`];
    for (const b of options.bindings) {
      const payloadPath = b.payload_path ?? "source";
      const unitPath = b.source_unit_path === "." ? sourceRoot : join(sourceRoot, b.source_unit_path);
      const fullPayload = join(unitPath, payloadPath);
      const fingerprint = computeSourceFingerprint(fullPayload);
      const binding = createSourceBinding(
        b.source_id,
        b.source_unit_path,
        b.declared_version,
        "semver",
        "package_json",
        fingerprint,
        { repository: null, commit: null, clean: null },
      );
      bindingsYaml.push(`  - source_id: ${b.source_id}`);
      bindingsYaml.push(`    source_unit_path: ${b.source_unit_path}`);
      bindingsYaml.push(`    declared_version: "${b.declared_version}"`);
      bindingsYaml.push(`    version_scheme: semver`);
      bindingsYaml.push(`    metadata_origin: package_json`);
      bindingsYaml.push(`    payload_path: ${payloadPath}`);
      bindingsYaml.push(`    fingerprint:`);
      bindingsYaml.push(`      algorithm: sha256-tree-v1`);
      bindingsYaml.push(`      value: ${binding.fingerprint.value}`);
      bindingsYaml.push(`    vcs:`);
      bindingsYaml.push(`      repository: null`);
      bindingsYaml.push(`      commit: null`);
      bindingsYaml.push(`      clean: null`);
      bindingsYaml.push(`    binding_digest: ${binding.binding_digest}`);
    }
    wfs(join(canonicalRoot, "sources", "bindings.yaml"), bindingsYaml.join("\n") + "\n", "utf-8");

    const registryYaml: string[] = [`schema: rgkb/source-registry@2`, `sources:`];
    for (const b of options.bindings) {
      registryYaml.push(`  - id: ${b.source_id}`);
      registryYaml.push(`    kind: game_repository`);
      registryYaml.push(`    unit_path: ${b.source_unit_path}`);
    }
    wfs(join(canonicalRoot, "sources", "registry.yaml"), registryYaml.join("\n") + "\n", "utf-8");
  }

  if (!options?.skipLicense) {
    const licensesDir = join(workspace, "LICENSES");
    mkdirSync(licensesDir, { recursive: true });
    wfs(join(licensesDir, "CC-BY-4.0.txt"), "Creative Commons Attribution 4.0 International\n", "utf-8");
  }

  if (!options?.skipNotice) {
    wfs(
      join(workspace, "NOTICE.dataset.md"),
      "# Dataset Notice\n\nCC BY 4.0\n",
      "utf-8",
    );
  }

  for (const file of options?.extraFiles ?? []) {
    const fullPath = join(canonicalRoot, file.path);
    mkdirSync(join(fullPath, ".."), { recursive: true });
    wfs(fullPath, file.content, "utf-8");
  }

  if (!options?.skipMaterialize && (options?.records?.length ?? 0) > 0) {
    materialize({ workspaceRoot: workspace });
  }

  return {
    workspace,
    canonicalRoot,
    distDir,
    cleanup: () => {
      // Also clean up the source bundle which is a sibling directory
      const sourceDir = resolve(workspace, "..", `${kbId}-source`);
      try { rmSync(sourceDir, { recursive: true, force: true }); } catch { /* ignore */ }
      cleanupTempWorkspace(workspace);
    },
  };
}
