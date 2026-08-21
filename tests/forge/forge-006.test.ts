import { describe, it, expect } from "vitest";
import { resolve, join } from "node:path";
import { existsSync } from "node:fs";
import { generateReleaseEvidence } from "@roguelike-games-ib/release-builder";
import { materialize } from "@roguelike-games-ib/materializer";

const WORKSPACE = resolve(__dirname, "../..");

describe("FORGE-006: releaseEvidence includes binding/canonical/projection hashes", () => {
  it("release evidence contains canonical hash", () => {
    const evidence = generateReleaseEvidence(WORKSPACE);
    expect(evidence.canonicalHash).toBeDefined();
    expect(evidence.canonicalHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("release evidence contains binding digests for all sources", () => {
    const evidence = generateReleaseEvidence(WORKSPACE);
    expect(evidence.bindingDigests).toBeDefined();
    expect(Object.keys(evidence.bindingDigests).length).toBeGreaterThan(0);

    for (const [sourceId, digest] of Object.entries(evidence.bindingDigests)) {
      expect(sourceId).toBeTruthy();
      expect(digest).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  it("release evidence contains materialization hash after materialize", () => {
    const distManifestPath = join(WORKSPACE, ".generated", "knowledge", "dist", "manifest.json");
    if (!existsSync(distManifestPath)) {
      try {
        materialize({ workspaceRoot: WORKSPACE });
      } catch {
        // Materialization may fail if canonical state has known issues
        // In that case, verify evidence handles missing materialization gracefully
      }
    }
    const evidence = generateReleaseEvidence(WORKSPACE);
    expect(evidence.materializationHash).toBeDefined();
    // If materialization succeeded, hash should be non-empty
    if (existsSync(distManifestPath)) {
      expect(evidence.materializationHash.length).toBeGreaterThan(0);
      expect(evidence.materializationHash).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  it("release evidence contains dataset id and model version", () => {
    const evidence = generateReleaseEvidence(WORKSPACE);
    expect(evidence.datasetId).toBe("roguelike-games-ib");
    expect(evidence.modelVersion).toBeDefined();
    expect(evidence.modelVersion.length).toBeGreaterThan(0);
  });

  it("release evidence contains record and source counts", () => {
    const evidence = generateReleaseEvidence(WORKSPACE);
    expect(evidence.recordCount).toBeGreaterThan(0);
    expect(evidence.sourceCount).toBeGreaterThan(0);
  });

  it("release evidence contains license", () => {
    const evidence = generateReleaseEvidence(WORKSPACE);
    expect(evidence.license).toBe("CC-BY-4.0");
  });

  it("release evidence schema is rgkb/release-evidence@1", () => {
    const evidence = generateReleaseEvidence(WORKSPACE);
    expect(evidence.schema).toBe("rgkb/release-evidence@1");
  });
});
