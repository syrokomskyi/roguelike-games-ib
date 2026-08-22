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
  <item>Deepened into Catalog Parser factory: shared scanCatalogEntries/scanArrayEntries infrastructure, parseEntryFields reused across all parsers.</item>
</CHANGE_SUMMARY>
*/

// --- Shared scanning infrastructure ---

interface CatalogScanSpec {
  startMarker: string | ((line: string) => boolean);
  entryPattern: RegExp;
  isComplete: (fullLine: string) => boolean;
}

interface ScannedEntry {
  fullLine: string;
  lineStart: number;
  lineEnd: number;
  match: RegExpMatchArray;
}

function scanCatalogEntries(source: string, spec: CatalogScanSpec): ScannedEntry[] {
  const results: ScannedEntry[] = [];
  const lines = source.split("\n");
  let inCatalog = false;

  const startTest = typeof spec.startMarker === "string"
    ? (line: string) => line.includes(spec.startMarker as string)
    : (spec.startMarker as (line: string) => boolean);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (startTest(line)) {
      inCatalog = true;
      continue;
    }
    if (!inCatalog) continue;
    if (line.trim() === "};") break;

    const match = line.match(spec.entryPattern);
    if (!match) continue;

    const lineStart = i + 1;
    let fullLine = line;
    let lineEnd = lineStart;

    if (!spec.isComplete(fullLine)) {
      for (let j = i + 1; j < lines.length; j++) {
        fullLine += " " + lines[j].trim();
        lineEnd = j + 1;
        if (spec.isComplete(fullLine)) break;
      }
    }

    results.push({ fullLine, lineStart, lineEnd, match });
  }

  return results;
}

interface ScannedArrayEntry {
  entryLines: string[];
  lineStart: number;
}

function scanArrayEntries(
  source: string,
  startMarker: string,
  entryStartTest: (line: string) => boolean,
): ScannedArrayEntry[] {
  const results: ScannedArrayEntry[] = [];
  const lines = source.split("\n");
  let inTable = false;
  let currentEntry: ScannedArrayEntry | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.includes(startMarker)) {
      if (line.includes("[")) {
        inTable = true;
      }
      continue;
    }

    if (!inTable) continue;

    if (line.trim() === "};") {
      if (currentEntry) results.push(currentEntry);
      break;
    }

    if (entryStartTest(line)) {
      if (currentEntry) results.push(currentEntry);
      currentEntry = { lineStart: i + 1, entryLines: [line] };
    } else if (currentEntry) {
      currentEntry.entryLines.push(line);
    }
  }

  return results;
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

// --- Types and parsers ---

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
  const scanned = scanArrayEntries(
    source,
    "creatureType monsterCatalog[NUMBER_MONSTER_KINDS] = {",
    (line) => line.trim().startsWith("{0,"),
  );

  return scanned
    .map(({ entryLines, lineStart }) => finalizeMonsterEntry(entryLines, lineStart))
    .filter((e): e is MonsterEntry => e !== null);
}

function finalizeMonsterEntry(
  entryLines: string[],
  lineStart: number,
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

  const lineEnd = lineStart + entryLines.length - 1;

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
    lineStart,
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
  const scanned = scanCatalogEntries(source, {
    startMarker: "tileCatalog[NUMBER_TILETYPES] = {",
    entryPattern: /\/\*([A-Z_][A-Z0-9_]*)\*\//,
    isComplete: (full) => {
      const quoteCount = full.match(/"/g)?.length ?? 0;
      return full.includes('"}') && quoteCount >= 4;
    },
  });

  return scanned.map(({ fullLine, lineStart, lineEnd, match }) => {
    const nativeId = match[1];

    const glyphMatch = fullLine.match(/\/\*[A-Z_][A-Z0-9_]*\*\/\s*\{\s*(G_[A-Z_][A-Z0-9_]*|'[^']')/);
    const descMatch = fullLine.match(/"([^"]+)"\s*,\s*"([^"]*)"/);
    const priorityMatch = fullLine.match(/\/\*[A-Z_][A-Z0-9_]*\*\/\s*\{[^,]+,\s*[^,]+,\s*[^,]+,\s*(\d+)/);
    const flagsMatch = fullLine.match(/\((T_[A-Z][^)]+)\)/g);
    const mechFlagsMatch = fullLine.match(/\((TM_[A-Z][^)]+)\)/g);

    return {
      nativeId,
      glyph: glyphMatch ? glyphMatch[1] : null,
      description: descMatch ? descMatch[1] : "",
      flavorText: descMatch ? descMatch[2] : "",
      drawPriority: priorityMatch ? parseInt(priorityMatch[1], 10) : 0,
      flags: flagsMatch ? flagsMatch.map((f) => f.replace(/[()]/g, "")).join(" | ") : "0",
      mechFlags: mechFlagsMatch ? mechFlagsMatch.map((f) => f.replace(/[()]/g, "")).join(" | ") : "0",
      lineStart,
      lineEnd,
    };
  });
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
  const scanned = scanArrayEntries(
    source,
    `itemTable ${arrayName}[`,
    (line) => line.trim().startsWith("{"),
  );

  return scanned
    .map(({ entryLines, lineStart }) => finalizeItemEntry(entryLines, lineStart, tableName))
    .filter((e): e is ItemTableEntry => e !== null);
}

function finalizeItemEntry(
  entryLines: string[],
  lineStart: number,
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

  const lineEnd = lineStart + entryLines.length - 1;

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
    lineStart,
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
  const scanned = scanCatalogEntries(source, {
    startMarker: "dungeonFeatureCatalog[NUMBER_DUNGEON_FEATURES] = {",
    entryPattern: /^\s*\{\s*([A-Za-z0-9_]+)/,
    isComplete: (full) => {
      const opens = full.match(/{/g)?.length ?? 0;
      const closes = full.match(/}/g)?.length ?? 0;
      return closes >= opens && full.includes("}");
    },
  });

  const seen = new Set<string>();
  const results: DungeonFeatureEntry[] = [];

  for (const { fullLine, lineStart, lineEnd, match } of scanned) {
    const firstField = match[1];
    const nativeId = firstField === "0" ? "NOTHING" : firstField.toUpperCase();
    if (seen.has(nativeId)) continue;
    seen.add(nativeId);

    const commentMatch = fullLine.match(/\/\/\s*(.+)$/);
    const comment = commentMatch ? commentMatch[1].trim() : nativeId;

    const braceMatch = fullLine.match(/\{([^}]+)\}/);
    const fields = braceMatch ? parseEntryFields(braceMatch[1]) : [];

    const flagsMatch = fullLine.match(/(DFF_[A-Z_][A-Z0-9_| ]*)/);
    const flags = flagsMatch ? flagsMatch[1].trim() : null;

    results.push({
      nativeId,
      description: comment,
      layer: fields[1] ?? null,
      start: fields[2] ? parseInt(fields[2], 10) || null : null,
      decay: fields[3] ? parseInt(fields[3], 10) || null : null,
      flags,
      lineStart,
      lineEnd,
    });
  }

  return results;
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
  const scanned = scanCatalogEntries(source, {
    startMarker: "lightCatalog[NUMBER_LIGHT_KINDS] = {",
    entryPattern: /\{.*\/\/\s*(.+)/,
    isComplete: (full) => full.includes("}"),
  });

  return scanned.map(({ fullLine, lineStart, lineEnd, match }) => {
    const comment = match[1].trim();
    const nativeId = comment.replace(/\s+/g, "_").toUpperCase();

    const colorMatch = fullLine.match(/&([a-zA-Z_]+)/);
    const radiusMatch = fullLine.match(/\{(\d+),\s*(\d+),\s*\d+\}/);
    const fadeMatch = fullLine.match(/\}\s*,\s*(\d+)/);
    const passMatch = fullLine.match(/(true|false)\s*\)/);

    return {
      nativeId,
      description: comment,
      color: colorMatch ? colorMatch[1] : null,
      radiusMin: radiusMatch ? parseInt(radiusMatch[1], 10) : null,
      radiusMax: radiusMatch ? parseInt(radiusMatch[2], 10) : null,
      fadePercent: fadeMatch ? parseInt(fadeMatch[1], 10) : null,
      passThroughCreatures: passMatch ? passMatch[1] === "true" : null,
      lineStart,
      lineEnd,
    };
  });
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
  const scanned = scanCatalogEntries(source, {
    startMarker: "mutationCatalog[NUMBER_MUTATORS] = {",
    entryPattern: /\{"([^"]+)"/,
    isComplete: (full) => full.includes("true}") || full.includes("false}"),
  });

  return scanned.map(({ fullLine, lineStart, lineEnd, match }) => {
    const name = match[1];
    const nativeId = name.replace(/\s+/g, "_").toLowerCase();

    const allQuoted = [...fullLine.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    const description = allQuoted.filter((s) => s.length > 20).pop() ?? "";
    const canBeNegatedMatch = fullLine.match(/(true|false)\s*\}/);

    const braceMatch = fullLine.match(/\{([^}]+)\}/);
    const fields = braceMatch ? parseEntryFields(braceMatch[1]) : [];

    return {
      nativeId,
      name,
      healthFactor: fields[2] ? parseInt(fields[2], 10) || null : null,
      moveSpeedMult: fields[3] ? parseInt(fields[3], 10) || null : null,
      attackSpeedMult: fields[4] ? parseInt(fields[4], 10) || null : null,
      defenseMult: fields[5] ? parseInt(fields[5], 10) || null : null,
      damageMult: fields[6] ? parseInt(fields[6], 10) || null : null,
      description,
      canBeNegated: canBeNegatedMatch ? canBeNegatedMatch[1] === "true" : null,
      lineStart,
      lineEnd,
    };
  });
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
  const scanned = scanCatalogEntries(source, {
    startMarker: "monsterClassCatalog[MONSTER_CLASS_COUNT] = {",
    entryPattern: /\{"([^"]+)"/,
    isComplete: (full) => full.includes("}}"),
  });

  return scanned.map(({ fullLine, lineStart, lineEnd, match }) => {
    const name = match[1];
    const nativeId = name.replace(/\s+/g, "_").toLowerCase();

    const braceMatch = fullLine.match(/\{([^}]+)\}/);
    const fields = braceMatch ? parseEntryFields(braceMatch[1]) : [];

    const membersMatch = fullLine.match(/\{([^}]+)\}/);
    const members = membersMatch
      ? membersMatch[1].split(",").map((s) => s.trim()).filter((s) => s.startsWith("MK_"))
      : [];

    return {
      nativeId,
      name,
      frequency: fields[1] ? parseInt(fields[1], 10) || null : null,
      maxDepth: fields[2] ? parseInt(fields[2], 10) || null : null,
      members,
      lineStart,
      lineEnd,
    };
  });
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
  const scanned = scanCatalogEntries(source, {
    startMarker: "statusEffectCatalog[NUMBER_OF_STATUS_EFFECTS] = {",
    entryPattern: /\/\/\s*(STATUS_[A-Z_]+)/,
    isComplete: () => true,
  });

  return scanned.map(({ fullLine, lineStart, match }) => {
    const nativeId = match[1];
    const nameMatch = fullLine.match(/"([^"]*)"/);
    const boolMatch = fullLine.match(/(true|false)/);
    const numMatch = fullLine.match(/,\s*(\d+)\s*\}/);

    return {
      nativeId,
      name: nameMatch ? nameMatch[1] : "",
      isBuff: boolMatch ? boolMatch[1] === "true" : null,
      displayInSidebar: numMatch ? parseInt(numMatch[1], 10) : null,
      lineStart,
      lineEnd: lineStart,
    };
  });
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
  const scanned = scanCatalogEntries(source, {
    startMarker: (line) => line.includes("monsterBehaviorCatalog[") && line.includes("= {"),
    entryPattern: /\/\/\s*(MONST_[A-Z0-9_]+)/,
    isComplete: () => true,
  });

  return scanned.map(({ fullLine, lineStart, match }) => {
    const nativeId = match[1];
    const descMatch = fullLine.match(/"([^"]*)"/);
    const boolMatch = fullLine.match(/(true|false)/);

    return {
      nativeId,
      description: descMatch ? descMatch[1] : "",
      isAlwaysActive: boolMatch ? boolMatch[1] === "true" : null,
      lineStart,
      lineEnd: lineStart,
    };
  });
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
  const scanned = scanCatalogEntries(source, {
    startMarker: (line) => line.includes("monsterAbilityCatalog[") && line.includes("= {"),
    entryPattern: /\/\/\s*(MA_[A-Z0-9_]+)/,
    isComplete: () => true,
  });

  return scanned.map(({ fullLine, lineStart, match }) => {
    const nativeId = match[1];
    const descMatch = fullLine.match(/"([^"]*)"/);
    const boolMatch = fullLine.match(/(true|false)/);

    return {
      nativeId,
      description: descMatch ? descMatch[1] : "",
      isAlwaysActive: boolMatch ? boolMatch[1] === "true" : null,
      lineStart,
      lineEnd: lineStart,
    };
  });
}
