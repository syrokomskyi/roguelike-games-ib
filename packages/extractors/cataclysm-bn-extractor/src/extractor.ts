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
</CHANGE_SUMMARY>
*/
import type {
  Extractor,
  ExtractorContext,
  ExtractorRunResult,
  ExtractorManifest,
} from "@roguelike-games-ib/extractor-sdk";
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
    record_type: "game_definition",
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

const MONSTER_DIRS = ["monsters"];
const ITEM_DIRS = ["items"];
const MUTATION_DIRS = ["mutations"];
const PROFESSION_FILES = ["professions.json"];

function walkJsonFiles(allFiles: string[], dir: string): string[] {
  return allFiles.filter((p) => p.startsWith(dir + "/") && p.endsWith(".json"));
}

export function createCataclysmBNExtractor(): Extractor {
  return {
    manifest,
    async run(ctx: ExtractorContext): Promise<ExtractorRunResult> {
      let monsterCount = 0;
      let itemCount = 0;
      let mutationCount = 0;
      let professionCount = 0;

      const allFiles = ctx.source.walk();

      // --- Monsters ---
      for (const dir of MONSTER_DIRS) {
        const files = walkJsonFiles(allFiles, dir);
        for (const file of files) {
          const text = ctx.source.readText(file);
          let monsters: MonsterEntry[];
          try {
            monsters = parseMonsterJson(text, file);
          } catch {
            continue;
          }
          for (const m of monsters) {
            const slug = m.id.replace(/^mon_/, "").replace(/-/g, "_");
            const resolved = ctx.ids.resolveOrCreate("creature", slug, m.id);
            const envelope = makeRecordEnvelope(
              ctx.binding.source_id,
              resolved.key,
              resolved.id,
              "cataclysm-bn-factual",
            );

            const record = {
              ...envelope,
              kind: "creature",
              native_kind: "MONSTER",
              name: { canonical: m.name || m.id, original: m.id },
              source_identity: {
                source_id: ctx.binding.source_id,
                native_id: m.id,
                path: file,
              },
              activation: "active" as const,
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
              evidence_refs: [] as string[],
            };

            ctx.output.writeRecord(record);

            const evidence = ctx.evidence.create({
              artifactPath: file,
              locator: {
                symbol: "MONSTER",
                line_start: m.lineStart,
                line_end: m.lineEnd,
                byte_start: null,
                byte_end: null,
                data_key: m.id,
              },
              fragmentLines: { lineStart: m.lineStart, lineEnd: m.lineEnd },
            });
            ctx.output.writeEvidence(resolved.id, evidence);
            monsterCount++;
          }
        }
      }

      // --- Items ---
      const seenItemIds = new Map<string, number>();
      for (const dir of ITEM_DIRS) {
        const files = walkJsonFiles(allFiles, dir);
        for (const file of files) {
          const text = ctx.source.readText(file);
          let items: ItemEntry[];
          try {
            items = parseItemJson(text, file);
          } catch {
            continue;
          }
          for (const item of items) {
            const { slug, nativeId } = namespaceDuplicateId(item.id, file, "items", seenItemIds);
            const resolved = ctx.ids.resolveOrCreate("item", slug, nativeId);
            const envelope = makeRecordEnvelope(
              ctx.binding.source_id,
              resolved.key,
              resolved.id,
              "cataclysm-bn-factual",
            );

            const record = {
              ...envelope,
              kind: "item",
              native_kind: item.type,
              name: { canonical: item.name || item.id, original: item.id },
              source_identity: {
                source_id: ctx.binding.source_id,
                native_id: nativeId,
                path: file,
              },
              activation: "active" as const,
              attributes: {
                symbol: item.symbol,
                color: item.color,
                price: item.price,
                volume: item.volume,
                weight: item.weight,
                material: item.material,
                flags: item.flags,
              },
              evidence_refs: [] as string[],
            };

            ctx.output.writeRecord(record);

            const evidence = ctx.evidence.create({
              artifactPath: file,
              locator: {
                symbol: item.type,
                line_start: item.lineStart,
                line_end: item.lineEnd,
                byte_start: null,
                byte_end: null,
                data_key: item.id,
              },
              fragmentLines: { lineStart: item.lineStart, lineEnd: item.lineEnd },
            });
            ctx.output.writeEvidence(resolved.id, evidence);
            itemCount++;
          }
        }
      }

      // --- Mutations ---
      const seenMutationIds = new Map<string, number>();
      for (const dir of MUTATION_DIRS) {
        const files = walkJsonFiles(allFiles, dir);
        for (const file of files) {
          const text = ctx.source.readText(file);
          let mutations: MutationEntry[];
          try {
            mutations = parseMutationJson(text, file);
          } catch {
            continue;
          }
          for (const mut of mutations) {
            const { slug, nativeId } = namespaceDuplicateId(mut.id, file, "mutations", seenMutationIds);
            const resolved = ctx.ids.resolveOrCreate("mutation", slug, nativeId);
            const envelope = makeRecordEnvelope(
              ctx.binding.source_id,
              resolved.key,
              resolved.id,
              "cataclysm-bn-factual",
            );

            const record = {
              ...envelope,
              kind: "mutation",
              native_kind: mut.type,
              name: { canonical: mut.name || mut.id, original: mut.id },
              source_identity: {
                source_id: ctx.binding.source_id,
                native_id: nativeId,
                path: file,
              },
              activation: "active" as const,
              attributes: {
                points: mut.points,
                visibility: mut.visibility,
                category: mut.category,
                leads_to: mut.leadsTo,
              },
              evidence_refs: [] as string[],
            };

            ctx.output.writeRecord(record);

            const evidence = ctx.evidence.create({
              artifactPath: file,
              locator: {
                symbol: mut.type,
                line_start: mut.lineStart,
                line_end: mut.lineEnd,
                byte_start: null,
                byte_end: null,
                data_key: mut.id,
              },
              fragmentLines: { lineStart: mut.lineStart, lineEnd: mut.lineEnd },
            });
            ctx.output.writeEvidence(resolved.id, evidence);
            mutationCount++;
          }
        }
      }

      // --- Professions ---
      for (const file of PROFESSION_FILES) {
        if (!allFiles.includes(file)) continue;
        const text = ctx.source.readText(file);
        let professions: ProfessionEntry[];
        try {
          professions = parseProfessionJson(text, file);
        } catch {
          continue;
        }
        for (const prof of professions) {
          const slug = prof.id.replace(/-/g, "_");
          const resolved = ctx.ids.resolveOrCreate("profession", slug, prof.id);
          const envelope = makeRecordEnvelope(
            ctx.binding.source_id,
            resolved.key,
            resolved.id,
            "cataclysm-bn-factual",
          );

          const record = {
            ...envelope,
            kind: "profession",
            native_kind: prof.type,
            name: { canonical: prof.name || prof.id, original: prof.id },
            source_identity: {
              source_id: ctx.binding.source_id,
              native_id: prof.id,
              path: file,
            },
            activation: "active" as const,
            attributes: {},
            evidence_refs: [] as string[],
          };

          ctx.output.writeRecord(record);

          const evidence = ctx.evidence.create({
            artifactPath: file,
            locator: {
              symbol: prof.type,
              line_start: prof.lineStart,
              line_end: prof.lineEnd,
              byte_start: null,
              byte_end: null,
              data_key: prof.id,
            },
            fragmentLines: { lineStart: prof.lineStart, lineEnd: prof.lineEnd },
          });
          ctx.output.writeEvidence(resolved.id, evidence);
          professionCount++;
        }
      }

      ctx.output.writePopulation("monsters", 597, monsterCount);
      ctx.output.writePopulation("items", 5886, itemCount);
      ctx.output.writePopulation("mutations", 625, mutationCount);
      ctx.output.writePopulation("professions", 339, professionCount);

      return {
        extractorId: manifest.extractorId,
        extractorVersion: "1.0.0",
        runId: "cataclysm-bn-run",
        recordCount: monsterCount + itemCount + mutationCount + professionCount,
        populationCounts: [
          { dimension: "monsters", expected: 597, extracted: monsterCount },
          { dimension: "items", expected: 5886, extracted: itemCount },
          { dimension: "mutations", expected: 625, extracted: mutationCount },
          { dimension: "professions", expected: 339, extracted: professionCount },
        ],
        diagnostics: [],
      };
    },
  };
}

export { manifest as cataclysmBnManifest };
