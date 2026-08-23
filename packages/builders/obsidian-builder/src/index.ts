/*
<MODULE_CONTRACT>
<purpose>Barrel export for obsidian-builder — build, paths, frontmatter, rendering, MOC, links, and manifest modules.</purpose>
<non-goals>
  <item>Does not implement business logic — re-exports from submodules.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: obsidian-builder barrel exporting all public types and functions.</item>
</CHANGE_SUMMARY>
*/
export { buildObsidianVault } from "./build.ts";
export type { ObsidianBuildOptions, ObsidianBuildResult } from "./build.ts";
export { buildPathResolver, resolvePathById, resolvePathByKey, resolvePathByAlias } from "./paths.ts";
export type { PathResolver } from "./paths.ts";
export { createFrontmatter, serializeFrontmatter, parseFrontmatter } from "./frontmatter.ts";
export type { NoteFrontmatter } from "./frontmatter.ts";
export { renderRecordNote } from "./render-record.ts";
export { renderSourceNote } from "./render-source.ts";
export { renderMoc, MOC_FILENAME, MOC_TITLE } from "./moc.ts";
export { makeWikiLink, resolveLink, validateAllLinks, wikiLinkToPath } from "./links.ts";
export type { LinkValidationResult } from "./links.ts";
export { createBuildManifest, writeBuildManifest } from "./build-manifest.ts";
export type { ObsidianBuildManifest } from "./build-manifest.ts";
export { generateComparisonNotes } from "./report.ts";
