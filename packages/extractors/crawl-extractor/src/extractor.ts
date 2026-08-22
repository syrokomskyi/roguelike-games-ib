/*
<MODULE_CONTRACT>
<purpose>Crawl factual extractor — parses YAML data files and .des vault definitions, emits creature, species, profession, vault, and sprite records with evidence anchors and population counts.</purpose>
<non-goals>
  <item>Does not parse C source — Crawl data is YAML and .des files only.</item>
  <item>Does not compute design-space relations — factual extraction only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: Crawl extractor with monster, species, job, and vault parsing.</item>
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
import { resolve, join } from "node:path";
import {
  parseMonsterYaml,
  parseSpeciesYaml,
  parseJobYaml,
  type MonsterEntry,
  type SpeciesEntry,
  type JobEntry,
} from "./yaml-parser.ts";
import { createCrawlSpritePipeline } from "./sprite-pipeline.ts";
import { parseDesVaults, type VaultEntry } from "./des-parser.ts";

const SPRITE_TILE_COORDS = { x: 0, y: 0, w: 32, h: 32 };

const manifest: ExtractorManifest = {
  schema: "werkstatt/knowledge-extractor@1",
  extractorId: "crawl-factual",
  extractorVersion: "1.0.0",
  sourceKinds: ["game_repository"],
  recordKinds: ["creature", "species", "profession", "vault"],
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

      const specs: EntitySpec<any>[] = [];
      if (monsterEntries.length > 0) specs.push(monsterSpec(monsterEntries, sprite));
      if (speciesEntries.length > 0) specs.push(speciesSpec(speciesEntries));
      if (jobEntries.length > 0) specs.push(jobSpec(jobEntries));
      if (allVaults.length > 0) specs.push(vaultSpec(allVaults));

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
