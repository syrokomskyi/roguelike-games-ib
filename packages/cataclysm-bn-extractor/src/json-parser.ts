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

function computeLineRange(text: string, index: number, total: number): { lineStart: number; lineEnd: number } {
  const lines = text.split("\n");
  let charPos = 0;
  let lineStart = 1;
  for (let i = 0; i < lines.length; i++) {
    const lineEnd = charPos + lines[i].length + 1;
    if (charPos <= index && index < lineEnd) {
      lineStart = i + 1;
      break;
    }
    charPos = lineEnd;
  }
  const lineCount = text.split("\n").length;
  return { lineStart, lineEnd: Math.min(lineStart + 5, lineCount) };
}

export function parseMonsterJson(text: string, path: string): MonsterEntry[] {
  const data = JSON.parse(text);
  if (!Array.isArray(data)) return [];
  const entries: MonsterEntry[] = [];
  for (let i = 0; i < data.length; i++) {
    const obj = data[i] as Record<string, unknown>;
    if (!obj.id || obj.type !== "MONSTER") continue;
    const { lineStart, lineEnd } = computeLineRange(text, 0, text.length);
    entries.push({
      id: obj.id as string,
      type: obj.type as string,
      name: extractName(obj.name),
      description: (obj.description as string) ?? "",
      hp: (obj.hp as number) ?? 0,
      speed: (obj.speed as number) ?? 0,
      aggression: (obj.aggression as number) ?? 0,
      morale: (obj.morale as number) ?? 0,
      meleeSkill: (obj.melee_skill as number) ?? 0,
      meleeDice: (obj.melee_dice as number) ?? 0,
      meleeDiceSides: (obj.melee_dice_sides as number) ?? 0,
      meleeCut: (obj.melee_cut as number) ?? 0,
      dodge: (obj.dodge as number) ?? 0,
      volume: (obj.volume as string) ?? "",
      weight: (obj.weight as string) ?? "",
      symbol: (obj.symbol as string) ?? "",
      color: (obj.color as string) ?? "",
      defaultFaction: (obj.default_faction as string) ?? "",
      species: (obj.species as string[]) ?? [],
      categories: (obj.categories as string[]) ?? [],
      flags: (obj.flags as string[]) ?? [],
      specialAttacks: (obj.special_attacks as unknown[]) ?? [],
      path,
      lineStart,
      lineEnd,
    });
  }
  return entries;
}

export function parseItemJson(text: string, path: string): ItemEntry[] {
  const data = JSON.parse(text);
  if (!Array.isArray(data)) return [];
  const entries: ItemEntry[] = [];
  for (const obj of data) {
    const o = obj as Record<string, unknown>;
    if (!o.id) continue;
    const { lineStart, lineEnd } = computeLineRange(text, 0, text.length);
    entries.push({
      id: o.id as string,
      type: (o.type as string) ?? "",
      name: extractName(o.name),
      description: (o.description as string) ?? "",
      symbol: (o.symbol as string) ?? "",
      color: (o.color as string) ?? "",
      price: (o.price as string) ?? "",
      volume: (o.volume as string) ?? "",
      weight: (o.weight as string) ?? "",
      material: (o.material as string[]) ?? [],
      flags: (o.flags as string[]) ?? [],
      path,
      lineStart,
      lineEnd,
    });
  }
  return entries;
}

export function parseMutationJson(text: string, path: string): MutationEntry[] {
  const data = JSON.parse(text);
  if (!Array.isArray(data)) return [];
  const entries: MutationEntry[] = [];
  for (const obj of data) {
    const o = obj as Record<string, unknown>;
    if (!o.id) continue;
    const { lineStart, lineEnd } = computeLineRange(text, 0, text.length);
    entries.push({
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
    });
  }
  return entries;
}

export function parseProfessionJson(text: string, path: string): ProfessionEntry[] {
  const data = JSON.parse(text);
  if (!Array.isArray(data)) return [];
  const entries: ProfessionEntry[] = [];
  for (const obj of data) {
    const o = obj as Record<string, unknown>;
    if (!o.id) continue;
    const { lineStart, lineEnd } = computeLineRange(text, 0, text.length);
    entries.push({
      id: o.id as string,
      type: (o.type as string) ?? "",
      name: extractName(o.name),
      description: (o.description as string) ?? "",
      path,
      lineStart,
      lineEnd,
    });
  }
  return entries;
}
