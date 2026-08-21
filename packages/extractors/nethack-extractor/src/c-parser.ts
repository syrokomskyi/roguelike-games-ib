function findMatchingParen(s: string): number {
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "(") depth++;
    else if (s[i] === ")") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return s.length - 1;
}

export interface MonsterEntry {
  nativeId: string;
  name: string;
  symbol: string;
  level: number;
  moveSpeed: number;
  armorClass: number;
  magicResistance: number;
  alignment: number;
  genoFlags: string;
  attacks: string;
  weight: number;
  nutrition: number;
  sound: string;
  size: string;
  resistances: string;
  conveys: string;
  flags1: string;
  flags2: string;
  flags3: string;
  difficulty: number;
  color: string;
  lineStart: number;
  lineEnd: number;
}

export function parseMonsters(source: string): MonsterEntry[] {
  const entries: MonsterEntry[] = [];
  const lines = source.split("\n");

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const monMatch = line.match(/^\s*MON\(/);
    if (!monMatch) {
      i++;
      continue;
    }

    const lineStart = i + 1;
    let fullText = "";
    let depth = 0;
    let lineEnd = lineStart;

    for (let j = i; j < lines.length; j++) {
      fullText += " " + lines[j].trim();
      for (const ch of lines[j]) {
        if (ch === "(") depth++;
        else if (ch === ")") depth--;
      }
      lineEnd = j + 1;
      if (depth <= 0 && j > i) break;
      if (j === i && depth <= 0) break;
    }

    const entry = finalizeMonsterEntry(fullText, lineStart, lineEnd);
    if (entry) entries.push(entry);

    i = lineEnd;
  }

  return entries;
}

function finalizeMonsterEntry(
  fullText: string,
  lineStart: number,
  lineEnd: number,
): MonsterEntry | null {
  const nameMatch = fullText.match(/NAM\(\s*"([^"]+)"/);
  if (!nameMatch) return null;

  const name = nameMatch[1];
  const nativeId = name.replace(/\s+/g, "_").toLowerCase();

  const symMatch = fullText.match(/,\s*(S_[A-Z_]+)\s*,/);
  const symbol = symMatch ? symMatch[1] : "S_UNKNOWN";

  const lvlMatch = fullText.match(/LVL\(\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*\)/);
  const level = lvlMatch ? parseInt(lvlMatch[1], 10) : 0;
  const moveSpeed = lvlMatch ? parseInt(lvlMatch[2], 10) : 0;
  const armorClass = lvlMatch ? parseInt(lvlMatch[3], 10) : 0;
  const magicResistance = lvlMatch ? parseInt(lvlMatch[4], 10) : 0;
  const alignment = lvlMatch ? parseInt(lvlMatch[5], 10) : 0;

  const genoMatch = fullText.match(/LVL\([^)]*\)\s*,\s*\(([^)]+)\)/);
  const genoFlags = genoMatch ? genoMatch[1].trim() : "0";

  const atkMatch = fullText.match(/A\(([^)]+(?:\)[^A]*\([^)]+)*)\)/);
  const attacks = atkMatch ? atkMatch[1].trim() : "NO_ATTK";

  const sizMatch = fullText.match(/SIZ\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(MS_[A-Z_]+)\s*,\s*(MZ_[A-Z_]+)\s*\)/);
  const weight = sizMatch ? parseInt(sizMatch[1], 10) : 0;
  const nutrition = sizMatch ? parseInt(sizMatch[2], 10) : 0;
  const sound = sizMatch ? sizMatch[3] : "MS_SILENT";
  const size = sizMatch ? sizMatch[4] : "MZ_MEDIUM";

  const afterSizIdx = fullText.indexOf("SIZ(");
  if (afterSizIdx < 0) return null;
  const afterSizRaw = fullText.substring(afterSizIdx);
  const sizCloseIdx = findMatchingParen(afterSizRaw);
  const afterSiz = afterSizRaw.substring(sizCloseIdx + 1).trim();

  const tokens = afterSiz.split(/,\s*/).filter((t) => t.length > 0);
  const resistances = tokens[0]?.trim() || "0";
  const conveys = tokens[1]?.trim() || "0";
  const flags1 = tokens[2]?.trim() || "0";
  const flags2 = tokens[3]?.trim() || "0";
  const flags3 = tokens[4]?.trim() || "0";
  const difficulty = tokens[5] ? parseInt(tokens[5].trim(), 10) : 0;
  const color = tokens[6]?.trim().replace(/[)]$/, "") || "CLR_GRAY";

  return {
    nativeId,
    name,
    symbol,
    level,
    moveSpeed,
    armorClass,
    magicResistance,
    alignment,
    genoFlags,
    attacks,
    weight,
    nutrition,
    sound,
    size,
    resistances,
    conveys,
    flags1,
    flags2,
    flags3,
    difficulty,
    color,
    lineStart,
    lineEnd,
  };
}

export interface ObjectEntry {
  nativeId: string;
  name: string;
  description: string;
  objClass: string;
  probability: number;
  weight: number;
  cost: number;
  material: string;
  color: string;
  lineStart: number;
  lineEnd: number;
}

type ObjectMacro = {
  name: string;
  class: string;
};

const OBJECT_MACROS: ObjectMacro[] = [
  { name: "WEAPON", class: "weapon" },
  { name: "PROJECTILE", class: "weapon" },
  { name: "BOW", class: "weapon" },
  { name: "ARMOR", class: "armor" },
  { name: "HELM", class: "armor" },
  { name: "CLOAK", class: "armor" },
  { name: "SHIELD", class: "armor" },
  { name: "GLOVES", class: "armor" },
  { name: "BOOTS", class: "armor" },
  { name: "DRGN_ARMR", class: "armor" },
  { name: "RING", class: "ring" },
  { name: "AMULET", class: "amulet" },
  { name: "TOOL", class: "tool" },
  { name: "CONTAINER", class: "tool" },
  { name: "EYEWEAR", class: "tool" },
  { name: "WEPTOOL", class: "tool" },
  { name: "FOOD", class: "food" },
  { name: "POTION", class: "potion" },
  { name: "SCROLL", class: "scroll" },
  { name: "XTRA_SCROLL_LABEL", class: "scroll" },
  { name: "SPELL", class: "spellbook" },
  { name: "WAND", class: "wand" },
  { name: "COIN", class: "coin" },
  { name: "GEM", class: "gem" },
  { name: "ROCK", class: "rock" },
  { name: "OBJECT", class: "object" },
];

export function parseObjects(source: string): ObjectEntry[] {
  const entries: ObjectEntry[] = [];
  const lines = source.split("\n");
  const macroNames = OBJECT_MACROS.map((m) => m.name);
  const macroPattern = new RegExp(`^\\s*(${macroNames.join("|")})\\(`);

  let skipDepth = 0;
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.match(/^#if\\s+0\\b/) || (trimmed.match(/^#if\\b/) && skipDepth > 0) ||
        (trimmed.match(/^#ifdef\\b/) && skipDepth > 0) ||
        (trimmed.match(/^#ifndef\\b/) && skipDepth > 0)) {
      skipDepth++;
      i++;
      continue;
    }
    if (trimmed.match(/^#endif\\b/)) {
      if (skipDepth > 0) skipDepth--;
      i++;
      continue;
    }
    if (trimmed.match(/^#else\\b/) || trimmed.match(/^#elif\\b/)) {
      i++;
      continue;
    }
    if (skipDepth > 0) {
      i++;
      continue;
    }

    const match = line.match(macroPattern);
    if (!match) {
      i++;
      continue;
    }

    const macroName = match[1];
    const objClass = OBJECT_MACROS.find((m) => m.name === macroName)!.class;
    const lineStart = i + 1;

    let fullText = "";
    let depth = 0;
    let lineEnd = lineStart;

    for (let j = i; j < lines.length; j++) {
      fullText += " " + lines[j].trim();
      for (const ch of lines[j]) {
        if (ch === "(") depth++;
        else if (ch === ")") depth--;
      }
      lineEnd = j + 1;
      if (depth <= 0) break;
    }

    const entry = finalizeObjectEntry(fullText, macroName, objClass, lineStart, lineEnd);
    if (entry) entries.push(entry);

    i = lineEnd;
  }

  return entries;
}

function finalizeObjectEntry(
  fullText: string,
  macroName: string,
  objClass: string,
  lineStart: number,
  lineEnd: number,
): ObjectEntry | null {
  const lastTokenMatch = fullText.match(/,\s*([A-Z_][A-Z0-9_]*)\s*\)\s*$/);
  const nativeId = lastTokenMatch ? lastTokenMatch[1].toLowerCase() : "";

  let name = "";
  let rawDesc = "";
  let resolvedClass = objClass;

  if (macroName === "OBJECT") {
    const objMatch = fullText.match(/OBJ\(\s*"([^"]*)"\s*,\s*"([^"]*)"\s*\)/);
    if (!objMatch) return null;
    name = objMatch[1];
    rawDesc = objMatch[2];
    if (!name) return null;
    const classMatch = fullText.match(/,\s*([A-Z_]+_CLASS)\s*,/);
    if (classMatch) {
      resolvedClass = classMatch[1].replace("_CLASS", "").toLowerCase();
      if (resolvedClass === "spbook") resolvedClass = "spellbook";
    }
  } else if (macroName === "XTRA_SCROLL_LABEL") {
    const textMatch = fullText.match(/XTRA_SCROLL_LABEL\(\s*"([^"]*)"/);
    name = textMatch ? textMatch[1] : nativeId;
    rawDesc = name;
  } else {
    const macroStart = fullText.indexOf(macroName + "(");
    if (macroStart < 0) return null;
    const afterMacro = fullText.substring(macroStart + macroName.length + 1);

    const nameMatch = afterMacro.match(/^\s*"([^"]+)"/);
    if (nameMatch) {
      name = nameMatch[1];
      const descMatch = afterMacro.match(/^\s*"[^"]+"\s*,\s*"([^"]*)"/);
      rawDesc = descMatch ? descMatch[1] : "";
    } else if (afterMacro.match(/^\s*NoDes\b/)) {
      name = nativeId;
      const descMatch = afterMacro.match(/^\s*NoDes\s*,\s*"([^"]*)"/);
      rawDesc = descMatch ? descMatch[1] : "";
      if (!name) return null;
    } else {
      return null;
    }
  }

  const probMatch = fullText.match(/,\s*(\d+)\s*,\s*\d+\s*,\s*\d+\s*,/);
  const probability = probMatch ? parseInt(probMatch[1], 10) : 0;

  const costMatch = fullText.match(/,\s*(\d+)\s*,\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*\d+/);
  const cost = costMatch ? parseInt(costMatch[1], 10) : 0;

  const materialMatch = fullText.match(/\b(IRON|WOOD|LEATHER|COPPER|SILVER|GOLD|MITHRIL|PLASTIC|GLASS|BONE|PAPER|MINERAL|GEMSTONE|METAL|CLOTH|DRAGON_HIDE|PLATINUM|WAX|FLESH|VEGGY|LIQUID)\b/);
  const material = materialMatch ? materialMatch[1] : "UNKNOWN";

  const colorMatch = fullText.match(/\b(CLR_[A-Z_]+|HI_[A-Z_]+|DRAGON_[A-Z_]+)\b/g);
  const color = colorMatch ? colorMatch[colorMatch.length - 1] : "CLR_GRAY";

  const wtMatch = fullText.match(/,\s*(\d+)\s*,\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*\d+/);
  const weight = wtMatch ? parseInt(wtMatch[1], 10) : 0;

  return {
    nativeId,
    name,
    description: rawDesc === "NoDes" ? "" : rawDesc,
    objClass: resolvedClass,
    probability,
    weight,
    cost,
    material,
    color,
    lineStart,
    lineEnd,
  };
}

export interface ArtifactEntry {
  nativeId: string;
  name: string;
  description: string;
  objClass: string;
  lineStart: number;
  lineEnd: number;
}

export function parseArtifacts(source: string): ArtifactEntry[] {
  const entries: ArtifactEntry[] = [];
  const lines = source.split("\n");

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const match = line.match(/^\s*OBJECT\(\s*OBJ\(/);
    if (!match) {
      i++;
      continue;
    }

    const lineStart = i + 1;
    let fullText = "";
    let depth = 0;
    let lineEnd = lineStart;

    for (let j = i; j < lines.length; j++) {
      fullText += " " + lines[j].trim();
      for (const ch of lines[j]) {
        if (ch === "(") depth++;
        else if (ch === ")") depth--;
      }
      lineEnd = j + 1;
      if (depth <= 0) break;
    }

    const nameMatch = fullText.match(/OBJ\(\s*"([^"]+)"/);
    if (!nameMatch) {
      i = lineEnd;
      continue;
    }

    const name = nameMatch[1];
    const descMatch = fullText.match(/OBJ\(\s*"[^"]+"\s*,\s*"([^"]*)"/);
    const description = descMatch ? descMatch[1] : "";

    const classMatch = fullText.match(/,\s*([A-Z_]+_CLASS)\s*,/);
    const objClass = classMatch ? classMatch[1].replace("_CLASS", "").toLowerCase() : "unknown";

    const lastTokenMatch = fullText.match(/,\s*([A-Z_][A-Z0-9_]*)\s*\)\s*$/);
    const nativeId = lastTokenMatch ? lastTokenMatch[1].toLowerCase() : name.replace(/\s+/g, "_").toLowerCase();

    entries.push({
      nativeId,
      name,
      description,
      objClass,
      lineStart,
      lineEnd,
    });

    i = lineEnd;
  }

  return entries;
}
