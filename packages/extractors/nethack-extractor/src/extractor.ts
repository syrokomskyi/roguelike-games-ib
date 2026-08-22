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
import { runEntityPipeline, type EntitySpec } from "@roguelike-games-ib/extractor-sdk";
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

export function createNetHackExtractor(): Extractor {
  return {
    manifest,
    async run(ctx: ExtractorContext): Promise<ExtractorRunResult> {
      const monstersH = ctx.source.readText(MONSTERS_H);
      const objectsH = ctx.source.readText(OBJECTS_H);

      const monsters = parseMonsters(monstersH);
      const objects = parseObjects(objectsH);

      const creatureSpec: EntitySpec<MonsterEntry> = {
        kind: "creature",
        nativeKind: "mon",
        originActorId: "nethack-factual",
        entries: monsters,
        getSourcePath: () => MONSTERS_H,
        getSymbolName: () => "MON",
        getSlug: (m) => m.nativeId,
        getNativeId: (m) => m.nativeId,
        getCanonicalName: (m) => m.name,
        getOriginalName: (m) => m.name,
        getLineRange: (m) => ({ lineStart: m.lineStart, lineEnd: m.lineEnd }),
        getDataKey: (m) => m.nativeId,
        getAttributes: (m) => ({
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
        }),
      };

      const itemSpec: EntitySpec<ObjectEntry> = {
        kind: "item",
        nativeKind: "obj",
        originActorId: "nethack-factual",
        entries: objects,
        getSourcePath: () => OBJECTS_H,
        getSymbolName: (o) => o.objClass.toUpperCase(),
        getSlug: (o) => `${o.objClass}/${o.nativeId}`,
        getNativeId: (o) => `${o.objClass}:${o.nativeId}`,
        getCanonicalName: (o) => o.name,
        getOriginalName: (o) => o.name,
        getLineRange: (o) => ({ lineStart: o.lineStart, lineEnd: o.lineEnd }),
        getDataKey: (o) => `${o.objClass}:${o.nativeId}`,
        getAttributes: (o) => ({
          description: o.description,
          probability: o.probability,
          weight: o.weight,
          cost: o.cost,
          material: o.material,
          color: o.color,
        }),
      };

      const { counts } = await runEntityPipeline(ctx, [creatureSpec, itemSpec]);
      const creatureCount = counts[0] ?? 0;
      const itemCount = counts[1] ?? 0;

      const populationCounts = (manifest.exhaustivePopulations ?? []).map((p) => ({
        dimension: p.dimension,
        expected: p.expected ?? 0,
        extracted: p.dimension === "creatures" ? creatureCount : p.dimension === "items" ? itemCount : 0,
      }));

      for (const pop of populationCounts) {
        ctx.output.writePopulation(pop.dimension, pop.expected, pop.extracted);
      }

      return {
        extractorId: manifest.extractorId,
        extractorVersion: "1.0.0",
        runId: "nethack-run",
        recordCount: creatureCount + itemCount,
        populationCounts,
        diagnostics: [],
      };
    },
  };
}

export { manifest as nethackManifest };
