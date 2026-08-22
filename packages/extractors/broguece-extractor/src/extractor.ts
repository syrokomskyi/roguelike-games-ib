/*
<MODULE_CONTRACT>
<purpose>BrogueCE factual extractor — parses C source files and emits creature, terrain, and item records with evidence anchors and population counts.</purpose>
<non-goals>
  <item>Does not parse JSON or YAML — BrogueCE source is C code only.</item>
  <item>Does not compute design-space relations — factual extraction only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: BrogueCE extractor with monster, tile, and item table parsing.</item>
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
  type MonsterEntry,
  type TileEntry,
  type ItemTableEntry,
} from "./c-parser.ts";

const ROGUE_H = "src/brogue/Rogue.h";
const GLOBALS_C = "src/brogue/Globals.c";
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
  recordKinds: ["creature", "terrain", "item", "image_asset"],
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
      expected: 46,
      description: "All items across weapon/armor/food/key/staff/ring tables",
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

export function createBrogueCEExtractor(): Extractor {
  return {
    manifest,
    async run(ctx: ExtractorContext): Promise<ExtractorRunResult> {
      const rogueH = ctx.source.readText(ROGUE_H);
      const globalsC = ctx.source.readText(GLOBALS_C);

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

      const itemTables: Array<{ name: string; array: string }> = [
        { name: "weapon", array: "weaponTable" },
        { name: "armor", array: "armorTable" },
        { name: "food", array: "foodTable" },
        { name: "key", array: "keyTable" },
        { name: "staff", array: "staffTable" },
        { name: "ring", array: "ringTable" },
      ];

      for (const table of itemTables) {
        const items = parseItemTable(globalsC, table.name, table.array);
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
              path: GLOBALS_C,
            },
            activation: "active" as const,
            attributes: {
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
            artifactPath: GLOBALS_C,
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
      ctx.output.writePopulation("items", 46, itemCount);
      ctx.output.writePopulation("image_assets", imageFiles.length, imageAssetCount);

      return {
        extractorId: manifest.extractorId,
        extractorVersion: "1.0.0",
        runId: "broguece-run",
        recordCount: creatureCount + terrainCount + itemCount + imageAssetCount,
        populationCounts: [
          { dimension: "creatures", expected: 67, extracted: creatureCount },
          { dimension: "terrain", expected: 214, extracted: terrainCount },
          { dimension: "items", expected: 46, extracted: itemCount },
          { dimension: "image_assets", expected: imageFiles.length, extracted: imageAssetCount },
        ],
        diagnostics: [],
      };
    },
  };
}

export { manifest as brogueceManifest };
