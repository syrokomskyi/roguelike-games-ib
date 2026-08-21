import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ReadonlySourceReader } from "@roguelike-games-ib/extractor-sdk";
import { createTestWorkspace, cleanupTempWorkspace, createSourceBundle, createTempWorkspace } from "@roguelike-games-ib/test-fixtures";
import { writeFileSync, mkdirSync, symlinkSync } from "node:fs";
import { join } from "node:path";

describe("EXT-001: ReadonlySource rejects absolute path", () => {
  let workspace: string;
  let sourceRoot: string;

  beforeEach(() => {
    workspace = createTestWorkspace();
    const parentDir = join(workspace, "..");
    sourceRoot = join(parentDir, "roguelike-games-ib-source", "source");
  });

  afterEach(() => {
    cleanupTempWorkspace(workspace);
  });

  it("rejects absolute path on resolveSafe", () => {
    const reader = new ReadonlySourceReader(sourceRoot);
    expect(() => reader.resolveSafe("/etc/passwd")).toThrow();
  });

  it("rejects absolute path on readText", () => {
    const reader = new ReadonlySourceReader(sourceRoot);
    expect(() => reader.readText("/etc/passwd")).toThrow();
  });

  it("rejects absolute path on readBytes", () => {
    const reader = new ReadonlySourceReader(sourceRoot);
    expect(() => reader.readBytes("/etc/passwd")).toThrow();
  });

  it("rejects absolute path on exists", () => {
    const reader = new ReadonlySourceReader(sourceRoot);
    expect(reader.exists("/etc/passwd")).toBe(false);
  });
});

describe("EXT-002: ReadonlySource rejects '..' escape", () => {
  let workspace: string;
  let sourceRoot: string;

  beforeEach(() => {
    workspace = createTestWorkspace();
    const parentDir = join(workspace, "..");
    sourceRoot = join(parentDir, "roguelike-games-ib-source", "source");
  });

  afterEach(() => {
    cleanupTempWorkspace(workspace);
  });

  it("rejects '..' on resolveSafe", () => {
    const reader = new ReadonlySourceReader(sourceRoot);
    expect(() => reader.resolveSafe("../../etc/passwd")).toThrow();
  });

  it("rejects nested '..' on readText", () => {
    const reader = new ReadonlySourceReader(sourceRoot);
    expect(() => reader.readText("data/../../etc/passwd")).toThrow();
  });

  it("rejects '..' on parseJson", () => {
    const reader = new ReadonlySourceReader(sourceRoot);
    expect(() => reader.parseJson("../secret.json")).toThrow();
  });
});

describe("EXT-003: ReadonlySource rejects escaping symlink read", () => {
  let tempDir: string;
  let sourceRoot: string;

  beforeEach(() => {
    tempDir = createTempWorkspace();
    sourceRoot = join(tempDir, "source");
    mkdirSync(sourceRoot, { recursive: true });

    // Create a secret file outside source root
    writeFileSync(join(tempDir, "secret.txt"), "secret content", "utf-8");

    // Create a symlink inside source that points outside
    try {
      symlinkSync(join(tempDir, "secret.txt"), join(sourceRoot, "escape-link.txt"));
    } catch {
      // Symlink may fail on some platforms
    }
  });

  afterEach(() => {
    cleanupTempWorkspace(tempDir);
  });

  it("rejects reading through escaping symlink", () => {
    const reader = new ReadonlySourceReader(sourceRoot);
    expect(() => reader.readText("escape-link.txt")).toThrow();
  });

  it("rejects resolveSafe on escaping symlink", () => {
    const reader = new ReadonlySourceReader(sourceRoot);
    expect(() => reader.resolveSafe("escape-link.txt")).toThrow();
  });
});
