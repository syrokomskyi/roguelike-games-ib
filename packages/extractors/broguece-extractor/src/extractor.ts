/*
<MODULE_CONTRACT>
<purpose>BrogueCE factual extractor — parses C source files and emits creature, terrain, item, dungeon feature, light, mutation, monster class, status effect, monster behavior, monster ability, and image asset records with evidence anchors and population counts.</purpose>
<non-goals>
  <item>Does not parse JSON or YAML — BrogueCE source is C code only.</item>
  <item>Does not compute design-space relations — factual extraction only.</item>
</non_goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: BrogueCE extractor with monster, tile, and item table parsing.</item>
  <item>Added variant item tables (potion, scroll, wand, charm) from GlobalsBrogue.c.</item>
  <item>Added 7 new entity catalogs: dungeon features, lights, mutations, monster classes, status effects, monster behaviors, monster abilities.</item>
  <item>Extracted writeEntityRecord helper to deduplicate entity record creation.</item>
  <item>Deepened into Entity Pipeline + Sprite Pipeline: run() is now a declarative spec list, not a 390-line flat sequence.</item>
  <item>Replaced local makeRecordEnvelope with SDK createRecordEnvelope.</item>
  <item>Updated expected population counts: mutations 16→8, dungeon_features 58→145, lights 63→60 after parser entryPattern fixes.</item>
  <item>ADR-0005: extractor follows the 10-step onboarding process — source registered in registry.yaml, binding in bindings.yaml, kinds mapped to game-content-taxonomy.yaml, populations declared, conformance test present.</item>
</CHANGE_SUMMARY>
*/
import type {
  Extractor,
  ExtractorContext,
  ExtractorRunResult,
  ExtractorManifest,
} from "@roguelike-games-ib/extractor-sdk";
import {
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
import {
  buildGlyphIndexMap,
  createSpritePipeline,
  type SpritePipeline,
} from "./sprite-pipeline.ts";
import {
  collectImageAssets,
  imageAssetSpec,
} from "./image-asset-adapter.ts";
import { runEntityPipeline, PopulationCollector, type EntitySpec } from "@roguelike-games-ib/extractor-sdk";

const ROGUE_H = "src/brogue/Rogue.h";
const GLOBALS_C = "src/brogue/Globals.c";
const GLOBALS_BROGUE_C = "src/variants/GlobalsBrogue.c";


const manifest: ExtractorManifest = {
  schema: "werkstatt/knowledge-extractor@1",
  extractorId: "broguece-factual",
  extractorVersion: "1.0.0",
  sourceKinds: ["game_repository"],
  recordKinds: ["creature", "terrain", "item", "image_asset", "dungeon_feature", "light", "mutation", "monster_class", "status_effect", "monster_behavior", "monster_ability"],
  deterministic: true,
  parserMode: "static",
  exhaustivePopulations: [
    { dimension: "creatures", denominatorKind: "extractor_population", expected: 67, description: "All monsters in monsterCatalog (excluding MK_YOU and NUMBER_MONSTER_KINDS)" },
    { dimension: "terrain", denominatorKind: "extractor_population", expected: 214, description: "All tile types in tileCatalog" },
    { dimension: "items", denominatorKind: "extractor_population", expected: 97, description: "All items across weapon/armor/food/key/staff/ring/potion/scroll/wand/charm tables" },
    { dimension: "dungeon_features", denominatorKind: "extractor_population", expected: 145, description: "All unique tile types in dungeonFeatureCatalog" },
    { dimension: "lights", denominatorKind: "extractor_population", expected: 60, description: "All entries in lightCatalog" },
    { dimension: "mutations", denominatorKind: "extractor_population", expected: 8, description: "All entries in mutationCatalog" },
    { dimension: "monster_classes", denominatorKind: "extractor_population", expected: 15, description: "All entries in monsterClassCatalog" },
    { dimension: "status_effects", denominatorKind: "extractor_population", expected: 26, description: "All entries in statusEffectCatalog" },
    { dimension: "monster_behaviors", denominatorKind: "extractor_population", expected: 29, description: "All entries in monsterBehaviorCatalog" },
    { dimension: "monster_abilities", denominatorKind: "extractor_population", expected: 18, description: "All entries in monsterAbilityCatalog" },
  ],
};

// --- Entity spec builders ---

function creatureSpec(
  monsters: MonsterEntry[],
  sourcePath: string,
  sprite: SpritePipeline,
): EntitySpec<MonsterEntry> {
  return {
    kind: "creature",
    entries: monsters,
    adapter: {
      nativeKind: "monster",
      originActorId: "broguece-factual",
      getSourcePath: () => sourcePath,
      getSymbolName: () => "monsterCatalog",
      skip: (m) => m.name === "you",
      getSlug: (m) => m.nativeId,
      getNativeId: (m) => `creature:${m.nativeId}`,
      getCanonicalName: (m) => m.name,
      getOriginalName: (m) => m.name,
      getLineRange: (m) => ({ lineStart: m.lineStart, lineEnd: m.lineEnd }),
      getDataKey: (m) => m.nativeId,
      getAttributes: async (m) => ({
        glyph: m.glyph,
        tile_coords: sprite.getCoords(m.glyph),
        sprite_path: await sprite.extractSprite(m.glyph, m.nativeId),
        max_hp: m.maxHp,
        defense: m.defense,
        accuracy: m.accuracy,
        damage: m.damage,
        turns_between_regen: m.turnsBetweenRegen,
        movement_speed: m.movementSpeed,
        attack_speed: m.attackSpeed,
        is_large: m.isLarge,
        blood_type: m.bloodType,
        flags: m.flags,
        ability_flags: m.abilityFlags,
      }),
      populationDimension: "creatures",
    },
  };
}

function terrainSpec(
  tiles: TileEntry[],
  sourcePath: string,
  sprite: SpritePipeline,
): EntitySpec<TileEntry> {
  return {
    kind: "terrain",
    entries: tiles,
    adapter: {
      nativeKind: "tileType",
      originActorId: "broguece-factual",
      getSourcePath: () => sourcePath,
      getSymbolName: () => "tileCatalog",
      getSlug: (t) => t.nativeId.toLowerCase(),
      getNativeId: (t) => `terrain:${t.nativeId}`,
      getCanonicalName: (t) => t.description || t.nativeId,
      getOriginalName: (t) => t.nativeId,
      getLineRange: (t) => ({ lineStart: t.lineStart, lineEnd: t.lineEnd }),
      getDataKey: (t) => t.nativeId,
      getAttributes: async (t) => ({
        glyph: t.glyph,
        tile_coords: sprite.getCoords(t.glyph),
        sprite_path: await sprite.extractSprite(t.glyph, `terrain-${t.nativeId.toLowerCase()}`),
        draw_priority: t.drawPriority,
        flags: t.flags,
        mech_flags: t.mechFlags,
        flavor_text: t.flavorText,
      }),
      populationDimension: "terrain",
    },
  };
}

function itemSpec(
  items: ItemTableEntry[],
  tableName: string,
  arrayName: string,
  sourcePath: string,
  sprite: SpritePipeline,
): EntitySpec<ItemTableEntry> {
  return {
    kind: "item",
    entries: items,
    adapter: {
      nativeKind: tableName,
      originActorId: "broguece-factual",
      getSourcePath: () => sourcePath,
      getSymbolName: () => arrayName,
      getSlug: (item) => `${tableName}/${item.nativeId}`,
      getNativeId: (item) => `${tableName}:${item.nativeId}`,
      getCanonicalName: (item) => item.name,
      getOriginalName: (item) => item.name,
      getLineRange: (item) => ({ lineStart: item.lineStart, lineEnd: item.lineEnd }),
      getDataKey: (item) => `${tableName}:${item.nativeId}`,
      getAttributes: async (item) => ({
        glyph: item.glyph,
        tile_coords: sprite.getCoords(item.glyph),
        sprite_path: await sprite.extractSprite(item.glyph, `item-${tableName}-${item.nativeId}`),
        frequency: item.frequency,
        market_value: item.marketValue,
        strength_required: item.strengthRequired,
        power: item.power,
        damage_range: item.damageRange,
        description: item.description,
      }),
      populationDimension: "items",
    },
  };
}

function simpleSpec<E>(
  kind: string,
  nativeKind: string,
  entries: E[],
  sourcePath: string,
  symbolName: string,
  populationDimension: string,
  opts: {
    getSlug: (e: E) => string;
    getNativeId: (e: E) => string;
    getCanonicalName: (e: E) => string;
    getOriginalName: (e: E) => string;
    getAttributes: (e: E) => Record<string, unknown>;
    getLineRange: (e: E) => { lineStart: number; lineEnd: number };
    getDataKey: (e: E) => string;
  },
): EntitySpec<E> {
  return {
    kind,
    entries,
    adapter: {
      nativeKind,
      originActorId: "broguece-factual",
      getSourcePath: () => sourcePath,
      getSymbolName: () => symbolName,
      getSlug: opts.getSlug,
      getNativeId: opts.getNativeId,
      getCanonicalName: opts.getCanonicalName,
      getOriginalName: opts.getOriginalName,
      getLineRange: opts.getLineRange,
      getDataKey: opts.getDataKey,
      getAttributes: async (e) => opts.getAttributes(e),
      populationDimension,
    },
  };
}

export function createBrogueCEExtractor(): Extractor {
  return {
    manifest,
    async run(ctx: ExtractorContext): Promise<ExtractorRunResult> {
      const rogueH = ctx.source.readText(ROGUE_H);
      const globalsC = ctx.source.readText(GLOBALS_C);

      const glyphMap = buildGlyphIndexMap(rogueH);

      const TILES_PNG_PATH = "bin/assets/tiles.png";
      let tilesPngBuf: Buffer | null = null;
      try {
        tilesPngBuf = ctx.source.readBytes(TILES_PNG_PATH);
      } catch {
        // tiles.png not found — sprites will not be extracted
      }
      const SPRITE_DIR = `${process.cwd()}/knowledge/evidence/broguece/sprites`;
      const SPRITE_REL_PREFIX = "knowledge/evidence/broguece/sprites";

      const sprite = createSpritePipeline(glyphMap, tilesPngBuf, SPRITE_DIR, SPRITE_REL_PREFIX);

      // --- Parse all catalogs ---
      const monsters = parseMonsterCatalog(globalsC);
      const tiles = parseTileCatalog(globalsC);
      const dungeonFeatures = parseDungeonFeatureCatalog(globalsC);
      const lights = parseLightCatalog(globalsC);
      const mutations = parseMutationCatalog(globalsC);
      const monsterClasses = parseMonsterClassCatalog(globalsC);
      const statusEffects = parseStatusEffectCatalog(globalsC);
      const monsterBehaviors = parseMonsterBehaviorCatalog(globalsC);
      const monsterAbilities = parseMonsterAbilityCatalog(globalsC);

      // --- Build item specs (multiple tables share kind "item") ---
      const itemTables: Array<{ name: string; array: string; source: string }> = [
        { name: "weapon", array: "weaponTable", source: GLOBALS_C },
        { name: "armor", array: "armorTable", source: GLOBALS_C },
        { name: "food", array: "foodTable", source: GLOBALS_C },
        { name: "key", array: "keyTable", source: GLOBALS_C },
        { name: "staff", array: "staffTable", source: GLOBALS_C },
        { name: "ring", array: "ringTable", source: GLOBALS_C },
        { name: "potion", array: "potionTable_Brogue", source: GLOBALS_BROGUE_C },
        { name: "scroll", array: "scrollTable_Brogue", source: GLOBALS_BROGUE_C },
        { name: "wand", array: "wandTable_Brogue", source: GLOBALS_BROGUE_C },
        { name: "charm", array: "charmTable_Brogue", source: GLOBALS_BROGUE_C },
      ];

      const itemSpecs: EntitySpec<any>[] = [];
      for (const table of itemTables) {
        const tableSource = ctx.source.readText(table.source);
        const items = parseItemTable(tableSource, table.name, table.array);
        itemSpecs.push(itemSpec(items, table.name, table.array, table.source, sprite));
      }

      // --- Build all entity specs in order ---
      const specs: EntitySpec<any>[] = [
        creatureSpec(monsters, GLOBALS_C, sprite),
        terrainSpec(tiles, GLOBALS_C, sprite),
        ...itemSpecs,
        simpleSpec("dungeon_feature", "dungeonFeature", dungeonFeatures, GLOBALS_C, "dungeonFeatureCatalog", "dungeon_features", {
          getSlug: (df: DungeonFeatureEntry) => df.nativeId.toLowerCase(),
          getNativeId: (df: DungeonFeatureEntry) => `dungeonFeature:${df.nativeId}`,
          getCanonicalName: (df: DungeonFeatureEntry) => df.description,
          getOriginalName: (df: DungeonFeatureEntry) => df.nativeId,
          getAttributes: (df: DungeonFeatureEntry) => ({ layer: df.layer, start: df.start, decay: df.decay, flags: df.flags }),
          getLineRange: (df: DungeonFeatureEntry) => ({ lineStart: df.lineStart, lineEnd: df.lineEnd }),
          getDataKey: (df: DungeonFeatureEntry) => df.nativeId,
        }),
        simpleSpec("light", "lightSource", lights, GLOBALS_C, "lightCatalog", "lights", {
          getSlug: (l: LightEntry) => l.nativeId.toLowerCase(),
          getNativeId: (l: LightEntry) => `lightSource:${l.nativeId}`,
          getCanonicalName: (l: LightEntry) => l.description,
          getOriginalName: (l: LightEntry) => l.nativeId,
          getAttributes: (l: LightEntry) => ({ color: l.color, radius_min: l.radiusMin, radius_max: l.radiusMax, fade_percent: l.fadePercent, pass_through_creatures: l.passThroughCreatures }),
          getLineRange: (l: LightEntry) => ({ lineStart: l.lineStart, lineEnd: l.lineEnd }),
          getDataKey: (l: LightEntry) => l.nativeId,
        }),
        simpleSpec("mutation", "mutation", mutations, GLOBALS_C, "mutationCatalog", "mutations", {
          getSlug: (m: MutationEntry) => m.nativeId,
          getNativeId: (m: MutationEntry) => `mutation:${m.nativeId}`,
          getCanonicalName: (m: MutationEntry) => m.name,
          getOriginalName: (m: MutationEntry) => m.nativeId,
          getAttributes: (m: MutationEntry) => ({ health_factor: m.healthFactor, move_speed_mult: m.moveSpeedMult, attack_speed_mult: m.attackSpeedMult, defense_mult: m.defenseMult, damage_mult: m.damageMult, description: m.description, can_be_negated: m.canBeNegated }),
          getLineRange: (m: MutationEntry) => ({ lineStart: m.lineStart, lineEnd: m.lineEnd }),
          getDataKey: (m: MutationEntry) => m.nativeId,
        }),
        simpleSpec("monster_class", "monsterClass", monsterClasses, GLOBALS_C, "monsterClassCatalog", "monster_classes", {
          getSlug: (mc: MonsterClassEntry) => mc.nativeId,
          getNativeId: (mc: MonsterClassEntry) => `monsterClass:${mc.nativeId}`,
          getCanonicalName: (mc: MonsterClassEntry) => mc.name,
          getOriginalName: (mc: MonsterClassEntry) => mc.nativeId,
          getAttributes: (mc: MonsterClassEntry) => ({ frequency: mc.frequency, max_depth: mc.maxDepth, members: mc.members }),
          getLineRange: (mc: MonsterClassEntry) => ({ lineStart: mc.lineStart, lineEnd: mc.lineEnd }),
          getDataKey: (mc: MonsterClassEntry) => mc.nativeId,
        }),
        simpleSpec("status_effect", "statusEffect", statusEffects, GLOBALS_C, "statusEffectCatalog", "status_effects", {
          getSlug: (se: StatusEffectEntry) => se.nativeId.toLowerCase(),
          getNativeId: (se: StatusEffectEntry) => `statusEffect:${se.nativeId}`,
          getCanonicalName: (se: StatusEffectEntry) => se.name || se.nativeId,
          getOriginalName: (se: StatusEffectEntry) => se.nativeId,
          getAttributes: (se: StatusEffectEntry) => ({ is_buff: se.isBuff, display_in_sidebar: se.displayInSidebar }),
          getLineRange: (se: StatusEffectEntry) => ({ lineStart: se.lineStart, lineEnd: se.lineEnd }),
          getDataKey: (se: StatusEffectEntry) => se.nativeId,
        }),
        simpleSpec("monster_behavior", "monsterBehavior", monsterBehaviors, GLOBALS_C, "monsterBehaviorCatalog", "monster_behaviors", {
          getSlug: (mb: MonsterBehaviorEntry) => mb.nativeId.toLowerCase(),
          getNativeId: (mb: MonsterBehaviorEntry) => `monsterBehavior:${mb.nativeId}`,
          getCanonicalName: (mb: MonsterBehaviorEntry) => mb.description || mb.nativeId,
          getOriginalName: (mb: MonsterBehaviorEntry) => mb.nativeId,
          getAttributes: (mb: MonsterBehaviorEntry) => ({ description: mb.description, is_always_active: mb.isAlwaysActive }),
          getLineRange: (mb: MonsterBehaviorEntry) => ({ lineStart: mb.lineStart, lineEnd: mb.lineEnd }),
          getDataKey: (mb: MonsterBehaviorEntry) => mb.nativeId,
        }),
        simpleSpec("monster_ability", "monsterAbility", monsterAbilities, GLOBALS_C, "monsterAbilityCatalog", "monster_abilities", {
          getSlug: (ma: MonsterAbilityEntry) => ma.nativeId.toLowerCase(),
          getNativeId: (ma: MonsterAbilityEntry) => `monsterAbility:${ma.nativeId}`,
          getCanonicalName: (ma: MonsterAbilityEntry) => ma.description || ma.nativeId,
          getOriginalName: (ma: MonsterAbilityEntry) => ma.nativeId,
          getAttributes: (ma: MonsterAbilityEntry) => ({ description: ma.description, is_always_active: ma.isAlwaysActive }),
          getLineRange: (ma: MonsterAbilityEntry) => ({ lineStart: ma.lineStart, lineEnd: ma.lineEnd }),
          getDataKey: (ma: MonsterAbilityEntry) => ma.nativeId,
        }),
      ];

      // --- Collect image assets via adapter ---
      const imageEntries = collectImageAssets(ctx.source);
      if (imageEntries.length > 0) {
        specs.push(imageAssetSpec(imageEntries));
      }

      // --- Run entity pipeline ---
      const { dimensionCounts } = await runEntityPipeline(ctx, specs);

      // --- Populations (derived from manifest + image assets) ---
      const popCollector = new PopulationCollector(manifest.exhaustivePopulations ?? [], ctx.output);
      const { populationCounts, recordCount } = popCollector.collect(dimensionCounts, [
        { dimension: "image_assets", expected: imageEntries.length, extracted: dimensionCounts.get("image_assets") ?? 0 },
      ]);

      return {
        extractorId: manifest.extractorId,
        extractorVersion: "1.0.0",
        runId: "broguece-run",
        recordCount,
        populationCounts,
        diagnostics: [],
      };
    },
  };
}

export { manifest as brogueceManifest };
