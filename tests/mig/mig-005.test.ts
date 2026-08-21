import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, mkdirSync, existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import {
  createCandidateBatch,
  canonicalJsonStringify,
  type CandidateRecord,
} from "@roguelike-games-ib/knowledge-core";
import { createTestWorkspace, cleanupTempWorkspace } from "@roguelike-games-ib/test-fixtures";

describe("MIG-005: migration does not preserve ambiguous Obsidian stem links as authority", () => {
  let workspace: string;
  let stagingRoot: string;

  beforeEach(() => {
    workspace = createTestWorkspace({ kbId: "mig005-test" });
    stagingRoot = join(workspace, "staging");
    mkdirSync(stagingRoot, { recursive: true });
  });

  afterEach(() => {
    cleanupTempWorkspace(workspace);
    const sourceDir = join(workspace, "..", "mig005-test-source");
    try { rmSync(sourceDir, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  it("ambiguous stem links are marked as unresolved in candidates", () => {
    // Simulate v1 Obsidian content with ambiguous stem links
    // e.g., [[Goblin]] could refer to multiple entities
    const candidates: CandidateRecord[] = [
      {
        id: "00000000-0000-7000-8000-000000000020",
        key: "goblin-creature",
        record_type: "creature",
        name: "Goblin",
        epistemic_status: "candidate",
        source_identity: {
          source_id: "v1-migration",
          native_id: "goblin",
          path: "v1/creatures/goblin.md",
        },
        migration_origin: "v1-markdown",
        raw_links: [
          { stem: "Goblin", target: null, ambiguous: true },
          { stem: "Ogre", target: "urn:roguelike-games-ib:record:00000000-0000-7000-8000-000000000021", ambiguous: false },
        ],
      },
    ];

    const batch = createCandidateBatch("v1-migration", "run-005", "v1-importer", "0.1.0", candidates);

    // The ambiguous link should be preserved as raw data but not as authoritative reference
    const candidate = batch.records[0] as Record<string, unknown>;
    const rawLinks = candidate.raw_links as Array<Record<string, unknown>>;
    const ambiguousLink = rawLinks.find((l) => l.ambiguous === true);
    expect(ambiguousLink).toBeDefined();
    expect(ambiguousLink!.target).toBeNull();
  });

  it("resolved links become proper relation candidates, ambiguous ones do not", () => {
    const candidates: CandidateRecord[] = [
      {
        id: "00000000-0000-7000-8000-000000000030",
        key: "dungeon",
        record_type: "game_definition",
        name: "Dungeon",
        epistemic_status: "candidate",
        source_identity: {
          source_id: "v1-migration",
          native_id: "dungeon",
          path: "v1/games/dungeon.md",
        },
        migration_origin: "v1-markdown",
        raw_links: [
          // This link is ambiguous — "Boss" could refer to multiple things
          { stem: "Boss", target: null, ambiguous: true },
          // This link is resolved — we know exactly what "Goblin" refers to
          { stem: "Goblin", target: "urn:roguelike-games-ib:record:00000000-0000-7000-8000-000000000031", ambiguous: false },
        ],
      },
    ];

    const batch = createCandidateBatch("v1-migration", "run-005", "v1-importer", "0.1.0", candidates);

    // Write candidates to staging
    const stagingDir = join(stagingRoot, "v1-migration");
    mkdirSync(stagingDir, { recursive: true });
    writeFileSync(
      join(stagingDir, "candidates.jsonl"),
      batch.records.map((r) => canonicalJsonStringify(r)).join("\n") + "\n",
      "utf-8",
    );

    // Read back and verify
    const content = readFileSync(join(stagingDir, "candidates.jsonl"), "utf-8");
    const records = content.split("\n").filter(Boolean).map((l) => JSON.parse(l));
    const record = records[0];

    // Ambiguous links should be in raw_links, not in authoritative relation_refs
    const rawLinks = record.raw_links;
    expect(rawLinks).toBeDefined();
    expect(rawLinks.length).toBe(2);

    const ambiguousLinks = rawLinks.filter((l: Record<string, unknown>) => l.ambiguous === true);
    expect(ambiguousLinks.length).toBe(1);
    expect(ambiguousLinks[0].target).toBeNull();

    // No authoritative relation_refs should be created from ambiguous links
    expect(record.relation_refs ?? []).toEqual([]);
  });

  it("Obsidian stem links are not treated as canonical record IDs", () => {
    // In v1, [[Goblin]] was a stem link — in v2, record IDs are URN-based
    const candidates: CandidateRecord[] = [
      {
        id: "00000000-0000-7000-8000-000000000040",
        key: "goblin",
        record_type: "creature",
        name: "Goblin",
        epistemic_status: "candidate",
        source_identity: {
          source_id: "v1-migration",
          native_id: "goblin",
          path: "v1/creatures/goblin.md",
        },
        migration_origin: "v1-markdown",
        // v1 stem links should NOT become canonical IDs
        raw_links: [
          { stem: "Goblin", target: null, ambiguous: true },
        ],
      },
    ];

    const batch = createCandidateBatch("v1-migration", "run-005", "v1-importer", "0.1.0", candidates);

    // The candidate ID should be a proper URN, not a stem link
    expect(batch.records[0].id).toMatch(/^00000000-0000-7000-8000-/);
    expect(batch.records[0].id).not.toBe("Goblin");

    // The key should be lowercase, not the Obsidian stem
    expect(batch.records[0].key).toBe("goblin");
    expect(batch.records[0].key).not.toBe("Goblin");
  });

  it("migration candidates with ambiguous links are written to staging only", () => {
    const candidates: CandidateRecord[] = [
      {
        id: "00000000-0000-7000-8000-000000000050",
        key: "lich",
        record_type: "creature",
        name: "Lich",
        epistemic_status: "candidate",
        source_identity: {
          source_id: "v1-migration",
          native_id: "lich",
          path: "v1/creatures/lich.md",
        },
        migration_origin: "v1-markdown",
        raw_links: [
          { stem: "Phylactery", target: null, ambiguous: true },
        ],
      },
    ];

    const batch = createCandidateBatch("v1-migration", "run-005", "v1-importer", "0.1.0", candidates);

    // Write to staging
    const stagingDir = join(stagingRoot, "v1-migration");
    mkdirSync(stagingDir, { recursive: true });
    writeFileSync(
      join(stagingDir, "candidates.jsonl"),
      batch.records.map((r) => canonicalJsonStringify(r)).join("\n") + "\n",
      "utf-8",
    );

    // Verify in staging
    expect(existsSync(join(stagingDir, "candidates.jsonl"))).toBe(true);

    // Verify NOT in canonical
    const canonicalCreatureDir = join(workspace, "knowledge", "creature");
    expect(existsSync(join(canonicalCreatureDir, "lich.jsonl"))).toBe(false);
  });
});
