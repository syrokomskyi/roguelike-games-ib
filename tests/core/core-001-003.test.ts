import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resolveSourceRoot, resolveKnowledgePaths, resolveSourceBundleRoot, assertNoSourceOverride, validateSourcePath } from "@roguelike-games-ib/knowledge-core";
import { createTestWorkspace, cleanupTempWorkspace } from "@roguelike-games-ib/test-fixtures";
import { existsSync, realpathSync } from "node:fs";
import { join } from "node:path";

describe("CORE-001: source root derives from manifest id + -source", () => {
  let workspace: string;

  beforeEach(() => {
    workspace = createTestWorkspace();
  });

  afterEach(() => {
    cleanupTempWorkspace(workspace);
  });

  it("derives source root as ../<kb-id>-source", () => {
    const paths = resolveKnowledgePaths(workspace);
    const expectedSourceRoot = join(workspace, "..", "roguelike-games-ib-source");
    expect(realpathSync(paths.sourceRoot)).toBe(realpathSync(expectedSourceRoot));
  });

  it("source root exists after creation", () => {
    const resolved = resolveSourceBundleRoot(workspace, "roguelike-games-ib");
    expect(resolved.exists).toBe(true);
  });
});

describe("CORE-002: arbitrary source override rejected in certified mode", () => {
  let workspace: string;

  beforeEach(() => {
    workspace = createTestWorkspace();
  });

  afterEach(() => {
    cleanupTempWorkspace(workspace);
  });

  it("rejects mismatched source root", () => {
    const expectedRoot = resolveSourceRoot(workspace, "roguelike-games-ib", "-source");
    expect(() => assertNoSourceOverride("/tmp", expectedRoot)).toThrow();
  });

  it("accepts matching source root", () => {
    const expectedRoot = resolveSourceRoot(workspace, "roguelike-games-ib", "-source");
    expect(() => assertNoSourceOverride(expectedRoot, expectedRoot)).not.toThrow();
  });
});

describe("CORE-003: source realpath escape/sibling mismatch rejected", () => {
  let workspace: string;

  beforeEach(() => {
    workspace = createTestWorkspace();
  });

  afterEach(() => {
    cleanupTempWorkspace(workspace);
  });

  it("rejects path traversal in source paths", () => {
    const paths = resolveKnowledgePaths(workspace);
    expect(() => validateSourcePath(paths.sourceRoot, "../../etc/passwd")).toThrow();
  });

  it("rejects absolute paths in source paths", () => {
    const paths = resolveKnowledgePaths(workspace);
    expect(() => validateSourcePath(paths.sourceRoot, "/etc/passwd")).toThrow();
  });

  it("accepts valid relative paths", () => {
    const paths = resolveKnowledgePaths(workspace);
    expect(() => validateSourcePath(paths.sourceRoot, "README.md")).not.toThrow();
  });
});
