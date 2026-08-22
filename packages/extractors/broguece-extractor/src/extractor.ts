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

const manifest: ExtractorManifest = {
  schema: "werkstatt/knowledge-extractor@1",
  extractorId: "broguece-factual",
  extractorVersion: "1.0.0",
  sourceKinds: ["game_repository"],
  recordKinds: ["creature", "terrain", "item"],
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

      ctx.output.writePopulation("creatures", 67, creatureCount);
      ctx.output.writePopulation("terrain", 214, terrainCount);
      ctx.output.writePopulation("items", 46, itemCount);

      return {
        extractorId: manifest.extractorId,
        extractorVersion: "1.0.0",
        runId: "broguece-run",
        recordCount: creatureCount + terrainCount + itemCount,
        populationCounts: [
          { dimension: "creatures", expected: 67, extracted: creatureCount },
          { dimension: "terrain", expected: 214, extracted: terrainCount },
          { dimension: "items", expected: 46, extracted: itemCount },
        ],
        diagnostics: [],
      };
    },
  };
}

export { manifest as brogueceManifest };
