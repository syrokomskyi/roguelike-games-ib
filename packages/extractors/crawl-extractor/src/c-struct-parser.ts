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
  name: string;
  value: number | null;
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

    if (trimmed.startsWith("#ifdef") || trimmed.startsWith("#ifndef")) {
      const parentActive = currentlyActive();
      const isIfdef = trimmed.startsWith("#ifdef");
      // We don't define any preprocessor macros — #ifdef is false, #ifndef is true
      const active = isIfdef ? false : true;
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
  const rawLines = source.split("\n");
  const results: AbilityEntry[] = [];

  const condStack: Array<{ active: boolean; seenElse: boolean }> = [];
  function currentlyActive(): boolean {
    return condStack.every((c) => c.active);
  }

  let inEnum = false;
  let foundEnumKeyword = false;

  for (let i = 0; i < rawLines.length; i++) {
    const trimmed = rawLines[i].trim();

    // Handle preprocessor directives
    if (/^#if[\s\(]/.test(trimmed) && !trimmed.startsWith("#ifdef") && !trimmed.startsWith("#ifndef")) {
      let active = false;
      if (trimmed.match(/^#if\s+TAG_MAJOR_VERSION\s*==\s*34/)) {
        active = true;
      } else if (trimmed.match(/^#if\s+TAG_MAJOR_VERSION\s*>\s*34/)) {
        active = false;
      } else {
        active = true;
      }
      condStack.push({ active, seenElse: false });
      continue;
    }

    if (trimmed.startsWith("#ifdef") || trimmed.startsWith("#ifndef")) {
      const isIfdef = trimmed.startsWith("#ifdef");
      condStack.push({ active: isIfdef ? false : true, seenElse: false });
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

    if (!currentlyActive()) continue;

    // Detect enum start (handle multi-line: "enum ability_type" then "{" on next line)
    if (!inEnum) {
      if (/enum\s+ability_type/.test(trimmed)) {
        foundEnumKeyword = true;
        if (trimmed.includes("{")) inEnum = true;
      } else if (foundEnumKeyword && trimmed.startsWith("{")) {
        inEnum = true;
      }
      continue;
    }

    // Detect enum end
    if (trimmed === "};") break;

    // Strip comments
    const commentIdx = trimmed.indexOf("//");
    const line = commentIdx >= 0 ? trimmed.substring(0, commentIdx).trim() : trimmed;
    if (!line) continue;

    // Match enum entries: ABIL_NAME or ABIL_NAME = value
    // Skip aliases (value references another ABIL_*)
    const entryMatch = line.match(/^(ABIL_\w+)\s*(?:=\s*(.+))?[,]?$/);
    if (!entryMatch) continue;

    const nativeId = entryMatch[1];
    const valuePart = entryMatch[2]?.trim() ?? null;

    // Skip aliases (value is a reference to another ABIL_*)
    if (valuePart && /^ABIL_/.test(valuePart)) continue;

    // Skip ABIL_NON_ABILITY sentinel
    if (nativeId === "ABIL_NON_ABILITY") continue;

    // Parse numeric value if present
    let value: number | null = null;
    if (valuePart) {
      const numMatch = valuePart.match(/^-?\d+/);
      if (numMatch) value = parseInt(numMatch[0], 10);
    }

    // Derive display name from nativeId
    const name = nativeId
      .replace(/^ABIL_/, "")
      .toLowerCase()
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());

    results.push({
      nativeId,
      name,
      value,
      filePath,
      lineStart: i + 1,
      lineEnd: i + 1,
    });
  }

  return results;
}
