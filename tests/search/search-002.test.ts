import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { setupSearchWorkspace, testId } from "./helpers";

const records = [
  {
    id: testId(1),
    key: "aaa_goblin",
    record_type: "creature",
    title: "Goblin Warrior",
    summary: "A fierce goblin warrior with sharp teeth",
    body: "Goblins are small creatures that live in caves",
    source_identity: { source_id: "src-a", native_id: "goblin", path: "data.json" },
  },
  {
    id: testId(2),
    key: "bbb_goblin",
    record_type: "creature",
    title: "Goblin Shaman",
    summary: "A goblin shaman with magical powers",
    body: "Goblin shamans cast spells in dark caves",
    source_identity: { source_id: "src-a", native_id: "goblin_shaman", path: "data.json" },
  },
  {
    id: testId(3),
    key: "ccc_orc",
    record_type: "creature",
    title: "Orc Berserker",
    summary: "A large orc berserker",
    body: "Orcs are large creatures that love battle",
    source_identity: { source_id: "src-b", native_id: "orc", path: "data.json" },
  },
];

const keys = [
  { id: testId(1), key: "aaa_goblin", record_type: "creature" },
  { id: testId(2), key: "bbb_goblin", record_type: "creature" },
  { id: testId(3), key: "ccc_orc", record_type: "creature" },
];

describe("SEARCH-002: FTS stable tie break by key/id", () => {
  let setup: Awaited<ReturnType<typeof setupSearchWorkspace>>;

  beforeEach(async () => {
    setup = await setupSearchWorkspace({
      kbId: "search002-test",
      records,
      keys,
    });
  });

  afterEach(() => {
    setup.cleanup();
  });

  it("returns results for matching text", () => {
    const hits = setup.index.ftsSearch("goblin");
    expect(hits.length).toBeGreaterThanOrEqual(2);
    const keys = hits.map((h) => h.key);
    expect(keys).toContain("aaa_goblin");
    expect(keys).toContain("bbb_goblin");
  });

  it("ties are broken by key ASC then id ASC", () => {
    const hits = setup.index.ftsSearch("goblin");
    expect(hits.length).toBeGreaterThanOrEqual(2);

    for (let i = 0; i < hits.length - 1; i++) {
      const a = hits[i];
      const b = hits[i + 1];
      if (a.score === b.score) {
        const keyCmp = a.key.localeCompare(b.key);
        if (keyCmp === 0) {
          expect(a.recordId.localeCompare(b.recordId)).toBeLessThanOrEqual(0);
        } else {
          expect(keyCmp).toBeLessThan(0);
        }
      }
    }
  });

  it("same query returns same order (deterministic)", () => {
    const hits1 = setup.index.ftsSearch("creature");
    const hits2 = setup.index.ftsSearch("creature");
    expect(hits1.map((h) => h.recordId)).toEqual(hits2.map((h) => h.recordId));
  });

  it("returns empty for no match", () => {
    const hits = setup.index.ftsSearch("nonexistent_term_xyz");
    expect(hits).toHaveLength(0);
  });
});
