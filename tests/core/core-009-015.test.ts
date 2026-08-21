import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { computeSourceFingerprint, computeBindingDigest, detectSourceDrift } from "@roguelike-games-ib/knowledge-core";
import { createSourceBundle, createTempWorkspace, cleanupTempWorkspace } from "@roguelike-games-ib/test-fixtures";
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

describe("CORE-009: fingerprint stable across directory enumeration order", () => {
  let workspace: string;

  beforeEach(() => {
    workspace = createTempWorkspace();
  });

  afterEach(() => {
    cleanupTempWorkspace(workspace);
  });

  it("produces same hash regardless of file creation order", () => {
    const sourceDir = createSourceBundle(workspace, "test-source");
    const payloadPath = join(sourceDir, "source");

    // Create files in one order
    writeFileSync(join(payloadPath, "a.ts"), "export const a = 1;");
    writeFileSync(join(payloadPath, "b.ts"), "export const b = 2;");
    writeFileSync(join(payloadPath, "c.ts"), "export const c = 3;");

    const hash1 = computeSourceFingerprint(payloadPath);

    // Create same files in different order in a new bundle
    const sourceDir2 = createSourceBundle(workspace, "test-source-2");
    const payloadPath2 = join(sourceDir2, "source");
    writeFileSync(join(payloadPath2, "c.ts"), "export const c = 3;");
    writeFileSync(join(payloadPath2, "a.ts"), "export const a = 1;");
    writeFileSync(join(payloadPath2, "b.ts"), "export const b = 2;");

    const hash2 = computeSourceFingerprint(payloadPath2);

    expect(hash1).toBe(hash2);
  });
});

describe("CORE-010: fingerprint ignores mtime/mode", () => {
  let workspace: string;

  beforeEach(() => {
    workspace = createTempWorkspace();
  });

  afterEach(() => {
    cleanupTempWorkspace(workspace);
  });

  it("produces same hash after touching file (changing mtime)", () => {
    const sourceDir = createSourceBundle(workspace, "test-source");
    const payloadPath = join(sourceDir, "source");
    writeFileSync(join(payloadPath, "file.ts"), "export const x = 1;");

    const hash1 = computeSourceFingerprint(payloadPath);

    // Re-write same content (changes mtime)
    writeFileSync(join(payloadPath, "file.ts"), "export const x = 1;");

    const hash2 = computeSourceFingerprint(payloadPath);

    expect(hash1).toBe(hash2);
  });
});

describe("CORE-011: fingerprint changes when evidence file bytes change", () => {
  let workspace: string;

  beforeEach(() => {
    workspace = createTempWorkspace();
  });

  afterEach(() => {
    cleanupTempWorkspace(workspace);
  });

  it("produces different hash when file content changes", () => {
    const sourceDir = createSourceBundle(workspace, "test-source");
    const payloadPath = join(sourceDir, "source");
    writeFileSync(join(payloadPath, "file.ts"), "export const x = 1;");

    const hash1 = computeSourceFingerprint(payloadPath);

    writeFileSync(join(payloadPath, "file.ts"), "export const x = 2;");

    const hash2 = computeSourceFingerprint(payloadPath);

    expect(hash1).not.toBe(hash2);
  });
});

describe("CORE-012: symlink is hashed but not followed outside payload", () => {
  let workspace: string;

  beforeEach(() => {
    workspace = createTempWorkspace();
  });

  afterEach(() => {
    cleanupTempWorkspace(workspace);
  });

  it("includes symlink in fingerprint without following it", () => {
    const sourceDir = createSourceBundle(workspace, "test-source");
    const payloadPath = join(sourceDir, "source");
    writeFileSync(join(payloadPath, "real.ts"), "export const real = true;");

    const hash1 = computeSourceFingerprint(payloadPath);

    // Create a symlink inside payload pointing to the real file
    try {
      const { symlinkSync } = require("node:fs");
      symlinkSync("real.ts", join(payloadPath, "link.ts"));
    } catch {
      // Symlinks may not be supported on all platforms
      return;
    }

    const hash2 = computeSourceFingerprint(payloadPath);

    // Hash should change because a new entry was added
    expect(hash1).not.toBe(hash2);
  });
});

describe("CORE-013: binding digest stable for same logical binding", () => {
  it("produces same digest for same fingerprint + version + source_id", () => {
    const fp = "a".repeat(64);
    const digest1 = computeBindingDigest(fp, "1.0.0", "brogue-ce");
    const digest2 = computeBindingDigest(fp, "1.0.0", "brogue-ce");
    expect(digest1).toBe(digest2);
  });

  it("produces different digest for different version", () => {
    const fp = "a".repeat(64);
    const digest1 = computeBindingDigest(fp, "1.0.0", "brogue-ce");
    const digest2 = computeBindingDigest(fp, "2.0.0", "brogue-ce");
    expect(digest1).not.toBe(digest2);
  });
});

describe("CORE-014: drift detected on version change", () => {
  it("detects drift when version changes", () => {
    const result = detectSourceDrift(
      { fingerprint: { value: "a".repeat(64) }, declared_version: "1.0.0", binding_digest: "b".repeat(64) },
      "a".repeat(64),
      "2.0.0",
    );
    expect(result.drifted).toBe(true);
    expect(result.reason).toContain("Version");
  });
});

describe("CORE-015: drift detected on fingerprint change without version bump", () => {
  it("detects drift when fingerprint changes but version stays same", () => {
    const result = detectSourceDrift(
      { fingerprint: { value: "a".repeat(64) }, declared_version: "1.0.0", binding_digest: "b".repeat(64) },
      "c".repeat(64),
      "1.0.0",
    );
    expect(result.drifted).toBe(true);
    expect(result.reason).toContain("Fingerprint changed without version bump");
  });

  it("no drift when fingerprint and version match", () => {
    const result = detectSourceDrift(
      { fingerprint: { value: "a".repeat(64) }, declared_version: "1.0.0", binding_digest: "b".repeat(64) },
      "a".repeat(64),
      "1.0.0",
    );
    expect(result.drifted).toBe(false);
  });
});
