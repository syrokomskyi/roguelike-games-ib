export interface SpellEntry {
  nativeId: string;
  name: string;
  schools: string;
  flags: string;
  level: number;
  powerCap: number;
  minRange: string;
  maxRange: string;
  effectNoise: number;
  tile: string;
  filePath: string;
  lineStart: number;
  lineEnd: number;
}

export interface BranchEntry {
  nativeId: string;
  parentBranch: string;
  mindepth: number;
  maxdepth: number;
  depth: number;
  absdepth: number;
  flags: string;
  shortName: string;
  longName: string;
  abbrev: string;
  floorColour: string;
  rockColour: string;
  travelShortcut: string;
  runes: string;
  ambientNoise: string;
  filePath: string;
  lineStart: number;
  lineEnd: number;
}

export interface AbilityEntry {
  nativeId: string;
  flags: string;
  hotkey: string;
  filePath: string;
  lineStart: number;
  lineEnd: number;
}

function parseEntryFields(text: string): string[] {
  const fields: string[] = [];
  let depth = 0;
  let current = "";
  let inString = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"' && (i === 0 || text[i - 1] !== "\\")) {
      inString = !inString;
      current += ch;
    } else if (ch === "{" && !inString) {
      depth++;
      current += ch;
    } else if (ch === "}" && !inString) {
      depth--;
      current += ch;
    } else if (ch === "," && depth === 0 && !inString) {
      fields.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) fields.push(current.trim());
  return fields;
}

function preprocessCSource(source: string): string[] {
  const rawLines = source.split("\n");
  const result: string[] = [];
  const condStack: Array<{ active: boolean; parentActive: boolean; seenElse: boolean }> = [];

  function currentlyActive(): boolean {
    return condStack.every((c) => c.active);
  }

  for (const line of rawLines) {
    const trimmed = line.trim();

    if (/^#if[\s\(]/.test(trimmed) && !trimmed.startsWith("#ifdef") && !trimmed.startsWith("#ifndef")) {
      const parentActive = currentlyActive();
      let active = false;

      if (trimmed.match(/^#if\s+TAG_MAJOR_VERSION\s*==\s*34/)) {
        active = true;
      } else if (trimmed.match(/^#if\s+TAG_MAJOR_VERSION\s*>\s*34/)) {
        active = false;
      } else {
        active = true;
      }

      condStack.push({ active, parentActive, seenElse: false });
      continue;
    }

    if (trimmed === "#else") {
      if (condStack.length > 0) {
        const top = condStack[condStack.length - 1];
        top.active = !top.active;
        top.seenElse = true;
      }
      continue;
    }

    if (trimmed === "#endif") {
      condStack.pop();
      continue;
    }

    if (trimmed.startsWith("#")) continue;

    if (currentlyActive()) {
      result.push(line);
    }
  }

  return result;
}

function extractEntries(source: string, arrayName: string): Array<{ content: string; lineStart: number; lineEnd: number }> {
  const lines = preprocessCSource(source);
  const results: Array<{ content: string; lineStart: number; lineEnd: number }> = [];

  let inArray = false;
  let foundArrayOpen = false;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!inArray) {
      if (line.includes(arrayName) && line.includes("[")) {
        inArray = true;
      }
      i++;
      continue;
    }

    if (line.trim() === "};") break;

    const trimmed = line.trim();
    if (trimmed === "{" || trimmed.startsWith("{") && trimmed !== "{") {
      if (trimmed === "{") {
        if (!foundArrayOpen) {
          foundArrayOpen = true;
          i++;
          continue;
        }
      }

      const lineStart = i + 1;
      let braceDepth = 0;
      let content = "";
      let j = i;

      while (j < lines.length) {
        const cur = lines[j].replace(/\/\/.*$/, "").trim();
        for (const ch of cur) {
          if (ch === "{") braceDepth++;
          else if (ch === "}") braceDepth--;
        }
        if (cur) content += (content ? " " : "") + cur;
        j++;
        if (braceDepth === 0) break;
      }

      if (braceDepth !== 0) {
        i++;
        continue;
      }

      const lineEnd = j;

      if (foundArrayOpen || content.trim() !== "{") {
        results.push({ content, lineStart, lineEnd });
      }

      if (!foundArrayOpen && content.trim() === "{") {
        foundArrayOpen = true;
        results.pop();
      }

      i = j;
      continue;
    }

    i++;
  }

  return results;
}

export function parseSpellData(source: string, filePath: string): SpellEntry[] {
  const rawEntries = extractEntries(source, "spelldata[]");
  const results: SpellEntry[] = [];

  for (const { content, lineStart, lineEnd } of rawEntries) {
    const inner = content.replace(/^\{/, "").replace(/\},?$/, "").trim();
    const fields = parseEntryFields(inner);

    if (fields.length < 2) continue;

    const nativeId = fields[0].trim();
    if (!nativeId.startsWith("SPELL_")) continue;

    const nameMatch = fields[1].match(/^"(.*)"$/);
    const name = nameMatch ? nameMatch[1] : fields[1];

    results.push({
      nativeId,
      name,
      schools: fields[2]?.trim() ?? "",
      flags: fields[3]?.trim() ?? "",
      level: fields[4] ? parseInt(fields[4].trim(), 10) || 0 : 0,
      powerCap: fields[5] ? parseInt(fields[5].trim(), 10) || 0 : 0,
      minRange: fields[6]?.trim() ?? "",
      maxRange: fields[7]?.trim() ?? "",
      effectNoise: fields[8] ? parseInt(fields[8].trim(), 10) || 0 : 0,
      tile: fields[9]?.trim() ?? "",
      filePath,
      lineStart,
      lineEnd,
    });
  }

  return results;
}

export function parseBranchData(source: string, filePath: string): BranchEntry[] {
  const rawEntries = extractEntries(source, "branches[");
  const results: BranchEntry[] = [];

  for (const { content, lineStart, lineEnd } of rawEntries) {
    const inner = content.replace(/^\{/, "").replace(/\},?$/, "").trim();
    const fields = parseEntryFields(inner);

    if (fields.length < 2) continue;

    const nativeId = fields[0]?.trim() ?? "";
    if (!nativeId.startsWith("BRANCH_")) continue;

    results.push({
      nativeId,
      parentBranch: fields[1]?.trim() ?? "",
      mindepth: fields[2] ? parseInt(fields[2].trim(), 10) || 0 : 0,
      maxdepth: fields[3] ? parseInt(fields[3].trim(), 10) || 0 : 0,
      depth: fields[4] ? parseInt(fields[4].trim(), 10) || 0 : 0,
      absdepth: fields[5] ? parseInt(fields[5].trim(), 10) || 0 : 0,
      flags: fields[6]?.trim() ?? "",
      shortName: fields[7]?.trim() ?? "",
      longName: fields[8]?.trim() ?? "",
      abbrev: fields[9]?.trim() ?? "",
      floorColour: fields[10]?.trim() ?? "",
      rockColour: fields[11]?.trim() ?? "",
      travelShortcut: fields[12]?.trim() ?? "",
      runes: fields[13]?.trim() ?? "",
      ambientNoise: fields[14]?.trim() ?? "",
      filePath,
      lineStart,
      lineEnd,
    });
  }

  return results;
}

export function parseAbilityTypes(source: string, filePath: string): AbilityEntry[] {
  const lines = source.split("\n");
  const results: AbilityEntry[] = [];

  const enumMatch = source.match(/enum\s+ability_type\s*\{([^}]+)\}/s);
  if (!enumMatch) return results;

  const enumBody = enumMatch[1];
  const enumLines = enumBody.split("\n");

  for (let i = 0; i < enumLines.length; i++) {
    const line = enumLines[i].trim();
    if (!line || line.startsWith("//") || line.startsWith("#")) continue;

    const entryMatch = line.match(/^(\w+)\s*=\s*(\d+)/);
    if (!entryMatch) continue;

    const nativeId = entryMatch[1];
    const lineNum = source.substring(0, source.indexOf(enumBody) + enumLines.slice(0, i + 1).join("\n").length).split("\n").length;

    let flags = "";
    let hotkey = "";

    const commentMatch = line.match(/\/\/\s*(.+)$/);
    if (commentMatch) {
      const comment = commentMatch[1];
      const flagsMatch = comment.match(/flags:\s*([^\s,]+)/);
      if (flagsMatch) flags = flagsMatch[1];
      const hotkeyMatch = comment.match(/hotkey:\s*([^\s,]+)/);
      if (hotkeyMatch) hotkey = hotkeyMatch[1];
    }

    results.push({
      nativeId,
      flags,
      hotkey,
      filePath,
      lineStart: lineNum,
      lineEnd: lineNum,
    });
  }

  return results;
}
