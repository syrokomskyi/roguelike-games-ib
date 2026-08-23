/*
<MODULE_CONTRACT>
<purpose>Crawl factual extractor — parses YAML data files, .des vault definitions, and C header files, emits creature, species, profession, vault, spell, branch, form, and sprite records with evidence anchors and population counts.</purpose>
<non-goals>
  <item>Does not compute design-space relations — factual extraction only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: Crawl extractor with monster, species, job, and vault parsing.</item>
  <item>ADR-0005: extractor follows the 10-step onboarding process — source registered in registry.yaml, binding in bindings.yaml, kinds mapped to game-content-taxonomy.yaml, populations declared, conformance test present.</item>
  <item>Added spell extraction (418 entries) from spl-data.h and branch extraction from branch-data.h via C struct parser with preprocessor directive handling.</item>
  <item>Added form extraction (35 entries) from dat/forms/*.yaml as mutation records via YAML parser.</item>
</CHANGE_SUMMARY>
*/
import type {
  Extractor,
  ExtractorContext,
  ExtractorRunResult,
  ExtractorManifest,
} from "@roguelike-games-ib/extractor-sdk";
import { runEntityPipeline, PopulationCollector, type EntitySpec } from "@roguelike-games-ib/extractor-sdk";
import { resolve, join } from "node:path";
import {
  parseMonsterYaml,
  parseSpeciesYaml,
  parseJobYaml,
  parseFormYaml,
  type MonsterEntry,
  type SpeciesEntry,
  type JobEntry,
  type FormEntry,
} from "./yaml-parser.ts";
import { createCrawlSpritePipeline } from "./sprite-pipeline.ts";
import { parseDesVaults, type VaultEntry } from "./des-parser.ts";
import {
  parseSpellData,
  parseBranchData,
  parseAbilityTypes,
  parseGodTypes,
  parseBrandTypes,
  parseObjectClassTypes,
  parseCloudTypes,
  type SpellEntry,
  type BranchEntry,
  type AbilityEntry,
  type GodEntry,
  type BrandEntry,
  type ItemTypeEntry,
  type CloudEntry,
} from "./c-struct-parser.ts";

const SPRITE_TILE_COORDS = { x: 0, y: 0, w: 32, h: 32 };

const manifest: ExtractorManifest = {
  schema: "werkstatt/knowledge-extractor@1",
  extractorId: "crawl-factual",
  extractorVersion: "1.0.0",
  sourceKinds: ["game_repository"],
  recordKinds: ["creature", "species", "profession", "vault", "spell", "branch", "mutation", "ability", "deity", "item", "effect"],
  deterministic: true,
  parserMode: "static",
  exhaustivePopulations: [
    {
      dimension: "monsters",
      denominatorKind: "extractor_population",
      expected: 680,
      description: "All monster YAML files in dat/mons/ (excluding README and TEST*)",
    },
    {
      dimension: "species",
      denominatorKind: "extractor_population",
      expected: 48,
      description: "All species YAML files in dat/species/",
    },
    {
      dimension: "jobs",
      denominatorKind: "extractor_population",
      expected: 26,
      description: "All job YAML files in dat/jobs/",
    },
    {
      dimension: "vaults",
      denominatorKind: "extractor_population",
      expected: 6246,
      description: "All NAME: blocks in .des files under dat/des/ (excluding test/)",
    },
    {
      dimension: "spells",
      denominatorKind: "extractor_population",
      expected: 418,
      description: "All spell entries in spelldata[] array in spl-data.h",
    },
    {
      dimension: "branches",
      denominatorKind: "extractor_population",
      expected: 41,
      description: "All branch entries in branches[] array in branch-data.h (TAG_MAJOR_VERSION == 34, excluding > 34 conditional entries)",
    },
    {
      dimension: "forms",
      denominatorKind: "extractor_population",
      expected: 35,
      description: "All form YAML files in dat/forms/",
    },
    {
      dimension: "abilities",
      denominatorKind: "extractor_population",
      expected: 216,
      description: "All ABIL_* enum entries in ability-type.h (TAG_MAJOR_VERSION == 34, excluding aliases, sentinels, and WIZARD-only entries)",
    },
    {
      dimension: "gods",
      denominatorKind: "extractor_population",
      expected: 27,
      description: "All GOD_* enum entries in god-type.h (TAG_MAJOR_VERSION == 34, excluding GOD_NO_GOD, NUM_GODS, GOD_RANDOM, GOD_NAMELESS, GOD_ECUMENICAL)",
    },
    {
      dimension: "brands",
      denominatorKind: "extractor_population",
      expected: 37,
      description: "All SPWPN_* enum entries in item-prop-enum.h brand_type (TAG_MAJOR_VERSION == 34, excluding SPWPN_FORBID_BRAND and non-SPWPN sentinels)",
    },
    {
      dimension: "item_types",
      denominatorKind: "extractor_population",
      expected: 20,
      description: "All OBJ_* enum entries in object-class-type.h (TAG_MAJOR_VERSION == 34, excluding NUM_OBJECT_CLASSES, OBJ_UNASSIGNED, OBJ_RANDOM, OBJ_DETECTED)",
    },
    {
      dimension: "clouds",
      denominatorKind: "extractor_population",
      expected: 40,
      description: "All CLOUD_* enum entries in cloud-type.h (TAG_MAJOR_VERSION == 34, excluding CLOUD_NONE, NUM_CLOUD_TYPES, CLOUD_RANDOM_SMOKE, CLOUD_RANDOM, CLOUD_DEBUGGING)",
    },
  ],
};

function collectYamlFiles<T>(
  ctx: ExtractorContext,
  dir: string,
  parser: (text: string, path: string) => T | null,
  skipPattern?: RegExp,
): T[] {
  const allFiles = ctx.source.walk();
  const files = allFiles.filter(
    (p) => p.startsWith(dir + "/") && p.endsWith(".yaml") && (!skipPattern || !skipPattern.test(p)),
  );
  const result: T[] = [];
  for (const file of files) {
    const text = ctx.source.readText(file);
    try {
      const entry = parser(text, file);
      if (entry) result.push(entry);
    } catch (err) {
      console.warn(`[crawl-extractor] Failed to parse ${file}: ${err}`);
      continue;
    }
  }
  return result;
}

function monsterSpec(entries: MonsterEntry[], sprite: ReturnType<typeof createCrawlSpritePipeline>): EntitySpec<MonsterEntry> {
  return {
    kind: "creature",
    entries,
    adapter: {
      nativeKind: "MONSTER",
      originActorId: "crawl-factual",
      getSourcePath: (m) => m.path,
      getSymbolName: () => "MONSTER",
      getSlug: (m) => m.id.replace(/-/g, "_"),
      getNativeId: (m) => `mons:${m.id}`,
      getCanonicalName: (m) => m.name,
      getOriginalName: (m) => m.id,
      getLineRange: (m) => ({ lineStart: m.lineStart, lineEnd: m.lineEnd }),
      getDataKey: (m) => m.id,
      getAttributes: async (m) => {
        const spritePath = await sprite.extractSprite(m.tile ?? m.id, m.id.replace(/-/g, "_"));
        return {
          glyph: m.glyph,
          tile: m.tile,
          sprite_path: spritePath,
          tile_coords: spritePath ? SPRITE_TILE_COORDS : null,
          flags: m.flags,
          exp: m.exp,
          will: m.will,
          holiness: m.holiness,
          attacks: m.attacks,
          hd: m.hd,
          hp_10x: m.hp10x,
          ac: m.ac,
          ev: m.ev,
          has_corpse: m.hasCorpse,
          intelligence: m.intelligence,
          speed: m.speed,
          size: m.size,
          shape: m.shape,
        };
      },
      populationDimension: "monsters",
    },
  };
}

function speciesSpec(entries: SpeciesEntry[]): EntitySpec<SpeciesEntry> {
  return {
    kind: "species",
    entries,
    adapter: {
      nativeKind: "SPECIES",
      originActorId: "crawl-factual",
      getSourcePath: (e) => e.path,
      getSymbolName: () => "SPECIES",
      getSlug: (e) => e.id.replace(/-/g, "_"),
      getNativeId: (e) => `species:${e.id}`,
      getCanonicalName: (e) => e.name,
      getOriginalName: (e) => e.id,
      getLineRange: (e) => ({ lineStart: e.lineStart, lineEnd: e.lineEnd }),
      getDataKey: (e) => e.id,
      getAttributes: (e) => ({
        enum: e.enum,
        monster: e.monster,
        difficulty: e.difficulty,
        difficulty_priority: e.difficultyPriority,
        aptitudes: e.aptitudes,
        str: e.str,
        int: e.int,
        dex: e.dex,
        mutations: e.mutations,
        recommended_jobs: e.recommendedJobs,
        deprecated: e.deprecated,
      }),
      populationDimension: "species",
    },
  };
}

function jobSpec(entries: JobEntry[]): EntitySpec<JobEntry> {
  return {
    kind: "profession",
    entries,
    adapter: {
      nativeKind: "JOB",
      originActorId: "crawl-factual",
      getSourcePath: (e) => e.path,
      getSymbolName: () => "JOB",
      getSlug: (e) => e.id.replace(/-/g, "_"),
      getNativeId: (e) => `job:${e.id}`,
      getCanonicalName: (e) => e.name,
      getOriginalName: (e) => e.id,
      getLineRange: (e) => ({ lineStart: e.lineStart, lineEnd: e.lineEnd }),
      getDataKey: (e) => e.id,
      getAttributes: (e) => ({
        enum: e.enum,
        category: e.category,
        category_priority: e.categoryPriority,
        str: e.str,
        int: e.int,
        dex: e.dex,
        equipment: e.equipment,
        weapon_choice: e.weaponChoice,
        recommended_species: e.recommendedSpecies,
        skills: e.skills,
      }),
      populationDimension: "jobs",
    },
  };
}

function vaultSpec(entries: VaultEntry[]): EntitySpec<VaultEntry> {
  return {
    kind: "vault",
    entries,
    adapter: {
      nativeKind: "DES_VAULT",
      originActorId: "crawl-factual",
      getSourcePath: (e) => e.filePath,
      getSymbolName: (e) => e.nativeId,
      getSlug: (e) => e.nativeId.replace(/[^a-z0-9_]/gi, "_"),
      getNativeId: (e) => `vault:${e.nativeId}`,
      getCanonicalName: (e) => e.nativeId,
      getOriginalName: (e) => e.nativeId,
      getLineRange: (e) => ({ lineStart: e.lineStart, lineEnd: e.lineEnd }),
      getDataKey: (e) => e.nativeId,
      getAttributes: (e) => ({
        depth: e.depth,
        weight: e.weight,
        tags: e.tags,
        orient: e.orient,
        chance: e.chance,
        mons: e.mons,
        items: e.items,
        has_map: e.hasMap,
      }),
      populationDimension: "vaults",
    },
  };
}

function spellSpec(entries: SpellEntry[]): EntitySpec<SpellEntry> {
  return {
    kind: "spell",
    entries,
    adapter: {
      nativeKind: "SPELL",
      originActorId: "crawl-factual",
      getSourcePath: (e) => e.filePath,
      getSymbolName: (e) => e.nativeId,
      getSlug: (e) => e.nativeId.replace(/[^a-z0-9_]/gi, "_").toLowerCase(),
      getNativeId: (e) => `spell:${e.nativeId}`,
      getCanonicalName: (e) => e.name,
      getOriginalName: (e) => e.nativeId,
      getLineRange: (e) => ({ lineStart: e.lineStart, lineEnd: e.lineEnd }),
      getDataKey: (e) => e.nativeId,
      getAttributes: (e) => ({
        schools: e.schools,
        flags: e.flags,
        level: e.level,
        power_cap: e.powerCap,
        min_range: e.minRange,
        max_range: e.maxRange,
        effect_noise: e.effectNoise,
        tile: e.tile,
      }),
      populationDimension: "spells",
    },
  };
}

function branchSpec(entries: BranchEntry[]): EntitySpec<BranchEntry> {
  return {
    kind: "branch",
    entries,
    adapter: {
      nativeKind: "BRANCH",
      originActorId: "crawl-factual",
      getSourcePath: (e) => e.filePath,
      getSymbolName: (e) => e.nativeId,
      getSlug: (e) => e.nativeId.replace(/[^a-z0-9_]/gi, "_").toLowerCase(),
      getNativeId: (e) => `branch:${e.nativeId}`,
      getCanonicalName: (e) => e.shortName || e.nativeId,
      getOriginalName: (e) => e.nativeId,
      getLineRange: (e) => ({ lineStart: e.lineStart, lineEnd: e.lineEnd }),
      getDataKey: (e) => e.nativeId,
      getAttributes: (e) => ({
        parent_branch: e.parentBranch,
        mindepth: e.mindepth,
        maxdepth: e.maxdepth,
        depth: e.depth,
        absdepth: e.absdepth,
        flags: e.flags,
        short_name: e.shortName,
        long_name: e.longName,
        abbrev: e.abbrev,
        floor_colour: e.floorColour,
        rock_colour: e.rockColour,
        travel_shortcut: e.travelShortcut,
        runes: e.runes,
        ambient_noise: e.ambientNoise,
      }),
      populationDimension: "branches",
    },
  };
}

function formSpec(entries: FormEntry[]): EntitySpec<FormEntry> {
  return {
    kind: "mutation",
    entries,
    adapter: {
      nativeKind: "FORM",
      originActorId: "crawl-factual",
      getSourcePath: (e) => e.path,
      getSymbolName: (e) => e.enum ?? e.id,
      getSlug: (e) => (e.enum ?? e.id).replace(/[^a-z0-9_]/gi, "_").toLowerCase(),
      getNativeId: (e) => `form:${e.enum ?? e.id}`,
      getCanonicalName: (e) => e.name,
      getOriginalName: (e) => e.enum ?? e.id,
      getLineRange: (e) => ({ lineStart: e.lineStart, lineEnd: e.lineEnd }),
      getDataKey: (e) => e.enum ?? e.id,
      getAttributes: (e) => ({
        description: e.description,
        equivalent_mons: e.equivalentMons,
        short_name: e.shortName,
        long_name: e.longName,
        talisman: e.talisman,
        skill: e.skill,
        melds: e.melds,
        str: e.str,
        dex: e.dex,
        size: e.size,
        hp_mod: e.hpMod,
        ac: e.ac,
        ev: e.ev,
        resists: e.resists,
        fakemuts: e.fakemuts,
        badmuts: e.badmuts,
        can_fly: e.canFly,
        can_swim: e.canSwim,
        can_cast: e.canCast,
        is_badform: e.isBadform,
        changes_anatomy: e.changesAnatomy,
        changes_substance: e.changesSubstance,
        holiness: e.holiness,
        has_blood: e.hasBlood,
        has_hair: e.hasHair,
        has_bones: e.hasBones,
        has_feet: e.hasFeet,
        has_ears: e.hasEars,
        unarmed: e.unarmed,
        unarmed_colour: e.unarmedColour,
        unarmed_name: e.unarmedName,
        unarmed_verbs: e.unarmedVerbs,
        unarmed_brand: e.unarmedBrand,
        shout_verb: e.shoutVerb,
        shout_volume: e.shoutVolume,
        hand_name: e.handName,
        foot_name: e.footName,
        prayer_action: e.prayerAction,
        flesh_name: e.fleshName,
        move_speed: e.moveSpeed,
        offhand_punch: e.offhandPunch,
        special_damage: e.specialDamage,
        special_damage_name: e.specialDamageName,
        body_ac_mult: e.bodyAcMult,
        wiz_name: e.wizName,
      }),
      populationDimension: "forms",
    },
  };
}

function abilitySpec(entries: AbilityEntry[]): EntitySpec<AbilityEntry> {
  return {
    kind: "ability",
    entries,
    adapter: {
      nativeKind: "ABILITY",
      originActorId: "crawl-factual",
      getSourcePath: (e) => e.filePath,
      getSymbolName: (e) => e.nativeId,
      getSlug: (e) => e.nativeId.replace(/[^a-z0-9_]/gi, "_").toLowerCase(),
      getNativeId: (e) => `ability:${e.nativeId}`,
      getCanonicalName: (e) => e.name,
      getOriginalName: (e) => e.nativeId,
      getLineRange: (e) => ({ lineStart: e.lineStart, lineEnd: e.lineEnd }),
      getDataKey: (e) => e.nativeId,
      getAttributes: (e) => ({
        value: e.value,
      }),
      populationDimension: "abilities",
    },
  };
}

function godSpec(entries: GodEntry[]): EntitySpec<GodEntry> {
  return {
    kind: "deity",
    entries,
    adapter: {
      nativeKind: "god",
      originActorId: "crawl-factual",
      getSourcePath: (e) => e.filePath,
      getSymbolName: (e) => e.nativeId,
      getSlug: (e) => e.nativeId.replace(/[^a-z0-9_]/gi, "_").toLowerCase(),
      getNativeId: (e) => `god:${e.nativeId}`,
      getCanonicalName: (e) => e.name,
      getOriginalName: (e) => e.nativeId,
      getLineRange: (e) => ({ lineStart: e.lineStart, lineEnd: e.lineEnd }),
      getDataKey: (e) => e.nativeId,
      getAttributes: () => ({}),
      populationDimension: "gods",
    },
  };
}

function brandSpec(entries: BrandEntry[]): EntitySpec<BrandEntry> {
  return {
    kind: "item",
    entries,
    adapter: {
      nativeKind: "brand",
      originActorId: "crawl-factual",
      getSourcePath: (e) => e.filePath,
      getSymbolName: (e) => e.nativeId,
      getSlug: (e) => e.nativeId.replace(/[^a-z0-9_]/gi, "_").toLowerCase(),
      getNativeId: (e) => `brand:${e.nativeId}`,
      getCanonicalName: (e) => e.name,
      getOriginalName: (e) => e.nativeId,
      getLineRange: (e) => ({ lineStart: e.lineStart, lineEnd: e.lineEnd }),
      getDataKey: (e) => e.nativeId,
      getAttributes: () => ({}),
      populationDimension: "brands",
    },
  };
}

function itemTypeSpec(entries: ItemTypeEntry[]): EntitySpec<ItemTypeEntry> {
  return {
    kind: "item",
    entries,
    adapter: {
      nativeKind: "item_type",
      originActorId: "crawl-factual",
      getSourcePath: (e) => e.filePath,
      getSymbolName: (e) => e.nativeId,
      getSlug: (e) => e.nativeId.replace(/[^a-z0-9_]/gi, "_").toLowerCase(),
      getNativeId: (e) => `item_type:${e.nativeId}`,
      getCanonicalName: (e) => e.name,
      getOriginalName: (e) => e.nativeId,
      getLineRange: (e) => ({ lineStart: e.lineStart, lineEnd: e.lineEnd }),
      getDataKey: (e) => e.nativeId,
      getAttributes: () => ({}),
      populationDimension: "item_types",
    },
  };
}

function cloudSpec(entries: CloudEntry[]): EntitySpec<CloudEntry> {
  return {
    kind: "effect",
    entries,
    adapter: {
      nativeKind: "cloud",
      originActorId: "crawl-factual",
      getSourcePath: (e) => e.filePath,
      getSymbolName: (e) => e.nativeId,
      getSlug: (e) => e.nativeId.replace(/[^a-z0-9_]/gi, "_").toLowerCase(),
      getNativeId: (e) => `cloud:${e.nativeId}`,
      getCanonicalName: (e) => e.name,
      getOriginalName: (e) => e.nativeId,
      getLineRange: (e) => ({ lineStart: e.lineStart, lineEnd: e.lineEnd }),
      getDataKey: (e) => e.nativeId,
      getAttributes: () => ({}),
      populationDimension: "clouds",
    },
  };
}

export function createCrawlExtractor(): Extractor {
  return {
    manifest,
    async run(ctx: ExtractorContext): Promise<ExtractorRunResult> {
      const monsterEntries = collectYamlFiles(
        ctx,
        "mons",
        parseMonsterYaml,
        /^mons\/(README|TEST)/,
      );
      const speciesEntries = collectYamlFiles(
        ctx,
        "species",
        parseSpeciesYaml,
        /^species\/README/,
      );
      const jobEntries = collectYamlFiles(
        ctx,
        "jobs",
        parseJobYaml,
        /^jobs\/README/,
      );
      const formEntries = collectYamlFiles(
        ctx,
        "forms",
        parseFormYaml,
      );

      const sourceRoot = ctx.source.getRoot();
      const rltilesRoot = resolve(sourceRoot, "../rltiles");
      const spriteOutDir = join(process.cwd(), "knowledge/evidence/crawl/sprites");
      const sprite = createCrawlSpritePipeline(rltilesRoot, spriteOutDir);

      // --- Parse .des vault files ---
      const allFiles = ctx.source.walk();
      const desFiles = allFiles.filter(
        (p) => p.startsWith("des/") && p.endsWith(".des") && !p.includes("/test/"),
      );
      const allVaults: VaultEntry[] = [];
      for (const desFile of desFiles) {
        const text = ctx.source.readText(desFile);
        try {
          allVaults.push(...parseDesVaults(text, desFile));
        } catch (err) {
          console.warn(`[crawl-extractor] Failed to parse ${desFile}: ${err}`);
          continue;
        }
      }

      // --- Parse C header files via supplemental root (headers/) ---
      let spellEntries: SpellEntry[] = [];
      try {
        const spellSource = ctx.source.readText("headers/spl-data.h");
        spellEntries = parseSpellData(spellSource, "headers/spl-data.h");
      } catch (err) {
        console.warn(`[crawl-extractor] Failed to parse spl-data.h: ${err}`);
      }

      let branchEntries: BranchEntry[] = [];
      try {
        const branchSource = ctx.source.readText("headers/branch-data.h");
        branchEntries = parseBranchData(branchSource, "headers/branch-data.h");
      } catch (err) {
        console.warn(`[crawl-extractor] Failed to parse branch-data.h: ${err}`);
      }

      let abilityEntries: AbilityEntry[] = [];
      try {
        const abilitySource = ctx.source.readText("headers/ability-type.h");
        abilityEntries = parseAbilityTypes(abilitySource, "headers/ability-type.h");
      } catch (err) {
        console.warn(`[crawl-extractor] Failed to parse ability-type.h: ${err}`);
      }

      let godEntries: GodEntry[] = [];
      try {
        const godSource = ctx.source.readText("headers/god-type.h");
        godEntries = parseGodTypes(godSource, "headers/god-type.h");
      } catch (err) {
        console.warn(`[crawl-extractor] Failed to parse god-type.h: ${err}`);
      }

      let brandEntries: BrandEntry[] = [];
      try {
        const brandSource = ctx.source.readText("headers/item-prop-enum.h");
        brandEntries = parseBrandTypes(brandSource, "headers/item-prop-enum.h");
      } catch (err) {
        console.warn(`[crawl-extractor] Failed to parse item-prop-enum.h: ${err}`);
      }

      let itemTypeEntries: ItemTypeEntry[] = [];
      try {
        const itemTypeSource = ctx.source.readText("headers/object-class-type.h");
        itemTypeEntries = parseObjectClassTypes(itemTypeSource, "headers/object-class-type.h");
      } catch (err) {
        console.warn(`[crawl-extractor] Failed to parse object-class-type.h: ${err}`);
      }

      let cloudEntries: CloudEntry[] = [];
      try {
        const cloudSource = ctx.source.readText("headers/cloud-type.h");
        cloudEntries = parseCloudTypes(cloudSource, "headers/cloud-type.h");
      } catch (err) {
        console.warn(`[crawl-extractor] Failed to parse cloud-type.h: ${err}`);
      }

      const specs: EntitySpec<any>[] = [];
      if (monsterEntries.length > 0) specs.push(monsterSpec(monsterEntries, sprite));
      if (speciesEntries.length > 0) specs.push(speciesSpec(speciesEntries));
      if (jobEntries.length > 0) specs.push(jobSpec(jobEntries));
      if (allVaults.length > 0) specs.push(vaultSpec(allVaults));
      if (spellEntries.length > 0) specs.push(spellSpec(spellEntries));
      if (branchEntries.length > 0) specs.push(branchSpec(branchEntries));
      if (formEntries.length > 0) specs.push(formSpec(formEntries));
      if (abilityEntries.length > 0) specs.push(abilitySpec(abilityEntries));
      if (godEntries.length > 0) specs.push(godSpec(godEntries));
      if (brandEntries.length > 0) specs.push(brandSpec(brandEntries));
      if (itemTypeEntries.length > 0) specs.push(itemTypeSpec(itemTypeEntries));
      if (cloudEntries.length > 0) specs.push(cloudSpec(cloudEntries));

      const { dimensionCounts } = await runEntityPipeline(ctx, specs);

      const popCollector = new PopulationCollector(manifest.exhaustivePopulations ?? [], ctx.output);
      const { populationCounts, recordCount } = popCollector.collect(dimensionCounts);

      return {
        extractorId: manifest.extractorId,
        extractorVersion: "1.0.0",
        runId: "crawl-run",
        recordCount,
        populationCounts,
        diagnostics: [],
      };
    },
  };
}

export { manifest as crawlManifest };
