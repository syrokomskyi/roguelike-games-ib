import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createEvidenceAnchor, validateEvidenceAnchor, reanchorEvidence, sha256File, computeFragmentHash } from "@roguelike-games-ib/knowledge-core";
import { createSourceBundle, createTempWorkspace, cleanupTempWorkspace } from "@roguelike-games-ib/test-fixtures";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

describe("CORE-020: evidence artifact hash validates raw bytes", () => {
  let workspace: string;

  beforeEach(() => {
    workspace = createTempWorkspace();
  });

  afterEach(() => {
    cleanupTempWorkspace(workspace);
  });

  it("validates correct artifact hash", () => {
    const sourceDir = createSourceBundle(workspace, "test-source");
    const payloadPath = join(sourceDir, "source");
    writeFileSync(join(payloadPath, "code.ts"), "export const x = 42;\n");

    const filePath = join(payloadPath, "code.ts");
    const hash = sha256File(filePath);

    const anchor = createEvidenceAnchor(
      "test-source",
      "a".repeat(64),
      "code.ts",
      hash,
      { symbol: "x", line_start: 1, line_end: 1, byte_start: null, byte_end: null, data_key: null },
      { access: "public", expose_locator: true, excerpt_policy: "short", license_ref: null },
    );

    const result = validateEvidenceAnchor(anchor, payloadPath);
    expect(result.valid).toBe(true);
  });

  it("rejects incorrect artifact hash", () => {
    const sourceDir = createSourceBundle(workspace, "test-source");
    const payloadPath = join(sourceDir, "source");
    writeFileSync(join(payloadPath, "code.ts"), "export const x = 42;\n");

    const anchor = createEvidenceAnchor(
      "test-source",
      "a".repeat(64),
      "code.ts",
      "0".repeat(64), // wrong hash
      { symbol: "x", line_start: 1, line_end: 1, byte_start: null, byte_end: null, data_key: null },
      { access: "public", expose_locator: true, excerpt_policy: "short", license_ref: null },
    );

    const result = validateEvidenceAnchor(anchor, payloadPath);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("hash mismatch"))).toBe(true);
  });
});

describe("CORE-021: line fragment reanchors uniquely after line shift", () => {
  let workspace: string;

  beforeEach(() => {
    workspace = createTempWorkspace();
  });

  afterEach(() => {
    cleanupTempWorkspace(workspace);
  });

  it("finds fragment at new location after lines are inserted above", () => {
    const sourceDir = createSourceBundle(workspace, "test-source");
    const payloadPath = join(sourceDir, "source");

    // Original file
    const originalContent = "line1\nline2\ntarget_line\nline4\n";
    writeFileSync(join(payloadPath, "code.ts"), originalContent);

    // Compute fragment hash for line 3
    const oldHash = computeFragmentHash(originalContent, 3, 3);

    // Modified file with lines inserted above
    const newContent = "line1\nline2\nnew_line\nnew_line2\ntarget_line\nline4\n";
    writeFileSync(join(payloadPath, "code.ts"), newContent);

    const result = reanchorEvidence(payloadPath, "code.ts", oldHash, 3, 3);

    expect(result.reanchored).toBe(true);
    expect(result.ambiguous).toBe(false);
    expect(result.new_locator).toEqual({ line_start: 5, line_end: 5 });
  });
});

describe("CORE-022: ambiguous fragment reanchor requires review", () => {
  let workspace: string;

  beforeEach(() => {
    workspace = createTempWorkspace();
  });

  afterEach(() => {
    cleanupTempWorkspace(workspace);
  });

  it("reports ambiguity when fragment appears multiple times", () => {
    const sourceDir = createSourceBundle(workspace, "test-source");
    const payloadPath = join(sourceDir, "source");

    // Original file with a unique target line at position 2
    const originalContent = "header\nduplicate_line\nfooter\n";
    writeFileSync(join(payloadPath, "code.ts"), originalContent);

    // Compute fragment hash for line 2 ("duplicate_line")
    const oldHash = computeFragmentHash(originalContent, 2, 2);

    // Modified file: original location changed, but "duplicate_line" appears twice elsewhere
    const newContent = "duplicate_line\nchanged_line\nduplicate_line\nfooter\n";
    writeFileSync(join(payloadPath, "code.ts"), newContent);

    // The old position (line 2) now has "changed_line" which doesn't match
    // But "duplicate_line" appears at lines 1 and 3
    const result = reanchorEvidence(payloadPath, "code.ts", oldHash, 2, 2);

    expect(result.ambiguous).toBe(true);
    expect(result.reanchored).toBe(false);
    expect(result.reason).toContain("manual review required");
  });
});
