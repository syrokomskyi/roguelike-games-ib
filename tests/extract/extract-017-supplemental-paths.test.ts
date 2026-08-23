import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ReadonlySourceReader } from "@roguelike-games-ib/extractor-sdk";
import {
  computeSupplementalFingerprint,
  computeBindingDigest,
  computeSourceFingerprint,
  createSourceBinding,
  type SupplementalPath,
} from "@roguelike-games-ib/knowledge-core";
import { createTempWorkspace, cleanupTempWorkspace } from "@roguelike-games-ib/test-fixtures";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

describe("EXT-017: Supplemental paths", () => {
  let workspace: string;
  let payloadRoot: string;
  let supplementalRoot: string;

  beforeEach(() => {
    workspace = createTempWorkspace();
    payloadRoot = join(workspace, "payload");
    supplementalRoot = join(workspace, "supplemental");
    mkdirSync(payloadRoot, { recursive: true });
    mkdirSync(supplementalRoot, { recursive: true });
    writeFileSync(join(payloadRoot, "data.yaml"), "test: true");
    writeFileSync(join(supplementalRoot, "god-type.h"), "enum { GOD_A, GOD_B }");
    writeFileSync(join(supplementalRoot, "ability-type.h"), "enum { ABIL_A }");
    writeFileSync(join(supplementalRoot, "readme.txt"), "not a header");
  });

  afterEach(() => {
    cleanupTempWorkspace(workspace);
  });

  describe("ReadonlySourceReader with supplemental roots", () => {
    it("reads file from supplemental root via prefixed path", () => {
      const reader = new ReadonlySourceReader(payloadRoot, [
        { name: "headers", root: supplementalRoot, glob: "*.h" },
      ]);
      const text = reader.readText("headers/god-type.h");
      expect(text).toContain("GOD_A");
    });

    it("reads file from payload root for non-prefixed paths", () => {
      const reader = new ReadonlySourceReader(payloadRoot, [
        { name: "headers", root: supplementalRoot, glob: "*.h" },
      ]);
      const text = reader.readText("data.yaml");
      expect(text).toContain("test: true");
    });

    it("exists returns true for supplemental file", () => {
      const reader = new ReadonlySourceReader(payloadRoot, [
        { name: "headers", root: supplementalRoot, glob: "*.h" },
      ]);
      expect(reader.exists("headers/god-type.h")).toBe(true);
      expect(reader.exists("headers/nonexistent.h")).toBe(false);
    });

    it("stat works for supplemental file", () => {
      const reader = new ReadonlySourceReader(payloadRoot, [
        { name: "headers", root: supplementalRoot, glob: "*.h" },
      ]);
      const s = reader.stat("headers/god-type.h");
      expect(s.isFile).toBe(true);
      expect(s.size).toBeGreaterThan(0);
    });

    it("getSupplementalRoots returns configured roots", () => {
      const reader = new ReadonlySourceReader(payloadRoot, [
        { name: "headers", root: supplementalRoot, glob: "*.h" },
      ]);
      const roots = reader.getSupplementalRoots();
      expect(roots).toHaveLength(1);
      expect(roots[0].name).toBe("headers");
      expect(roots[0].glob).toBe("*.h");
    });
  });

  describe("ReadonlySourceReader without supplemental roots (backward compat)", () => {
    it("behaves identically to single-root reader", () => {
      const reader = new ReadonlySourceReader(payloadRoot);
      const text = reader.readText("data.yaml");
      expect(text).toContain("test: true");
      expect(reader.getSupplementalRoots()).toEqual([]);
    });

    it("rejects absolute paths", () => {
      const reader = new ReadonlySourceReader(payloadRoot, [
        { name: "headers", root: supplementalRoot, glob: "*.h" },
      ]);
      expect(() => reader.resolveSafe("/etc/passwd")).toThrow();
    });

    it("rejects .. traversal", () => {
      const reader = new ReadonlySourceReader(payloadRoot, [
        { name: "headers", root: supplementalRoot, glob: "*.h" },
      ]);
      expect(() => reader.resolveSafe("../../etc/passwd")).toThrow();
    });
  });

  describe("computeSupplementalFingerprint", () => {
    it("hashes only files matching glob", () => {
      const fp = computeSupplementalFingerprint(supplementalRoot, "*.h");
      expect(fp).toMatch(/^[a-f0-9]{64}$/);
    });

    it("different globs produce different fingerprints", () => {
      const fpH = computeSupplementalFingerprint(supplementalRoot, "*.h");
      const fpTxt = computeSupplementalFingerprint(supplementalRoot, "*.txt");
      expect(fpH).not.toBe(fpTxt);
    });

    it("empty glob match produces valid hash", () => {
      const fp = computeSupplementalFingerprint(supplementalRoot, "*.json");
      expect(fp).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe("computeBindingDigest backward compatibility", () => {
    it("without supplementalFingerprints produces same result as 3-arg call", () => {
      const fp = "abc123";
      const version = "1.0.0";
      const sourceId = "test";
      const digest3 = computeBindingDigest(fp, version, sourceId);
      const digest4 = computeBindingDigest(fp, version, sourceId, []);
      const digest4Undefined = computeBindingDigest(fp, version, sourceId, undefined);
      expect(digest3).toBe(digest4);
      expect(digest3).toBe(digest4Undefined);
    });

    it("with supplementalFingerprints produces different digest", () => {
      const fp = "abc123";
      const version = "1.0.0";
      const sourceId = "test";
      const digestWithout = computeBindingDigest(fp, version, sourceId);
      const digestWith = computeBindingDigest(fp, version, sourceId, ["sup123"]);
      expect(digestWithout).not.toBe(digestWith);
    });
  });

  describe("createSourceBinding with supplemental paths", () => {
    it("accepts supplemental paths and includes them in binding", () => {
      const fp = computeSourceFingerprint(payloadRoot);
      const spFp = computeSupplementalFingerprint(supplementalRoot, "*.h");
      const supplementalPaths: SupplementalPath[] = [
        { name: "headers", path: "../supplemental", glob: "*.h", fingerprint: { algorithm: "sha256-tree-v1", value: spFp } },
      ];
      const binding = createSourceBinding(
        "test", "test", "1.0.0", "semver", "manual",
        fp, null, "payload", supplementalPaths,
      );
      expect(binding.supplemental_paths).toBeDefined();
      expect(binding.supplemental_paths).toHaveLength(1);
      expect(binding.supplemental_paths![0].name).toBe("headers");
    });

    it("throws on duplicate supplemental names", () => {
      const fp = computeSourceFingerprint(payloadRoot);
      const spFp = computeSupplementalFingerprint(supplementalRoot, "*.h");
      const supplementalPaths: SupplementalPath[] = [
        { name: "headers", path: "../supplemental", glob: "*.h", fingerprint: { algorithm: "sha256-tree-v1", value: spFp } },
        { name: "headers", path: "../other", glob: "*.h", fingerprint: { algorithm: "sha256-tree-v1", value: spFp } },
      ];
      expect(() =>
        createSourceBinding("test", "test", "1.0.0", "semver", "manual", fp, null, "payload", supplementalPaths),
      ).toThrow(/Duplicate supplemental path name/);
    });

    it("without supplemental paths produces same binding_digest as before", () => {
      const fp = computeSourceFingerprint(payloadRoot);
      const bindingWithout = createSourceBinding("test", "test", "1.0.0", "semver", "manual", fp, null, "payload");
      const expectedDigest = computeBindingDigest(fp, "1.0.0", "test");
      expect(bindingWithout.binding_digest).toBe(expectedDigest);
      expect(bindingWithout.supplemental_paths).toBeUndefined();
    });
  });
});
