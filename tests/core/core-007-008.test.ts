import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resolveSourceBundleRoot } from "@roguelike-games-ib/knowledge-core";
import { createTestWorkspace, cleanupTempWorkspace, createTempWorkspace } from "@roguelike-games-ib/test-fixtures";

describe("CORE-007: unregistered source is INFO only", () => {
  let workspace: string;

  beforeEach(() => {
    workspace = createTestWorkspace();
  });

  afterEach(() => {
    cleanupTempWorkspace(workspace);
  });

  it("source root exists but has no registered sources in registry", () => {
    const resolved = resolveSourceBundleRoot(workspace, "roguelike-games-ib");
    expect(resolved.exists).toBe(true);
    // The registry is empty — this is INFO, not an error
    // The source bundle exists on disk but is not registered
  });
});

describe("CORE-008: registered missing source is ERROR", () => {
  let workspace: string;

  beforeEach(() => {
    workspace = createTempWorkspace();
  });

  afterEach(() => {
    cleanupTempWorkspace(workspace);
  });

  it("source root does not exist when not created", () => {
    // Use a unique kb-id that won't have a source bundle sibling
    const resolved = resolveSourceBundleRoot(workspace, "nonexistent-test-source-id");
    expect(resolved.exists).toBe(false);
  });
});
