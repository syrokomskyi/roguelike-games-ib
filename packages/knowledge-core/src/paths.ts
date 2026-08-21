/*
<MODULE_CONTRACT>
<purpose>Re-exports config and path resolution functions for backward compatibility with the knowledge-core package.</purpose>
<non-goals>
  <item>Does not implement config logic — delegates to config.ts.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: paths barrel re-exporting config functions and types.</item>
</CHANGE_SUMMARY>
*/
export {
  readKnowledgeConfig,
  readKnowledgeManifest,
  resolveKnowledgePaths,
  resolveSourceRoot,
} from "./config.ts";
export type { KnowledgeConfig, KnowledgeManifest } from "./config.ts";
