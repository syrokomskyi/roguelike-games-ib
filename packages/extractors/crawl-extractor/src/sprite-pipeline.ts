/*
<MODULE_CONTRACT>
<purpose>Crawl Sprite Pipeline — walks the rltiles/ directory for monster PNG sprites, caches the index, and copies matching sprites to the evidence directory.</purpose>
<non-goals>
  <item>Does not parse YAML — receives tile names from the extractor.</item>
  <item>Does not construct knowledge records — returns relative paths.</item>
  <item>Does not read from ExtractorContext — receives rltilesRoot and outDir from the caller.</item>
</non-goals>
<CHANGE_SUMMARY>
  <item>Initial creation: sprite pipeline for Crawl extractor using individual PNG files from rltiles/.</item>
</CHANGE_SUMMARY>
*/
import { existsSync, mkdirSync, copyFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export interface CrawlSpritePipeline {
  extractSprite(tileName: string | null, slug: string): Promise<string | null>;
}

const SPRITE_REL_PREFIX = "knowledge/evidence/crawl/sprites";

function isSkippableTile(tileName: string): boolean {
  return tileName === "program_bug" || tileName.startsWith("tile_unseen");
}

function normalizeTileName(name: string): string {
  return name.toLowerCase().replace(/-/g, "_");
}

function findPngRecursive(dir: string, normalizedTarget: string): string | null {
  if (!existsSync(dir)) return null;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      const found = findPngRecursive(join(dir, entry.name), normalizedTarget);
      if (found) return found;
    } else if (entry.isFile() && entry.name.toLowerCase() === `${normalizedTarget}.png`) {
      return join(dir, entry.name);
    }
  }
  return null;
}

function buildPngIndex(rltilesRoot: string): Map<string, string> {
  const index = new Map<string, string>();
  const monDir = join(rltilesRoot, "mon");
  if (!existsSync(monDir)) return index;

  function walk(d: string) {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        walk(join(d, entry.name));
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".png")) {
        const baseName = entry.name.toLowerCase().replace(/\.png$/, "");
        index.set(baseName, join(d, entry.name));
      }
    }
  }
  walk(monDir);
  return index;
}

export function createCrawlSpritePipeline(
  rltilesRoot: string,
  outDir: string,
): CrawlSpritePipeline {
  mkdirSync(outDir, { recursive: true });
  const pngIndex = buildPngIndex(rltilesRoot);

  function lookupPng(tileName: string): string | null {
    if (isSkippableTile(tileName)) return null;
    const normalized = normalizeTileName(tileName);
    return pngIndex.get(normalized) ?? null;
  }

  return {
    async extractSprite(tileName, slug) {
      if (!tileName) return null;
      const srcPath = lookupPng(tileName);
      if (!srcPath) return null;

      const fileName = `${slug}.png`;
      const outPath = join(outDir, fileName);
      try {
        copyFileSync(srcPath, outPath);
        return `${SPRITE_REL_PREFIX}/${fileName}`;
      } catch (err) {
        console.warn(`[crawl-sprite] Failed to copy ${srcPath} -> ${outPath}: ${err}`);
        return null;
      }
    },
  };
}
