/*
<MODULE_CONTRACT>
<purpose>Barrel export for the web application library — context, verification, record resolution, evidence rendering, metadata, authority, and build preparation.</purpose>
<non-goals>
  <item>Does not implement business logic — re-exports from submodules.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: web barrel exporting all public types and functions.</item>
</CHANGE_SUMMARY>
*/
export { createWebContext, type WebContext } from "./lib/context.ts";
export { verifyMaterialization, assertMaterialization, type VerificationResult } from "./lib/verify.ts";
export { resolveRecordRoute, type ResolvedRecord } from "./lib/resolve.ts";
export { renderEvidence, evidenceForRecord, DEFAULT_EXCERPT_LIMIT, type RenderedEvidence } from "./lib/evidence.ts";
export { getPageMetadata, metadataToHtmlMeta, type PageMetadata } from "./lib/metadata.ts";
export { authorityBadge, isNonAuthoritative, type Authority, type AuthorityBadgeData } from "./lib/authority.ts";
export { prepareWebBuild, type WebBuildOptions } from "./lib/build.ts";
