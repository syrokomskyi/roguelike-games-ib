import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { extractTileSprite, type TileCoords } from "@roguelike-games-ib/extractor-sdk";
import { createTempWorkspace, cleanupTempWorkspace } from "@roguelike-games-ib/test-fixtures";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

async function makeTileSheet(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 255 } },
  })
    .png()
    .toBuffer();
}

async function makeColoredTileSheet(
  width: number,
  height: number,
  colors: Array<{ x: number; y: number; w: number; h: number; r: number; g: number; b: number }>,
): Promise<Buffer> {
  const composites: Array<{ input: Buffer; left: number; top: number }> = [];
  for (const c of colors) {
    const tileBuf = await sharp({
      create: { width: c.w, height: c.h, channels: 4, background: { r: c.r, g: c.g, b: c.b, alpha: 255 } },
    })
      .png()
      .toBuffer();
    composites.push({ input: tileBuf, left: c.x, top: c.y });
  }

  return sharp({
    create: { width, height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 255 } },
  })
    .composite(composites)
    .png()
    .toBuffer();
}

describe("EXT-014: extractTileSprite — crop and file output", () => {
  let workspace: string;

  beforeEach(() => {
    workspace = createTempWorkspace();
  });

  afterEach(() => {
    cleanupTempWorkspace(workspace);
  });

  it("writes a valid PNG file to the specified output path", async () => {
    const sheet = await makeTileSheet(256, 256);
    const coords: TileCoords = { x: 0, y: 0, w: 128, h: 128 };
    const outPath = join(workspace, "sprite.png");

    await extractTileSprite(sheet, coords, outPath);

    expect(existsSync(outPath)).toBe(true);
    const stat = statSync(outPath);
    expect(stat.size).toBeGreaterThan(0);

    // Verify it's a valid PNG
    const buf = readFileSync(outPath);
    expect(buf[0]).toBe(0x89);
    expect(buf[1]).toBe(0x50);
    expect(buf[2]).toBe(0x4e);
    expect(buf[3]).toBe(0x47);
  });

  it("extracts the correct region from the tile sheet", async () => {
    // 200x200 sheet with a blue 100x100 region at (100, 0) and red elsewhere
    const sheet = await makeColoredTileSheet(200, 200, [
      { x: 0, y: 0, w: 100, h: 100, r: 255, g: 0, b: 0 },
      { x: 100, y: 0, w: 100, h: 100, r: 0, g: 0, b: 255 },
    ]);
    const coords: TileCoords = { x: 100, y: 0, w: 100, h: 100 };
    const outPath = join(workspace, "blue-tile.png");

    await extractTileSprite(sheet, coords, outPath);

    // Read back and verify dimensions
    const meta = await sharp(readFileSync(outPath)).metadata();
    expect(meta.width).toBe(100);
    expect(meta.height).toBe(100);

    // Check center pixel is blue
    const { data, info } = await sharp(readFileSync(outPath)).raw().toBuffer({ resolveWithObject: true });
    const cx = Math.floor(info.width / 2);
    const cy = Math.floor(info.height / 2);
    const idx = (cy * info.width + cx) * info.channels;
    expect(data[idx]).toBe(0);     // R
    expect(data[idx + 1]).toBe(0); // G
    expect(data[idx + 2]).toBe(255); // B
  });

  it("creates parent directories if they do not exist", async () => {
    const sheet = await makeTileSheet(64, 64);
    const coords: TileCoords = { x: 0, y: 0, w: 32, h: 32 };
    const outPath = join(workspace, "nested", "deep", "dir", "sprite.png");

    await extractTileSprite(sheet, coords, outPath);

    expect(existsSync(outPath)).toBe(true);
  });

  it("handles 1x1 pixel extraction", async () => {
    const sheet = await makeTileSheet(16, 16);
    const coords: TileCoords = { x: 5, y: 5, w: 1, h: 1 };
    const outPath = join(workspace, "pixel.png");

    await extractTileSprite(sheet, coords, outPath);

    const meta = await sharp(readFileSync(outPath)).metadata();
    expect(meta.width).toBe(1);
    expect(meta.height).toBe(1);
  });

  it("extracts full sheet when coords cover entire image", async () => {
    const sheet = await makeTileSheet(64, 64);
    const coords: TileCoords = { x: 0, y: 0, w: 64, h: 64 };
    const outPath = join(workspace, "full.png");

    await extractTileSprite(sheet, coords, outPath);

    const meta = await sharp(readFileSync(outPath)).metadata();
    expect(meta.width).toBe(64);
    expect(meta.height).toBe(64);
  });

  it("produces deterministic output for the same input", async () => {
    const sheet = await makeTileSheet(128, 128);
    const coords: TileCoords = { x: 0, y: 0, w: 64, h: 64 };
    const out1 = join(workspace, "det1.png");
    const out2 = join(workspace, "det2.png");

    await extractTileSprite(sheet, coords, out1);
    await extractTileSprite(sheet, coords, out2);

    const buf1 = readFileSync(out1);
    const buf2 = readFileSync(out2);

    // Same input → same output bytes (sharp PNG is deterministic for same input)
    expect(buf1.equals(buf2)).toBe(true);
  });
});
