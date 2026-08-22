/*
<MODULE_CONTRACT>
<purpose>NetHack factual extractor — parses C header files and emits creature and item records with evidence anchors and population counts.</purpose>
<non-goals>
  <item>Does not parse JSON or YAML — NetHack source is C headers only.</item>
  <item>Does not compute design-space relations — factual extraction only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: NetHack extractor with monster and object parsing.</item>
</CHANGE_SUMMARY>
*/
import type {
  Extractor,
  ExtractorContext,
  ExtractorRunResult,
  ExtractorManifest,
} from "@roguelike-games-ib/extractor-sdk";
import {
  parseMonsters,
  parseObjects,
  type MonsterEntry,
  type ObjectEntry,
} from "./c-parser.ts";

const MONSTERS_H = "monsters.h";
const OBJECTS_H = "objects.h";

const manifest: ExtractorManifest = {
  schema: "werkstatt/knowledge-extractor@1",
  extractorId: "nethack-factual",
  extractorVersion: "1.0.0",
  sourceKinds: ["game_repository"],
  recordKinds: ["creature", "item"],
  deterministic: true,
  parserMode: "static",
  exhaustivePopulations: [
    {
      dimension: "creatures",
      denominatorKind: "extractor_population",
      expected: 376,
      description: "All monsters in monsters.h (MON() entries, excluding NUMMONS terminator and duplicates)",
    },
    {
      dimension: "items",
      denominatorKind: "extractor_population",
      expected: 454,
      description: "All items in objects.h (WEAPON, ARMOR, RING, POTION, SCROLL, SPELL, WAND, FOOD, AMULET, TOOL, GEM entries, excluding #if 0 blocks)",
    },
  ],
};

function makeRecordEnvelope(
  sourceId: string,
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

export function createNetHackExtractor(): Extractor {
  return {
    manifest,
    async run(ctx: ExtractorContext): Promise<ExtractorRunResult> {
      const monstersH = ctx.source.readText(MONSTERS_H);
      const objectsH = ctx.source.readText(OBJECTS_H);

      let creatureCount = 0;
      let itemCount = 0;

      const monsters = parseMonsters(monstersH);
      for (const m of monsters) {
        const slug = m.nativeId;
        const resolved = ctx.ids.resolveOrCreate("creature", slug, m.nativeId);
        const envelope = makeRecordEnvelope(
          ctx.binding.source_id,
          resolved.key,
          resolved.id,
          "nethack-factual",
        );

        const record = {
          ...envelope,
          kind: "creature",
          native_kind: "mon",
          name: { canonical: m.name, original: m.name },
          source_identity: {
            source_id: ctx.binding.source_id,
            native_id: m.nativeId,
            path: MONSTERS_H,
          },
          activation: "active" as const,
          attributes: {
            symbol: m.symbol,
            level: m.level,
            move_speed: m.moveSpeed,
            armor_class: m.armorClass,
            magic_resistance: m.magicResistance,
            alignment: m.alignment,
            geno_flags: m.genoFlags,
            attacks: m.attacks,
            weight: m.weight,
            nutrition: m.nutrition,
            sound: m.sound,
            size: m.size,
            resistances: m.resistances,
            conveys: m.conveys,
            flags1: m.flags1,
            flags2: m.flags2,
            flags3: m.flags3,
            difficulty: m.difficulty,
            color: m.color,
          },
          evidence_refs: [] as string[],
        };

        ctx.output.writeRecord(record);

        const evidence = ctx.evidence.create({
          artifactPath: MONSTERS_H,
          locator: {
            symbol: "MON",
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

      const objects = parseObjects(objectsH);
      for (const obj of objects) {
        const slug = `${obj.objClass}/${obj.nativeId}`;
        const resolved = ctx.ids.resolveOrCreate("item", slug, `${obj.objClass}:${obj.nativeId}`);
        const envelope = makeRecordEnvelope(
          ctx.binding.source_id,
          resolved.key,
          resolved.id,
          "nethack-factual",
        );

        const record = {
          ...envelope,
          kind: "item",
          native_kind: obj.objClass,
          name: { canonical: obj.name, original: obj.name },
          source_identity: {
            source_id: ctx.binding.source_id,
            native_id: `${obj.objClass}:${obj.nativeId}`,
            path: OBJECTS_H,
          },
          activation: "active" as const,
          attributes: {
            description: obj.description,
            probability: obj.probability,
            weight: obj.weight,
            cost: obj.cost,
            material: obj.material,
            color: obj.color,
          },
          evidence_refs: [] as string[],
        };

        ctx.output.writeRecord(record);

        const evidence = ctx.evidence.create({
          artifactPath: OBJECTS_H,
          locator: {
            symbol: obj.objClass.toUpperCase(),
            line_start: obj.lineStart,
            line_end: obj.lineEnd,
            byte_start: null,
            byte_end: null,
            data_key: `${obj.objClass}:${obj.nativeId}`,
          },
          fragmentLines: { lineStart: obj.lineStart, lineEnd: obj.lineEnd },
        });
        ctx.output.writeEvidence(resolved.id, evidence);
        itemCount++;
      }

      ctx.output.writePopulation("creatures", 376, creatureCount);
      ctx.output.writePopulation("items", 454, itemCount);

      return {
        extractorId: manifest.extractorId,
        extractorVersion: "1.0.0",
        runId: "nethack-run",
        recordCount: creatureCount + itemCount,
        populationCounts: [
          { dimension: "creatures", expected: 376, extracted: creatureCount },
          { dimension: "items", expected: 454, extracted: itemCount },
        ],
        diagnostics: [],
      };
    },
  };
}

export { manifest as nethackManifest };
