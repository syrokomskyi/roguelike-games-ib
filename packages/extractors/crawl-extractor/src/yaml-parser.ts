import { parse as parseYaml } from "yaml";

function parseYamlLenient(text: string): Record<string, unknown> | null {
  try {
    const data = parseYaml(text, { uniqueKeys: false });
    if (data && typeof data === "object") return data as Record<string, unknown>;
    return null;
  } catch {
    return null;
  }
}

export interface MonsterEntry {
  id: string;
  name: string;
  glyph: { char: string; colour: string } | null;
  flags: string[];
  exp: number | null;
  will: number | null;
  holiness: string[];
  attacks: Array<{ type: string; damage: string | number }>;
  hd: number;
  hp10x: number;
  ac: number;
  ev: number;
  hasCorpse: boolean;
  intelligence: string;
  speed: number;
  size: string;
  shape: string;
  tile: string | null;
  path: string;
  lineStart: number;
  lineEnd: number;
}

export interface SpeciesEntry {
  id: string;
  enum: string | null;
  monster: string | null;
  name: string;
  difficulty: string | null;
  difficultyPriority: number | null;
  aptitudes: Record<string, number> | null;
  str: number;
  int: number;
  dex: number;
  mutations: Record<string, Record<string, number>> | null;
  recommendedJobs: string[];
  deprecated: boolean;
  path: string;
  lineStart: number;
  lineEnd: number;
}

export interface JobEntry {
  id: string;
  enum: string | null;
  name: string;
  category: string | null;
  categoryPriority: number | null;
  str: number;
  int: number;
  dex: number;
  equipment: string[];
  weaponChoice: string | null;
  recommendedSpecies: string[];
  skills: Record<string, number> | null;
  path: string;
  lineStart: number;
  lineEnd: number;
}

function computeLineRange(text: string): { lineStart: number; lineEnd: number } {
  const lines = text.split("\n");
  return { lineStart: 1, lineEnd: lines.length };
}

export function parseMonsterYaml(text: string, path: string): MonsterEntry | null {
  const data = parseYamlLenient(text);
  if (!data || !data.name) return null;

  const glyph = (data.glyph as { char: string; colour: string } | null) ?? null;
  const attacks = (data.attacks as Array<{ type: string; damage: string | number }>) ?? [];
  const holiness = Array.isArray(data.holiness) ? (data.holiness as string[]) : [];

  const range = computeLineRange(text);

  return {
    id: path.replace(/^mons\//, "").replace(/\.yaml$/, ""),
    name: data.name as string,
    glyph,
    flags: (data.flags as string[]) ?? [],
    exp: (data.exp as number) ?? null,
    will: (data.will as number) ?? null,
    holiness,
    attacks,
    hd: (data.hd as number) ?? 0,
    hp10x: (data.hp_10x as number) ?? 0,
    ac: (data.ac as number) ?? 0,
    ev: (data.ev as number) ?? 0,
    hasCorpse: (data.has_corpse as boolean) ?? false,
    intelligence: (data.intelligence as string) ?? "",
    speed: (data.speed as number) ?? 0,
    size: (data.size as string) ?? "",
    shape: (data.shape as string) ?? "",
    tile: (data.tile as string) ?? null,
    path,
    lineStart: range.lineStart,
    lineEnd: range.lineEnd,
  };
}

export function parseSpeciesYaml(text: string, path: string): SpeciesEntry | null {
  const data = parseYamlLenient(text);
  if (!data || !data.name) return null;

  const range = computeLineRange(text);

  return {
    id: path.replace(/^species\//, "").replace(/\.yaml$/, ""),
    enum: (data.enum as string) ?? null,
    monster: (data.monster as string) ?? null,
    name: data.name as string,
    difficulty: (data.difficulty as string) ?? null,
    difficultyPriority: (data.difficulty_priority as number) ?? null,
    aptitudes: (data.aptitudes as Record<string, number>) ?? null,
    str: (data.str as number) ?? 0,
    int: (data.int as number) ?? 0,
    dex: (data.dex as number) ?? 0,
    mutations: (data.mutations as Record<string, Record<string, number>>) ?? null,
    recommendedJobs: (data.recommended_jobs as string[]) ?? [],
    deprecated: path.startsWith("species/deprecated-"),
    path,
    lineStart: range.lineStart,
    lineEnd: range.lineEnd,
  };
}

export interface FormEntry {
  id: string;
  enum: string | null;
  name: string;
  description: string | null;
  equivalentMons: string | null;
  shortName: string | null;
  longName: string | null;
  talisman: string | null;
  skill: { min: number; max: number } | null;
  melds: string[];
  str: number | null;
  dex: number | null;
  size: string | null;
  hpMod: number | null;
  ac: Record<string, number> | null;
  ev: Record<string, number> | null;
  resists: Record<string, number> | null;
  fakemuts: Array<[string, string]> | null;
  badmuts: Array<[string, string]> | null;
  canFly: boolean | string | null;
  canSwim: boolean | string | null;
  canCast: boolean | string | null;
  isBadform: boolean | string | null;
  changesAnatomy: boolean | string | null;
  changesSubstance: boolean | string | null;
  holiness: string | null;
  hasBlood: boolean | string | null;
  hasHair: boolean | string | null;
  hasBones: boolean | string | null;
  hasFeet: boolean | string | null;
  hasEars: boolean | string | null;
  unarmed: Record<string, unknown> | null;
  unarmedColour: string | null;
  unarmedName: string | null;
  unarmedVerbs: string[] | string | null;
  unarmedBrand: string | null;
  shoutVerb: string | null;
  shoutVolume: number | null;
  handName: string | null;
  footName: string | null;
  prayerAction: string | null;
  fleshName: string | null;
  moveSpeed: number | null;
  offhandPunch: boolean | string | null;
  specialDamage: string | null;
  specialDamageName: string | null;
  bodyAcMult: Record<string, number> | null;
  wizName: string | null;
  path: string;
  lineStart: number;
  lineEnd: number;
}

export function parseFormYaml(text: string, path: string): FormEntry | null {
  const data = parseYamlLenient(text);
  if (!data || !data.enum) return null;

  const range = computeLineRange(text);
  const id = path.replace(/^forms\//, "").replace(/\.yaml$/, "");
  const shortName =
    typeof data.short_name === "string" && data.short_name.length > 0
      ? data.short_name
      : null;
  const enumVal = data.enum as string;

  return {
    id,
    enum: enumVal,
    name: shortName ?? enumVal,
    description: (data.description as string) ?? null,
    equivalentMons: (data.equivalent_mons as string) ?? null,
    shortName,
    longName: (data.long_name as string) ?? null,
    talisman: (data.talisman as string) ?? null,
    skill: (data.skill as { min: number; max: number }) ?? null,
    melds: Array.isArray(data.melds) ? (data.melds as string[]) : [],
    str: (data.str as number) ?? null,
    dex: (data.dex as number) ?? null,
    size: (data.size as string) ?? null,
    hpMod: (data.hp_mod as number) ?? null,
    ac: (data.ac as Record<string, number>) ?? null,
    ev: (data.ev as Record<string, number>) ?? null,
    resists: (data.resists as Record<string, number>) ?? null,
    fakemuts: (data.fakemuts as Array<[string, string]>) ?? null,
    badmuts: (data.badmuts as Array<[string, string]>) ?? null,
    canFly: (data.can_fly as boolean | string) ?? null,
    canSwim: (data.can_swim as boolean | string) ?? null,
    canCast: (data.can_cast as boolean | string) ?? null,
    isBadform: (data.is_badform as boolean | string) ?? null,
    changesAnatomy: (data.changes_anatomy as boolean | string) ?? null,
    changesSubstance: (data.changes_substance as boolean | string) ?? null,
    holiness: (data.holiness as string) ?? null,
    hasBlood: (data.has_blood as boolean | string) ?? null,
    hasHair: (data.has_hair as boolean | string) ?? null,
    hasBones: (data.has_bones as boolean | string) ?? null,
    hasFeet: (data.has_feet as boolean | string) ?? null,
    hasEars: (data.has_ears as boolean | string) ?? null,
    unarmed: (data.unarmed as Record<string, unknown>) ?? null,
    unarmedColour: (data.unarmed_colour as string) ?? null,
    unarmedName: (data.unarmed_name as string) ?? null,
    unarmedVerbs: (data.unarmed_verbs as string[] | string) ?? null,
    unarmedBrand: (data.unarmed_brand as string) ?? null,
    shoutVerb: (data.shout_verb as string) ?? null,
    shoutVolume: (data.shout_volume as number) ?? null,
    handName: (data.hand_name as string) ?? null,
    footName: (data.foot_name as string) ?? null,
    prayerAction: (data.prayer_action as string) ?? null,
    fleshName: (data.flesh_name as string) ?? null,
    moveSpeed: (data.move_speed as number) ?? null,
    offhandPunch: (data.offhand_punch as boolean | string) ?? null,
    specialDamage: (data.special_damage as string) ?? null,
    specialDamageName: (data.special_damage_name as string) ?? null,
    bodyAcMult: (data.body_ac_mult as Record<string, number>) ?? null,
    wizName: (data.wiz_name as string) ?? null,
    path,
    lineStart: range.lineStart,
    lineEnd: range.lineEnd,
  };
}

export function parseJobYaml(text: string, path: string): JobEntry | null {
  const data = parseYamlLenient(text);
  if (!data || !data.name) return null;

  const range = computeLineRange(text);

  return {
    id: path.replace(/^jobs\//, "").replace(/\.yaml$/, ""),
    enum: (data.enum as string) ?? null,
    name: data.name as string,
    category: (data.category as string) ?? null,
    categoryPriority: (data.category_priority as number) ?? null,
    str: (data.str as number) ?? 0,
    int: (data.int as number) ?? 0,
    dex: (data.dex as number) ?? 0,
    equipment: (data.equipment as string[]) ?? [],
    weaponChoice: (data.weapon_choice as string) ?? null,
    recommendedSpecies: (data.recommended_species as string[]) ?? [],
    skills: (data.skills as Record<string, number>) ?? null,
    path,
    lineStart: range.lineStart,
    lineEnd: range.lineEnd,
  };
}
