import { describe, it, expect } from "vitest";
import {
  parseMonsterYaml,
  parseSpeciesYaml,
  parseJobYaml,
} from "@roguelike-games-ib/crawl-extractor";

const BAT_YAML = `name: "bat"
glyph: {char: "b", colour: lightgray}
flags: [flies, see_invis, unblindable, batty, warm_blood]
exp: 1
will: 0
attacks:
 - {type: hit, damage: 1}
hd: 1
hp_10x: 35
ac: 1
ev: 14
has_corpse: true
intelligence: animal
speed: 30
size: tiny
shape: bat`;

const DRAGON_YAML = `name: "dragon"
glyph: {char: "D", colour: green}
flags: [cant_spawn]
holiness: [nonliving]
will: 10
attacks:
hd: 0
hp_10x: 0
ac: 0
ev: 0
has_corpse: true
intelligence: brainless
speed: 0
size: medium
shape: misc
tile: fire_dragon`;

const MINOTAUR_YAML = `enum: SP_MINOTAUR
monster: MONS_MINOTAUR
name: Minotaur
difficulty: Simple
difficulty_priority: 90
aptitudes:
  xp: -1
  hp: 1
  mp_mod: -1
  fighting: 2
  axes: 2
str: 12
int: 5
dex: 5
levelup_stat_frequency: 4
levelup_stats:
  - str
  - dex
mutations:
  1:
    MUT_HORNS: 2
    MUT_REFLEXIVE_HEADBUTT: 1
recommended_jobs:
  - fighter
  - gladiator
  - monk`;

const FIGHTER_YAML = `enum: JOB_FIGHTER
name: "Fighter"
category: Warrior
category_priority: 100
str: 8
int: 0
dex: 4
equipment:
  - "scale mail"
  - "buckler"
  - "potion of might q:2"
weapon_choice: good
recommended_species:
  - mountain dwarf
  - troll
  - minotaur
skills:
  fighting: 3
  armour: 3
  shields: 3
  weapon: 2
create_enum: false`;

describe("Crawl YAML parsers", () => {
  describe("parseMonsterYaml", () => {
    it("parses bat monster with all attributes", () => {
      const m = parseMonsterYaml(BAT_YAML, "mons/bat.yaml");
      expect(m).not.toBeNull();
      expect(m!.id).toBe("bat");
      expect(m!.name).toBe("bat");
      expect(m!.glyph).toEqual({ char: "b", colour: "lightgray" });
      expect(m!.flags).toContain("flies");
      expect(m!.flags).toContain("batty");
      expect(m!.exp).toBe(1);
      expect(m!.will).toBe(0);
      expect(m!.hd).toBe(1);
      expect(m!.hp10x).toBe(35);
      expect(m!.ac).toBe(1);
      expect(m!.ev).toBe(14);
      expect(m!.hasCorpse).toBe(true);
      expect(m!.intelligence).toBe("animal");
      expect(m!.speed).toBe(30);
      expect(m!.size).toBe("tiny");
      expect(m!.shape).toBe("bat");
      expect(m!.attacks).toEqual([{ type: "hit", damage: 1 }]);
    });

    it("parses dragon with holiness and no attacks", () => {
      const m = parseMonsterYaml(DRAGON_YAML, "mons/dragon.yaml");
      expect(m).not.toBeNull();
      expect(m!.id).toBe("dragon");
      expect(m!.name).toBe("dragon");
      expect(m!.glyph).toEqual({ char: "D", colour: "green" });
      expect(m!.flags).toContain("cant_spawn");
      expect(m!.holiness).toEqual(["nonliving"]);
      expect(m!.will).toBe(10);
      expect(m!.attacks).toEqual([]);
    });

    it("returns null for empty or invalid YAML", () => {
      expect(parseMonsterYaml("", "mons/empty.yaml")).toBeNull();
      expect(parseMonsterYaml("invalid: yaml: :", "mons/bad.yaml")).toBeNull();
    });
  });

  describe("parseSpeciesYaml", () => {
    it("parses minotaur species with aptitudes and mutations", () => {
      const s = parseSpeciesYaml(MINOTAUR_YAML, "species/minotaur.yaml");
      expect(s).not.toBeNull();
      expect(s!.id).toBe("minotaur");
      expect(s!.enum).toBe("SP_MINOTAUR");
      expect(s!.monster).toBe("MONS_MINOTAUR");
      expect(s!.name).toBe("Minotaur");
      expect(s!.difficulty).toBe("Simple");
      expect(s!.difficultyPriority).toBe(90);
      expect(s!.aptitudes).not.toBeNull();
      expect(s!.aptitudes!.fighting).toBe(2);
      expect(s!.aptitudes!.axes).toBe(2);
      expect(s!.str).toBe(12);
      expect(s!.int).toBe(5);
      expect(s!.dex).toBe(5);
      expect(s!.recommendedJobs).toContain("fighter");
      expect(s!.recommendedJobs).toContain("gladiator");
      expect(s!.mutations).not.toBeNull();
      expect(s!.mutations!["1"]).toEqual({ MUT_HORNS: 2, MUT_REFLEXIVE_HEADBUTT: 1 });
    });

    it("returns null for empty or invalid YAML", () => {
      expect(parseSpeciesYaml("", "species/empty.yaml")).toBeNull();
    });
  });

  describe("parseJobYaml", () => {
    it("parses fighter job with equipment and skills", () => {
      const j = parseJobYaml(FIGHTER_YAML, "jobs/fighter.yaml");
      expect(j).not.toBeNull();
      expect(j!.id).toBe("fighter");
      expect(j!.enum).toBe("JOB_FIGHTER");
      expect(j!.name).toBe("Fighter");
      expect(j!.category).toBe("Warrior");
      expect(j!.categoryPriority).toBe(100);
      expect(j!.str).toBe(8);
      expect(j!.int).toBe(0);
      expect(j!.dex).toBe(4);
      expect(j!.equipment).toContain("scale mail");
      expect(j!.weaponChoice).toBe("good");
      expect(j!.recommendedSpecies).toContain("mountain dwarf");
      expect(j!.recommendedSpecies).toContain("minotaur");
      expect(j!.skills).not.toBeNull();
      expect(j!.skills!.fighting).toBe(3);
      expect(j!.skills!.armour).toBe(3);
    });

    it("returns null for empty or invalid YAML", () => {
      expect(parseJobYaml("", "jobs/empty.yaml")).toBeNull();
    });
  });
});
