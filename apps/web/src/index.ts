export { createWebContext, type WebContext } from "./lib/context.ts";
export { verifyMaterialization, assertMaterialization, type VerificationResult } from "./lib/verify.ts";
export { resolveRecordRoute, type ResolvedRecord } from "./lib/resolve.ts";
export { renderEvidence, evidenceForRecord, DEFAULT_EXCERPT_LIMIT, type RenderedEvidence } from "./lib/evidence.ts";
export { getPageMetadata, metadataToHtmlMeta, type PageMetadata } from "./lib/metadata.ts";
export { authorityBadge, isNonAuthoritative, type Authority, type AuthorityBadgeData } from "./lib/authority.ts";
export { prepareWebBuild, type WebBuildOptions } from "./lib/build.ts";
