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
import { runEntityPipeline, type EntitySpec } from "@roguelike-games-ib/extractor-sdk";
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

interface CataclysmEntry {
  id: string;
  type: string;
  name: string;
  path: string;
  lineStart: number;
  lineEnd: number;
  attributes: Record<string, unknown>;
  slug: string;
  nativeId: string;
  kind: string;
  nativeKind: string;
}

function collectEntries(
  ctx: ExtractorContext,
  dirs: string[],
  parser: (text: string, path: string, seenIds: Map<string, number>) => CataclysmEntry[],
  dedupPrefix: string | null = null,
): CataclysmEntry[] {
  const allFiles = ctx.source.walk();
  const seenIds = new Map<string, number>();
  const result: CataclysmEntry[] = [];
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

function collectProfessionEntries(ctx: ExtractorContext): CataclysmEntry[] {
  const allFiles = ctx.source.walk();
  const result: CataclysmEntry[] = [];
  for (const file of PROFESSION_FILES) {
    if (!allFiles.includes(file)) continue;
    const text = ctx.source.readText(file);
    try {
      const professions = parseProfessionJson(text, file);
      for (const prof of professions) {
        result.push({
          id: prof.id,
          type: prof.type,
          name: prof.name,
          path: file,
          lineStart: prof.lineStart,
          lineEnd: prof.lineEnd,
          attributes: {},
          slug: prof.id.replace(/-/g, "_"),
          nativeId: prof.id,
          kind: "profession",
          nativeKind: prof.type,
        });
      }
    } catch {
      continue;
    }
  }
  return result;
}

function monsterParser(text: string, file: string, _seenIds: Map<string, number>): CataclysmEntry[] {
  return parseMonsterJson(text, file).map((m) => ({
    id: m.id,
    type: m.type,
    name: m.name,
    path: file,
    lineStart: m.lineStart,
    lineEnd: m.lineEnd,
    attributes: {
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
    },
    slug: m.id.replace(/^mon_/, "").replace(/-/g, "_"),
    nativeId: m.id,
    kind: "creature",
    nativeKind: "MONSTER",
  }));
}

function itemParser(text: string, file: string, seenIds: Map<string, number>): CataclysmEntry[] {
  return parseItemJson(text, file).map((item) => {
    const { slug, nativeId } = namespaceDuplicateId(item.id, file, "items", seenIds);
    return {
      id: item.id,
      type: item.type,
      name: item.name,
      path: file,
      lineStart: item.lineStart,
      lineEnd: item.lineEnd,
      attributes: {
        symbol: item.symbol,
        color: item.color,
        price: item.price,
        volume: item.volume,
        weight: item.weight,
        material: item.material,
        flags: item.flags,
      },
      slug,
      nativeId,
      kind: "item",
      nativeKind: item.type,
    };
  });
}

function mutationParser(text: string, file: string, seenIds: Map<string, number>): CataclysmEntry[] {
  return parseMutationJson(text, file).map((mut) => {
    const { slug, nativeId } = namespaceDuplicateId(mut.id, file, "mutations", seenIds);
    return {
      id: mut.id,
      type: mut.type,
      name: mut.name,
      path: file,
      lineStart: mut.lineStart,
      lineEnd: mut.lineEnd,
      attributes: {
        points: mut.points,
        visibility: mut.visibility,
        category: mut.category,
        leads_to: mut.leadsTo,
      },
      slug,
      nativeId,
      kind: "mutation",
      nativeKind: mut.type,
    };
  });
}

function cataclysmSpec(entries: CataclysmEntry[]): EntitySpec<CataclysmEntry> {
  return {
    kind: entries[0]?.kind ?? "",
    nativeKind: entries[0]?.nativeKind ?? "",
    originActorId: "cataclysm-bn-factual",
    entries,
    getSourcePath: (e) => e.path,
    getSymbolName: (e) => e.nativeKind,
    getSlug: (e) => e.slug,
    getNativeId: (e) => e.nativeId,
    getCanonicalName: (e) => e.name || e.id,
    getOriginalName: (e) => e.id,
    getLineRange: (e) => ({ lineStart: e.lineStart, lineEnd: e.lineEnd }),
    getDataKey: (e) => e.id,
    getAttributes: (e) => e.attributes,
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
      if (monsterEntries.length > 0) specs.push(cataclysmSpec(monsterEntries));
      if (itemEntries.length > 0) specs.push(cataclysmSpec(itemEntries));
      if (mutationEntries.length > 0) specs.push(cataclysmSpec(mutationEntries));
      if (professionEntries.length > 0) specs.push(cataclysmSpec(professionEntries));

      const { counts } = await runEntityPipeline(ctx, specs);

      // --- Populations (derived from manifest) ---
      const popMap = new Map<string, number>();
      popMap.set("monsters", counts[0] ?? 0);
      popMap.set("items", counts[1] ?? 0);
      popMap.set("mutations", counts[2] ?? 0);
      popMap.set("professions", counts[3] ?? 0);

      const populationCounts = (manifest.exhaustivePopulations ?? []).map((p) => ({
        dimension: p.dimension,
        expected: p.expected ?? 0,
        extracted: popMap.get(p.dimension) ?? 0,
      }));

      for (const pop of populationCounts) {
        ctx.output.writePopulation(pop.dimension, pop.expected, pop.extracted);
      }

      const recordCount = populationCounts.reduce((sum, p) => sum + p.extracted, 0);

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
