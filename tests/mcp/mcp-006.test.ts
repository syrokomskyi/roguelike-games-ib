import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { setupMcpWorkspace, testId, type TestSetup } from "./helpers";
import { getEvidence } from "@roguelike-games-ib/mcp";

const records = [
  { id: testId(1), key: "goblin", record_type: "creature", title: "Goblin", source_identity: { source_id: "src-a", native_id: "goblin", path: "data.json" } },
];

const keys = [{ id: testId(1), key: "goblin", record_type: "creature" }];

const bindings = [{
  source_id: "src-a",
  source_unit_path: "src-a",
  declared_version: "1.0.0",
  version_scheme: "semver",
  metadata_origin: "package.json",
  fingerprint: { algorithm: "sha256-tree-v1", value: "abc123" },
  vcs: null,
  binding_digest: "abc123",
}];

const publicEvidence = [{
  id: "ev-001",
  source_id: "src-a",
  source_binding_digest: "abc123",
  artifact: { path: "data.json", sha256: "abc123" },
  locator: { symbol: null, line_start: 1, line_end: 5, byte_start: null, byte_end: null, data_key: null },
  fragment_hash: "frag123",
  publication: { access: "public", expose_locator: true, excerpt_policy: "short", license_ref: "CC-BY-4.0" },
  excerpt: "A small green creature",
}];

const restrictedEvidence = [{
  id: "ev-002",
  source_id: "src-a",
  source_binding_digest: "abc123",
  artifact: { path: "internal.json", sha256: "def456" },
  locator: { symbol: null, line_start: 10, line_end: 20, byte_start: null, byte_end: null, data_key: null },
  fragment_hash: "frag456",
  publication: { access: "restricted", expose_locator: false, excerpt_policy: "none", license_ref: null },
  excerpt: "Secret internal data",
}];

describe("MCP-006: restricted evidence redacted", () => {
  let setup: TestSetup;

  beforeEach(async () => {
    setup = await setupMcpWorkspace({
      kbId: "mcp006-test",
      records,
      keys,
      bindings,
      evidence: [...publicEvidence, ...restrictedEvidence],
    });
  });

  afterEach(() => setup.cleanup());

  it("public evidence returns full content", () => {
    const result = getEvidence(setup.ctx, { evidence_id: "ev-001" });
    expect(result.data.restricted).toBe(false);
    expect(result.data.excerpt).toBe("A small green creature");
    expect(result.data.artifact_path).toBe("data.json");
    expect(result.data.locator).not.toBeNull();
  });

  it("restricted evidence is not in the projection store — redacted by materializer", () => {
    const allEvidenceIds = setup.ctx.store.evidence.map((e) => e.id);
    expect(allEvidenceIds).toContain("ev-001");
    expect(allEvidenceIds).not.toContain("ev-002");
  });

  it("restricted evidence ID returns NotFoundError via get_evidence", () => {
    expect(() => getEvidence(setup.ctx, { evidence_id: "ev-002" })).toThrow();
  });

  it("public evidence does not expose restricted content", () => {
    const result = getEvidence(setup.ctx, { evidence_id: "ev-001" });
    expect(result.data.restricted).toBe(false);
    expect(result.data.excerpt).not.toContain("Secret internal data");
  });
});
