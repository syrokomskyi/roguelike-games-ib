import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { setupWebWorkspace, testId, type TestSetup } from "./helpers";
import { verifyMaterialization, assertMaterialization } from "@roguelike-games-ib/web";
import { join } from "node:path";

describe("WEB-001: web build refuses stale/missing materialization", () => {
  let setup: TestSetup;

  beforeEach(async () => {
    setup = await setupWebWorkspace({
      kbId: "web001-test",
      records: [
        { id: testId(1), key: "goblin", record_type: "creature", title: "Goblin" },
      ],
      keys: [{ id: testId(1), key: "goblin", record_type: "creature" }],
      bindings: [{ source_id: "src-a", source_unit_path: "src-a", declared_version: "1.0.0", version_scheme: "semver", metadata_origin: "package.json", fingerprint: { algorithm: "sha256-tree-v1", value: "abc123" }, vcs: null, binding_digest: "abc123" }],
    });
  });

  afterEach(() => setup.cleanup());

  it("verifyMaterialization returns ok for valid dist", () => {
    const result = verifyMaterialization(setup.distDir);
    expect(result.ok).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("verifyMaterialization fails for missing manifest", () => {
    const fakeDir = join(setup.workspace, "nonexistent");
    const result = verifyMaterialization(fakeDir);
    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("assertMaterialization throws for missing dist", () => {
    const fakeDir = join(setup.workspace, "nonexistent");
    expect(() => assertMaterialization(fakeDir)).toThrow();
  });

  it("assertMaterialization does not throw for valid dist", () => {
    expect(() => assertMaterialization(setup.distDir)).not.toThrow();
  });
});
