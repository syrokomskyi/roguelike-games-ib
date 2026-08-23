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
  parseMonsters,
  parseObjects,
  type MonsterEntry,
  type ObjectEntry,
} from "./c-parser.ts";
import {
  parseArtifacts,
  parseTraps,
  parseRoles,
  parseRaces,
  parseDungeonBranches,
  parseSkills,
  parseAttackTypes,
  parseMonsterAbilities,
  type ArtifactEntry,
  type TrapEntry,
  type RoleEntry,
  type RaceEntry,
  type DungeonBranchEntry,
  type SkillEntry,
  type AttackTypeEntry,
  type MonsterAbilityEntry,
} from "./extra-parsers.ts";

const MONSTERS_H = "monsters.h";
const OBJECTS_H = "objects.h";
const ARTILIST_H = "artilist.h";
const TRAP_H = "trap.h";
const ROLE_C = "role.c";
const DUNGEON_LUA = "dungeon.lua";
const SKILLS_H = "skills.h";
const MONATTK_H = "monattk.h";
const MONFLAG_H = "monflag.h";

const manifest: ExtractorManifest = {
  schema: "werkstatt/knowledge-extractor@1",
  extractorId: "nethack-factual",
  extractorVersion: "1.0.0",
  sourceKinds: ["game_repository"],
  recordKinds: ["creature", "item", "artifact", "trap", "class", "species", "branch", "skill", "damage_type", "ability"],
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
    {
      dimension: "artifacts",
      denominatorKind: "extractor_population",
      expected: 33,
      description: "All artifacts in artilist.h (A() entries, excluding dummy #0, #if 0 Palantir, and terminator)",
    },
    {
      dimension: "traps",
      denominatorKind: "extractor_population",
      expected: 25,
      description: "All trap types in trap.h (enum trap_types entries 1-25, excluding ALL_TRAPS, NO_TRAP, TRAPNUM sentinels)",
    },
    {
      dimension: "roles",
      denominatorKind: "extractor_population",
      expected: 13,
      description: "All roles in role.c (struct Role entries, excluding UNDEFINED_ROLE terminator)",
    },
    {
      dimension: "races",
      denominatorKind: "extractor_population",
      expected: 5,
      description: "All races in role.c (struct Race entries, excluding UNDEFINED_RACE terminator)",
    },
    {
      dimension: "branches",
      denominatorKind: "extractor_population",
      expected: 9,
      description: "All dungeon branches in dungeon.lua (top-level entries in dungeon table)",
    },
    {
      dimension: "skills",
      denominatorKind: "extractor_population",
      expected: 37,
      description: "All skills in skills.h (enum p_skills entries P_DAGGER through P_RIDING, excluding P_NONE and P_NUM_SKILLS sentinels)",
    },
    {
      dimension: "attack_types",
      denominatorKind: "extractor_population",
      expected: 17,
      description: "All AT_* #define entries in monattk.h (excluding AT_ANY wildcard)",
    },
    {
      dimension: "monster_abilities",
      denominatorKind: "extractor_population",
      expected: 72,
      description: "All M1_*/M2_*/M3_* #define entries in monflag.h (excluding composite aliases M1_NOLIMBS, M1_OMNIVORE, M3_WANTSALL, M3_COVETOUS, M3_WAITMASK)",
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
      const artilistH = ctx.source.readText(ARTILIST_H);
      const trapH = ctx.source.readText(TRAP_H);
      const roleC = ctx.source.readText(ROLE_C);
      const dungeonLua = ctx.source.readText(DUNGEON_LUA);
      const skillsH = ctx.source.readText(SKILLS_H);
      const monattkH = ctx.source.readText(MONATTK_H);
      const monflagH = ctx.source.readText(MONFLAG_H);

      const artifacts = parseArtifacts(artilistH);
      const traps = parseTraps(trapH);
      const roles = parseRoles(roleC);
      const races = parseRaces(roleC);
      const branches = parseDungeonBranches(dungeonLua);
      const skills = parseSkills(skillsH);
      const attackTypes = parseAttackTypes(monattkH);
      const monsterAbilities = parseMonsterAbilities(monflagH);

      const creatureSpec: EntitySpec<MonsterEntry> = {
        kind: "creature",
        entries: monsters,
        adapter: {
          nativeKind: "mon",
          originActorId: "nethack-factual",
          getSourcePath: () => MONSTERS_H,
          getSymbolName: () => "MON",
          getSlug: (m) => m.nativeId,
          getNativeId: (m) => `creature:${m.nativeId}`,
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
          populationDimension: "creatures",
        },
      };

      const itemSpec: EntitySpec<ObjectEntry> = {
        kind: "item",
        entries: objects,
        adapter: {
          nativeKind: "obj",
          originActorId: "nethack-factual",
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
          populationDimension: "items",
        },
      };

      const artifactSpec: EntitySpec<ArtifactEntry> = {
        kind: "artifact",
        entries: artifacts,
        adapter: {
          nativeKind: "arti",
          originActorId: "nethack-factual",
          getSourcePath: () => ARTILIST_H,
          getSymbolName: (a) => a.enumName,
          getSlug: (a) => a.enumName.toLowerCase(),
          getNativeId: (a) => `artifact:${a.enumName}`,
          getCanonicalName: (a) => a.name,
          getOriginalName: (a) => a.name,
          getLineRange: (a) => ({ lineStart: a.lineStart, lineEnd: a.lineEnd }),
          getDataKey: (a) => a.enumName,
          getAttributes: (a) => ({
            artifact_type: a.artifactType,
            spfx: a.spfx,
            spfx2: a.spfx2,
            monster_type: a.monsterType,
            attack: a.attack,
            defense: a.defense,
            carry: a.carry,
            invocation: a.invocation,
            alignment: a.alignment,
            role_class: a.roleClass,
            race: a.race,
            gen_spe: a.genSpe,
            gift_value: a.giftValue,
            cost: a.cost,
            color: a.color,
          }),
          populationDimension: "artifacts",
        },
      };

      const trapSpec: EntitySpec<TrapEntry> = {
        kind: "trap",
        entries: traps,
        adapter: {
          nativeKind: "trap",
          originActorId: "nethack-factual",
          getSourcePath: () => TRAP_H,
          getSymbolName: (t) => t.name,
          getSlug: (t) => t.name.toLowerCase(),
          getNativeId: (t) => `trap:${t.name}`,
          getCanonicalName: (t) => t.name.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()),
          getOriginalName: (t) => t.name,
          getLineRange: (t) => ({ lineStart: t.lineStart, lineEnd: t.lineEnd }),
          getDataKey: (t) => t.name,
          getAttributes: (t) => ({
            trap_value: t.value,
          }),
          populationDimension: "traps",
        },
      };

      const roleSpec: EntitySpec<RoleEntry> = {
        kind: "class",
        entries: roles,
        adapter: {
          nativeKind: "role",
          originActorId: "nethack-factual",
          getSourcePath: () => ROLE_C,
          getSymbolName: (r) => r.filecode,
          getSlug: (r) => r.name.toLowerCase(),
          getNativeId: (r) => `class:${r.name.toLowerCase()}`,
          getCanonicalName: (r) => r.name,
          getOriginalName: (r) => r.name,
          getLineRange: (r) => ({ lineStart: r.lineStart, lineEnd: r.lineEnd }),
          getDataKey: (r) => r.filecode,
          getAttributes: (r) => ({
            female_name: r.femaleName,
            filecode: r.filecode,
            homebase: r.homebase,
            intermed: r.intermed,
            monster_index: r.monsterIndex,
            leader_index: r.leaderIndex,
            nemesis_index: r.nemesisIndex,
            quest_artifact: r.questArtifact,
            allowed_mask: r.allowedMask,
          }),
          populationDimension: "roles",
        },
      };

      const raceSpec: EntitySpec<RaceEntry> = {
        kind: "species",
        entries: races,
        adapter: {
          nativeKind: "race",
          originActorId: "nethack-factual",
          getSourcePath: () => ROLE_C,
          getSymbolName: (r) => r.filecode,
          getSlug: (r) => r.noun.toLowerCase(),
          getNativeId: (r) => `species:${r.noun.toLowerCase()}`,
          getCanonicalName: (r) => r.noun,
          getOriginalName: (r) => r.noun,
          getLineRange: (r) => ({ lineStart: r.lineStart, lineEnd: r.lineEnd }),
          getDataKey: (r) => r.filecode,
          getAttributes: (r) => ({
            adjective: r.adj,
            collective: r.collective,
            filecode: r.filecode,
            monster_index: r.monsterIndex,
            mummy_index: r.mummyIndex,
            zombie_index: r.zombieIndex,
            allowed_mask: r.allowedMask,
          }),
          populationDimension: "races",
        },
      };

      const branchSpec: EntitySpec<DungeonBranchEntry> = {
        kind: "branch",
        entries: branches,
        adapter: {
          nativeKind: "dgn",
          originActorId: "nethack-factual",
          getSourcePath: () => DUNGEON_LUA,
          getSymbolName: (b) => b.name,
          getSlug: (b) => b.name.replace(/\s+/g, "_").toLowerCase(),
          getNativeId: (b) => `branch:${b.name.replace(/\s+/g, "_").toLowerCase()}`,
          getCanonicalName: (b) => b.name,
          getOriginalName: (b) => b.name,
          getLineRange: (b) => ({ lineStart: b.lineStart, lineEnd: b.lineEnd }),
          getDataKey: (b) => b.name,
          getAttributes: (b) => ({
            bonetag: b.bonetag,
            base: b.base,
            range: b.range,
            alignment: b.alignment,
            flags: b.flags,
          }),
          populationDimension: "branches",
        },
      };

      const skillSpec: EntitySpec<SkillEntry> = {
        kind: "skill",
        entries: skills,
        adapter: {
          nativeKind: "pskill",
          originActorId: "nethack-factual",
          getSourcePath: () => SKILLS_H,
          getSymbolName: (s) => s.name,
          getSlug: (s) => s.name.replace(/^P_/, "").toLowerCase(),
          getNativeId: (s) => `skill:${s.name}`,
          getCanonicalName: (s) => s.name.replace(/^P_/, "").replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()),
          getOriginalName: (s) => s.name,
          getLineRange: (s) => ({ lineStart: s.lineStart, lineEnd: s.lineEnd }),
          getDataKey: (s) => s.name,
          getAttributes: (s) => ({
            skill_value: s.value,
          }),
          populationDimension: "skills",
        },
      };

      const attackTypeSpec: EntitySpec<AttackTypeEntry> = {
        kind: "damage_type",
        entries: attackTypes,
        adapter: {
          nativeKind: "attack_type",
          originActorId: "nethack-factual",
          getSourcePath: () => MONATTK_H,
          getSymbolName: (a) => a.nativeId,
          getSlug: (a) => a.nativeId.replace(/^AT_/, "").toLowerCase(),
          getNativeId: (a) => `attack_type:${a.nativeId}`,
          getCanonicalName: (a) => a.name,
          getOriginalName: (a) => a.nativeId,
          getLineRange: (a) => ({ lineStart: a.lineStart, lineEnd: a.lineEnd }),
          getDataKey: (a) => a.nativeId,
          getAttributes: (a) => ({
            value: a.value,
          }),
          populationDimension: "attack_types",
        },
      };

      const monsterAbilitySpec: EntitySpec<MonsterAbilityEntry> = {
        kind: "ability",
        entries: monsterAbilities,
        adapter: {
          nativeKind: "monster_ability",
          originActorId: "nethack-factual",
          getSourcePath: () => MONFLAG_H,
          getSymbolName: (a) => a.nativeId,
          getSlug: (a) => a.nativeId.replace(/^M[123]_/, "").toLowerCase(),
          getNativeId: (a) => `monster_ability:${a.nativeId}`,
          getCanonicalName: (a) => a.name,
          getOriginalName: (a) => a.nativeId,
          getLineRange: (a) => ({ lineStart: a.lineStart, lineEnd: a.lineEnd }),
          getDataKey: (a) => a.nativeId,
          getAttributes: (a) => ({
            flag_group: a.flagGroup,
          }),
          populationDimension: "monster_abilities",
        },
      };

      const { dimensionCounts } = await runEntityPipeline(ctx, [
        creatureSpec,
        itemSpec,
        artifactSpec,
        trapSpec,
        roleSpec,
        raceSpec,
        branchSpec,
        skillSpec,
        attackTypeSpec,
        monsterAbilitySpec,
      ]);

      const popCollector = new PopulationCollector(manifest.exhaustivePopulations ?? [], ctx.output);
      const { populationCounts, recordCount } = popCollector.collect(dimensionCounts);

      return {
        extractorId: manifest.extractorId,
        extractorVersion: "1.0.0",
        runId: "nethack-run",
        recordCount,
        populationCounts,
        diagnostics: [],
      };
    },
  };
}

export { manifest as nethackManifest };
