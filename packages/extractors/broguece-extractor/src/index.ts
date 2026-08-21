/*
<MODULE_CONTRACT>
<purpose>Barrel export for the BrogueCE extractor — extractor factory, manifest, and C-parser functions with types.</purpose>
<non-goals>
  <item>Does not implement parsing logic — re-exports from extractor and c-parser modules.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: BrogueCE extractor barrel exporting factory, manifest, parsers, and types.</item>
</CHANGE_SUMMARY>
*/
export { createBrogueCEExtractor, brogueceManifest } from "./extractor.ts";
export {
  parseEnum,
  parseMonsterCatalog,
  parseTileCatalog,
  parseItemTable,
  type EnumEntry,
  type MonsterEntry,
  type TileEntry,
  type ItemTableEntry,
} from "./c-parser.ts";
