import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { setupWebWorkspace, testId, type TestSetup } from "./helpers";
import { getPageMetadata, metadataToHtmlMeta } from "@roguelike-games-ib/web";

describe("WEB-006: page metadata reports canonical hash", () => {
  let setup: TestSetup;

  beforeEach(async () => {
    setup = await setupWebWorkspace({
      kbId: "web006-test",
      records: [
        { id: testId(1), key: "goblin", record_type: "creature", title: "Goblin" },
      ],
      keys: [{ id: testId(1), key: "goblin", record_type: "creature" }],
      bindings: [{ source_id: "src-a", source_unit_path: "src-a", declared_version: "1.0.0", version_scheme: "semver", metadata_origin: "package.json", fingerprint: { algorithm: "sha256-tree-v1", value: "abc123" }, vcs: null, binding_digest: "abc123" }],
    });
  });

  afterEach(() => setup.cleanup());

  it("page metadata contains canonical hash matching materialization", () => {
    const meta = getPageMetadata(setup.ctx);
    expect(meta.canonicalHash).toBe(setup.canonicalHash);
  });

  it("page metadata contains dataset id", () => {
    const meta = getPageMetadata(setup.ctx);
    expect(meta.datasetId).toBe("web006-test");
  });

  it("page metadata contains license", () => {
    const meta = getPageMetadata(setup.ctx);
    expect(meta.license).toBe("CC-BY-4.0");
  });

  it("page metadata defaults to canonical authority", () => {
    const meta = getPageMetadata(setup.ctx);
    expect(meta.authority).toBe("canonical");
  });

  it("page metadata can be set to laboratory authority", () => {
    const meta = getPageMetadata(setup.ctx, "laboratory");
    expect(meta.authority).toBe("laboratory");
  });

  it("metadataToHtmlMeta includes canonical hash in meta tags", () => {
    const meta = getPageMetadata(setup.ctx);
    const html = metadataToHtmlMeta(meta);
    expect(html).toContain(`content="${setup.canonicalHash}"`);
    expect(html).toContain('name="x-ib-canonical-hash"');
  });

  it("metadataToHtmlMeta includes license", () => {
    const meta = getPageMetadata(setup.ctx);
    const html = metadataToHtmlMeta(meta);
    expect(html).toContain('name="x-ib-license"');
    expect(html).toContain('content="CC-BY-4.0"');
  });

  it("metadataToHtmlMeta includes authority", () => {
    const meta = getPageMetadata(setup.ctx, "laboratory");
    const html = metadataToHtmlMeta(meta);
    expect(html).toContain('name="x-ib-authority"');
    expect(html).toContain('content="laboratory"');
  });
});
