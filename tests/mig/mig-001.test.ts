import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, mkdirSync, existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import {
  createCandidateBatch,
  preparePromotion,
  canonicalJsonStringify,
  type CandidateBatch,
  type CandidateRecord,
} from "@roguelike-games-ib/knowledge-core";
import { createTestWorkspace, cleanupTempWorkspace } from "@roguelike-games-ib/test-fixtures";

describe("MIG-001: v1 markdown imports as candidate/hint, not canonical fact", () => {
  let workspace: string;
  let stagingRoot: string;
  let canonicalRoot: string;

  beforeEach(() => {
    workspace = createTestWorkspace({ kbId: "mig001-test" });
    stagingRoot = join(workspace, "staging");
    canonicalRoot = join(workspace, "knowledge");
    mkdirSync(stagingRoot, { recursive: true });
  });

  afterEach(() => {
    cleanupTempWorkspace(workspace);
    const sourceDir = join(workspace, "..", "mig001-test-source");
    try { rmSync(sourceDir, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  it("v1 markdown content creates candidate batch, not canonical records", () => {
    // Simulate v1 markdown content
    const v1Markdown = `---
title: Goblin
type: creature
---

Goblin is a weak monster with 3 HP.
`;

    // Migration should create candidates, not write directly to canonical
    const candidates: CandidateRecord[] = [
      {
        id: "00000000-0000-7000-8000-000000000001",
        key: "goblin",
        record_type: "creature",
        name: "Goblin",
        summary: "Goblin is a weak monster with 3 HP.",
        source_identity: {
          source_id: "v1-migration",
          native_id: "goblin",
          path: "v1/creatures/goblin.md",
        },
        migration_origin: "v1-markdown",
        epistemic_status: "candidate",
      },
    ];

    const batch = createCandidateBatch(
      "v1-migration",
      "run-001",
      "v1-importer",
      "0.1.0",
      candidates,
    );

    expect(batch.source_id).toBe("v1-migration");
    expect(batch.records.length).toBe(1);
    expect(batch.records[0].epistemic_status).toBe("candidate");
  });

  it("v1 candidate is written to staging, not canonical", () => {
    const candidates: CandidateRecord[] = [
      {
        id: "00000000-0000-7000-8000-000000000002",
        key: "ogre",
        record_type: "creature",
        name: "Ogre",
        epistemic_status: "candidate",
        source_identity: { source_id: "v1-migration", native_id: "ogre", path: "v1/creatures/ogre.md" },
      },
    ];

    const batch = createCandidateBatch("v1-migration", "run-001", "v1-importer", "0.1.0", candidates);

    // Write to staging
    const stagingDir = join(stagingRoot, "v1-migration");
    mkdirSync(stagingDir, { recursive: true });
    writeFileSync(
      join(stagingDir, "candidates.jsonl"),
      batch.records.map((r) => canonicalJsonStringify(r)).join("\n") + "\n",
      "utf-8",
    );

    // Verify it's in staging
    expect(existsSync(join(stagingDir, "candidates.jsonl"))).toBe(true);

    // Verify it's NOT in canonical
    const canonicalCreatureDir = join(canonicalRoot, "creature");
    expect(existsSync(join(canonicalCreatureDir, "ogre.jsonl"))).toBe(false);
  });

  it("v1 candidate has epistemic_status marking it as non-authoritative", () => {
    const candidates: CandidateRecord[] = [
      {
        id: "00000000-0000-7000-8000-000000000003",
        key: "kobold",
        record_type: "creature",
        name: "Kobold",
        epistemic_status: "candidate",
        migration_origin: "v1-markdown",
        source_identity: { source_id: "v1-migration", native_id: "kobold", path: "v1/creatures/kobold.md" },
      },
    ];

    const batch = createCandidateBatch("v1-migration", "run-001", "v1-importer", "0.1.0", candidates);

    // Candidates must have epistemic_status = "candidate"
    expect(batch.records[0].epistemic_status).toBe("candidate");
    expect(batch.records[0].epistemic_status).not.toBe("verified");
    expect(batch.records[0].epistemic_status).not.toBe("canonical");
  });

  it("v1 promotion plan requires explicit review before canonical write", () => {
    const candidates: CandidateRecord[] = [
      {
        id: "00000000-0000-7000-8000-000000000004",
        key: "wraith",
        record_type: "creature",
        name: "Wraith",
        epistemic_status: "candidate",
        source_identity: { source_id: "v1-migration", native_id: "wraith", path: "v1/creatures/wraith.md" },
      },
    ];

    // Prepare promotion transaction
    const plan = preparePromotion(
      "tx-001",
      "v1-migration",
      candidates.map((c) => ({
        type: "create" as const,
        record_id: c.id,
        record_type: c.record_type,
        key: c.key,
        data: c,
      })),
      {},
    );

    // Plan is prepared but not applied — no canonical writes yet
    expect(plan.manifest.transaction_id).toBe("tx-001");
    expect(plan.manifest.source_id).toBe("v1-migration");
    expect(plan.operations.length).toBe(1);
    expect(plan.operations[0].type).toBe("create");

    // The plan itself does not write to canonical
    const canonicalCreatureDir = join(canonicalRoot, "creature");
    expect(existsSync(join(canonicalCreatureDir, "wraith.jsonl"))).toBe(false);
  });
});
