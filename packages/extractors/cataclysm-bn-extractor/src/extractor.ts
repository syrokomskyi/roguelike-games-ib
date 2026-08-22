/*
<MODULE_CONTRACT>
<purpose>Cataclysm-BN factual extractor — parses JSON data files and emits creature, item, mutation, and profession records with evidence and population counts.</purpose>
<non-goals>
  <item>Does not parse C source — Cataclysm-BN data is JSON only.</item>
  <item>Does not compute design-space relations — factual extraction only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: Cataclysm-BN extractor with monster, item, mutation, and profession parsing.</item>
  <item>Deepened into SDK Entity Pipeline: run() is now a declarative spec list, not a 280-line flat sequence.</item>
  <item>Population denominators derived from manifest.exhaustivePopulations — no more hard-coded duplicates.</item>
</CHANGE_SUMMARY>
*/
import type {
  Extractor,
  ExtractorContext,
  ExtractorRunResult,
  ExtractorManifest,
} from "@roguelike-games-ib/extractor-sdk";
import { runEntityPipeline, PopulationCollector, type EntitySpec } from "@roguelike-games-ib/extractor-sdk";
import {
  parseMonsterJson,
  parseItemJson,
  parseMutationJson,
  parseProfessionJson,
  type MonsterEntry,
  type ItemEntry,
  type MutationEntry,
  type ProfessionEntry,
} from "./json-parser.ts";

const manifest: ExtractorManifest = {
  schema: "werkstatt/knowledge-extractor@1",
  extractorId: "cataclysm-bn-factual",
  extractorVersion: "1.0.0",
  sourceKinds: ["game_repository"],
  recordKinds: ["creature", "item", "mutation", "profession"],
  deterministic: true,
  parserMode: "static",
  exhaustivePopulations: [
    {
      dimension: "monsters",
      denominatorKind: "extractor_population",
      expected: 597,
      description: "All monster entries with type=MONSTER in data/json/monsters/*.json",
    },
    {
      dimension: "items",
      denominatorKind: "extractor_population",
      expected: 5886,
      description: "All item entries with id in data/json/items/**/*.json",
    },
    {
      dimension: "mutations",
      denominatorKind: "extractor_population",
      expected: 625,
      description: "All mutation entries with id in data/json/mutations/*.json",
    },
    {
      dimension: "professions",
      denominatorKind: "extractor_population",
      expected: 339,
      description: "All profession entries in professions.json",
    },
  ],
};

// Implements ADR-0004: namespace duplicate native_ids with file suffix instead of skipping
function namespaceDuplicateId(
  id: string,
  file: string,
  prefix: string,
  seenIds: Map<string, number>,
): { slug: string; nativeId: string } {
  const seenCount = seenIds.get(id) ?? 0;
  let slug = id.replace(/-/g, "_");
  let nativeId = id;
  if (seenCount > 0) {
    const fileSuffix = file
      .replace(new RegExp(`^${prefix}/`), "")
      .replace(/\.json$/, "")
      .replace(/[/]/g, "_");
    slug = `${slug}__${fileSuffix}`;
    nativeId = `${id}__${fileSuffix}`;
  }
  seenIds.set(id, seenCount + 1);
  return { slug, nativeId };
}

const MONSTER_DIRS = ["monsters"];
const ITEM_DIRS = ["items"];
const MUTATION_DIRS = ["mutations"];
const PROFESSION_FILES = ["professions.json"];

function walkJsonFiles(allFiles: string[], dir: string): string[] {
  return allFiles.filter((p) => p.startsWith(dir + "/") && p.endsWith(".json"));
}

function collectEntries<E>(
  ctx: ExtractorContext,
  dirs: string[],
  parser: (text: string, path: string, seenIds: Map<string, number>) => E[],
): E[] {
  const allFiles = ctx.source.walk();
  const seenIds = new Map<string, number>();
  const result: E[] = [];
  for (const dir of dirs) {
    const files = walkJsonFiles(allFiles, dir);
    for (const file of files) {
      const text = ctx.source.readText(file);
      try {
        result.push(...parser(text, file, seenIds));
      } catch {
        continue;
      }
    }
  }
  return result;
}

function collectProfessionEntries(ctx: ExtractorContext): ProfessionEntry[] {
  const allFiles = ctx.source.walk();
  const result: ProfessionEntry[] = [];
  for (const file of PROFESSION_FILES) {
    if (!allFiles.includes(file)) continue;
    const text = ctx.source.readText(file);
    try {
      result.push(...parseProfessionJson(text, file));
    } catch {
      continue;
    }
  }
  return result;
}

function monsterParser(text: string, file: string, _seenIds: Map<string, number>): MonsterEntry[] {
  return parseMonsterJson(text, file);
}

function itemParser(text: string, file: string, seenIds: Map<string, number>): ItemEntry[] {
  return parseItemJson(text, file).map((item) => {
    const { slug, nativeId } = namespaceDuplicateId(item.id, file, "items", seenIds);
    return { ...item, id: nativeId, _slug: slug } as ItemEntry & { _slug: string };
  });
}

function mutationParser(text: string, file: string, seenIds: Map<string, number>): MutationEntry[] {
  return parseMutationJson(text, file).map((mut) => {
    const { slug, nativeId } = namespaceDuplicateId(mut.id, file, "mutations", seenIds);
    return { ...mut, id: nativeId, _slug: slug } as MutationEntry & { _slug: string };
  });
}

function monsterSpec(entries: MonsterEntry[]): EntitySpec<MonsterEntry> {
  return {
    kind: "creature",
    entries,
    adapter: {
      nativeKind: "MONSTER",
      originActorId: "cataclysm-bn-factual",
      getSourcePath: (m) => m.path,
      getSymbolName: () => "MONSTER",
      getSlug: (m) => m.id.replace(/^mon_/, "").replace(/-/g, "_"),
      getNativeId: (m) => `monster:${m.id}`,
      getCanonicalName: (m) => m.name,
      getOriginalName: (m) => m.id,
      getLineRange: (m) => ({ lineStart: m.lineStart, lineEnd: m.lineEnd }),
      getDataKey: (m) => m.id,
      getAttributes: (m) => ({
        hp: m.hp,
        speed: m.speed,
        aggression: m.aggression,
        morale: m.morale,
        melee_skill: m.meleeSkill,
        melee_dice: m.meleeDice,
        melee_dice_sides: m.meleeDiceSides,
        melee_cut: m.meleeCut,
        dodge: m.dodge,
        volume: m.volume,
        weight: m.weight,
        symbol: m.symbol,
        color: m.color,
        default_faction: m.defaultFaction,
        species: m.species,
        categories: m.categories,
        flags: m.flags,
      }),
      populationDimension: "monsters",
    },
  };
}

function itemSpec(entries: ItemEntry[]): EntitySpec<ItemEntry> {
  return {
    kind: "item",
    entries,
    adapter: {
      nativeKind: entries[0]?.type ?? "",
      originActorId: "cataclysm-bn-factual",
      getSourcePath: (e) => e.path,
      getSymbolName: (e) => e.type,
      getSlug: (e) => (e as ItemEntry & { _slug: string })._slug,
      getNativeId: (e) => `item:${e.id}`,
      getCanonicalName: (e) => e.name,
      getOriginalName: (e) => e.id,
      getLineRange: (e) => ({ lineStart: e.lineStart, lineEnd: e.lineEnd }),
      getDataKey: (e) => e.id,
      getAttributes: (e) => ({
        symbol: e.symbol,
        color: e.color,
        price: e.price,
        volume: e.volume,
        weight: e.weight,
        material: e.material,
        flags: e.flags,
      }),
      populationDimension: "items",
    },
  };
}

function mutationSpec(entries: MutationEntry[]): EntitySpec<MutationEntry> {
  return {
    kind: "mutation",
    entries,
    adapter: {
      nativeKind: entries[0]?.type ?? "",
      originActorId: "cataclysm-bn-factual",
      getSourcePath: (e) => e.path,
      getSymbolName: (e) => e.type,
      getSlug: (e) => (e as MutationEntry & { _slug: string })._slug,
      getNativeId: (e) => `mutation:${e.id}`,
      getCanonicalName: (e) => e.name,
      getOriginalName: (e) => e.id,
      getLineRange: (e) => ({ lineStart: e.lineStart, lineEnd: e.lineEnd }),
      getDataKey: (e) => e.id,
      getAttributes: (e) => ({
        points: e.points,
        visibility: e.visibility,
        category: e.category,
        leads_to: e.leadsTo,
      }),
      populationDimension: "mutations",
    },
  };
}

function professionSpec(entries: ProfessionEntry[]): EntitySpec<ProfessionEntry> {
  return {
    kind: "profession",
    entries,
    adapter: {
      nativeKind: entries[0]?.type ?? "",
      originActorId: "cataclysm-bn-factual",
      getSourcePath: (e) => e.path,
      getSymbolName: (e) => e.type,
      getSlug: (e) => e.id.replace(/-/g, "_"),
      getNativeId: (e) => `profession:${e.id}`,
      getCanonicalName: (e) => e.name,
      getOriginalName: (e) => e.id,
      getLineRange: (e) => ({ lineStart: e.lineStart, lineEnd: e.lineEnd }),
      getDataKey: (e) => e.id,
      getAttributes: () => ({}),
      populationDimension: "professions",
    },
  };
}

export function createCataclysmBNExtractor(): Extractor {
  return {
    manifest,
    async run(ctx: ExtractorContext): Promise<ExtractorRunResult> {
      const monsterEntries = collectEntries(ctx, MONSTER_DIRS, monsterParser);
      const itemEntries = collectEntries(ctx, ITEM_DIRS, itemParser);
      const mutationEntries = collectEntries(ctx, MUTATION_DIRS, mutationParser);
      const professionEntries = collectProfessionEntries(ctx);

      const specs: EntitySpec<any>[] = [];
      if (monsterEntries.length > 0) specs.push(monsterSpec(monsterEntries));
      if (itemEntries.length > 0) specs.push(itemSpec(itemEntries));
      if (mutationEntries.length > 0) specs.push(mutationSpec(mutationEntries));
      if (professionEntries.length > 0) specs.push(professionSpec(professionEntries));

      const { dimensionCounts } = await runEntityPipeline(ctx, specs);

      const popCollector = new PopulationCollector(manifest.exhaustivePopulations ?? [], ctx.output);
      const { populationCounts, recordCount } = popCollector.collect(dimensionCounts);

      return {
        extractorId: manifest.extractorId,
        extractorVersion: "1.0.0",
        runId: "cataclysm-bn-run",
        recordCount,
        populationCounts,
        diagnostics: [],
      };
    },
  };
}

export { manifest as cataclysmBnManifest };
