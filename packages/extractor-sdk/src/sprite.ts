/*
<MODULE_CONTRACT>
<purpose>Provides generic tile sprite extraction — crops a region from a tile sheet image and writes it to an output file.</purpose>
<non-goals>
  <item>Does not compute tile coordinates — receives coordinates from the extractor.</item>
  <item>Does not manage sprite naming conventions — receives output path from the extractor.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: extractTileSprite and extractTileSpriteToBuffer utilities using sharp.</item>
</CHANGE_SUMMARY>
*/
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export interface TileCoords {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Extracts a rectangular region from a tile sheet image buffer and writes it to a file.
 * Creates parent directories if needed.
 *
 * @param tileSheetBuf - Buffer containing the source tile sheet image (e.g. PNG)
 * @param coords - Region to extract { x, y, w, h } in pixels
 * @param outPath - Absolute path to write the extracted sprite
 * @returns Promise that resolves when the file is written
 */
export async function extractTileSprite(
  tileSheetBuf: Buffer,
  coords: TileCoords,
  outPath: string,
): Promise<void> {
  mkdirSync(dirname(outPath), { recursive: true });
  await sharp(tileSheetBuf)
    .extract({ left: coords.x, top: coords.y, width: coords.w, height: coords.h })
    .toFile(outPath);
}

/**
 * Extracts a rectangular region from a tile sheet image buffer and returns it as a Buffer.
 *
 * @param tileSheetBuf - Buffer containing the source tile sheet image
 * @param coords - Region to extract { x, y, w, h } in pixels
 * @param format - Output format (default: png)
 * @returns Promise resolving to the extracted image Buffer
 */
export async function extractTileSpriteToBuffer(
  tileSheetBuf: Buffer,
  coords: TileCoords,
  format: "png" | "webp" | "jpeg" = "png",
): Promise<Buffer> {
  return sharp(tileSheetBuf)
    .extract({ left: coords.x, top: coords.y, width: coords.w, height: coords.h })
    .toFormat(format)
    .toBuffer();
}
