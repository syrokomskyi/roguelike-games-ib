/*
<MODULE_CONTRACT>
<purpose>Static C-source parser for BrogueCE — extracts enums, monster catalog, tile catalog, and item tables from C header/source files.</purpose>
<non-goals>
  <item>Does not execute or compile C code — pure regex-based static parsing.</item>
  <item>Does not construct knowledge records — returns structured entries for the extractor.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: parsers for enum, monsterCatalog, tileCatalog, and item tables with line-range tracking.</item>
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
