import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { setupWebWorkspace, testId, type TestSetup } from "./helpers";
import { renderEvidence } from "@roguelike-games-ib/web";

const evidence = [
  {
    id: "ev-public",
    anchor: {
      source_id: "src-a",
      evidence_kind: "source_code",
      artifact: { path: "src/main.c", sha256: "abc123" },
      media: null,
      locator: { symbol: "func", line_start: 1, line_end: 5, byte_start: null, byte_end: null, data_key: null },
      fragment_hash: "frag-1",
      excerpt: "public excerpt",
      publication: { access: "public", expose_locator: true, excerpt_policy: "short", license_ref: "CC-BY-4.0" },
    },
  },
  {
    id: "ev-restricted",
    anchor: {
      source_id: "src-a",
      evidence_kind: "source_code",
      artifact: { path: "src/secret.c", sha256: "xyz" },
      media: null,
      locator: { symbol: null, line_start: null, line_end: null, byte_start: null, byte_end: null, data_key: null },
      fragment_hash: null,
      excerpt: "secret excerpt that should not be rendered",
      publication: { access: "restricted", expose_locator: false, excerpt_policy: "short", license_ref: "CC-BY-4.0" },
    },
  },
  {
    id: "ev-private",
    anchor: {
      source_id: "src-a",
      evidence_kind: "source_code",
      artifact: { path: "src/private.c", sha256: "prv" },
      media: null,
      locator: { symbol: null, line_start: null, line_end: null, byte_start: null, byte_end: null, data_key: null },
      fragment_hash: null,
      excerpt: "private excerpt that should not be rendered",
      publication: { access: "private", expose_locator: false, excerpt_policy: "short", license_ref: "CC-BY-4.0" },
    },
  },
];

describe("WEB-004: restricted evidence text is not rendered", () => {
  let setup: TestSetup;

  beforeEach(async () => {
    setup = await setupWebWorkspace({
      kbId: "web004-test",
      records: [
        { id: testId(1), key: "goblin", record_type: "creature", title: "Goblin" },
      ],
      keys: [{ id: testId(1), key: "goblin", record_type: "creature" }],
      evidence,
      bindings: [{ source_id: "src-a", source_unit_path: "src-a", declared_version: "1.0.0", version_scheme: "semver", metadata_origin: "package.json", fingerprint: { algorithm: "sha256-tree-v1", value: "abc123" }, vcs: null, binding_digest: "abc123" }],
    });
  });

  afterEach(() => setup.cleanup());

  it("restricted evidence is excluded from projection entirely", () => {
    const rendered = renderEvidence(setup.ctx.store.evidence, setup.ctx.store.sources);
    const restricted = rendered.find((e) => e.id === "ev-restricted");
    expect(restricted).toBeUndefined();
  });

  it("private evidence is excluded from projection entirely", () => {
    const rendered = renderEvidence(setup.ctx.store.evidence, setup.ctx.store.sources);
    const privateEv = rendered.find((e) => e.id === "ev-private");
    expect(privateEv).toBeUndefined();
  });

  it("public evidence is present and not restricted", () => {
    const rendered = renderEvidence(setup.ctx.store.evidence, setup.ctx.store.sources);
    const publicEv = rendered.find((e) => e.id === "ev-public");
    expect(publicEv).toBeDefined();
    expect(publicEv!.restricted).toBe(false);
    expect(publicEv!.excerpt).toBe("public excerpt");
  });

  it("restricted evidence text does not appear in rendered output", () => {
    const rendered = renderEvidence(setup.ctx.store.evidence, setup.ctx.store.sources);
    const allText = JSON.stringify(rendered);
    expect(allText).not.toContain("secret excerpt that should not be rendered");
    expect(allText).not.toContain("private excerpt that should not be rendered");
  });

  it("restricted evidence text does not appear in projection store", () => {
    const allStoreText = JSON.stringify(setup.ctx.store.evidence);
    expect(allStoreText).not.toContain("secret excerpt that should not be rendered");
    expect(allStoreText).not.toContain("private excerpt that should not be rendered");
  });
});
