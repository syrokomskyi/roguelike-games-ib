import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  ReadonlySourceReader,
  EvidenceFactory,
  CandidateWriter,
  createNullSchemaFacade,
  createExtractorContext,
  RefreshIdentityResolver,
} from "@roguelike-games-ib/extractor-sdk";
import {
  createSourceBinding,
  type EvidenceAnchor,
} from "@roguelike-games-ib/knowledge-core";
import { createTestWorkspace, cleanupTempWorkspace } from "@roguelike-games-ib/test-fixtures";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

function makeMinimalPng(width: number, height: number): Buffer {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(25);
  ihdr.writeUInt32BE(13, 0);
  ihdr.write("IHDR", 4);
  ihdr.writeUInt32BE(width, 8);
  ihdr.writeUInt32BE(height, 12);
  ihdr.writeUInt8(8, 16);
  ihdr.writeUInt8(2, 17);
  ihdr.writeUInt8(0, 18);
  ihdr.writeUInt8(0, 19);
  ihdr.writeUInt8(0, 20);
  ihdr.writeUInt32BE(0, 21);
  return Buffer.concat([sig, ihdr]);
}

describe("EXT-011: image evidence records with media metadata", () => {
  let workspace: string;
  let sourceRoot: string;
  let stagingDir: string;

  beforeEach(() => {
    workspace = createTestWorkspace({
      kbId: "ext011-test",
      sourceFiles: [
        { path: "data.txt", content: "hello" },
      ],
    });
    const parentDir = join(workspace, "..");
    sourceRoot = join(parentDir, "ext011-test-source", "source");
    stagingDir = join(workspace, "staging");
    mkdirSync(stagingDir, { recursive: true });

    const assetsDir = join(sourceRoot, "bin", "assets");
    mkdirSync(assetsDir, { recursive: true });
    writeFileSync(join(assetsDir, "icon.png"), makeMinimalPng(256, 256));
    writeFileSync(join(assetsDir, "tiles.png"), makeMinimalPng(512, 1024));
  });

  afterEach(() => {
    cleanupTempWorkspace(workspace);
  });

  it("creates evidence anchor with evidence_kind=asset and media metadata", () => {
    const binding = createSourceBinding(
      "ext011-test",
      "ext011-test-source",
      "1.0.0",
      "semver",
      "readme",
      "fakefingerprint",
      { repository: "https://example.invalid/ext011-test.git", commit: null, clean: null, default_branch: "main" },
      "source",
    );

    const source = new ReadonlySourceReader(sourceRoot);
    const evidence = new EvidenceFactory("ext011-test", binding.binding_digest, sourceRoot);
    const ids = new RefreshIdentityResolver([], [], "ext011-test");
    const schemas = createNullSchemaFacade();
    const output = new CandidateWriter(stagingDir, "run-1", "ext011-test", "test-extractor", "1.0.0");
    const ctx = createExtractorContext(source, binding, schemas, evidence, ids, output);

    const anchor = ctx.evidence.create({
      artifactPath: "bin/assets/icon.png",
      evidenceKind: "asset",
      media: {
        mime_type: "image/png",
        width: 256,
        height: 256,
        alt_text: "Image asset: icon.png",
      },
      locator: {
        symbol: null,
        line_start: null,
        line_end: null,
        byte_start: null,
        byte_end: null,
        data_key: "bin/assets/icon.png",
      },
    });

    expect(anchor.evidence_kind).toBe("asset");
    expect(anchor.media).not.toBeNull();
    expect(anchor.media!.mime_type).toBe("image/png");
    expect(anchor.media!.width).toBe(256);
    expect(anchor.media!.height).toBe(256);
    expect(anchor.media!.alt_text).toBe("Image asset: icon.png");
    expect(anchor.artifact.path).toBe("bin/assets/icon.png");
    expect(anchor.artifact.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("EvidenceAnchor defaults evidence_kind to source_code when not specified", () => {
    const binding = createSourceBinding(
      "ext011-test",
      "ext011-test-source",
      "1.0.0",
      "semver",
      "readme",
      "fakefingerprint",
      { repository: "https://example.invalid/ext011-test.git", commit: null, clean: null, default_branch: "main" },
      "source",
    );

    const source = new ReadonlySourceReader(sourceRoot);
    const evidence = new EvidenceFactory("ext011-test", binding.binding_digest, sourceRoot);

    const anchor = evidence.create({
      artifactPath: "data.txt",
      locator: {
        symbol: "test",
        line_start: 1,
        line_end: 1,
        byte_start: null,
        byte_end: null,
        data_key: null,
      },
    });

    expect(anchor.evidence_kind).toBe("source_code");
    expect(anchor.media).toBeNull();
  });

  it("walks source tree and finds all image files", () => {
    const source = new ReadonlySourceReader(sourceRoot);
    const imageExtensions = [".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".bmp"];
    const imageFiles = source.walk((p) => {
      const ext = p.toLowerCase().match(/\.[^.]+$/)?.[0] ?? "";
      return imageExtensions.includes(ext);
    });

    expect(imageFiles).toHaveLength(2);
    expect(imageFiles).toContain("bin/assets/icon.png");
    expect(imageFiles).toContain("bin/assets/tiles.png");
  });

  it("reads PNG dimensions from binary header", () => {
    const source = new ReadonlySourceReader(sourceRoot);
    const iconBuf = source.readBytes("bin/assets/icon.png");

    expect(iconBuf[0]).toBe(0x89);
    expect(iconBuf[1]).toBe(0x50);
    const width = iconBuf.readUInt32BE(16);
    const height = iconBuf.readUInt32BE(20);
    expect(width).toBe(256);
    expect(height).toBe(256);
  });

  it("creates evidence with media for multiple images and writes to output", () => {
    const binding = createSourceBinding(
      "ext011-test",
      "ext011-test-source",
      "1.0.0",
      "semver",
      "readme",
      "fakefingerprint",
      { repository: "https://example.invalid/ext011-test.git", commit: null, clean: null, default_branch: "main" },
      "source",
    );

    const source = new ReadonlySourceReader(sourceRoot);
    const evidence = new EvidenceFactory("ext011-test", binding.binding_digest, sourceRoot);
    const ids = new RefreshIdentityResolver([], [], "ext011-test");
    const schemas = createNullSchemaFacade();
    const output = new CandidateWriter(stagingDir, "run-2", "ext011-test", "test-extractor", "1.0.0");
    const ctx = createExtractorContext(source, binding, schemas, evidence, ids, output);

    const imageExtensions = [".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".bmp"];
    const imageFiles = ctx.source.walk((p) => {
      const ext = p.toLowerCase().match(/\.[^.]+$/)?.[0] ?? "";
      return imageExtensions.includes(ext);
    });

    for (const imgPath of imageFiles) {
      const buf = ctx.source.readBytes(imgPath);
      const width = buf.readUInt32BE(16);
      const height = buf.readUInt32BE(20);
      const fileName = imgPath.split("/").pop() ?? imgPath;

      const resolved = ctx.ids.resolveOrCreate("image_asset", fileName.replace(/\.[^.]+$/, "").toLowerCase(), imgPath);
      ctx.output.writeRecord({
        id: resolved.id,
        key: resolved.key,
        record_type: "image_asset",
        name: fileName,
        source_identity: {
          source_id: ctx.binding.source_id,
          native_id: imgPath,
          path: imgPath,
        },
      });

      const anchor = ctx.evidence.create({
        artifactPath: imgPath,
        evidenceKind: "asset",
        media: {
          mime_type: "image/png",
          width,
          height,
          alt_text: `Image asset: ${fileName}`,
        },
        locator: {
          symbol: null,
          line_start: null,
          line_end: null,
          byte_start: null,
          byte_end: null,
          data_key: imgPath,
        },
      });
      ctx.output.writeEvidence(resolved.id, anchor);
    }

    const records = output.getRecords();
    const evidenceList = output.getEvidence();

    expect(records).toHaveLength(2);
    expect(evidenceList).toHaveLength(2);

    for (const ev of evidenceList) {
      const anchor = ev.anchor as EvidenceAnchor;
      expect(anchor.evidence_kind).toBe("asset");
      expect(anchor.media).not.toBeNull();
      expect(anchor.media!.mime_type).toBe("image/png");
      expect(anchor.media!.width).toBeGreaterThan(0);
      expect(anchor.media!.height).toBeGreaterThan(0);
      expect(anchor.media!.alt_text).toContain("Image asset:");
    }
  });
});
