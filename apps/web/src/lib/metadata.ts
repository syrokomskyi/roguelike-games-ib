import type { WebContext } from "./context.ts";

export interface PageMetadata {
  canonicalHash: string;
  datasetId: string;
  datasetVersion: string;
  modelVersion: string;
  license: string;
  authority: "canonical" | "laboratory";
}

export function getPageMetadata(ctx: WebContext, authority: "canonical" | "laboratory" = "canonical"): PageMetadata {
  return {
    canonicalHash: ctx.canonicalHash,
    datasetId: ctx.datasetId,
    datasetVersion: ctx.datasetVersion,
    modelVersion: ctx.modelVersion,
    license: ctx.license,
    authority,
  };
}

export function metadataToHtmlMeta(meta: PageMetadata): string {
  return [
    `<meta name="x-ib-canonical-hash" content="${meta.canonicalHash}" />`,
    `<meta name="x-ib-dataset-id" content="${meta.datasetId}" />`,
    `<meta name="x-ib-dataset-version" content="${meta.datasetVersion}" />`,
    `<meta name="x-ib-model-version" content="${meta.modelVersion}" />`,
    `<meta name="x-ib-license" content="${meta.license}" />`,
    `<meta name="x-ib-authority" content="${meta.authority}" />`,
  ].join("\n");
}
