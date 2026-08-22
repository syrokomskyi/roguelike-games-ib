/*
<MODULE_CONTRACT>
<purpose>Sprite Pipeline — owns glyph-to-coordinate mapping, tile sheet reading, sprite extraction, and PNG dimension reading for the BrogueCE extractor.</purpose>
<non-goals>
  <item>Does not parse C source — receives a glyph map and tile sheet buffer from the caller.</item>
  <item>Does not construct knowledge records — returns relative paths and dimensions.</item>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: extracted from extractor.ts to consolidate sprite logic behind a single seam.</item>
</CHANGE_SUMMARY>
*/
import { extractTileSprite } from "@roguelike-games-ib/extractor-sdk";
import { join } from "node:path";

const TILE_WIDTH = 128;
const TILE_HEIGHT = 232;
const TILE_COLS = 16;
const GLYPH_BASE = 128;

export function buildGlyphIndexMap(rogueH: string): Map<string, number> {
  const map = new Map<string, number>();
  const enumMatch = rogueH.match(/enum\s+displayGlyph\s*\{([^}]+)\}/);
  if (!enumMatch) return map;
  const entries = enumMatch[1].split(",");
  let currentVal = GLYPH_BASE;
  for (const entry of entries) {
    const trimmed = entry.trim();
    if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("/*")) continue;
    const nameMatch = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)/);
    if (nameMatch) {
      const eqMatch = trimmed.match(/=\s*(\d+)/);
      if (eqMatch) currentVal = parseInt(eqMatch[1], 10);
      map.set(nameMatch[1], currentVal);
      currentVal++;
    }
  }
  return map;
}

export function glyphToTileCoords(
  glyph: string | null,
  glyphMap: Map<string, number>,
): { x: number; y: number; w: number; h: number } | null {
  if (!glyph) return null;
  const val = glyphMap.get(glyph);
  if (val == null) return null;
  const tileIndex = val + 126;
  const row = Math.floor(tileIndex / TILE_COLS);
  const col = tileIndex % TILE_COLS;
  return { x: col * TILE_WIDTH, y: row * TILE_HEIGHT, w: TILE_WIDTH, h: TILE_HEIGHT };
}

export function readPngDimensions(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 24) return null;
  if (buf[0] !== 0x89 || buf[1] !== 0x50 || buf[2] !== 0x4e || buf[3] !== 0x47) return null;
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  return { width, height };
}

export interface SpritePipeline {
  getCoords(glyph: string | null): { x: number; y: number; w: number; h: number } | null;
  extractSprite(glyph: string | null, slug: string): Promise<string | null>;
}

export function createSpritePipeline(
  glyphMap: Map<string, number>,
  tilesPngBuf: Buffer | null,
  outDir: string,
  relPrefix: string,
): SpritePipeline {
  return {
    getCoords(glyph) {
      return glyphToTileCoords(glyph, glyphMap);
    },
    async extractSprite(glyph, slug) {
      if (!glyph || !tilesPngBuf) return null;
      const coords = glyphToTileCoords(glyph, glyphMap);
      if (!coords) return null;
      const fileName = `${slug}.png`;
      const outPath = join(outDir, fileName);
      const relPath = `${relPrefix}/${fileName}`;
      await extractTileSprite(tilesPngBuf, coords, outPath);
      return relPath;
    },
  };
}
