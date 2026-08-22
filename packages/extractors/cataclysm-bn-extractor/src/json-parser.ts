/*
<MODULE_CONTRACT>
<purpose>Static JSON parser for Cataclysm-BN — extracts monster, item, mutation, and profession entries from JSON data files with line-range tracking.</purpose>
<non-goals>
  <item>Does not construct knowledge records — returns structured entries for the extractor.</item>
  <item>Does not validate JSON schema — raw JSON.parse with field extraction.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: JSON parsers for monsters, items, mutations, and professions with line-range computation.</item>
  <item>Fixed computeLineRange bug: all entries now get correct per-entry line ranges via brace-scanning offset tracker.</item>
  <item>Deepened into generic parseJsonEntries<T> — each entity kind is a spec, not a copy-paste parser.</item>
</CHANGE_SUMMARY>
*/
export interface MonsterEntry {
  id: string;
  type: string;
  name: string;
  description: string;
  hp: number;
  speed: number;
  aggression: number;
  morale: number;
  meleeSkill: number;
  meleeDice: number;
  meleeDiceSides: number;
  meleeCut: number;
  dodge: number;
  volume: string;
  weight: string;
  symbol: string;
  color: string;
  defaultFaction: string;
  species: string[];
  categories: string[];
  flags: string[];
  specialAttacks: unknown[];
  path: string;
  lineStart: number;
  lineEnd: number;
}

export interface ItemEntry {
  id: string;
  type: string;
  name: string;
  description: string;
  symbol: string;
  color: string;
  price: string;
  volume: string;
  weight: string;
  material: string[];
  flags: string[];
  path: string;
  lineStart: number;
  lineEnd: number;
}

export interface MutationEntry {
  id: string;
  type: string;
  name: string;
  description: string;
  points: number;
  visibility: string;
  category: string[];
  leadsTo: string[];
  path: string;
  lineStart: number;
  lineEnd: number;
}

export interface ProfessionEntry {
  id: string;
  type: string;
  name: string;
  description: string;
  path: string;
  lineStart: number;
  lineEnd: number;
}

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

function computeLineRanges(text: string): Array<{ lineStart: number; lineEnd: number }> {
  const ranges: Array<{ charStart: number; charEnd: number }> = [];
  let i = 0;
  const len = text.length;
  let depth = 0;
  let objStart = -1;
  let inString = false;
  let escaped = false;

  while (i < len) {
    const ch = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      i++;
      continue;
    }

    if (ch === '"') {
      inString = true;
    } else if (ch === "{") {
      if (depth === 0) {
        objStart = i;
      }
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0 && objStart >= 0) {
        ranges.push({ charStart: objStart, charEnd: i + 1 });
        objStart = -1;
      }
    }

    i++;
  }

  const lineStarts: number[] = [0];
  for (let j = 0; j < text.length; j++) {
    if (text[j] === "\n") {
      lineStarts.push(j + 1);
    }
  }

  function charToLine(charPos: number): number {
    let lo = 0;
    let hi = lineStarts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (lineStarts[mid] <= charPos) {
        lo = mid;
      } else {
        hi = mid - 1;
      }
    }
    return lo + 1;
  }

  return ranges.map((r) => ({
    lineStart: charToLine(r.charStart),
    lineEnd: charToLine(r.charEnd),
  }));
}

export interface JsonEntrySpec<T> {
  filter: (obj: Record<string, unknown>) => boolean;
  extract: (obj: Record<string, unknown>, path: string, lineStart: number, lineEnd: number) => T;
}

export function parseJsonEntries<T>(
  text: string,
  path: string,
  spec: JsonEntrySpec<T>,
): T[] {
  const data = JSON.parse(text);
  if (!Array.isArray(data)) return [];

  const ranges = computeLineRanges(text);
  const entries: T[] = [];

  for (let i = 0; i < data.length; i++) {
    const obj = data[i] as Record<string, unknown>;
    if (!spec.filter(obj)) continue;

    const range = ranges[i] ?? { lineStart: 1, lineEnd: 1 };
    entries.push(spec.extract(obj, path, range.lineStart, range.lineEnd));
  }

  return entries;
}

export function parseMonsterJson(text: string, path: string): MonsterEntry[] {
  return parseJsonEntries(text, path, {
    filter: (o) => o.id != null && o.type === "MONSTER",
    extract: (o, path, lineStart, lineEnd) => ({
      id: o.id as string,
      type: o.type as string,
      name: extractName(o.name),
      description: (o.description as string) ?? "",
      hp: (o.hp as number) ?? 0,
      speed: (o.speed as number) ?? 0,
      aggression: (o.aggression as number) ?? 0,
      morale: (o.morale as number) ?? 0,
      meleeSkill: (o.melee_skill as number) ?? 0,
      meleeDice: (o.melee_dice as number) ?? 0,
      meleeDiceSides: (o.melee_dice_sides as number) ?? 0,
      meleeCut: (o.melee_cut as number) ?? 0,
      dodge: (o.dodge as number) ?? 0,
      volume: (o.volume as string) ?? "",
      weight: (o.weight as string) ?? "",
      symbol: (o.symbol as string) ?? "",
      color: (o.color as string) ?? "",
      defaultFaction: (o.default_faction as string) ?? "",
      species: (o.species as string[]) ?? [],
      categories: (o.categories as string[]) ?? [],
      flags: (o.flags as string[]) ?? [],
      specialAttacks: (o.special_attacks as unknown[]) ?? [],
      path,
      lineStart,
      lineEnd,
    }),
  });
}

export function parseItemJson(text: string, path: string): ItemEntry[] {
  return parseJsonEntries(text, path, {
    filter: (o) => o.id != null,
    extract: (o, path, lineStart, lineEnd) => ({
      id: o.id as string,
      type: (o.type as string) ?? "",
      name: extractName(o.name),
      description: (o.description as string) ?? "",
      symbol: (o.symbol as string) ?? "",
      color: (o.color as string) ?? "",
      price: (o.price as string) ?? "",
      volume: (o.volume as string) ?? "",
      weight: (o.weight as string) ?? "",
      material: typeof o.material === "string" ? [o.material] : (o.material as string[]) ?? [],
      flags: (o.flags as string[]) ?? [],
      path,
      lineStart,
      lineEnd,
    }),
  });
}

export function parseMutationJson(text: string, path: string): MutationEntry[] {
  return parseJsonEntries(text, path, {
    filter: (o) => o.id != null,
    extract: (o, path, lineStart, lineEnd) => ({
      id: o.id as string,
      type: (o.type as string) ?? "",
      name: extractName(o.name),
      description: (o.description as string) ?? "",
      points: (o.points as number) ?? 0,
      visibility: (o.visibility as string) ?? "",
      category: (o.category as string[]) ?? [],
      leadsTo: (o.leads_to as string[]) ?? [],
      path,
      lineStart,
      lineEnd,
    }),
  });
}

export function parseProfessionJson(text: string, path: string): ProfessionEntry[] {
  return parseJsonEntries(text, path, {
    filter: (o) => o.id != null,
    extract: (o, path, lineStart, lineEnd) => ({
      id: o.id as string,
      type: (o.type as string) ?? "",
      name: extractName(o.name),
      description: (o.description as string) ?? "",
      path,
      lineStart,
      lineEnd,
    }),
  });
}
