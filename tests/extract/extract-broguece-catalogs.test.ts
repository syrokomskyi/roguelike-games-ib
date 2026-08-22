import { describe, it, expect } from "vitest";
import {
  parseMutationCatalog,
  parseDungeonFeatureCatalog,
  parseLightCatalog,
  parseMonsterClassCatalog,
} from "@roguelike-games-ib/broguece-extractor";

const MUTATION_SOURCE = `const mutation mutationCatalog[NUMBER_MUTATORS] = {
    //Title         textColor       healthFactor    moveSpdMult attackSpdMult   defMult damMult DF% DFtype  light   monstFlags  abilityFlags    forbiddenFlags      forbiddenAbilities      canBeNegated
    {"explosive",   &orange,        50,             100,        100,            50,     100,    0,  DF_MUTATION_EXPLOSION, EXPLOSIVE_BLOAT_LIGHT, 0, MA_DF_ON_DEATH, MONST_SUBMERGES, 0,
        "A rare mutation will cause $HIMHER to explode violently when $HESHE dies.",    true},
    {"infested",    &lichenColor,   50,             100,        100,            50,     100,    0,  DF_MUTATION_LICHEN, 0, 0,   MA_DF_ON_DEATH, 0,               0,
        "$HESHE has been infested by deadly lichen spores; poisonous fungus will spread from $HISHER corpse when $HESHE dies.", true},
    {"agile",       &green,         100,            70,         100,            100,    100,    0,  0, 0, 0, 0, 0, 0,
        "A rare mutation has hardened $HISHER flesh, increasing $HISHER health and power but compromising $HISHER speed.", false},
};`;

const DUNGEON_FEATURE_SOURCE = `dungeonFeature dungeonFeatureCatalog[NUMBER_DUNGEON_FEATURES] = {
    // tileType                 layer       start   decr    fl  txt  flare   fCol fRad  propTerrain subseqDF
    {0}, // nothing
    {GRANITE,                   DUNGEON,    80,     70,     DFF_CLEAR_OTHER_TERRAIN},
    {BONES,                     SURFACE,    75,     23,     0},

    // misc. liquids
    {SUNLIGHT_POOL,             LIQUID,     65,     6,      0},
    {DARKNESS_PATCH,            LIQUID,     65,     11,     0},

    // bloods
    // Base probability is 15 + (damage * 2/3), and then take the given percentage of that.
    // If it's a gas, we multiply the base by an additional 100.
    {RED_BLOOD,                 SURFACE,    100,    25,     0},
    {GREEN_BLOOD,               SURFACE,    100,    25,     0},
};`;

const LIGHT_SOURCE = `const lightSource lightCatalog[NUMBER_LIGHT_KINDS] = {
    //color                 radius range            fade%   passThroughCreatures
    {0},                                                                // NO_LIGHT
    {&minersLightColor,     {0, 0, 1},              35,     true},      // miners light
    {&fireBoltColor,        {300, 400, 1},          0,      false},     // burning creature light

    // flares:
    {&scrollProtectionColor,{600, 600, 1},          0,      true},      // scroll of protection flare

    // glowing terrain:
    {&torchLightColor,      {1000, 1000, 1},        50,     false},     // torch
    {&lavaLightColor,       {300, 300, 1},          50,     false},     // lava
};`;

const MONSTER_CLASS_SOURCE = `const monsterClassCatalog[MONSTER_CLASS_COUNT] = {
    {"vermin", 0, 0, 1, 4, 0, {MK_RAT, MK_KOBOLD, MK_JACKAL, MK_EEL, MK_MONKEY, MK_BLOAT, MK_PIT_BLOAT, MK_GOBLIN, MK_GOBLIN_CONJURER, MK_GOBLIN_MYSTIC}},
    {"humanoids", 0, 0, 5, 9, 0, {MK_GOBLIN, MK_GOBLIN_CONJURER, MK_GOBLIN_MYSTIC}},
    {"slimes", 0, 0, 10, 14, 0, {MK_PINK_JELLY, MK_GREEN_JELLY, MK_BLUE_JELLY}},
};`;

describe("EXT-CATALOG: BrogueCE catalog parser entry patterns", () => {
  describe("parseMutationCatalog", () => {
    it("returns exactly 8 entries for 8 mutations (not 16 from description lines)", () => {
      const entries = parseMutationCatalog(MUTATION_SOURCE);
      expect(entries).toHaveLength(3);
    });

    it("extracts correct mutation names as nativeId", () => {
      const entries = parseMutationCatalog(MUTATION_SOURCE);
      const ids = entries.map((e) => e.nativeId);
      expect(ids).toContain("explosive");
      expect(ids).toContain("infested");
      expect(ids).toContain("agile");
    });

    it("does not create entries from description strings", () => {
      const entries = parseMutationCatalog(MUTATION_SOURCE);
      const ids = entries.map((e) => e.nativeId);
      expect(ids).not.toContain("a_rare_mutation_will_cause_$himher_to_explode_violently_when_$heshe_dies.");
      expect(ids).not.toContain("a_rare_mutation_has_hardened_$hisher_flesh,_increasing_$hisher_health_and_power_but_compromising_$hisher_speed.");
    });

    it("extracts descriptions as attributes, not as entry names", () => {
      const entries = parseMutationCatalog(MUTATION_SOURCE);
      const explosive = entries.find((e) => e.nativeId === "explosive");
      expect(explosive).toBeDefined();
      expect(explosive!.description).toContain("explode violently");
      expect(explosive!.description.length).toBeGreaterThan(20);
    });
  });

  describe("parseDungeonFeatureCatalog", () => {
    it("matches data entries, not standalone comment lines", () => {
      const entries = parseDungeonFeatureCatalog(DUNGEON_FEATURE_SOURCE);
      const ids = entries.map((e) => e.nativeId);
      expect(ids).not.toContain("MISC._LIQUIDS");
      expect(ids).not.toContain("BLOODS");
      expect(ids).not.toContain("BASE_PROBABILITY_IS_15_+_(DAMAGE_*_2/3),_AND_THEN_TAKE_THE_GIVEN_PERCENTAGE_OF_THAT.");
      expect(ids).not.toContain("IF_IT'S_A_GAS,_WE_MULTIPLY_THE_BASE_BY_AN_ADDITIONAL_100.");
    });

    it("extracts correct tile types as nativeId", () => {
      const entries = parseDungeonFeatureCatalog(DUNGEON_FEATURE_SOURCE);
      const ids = entries.map((e) => e.nativeId);
      expect(ids).toContain("NOTHING");
      expect(ids).toContain("GRANITE");
      expect(ids).toContain("BONES");
      expect(ids).toContain("SUNLIGHT_POOL");
      expect(ids).toContain("DARKNESS_PATCH");
      expect(ids).toContain("RED_BLOOD");
      expect(ids).toContain("GREEN_BLOOD");
    });

    it("returns correct count of unique tile types", () => {
      const entries = parseDungeonFeatureCatalog(DUNGEON_FEATURE_SOURCE);
      expect(entries).toHaveLength(7);
    });

    it("uses inline comment as description when available", () => {
      const entries = parseDungeonFeatureCatalog(DUNGEON_FEATURE_SOURCE);
      const granite = entries.find((e) => e.nativeId === "GRANITE");
      expect(granite).toBeDefined();
      // GRANITE has no inline comment, so description falls back to nativeId
      expect(granite!.description).toBe("GRANITE");

      const nothing = entries.find((e) => e.nativeId === "NOTHING");
      expect(nothing).toBeDefined();
      expect(nothing!.description).toBe("nothing");
    });
  });

  describe("parseLightCatalog", () => {
    it("matches data entries with inline comments, not standalone comment lines", () => {
      const entries = parseLightCatalog(LIGHT_SOURCE);
      const ids = entries.map((e) => e.nativeId);
      expect(ids).not.toContain("FLARES:");
      expect(ids).not.toContain("GLOWING_TERRAIN:");
      expect(ids).not.toContain("COLOR_RADIUS_RANGE_FADE%_PASSTHROUGHCREATURES");
    });

    it("extracts correct light names from inline comments", () => {
      const entries = parseLightCatalog(LIGHT_SOURCE);
      const ids = entries.map((e) => e.nativeId);
      expect(ids).toContain("NO_LIGHT");
      expect(ids).toContain("MINERS_LIGHT");
      expect(ids).toContain("BURNING_CREATURE_LIGHT");
      expect(ids).toContain("SCROLL_OF_PROTECTION_FLARE");
      expect(ids).toContain("TORCH");
      expect(ids).toContain("LAVA");
    });

    it("returns correct count", () => {
      const entries = parseLightCatalog(LIGHT_SOURCE);
      expect(entries).toHaveLength(6);
    });
  });

  describe("parseMonsterClassCatalog", () => {
    it("matches entry-start lines, not description lines", () => {
      const entries = parseMonsterClassCatalog(MONSTER_CLASS_SOURCE);
      expect(entries).toHaveLength(3);
    });

    it("extracts correct class names as nativeId", () => {
      const entries = parseMonsterClassCatalog(MONSTER_CLASS_SOURCE);
      const ids = entries.map((e) => e.nativeId);
      expect(ids).toContain("vermin");
      expect(ids).toContain("humanoids");
      expect(ids).toContain("slimes");
    });
  });
});
