/*
<MODULE_CONTRACT>
<purpose>Image Asset Adapter — walks the BrogueCE source tree for image files, reads media metadata, and produces ImageAssetEntry[] for the Entity Pipeline.</purpose>
<non-goals>
  <item>Does not create records or evidence — returns entries for the pipeline.</item>
  <item>Does not handle non-image assets — filters by image extensions only.</item>
</non_goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: extracted from extractor.ts to consolidate image walk + media reading behind a single seam.</item>
</CHANGE_SUMMARY>
*/
import { readPngDimensions } from "./sprite-pipeline.ts";
import type { EntitySpec } from "@roguelike-games-ib/extractor-sdk";

const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".bmp"];

const MIME_MAP: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
};

export interface ImageAssetEntry {
  path: string;
  fileName: string;
  slug: string;
  mimeType: string;
  width: number | null;
  height: number | null;
  altText: string | null;
}

export function collectImageAssets(
  source: { walk: (filter: (p: string) => boolean) => string[]; readBytes: (p: string) => Buffer },
): ImageAssetEntry[] {
  const imageFiles = source.walk((p) => {
    const ext = p.toLowerCase().match(/\.[^.]+$/)?.[0] ?? "";
    return IMAGE_EXTENSIONS.includes(ext);
  });

  return imageFiles.map((imgPath) => {
    const ext = imgPath.toLowerCase().match(/\.[^.]+$/)?.[0] ?? "";
    const mimeType = MIME_MAP[ext] ?? "application/octet-stream";
    let width: number | null = null;
    let height: number | null = null;
    if (ext === ".png") {
      const buf = source.readBytes(imgPath);
      const dims = readPngDimensions(buf);
      if (dims) {
        width = dims.width;
        height = dims.height;
      }
    }
    const fileName = imgPath.split("/").pop() ?? imgPath;
    const slug = imgPath.replace(/\.[^.]+$/, "").replace(/[/\s]+/g, "-").toLowerCase();

    return {
      path: imgPath,
      fileName,
      slug,
      mimeType,
      width,
      height,
      altText: `Image asset: ${fileName}`,
    };
  });
}

export function imageAssetSpec(entries: ImageAssetEntry[]): EntitySpec<ImageAssetEntry> {
  return {
    kind: "image_asset",
    nativeKind: "image",
    originActorId: "broguece-factual",
    entries,
    getSourcePath: (e: ImageAssetEntry) => e.path,
    getSymbolName: () => "",
    getSlug: (e: ImageAssetEntry) => e.slug,
    getNativeId: (e: ImageAssetEntry) => e.path,
    getCanonicalName: (e: ImageAssetEntry) => e.fileName,
    getOriginalName: (e: ImageAssetEntry) => e.fileName,
    getLineRange: () => ({ lineStart: 0, lineEnd: 0 }),
    getDataKey: (e: ImageAssetEntry) => e.path,
    getAttributes: (e: ImageAssetEntry) => ({
      mime_type: e.mimeType,
      width: e.width,
      height: e.height,
      alt_text: e.altText,
    }),
    populationDimension: "image_assets",
  };
}
