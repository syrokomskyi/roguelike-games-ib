import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { setupWebWorkspace, testId, type TestSetup } from "./helpers";
import { renderEvidence, type RenderedEvidence } from "@roguelike-games-ib/web";

const SHA = "a".repeat(64);

function makeImageEvidence(id: string, recordId: string, sourceId: string, artifactPath: string) {
  return {
    id,
    record_id: recordId,
    anchor: {
      source_id: sourceId,
      evidence_kind: "asset",
      artifact: { path: artifactPath, sha256: SHA },
      media: {
        mime_type: "image/png",
        width: 256,
        height: 256,
        alt_text: `Image asset: ${artifactPath.split("/").pop()}`,
      },
      locator: {
        symbol: null,
        line_start: null,
        line_end: null,
        byte_start: null,
        byte_end: null,
        data_key: artifactPath,
      },
      fragment_hash: null,
      publication: {
        access: "public",
        expose_locator: true,
        excerpt_policy: "none",
        license_ref: null,
      },
    },
  };
}

describe("WEB-007: image evidence rendering on the web", () => {
  let setup: TestSetup;

  beforeEach(async () => {
    setup = await setupWebWorkspace({
      kbId: "web007-test",
      records: [
        {
          id: testId(1),
          key: "broguece-icon",
          record_type: "image_asset",
          name: { canonical: "icon.png", original: "icon.png" },
          source_identity: { source_id: "broguece", native_id: "bin/assets/icon.png", path: "bin/assets/icon.png" },
          evidence_refs: [testId(100)],
        },
      ],
      keys: [{ id: testId(1), key: "broguece-icon", record_type: "image_asset" }],
      evidence: [
        makeImageEvidence(testId(100), testId(1), "broguece", "bin/assets/icon.png"),
      ],
      bindings: [{
        source_id: "broguece",
        source_unit_path: "BrogueCE",
        declared_version: "1.0.0",
        version_scheme: "semver",
        metadata_origin: "readme",
        fingerprint: { algorithm: "sha256-tree-v1", value: "abc123" },
        vcs: { repository: "https://github.com/tmewster/BrogueCE.git", commit: "abc123", clean: null, default_branch: "master" },
        binding_digest: "abc123",
      }],
    });
  });

  afterEach(() => setup.cleanup());

  it("rendered evidence includes evidence_kind field", () => {
    const rendered = renderEvidence(setup.ctx.store.evidence, setup.ctx.store.sources);
    expect(rendered).toHaveLength(1);
    expect(rendered[0].evidence_kind).toBe("asset");
  });

  it("rendered evidence includes media metadata", () => {
    const rendered = renderEvidence(setup.ctx.store.evidence, setup.ctx.store.sources);
    expect(rendered[0].media).not.toBeNull();
    expect(rendered[0].media!.mime_type).toBe("image/png");
    expect(rendered[0].media!.width).toBe(256);
    expect(rendered[0].media!.height).toBe(256);
    expect(rendered[0].media!.alt_text).toContain("icon.png");
  });

  it("rendered evidence includes github_url for the image asset", () => {
    const rendered = renderEvidence(setup.ctx.store.evidence, setup.ctx.store.sources);
    expect(rendered[0].github_url).not.toBeNull();
    expect(rendered[0].github_url).toContain("icon.png");
    expect(rendered[0].github_url).toContain("github.com");
  });

  it("rendered evidence includes artifact_path", () => {
    const rendered = renderEvidence(setup.ctx.store.evidence, setup.ctx.store.sources);
    expect(rendered[0].artifact_path).toBe("bin/assets/icon.png");
  });

  it("RenderedEvidence type has all required fields for image display", () => {
    const rendered = renderEvidence(setup.ctx.store.evidence, setup.ctx.store.sources) as RenderedEvidence[];
    const ev = rendered[0];
    expect(ev.evidence_kind).toBe("asset");
    expect(ev.media).not.toBeNull();
    expect(ev.github_url).not.toBeNull();
    expect(ev.artifact_path).not.toBeNull();
  });
});
