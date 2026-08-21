import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import {
  createEvidenceAnchor,
  validateEvidenceAnchor,
  createCandidateBatch,
  preparePromotion,
  sha256File,
  type CandidateRecord,
  type EvidenceAnchor,
} from "@roguelike-games-ib/knowledge-core";
import { createTestWorkspace, cleanupTempWorkspace } from "@roguelike-games-ib/test-fixtures";

describe("MIG-002: v1 evidence with unresolved source binding is not promoted", () => {
  let workspace: string;
  let sourceRoot: string;

  beforeEach(() => {
    workspace = createTestWorkspace({ kbId: "mig002-test" });
    sourceRoot = join(workspace, "..", "mig002-test-source", "source");
    mkdirSync(sourceRoot, { recursive: true });
  });

  afterEach(() => {
    cleanupTempWorkspace(workspace);
    const sourceDir = join(workspace, "..", "mig002-test-source");
    try { rmSync(sourceDir, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  it("evidence with unresolved source binding fails validation", () => {
    // Create evidence anchor with a binding digest that doesn't match any registered source
    const anchor: EvidenceAnchor = {
      source_id: "v1-unresolved",
      source_binding_digest: "0".repeat(64),
      artifact: {
        path: "nonexistent/file.c",
        sha256: "a".repeat(64),
      },
      locator: {
        symbol: null,
        line_start: 1,
        line_end: 10,
        byte_start: null,
        byte_end: null,
        data_key: null,
      },
      fragment_hash: null,
      publication: {
        access: "restricted",
        expose_locator: false,
        excerpt_policy: "none",
        license_ref: null,
      },
    };

    // Validate against source root — artifact doesn't exist
    const result = validateEvidenceAnchor(anchor, sourceRoot);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("not found") || e.includes("Artifact"))).toBe(true);
  });

  it("evidence with valid source binding passes validation", () => {
    // Create a real artifact file
    const artifactPath = join(sourceRoot, "creature.c");
    writeFileSync(artifactPath, "struct Creature { int hp; };\n", "utf-8");

    const fileHash = sha256File(artifactPath);

    const anchor = createEvidenceAnchor(
      "v1-resolved",
      "b".repeat(64),
      "creature.c",
      fileHash,
      {
        symbol: null,
        line_start: 1,
        line_end: 1,
        byte_start: null,
        byte_end: null,
        data_key: null,
      },
      {
        access: "public",
        expose_locator: true,
        excerpt_policy: "short",
        license_ref: null,
      },
    );

    const result = validateEvidenceAnchor(anchor, sourceRoot);
    expect(result.valid).toBe(true);
  });

  it("candidate with unresolved evidence is not promoted to canonical", () => {
    // Create a candidate with evidence referencing an unresolved source
    const candidates: CandidateRecord[] = [
      {
        id: "00000000-0000-7000-8000-000000000010",
        key: "ghost",
        record_type: "creature",
        name: "Ghost",
        epistemic_status: "candidate",
        source_identity: {
          source_id: "v1-unresolved",
          native_id: "ghost",
          path: "v1/creatures/ghost.md",
        },
        evidence_refs: [
          {
            source_id: "v1-unresolved",
            source_binding_digest: "0".repeat(64),
            artifact_path: "nonexistent/ghost.c",
            unresolved: true,
          },
        ],
      },
    ];

    const batch = createCandidateBatch("v1-migration", "run-002", "v1-importer", "0.1.0", candidates);

    // Create promotion plan
    const plan = preparePromotion(
      "tx-002",
      "v1-migration",
      batch.records.map((c) => ({
        type: "create" as const,
        record_id: c.id,
        record_type: c.record_type,
        key: c.key,
        data: c,
      })),
      {},
    );

    // Plan exists but should not be applied if evidence is unresolved
    expect(plan.operations.length).toBe(1);

    // The candidate has unresolved evidence — it should not be promoted
    const candidate = batch.records[0] as Record<string, unknown>;
    const evidenceRefs = candidate.evidence_refs as Array<Record<string, unknown>>;
    expect(evidenceRefs.some((e) => e.unresolved === true)).toBe(true);

    // Verify no canonical write happened
    const canonicalCreatureDir = join(workspace, "knowledge", "creature");
    expect(existsSync(join(canonicalCreatureDir, "ghost.jsonl"))).toBe(false);
  });

  it("evidence with unresolved binding digest format is rejected", () => {
    const anchor: EvidenceAnchor = {
      source_id: "v1-bad-digest",
      source_binding_digest: "not-a-valid-hash",
      artifact: {
        path: "some/file.c",
        sha256: "a".repeat(64),
      },
      locator: {
        symbol: null,
        line_start: null,
        line_end: null,
        byte_start: null,
        byte_end: null,
        data_key: null,
      },
      fragment_hash: null,
      publication: {
        access: "restricted",
        expose_locator: false,
        excerpt_policy: "none",
        license_ref: null,
      },
    };

    const result = validateEvidenceAnchor(anchor, sourceRoot);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("binding_digest") || e.includes("format"))).toBe(true);
  });
});
