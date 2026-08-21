import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { materialize } from "@roguelike-games-ib/materializer";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { setupCanonicalWorkspace, testId } from "./helpers";

describe("MAT-003: materialization manifest contains canonical hash/license", () => {
  let setup: ReturnType<typeof setupCanonicalWorkspace>;

  beforeEach(() => {
    setup = setupCanonicalWorkspace({
      kbId: "mat003-test",
      records: [
        {
          id: testId(1),
          key: "goblin",
          record_type: "creature",
          name: "Goblin",
          source_identity: { source_id: "test-src", native_id: "goblin", path: "data.json" },
        },
      ],
      keys: [{ id: testId(1), key: "goblin", record_type: "creature" }],
    });
  });

  afterEach(() => {
    setup.cleanup();
  });

  it("manifest contains canonical hash", () => {
    const result = materialize({ workspaceRoot: setup.workspace });
    expect(result.manifest.canonicalHash).toBeTruthy();
    expect(result.manifest.canonicalHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("manifest contains license", () => {
    const result = materialize({ workspaceRoot: setup.workspace });
    expect(result.manifest.license).toBe("CC-BY-4.0");
  });

  it("manifest contains correct schema", () => {
    const result = materialize({ workspaceRoot: setup.workspace });
    expect(result.manifest.schema).toBe("rgkb/materialization-manifest@2");
  });

  it("manifest contains dataset id and version", () => {
    const result = materialize({ workspaceRoot: setup.workspace });
    expect(result.manifest.datasetId).toBe("mat003-test");
    expect(result.manifest.datasetVersion).toBeTruthy();
    expect(result.manifest.modelVersion).toBeTruthy();
  });

  it("manifest file on disk matches returned manifest", () => {
    const result = materialize({ workspaceRoot: setup.workspace });
    const manifestText = readFileSync(join(result.distDir, "manifest.json"), "utf-8");
    const manifestOnDisk = JSON.parse(manifestText);
    expect(manifestOnDisk.canonicalHash).toBe(result.manifest.canonicalHash);
    expect(manifestOnDisk.license).toBe(result.manifest.license);
  });

  it("manifest contains record counts", () => {
    const result = materialize({ workspaceRoot: setup.workspace });
    expect(result.manifest.recordCounts.records).toBe(1);
    expect(result.manifest.recordCounts.keys).toBe(1);
  });
});
