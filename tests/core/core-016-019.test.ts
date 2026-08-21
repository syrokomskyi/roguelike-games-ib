import { describe, it, expect } from "vitest";
import { assertNoDuplicates, resolveRecordKey, assertNoAliasCollisions, resolveAlias, matchDefinitionOnRefresh, createRecordId, isValidRecordId } from "@roguelike-games-ib/knowledge-core";
import type { KeyEntry, AliasEntry } from "@roguelike-games-ib/knowledge-core";

describe("CORE-016: UUID/key registry rejects duplicate id/key", () => {
  it("rejects duplicate IDs", () => {
    const entries: KeyEntry[] = [
      { id: "urn:roguelike-games-ib:record:11111111-1111-7111-8111-111111111111", key: "brogue-ce/creature/goblin", record_type: "game_definition" },
      { id: "urn:roguelike-games-ib:record:11111111-1111-7111-8111-111111111111", key: "brogue-ce/creature/ogre", record_type: "game_definition" },
    ];
    expect(() => assertNoDuplicates(entries)).toThrow(/Duplicate record ID/);
  });

  it("rejects duplicate keys", () => {
    const entries: KeyEntry[] = [
      { id: "urn:roguelike-games-ib:record:11111111-1111-7111-8111-111111111111", key: "brogue-ce/creature/goblin", record_type: "game_definition" },
      { id: "urn:roguelike-games-ib:record:22222222-2222-7222-8222-222222222222", key: "brogue-ce/creature/goblin", record_type: "game_definition" },
    ];
    expect(() => assertNoDuplicates(entries)).toThrow(/Duplicate record key/);
  });

  it("accepts unique entries", () => {
    const entries: KeyEntry[] = [
      { id: "urn:roguelike-games-ib:record:11111111-1111-7111-8111-111111111111", key: "brogue-ce/creature/goblin", record_type: "game_definition" },
      { id: "urn:roguelike-games-ib:record:22222222-2222-7222-8222-222222222222", key: "brogue-ce/creature/ogre", record_type: "game_definition" },
    ];
    expect(() => assertNoDuplicates(entries)).not.toThrow();
  });
});

describe("CORE-017: refresh matching retains id for stable native identity", () => {
  it("matches by exact key and returns same id", () => {
    const keys: KeyEntry[] = [
      { id: "urn:roguelike-games-ib:record:11111111-1111-7111-8111-111111111111", key: "brogue-ce/creature/goblin", record_type: "game_definition" },
    ];
    const result = matchDefinitionOnRefresh(keys, [], "brogue-ce", "creature", "goblin", "goblin_native");
    expect(result.matched).toBe(true);
    expect(result.id).toBe("urn:roguelike-games-ib:record:11111111-1111-7111-8111-111111111111");
    expect(result.key_changed).toBe(false);
  });
});

describe("CORE-018: rename creates old-key alias", () => {
  it("resolves old key through alias registry", () => {
    const aliases: AliasEntry[] = [
      { key: "brogue-ce/creature/goblin", retired_to: "brogue-ce/creature/hobgoblin", retired_at: "2026-01-01T00:00:00Z" },
    ];
    const resolved = resolveAlias(aliases, "brogue-ce/creature/goblin");
    expect(resolved).toBe("brogue-ce/creature/hobgoblin");
  });
});

describe("CORE-019: alias collision blocks transaction", () => {
  it("rejects alias key that collides with current key", () => {
    const aliases: AliasEntry[] = [
      { key: "brogue-ce/creature/goblin", retired_to: "brogue-ce/creature/hobgoblin", retired_at: "2026-01-01T00:00:00Z" },
    ];
    const currentKeys = ["brogue-ce/creature/goblin"];
    expect(() => assertNoAliasCollisions(aliases, currentKeys)).toThrow(/collides with a current key/);
  });

  it("accepts non-colliding alias", () => {
    const aliases: AliasEntry[] = [
      { key: "brogue-ce/creature/old-goblin", retired_to: "brogue-ce/creature/hobgoblin", retired_at: "2026-01-01T00:00:00Z" },
    ];
    const currentKeys = ["brogue-ce/creature/hobgoblin"];
    expect(() => assertNoAliasCollisions(aliases, currentKeys)).not.toThrow();
  });
});

describe("record ID creation", () => {
  it("creates valid record IDs", () => {
    const id = createRecordId();
    expect(isValidRecordId(id)).toBe(true);
  });

  it("rejects invalid record IDs", () => {
    expect(isValidRecordId("not-a-valid-id")).toBe(false);
    expect(isValidRecordId("urn:roguelike-games-ib:record:not-a-uuid")).toBe(false);
  });
});
