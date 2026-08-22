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
</CHANGE_SUMMARY>
*/
import type {
  Extractor,
  ExtractorContext,
  ExtractorRunResult,
  ExtractorManifest,
} from "@roguelike-games-ib/extractor-sdk";
import { createRecordEnvelope } from "@roguelike-games-ib/extractor-sdk";
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
  readPngDimensions,
  type SpritePipeline,
} from "./sprite-pipeline.ts";
import { runEntityPipeline, type EntitySpec } from "./entity-pipeline.ts";
import { join } from "node:path";

const ROGUE_H = "src/brogue/Rogue.h";
const GLOBALS_C = "src/brogue/Globals.c";
const GLOBALS_BROGUE_C = "src/variants/GlobalsBrogue.c";
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

function readImageMedia(
  source: { readBytes: (path: string) => Buffer },
  relativePath: string,
): { mime_type: string; width: number | null; height: number | null; alt_text: string | null } {
  const ext = relativePath.toLowerCase().match(/\.[^.]+$/)?.[0] ?? "";
  const mime_type = MIME_MAP[ext] ?? "application/octet-stream";
  let width: number | null = null;
  let height: number | null = null;
  if (ext === ".png") {
    const buf = source.readBytes(relativePath);
    const dims = readPngDimensions(buf);
    if (dims) {
      width = dims.width;
      height = dims.height;
    }
  }
  const fileName = relativePath.split("/").pop() ?? relativePath;
  return { mime_type, width, height, alt_text: `Image asset: ${fileName}` };
}

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
    { dimension: "dungeon_features", denominatorKind: "extractor_population", expected: 58, description: "All entries in dungeonFeatureCatalog" },
    { dimension: "lights", denominatorKind: "extractor_population", expected: 63, description: "All entries in lightCatalog" },
    { dimension: "mutations", denominatorKind: "extractor_population", expected: 16, description: "All entries in mutationCatalog" },
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
    nativeKind: "monster",
    sourcePath,
    symbolName: "monsterCatalog",
    entries: monsters,
    skip: (m) => m.name === "you",
    getSlug: (m) => m.nativeId,
    getNativeId: (m) => m.nativeId,
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
  };
}

function terrainSpec(
  tiles: TileEntry[],
  sourcePath: string,
  sprite: SpritePipeline,
): EntitySpec<TileEntry> {
  return {
    kind: "terrain",
    nativeKind: "tileType",
    sourcePath,
    symbolName: "tileCatalog",
    entries: tiles,
    getSlug: (t) => t.nativeId.toLowerCase(),
    getNativeId: (t) => t.nativeId,
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
    nativeKind: tableName,
    sourcePath,
    symbolName: arrayName,
    entries: items,
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
  };
}

function simpleSpec<E>(
  kind: string,
  nativeKind: string,
  entries: E[],
  sourcePath: string,
  symbolName: string,
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
    nativeKind,
    sourcePath,
    symbolName,
    entries,
    getSlug: opts.getSlug,
    getNativeId: opts.getNativeId,
    getCanonicalName: opts.getCanonicalName,
    getOriginalName: opts.getOriginalName,
    getLineRange: opts.getLineRange,
    getDataKey: opts.getDataKey,
    getAttributes: async (e) => opts.getAttributes(e),
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
      const SPRITE_DIR = join(process.cwd(), "knowledge/evidence/broguece/sprites");
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
        simpleSpec("dungeon_feature", "dungeonFeature", dungeonFeatures, GLOBALS_C, "dungeonFeatureCatalog", {
          getSlug: (df: DungeonFeatureEntry) => df.nativeId.toLowerCase(),
          getNativeId: (df: DungeonFeatureEntry) => `dungeonFeature:${df.nativeId}`,
          getCanonicalName: (df: DungeonFeatureEntry) => df.description,
          getOriginalName: (df: DungeonFeatureEntry) => df.nativeId,
          getAttributes: (df: DungeonFeatureEntry) => ({ layer: df.layer, start: df.start, decay: df.decay, flags: df.flags }),
          getLineRange: (df: DungeonFeatureEntry) => ({ lineStart: df.lineStart, lineEnd: df.lineEnd }),
          getDataKey: (df: DungeonFeatureEntry) => df.nativeId,
        }),
        simpleSpec("light", "lightSource", lights, GLOBALS_C, "lightCatalog", {
          getSlug: (l: LightEntry) => l.nativeId.toLowerCase(),
          getNativeId: (l: LightEntry) => `lightSource:${l.nativeId}`,
          getCanonicalName: (l: LightEntry) => l.description,
          getOriginalName: (l: LightEntry) => l.nativeId,
          getAttributes: (l: LightEntry) => ({ color: l.color, radius_min: l.radiusMin, radius_max: l.radiusMax, fade_percent: l.fadePercent, pass_through_creatures: l.passThroughCreatures }),
          getLineRange: (l: LightEntry) => ({ lineStart: l.lineStart, lineEnd: l.lineEnd }),
          getDataKey: (l: LightEntry) => l.nativeId,
        }),
        simpleSpec("mutation", "mutation", mutations, GLOBALS_C, "mutationCatalog", {
          getSlug: (m: MutationEntry) => m.nativeId,
          getNativeId: (m: MutationEntry) => `mutation:${m.nativeId}`,
          getCanonicalName: (m: MutationEntry) => m.name,
          getOriginalName: (m: MutationEntry) => m.nativeId,
          getAttributes: (m: MutationEntry) => ({ health_factor: m.healthFactor, move_speed_mult: m.moveSpeedMult, attack_speed_mult: m.attackSpeedMult, defense_mult: m.defenseMult, damage_mult: m.damageMult, description: m.description, can_be_negated: m.canBeNegated }),
          getLineRange: (m: MutationEntry) => ({ lineStart: m.lineStart, lineEnd: m.lineEnd }),
          getDataKey: (m: MutationEntry) => m.nativeId,
        }),
        simpleSpec("monster_class", "monsterClass", monsterClasses, GLOBALS_C, "monsterClassCatalog", {
          getSlug: (mc: MonsterClassEntry) => mc.nativeId,
          getNativeId: (mc: MonsterClassEntry) => `monsterClass:${mc.nativeId}`,
          getCanonicalName: (mc: MonsterClassEntry) => mc.name,
          getOriginalName: (mc: MonsterClassEntry) => mc.nativeId,
          getAttributes: (mc: MonsterClassEntry) => ({ frequency: mc.frequency, max_depth: mc.maxDepth, members: mc.members }),
          getLineRange: (mc: MonsterClassEntry) => ({ lineStart: mc.lineStart, lineEnd: mc.lineEnd }),
          getDataKey: (mc: MonsterClassEntry) => mc.nativeId,
        }),
        simpleSpec("status_effect", "statusEffect", statusEffects, GLOBALS_C, "statusEffectCatalog", {
          getSlug: (se: StatusEffectEntry) => se.nativeId.toLowerCase(),
          getNativeId: (se: StatusEffectEntry) => `statusEffect:${se.nativeId}`,
          getCanonicalName: (se: StatusEffectEntry) => se.name || se.nativeId,
          getOriginalName: (se: StatusEffectEntry) => se.nativeId,
          getAttributes: (se: StatusEffectEntry) => ({ is_buff: se.isBuff, display_in_sidebar: se.displayInSidebar }),
          getLineRange: (se: StatusEffectEntry) => ({ lineStart: se.lineStart, lineEnd: se.lineEnd }),
          getDataKey: (se: StatusEffectEntry) => se.nativeId,
        }),
        simpleSpec("monster_behavior", "monsterBehavior", monsterBehaviors, GLOBALS_C, "monsterBehaviorCatalog", {
          getSlug: (mb: MonsterBehaviorEntry) => mb.nativeId.toLowerCase(),
          getNativeId: (mb: MonsterBehaviorEntry) => `monsterBehavior:${mb.nativeId}`,
          getCanonicalName: (mb: MonsterBehaviorEntry) => mb.description || mb.nativeId,
          getOriginalName: (mb: MonsterBehaviorEntry) => mb.nativeId,
          getAttributes: (mb: MonsterBehaviorEntry) => ({ description: mb.description, is_always_active: mb.isAlwaysActive }),
          getLineRange: (mb: MonsterBehaviorEntry) => ({ lineStart: mb.lineStart, lineEnd: mb.lineEnd }),
          getDataKey: (mb: MonsterBehaviorEntry) => mb.nativeId,
        }),
        simpleSpec("monster_ability", "monsterAbility", monsterAbilities, GLOBALS_C, "monsterAbilityCatalog", {
          getSlug: (ma: MonsterAbilityEntry) => ma.nativeId.toLowerCase(),
          getNativeId: (ma: MonsterAbilityEntry) => `monsterAbility:${ma.nativeId}`,
          getCanonicalName: (ma: MonsterAbilityEntry) => ma.description || ma.nativeId,
          getOriginalName: (ma: MonsterAbilityEntry) => ma.nativeId,
          getAttributes: (ma: MonsterAbilityEntry) => ({ description: ma.description, is_always_active: ma.isAlwaysActive }),
          getLineRange: (ma: MonsterAbilityEntry) => ({ lineStart: ma.lineStart, lineEnd: ma.lineEnd }),
          getDataKey: (ma: MonsterAbilityEntry) => ma.nativeId,
        }),
      ];

      // --- Run entity pipeline ---
      const { counts } = await runEntityPipeline(ctx, specs, sprite);

      // Spec indices: 0=creature, 1=terrain, 2..11=item tables, 12=dungeon_feature, 13=light, 14=mutation, 15=monster_class, 16=status_effect, 17=monster_behavior, 18=monster_ability
      const creatureCount = counts[0] ?? 0;
      const terrainCount = counts[1] ?? 0;
      const itemCount = itemSpecs.reduce((sum, _, i) => sum + (counts[2 + i] ?? 0), 0);
      const itemStartIdx = 2;
      const simpleStartIdx = itemStartIdx + itemSpecs.length;
      const dungeonFeatureCount = counts[simpleStartIdx] ?? 0;
      const lightCount = counts[simpleStartIdx + 1] ?? 0;
      const mutationCount = counts[simpleStartIdx + 2] ?? 0;
      const monsterClassCount = counts[simpleStartIdx + 3] ?? 0;
      const statusEffectCount = counts[simpleStartIdx + 4] ?? 0;
      const monsterBehaviorCount = counts[simpleStartIdx + 5] ?? 0;
      const monsterAbilityCount = counts[simpleStartIdx + 6] ?? 0;

      // --- Image assets (separate flow — walks the source tree, not a catalog) ---
      let imageAssetCount = 0;
      const imageFiles = ctx.source.walk((p) => {
        const ext = p.toLowerCase().match(/\.[^.]+$/)?.[0] ?? "";
        return IMAGE_EXTENSIONS.includes(ext);
      });
      for (const imgPath of imageFiles) {
        const fileName = imgPath.split("/").pop() ?? imgPath;
        const slug = imgPath.replace(/\.[^.]+$/, "").replace(/[/\s]+/g, "-").toLowerCase();
        const resolved = ctx.ids.resolveOrCreate("image_asset", slug, imgPath);
        const envelope = createRecordEnvelope(
          ctx.binding.source_id,
          resolved.key,
          resolved.id,
          "broguece-factual",
        );

        const media = readImageMedia(ctx.source, imgPath);

        const record = {
          ...envelope,
          kind: "image_asset",
          native_kind: "image",
          name: { canonical: fileName, original: fileName },
          source_identity: {
            source_id: ctx.binding.source_id,
            native_id: imgPath,
            path: imgPath,
          },
          activation: "active" as const,
          attributes: {
            mime_type: media.mime_type,
            width: media.width,
            height: media.height,
          },
          evidence_refs: [] as string[],
        };

        ctx.output.writeRecord(record);

        const evidence = ctx.evidence.create({
          artifactPath: imgPath,
          evidenceKind: "asset",
          media,
          locator: {
            symbol: null,
            line_start: null,
            line_end: null,
            byte_start: null,
            byte_end: null,
            data_key: imgPath,
          },
        });
        ctx.output.writeEvidence(resolved.id, evidence);
        imageAssetCount++;
      }

      // --- Populations ---
      ctx.output.writePopulation("creatures", 67, creatureCount);
      ctx.output.writePopulation("terrain", 214, terrainCount);
      ctx.output.writePopulation("items", 97, itemCount);
      ctx.output.writePopulation("image_assets", imageFiles.length, imageAssetCount);
      ctx.output.writePopulation("dungeon_features", 58, dungeonFeatureCount);
      ctx.output.writePopulation("lights", 63, lightCount);
      ctx.output.writePopulation("mutations", 16, mutationCount);
      ctx.output.writePopulation("monster_classes", 15, monsterClassCount);
      ctx.output.writePopulation("status_effects", 26, statusEffectCount);
      ctx.output.writePopulation("monster_behaviors", 29, monsterBehaviorCount);
      ctx.output.writePopulation("monster_abilities", 18, monsterAbilityCount);

      const recordCount = creatureCount + terrainCount + itemCount + imageAssetCount
        + dungeonFeatureCount + lightCount + mutationCount + monsterClassCount
        + statusEffectCount + monsterBehaviorCount + monsterAbilityCount;

      return {
        extractorId: manifest.extractorId,
        extractorVersion: "1.0.0",
        runId: "broguece-run",
        recordCount,
        populationCounts: [
          { dimension: "creatures", expected: 67, extracted: creatureCount },
          { dimension: "terrain", expected: 214, extracted: terrainCount },
          { dimension: "items", expected: 97, extracted: itemCount },
          { dimension: "image_assets", expected: imageFiles.length, extracted: imageAssetCount },
          { dimension: "dungeon_features", expected: 58, extracted: dungeonFeatureCount },
          { dimension: "lights", expected: 63, extracted: lightCount },
          { dimension: "mutations", expected: 16, extracted: mutationCount },
          { dimension: "monster_classes", expected: 15, extracted: monsterClassCount },
          { dimension: "status_effects", expected: 26, extracted: statusEffectCount },
          { dimension: "monster_behaviors", expected: 29, extracted: monsterBehaviorCount },
          { dimension: "monster_abilities", expected: 18, extracted: monsterAbilityCount },
        ],
        diagnostics: [],
      };
    },
  };
}

export { manifest as brogueceManifest };
