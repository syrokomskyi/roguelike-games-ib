/*
<MODULE_CONTRACT>
<purpose>Static C-source parser for BrogueCE — extracts enums, monster catalog, tile catalog, item tables, dungeon feature catalog, light catalog, mutation catalog, monster class catalog, status effect catalog, monster behavior catalog, and monster ability catalog from C header/source files.</purpose>
<non-goals>
  <item>Does not execute or compile C code — pure regex-based static parsing.</item>
  <item>Does not construct knowledge records — returns structured entries for the extractor.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: parsers for enum, monsterCatalog, tileCatalog, and item tables with line-range tracking.</item>
  <item>Added variant item table glyphs (potion, scroll, wand, charm).</item>
  <item>Added parsers for dungeonFeatureCatalog, lightCatalog, mutationCatalog, monsterClassCatalog, statusEffectCatalog, monsterBehaviorCatalog, monsterAbilityCatalog.</item>
</CHANGE_SUMMARY>
*/
export interface EnumEntry {
  name: string;
  values: string[];
  startLine: number;
  endLine: number;
}

export function parseEnum(source: string, enumName: string): EnumEntry | null {
  const pattern = new RegExp(`enum\\s+${enumName}\\s*\\{`);
  const match = pattern.exec(source);
  if (!match) return null;

  const startIdx = match.index;
  const lines = source.substring(0, startIdx).split("\n");
  const startLine = lines.length;

  let braceStart = source.indexOf("{", startIdx);
  let depth = 1;
  let pos = braceStart + 1;
  while (depth > 0 && pos < source.length) {
    if (source[pos] === "{") depth++;
    else if (source[pos] === "}") depth--;
    pos++;
  }

  const body = source.substring(braceStart + 1, pos - 1);
  const endLine = startLine + body.split("\n").length;

  const values: string[] = [];
  const rawEntries = body.split(",");
  for (const entry of rawEntries) {
    const trimmed = entry.trim();
    if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("/*")) continue;
    const nameMatch = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)/);
    if (nameMatch) {
      values.push(nameMatch[1]);
    }
  }

  return { name: enumName, values, startLine, endLine };
}

export interface MonsterEntry {
  nativeId: string;
  name: string;
  glyph: string | null;
  maxHp: number;
  defense: number;
  accuracy: number;
  damage: { low: number; high: number; turns: number };
  turnsBetweenRegen: number;
  movementSpeed: number;
  attackSpeed: number;
  isLarge: boolean;
  bloodType: string;
  flags: string;
  abilityFlags: string;
  lineStart: number;
  lineEnd: number;
}

export function parseMonsterCatalog(source: string): MonsterEntry[] {
  const entries: MonsterEntry[] = [];
  const lines = source.split("\n");

  let inCatalog = false;
  let currentEntry: Partial<MonsterEntry> & { lineStart: number } | null = null;
  let entryLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.includes("creatureType monsterCatalog[NUMBER_MONSTER_KINDS] = {")) {
      inCatalog = true;
      continue;
    }

    if (!inCatalog) continue;

    if (line.trim() === "};") {
      if (currentEntry) {
        const entry = finalizeMonsterEntry(currentEntry, entryLines, lines);
        if (entry) entries.push(entry);
      }
      break;
    }

    if (line.trim().startsWith("{0,")) {
      if (currentEntry) {
        const entry = finalizeMonsterEntry(currentEntry, entryLines, lines);
        if (entry) entries.push(entry);
      }
      currentEntry = { lineStart: i + 1 };
      entryLines = [line];
    } else if (currentEntry) {
      entryLines.push(line);
    }
  }

  return entries;
}

function finalizeMonsterEntry(
  partial: Partial<MonsterEntry> & { lineStart: number },
  entryLines: string[],
  allLines: string[],
): MonsterEntry | null {
  const fullText = entryLines.join(" ");
  const nameMatch = fullText.match(/\{0,\s*"([^"]+)"/);
  if (!nameMatch) return null;

  const name = nameMatch[1];
  const nativeId = name.replace(/\s+/g, "_").toLowerCase();

  const glyphMatch = fullText.match(/\{0,\s*"[^"]+",\s*(G_[A-Z_][A-Z0-9_]*)/);
  const glyph = glyphMatch ? glyphMatch[1] : null;

  const hpMatch = fullText.match(/\{0,\s*"[^"]+",\s*[^,]+,\s*[^,]+,\s*(\d+)/);
  const maxHp = hpMatch ? parseInt(hpMatch[1], 10) : 0;

  const defenseMatch = fullText.match(/\{0,\s*"[^"]+",\s*[^,]+,\s*[^,]+,\s*\d+,\s*(\d+)/);
  const defense = defenseMatch ? parseInt(defenseMatch[1], 10) : 0;

  const accuracyMatch = fullText.match(/\{0,\s*"[^"]+",\s*[^,]+,\s*[^,]+,\s*\d+,\s*\d+,\s*(\d+)/);
  const accuracy = accuracyMatch ? parseInt(accuracyMatch[1], 10) : 0;

  const damageMatch = fullText.match(/\{(\d+),\s*(\d+),\s*(\d+)\}/);
  const damage = damageMatch
    ? { low: parseInt(damageMatch[1], 10), high: parseInt(damageMatch[2], 10), turns: parseInt(damageMatch[3], 10) }
    : { low: 0, high: 0, turns: 0 };

  const regenMatch = fullText.match(/\{0,\s*"[^"]+",\s*[^,]+,\s*[^,]+,\s*\d+,\s*\d+,\s*\d+,\s*\{[^}]+\},\s*(\d+)/);
  const turnsBetweenRegen = regenMatch ? parseInt(regenMatch[1], 10) : 0;

  const speedMatch = fullText.match(/\{0,\s*"[^"]+",\s*[^,]+,\s*[^,]+,\s*\d+,\s*\d+,\s*\d+,\s*\{[^}]+\},\s*\d+,\s*(\d+)/);
  const movementSpeed = speedMatch ? parseInt(speedMatch[1], 10) : 100;

  const attackSpeedMatch = fullText.match(/\{0,\s*"[^"]+",\s*[^,]+,\s*[^,]+,\s*\d+,\s*\d+,\s*\d+,\s*\{[^}]+\},\s*\d+,\s*\d+,\s*(\d+)/);
  const attackSpeed = attackSpeedMatch ? parseInt(attackSpeedMatch[1], 10) : 100;

  const isLargeMatch = fullText.match(/,\s*(true|false)\s*,/g);
  const isLarge = isLargeMatch && isLargeMatch.length > 0 ? isLargeMatch[0].includes("true") : false;

  const bloodTypeMatch = fullText.match(/(DF_[A-Z_]+)/);
  const bloodType = bloodTypeMatch ? bloodTypeMatch[1] : "0";

  const flagsMatch = fullText.match(/\((MONST_[^)]+)\)/g);
  const flags = flagsMatch ? flagsMatch.map((f) => f.replace(/[()]/g, "")).join(" | ") : "";

  const abilityMatch = fullText.match(/\((MA_[^)]+)\)/g);
  const abilityFlags = abilityMatch ? abilityMatch.map((f) => f.replace(/[()]/g, "")).join(" | ") : "";

  const lineEnd = partial.lineStart + entryLines.length - 1;

  return {
    nativeId,
    name,
    glyph,
    maxHp,
    defense,
    accuracy,
    damage,
    turnsBetweenRegen,
    movementSpeed,
    attackSpeed,
    isLarge,
    bloodType,
    flags,
    abilityFlags,
    lineStart: partial.lineStart,
    lineEnd,
  };
}

export interface TileEntry {
  nativeId: string;
  glyph: string | null;
  description: string;
  flavorText: string;
  drawPriority: number;
  flags: string;
  mechFlags: string;
  lineStart: number;
  lineEnd: number;
}

export function parseTileCatalog(source: string): TileEntry[] {
  const entries: TileEntry[] = [];
  const lines = source.split("\n");

  let inCatalog = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.includes("tileCatalog[NUMBER_TILETYPES] = {")) {
      inCatalog = true;
      continue;
    }

    if (!inCatalog) continue;

    if (line.trim() === "};") break;

    const commentMatch = line.match(/\/\*([A-Z_][A-Z0-9_]*)\*\//);
    if (!commentMatch) continue;

    const nativeId = commentMatch[1];
    const lineStart = i + 1;

    let fullLine = line;
    let lineEnd = lineStart;

    if (!line.includes('"}') || (line.match(/"/g)?.length ?? 0) < 4) {
      for (let j = i + 1; j < lines.length; j++) {
        fullLine += " " + lines[j].trim();
        lineEnd = j + 1;
        if (lines[j].includes('"}') || (fullLine.match(/"/g)?.length ?? 0) >= 4) break;
      }
    }

    const glyphMatch = fullLine.match(/\/\*[A-Z_][A-Z0-9_]*\*\/\s*\{\s*(G_[A-Z_][A-Z0-9_]*|'[^']')/);
    const glyph = glyphMatch ? glyphMatch[1] : null;

    const descMatch = fullLine.match(/"([^"]+)"\s*,\s*"([^"]*)"/);
    const description = descMatch ? descMatch[1] : "";
    const flavorText = descMatch ? descMatch[2] : "";

    const priorityMatch = fullLine.match(/\/\*[A-Z_][A-Z0-9_]*\*\/\s*\{[^,]+,\s*[^,]+,\s*[^,]+,\s*(\d+)/);
    const drawPriority = priorityMatch ? parseInt(priorityMatch[1], 10) : 0;

    const flagsMatch = fullLine.match(/\((T_[A-Z][^)]+)\)/g);
    const flags = flagsMatch ? flagsMatch.map((f) => f.replace(/[()]/g, "")).join(" | ") : "0";

    const mechFlagsMatch = fullLine.match(/\((TM_[A-Z][^)]+)\)/g);
    const mechFlags = mechFlagsMatch ? mechFlagsMatch.map((f) => f.replace(/[()]/g, "")).join(" | ") : "0";

    entries.push({
      nativeId,
      glyph,
      description,
      flavorText,
      drawPriority,
      flags,
      mechFlags,
      lineStart,
      lineEnd,
    });
  }

  return entries;
}

export interface ItemTableEntry {
  nativeId: string;
  name: string;
  glyph: string | null;
  frequency: number;
  marketValue: number;
  strengthRequired: number;
  power: number;
  damageRange: string;
  description: string;
  tableName: string;
  lineStart: number;
  lineEnd: number;
}

export function parseItemTable(
  source: string,
  tableName: string,
  arrayName: string,
): ItemTableEntry[] {
  const entries: ItemTableEntry[] = [];
  const lines = source.split("\n");

  let inTable = false;
  let currentEntry: Partial<ItemTableEntry> & { lineStart: number } | null = null;
  let entryLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.includes(`itemTable ${arrayName}[`) || line.includes(`itemTable *${arrayName};`)) {
      if (line.includes("[")) {
        inTable = true;
      }
      continue;
    }

    if (!inTable) continue;

    if (line.trim() === "};") {
      if (currentEntry) {
        const entry = finalizeItemEntry(currentEntry, entryLines, tableName);
        if (entry) entries.push(entry);
      }
      break;
    }

    if (line.trim().startsWith("{")) {
      if (currentEntry) {
        const entry = finalizeItemEntry(currentEntry, entryLines, tableName);
        if (entry) entries.push(entry);
      }
      currentEntry = { lineStart: i + 1 };
      entryLines = [line];
    } else if (currentEntry) {
      entryLines.push(line);
    }
  }

  return entries;
}

function parseEntryFields(text: string): string[] {
  const fields: string[] = [];
  let depth = 0;
  let current = "";
  let inString = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"' && (i === 0 || text[i - 1] !== '\\')) {
      inString = !inString;
      current += ch;
    } else if (ch === '{' && !inString) {
      depth++;
      current += ch;
    } else if (ch === '}' && !inString) {
      depth--;
      current += ch;
    } else if (ch === ',' && depth === 0 && !inString) {
      fields.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) fields.push(current.trim());
  return fields;
}

function finalizeItemEntry(
  partial: Partial<ItemTableEntry> & { lineStart: number },
  entryLines: string[],
  tableName: string,
): ItemTableEntry | null {
  const fullText = entryLines.join(" ");
  const startIdx = fullText.indexOf("{");
  const endIdx = fullText.lastIndexOf("}");
  if (startIdx < 0 || endIdx < 0) return null;

  const content = fullText.substring(startIdx + 1, endIdx);
  const fields = parseEntryFields(content);
  if (fields.length < 1) return null;

  const nameMatch = fields[0].match(/^"([^"]+)"$/);
  if (!nameMatch) return null;

  const name = nameMatch[1];
  const nativeId = name.replace(/\s+/g, "_").toLowerCase();

  const TABLE_GLYPHS: Record<string, string> = {
    weapon: "G_WEAPON",
    armor: "G_ARMOR",
    food: "G_FOOD",
    key: "G_KEY",
    staff: "G_STAFF",
    ring: "G_RING",
    potion: "G_POTION",
    scroll: "G_SCROLL",
    wand: "G_WAND",
    charm: "G_CHARM",
  };
  const glyph = TABLE_GLYPHS[tableName] ?? null;

  const numOrZero = (s: string | undefined): number =>
    s ? parseInt(s, 10) || 0 : 0;

  const frequency = numOrZero(fields[3]);
  const marketValue = numOrZero(fields[4]);
  const strengthRequired = numOrZero(fields[5]);
  const power = numOrZero(fields[6]);
  const damageRange = fields[7] ?? "{0,0,0}";

  const allQuoted = [...fullText.matchAll(/"([^"]*)"/g)].map((m) => m[1]);
  const description = allQuoted.filter((s) => s.length > 20).pop() ?? "";

  const lineEnd = partial.lineStart + entryLines.length - 1;

  return {
    nativeId,
    name,
    glyph,
    frequency,
    marketValue,
    strengthRequired,
    power,
    damageRange,
    description,
    tableName,
    lineStart: partial.lineStart,
    lineEnd,
  };
}

// --- Dungeon Feature Catalog ---

export interface DungeonFeatureEntry {
  nativeId: string;
  description: string;
  layer: string | null;
  start: number | null;
  decay: number | null;
  flags: string | null;
  lineStart: number;
  lineEnd: number;
}

export function parseDungeonFeatureCatalog(source: string): DungeonFeatureEntry[] {
  const entries: DungeonFeatureEntry[] = [];
  const lines = source.split("\n");

  let inCatalog = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes("dungeonFeatureCatalog[NUMBER_DUNGEON_FEATURES] = {")) {
      inCatalog = true;
      continue;
    }
    if (!inCatalog) continue;
    if (line.trim() === "};") break;

    const commentMatch = line.match(/\/\/\s*(.+)/);
    const comment = commentMatch ? commentMatch[1].trim() : null;
    if (!comment) continue;

    const nativeId = comment.replace(/\s+/g, "_").toUpperCase();
    const lineStart = i + 1;

    let fullLine = line;
    let lineEnd = lineStart;
    if (!line.includes("}") || (line.match(/{/g)?.length ?? 0) > (line.match(/}/g)?.length ?? 0)) {
      for (let j = i + 1; j < lines.length; j++) {
        fullLine += " " + lines[j].trim();
        lineEnd = j + 1;
        const opens = fullLine.match(/{/g)?.length ?? 0;
        const closes = fullLine.match(/}/g)?.length ?? 0;
        if (closes >= opens && fullLine.includes("}")) break;
      }
    }

    const braceMatch = fullLine.match(/\{([^}]+)\}/);
    if (!braceMatch) continue;
    const fields = braceMatch[1].split(",").map((s) => s.trim());

    const layer = fields[1] ?? null;
    const start = fields[2] ? parseInt(fields[2], 10) || null : null;
    const decay = fields[3] ? parseInt(fields[3], 10) || null : null;
    const flagsMatch = fullLine.match(/(DFF_[A-Z_][A-Z0-9_| ]*)/);
    const flags = flagsMatch ? flagsMatch[1].trim() : null;

    entries.push({
      nativeId,
      description: comment,
      layer,
      start,
      decay,
      flags,
      lineStart,
      lineEnd,
    });
  }

  return entries;
}

// --- Light Catalog ---

export interface LightEntry {
  nativeId: string;
  description: string;
  color: string | null;
  radiusMin: number | null;
  radiusMax: number | null;
  fadePercent: number | null;
  passThroughCreatures: boolean | null;
  lineStart: number;
  lineEnd: number;
}

export function parseLightCatalog(source: string): LightEntry[] {
  const entries: LightEntry[] = [];
  const lines = source.split("\n");

  let inCatalog = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes("lightCatalog[NUMBER_LIGHT_KINDS] = {")) {
      inCatalog = true;
      continue;
    }
    if (!inCatalog) continue;
    if (line.trim() === "};") break;

    const commentMatch = line.match(/\/\/\s*(.+)/);
    const comment = commentMatch ? commentMatch[1].trim() : null;
    if (!comment) continue;

    const nativeId = comment.replace(/\s+/g, "_").toUpperCase();
    const lineStart = i + 1;

    let fullLine = line;
    let lineEnd = lineStart;
    if (!line.includes("true") && !line.includes("false") && !line.includes("}")) {
      for (let j = i + 1; j < lines.length; j++) {
        fullLine += " " + lines[j].trim();
        lineEnd = j + 1;
        if (lines[j].includes("true") || lines[j].includes("false")) break;
      }
    }

    const colorMatch = fullLine.match(/&([a-zA-Z_]+)/);
    const color = colorMatch ? colorMatch[1] : null;

    const radiusMatch = fullLine.match(/\{(\d+),\s*(\d+),\s*\d+\}/);
    const radiusMin = radiusMatch ? parseInt(radiusMatch[1], 10) : null;
    const radiusMax = radiusMatch ? parseInt(radiusMatch[2], 10) : null;

    const fadeMatch = fullLine.match(/\}\s*,\s*(\d+)/);
    const fadePercent = fadeMatch ? parseInt(fadeMatch[1], 10) : null;

    const passMatch = fullLine.match(/(true|false)\s*\)/);
    const passThroughCreatures = passMatch ? passMatch[1] === "true" : null;

    entries.push({
      nativeId,
      description: comment,
      color,
      radiusMin,
      radiusMax,
      fadePercent,
      passThroughCreatures,
      lineStart,
      lineEnd,
    });
  }

  return entries;
}

// --- Mutation Catalog ---

export interface MutationEntry {
  nativeId: string;
  name: string;
  healthFactor: number | null;
  moveSpeedMult: number | null;
  attackSpeedMult: number | null;
  defenseMult: number | null;
  damageMult: number | null;
  description: string;
  canBeNegated: boolean | null;
  lineStart: number;
  lineEnd: number;
}

export function parseMutationCatalog(source: string): MutationEntry[] {
  const entries: MutationEntry[] = [];
  const lines = source.split("\n");

  let inCatalog = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes("mutationCatalog[NUMBER_MUTATORS] = {")) {
      inCatalog = true;
      continue;
    }
    if (!inCatalog) continue;
    if (line.trim() === "};") break;

    const nameMatch = line.match(/"([^"]+)"/);
    if (!nameMatch) continue;

    const name = nameMatch[1];
    const nativeId = name.replace(/\s+/g, "_").toLowerCase();
    const lineStart = i + 1;

    let fullLine = line;
    let lineEnd = lineStart;
    for (let j = i + 1; j < lines.length; j++) {
      fullLine += " " + lines[j].trim();
      lineEnd = j + 1;
      if (lines[j].includes("true}") || lines[j].includes("false}")) break;
    }

    const allQuoted = [...fullLine.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    const description = allQuoted.filter((s) => s.length > 20).pop() ?? "";
    const canBeNegatedMatch = fullLine.match(/(true|false)\s*\}/);
    const canBeNegated = canBeNegatedMatch ? canBeNegatedMatch[1] === "true" : null;

    const braceMatch = fullLine.match(/\{([^}]+)\}/);
    const fields = braceMatch ? braceMatch[1].split(",").map((s) => s.trim()) : [];
    const healthFactor = fields[2] ? parseInt(fields[2], 10) || null : null;
    const moveSpeedMult = fields[3] ? parseInt(fields[3], 10) || null : null;
    const attackSpeedMult = fields[4] ? parseInt(fields[4], 10) || null : null;
    const defenseMult = fields[5] ? parseInt(fields[5], 10) || null : null;
    const damageMult = fields[6] ? parseInt(fields[6], 10) || null : null;

    entries.push({
      nativeId,
      name,
      healthFactor,
      moveSpeedMult,
      attackSpeedMult,
      defenseMult,
      damageMult,
      description,
      canBeNegated,
      lineStart,
      lineEnd,
    });
  }

  return entries;
}

// --- Monster Class Catalog ---

export interface MonsterClassEntry {
  nativeId: string;
  name: string;
  frequency: number | null;
  maxDepth: number | null;
  members: string[];
  lineStart: number;
  lineEnd: number;
}

export function parseMonsterClassCatalog(source: string): MonsterClassEntry[] {
  const entries: MonsterClassEntry[] = [];
  const lines = source.split("\n");

  let inCatalog = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes("monsterClassCatalog[MONSTER_CLASS_COUNT] = {")) {
      inCatalog = true;
      continue;
    }
    if (!inCatalog) continue;
    if (line.trim() === "};") break;

    const nameMatch = line.match(/"([^"]+)"/);
    if (!nameMatch) continue;

    const name = nameMatch[1];
    const nativeId = name.replace(/\s+/g, "_").toLowerCase();
    const lineStart = i + 1;

    let fullLine = line;
    let lineEnd = lineStart;
    for (let j = i + 1; j < lines.length; j++) {
      fullLine += " " + lines[j].trim();
      lineEnd = j + 1;
      if (lines[j].includes("}}")) break;
    }

    const braceMatch = fullLine.match(/\{([^}]+)\}/);
    const fields = braceMatch ? braceMatch[1].split(",").map((s) => s.trim()) : [];
    const frequency = fields[1] ? parseInt(fields[1], 10) || null : null;
    const maxDepth = fields[2] ? parseInt(fields[2], 10) || null : null;

    const membersMatch = fullLine.match(/\{([^}]+)\}/);
    const members = membersMatch
      ? membersMatch[1].split(",").map((s) => s.trim()).filter((s) => s.startsWith("MK_"))
      : [];

    entries.push({
      nativeId,
      name,
      frequency,
      maxDepth,
      members,
      lineStart,
      lineEnd,
    });
  }

  return entries;
}

// --- Status Effect Catalog ---

export interface StatusEffectEntry {
  nativeId: string;
  name: string;
  isBuff: boolean | null;
  displayInSidebar: number | null;
  lineStart: number;
  lineEnd: number;
}

export function parseStatusEffectCatalog(source: string): StatusEffectEntry[] {
  const entries: StatusEffectEntry[] = [];
  const lines = source.split("\n");

  let inCatalog = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes("statusEffectCatalog[NUMBER_OF_STATUS_EFFECTS] = {")) {
      inCatalog = true;
      continue;
    }
    if (!inCatalog) continue;
    if (line.trim() === "};") break;

    const commentMatch = line.match(/\/\/\s*(STATUS_[A-Z_]+)/);
    const nativeId = commentMatch ? commentMatch[1] : null;
    if (!nativeId) continue;

    const nameMatch = line.match(/"([^"]*)"/);
    const name = nameMatch ? nameMatch[1] : "";
    const lineStart = i + 1;

    const boolMatch = line.match(/(true|false)/);
    const isBuff = boolMatch ? boolMatch[1] === "true" : null;

    const numMatch = line.match(/,\s*(\d+)\s*\}/);
    const displayInSidebar = numMatch ? parseInt(numMatch[1], 10) : null;

    entries.push({
      nativeId,
      name,
      isBuff,
      displayInSidebar,
      lineStart,
      lineEnd: lineStart,
    });
  }

  return entries;
}

// --- Monster Behavior Catalog ---

export interface MonsterBehaviorEntry {
  nativeId: string;
  description: string;
  isAlwaysActive: boolean | null;
  lineStart: number;
  lineEnd: number;
}

export function parseMonsterBehaviorCatalog(source: string): MonsterBehaviorEntry[] {
  const entries: MonsterBehaviorEntry[] = [];
  const lines = source.split("\n");

  let inCatalog = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes("monsterBehaviorCatalog[") && line.includes("= {")) {
      inCatalog = true;
      continue;
    }
    if (!inCatalog) continue;
    if (line.trim() === "};") break;

    const commentMatch = line.match(/\/\/\s*(MONST_[A-Z0-9_]+)/);
    const nativeId = commentMatch ? commentMatch[1] : null;
    if (!nativeId) continue;

    const descMatch = line.match(/"([^"]*)"/);
    const description = descMatch ? descMatch[1] : "";
    const lineStart = i + 1;

    const boolMatch = line.match(/(true|false)/);
    const isAlwaysActive = boolMatch ? boolMatch[1] === "true" : null;

    entries.push({
      nativeId,
      description,
      isAlwaysActive,
      lineStart,
      lineEnd: lineStart,
    });
  }

  return entries;
}

// --- Monster Ability Catalog ---

export interface MonsterAbilityEntry {
  nativeId: string;
  description: string;
  isAlwaysActive: boolean | null;
  lineStart: number;
  lineEnd: number;
}

export function parseMonsterAbilityCatalog(source: string): MonsterAbilityEntry[] {
  const entries: MonsterAbilityEntry[] = [];
  const lines = source.split("\n");

  let inCatalog = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes("monsterAbilityCatalog[") && line.includes("= {")) {
      inCatalog = true;
      continue;
    }
    if (!inCatalog) continue;
    if (line.trim() === "};") break;

    const commentMatch = line.match(/\/\/\s*(MA_[A-Z0-9_]+)/);
    const nativeId = commentMatch ? commentMatch[1] : null;
    if (!nativeId) continue;

    const descMatch = line.match(/"([^"]*)"/);
    const description = descMatch ? descMatch[1] : "";
    const lineStart = i + 1;

    const boolMatch = line.match(/(true|false)/);
    const isAlwaysActive = boolMatch ? boolMatch[1] === "true" : null;

    entries.push({
      nativeId,
      description,
      isAlwaysActive,
      lineStart,
      lineEnd: lineStart,
    });
  }

  return entries;
}
