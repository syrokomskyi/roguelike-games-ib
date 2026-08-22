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
  parseDungeonFeatureCatalog,
  parseLightCatalog,
  parseMutationCatalog,
  parseMonsterClassCatalog,
  parseStatusEffectCatalog,
  parseMonsterBehaviorCatalog,
  parseMonsterAbilityCatalog,
  type EnumEntry,
  type MonsterEntry,
  type TileEntry,
  type ItemTableEntry,
  type DungeonFeatureEntry,
  type LightEntry,
  type MutationEntry,
  type MonsterClassEntry,
  type StatusEffectEntry,
  type MonsterBehaviorEntry,
  type MonsterAbilityEntry,
} from "./c-parser.ts";
export {
  buildGlyphIndexMap,
  glyphToTileCoords,
  readPngDimensions,
  createSpritePipeline,
  type SpritePipeline,
} from "./sprite-pipeline.ts";
export { runEntityPipeline, type EntitySpec } from "./entity-pipeline.ts";
