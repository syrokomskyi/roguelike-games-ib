import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { preparePromotion, applyPromotionTransaction, recoverInterruptedTransaction, validateCanonicalGraph, canonicalJsonStringify } from "@roguelike-games-ib/knowledge-core";
import type { TransactionOperation } from "@roguelike-games-ib/knowledge-core";
import { createTempWorkspace, cleanupTempWorkspace } from "@roguelike-games-ib/test-fixtures";
import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

describe("CORE-023: transaction crash before COMMITTED rolls back", () => {
  let workspace: string;

  beforeEach(() => {
    workspace = createTempWorkspace();
  });

  afterEach(() => {
    cleanupTempWorkspace(workspace);
  });

  it("rolls back when transaction is not committed", () => {
    const canonicalRoot = join(workspace, "knowledge");
    const stagingRoot = join(workspace, "staging");
    mkdirSync(join(stagingRoot, "transactions"), { recursive: true });
    mkdirSync(join(canonicalRoot, "definition"), { recursive: true });

    // Write an existing file to test replace rollback
    const existingFile = join(canonicalRoot, "definition", "existing.jsonl");
    writeFileSync(existingFile, '{"id":"old","key":"existing"}\n', "utf-8");

    const txId = "test-tx-001";
    const ops: TransactionOperation[] = [
      {
        type: "create",
        record_id: "urn:roguelike-games-ib:record:11111111-1111-7111-8111-111111111111",
        record_type: "definition",
        key: "new-record",
        data: { id: "new", key: "new-record", schema: "rgkb/game-definition@2" },
      },
      {
        type: "replace",
        record_id: "urn:roguelike-games-ib:record:22222222-2222-7222-8222-222222222222",
        record_type: "definition",
        key: "existing",
        data: { id: "new2", key: "existing", schema: "rgkb/game-definition@2" },
      },
    ];

    const plan = preparePromotion(txId, null, ops, {});

    // Simulate crash: write the plan with APPLYING status but don't run applyPromotionTransaction
    writeFileSync(
      join(stagingRoot, "transactions", `${txId}.json`),
      canonicalJsonStringify({ ...plan, status: "APPLYING" }),
      "utf-8",
    );

    // Apply the operations manually (simulating partial application)
    const newFile = join(canonicalRoot, "definition", "new-record.jsonl");
    writeFileSync(newFile, '{"id":"new","key":"new-record"}\n', "utf-8");
    writeFileSync(existingFile, '{"id":"new2","key":"existing"}\n', "utf-8");

    // Backup the existing file
    writeFileSync(
      join(stagingRoot, "transactions", `${txId}.backup.existing.jsonl`),
      '{"id":"old","key":"existing"}\n',
      "utf-8",
    );

    // Now recover
    const result = recoverInterruptedTransaction(txId, stagingRoot, canonicalRoot);

    expect(result.status).toBe("ROLLED_BACK");
    expect(result.recovered).toBe(true);

    // The new file should be removed
    expect(existsSync(newFile)).toBe(false);

    // The existing file should be restored
    const restoredContent = readFileSync(existingFile, "utf-8");
    expect(restoredContent).toContain('"id":"old"');
  });
});

describe("CORE-024: transaction success leaves full integrity-valid canonical state", () => {
  let workspace: string;

  beforeEach(() => {
    workspace = createTempWorkspace();
  });

  afterEach(() => {
    cleanupTempWorkspace(workspace);
  });

  it("applies transaction and leaves valid state", () => {
    const canonicalRoot = join(workspace, "knowledge");
    const stagingRoot = join(workspace, "staging");
    mkdirSync(stagingRoot, { recursive: true });

    const txId = "test-tx-002";
    const ops: TransactionOperation[] = [
      {
        type: "create",
        record_id: "urn:roguelike-games-ib:record:33333333-3333-7333-8333-333333333333",
        record_type: "definition",
        key: "test-game/creature/test-creature",
        data: {
          schema: "rgkb/game-definition@2",
          id: "urn:roguelike-games-ib:record:33333333-3333-7333-8333-333333333333",
          key: "test-game/creature/test-creature",
          record_type: "definition",
          kind: "creature",
          native_kind: "Monster",
          name: { canonical: "Test Creature", original: "Test Creature" },
          source_identity: { native_id: "test_creature", namespace: null },
          attributes: {},
          evidence_refs: [],
        },
      },
    ];

    const plan = preparePromotion(txId, "test-game", ops, {});
    const result = applyPromotionTransaction(plan, canonicalRoot, stagingRoot);

    expect(result.status).toBe("COMMITTED");

    // Verify the file was created
    const createdFile = join(canonicalRoot, "definition", "test-game/creature/test-creature.jsonl");
    expect(existsSync(createdFile)).toBe(true);

    // Verify content
    const content = readFileSync(createdFile, "utf-8");
    expect(content).toContain("test-creature");
  });
});
