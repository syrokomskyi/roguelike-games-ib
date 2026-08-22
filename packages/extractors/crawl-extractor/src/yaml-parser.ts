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
