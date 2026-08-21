import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { setupSearchWorkspace, testId } from "./helpers";
import { buildSearchIndex, InMemoryVectorIndex, writeSearchManifest } from "@roguelike-games-ib/search";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const records = [
  {
    id: testId(1),
    key: "goblin",
    record_type: "creature",
    title: "Goblin",
    summary: "A small green creature",
    source_identity: { source_id: "src-a", native_id: "goblin", path: "data.json" },
  },
  {
    id: testId(2),
    key: "kobold",
    record_type: "creature",
    title: "Kobold",
    summary: "A small reptilian creature",
    source_identity: { source_id: "src-a", native_id: "kobold", path: "data.json" },
  },
];

const keys = [
  { id: testId(1), key: "goblin", record_type: "creature" },
  { id: testId(2), key: "kobold", record_type: "creature" },
];

describe("SEARCH-004: vector index metadata contains canonical hash/model", () => {
  let setup: Awaited<ReturnType<typeof setupSearchWorkspace>>;

  beforeEach(async () => {
    setup = await setupSearchWorkspace({
      kbId: "search004-test",
      records,
      keys,
    });
  });

  afterEach(() => {
    setup.cleanup();
  });

  it("manifest has canonicalHash", () => {
    const manifest = setup.index.manifest;
    expect(manifest.canonicalHash).toBeTruthy();
    expect(manifest.canonicalHash).toBe(setup.canonicalHash);
  });

  it("manifest has embedding model id", () => {
    const manifest = setup.index.manifest;
    expect(manifest.embeddingModel).not.toBeNull();
    expect(typeof manifest.embeddingModel).toBe("string");
  });

  it("manifest has embedding dimensionality", () => {
    const manifest = setup.index.manifest;
    expect(manifest.embeddingDimensionality).not.toBeNull();
  });

  it("manifest has embedding provider", () => {
    const manifest = setup.index.manifest;
    expect(manifest.embeddingProvider).not.toBeNull();
  });

  it("manifest has input normalization version", () => {
    const manifest = setup.index.manifest;
    expect(manifest.inputNormalizationVersion).toBeTruthy();
  });

  it("manifest has schema identifier", () => {
    const manifest = setup.index.manifest;
    expect(manifest.schema).toBe("rgkb/search-index-manifest@1");
  });

  it("manifest can be written to disk and read back", () => {
    const manifestPath = writeSearchManifest(setup.distDir, setup.index.manifest);
    const raw = readFileSync(manifestPath, "utf-8");
    const parsed = JSON.parse(raw);
    expect(parsed.canonicalHash).toBe(setup.canonicalHash);
    expect(parsed.embeddingModel).toBeTruthy();
  });

  it("custom vector index metadata is reflected in manifest", async () => {
    const customIndex = new InMemoryVectorIndex({
      modelId: "Xenova/all-MiniLM-L6-v2",
      provider: "@huggingface/transformers",
      dimensionality: 384,
      inputNormalizationVersion: "2",
      embedFn: async () => new Float32Array(384),
    });

    const index = await buildSearchIndex({
      dbPath: setup.dbPath,
      canonicalHash: setup.canonicalHash,
      vectorIndex: customIndex,
    });

    expect(index.manifest.embeddingModel).toBe("Xenova/all-MiniLM-L6-v2");
    expect(index.manifest.embeddingProvider).toBe("@huggingface/transformers");
    expect(index.manifest.embeddingDimensionality).toBe(384);
    expect(index.manifest.inputNormalizationVersion).toBe("2");
  });
});
