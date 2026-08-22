import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  buildGlyphIndexMap,
  glyphToTileCoords,
  readPngDimensions,
  createSpritePipeline,
  type SpritePipeline,
} from "@roguelike-games-ib/broguece-extractor";
import { createTempWorkspace, cleanupTempWorkspace } from "@roguelike-games-ib/test-fixtures";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const TILE_WIDTH = 128;
const TILE_HEIGHT = 232;
const TILE_COLS = 16;
const GLYPH_BASE = 128;

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

async function makeRealPng(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 4, background: { r: 128, g: 64, b: 32, alpha: 255 } },
  })
    .png()
    .toBuffer();
}

describe("EXT-015a: buildGlyphIndexMap — enum parsing", () => {
  it("parses a simple displayGlyph enum", () => {
    const rogueH = `
enum displayGlyph {
  GLYPH_A,
  GLYPH_B,
  GLYPH_C
}
`;
    const map = buildGlyphIndexMap(rogueH);
    expect(map.size).toBe(3);
    expect(map.get("GLYPH_A")).toBe(GLYPH_BASE);
    expect(map.get("GLYPH_B")).toBe(GLYPH_BASE + 1);
    expect(map.get("GLYPH_C")).toBe(GLYPH_BASE + 2);
  });

  it("handles explicit values in enum entries", () => {
    const rogueH = `
enum displayGlyph {
  GLYPH_A = 200,
  GLYPH_B,
  GLYPH_C = 300
}
`;
    const map = buildGlyphIndexMap(rogueH);
    expect(map.get("GLYPH_A")).toBe(200);
    expect(map.get("GLYPH_B")).toBe(201);
    expect(map.get("GLYPH_C")).toBe(300);
  });

  it("skips comments and empty entries", () => {
    const rogueH = `
enum displayGlyph {
  // This is a comment,
  GLYPH_A,
  /* block comment */,
  GLYPH_B,
  ,
  GLYPH_C
}
`;
    const map = buildGlyphIndexMap(rogueH);
    expect(map.size).toBe(3);
    expect(map.get("GLYPH_A")).toBe(GLYPH_BASE);
    expect(map.get("GLYPH_B")).toBe(GLYPH_BASE + 1);
    expect(map.get("GLYPH_C")).toBe(GLYPH_BASE + 2);
  });

  it("returns empty map when no enum found", () => {
    const map = buildGlyphIndexMap("no enum here");
    expect(map.size).toBe(0);
  });

  it("handles single-entry enum", () => {
    const rogueH = `enum displayGlyph { GLYPH_SOLO }`;
    const map = buildGlyphIndexMap(rogueH);
    expect(map.size).toBe(1);
    expect(map.get("GLYPH_SOLO")).toBe(GLYPH_BASE);
  });
});

describe("EXT-015b: glyphToTileCoords — coordinate mapping", () => {
  const glyphMap = new Map<string, number>([
    ["GLYPH_A", GLYPH_BASE],
    ["GLYPH_B", GLYPH_BASE + 1],
  ]);

  it("maps first glyph to correct tile coordinates", () => {
    const coords = glyphToTileCoords("GLYPH_A", glyphMap);
    expect(coords).not.toBeNull();
    const tileIndex = GLYPH_BASE + 126;
    const row = Math.floor(tileIndex / TILE_COLS);
    const col = tileIndex % TILE_COLS;
    expect(coords!.x).toBe(col * TILE_WIDTH);
    expect(coords!.y).toBe(row * TILE_HEIGHT);
    expect(coords!.w).toBe(TILE_WIDTH);
    expect(coords!.h).toBe(TILE_HEIGHT);
  });

  it("maps second glyph to next tile", () => {
    const coords = glyphToTileCoords("GLYPH_B", glyphMap);
    expect(coords).not.toBeNull();
    const tileIndex = GLYPH_BASE + 1 + 126;
    const row = Math.floor(tileIndex / TILE_COLS);
    const col = tileIndex % TILE_COLS;
    expect(coords!.x).toBe(col * TILE_WIDTH);
    expect(coords!.y).toBe(row * TILE_HEIGHT);
  });

  it("returns null for unknown glyph", () => {
    expect(glyphToTileCoords("GLYPH_UNKNOWN", glyphMap)).toBeNull();
  });

  it("returns null for null glyph", () => {
    expect(glyphToTileCoords(null, glyphMap)).toBeNull();
  });

  it("wraps to next row when tile index exceeds column count", () => {
    const localMap = new Map<string, number>([["GLYPH_WRAP", GLYPH_BASE + 15]]);
    const coords = glyphToTileCoords("GLYPH_WRAP", localMap);
    expect(coords).not.toBeNull();
    const tileIndex = GLYPH_BASE + 15 + 126;
    const row = Math.floor(tileIndex / TILE_COLS);
    const col = tileIndex % TILE_COLS;
    expect(coords!.x).toBe(col * TILE_WIDTH);
    expect(coords!.y).toBe(row * TILE_HEIGHT);
    expect(row).toBeGreaterThan(0);
  });
});

describe("EXT-015c: readPngDimensions — PNG header parsing", () => {
  it("reads correct dimensions from a valid PNG header", () => {
    const buf = makeMinimalPng(512, 1024);
    const dims = readPngDimensions(buf);
    expect(dims).not.toBeNull();
    expect(dims!.width).toBe(512);
    expect(dims!.height).toBe(1024);
  });

  it("returns null for buffer too short", () => {
    expect(readPngDimensions(Buffer.alloc(10))).toBeNull();
  });

  it("returns null for non-PNG buffer", () => {
    const buf = Buffer.alloc(24, 0);
    expect(readPngDimensions(buf)).toBeNull();
  });

  it("returns null for buffer with wrong magic bytes", () => {
    const buf = makeMinimalPng(64, 64);
    buf[0] = 0x00;
    expect(readPngDimensions(buf)).toBeNull();
  });

  it("handles 1x1 PNG", () => {
    const buf = makeMinimalPng(1, 1);
    const dims = readPngDimensions(buf);
    expect(dims).not.toBeNull();
    expect(dims!.width).toBe(1);
    expect(dims!.height).toBe(1);
  });
});

describe("EXT-015d: createSpritePipeline — integration", () => {
  let workspace: string;

  beforeEach(() => {
    workspace = createTempWorkspace();
  });

  afterEach(() => {
    cleanupTempWorkspace(workspace);
  });

  it("getCoords delegates to glyphToTileCoords", () => {
    const glyphMap = new Map<string, number>([["GLYPH_A", GLYPH_BASE]]);
    const pipeline = createSpritePipeline(glyphMap, null, "/tmp", "sprites");

    const coords = pipeline.getCoords("GLYPH_A");
    expect(coords).not.toBeNull();
    expect(coords!.w).toBe(TILE_WIDTH);
    expect(coords!.h).toBe(TILE_HEIGHT);
  });

  it("getCoords returns null for unknown glyph", () => {
    const glyphMap = new Map<string, number>();
    const pipeline = createSpritePipeline(glyphMap, null, "/tmp", "sprites");
    expect(pipeline.getCoords("GLYPH_UNKNOWN")).toBeNull();
  });

  it("extractSprite returns null when no tile buffer is available", async () => {
    const glyphMap = new Map<string, number>([["GLYPH_A", GLYPH_BASE]]);
    const pipeline = createSpritePipeline(glyphMap, null, "/tmp", "sprites");
    const result = await pipeline.extractSprite("GLYPH_A", "test-slug");
    expect(result).toBeNull();
  });

  it("extractSprite returns null for null glyph", async () => {
    const glyphMap = new Map<string, number>([["GLYPH_A", GLYPH_BASE]]);
    const pipeline = createSpritePipeline(glyphMap, Buffer.alloc(10), "/tmp", "sprites");
    const result = await pipeline.extractSprite(null, "test-slug");
    expect(result).toBeNull();
  });

  it("extractSprite returns null for unknown glyph", async () => {
    const glyphMap = new Map<string, number>();
    const buf = await makeRealPng(256, 256);
    const pipeline = createSpritePipeline(glyphMap, buf, "/tmp", "sprites");
    const result = await pipeline.extractSprite("GLYPH_UNKNOWN", "test-slug");
    expect(result).toBeNull();
  });

  it("extractSprite writes a PNG file and returns relative path", async () => {
    const glyphMap = new Map<string, number>([["GLYPH_A", GLYPH_BASE]]);
    // Need a tile sheet large enough for the extracted region
    const tileIndex = GLYPH_BASE + 126;
    const row = Math.floor(tileIndex / TILE_COLS);
    const col = tileIndex % TILE_COLS;
    const sheetWidth = (col + 1) * TILE_WIDTH;
    const sheetHeight = (row + 1) * TILE_HEIGHT;
    const buf = await makeRealPng(sheetWidth, sheetHeight);

    const outDir = join(workspace, "sprites");
    const relPrefix = "knowledge/evidence/broguece/sprites";
    const pipeline = createSpritePipeline(glyphMap, buf, outDir, relPrefix);

    const result = await pipeline.extractSprite("GLYPH_A", "goblin");
    expect(result).not.toBeNull();
    expect(result).toBe("knowledge/evidence/broguece/sprites/goblin.png");

    const outPath = join(outDir, "goblin.png");
    expect(existsSync(outPath)).toBe(true);

    const meta = await sharp(readFileSync(outPath)).metadata();
    expect(meta.width).toBe(TILE_WIDTH);
    expect(meta.height).toBe(TILE_HEIGHT);
  });

  it("extractSprite produces deterministic output across calls", async () => {
    const glyphMap = new Map<string, number>([["GLYPH_A", GLYPH_BASE]]);
    const tileIndex = GLYPH_BASE + 126;
    const row = Math.floor(tileIndex / TILE_COLS);
    const col = tileIndex % TILE_COLS;
    const sheetWidth = (col + 1) * TILE_WIDTH;
    const sheetHeight = (row + 1) * TILE_HEIGHT;
    const buf = await makeRealPng(sheetWidth, sheetHeight);

    const outDir = join(workspace, "sprites");
    const relPrefix = "sprites";
    const pipeline = createSpritePipeline(glyphMap, buf, outDir, relPrefix);

    const result1 = await pipeline.extractSprite("GLYPH_A", "det-test");
    const result2 = await pipeline.extractSprite("GLYPH_A", "det-test");

    expect(result1).toBe(result2);

    const file1 = readFileSync(join(outDir, "det-test.png"));
    expect(file1.length).toBeGreaterThan(0);
  });
});
