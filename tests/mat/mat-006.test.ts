import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { materialize } from "@roguelike-games-ib/materializer";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { setupCanonicalWorkspace, testId } from "./helpers";

describe("MAT-006: alias map resolves old key", () => {
  let setup: ReturnType<typeof setupCanonicalWorkspace>;
  let result: ReturnType<typeof materialize>;

  beforeEach(() => {
    setup = setupCanonicalWorkspace({
      kbId: "mat006-test",
      records: [
        {
          id: testId(1),
          key: "goblin_warrior",
          record_type: "creature",
          name: "Goblin Warrior",
          source_identity: { source_id: "src-a", native_id: "goblin_warrior", path: "data.json" },
        },
      ],
      keys: [{ id: testId(1), key: "goblin_warrior", record_type: "creature" }],
      aliases: [
        { key: "goblin", retired_to: "goblin_warrior", retired_at: "2026-01-01T00:00:00Z" },
        { key: "old_goblin", retired_to: "goblin_warrior", retired_at: "2026-02-01T00:00:00Z" },
      ],
    });
    result = materialize({ workspaceRoot: setup.workspace });
  });

  afterEach(() => {
    setup.cleanup();
  });

  it("alias-map.json maps old keys to current keys", () => {
    const content = readFileSync(join(result.distDir, "alias-map.json"), "utf-8");
    const parsed = JSON.parse(content);
    expect(parsed.aliases["goblin"]).toBe("goblin_warrior");
    expect(parsed.aliases["old_goblin"]).toBe("goblin_warrior");
  });

  it("key-map.json maps current keys to ids", () => {
    const content = readFileSync(join(result.distDir, "key-map.json"), "utf-8");
    const parsed = JSON.parse(content);
    expect(parsed.keys["goblin_warrior"]).toBe(testId(1));
  });

  it("alias map does not contain current keys", () => {
    const content = readFileSync(join(result.distDir, "alias-map.json"), "utf-8");
    const parsed = JSON.parse(content);
    expect(parsed.aliases["goblin_warrior"]).toBeUndefined();
  });

  it("SQLite aliases table contains alias mappings", () => {
    const dbPath = join(result.distDir, "knowledge.sqlite");
    const db = new Database(dbPath, { readonly: true });
    const rows = db.prepare("SELECT alias, record_key FROM aliases ORDER BY alias").all() as Array<{ alias: string; record_key: string }>;
    db.close();

    expect(rows).toHaveLength(2);
    expect(rows[0].alias).toBe("goblin");
    expect(rows[0].record_key).toBe("goblin_warrior");
  });
});
