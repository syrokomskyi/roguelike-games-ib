import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { setupSearchWorkspace, testId } from "./helpers";

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

const aliases = [
  { key: "gremlin", retired_to: "goblin", retired_at: "2026-01-01T00:00:00Z" },
];

describe("SEARCH-001: exact id/key/alias lookup deterministic", () => {
  let setup: Awaited<ReturnType<typeof setupSearchWorkspace>>;

  beforeEach(async () => {
    setup = await setupSearchWorkspace({
      kbId: "search001-test",
      records,
      keys,
      aliases,
    });
  });

  afterEach(() => {
    setup.cleanup();
  });

  it("looks up by id", () => {
    const result = setup.index.exactLookup({ id: testId(1) });
    expect(result).not.toBeNull();
    expect(result!.key).toBe("goblin");
    expect(result!.title).toBe("Goblin");
  });

  it("looks up by key", () => {
    const result = setup.index.exactLookup({ key: "kobold" });
    expect(result).not.toBeNull();
    expect(result!.id).toBe(testId(2));
    expect(result!.title).toBe("Kobold");
  });

  it("looks up by alias (resolves to current key)", () => {
    const result = setup.index.exactLookup({ alias: "gremlin" });
    expect(result).not.toBeNull();
    expect(result!.key).toBe("goblin");
    expect(result!.id).toBe(testId(1));
  });

  it("returns null for non-existent id", () => {
    const result = setup.index.exactLookup({ id: testId(999) });
    expect(result).toBeNull();
  });

  it("returns null for non-existent key", () => {
    const result = setup.index.exactLookup({ key: "nonexistent" });
    expect(result).toBeNull();
  });

  it("returns null for non-existent alias", () => {
    const result = setup.index.exactLookup({ alias: "phantom" });
    expect(result).toBeNull();
  });

  it("is deterministic — same query returns same result", () => {
    const r1 = setup.index.exactLookup({ key: "dragon" });
    const r2 = setup.index.exactLookup({ key: "dragon" });
    expect(r1).toEqual(r2);
  });
});
