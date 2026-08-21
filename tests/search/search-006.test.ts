import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { setupSearchWorkspace, testId } from "./helpers";
import { encodeCursor, validateCursor } from "@roguelike-games-ib/search";

const records = [
  {
    id: testId(1),
    key: "goblin",
    record_type: "creature",
    title: "Goblin",
    summary: "A small green creature",
    source_identity: { source_id: "src-a", native_id: "goblin", path: "data.json" },
  },
  {
    id: testId(2),
    key: "kobold",
    record_type: "creature",
    title: "Kobold",
    summary: "A small reptilian creature",
    source_identity: { source_id: "src-a", native_id: "kobold", path: "data.json" },
  },
  {
    id: testId(3),
    key: "dragon",
    record_type: "creature",
    title: "Dragon",
    summary: "A large winged creature",
    source_identity: { source_id: "src-b", native_id: "dragon", path: "data.json" },
  },
];

const keys = [
  { id: testId(1), key: "goblin", record_type: "creature" },
  { id: testId(2), key: "kobold", record_type: "creature" },
  { id: testId(3), key: "dragon", record_type: "creature" },
];

describe("SEARCH-006: stale search cursor rejected after canonical hash change", () => {
  let setup: Awaited<ReturnType<typeof setupSearchWorkspace>>;

  beforeEach(async () => {
    setup = await setupSearchWorkspace({
      kbId: "search006-test",
      records,
      keys,
    });
  });

  afterEach(() => {
    setup.cleanup();
  });

  it("valid cursor with matching canonical hash is accepted", async () => {
    const cursor = encodeCursor(setup.canonicalHash, 0);
    const result = await setup.index.search({ text: "creature", cursor, limit: 2 });
    expect(result.hits).toBeDefined();
    expect(result.canonicalHash).toBe(setup.canonicalHash);
  });

  it("stale cursor with wrong canonical hash is rejected", async () => {
    const staleCursor = encodeCursor("wrong-hash-12345", 0);
    await expect(
      setup.index.search({ text: "creature", cursor: staleCursor, limit: 2 }),
    ).rejects.toThrow(/stale search cursor/i);
  });

  it("cursor from a different canonical state is rejected", async () => {
    const oldHash = setup.canonicalHash;
    const cursor = encodeCursor(oldHash, 0);

    const newSetup = await setupSearchWorkspace({
      kbId: "search006b-test",
      records: [
        ...records,
        {
          id: testId(4),
          key: "imp",
          record_type: "creature",
          title: "Imp",
          summary: "A small fiendish creature",
          source_identity: { source_id: "src-c", native_id: "imp", path: "data.json" },
        },
      ],
      keys: [
        ...keys,
        { id: testId(4), key: "imp", record_type: "creature" },
      ],
    });

    expect(newSetup.canonicalHash).not.toBe(oldHash);

    await expect(
      newSetup.index.search({ text: "creature", cursor, limit: 2 }),
    ).rejects.toThrow(/stale search cursor/i);

    newSetup.cleanup();
  });

  it("malformed cursor is rejected", async () => {
    await expect(
      setup.index.search({ text: "creature", cursor: "not-valid-base64!!!", limit: 2 }),
    ).rejects.toThrow(/stale search cursor/i);
  });

  it("validateCursor returns valid=false for mismatched hash", () => {
    const cursor = encodeCursor("old-hash", 10);
    const result = validateCursor(cursor, "new-hash");
    expect(result.valid).toBe(false);
  });

  it("validateCursor returns valid=true for matching hash", () => {
    const cursor = encodeCursor(setup.canonicalHash, 10);
    const result = validateCursor(cursor, setup.canonicalHash);
    expect(result.valid).toBe(true);
    expect(result.offset).toBe(10);
  });
});
