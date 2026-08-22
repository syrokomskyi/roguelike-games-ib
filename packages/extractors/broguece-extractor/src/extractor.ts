/*
<MODULE_CONTRACT>
<purpose>BrogueCE factual extractor — parses C source files and emits creature, terrain, item, dungeon feature, light, mutation, monster class, status effect, monster behavior, monster ability, and image asset records with evidence anchors and population counts.</purpose>
<non-goals>
  <item>Does not parse JSON or YAML — BrogueCE source is C code only.</item>
  <item>Does not compute design-space relations — factual extraction only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: BrogueCE extractor with monster, tile, and item table parsing.</item>
  <item>Added variant item tables (potion, scroll, wand, charm) from GlobalsBrogue.c.</item>
  <item>Added 7 new entity catalogs: dungeon features, lights, mutations, monster classes, status effects, monster behaviors, monster abilities.</item>
  <item>Extracted writeEntityRecord helper to deduplicate entity record creation.</item>
</CHANGE_SUMMARY>
*/
import type {
  Extractor,
  ExtractorContext,
  ExtractorRunResult,
  ExtractorManifest,
} from "@roguelike-games-ib/extractor-sdk";
import {
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
import sharp from "sharp";
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

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

function readPngDimensions(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 24) return null;
  if (buf[0] !== 0x89 || buf[1] !== 0x50 || buf[2] !== 0x4e || buf[3] !== 0x47) return null;
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  return { width, height };
}

const TILE_WIDTH = 128;
const TILE_HEIGHT = 232;
const TILE_COLS = 16;
const GLYPH_BASE = 128;

function buildGlyphIndexMap(rogueH: string): Map<string, number> {
  const map = new Map<string, number>();
  const enumMatch = rogueH.match(/enum\s+displayGlyph\s*\{([^}]+)\}/);
  if (!enumMatch) return map;
  const entries = enumMatch[1].split(",");
  let currentVal = GLYPH_BASE;
  for (const entry of entries) {
    const trimmed = entry.trim();
    if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("/*")) continue;
    const nameMatch = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)/);
    if (nameMatch) {
      const eqMatch = trimmed.match(/=\s*(\d+)/);
      if (eqMatch) currentVal = parseInt(eqMatch[1], 10);
      map.set(nameMatch[1], currentVal);
      currentVal++;
    }
  }
  return map;
}

function glyphToTileCoords(glyph: string | null, glyphMap: Map<string, number>): { x: number; y: number; w: number; h: number } | null {
  if (!glyph) return null;
  const val = glyphMap.get(glyph);
  if (val == null) return null;
  // BrogueCE fontIndex(): tile sprites start at 256, so tileIndex = glyph + 128 - 2 = glyph + 126
  // (subtract 2 for G_UP_ARROW/G_DOWN_ARROW which are font glyphs, not tile sprites)
  const tileIndex = val + 126;
  const row = Math.floor(tileIndex / TILE_COLS);
  const col = tileIndex % TILE_COLS;
  return { x: col * TILE_WIDTH, y: row * TILE_HEIGHT, w: TILE_WIDTH, h: TILE_HEIGHT };
}

async function extractSprite(
  glyph: string | null,
  glyphMap: Map<string, number>,
  tilesPngBuf: Buffer | null,
  outDir: string,
  relPrefix: string,
  creatureSlug: string,
): Promise<string | null> {
  if (!glyph || !tilesPngBuf) return null;
  const coords = glyphToTileCoords(glyph, glyphMap);
  if (!coords) return null;

  const fileName = `${creatureSlug}.png`;
  const outPath = join(outDir, fileName);
  const relPath = `${relPrefix}/${fileName}`;

  mkdirSync(outDir, { recursive: true });
  await sharp(tilesPngBuf)
    .extract({ left: coords.x, top: coords.y, width: coords.w, height: coords.h })
    .toFile(outPath);

  return relPath;
}

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
    {
      dimension: "creatures",
      denominatorKind: "extractor_population",
      expected: 67,
      description: "All monsters in monsterCatalog (excluding MK_YOU and NUMBER_MONSTER_KINDS)",
    },
    {
      dimension: "terrain",
      denominatorKind: "extractor_population",
      expected: 214,
      description: "All tile types in tileCatalog",
    },
    {
      dimension: "items",
      denominatorKind: "extractor_population",
      expected: 97,
      description: "All items across weapon/armor/food/key/staff/ring/potion/scroll/wand/charm tables",
    },
    {
      dimension: "dungeon_features",
      denominatorKind: "extractor_population",
      expected: 58,
      description: "All entries in dungeonFeatureCatalog",
    },
    {
      dimension: "lights",
      denominatorKind: "extractor_population",
      expected: 63,
      description: "All entries in lightCatalog",
    },
    {
      dimension: "mutations",
      denominatorKind: "extractor_population",
      expected: 16,
      description: "All entries in mutationCatalog",
    },
    {
      dimension: "monster_classes",
      denominatorKind: "extractor_population",
      expected: 15,
      description: "All entries in monsterClassCatalog",
    },
    {
      dimension: "status_effects",
      denominatorKind: "extractor_population",
      expected: 26,
      description: "All entries in statusEffectCatalog",
    },
    {
      dimension: "monster_behaviors",
      denominatorKind: "extractor_population",
      expected: 29,
      description: "All entries in monsterBehaviorCatalog",
    },
    {
      dimension: "monster_abilities",
      denominatorKind: "extractor_population",
      expected: 18,
      description: "All entries in monsterAbilityCatalog",
    },
  ],
};

function makeRecordEnvelope(
  sourceId: string,
  recordType: string,
  key: string,
  id: string,
  originActorId: string,
) {
  return {
    schema: "rgkb/game-definition@2",
    id,
    key,
    record_type: "definition",
    language: "en",
    scope: {
      source_id: sourceId,
      scope_kind: "source" as const,
    },
    origin: {
      kind: "extractor" as const,
      actor_id: originActorId,
      run_id: null,
    },
    epistemic: {
      status: "observed" as const,
      confidence: "verified" as const,
    },
    aliases: [] as string[],
  };
}

interface EntityWriteParams {
  ctx: ExtractorContext;
  kind: string;
  nativeKind: string;
  slug: string;
  nativeIdPrefixed: string;
  canonicalName: string;
  originalName: string;
  sourcePath: string;
  symbolName: string;
  attributes: Record<string, unknown>;
  lineStart: number;
  lineEnd: number;
  dataKey: string;
}

function writeEntityRecord(params: EntityWriteParams): void {
  const { ctx, kind, nativeKind, slug, nativeIdPrefixed, canonicalName, originalName, sourcePath, symbolName, attributes, lineStart, lineEnd, dataKey } = params;
  const resolved = ctx.ids.resolveOrCreate(kind as never, slug, nativeIdPrefixed);
  const envelope = makeRecordEnvelope(ctx.binding.source_id, kind, resolved.key, resolved.id, "broguece-factual");
  const record = {
    ...envelope,
    kind,
    native_kind: nativeKind,
    name: { canonical: canonicalName, original: originalName },
    source_identity: { source_id: ctx.binding.source_id, native_id: nativeIdPrefixed, path: sourcePath },
    activation: "active" as const,
    attributes,
    evidence_refs: [] as string[],
  };
  ctx.output.writeRecord(record);
  const evidence = ctx.evidence.create({
    artifactPath: sourcePath,
    locator: { symbol: symbolName, line_start: lineStart, line_end: lineEnd, byte_start: null, byte_end: null, data_key: dataKey },
    fragmentLines: { lineStart, lineEnd },
  });
  ctx.output.writeEvidence(resolved.id, evidence);
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

      let creatureCount = 0;
      let terrainCount = 0;
      let itemCount = 0;

      const monsters = parseMonsterCatalog(globalsC);
      for (const m of monsters) {
        if (m.name === "you") continue;
        const slug = m.nativeId;
        const resolved = ctx.ids.resolveOrCreate("creature", slug, m.nativeId);
        const envelope = makeRecordEnvelope(
          ctx.binding.source_id,
          "creature",
          resolved.key,
          resolved.id,
          "broguece-factual",
        );

        const record = {
          ...envelope,
          kind: "creature",
          native_kind: "monster",
          name: { canonical: m.name, original: m.name },
          source_identity: {
            source_id: ctx.binding.source_id,
            native_id: m.nativeId,
            path: GLOBALS_C,
          },
          activation: "active" as const,
          attributes: {
            glyph: m.glyph,
            tile_coords: glyphToTileCoords(m.glyph, glyphMap),
            sprite_path: await extractSprite(m.glyph, glyphMap, tilesPngBuf, SPRITE_DIR, SPRITE_REL_PREFIX, m.nativeId),
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
          },
          evidence_refs: [] as string[],
        };

        ctx.output.writeRecord(record);

        const evidence = ctx.evidence.create({
          artifactPath: GLOBALS_C,
          locator: {
            symbol: "monsterCatalog",
            line_start: m.lineStart,
            line_end: m.lineEnd,
            byte_start: null,
            byte_end: null,
            data_key: m.nativeId,
          },
          fragmentLines: { lineStart: m.lineStart, lineEnd: m.lineEnd },
        });
        ctx.output.writeEvidence(resolved.id, evidence);
        creatureCount++;
      }

      const tiles = parseTileCatalog(globalsC);
      for (const t of tiles) {
        const slug = t.nativeId.toLowerCase();
        const resolved = ctx.ids.resolveOrCreate("terrain", slug, t.nativeId);
        const envelope = makeRecordEnvelope(
          ctx.binding.source_id,
          "terrain",
          resolved.key,
          resolved.id,
          "broguece-factual",
        );

        const record = {
          ...envelope,
          kind: "terrain",
          native_kind: "tileType",
          name: { canonical: t.description || t.nativeId, original: t.nativeId },
          source_identity: {
            source_id: ctx.binding.source_id,
            native_id: t.nativeId,
            path: GLOBALS_C,
          },
          activation: "active" as const,
          attributes: {
            glyph: t.glyph,
            tile_coords: glyphToTileCoords(t.glyph, glyphMap),
            sprite_path: await extractSprite(t.glyph, glyphMap, tilesPngBuf, SPRITE_DIR, SPRITE_REL_PREFIX, `terrain-${t.nativeId.toLowerCase()}`),
            draw_priority: t.drawPriority,
            flags: t.flags,
            mech_flags: t.mechFlags,
            flavor_text: t.flavorText,
          },
          evidence_refs: [] as string[],
        };

        ctx.output.writeRecord(record);

        const evidence = ctx.evidence.create({
          artifactPath: GLOBALS_C,
          locator: {
            symbol: "tileCatalog",
            line_start: t.lineStart,
            line_end: t.lineEnd,
            byte_start: null,
            byte_end: null,
            data_key: t.nativeId,
          },
          fragmentLines: { lineStart: t.lineStart, lineEnd: t.lineEnd },
        });
        ctx.output.writeEvidence(resolved.id, evidence);
        terrainCount++;
      }

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

      for (const table of itemTables) {
        const tableSource = ctx.source.readText(table.source);
        const items = parseItemTable(tableSource, table.name, table.array);
        for (const item of items) {
          const slug = `${table.name}/${item.nativeId}`;
          const resolved = ctx.ids.resolveOrCreate("item", slug, `${table.name}:${item.nativeId}`);
          const envelope = makeRecordEnvelope(
            ctx.binding.source_id,
            "item",
            resolved.key,
            resolved.id,
            "broguece-factual",
          );

          const record = {
            ...envelope,
            kind: "item",
            native_kind: table.name,
            name: { canonical: item.name, original: item.name },
            source_identity: {
              source_id: ctx.binding.source_id,
              native_id: `${table.name}:${item.nativeId}`,
              path: table.source,
            },
            activation: "active" as const,
            attributes: {
              glyph: item.glyph,
              tile_coords: glyphToTileCoords(item.glyph, glyphMap),
              sprite_path: await extractSprite(item.glyph, glyphMap, tilesPngBuf, SPRITE_DIR, SPRITE_REL_PREFIX, `item-${table.name}-${item.nativeId}`),
              frequency: item.frequency,
              market_value: item.marketValue,
              strength_required: item.strengthRequired,
              power: item.power,
              damage_range: item.damageRange,
              description: item.description,
            },
            evidence_refs: [] as string[],
          };

          ctx.output.writeRecord(record);

          const evidence = ctx.evidence.create({
            artifactPath: table.source,
            locator: {
              symbol: table.array,
              line_start: item.lineStart,
              line_end: item.lineEnd,
              byte_start: null,
              byte_end: null,
              data_key: `${table.name}:${item.nativeId}`,
            },
            fragmentLines: { lineStart: item.lineStart, lineEnd: item.lineEnd },
          });
          ctx.output.writeEvidence(resolved.id, evidence);
          itemCount++;
        }
      }

      // --- Dungeon Features ---
      const dungeonFeatures = parseDungeonFeatureCatalog(globalsC);
      for (const df of dungeonFeatures) {
        const slug = df.nativeId.toLowerCase();
        const resolved = ctx.ids.resolveOrCreate("dungeon_feature", slug, `dungeonFeature:${df.nativeId}`);
        const envelope = makeRecordEnvelope(ctx.binding.source_id, "dungeon_feature", resolved.key, resolved.id, "broguece-factual");
        const record = {
          ...envelope,
          kind: "dungeon_feature",
          native_kind: "dungeonFeature",
          name: { canonical: df.description, original: df.nativeId },
          source_identity: { source_id: ctx.binding.source_id, native_id: `dungeonFeature:${df.nativeId}`, path: GLOBALS_C },
          activation: "active" as const,
          attributes: {
            layer: df.layer,
            start: df.start,
            decay: df.decay,
            flags: df.flags,
          },
          evidence_refs: [] as string[],
        };
        ctx.output.writeRecord(record);
        const evidence = ctx.evidence.create({
          artifactPath: GLOBALS_C,
          locator: { symbol: "dungeonFeatureCatalog", line_start: df.lineStart, line_end: df.lineEnd, byte_start: null, byte_end: null, data_key: df.nativeId },
          fragmentLines: { lineStart: df.lineStart, lineEnd: df.lineEnd },
        });
        ctx.output.writeEvidence(resolved.id, evidence);
      }

      // --- Lights ---
      const lights = parseLightCatalog(globalsC);
      for (const lt of lights) {
        const slug = lt.nativeId.toLowerCase();
        const resolved = ctx.ids.resolveOrCreate("light", slug, `lightSource:${lt.nativeId}`);
        const envelope = makeRecordEnvelope(ctx.binding.source_id, "light", resolved.key, resolved.id, "broguece-factual");
        const record = {
          ...envelope,
          kind: "light",
          native_kind: "lightSource",
          name: { canonical: lt.description, original: lt.nativeId },
          source_identity: { source_id: ctx.binding.source_id, native_id: `lightSource:${lt.nativeId}`, path: GLOBALS_C },
          activation: "active" as const,
          attributes: {
            color: lt.color,
            radius_min: lt.radiusMin,
            radius_max: lt.radiusMax,
            fade_percent: lt.fadePercent,
            pass_through_creatures: lt.passThroughCreatures,
          },
          evidence_refs: [] as string[],
        };
        ctx.output.writeRecord(record);
        const evidence = ctx.evidence.create({
          artifactPath: GLOBALS_C,
          locator: { symbol: "lightCatalog", line_start: lt.lineStart, line_end: lt.lineEnd, byte_start: null, byte_end: null, data_key: lt.nativeId },
          fragmentLines: { lineStart: lt.lineStart, lineEnd: lt.lineEnd },
        });
        ctx.output.writeEvidence(resolved.id, evidence);
      }

      // --- Mutations ---
      const mutations = parseMutationCatalog(globalsC);
      for (const mut of mutations) {
        const slug = mut.nativeId;
        const resolved = ctx.ids.resolveOrCreate("mutation", slug, `mutation:${mut.nativeId}`);
        const envelope = makeRecordEnvelope(ctx.binding.source_id, "mutation", resolved.key, resolved.id, "broguece-factual");
        const record = {
          ...envelope,
          kind: "mutation",
          native_kind: "mutation",
          name: { canonical: mut.name, original: mut.nativeId },
          source_identity: { source_id: ctx.binding.source_id, native_id: `mutation:${mut.nativeId}`, path: GLOBALS_C },
          activation: "active" as const,
          attributes: {
            health_factor: mut.healthFactor,
            move_speed_mult: mut.moveSpeedMult,
            attack_speed_mult: mut.attackSpeedMult,
            defense_mult: mut.defenseMult,
            damage_mult: mut.damageMult,
            description: mut.description,
            can_be_negated: mut.canBeNegated,
          },
          evidence_refs: [] as string[],
        };
        ctx.output.writeRecord(record);
        const evidence = ctx.evidence.create({
          artifactPath: GLOBALS_C,
          locator: { symbol: "mutationCatalog", line_start: mut.lineStart, line_end: mut.lineEnd, byte_start: null, byte_end: null, data_key: mut.nativeId },
          fragmentLines: { lineStart: mut.lineStart, lineEnd: mut.lineEnd },
        });
        ctx.output.writeEvidence(resolved.id, evidence);
      }

      // --- Monster Classes ---
      const monsterClasses = parseMonsterClassCatalog(globalsC);
      for (const mc of monsterClasses) {
        const slug = mc.nativeId;
        const resolved = ctx.ids.resolveOrCreate("monster_class", slug, `monsterClass:${mc.nativeId}`);
        const envelope = makeRecordEnvelope(ctx.binding.source_id, "monster_class", resolved.key, resolved.id, "broguece-factual");
        const record = {
          ...envelope,
          kind: "monster_class",
          native_kind: "monsterClass",
          name: { canonical: mc.name, original: mc.nativeId },
          source_identity: { source_id: ctx.binding.source_id, native_id: `monsterClass:${mc.nativeId}`, path: GLOBALS_C },
          activation: "active" as const,
          attributes: {
            frequency: mc.frequency,
            max_depth: mc.maxDepth,
            members: mc.members,
          },
          evidence_refs: [] as string[],
        };
        ctx.output.writeRecord(record);
        const evidence = ctx.evidence.create({
          artifactPath: GLOBALS_C,
          locator: { symbol: "monsterClassCatalog", line_start: mc.lineStart, line_end: mc.lineEnd, byte_start: null, byte_end: null, data_key: mc.nativeId },
          fragmentLines: { lineStart: mc.lineStart, lineEnd: mc.lineEnd },
        });
        ctx.output.writeEvidence(resolved.id, evidence);
      }

      // --- Status Effects ---
      const statusEffects = parseStatusEffectCatalog(globalsC);
      for (const se of statusEffects) {
        const slug = se.nativeId.toLowerCase();
        const resolved = ctx.ids.resolveOrCreate("status_effect", slug, `statusEffect:${se.nativeId}`);
        const envelope = makeRecordEnvelope(ctx.binding.source_id, "status_effect", resolved.key, resolved.id, "broguece-factual");
        const record = {
          ...envelope,
          kind: "status_effect",
          native_kind: "statusEffect",
          name: { canonical: se.name || se.nativeId, original: se.nativeId },
          source_identity: { source_id: ctx.binding.source_id, native_id: `statusEffect:${se.nativeId}`, path: GLOBALS_C },
          activation: "active" as const,
          attributes: {
            is_buff: se.isBuff,
            display_in_sidebar: se.displayInSidebar,
          },
          evidence_refs: [] as string[],
        };
        ctx.output.writeRecord(record);
        const evidence = ctx.evidence.create({
          artifactPath: GLOBALS_C,
          locator: { symbol: "statusEffectCatalog", line_start: se.lineStart, line_end: se.lineEnd, byte_start: null, byte_end: null, data_key: se.nativeId },
          fragmentLines: { lineStart: se.lineStart, lineEnd: se.lineEnd },
        });
        ctx.output.writeEvidence(resolved.id, evidence);
      }

      // --- Monster Behaviors ---
      const monsterBehaviors = parseMonsterBehaviorCatalog(globalsC);
      for (const mb of monsterBehaviors) {
        const slug = mb.nativeId.toLowerCase();
        const resolved = ctx.ids.resolveOrCreate("monster_behavior", slug, `monsterBehavior:${mb.nativeId}`);
        const envelope = makeRecordEnvelope(ctx.binding.source_id, "monster_behavior", resolved.key, resolved.id, "broguece-factual");
        const record = {
          ...envelope,
          kind: "monster_behavior",
          native_kind: "monsterBehavior",
          name: { canonical: mb.description || mb.nativeId, original: mb.nativeId },
          source_identity: { source_id: ctx.binding.source_id, native_id: `monsterBehavior:${mb.nativeId}`, path: GLOBALS_C },
          activation: "active" as const,
          attributes: {
            description: mb.description,
            is_always_active: mb.isAlwaysActive,
          },
          evidence_refs: [] as string[],
        };
        ctx.output.writeRecord(record);
        const evidence = ctx.evidence.create({
          artifactPath: GLOBALS_C,
          locator: { symbol: "monsterBehaviorCatalog", line_start: mb.lineStart, line_end: mb.lineEnd, byte_start: null, byte_end: null, data_key: mb.nativeId },
          fragmentLines: { lineStart: mb.lineStart, lineEnd: mb.lineEnd },
        });
        ctx.output.writeEvidence(resolved.id, evidence);
      }

      // --- Monster Abilities ---
      const monsterAbilities = parseMonsterAbilityCatalog(globalsC);
      for (const ma of monsterAbilities) {
        const slug = ma.nativeId.toLowerCase();
        const resolved = ctx.ids.resolveOrCreate("monster_ability", slug, `monsterAbility:${ma.nativeId}`);
        const envelope = makeRecordEnvelope(ctx.binding.source_id, "monster_ability", resolved.key, resolved.id, "broguece-factual");
        const record = {
          ...envelope,
          kind: "monster_ability",
          native_kind: "monsterAbility",
          name: { canonical: ma.description || ma.nativeId, original: ma.nativeId },
          source_identity: { source_id: ctx.binding.source_id, native_id: `monsterAbility:${ma.nativeId}`, path: GLOBALS_C },
          activation: "active" as const,
          attributes: {
            description: ma.description,
            is_always_active: ma.isAlwaysActive,
          },
          evidence_refs: [] as string[],
        };
        ctx.output.writeRecord(record);
        const evidence = ctx.evidence.create({
          artifactPath: GLOBALS_C,
          locator: { symbol: "monsterAbilityCatalog", line_start: ma.lineStart, line_end: ma.lineEnd, byte_start: null, byte_end: null, data_key: ma.nativeId },
          fragmentLines: { lineStart: ma.lineStart, lineEnd: ma.lineEnd },
        });
        ctx.output.writeEvidence(resolved.id, evidence);
      }

      let imageAssetCount = 0;
      const imageFiles = ctx.source.walk((p) => {
        const ext = p.toLowerCase().match(/\.[^.]+$/)?.[0] ?? "";
        return IMAGE_EXTENSIONS.includes(ext);
      });
      for (const imgPath of imageFiles) {
        const fileName = imgPath.split("/").pop() ?? imgPath;
        const slug = imgPath.replace(/\.[^.]+$/, "").replace(/[/\s]+/g, "-").toLowerCase();
        const resolved = ctx.ids.resolveOrCreate("image_asset", slug, imgPath);
        const envelope = makeRecordEnvelope(
          ctx.binding.source_id,
          "image_asset",
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

      ctx.output.writePopulation("creatures", 67, creatureCount);
      ctx.output.writePopulation("terrain", 214, terrainCount);
      ctx.output.writePopulation("items", 97, itemCount);
      ctx.output.writePopulation("image_assets", imageFiles.length, imageAssetCount);
      ctx.output.writePopulation("dungeon_features", 58, dungeonFeatures.length);
      ctx.output.writePopulation("lights", 63, lights.length);
      ctx.output.writePopulation("mutations", 16, mutations.length);
      ctx.output.writePopulation("monster_classes", 15, monsterClasses.length);
      ctx.output.writePopulation("status_effects", 26, statusEffects.length);
      ctx.output.writePopulation("monster_behaviors", 29, monsterBehaviors.length);
      ctx.output.writePopulation("monster_abilities", 18, monsterAbilities.length);

      return {
        extractorId: manifest.extractorId,
        extractorVersion: "1.0.0",
        runId: "broguece-run",
        recordCount: creatureCount + terrainCount + itemCount + imageAssetCount + dungeonFeatures.length + lights.length + mutations.length + monsterClasses.length + statusEffects.length + monsterBehaviors.length + monsterAbilities.length,
        populationCounts: [
          { dimension: "creatures", expected: 67, extracted: creatureCount },
          { dimension: "terrain", expected: 214, extracted: terrainCount },
          { dimension: "items", expected: 97, extracted: itemCount },
          { dimension: "image_assets", expected: imageFiles.length, extracted: imageAssetCount },
          { dimension: "dungeon_features", expected: 58, extracted: dungeonFeatures.length },
          { dimension: "lights", expected: 63, extracted: lights.length },
          { dimension: "mutations", expected: 16, extracted: mutations.length },
          { dimension: "monster_classes", expected: 15, extracted: monsterClasses.length },
          { dimension: "status_effects", expected: 26, extracted: statusEffects.length },
          { dimension: "monster_behaviors", expected: 29, extracted: monsterBehaviors.length },
          { dimension: "monster_abilities", expected: 18, extracted: monsterAbilities.length },
        ],
        diagnostics: [],
      };
    },
  };
}

export { manifest as brogueceManifest };
