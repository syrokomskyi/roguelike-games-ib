/*
<MODULE_CONTRACT>
<purpose>Static C-source parser for NetHack — extracts monster and object entries from C header files using macro-based parsing.</purpose>
<non-goals>
  <item>Does not execute or compile C code — pure regex-based static parsing.</item>
  <item>Does not construct knowledge records — returns structured entries for the extractor.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: parsers for MON, WEAPON/ARMOR/etc., and OBJECT/OBJ macros with line-range tracking.</item>
  <item>Refactored: extracted macro scanning into macro-scanner.ts and field extraction into field-extractor.ts.</item>
  <item>Removed parseArtifacts (dead code — artifacts already covered by parseObjects).</item>
</CHANGE_SUMMARY>
*/
import { scanCMacros } from "./macro-scanner.ts";
import { extractFields, type FieldSpec } from "./field-extractor.ts";

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

const LVL_RE = /LVL\(\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*\)/;
const SIZ_RE = /SIZ\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(MS_[A-Z_]+)\s*,\s*(MZ_[A-Z_]+)\s*\)/;

const monsterFieldSpecs: FieldSpec[] = [
  { name: "symbol", regex: /,\s*(S_[A-Z_]+)\s*,/, group: 1, default: "S_UNKNOWN" },
  { name: "level", regex: LVL_RE, group: 1, transform: (v) => parseInt(v, 10), default: 0 },
  { name: "moveSpeed", regex: LVL_RE, group: 2, transform: (v) => parseInt(v, 10), default: 0 },
  { name: "armorClass", regex: LVL_RE, group: 3, transform: (v) => parseInt(v, 10), default: 0 },
  { name: "magicResistance", regex: LVL_RE, group: 4, transform: (v) => parseInt(v, 10), default: 0 },
  { name: "alignment", regex: LVL_RE, group: 5, transform: (v) => parseInt(v, 10), default: 0 },
  { name: "genoFlags", regex: /LVL\([^)]*\)\s*,\s*\(([^)]+)\)/, group: 1, default: "0" },
  { name: "attacks", regex: /A\(([^)]+(?:\)[^A]*\([^)]+)*)\)/, group: 1, default: "NO_ATTK" },
  { name: "weight", regex: SIZ_RE, group: 1, transform: (v) => parseInt(v, 10), default: 0 },
  { name: "nutrition", regex: SIZ_RE, group: 2, transform: (v) => parseInt(v, 10), default: 0 },
  { name: "sound", regex: SIZ_RE, group: 3, default: "MS_SILENT" },
  { name: "size", regex: SIZ_RE, group: 4, default: "MZ_MEDIUM" },
];

export function parseMonsters(source: string): MonsterEntry[] {
  const scanned = scanCMacros(source, /^\s*MON\(/);
  const entries: MonsterEntry[] = [];
  const seenIds = new Set<string>();

  for (const { fullText, lineStart, lineEnd } of scanned) {
    const entry = finalizeMonsterEntry(fullText, lineStart, lineEnd);
    if (entry && !seenIds.has(entry.nativeId)) {
      seenIds.add(entry.nativeId);
      entries.push(entry);
    }
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

  const fields = extractFields(fullText, monsterFieldSpecs);

  const afterSizIdx = fullText.indexOf("SIZ(");
  if (afterSizIdx < 0) return null;
  const afterSizRaw = fullText.substring(afterSizIdx);
  const sizCloseIdx = findMatchingParen(afterSizRaw);
  const afterSiz = afterSizRaw.substring(sizCloseIdx + 1).trim();

  const tokens = afterSiz.split(/,\s*/).filter((t) => t.length > 0);

  return {
    nativeId,
    name,
    symbol: fields.symbol as string,
    level: fields.level as number,
    moveSpeed: fields.moveSpeed as number,
    armorClass: fields.armorClass as number,
    magicResistance: fields.magicResistance as number,
    alignment: fields.alignment as number,
    genoFlags: fields.genoFlags as string,
    attacks: fields.attacks as string,
    weight: fields.weight as number,
    nutrition: fields.nutrition as number,
    sound: fields.sound as string,
    size: fields.size as string,
    resistances: tokens[0]?.trim() || "0",
    conveys: tokens[1]?.trim() || "0",
    flags1: tokens[2]?.trim() || "0",
    flags2: tokens[3]?.trim() || "0",
    flags3: tokens[4]?.trim() || "0",
    difficulty: tokens[5] ? parseInt(tokens[5].trim(), 10) : 0,
    color: tokens[6]?.trim().replace(/[)]$/, "") || "CLR_GRAY",
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

const objectFieldSpecs: FieldSpec[] = [
  { name: "probability", regex: /,\s*(\d+)\s*,\s*\d+\s*,\s*\d+\s*,/, group: 1, transform: (v) => parseInt(v, 10), default: 0 },
  { name: "cost", regex: /,\s*(\d+)\s*,\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*\d+/, group: 1, transform: (v) => parseInt(v, 10), default: 0 },
  { name: "material", regex: /\b(IRON|WOOD|LEATHER|COPPER|SILVER|GOLD|MITHRIL|PLASTIC|GLASS|BONE|PAPER|MINERAL|GEMSTONE|METAL|CLOTH|DRAGON_HIDE|PLATINUM|WAX|FLESH|VEGGY|LIQUID)\b/, group: 1, default: "UNKNOWN" },
  { name: "weight", regex: /,\s*(\d+)\s*,\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*\d+/, group: 1, transform: (v) => parseInt(v, 10), default: 0 },
];

export function parseObjects(source: string): ObjectEntry[] {
  const macroNames = OBJECT_MACROS.map((m) => m.name);
  const macroPattern = new RegExp(`^\\s*(${macroNames.join("|")})\\(`);

  const scanned = scanCMacros(source, macroPattern, { handlePreprocessor: true });
  const entries: ObjectEntry[] = [];
  const seenKeys = new Set<string>();

  for (const { fullText, lineStart, lineEnd } of scanned) {
    const macroMatch = fullText.match(new RegExp(`\\b(${macroNames.join("|")})\\(`));
    const macroName = macroMatch ? macroMatch[1] : "";
    const objClass = OBJECT_MACROS.find((m) => m.name === macroName)?.class ?? "object";

    const entry = finalizeObjectEntry(fullText, macroName, objClass, lineStart, lineEnd);
    if (entry) {
      const key = `${entry.objClass}:${entry.nativeId}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        entries.push(entry);
      }
    }
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
  const rawNativeId = lastTokenMatch ? lastTokenMatch[1].toLowerCase() : "";

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
    name = textMatch ? textMatch[1] : rawNativeId;
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
      name = rawNativeId;
      const descMatch = afterMacro.match(/^\s*NoDes\s*,\s*"([^"]*)"/);
      rawDesc = descMatch ? descMatch[1] : "";
      if (!name) return null;
    } else {
      return null;
    }
  }

  const fields = extractFields(fullText, objectFieldSpecs);

  const colorMatch = fullText.match(/\b(CLR_[A-Z_]+|HI_[A-Z_]+|DRAGON_[A-Z_]+)\b/g);
  const color = colorMatch ? colorMatch[colorMatch.length - 1] : "CLR_GRAY";

  const nativeId = rawNativeId || name.replace(/\s+/g, "_").toLowerCase();

  return {
    nativeId,
    name,
    description: rawDesc === "NoDes" ? "" : rawDesc,
    objClass: resolvedClass,
    probability: fields.probability as number,
    weight: fields.weight as number,
    cost: fields.cost as number,
    material: fields.material as string,
    color,
    lineStart,
    lineEnd,
  };
}
