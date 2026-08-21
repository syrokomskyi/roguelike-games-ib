import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { setupWebWorkspace, testId, type TestSetup } from "./helpers";
import { renderEvidence, DEFAULT_EXCERPT_LIMIT } from "@roguelike-games-ib/web";

const longExcerpt = "A".repeat(500);

const evidence = [
  {
    id: "ev-001",
    source_id: "src-a",
    artifact: { path: "src/main.c", sha256: "abc123" },
    locator: { symbol: "goblin_damage", line_start: 42, line_end: 45, byte_start: null, byte_end: null, data_key: null },
    fragment_hash: "frag-001",
    excerpt: longExcerpt,
    publication: { access: "public", expose_locator: true, excerpt_policy: "short", license_ref: "CC-BY-4.0" },
  },
  {
    id: "ev-002",
    source_id: "src-a",
    artifact: { path: "src/main.c", sha256: "def456" },
    locator: { symbol: null, line_start: 10, line_end: 20, byte_start: null, byte_end: null, data_key: null },
    fragment_hash: "frag-002",
    excerpt: "short excerpt",
    publication: { access: "public", expose_locator: false, excerpt_policy: "short", license_ref: "CC-BY-4.0" },
  },
];

describe("WEB-003: evidence short excerpt obeys limit", () => {
  let setup: TestSetup;

  beforeEach(async () => {
    setup = await setupWebWorkspace({
      kbId: "web003-test",
      records: [
        { id: testId(1), key: "goblin", record_type: "creature", title: "Goblin" },
      ],
      keys: [{ id: testId(1), key: "goblin", record_type: "creature" }],
      evidence,
      bindings: [{ source_id: "src-a", source_unit_path: "src-a", declared_version: "1.0.0", version_scheme: "semver", metadata_origin: "package.json", fingerprint: { algorithm: "sha256-tree-v1", value: "abc123" }, vcs: null, binding_digest: "abc123" }],
    });
  });

  afterEach(() => setup.cleanup());

  it("excerpt is truncated to default limit", () => {
    const rendered = renderEvidence(setup.ctx.store.evidence, setup.ctx.store.sources);
    const ev1 = rendered.find((e) => e.id === "ev-001");
    expect(ev1).toBeDefined();
    expect(ev1!.excerpt).toBeDefined();
    expect(ev1!.excerpt!.length).toBe(DEFAULT_EXCERPT_LIMIT);
  });

  it("excerpt respects custom limit", () => {
    const rendered = renderEvidence(setup.ctx.store.evidence, setup.ctx.store.sources, 50);
    const ev1 = rendered.find((e) => e.id === "ev-001");
    expect(ev1!.excerpt!.length).toBe(50);
  });

  it("short excerpt passes through unchanged", () => {
    const rendered = renderEvidence(setup.ctx.store.evidence, setup.ctx.store.sources);
    const ev2 = rendered.find((e) => e.id === "ev-002");
    expect(ev2!.excerpt).toBe("short excerpt");
  });

  it("locator is included when expose_locator is true", () => {
    const rendered = renderEvidence(setup.ctx.store.evidence, setup.ctx.store.sources);
    const ev1 = rendered.find((e) => e.id === "ev-001");
    expect(ev1!.locator).not.toBeNull();
    expect(ev1!.locator!.symbol).toBe("goblin_damage");
  });

  it("locator is null when expose_locator is false", () => {
    const rendered = renderEvidence(setup.ctx.store.evidence, setup.ctx.store.sources);
    const ev2 = rendered.find((e) => e.id === "ev-002");
    expect(ev2!.locator).toBeNull();
  });
});
