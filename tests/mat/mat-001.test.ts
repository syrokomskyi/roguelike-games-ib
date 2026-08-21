import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { materialize } from "@roguelike-games-ib/materializer";
import { KnowledgeCoreError, canonicalJsonStringify } from "@roguelike-games-ib/knowledge-core";
import { setupCanonicalWorkspace, testId } from "./helpers";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

describe("MAT-001: materializer refuses invalid canonical state", () => {
  let setup: ReturnType<typeof setupCanonicalWorkspace>;

  beforeEach(() => {
    setup = setupCanonicalWorkspace({
      kbId: "mat001-test",
      records: [
        {
          id: testId(1),
          key: "goblin",
          record_type: "creature",
          name: "Goblin",
          source_identity: { source_id: "test-src", native_id: "goblin", path: "data.json" },
        },
      ],
      claims: [
        {
          id: testId(2),
          subject_id: testId(1),
          predicate: "has_hp",
          value: 3,
          assertion_state: "supported",
          evidence_refs: [],
        },
      ],
      keys: [{ id: testId(1), key: "goblin", record_type: "creature" }],
    });
  });

  afterEach(() => {
    setup.cleanup();
  });

  it("succeeds on valid canonical state", () => {
    const result = materialize({ workspaceRoot: setup.workspace });
    expect(result.manifest).toBeDefined();
    expect(result.canonicalHash).toBeTruthy();
  });

  it("throws on dangling claim subject_id", () => {
    const claimDir = join(setup.canonicalRoot, "claim");
    mkdirSync(claimDir, { recursive: true });
    writeFileSync(
      join(claimDir, `${testId(99)}.jsonl`),
      canonicalJsonStringify({
        id: testId(99),
        subject_id: "urn:roguelike-games-ib:record:nonexistent-id",
        predicate: "bad",
        assertion_state: "supported",
        evidence_refs: [],
      }) + "\n",
      "utf-8",
    );

    expect(() => materialize({ workspaceRoot: setup.workspace })).toThrow(KnowledgeCoreError);
  });

  it("throws on record missing required fields", () => {
    const dir = join(setup.canonicalRoot, "creature");
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "bad.jsonl"),
      canonicalJsonStringify({ id: testId(50), record_type: "creature" }) + "\n",
      "utf-8",
    );

    expect(() => materialize({ workspaceRoot: setup.workspace })).toThrow(KnowledgeCoreError);
  });
});
