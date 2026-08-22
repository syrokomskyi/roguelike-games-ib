import { parseJsonEntries, type JsonEntrySpec } from "./json-parser.ts";

function extractName(nameField: unknown): string {
  if (typeof nameField === "string") return nameField;
  if (nameField && typeof nameField === "object") {
    const obj = nameField as Record<string, unknown>;
    if (typeof obj.str === "string") return obj.str;
    if (typeof obj.str_sp === "string") return obj.str_sp;
    if (typeof obj.str_pl === "string") return obj.str_pl;
  }
  return "";
}

export interface BionicEntry {
  id: string;
  type: string;
  name: string;
  description: string;
  actCost: number;
  reactCost: number;
  powerOverTime: number;
  chargeTime: number;
  capacity: number;
  difficulty: number;
  flags: string[];
  occupiedBodyparts: string[];
  path: string;
  lineStart: number;
  lineEnd: number;
}

export function parseBionicJson(text: string, path: string): BionicEntry[] {
  return parseJsonEntries(text, path, {
    filter: (o) => o.id != null && o.type === "bionic",
    extract: (o, path, lineStart, lineEnd) => ({
      id: o.id as string,
      type: o.type as string,
      name: extractName(o.name),
      description: (o.description as string) ?? "",
      actCost: (o.act_cost as number) ?? 0,
      reactCost: (o.reactor_cost as number) ?? 0,
      powerOverTime: (o.power_over_time as number) ?? 0,
      chargeTime: (o.charge_time as number) ?? 0,
      capacity: (o.capacity as number) ?? 0,
      difficulty: (o.difficulty as number) ?? 0,
      flags: (o.flags as string[]) ?? [],
      occupiedBodyparts: o.occupied_bodyparts ? Object.keys(o.occupied_bodyparts as Record<string, unknown>) : [],
      path,
      lineStart,
      lineEnd,
    }),
  });
}

export interface TrapEntry {
  id: string;
  type: string;
  name: string;
  description: string;
  color: string;
  symbol: string;
  visibility: number;
  avoidance: number;
  difficulty: number;
  action: string;
  bashDmg: string;
  flags: string[];
  path: string;
  lineStart: number;
  lineEnd: number;
}

export function parseTrapJson(text: string, path: string): TrapEntry[] {
  return parseJsonEntries(text, path, {
    filter: (o) => o.id != null && o.type === "trap",
    extract: (o, path, lineStart, lineEnd) => ({
      id: o.id as string,
      type: o.type as string,
      name: extractName(o.name),
      description: (o.description as string) ?? "",
      color: (o.color as string) ?? "",
      symbol: (o.symbol as string) ?? "",
      visibility: (o.visibility as number) ?? 0,
      avoidance: (o.avoidance as number) ?? 0,
      difficulty: (o.difficulty as number) ?? 0,
      action: (o.action as string) ?? "",
      bashDmg: (o.bash_dmg as string) ?? "",
      flags: (o.flags as string[]) ?? [],
      path,
      lineStart,
      lineEnd,
    }),
  });
}

export interface RecipeEntry {
  id: string;
  type: string;
  result: string;
  category: string;
  subtype: string;
  time: number;
  difficulty: number;
  skills: unknown[];
  tools: unknown[];
  components: unknown[];
  charges: number;
  flags: string[];
  path: string;
  lineStart: number;
  lineEnd: number;
}

export function parseRecipeJson(text: string, path: string): RecipeEntry[] {
  return parseJsonEntries(text, path, {
    filter: (o) => o.type === "recipe",
    extract: (o, path, lineStart, lineEnd) => ({
      id: (o.id as string) ?? (o.result as string) ?? "",
      type: o.type as string,
      result: (o.result as string) ?? "",
      category: (o.category as string) ?? "",
      subtype: (o.subtype as string) ?? "",
      time: (o.time as number) ?? 0,
      difficulty: (o.difficulty as number) ?? 0,
      skills: (o.skills as unknown[]) ?? [],
      tools: (o.tools as unknown[]) ?? [],
      components: (o.components as unknown[]) ?? [],
      charges: (o.charges as number) ?? 0,
      flags: (o.flags as string[]) ?? [],
      path,
      lineStart,
      lineEnd,
    }),
  });
}

export interface SkillEntry {
  id: string;
  type: string;
  name: string;
  description: string;
  displayCategory: string;
  displayOrder: number;
  path: string;
  lineStart: number;
  lineEnd: number;
}

export function parseSkillJson(text: string, path: string): SkillEntry[] {
  return parseJsonEntries(text, path, {
    filter: (o) => o.id != null && o.type === "skill",
    extract: (o, path, lineStart, lineEnd) => ({
      id: o.id as string,
      type: o.type as string,
      name: extractName(o.name),
      description: (o.description as string) ?? "",
      displayCategory: (o.display_category as string) ?? "",
      displayOrder: (o.display_order as number) ?? 0,
      path,
      lineStart,
      lineEnd,
    }),
  });
}

export interface EffectEntry {
  id: string;
  type: string;
  name: string;
  description: string;
  maxDuration: number;
  permanent: boolean;
  flags: string[];
  path: string;
  lineStart: number;
  lineEnd: number;
}

export function parseEffectJson(text: string, path: string): EffectEntry[] {
  return parseJsonEntries(text, path, {
    filter: (o) => o.id != null && o.type === "effect_type",
    extract: (o, path, lineStart, lineEnd) => ({
      id: o.id as string,
      type: o.type as string,
      name: extractName(o.name),
      description: (o.desc as string) ?? "",
      maxDuration: (o.max_duration as number) ?? 0,
      permanent: (o.permanent as boolean) ?? false,
      flags: (o.flags as string[]) ?? [],
      path,
      lineStart,
      lineEnd,
    }),
  });
}

export interface FactionEntry {
  id: string;
  type: string;
  name: string;
  description: string;
  likesU: number;
  respectsU: number;
  knownByU: number;
  size: number;
  power: number;
  foodSupply: number;
  wealth: number;
  currency: string;
  monFaction: string;
  baseFaction: string;
  relations: unknown[];
  friendly: string[];
  neutral: string[];
  byMood: string[];
  path: string;
  lineStart: number;
  lineEnd: number;
}

export function parseNpcFactionJson(text: string, path: string): FactionEntry[] {
  return parseJsonEntries(text, path, {
    filter: (o) => o.id != null && o.type === "faction",
    extract: (o, path, lineStart, lineEnd) => ({
      id: o.id as string,
      type: o.type as string,
      name: extractName(o.name),
      description: (o.description as string) ?? "",
      likesU: (o.likes_u as number) ?? 0,
      respectsU: (o.respects_u as number) ?? 0,
      knownByU: (o.known_by_u as number) ?? 0,
      size: (o.size as number) ?? 0,
      power: (o.power as number) ?? 0,
      foodSupply: (o.food_supply as number) ?? 0,
      wealth: (o.wealth as number) ?? 0,
      currency: (o.currency as string) ?? "",
      monFaction: (o.mon_faction as string) ?? "",
      baseFaction: "",
      relations: (o.relations as unknown[]) ?? [],
      friendly: [],
      neutral: [],
      byMood: [],
      path,
      lineStart,
      lineEnd,
    }),
  });
}

export function parseMonsterFactionJson(text: string, path: string): FactionEntry[] {
  return parseJsonEntries(text, path, {
    filter: (o) => o.name != null && o.type === "MONSTER_FACTION",
    extract: (o, path, lineStart, lineEnd) => ({
      id: (o.name as string),
      type: o.type as string,
      name: extractName(o.name),
      description: "",
      likesU: 0,
      respectsU: 0,
      knownByU: 0,
      size: 0,
      power: 0,
      foodSupply: 0,
      wealth: 0,
      currency: "",
      monFaction: "",
      baseFaction: (o.base_faction as string) ?? "",
      relations: [],
      friendly: (o.friendly as string[]) ?? [],
      neutral: (o.neutral as string[]) ?? [],
      byMood: (o.by_mood as string[]) ?? [],
      path,
      lineStart,
      lineEnd,
    }),
  });
}
