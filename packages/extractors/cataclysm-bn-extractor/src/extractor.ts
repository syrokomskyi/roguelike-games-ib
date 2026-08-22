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
  <item>ADR-0005: extractor follows the 10-step onboarding process — source registered in registry.yaml, binding in bindings.yaml, kinds mapped to game-content-taxonomy.yaml, populations declared, conformance test present.</item>
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
import {
  parseBionicJson,
  parseTrapJson,
  parseRecipeJson,
  parseSkillJson,
  parseEffectJson,
  parseNpcFactionJson,
  parseMonsterFactionJson,
  type BionicEntry,
  type TrapEntry as CBTrapEntry,
  type RecipeEntry,
  type SkillEntry as CBSkillEntry,
  type EffectEntry,
  type FactionEntry,
} from "./extra-json-parsers.ts";

const manifest: ExtractorManifest = {
  schema: "werkstatt/knowledge-extractor@1",
  extractorId: "cataclysm-bn-factual",
  extractorVersion: "1.0.0",
  sourceKinds: ["game_repository"],
  recordKinds: ["creature", "item", "mutation", "profession", "ability", "trap", "recipe", "skill", "effect", "faction"],
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
    {
      dimension: "bionics",
      denominatorKind: "extractor_population",
      expected: 137,
      description: "All bionic entries with type=bionic in data/json/bionics.json",
    },
    {
      dimension: "cb_traps",
      denominatorKind: "extractor_population",
      expected: 50,
      description: "All trap entries with type=trap in data/json/traps.json",
    },
    {
      dimension: "recipes",
      denominatorKind: "extractor_population",
      expected: 3187,
      description: "All recipe entries with type=recipe in data/json/recipes/**/*.json",
    },
    {
      dimension: "cb_skills",
      denominatorKind: "extractor_population",
      expected: 28,
      description: "All skill entries with type=skill in data/json/skills.json",
    },
    {
      dimension: "effects",
      denominatorKind: "extractor_population",
      expected: 237,
      description: "All effect entries with type=effect_type in data/json/effects.json",
    },
    {
      dimension: "factions",
      denominatorKind: "extractor_population",
      expected: 71,
      description: "All faction entries: 17 NPC factions (npcs/factions.json) + 54 monster factions (monster_factions.json)",
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
const BIONICS_FILE = "bionics.json";
const TRAPS_FILE = "traps.json";
const SKILLS_FILE = "skills.json";
const EFFECTS_FILE = "effects.json";
const NPC_FACTIONS_FILE = "npcs/factions.json";
const MONSTER_FACTIONS_FILE = "monster_factions.json";
const RECIPE_DIRS = ["recipes"];

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

function collectSingleFileEntries<E>(
  ctx: ExtractorContext,
  file: string,
  parser: (text: string, path: string) => E[],
): E[] {
  const allFiles = ctx.source.walk();
  if (!allFiles.includes(file)) return [];
  try {
    const text = ctx.source.readText(file);
    return parser(text, file);
  } catch {
    return [];
  }
}

function collectRecipeEntries(ctx: ExtractorContext): RecipeEntry[] {
  const allFiles = ctx.source.walk();
  const result: RecipeEntry[] = [];
  const recipeFiles = allFiles.filter((p) => p.startsWith("recipes/") && p.endsWith(".json"));
  for (const file of recipeFiles) {
    try {
      const text = ctx.source.readText(file);
      result.push(...parseRecipeJson(text, file));
    } catch {
      continue;
    }
  }
  return result;
}

function collectFactionEntries(ctx: ExtractorContext): FactionEntry[] {
  const npcFactions = collectSingleFileEntries(ctx, NPC_FACTIONS_FILE, parseNpcFactionJson);
  const monFactions = collectSingleFileEntries(ctx, MONSTER_FACTIONS_FILE, parseMonsterFactionJson);
  return [...npcFactions, ...monFactions];
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

function bionicSpec(entries: BionicEntry[]): EntitySpec<BionicEntry> {
  return {
    kind: "ability",
    entries,
    adapter: {
      nativeKind: "bionic",
      originActorId: "cataclysm-bn-factual",
      getSourcePath: (e) => e.path,
      getSymbolName: () => "bionic",
      getSlug: (e) => e.id.replace(/-/g, "_"),
      getNativeId: (e) => `bionic:${e.id}`,
      getCanonicalName: (e) => e.name,
      getOriginalName: (e) => e.id,
      getLineRange: (e) => ({ lineStart: e.lineStart, lineEnd: e.lineEnd }),
      getDataKey: (e) => e.id,
      getAttributes: (e) => ({
        act_cost: e.actCost,
        react_cost: e.reactCost,
        power_over_time: e.powerOverTime,
        charge_time: e.chargeTime,
        capacity: e.capacity,
        difficulty: e.difficulty,
        flags: e.flags,
        occupied_bodyparts: e.occupiedBodyparts,
      }),
      populationDimension: "bionics",
    },
  };
}

function trapSpec(entries: CBTrapEntry[]): EntitySpec<CBTrapEntry> {
  return {
    kind: "trap",
    entries,
    adapter: {
      nativeKind: "trap",
      originActorId: "cataclysm-bn-factual",
      getSourcePath: (e) => e.path,
      getSymbolName: () => "trap",
      getSlug: (e) => e.id.replace(/-/g, "_"),
      getNativeId: (e) => `trap:${e.id}`,
      getCanonicalName: (e) => e.name,
      getOriginalName: (e) => e.id,
      getLineRange: (e) => ({ lineStart: e.lineStart, lineEnd: e.lineEnd }),
      getDataKey: (e) => e.id,
      getAttributes: (e) => ({
        color: e.color,
        symbol: e.symbol,
        visibility: e.visibility,
        avoidance: e.avoidance,
        difficulty: e.difficulty,
        action: e.action,
        bash_dmg: e.bashDmg,
        flags: e.flags,
      }),
      populationDimension: "cb_traps",
    },
  };
}

function recipeSpec(entries: RecipeEntry[]): EntitySpec<RecipeEntry> {
  const seenIds = new Map<string, number>();
  return {
    kind: "recipe",
    entries: entries.map((e) => {
      const seen = seenIds.get(e.id) ?? 0;
      seenIds.set(e.id, seen + 1);
      if (seen > 0) {
        const suffix = e.path.replace("recipes/", "").replace(/\.json$/, "").replace(/\//g, "_");
        return { ...e, id: `${e.id}__${suffix}__${seen}` };
      }
      return e;
    }),
    adapter: {
      nativeKind: "recipe",
      originActorId: "cataclysm-bn-factual",
      getSourcePath: (e) => e.path,
      getSymbolName: () => "recipe",
      getSlug: (e) => e.id.replace(/-/g, "_"),
      getNativeId: (e) => `recipe:${e.id}`,
      getCanonicalName: (e) => e.result || e.id,
      getOriginalName: (e) => e.id,
      getLineRange: (e) => ({ lineStart: e.lineStart, lineEnd: e.lineEnd }),
      getDataKey: (e) => e.id,
      getAttributes: (e) => ({
        result: e.result,
        category: e.category,
        subtype: e.subtype,
        time: e.time,
        difficulty: e.difficulty,
        charges: e.charges,
        flags: e.flags,
      }),
      populationDimension: "recipes",
    },
  };
}

function skillSpec(entries: CBSkillEntry[]): EntitySpec<CBSkillEntry> {
  return {
    kind: "skill",
    entries,
    adapter: {
      nativeKind: "skill",
      originActorId: "cataclysm-bn-factual",
      getSourcePath: (e) => e.path,
      getSymbolName: () => "skill",
      getSlug: (e) => e.id.replace(/-/g, "_"),
      getNativeId: (e) => `skill:${e.id}`,
      getCanonicalName: (e) => e.name,
      getOriginalName: (e) => e.id,
      getLineRange: (e) => ({ lineStart: e.lineStart, lineEnd: e.lineEnd }),
      getDataKey: (e) => e.id,
      getAttributes: (e) => ({
        display_category: e.displayCategory,
        display_order: e.displayOrder,
      }),
      populationDimension: "cb_skills",
    },
  };
}

function effectSpec(entries: EffectEntry[]): EntitySpec<EffectEntry> {
  return {
    kind: "effect",
    entries,
    adapter: {
      nativeKind: "effect_type",
      originActorId: "cataclysm-bn-factual",
      getSourcePath: (e) => e.path,
      getSymbolName: () => "effect_type",
      getSlug: (e) => e.id.replace(/-/g, "_"),
      getNativeId: (e) => `effect:${e.id}`,
      getCanonicalName: (e) => e.name,
      getOriginalName: (e) => e.id,
      getLineRange: (e) => ({ lineStart: e.lineStart, lineEnd: e.lineEnd }),
      getDataKey: (e) => e.id,
      getAttributes: (e) => ({
        max_duration: e.maxDuration,
        permanent: e.permanent,
        flags: e.flags,
      }),
      populationDimension: "effects",
    },
  };
}

function factionSpec(entries: FactionEntry[]): EntitySpec<FactionEntry> {
  const seenIds = new Map<string, number>();
  const deduped = entries.map((e) => {
    const key = `${e.type}:${e.id}`;
    const seen = seenIds.get(key) ?? 0;
    seenIds.set(key, seen + 1);
    if (seen > 0) {
      return { ...e, id: `${e.id}__${seen}` };
    }
    return e;
  });
  return {
    kind: "faction",
    entries: deduped,
    adapter: {
      nativeKind: entries[0]?.type ?? "faction",
      originActorId: "cataclysm-bn-factual",
      getSourcePath: (e) => e.path,
      getSymbolName: (e) => e.type,
      getSlug: (e) => `${e.type}_${e.id}`.replace(/-/g, "_").toLowerCase(),
      getNativeId: (e) => `faction:${e.type}:${e.id}`,
      getCanonicalName: (e) => e.name,
      getOriginalName: (e) => e.id,
      getLineRange: (e) => ({ lineStart: e.lineStart, lineEnd: e.lineEnd }),
      getDataKey: (e) => `${e.type}:${e.id}`,
      getAttributes: (e) => ({
        description: e.description,
        likes_u: e.likesU,
        respects_u: e.respectsU,
        known_by_u: e.knownByU,
        size: e.size,
        power: e.power,
        food_supply: e.foodSupply,
        wealth: e.wealth,
        currency: e.currency,
        mon_faction: e.monFaction,
        base_faction: e.baseFaction,
        friendly: e.friendly,
        neutral: e.neutral,
        by_mood: e.byMood,
      }),
      populationDimension: "factions",
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
      const bionicEntries = collectSingleFileEntries(ctx, BIONICS_FILE, parseBionicJson);
      const trapEntries = collectSingleFileEntries(ctx, TRAPS_FILE, parseTrapJson);
      const recipeEntries = collectRecipeEntries(ctx);
      const skillEntries = collectSingleFileEntries(ctx, SKILLS_FILE, parseSkillJson);
      const effectEntries = collectSingleFileEntries(ctx, EFFECTS_FILE, parseEffectJson);
      const factionEntries = collectFactionEntries(ctx);

      const specs: EntitySpec<any>[] = [];
      if (monsterEntries.length > 0) specs.push(monsterSpec(monsterEntries));
      if (itemEntries.length > 0) specs.push(itemSpec(itemEntries));
      if (mutationEntries.length > 0) specs.push(mutationSpec(mutationEntries));
      if (professionEntries.length > 0) specs.push(professionSpec(professionEntries));
      if (bionicEntries.length > 0) specs.push(bionicSpec(bionicEntries));
      if (trapEntries.length > 0) specs.push(trapSpec(trapEntries));
      if (recipeEntries.length > 0) specs.push(recipeSpec(recipeEntries));
      if (skillEntries.length > 0) specs.push(skillSpec(skillEntries));
      if (effectEntries.length > 0) specs.push(effectSpec(effectEntries));
      if (factionEntries.length > 0) specs.push(factionSpec(factionEntries));

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
