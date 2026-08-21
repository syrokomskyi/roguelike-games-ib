/*
<MODULE_CONTRACT>
<purpose>Barrel export for the Cataclysm-BN extractor — extractor factory, manifest, and JSON parser functions with types.</purpose>
<non-goals>
  <item>Does not implement parsing logic — re-exports from extractor and json-parser modules.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: Cataclysm-BN extractor barrel exporting factory, manifest, parsers, and types.</item>
</CHANGE_SUMMARY>
*/
export { createCataclysmBNExtractor, cataclysmBnManifest } from "./extractor.ts";
export {
  parseMonsterJson,
  parseItemJson,
  parseMutationJson,
  parseProfessionJson,
  type MonsterEntry,
  type ItemEntry,
  type MutationEntry,
  type ProfessionEntry,
} from "./json-parser.ts";
