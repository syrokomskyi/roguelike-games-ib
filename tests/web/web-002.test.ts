import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { setupWebWorkspace, testId, type TestSetup } from "./helpers";
import { resolveRecordRoute } from "@roguelike-games-ib/web";

const records = [
  { id: testId(1), key: "goblin", record_type: "creature", title: "Goblin", source_identity: { source_id: "src-a", native_id: "goblin", path: "data.json" } },
];

const keys = [
  { id: testId(1), key: "goblin", record_type: "creature" },
];

const aliases = [
  { key: "gremlin", retired_to: "goblin", retired_at: "2026-01-01T00:00:00Z" },
];

describe("WEB-002: record route resolves alias to current record", () => {
  let setup: TestSetup;

  beforeEach(async () => {
    setup = await setupWebWorkspace({
      kbId: "web002-test",
      records,
      keys,
      aliases,
      bindings: [{ source_id: "src-a", source_unit_path: "src-a", declared_version: "1.0.0", version_scheme: "semver", metadata_origin: "package.json", fingerprint: { algorithm: "sha256-tree-v1", value: "abc123" }, vcs: null, binding_digest: "abc123" }],
    });
  });

  afterEach(() => setup.cleanup());

  it("resolves by key", async () => {
    const resolved = await resolveRecordRoute(setup.ctx.store, "goblin");
    expect(resolved).toBeDefined();
    expect(resolved!.record.id).toBe(testId(1));
    expect(resolved!.resolvedFrom).toBe("key");
    expect(resolved!.currentKey).toBe("goblin");
  });

  it("resolves by id", async () => {
    const resolved = await resolveRecordRoute(setup.ctx.store, testId(1));
    expect(resolved).toBeDefined();
    expect(resolved!.record.key).toBe("goblin");
    expect(resolved!.resolvedFrom).toBe("id");
  });

  it("resolves alias to current key", async () => {
    const resolved = await resolveRecordRoute(setup.ctx.store, "gremlin");
    expect(resolved).toBeDefined();
    expect(resolved!.record.id).toBe(testId(1));
    expect(resolved!.record.key).toBe("goblin");
    expect(resolved!.resolvedFrom).toBe("alias");
    expect(resolved!.currentKey).toBe("goblin");
  });

  it("returns undefined for unknown key", async () => {
    const resolved = await resolveRecordRoute(setup.ctx.store, "nonexistent");
    expect(resolved).toBeUndefined();
  });
});
