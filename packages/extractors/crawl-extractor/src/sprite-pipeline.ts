import { existsSync, mkdirSync, copyFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

export interface CrawlSpritePipeline {
  extractSprite(tileName: string | null, slug: string): Promise<string | null>;
  getSpritePath(tileName: string | null): string | null;
}

const RLTILES_ROOT = resolve(
  "/home/syrokomskyi/projects/roguelike-games-ib-source/crawl/crawl-ref/source/rltiles",
);

const SPRITE_OUT_DIR = join(process.cwd(), "knowledge/evidence/crawl/sprites");
const SPRITE_REL_PREFIX = "knowledge/evidence/crawl/sprites";

function findPngByName(dir: string, name: string): string | null {
  if (!existsSync(dir)) return null;
  const target = name.toLowerCase().replace(/-/g, "_");
  function walk(d: string): string | null {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        const found = walk(join(d, entry.name));
        if (found) return found;
      } else if (entry.isFile() && entry.name.toLowerCase() === `${target}.png`) {
        return join(d, entry.name);
      }
    }
    return null;
  }
  return walk(dir);
}

export function createCrawlSpritePipeline(): CrawlSpritePipeline {
  mkdirSync(SPRITE_OUT_DIR, { recursive: true });

  return {
    getSpritePath(tileName) {
      if (!tileName || tileName === "program_bug" || tileName.startsWith("tile_unseen")) return null;
      const found = findPngByName(join(RLTILES_ROOT, "mon"), tileName);
      if (found) return found;
      return findPngByName(RLTILES_ROOT, tileName);
    },

    async extractSprite(tileName, slug) {
      if (!tileName) return null;
      if (tileName === "program_bug" || tileName.startsWith("tile_unseen")) return null;
      const srcPath = findPngByName(join(RLTILES_ROOT, "mon"), tileName)
        ?? findPngByName(RLTILES_ROOT, tileName);
      if (!srcPath) return null;

      const fileName = `${slug}.png`;
      const outPath = join(SPRITE_OUT_DIR, fileName);
      try {
        copyFileSync(srcPath, outPath);
        return `${SPRITE_REL_PREFIX}/${fileName}`;
      } catch {
        return null;
      }
    },
  };
}
