import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

/**
 * Create a temporary workspace for testing.
 * Returns the workspace root path.
 */
export function createTempWorkspace(): string {
  const dir = mkdtempSync(join(tmpdir(), "rgib-test-"));
  return dir;
}

/**
 * Create a minimal source bundle for testing.
 */
export function createSourceBundle(
  parentDir: string,
  sourceId: string,
  options?: {
    version?: string;
    files?: { path: string; content: string }[];
    symlinks?: { linkPath: string; target: string }[];
  },
): string {
  const sourceDir = join(parentDir, sourceId);
  mkdirSync(sourceDir, { recursive: true });
  mkdirSync(join(sourceDir, "source"), { recursive: true });

  // Write README.md with frontmatter
  const readmeContent = `---
version: "${options?.version ?? "1.0.0"}"
version_scheme: "semver"
vcs_repository: "https://example.invalid/${sourceId}.git"
vcs_commit: "abc123def456"
---

# ${sourceId}

Test source bundle.
`;
  writeFileSync(join(sourceDir, "README.md"), readmeContent, "utf-8");

  // Write additional files
  for (const file of options?.files ?? []) {
    const filePath = join(sourceDir, "source", file.path);
    const fileDir = join(filePath, "..");
    mkdirSync(fileDir, { recursive: true });
    writeFileSync(filePath, file.content, "utf-8");
  }

  // Create symlinks
  for (const symlink of options?.symlinks ?? []) {
    const linkPath = join(sourceDir, "source", symlink.linkPath);
    try {
      symlinkSync(symlink.target, linkPath);
    } catch {
      // Symlink creation may fail on some platforms — skip
    }
  }

  return sourceDir;
}

/**
 * Clean up a temporary workspace.
 */
export function cleanupTempWorkspace(dir: string): void {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Create a complete test workspace with config and manifest.
 */
export function createTestWorkspace(options?: {
  kbId?: string;
  sourceVersion?: string;
  sourceFiles?: { path: string; content: string }[];
  sourceSymlinks?: { linkPath: string; target: string }[];
}): string {
  const workspace = createTempWorkspace();
  const kbId = options?.kbId ?? "roguelike-games-ib";

  // Create knowledge.config.yaml
  writeFileSync(
    join(workspace, "knowledge.config.yaml"),
    `schema: werkstatt/knowledge-config@1
knowledge_base_id: ${kbId}
canonical_root: knowledge
staging_root: staging
laboratory_root: laboratory
generated_root: .generated/knowledge
source_root:
  strategy: sibling_suffix
  suffix: -source
publication:
  dataset_mode: open
  dataset_license: CC-BY-4.0
projections:
  obsidian: true
  web: true
  mcp: true
search:
  full_text: true
  graph: true
  vector: true
`,
    "utf-8",
  );

  // Create knowledge/manifest.yaml
  mkdirSync(join(workspace, "knowledge", "ontology"), { recursive: true });
  mkdirSync(join(workspace, "knowledge", "sources"), { recursive: true });
  mkdirSync(join(workspace, "knowledge", "identity"), { recursive: true });
  mkdirSync(join(workspace, "knowledge", "games"), { recursive: true });

  writeFileSync(
    join(workspace, "knowledge", "manifest.yaml"),
    `schema: rgkb/knowledge-manifest@2
id: ${kbId}
model_version: 2.0.0
dataset_version: 0.1.0-dev
canonical_language: en
source_root:
  strategy: sibling_suffix
  suffix: -source
authority:
  canonical_root: knowledge
  staging_root: staging
  laboratory_root: laboratory
publication:
  dataset_mode: open
  dataset_license: CC-BY-4.0
  canonical_language_only: true
decision_policy:
  ontology_change: rfc
  cross_game_concept: adr
`,
    "utf-8",
  );

  // Create empty source registries
  writeFileSync(
    join(workspace, "knowledge", "sources", "registry.yaml"),
    `schema: rgkb/source-registry@2
sources: []
`,
    "utf-8",
  );
  writeFileSync(
    join(workspace, "knowledge", "sources", "bindings.yaml"),
    `schema: rgkb/source-bindings@2
bindings: []
`,
    "utf-8",
  );

  // Create empty identity files
  writeFileSync(join(workspace, "knowledge", "identity", "keys.jsonl"), "", "utf-8");
  writeFileSync(join(workspace, "knowledge", "identity", "aliases.jsonl"), "", "utf-8");

  // Create source bundle as a sibling directory
  const sourceDirName = `${kbId}-source`;
  const parentDir = join(workspace, "..");
  createSourceBundle(parentDir, sourceDirName, {
    version: options?.sourceVersion,
    files: options?.sourceFiles,
    symlinks: options?.sourceSymlinks,
  });

  return workspace;
}
