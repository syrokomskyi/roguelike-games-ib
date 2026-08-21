import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { materialize } from "@roguelike-games-ib/materializer";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { setupCanonicalWorkspace, testId } from "./helpers";

const publicEvidence = {
  id: testId(100),
  record_type: "evidence",
  source_id: "src-a",
  source_binding_digest: "a".repeat(64),
  artifact: { path: "data.json", sha256: "b".repeat(64) },
  locator: { symbol: null, line_start: 1, line_end: 5, byte_start: null, byte_end: null, data_key: "goblin" },
  fragment_hash: "c".repeat(64),
  publication: { access: "public", expose_locator: true, excerpt_policy: "short", license_ref: null },
  excerpt: "Goblin is a small creature that lives in caves.",
};

const privateEvidence = {
  id: testId(101),
  record_type: "evidence",
  source_id: "src-a",
  source_binding_digest: "a".repeat(64),
  artifact: { path: "secret.json", sha256: "d".repeat(64) },
  locator: { symbol: null, line_start: 1, line_end: 3, byte_start: null, byte_end: null, data_key: "secret" },
  fragment_hash: "e".repeat(64),
  publication: { access: "private", expose_locator: false, excerpt_policy: "none", license_ref: null },
};

const restrictedEvidence = {
  id: testId(102),
  record_type: "evidence",
  source_id: "src-a",
  source_binding_digest: "a".repeat(64),
  artifact: { path: "restricted.json", sha256: "f".repeat(64) },
  locator: { symbol: "secret_symbol", line_start: 10, line_end: 20, byte_start: null, byte_end: null, data_key: "restricted" },
  fragment_hash: "g".repeat(64),
  publication: { access: "restricted", expose_locator: false, excerpt_policy: "none", license_ref: null },
};

describe("MAT-005: public evidence redaction applied", () => {
  let setup: ReturnType<typeof setupCanonicalWorkspace>;
  let result: ReturnType<typeof materialize>;

  beforeEach(() => {
    setup = setupCanonicalWorkspace({
      kbId: "mat005-test",
      records: [
        {
          id: testId(1),
          key: "goblin",
          record_type: "creature",
          name: "Goblin",
          source_identity: { source_id: "src-a", native_id: "goblin", path: "data.json" },
        },
      ],
      evidence: [publicEvidence, privateEvidence, restrictedEvidence],
      keys: [{ id: testId(1), key: "goblin", record_type: "creature" }],
    });
    result = materialize({ workspaceRoot: setup.workspace });
  });

  afterEach(() => {
    setup.cleanup();
  });

  it("evidence.public.jsonl contains only public evidence", () => {
    const content = readFileSync(join(result.distDir, "evidence.public.jsonl"), "utf-8");
    const lines = content.trim().split("\n").filter((l) => l.trim() !== "");
    expect(lines).toHaveLength(1);

    const ev = JSON.parse(lines[0]);
    expect(ev.source_id).toBe("src-a");
    expect(ev.artifact_path).toBe("data.json");
  });

  it("private evidence is excluded from public output", () => {
    const content = readFileSync(join(result.distDir, "evidence.public.jsonl"), "utf-8");
    expect(content).not.toContain("secret.json");
    expect(content).not.toContain("private");
  });

  it("restricted evidence is excluded from public output", () => {
    const content = readFileSync(join(result.distDir, "evidence.public.jsonl"), "utf-8");
    expect(content).not.toContain("restricted.json");
    expect(content).not.toContain("secret_symbol");
  });

  it("public evidence includes locator when expose_locator is true", () => {
    const content = readFileSync(join(result.distDir, "evidence.public.jsonl"), "utf-8");
    const ev = JSON.parse(content.trim());
    expect(ev.locator).not.toBeNull();
    expect(ev.locator.data_key).toBe("goblin");
  });

  it("record counts reflect redaction", () => {
    expect(result.recordCounts.evidence_public).toBe(1);
    expect(result.recordCounts.evidence_total).toBe(3);
  });
});
