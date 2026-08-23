import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";

const WORKSPACE = resolve(__dirname, "../..");
const MANIFEST_PATH = join(WORKSPACE, "knowledge", "manifest.yaml");

interface VersionHistoryEntry {
  version: string;
  date: string;
  commit: string;
  record_count: number;
  concept_count: number;
  changes: string;
}

interface Manifest {
  dataset_version: string;
  version_history?: VersionHistoryEntry[];
}

describe("C18: Dataset versioning (RFC-0014)", () => {
  const raw = readFileSync(MANIFEST_PATH, "utf-8");
  const manifest = parseYaml(raw) as Manifest;

  it("manifest.yaml has dataset_version field", () => {
    expect(manifest.dataset_version).toBeDefined();
    expect(typeof manifest.dataset_version).toBe("string");
  });

  it("dataset_version is valid SemVer", () => {
    const semverRe = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?$/;
    expect(manifest.dataset_version).toMatch(semverRe);
  });

  it("version_history exists and is non-empty", () => {
    expect(manifest.version_history).toBeDefined();
    expect(Array.isArray(manifest.version_history)).toBe(true);
    expect(manifest.version_history!.length).toBeGreaterThan(0);
  });

  it("version_history entries have required fields", () => {
    for (const entry of manifest.version_history!) {
      expect(entry.version).toBeDefined();
      expect(typeof entry.version).toBe("string");
      expect(entry.date).toBeDefined();
      expect(typeof entry.date).toBe("string");
      expect(entry.commit).toBeDefined();
      expect(typeof entry.commit).toBe("string");
      expect(entry.record_count).toBeDefined();
      expect(typeof entry.record_count).toBe("number");
      expect(entry.concept_count).toBeDefined();
      expect(typeof entry.concept_count).toBe("number");
      expect(entry.changes).toBeDefined();
      expect(typeof entry.changes).toBe("string");
    }
  });

  it("DATASET_CARD.md exists at repository root", () => {
    const cardPath = join(WORKSPACE, "DATASET_CARD.md");
    expect(existsSync(cardPath)).toBe(true);
  });

  it("CITATION.bib exists at repository root", () => {
    const citationPath = join(WORKSPACE, "CITATION.bib");
    expect(existsSync(citationPath)).toBe(true);
  });
});
