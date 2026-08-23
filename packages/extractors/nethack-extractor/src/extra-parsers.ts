import { scanCMacros } from "./macro-scanner.ts";

function splitTopLevelCommas(s: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "(") depth++;
    else if (s[i] === ")") depth--;
    else if (s[i] === "," && depth === 0) {
      parts.push(s.substring(start, i).trim());
      start = i + 1;
    }
  }
  parts.push(s.substring(start).trim());
  return parts;
}

function stripQuotes(s: string): string {
  const m = s.match(/^"([^"]*)"$/);
  return m ? m[1] : s;
}

function linesToEntries(
  source: string,
  startLinePattern: RegExp,
  endPattern: RegExp,
  startOffset: number,
): { text: string; lineStart: number; lineEnd: number }[] {
  const lines = source.split("\n");
  const entries: { text: string; lineStart: number; lineEnd: number }[] = [];
  let i = 0;

  while (i < lines.length) {
    if (lines[i].match(startLinePattern)) {
      const lineStart = i + 1;
      let text = lines[i];
      i++;
      while (i < lines.length && !lines[i].match(startLinePattern) && !lines[i].match(endPattern)) {
        text += "\n" + lines[i];
        i++;
      }
      const lineEnd = i;
      entries.push({ text, lineStart, lineEnd });
    } else if (lines[i].match(endPattern)) {
      break;
    } else {
      i++;
    }
  }
  return entries;
}

export interface ArtifactEntry {
  name: string;
  artifactType: string;
  spfx: string;
  spfx2: string;
  monsterType: string;
  attack: string;
  defense: string;
  carry: string;
  invocation: string;
  alignment: string;
  roleClass: string;
  race: string;
  genSpe: number;
  giftValue: number;
  cost: string;
  color: string;
  enumName: string;
  lineStart: number;
  lineEnd: number;
}

export function parseArtifacts(source: string): ArtifactEntry[] {
  const scanned = scanCMacros(source, /^\s*A\(/, { handlePreprocessor: true });
  const entries: ArtifactEntry[] = [];
  const seenIds = new Set<string>();

  for (const { fullText, lineStart, lineEnd } of scanned) {
    const aStart = fullText.indexOf("A(");
    if (aStart < 0) continue;
    const afterA = fullText.substring(aStart + 2);
    const closeIdx = findClosingParen(afterA);
    const content = afterA.substring(0, closeIdx).trim();
    const args = splitTopLevelCommas(content);

    if (args.length < 17) continue;

    const name = stripQuotes(args[0]);
    if (!name || name === "0") continue;

    const enumName = args[16].trim();

    if (seenIds.has(enumName)) continue;
    seenIds.add(enumName);

    entries.push({
      name,
      artifactType: args[1].trim(),
      spfx: args[2].trim(),
      spfx2: args[3].trim(),
      monsterType: args[4].trim(),
      attack: args[5].trim(),
      defense: args[6].trim(),
      carry: args[7].trim(),
      invocation: args[8].trim(),
      alignment: args[9].trim(),
      roleClass: args[10].trim(),
      race: args[11].trim(),
      genSpe: parseInt(args[12].trim(), 10) || 0,
      giftValue: parseInt(args[13].trim(), 10) || 0,
      cost: args[14].trim(),
      color: args[15].trim(),
      enumName,
      lineStart,
      lineEnd,
    });
  }

  return entries;
}

function findClosingParen(s: string): number {
  let depth = 1;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "(") depth++;
    else if (s[i] === ")") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return s.length - 1;
}

export interface TrapEntry {
  name: string;
  value: number;
  lineStart: number;
  lineEnd: number;
}

export function parseTraps(source: string): TrapEntry[] {
  const lines = source.split("\n");
  const entries: TrapEntry[] = [];
  let inEnum = false;
  const skipNames = new Set(["ALL_TRAPS", "NO_TRAP", "TRAPNUM"]);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.match(/enum\s+trap_types\s*\{/)) {
      inEnum = true;
      continue;
    }
    if (inEnum && line.match(/^\s*\}/)) {
      break;
    }
    if (!inEnum) continue;

    const m = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(-?\d+)/);
    if (m) {
      const name = m[1];
      const value = parseInt(m[2], 10);
      if (skipNames.has(name)) continue;
      entries.push({
        name,
        value,
        lineStart: i + 1,
        lineEnd: i + 1,
      });
    }
  }

  return entries;
}

export interface RoleEntry {
  name: string;
  femaleName: string;
  filecode: string;
  homebase: string;
  intermed: string;
  monsterIndex: string;
  leaderIndex: string;
  nemesisIndex: string;
  questArtifact: string;
  allowedMask: string;
  lineStart: number;
  lineEnd: number;
}

export function parseRoles(source: string): RoleEntry[] {
  const entries: { text: string; lineStart: number; lineEnd: number }[] = [];
  const lines = source.split("\n");
  let inArray = false;
  let i = 0;

  while (i < lines.length) {
    if (lines[i].includes("const struct Role roles[")) {
      inArray = true;
      i++;
      continue;
    }
    if (!inArray) {
      i++;
      continue;
    }
    if (lines[i].match(/^\s*UNDEFINED_ROLE/)) break;
    if (lines[i].match(/^    \{ \{/)) {
      const lineStart = i + 1;
      let text = lines[i];
      i++;
      while (i < lines.length && !lines[i].match(/^    \{ \{/) && !lines[i].match(/^\s*UNDEFINED_ROLE/) && !lines[i].match(/^\};/)) {
        text += "\n" + lines[i];
        i++;
      }
      const lineEnd = i;
      entries.push({ text, lineStart, lineEnd });
    } else {
      i++;
    }
  }

  return entries.map((e) => finalizeRoleEntry(e.text, e.lineStart, e.lineEnd));
}

function finalizeRoleEntry(text: string, lineStart: number, lineEnd: number): RoleEntry {
  const nameMatch = text.match(/\{\s*\{\s*"([^"]*)"\s*,\s*(?:"([^"]*)"|0)\s*\}/);
  const name = nameMatch ? nameMatch[1] : "";
  const femaleName = nameMatch && nameMatch[2] ? nameMatch[2] : "";

  const filecodeMatch = text.match(/^\s*"([A-Z][a-z]+)",\s*$/m);
  const filecode = filecodeMatch ? filecodeMatch[1] : "";

  const theMatches = text.match(/"the [^"]*"/g);
  const homebase = theMatches ? theMatches[0] : "";
  const intermed = theMatches && theMatches[1] ? theMatches[1] : "";

  const pmMatch = text.match(/PM_[A-Z_]+/g);
  const monsterIndex = pmMatch && pmMatch[0] ? pmMatch[0] : "NON_PM";
  const leaderIndex = pmMatch && pmMatch[1] ? pmMatch[1] : "NON_PM";
  const nemesisIndex = pmMatch && pmMatch[2] ? pmMatch[2] : "NON_PM";

  const artMatch = text.match(/(ART_[A-Z_]+)/);
  const questArtifact = artMatch ? artMatch[1] : "";

  const maskMatch = text.match(/(MH_[A-Z_]+\s*\|.*)/);
  const allowedMask = maskMatch ? maskMatch[1].trim() : "";

  return {
    name,
    femaleName,
    filecode,
    homebase,
    intermed,
    monsterIndex,
    leaderIndex,
    nemesisIndex,
    questArtifact,
    allowedMask,
    lineStart,
    lineEnd,
  };
}

export interface RaceEntry {
  noun: string;
  adj: string;
  collective: string;
  filecode: string;
  monsterIndex: string;
  mummyIndex: string;
  zombieIndex: string;
  allowedMask: string;
  lineStart: number;
  lineEnd: number;
}

export function parseRaces(source: string): RaceEntry[] {
  const lines = source.split("\n");
  const entries: { text: string; lineStart: number; lineEnd: number }[] = [];
  let inArray = false;
  let i = 0;

  while (i < lines.length) {
    if (lines[i].includes("const struct Race races[")) {
      inArray = true;
      i++;
      continue;
    }
    if (!inArray) {
      i++;
      continue;
    }
    if (lines[i].match(/^\s*UNDEFINED_RACE/)) break;
    if (lines[i].match(/^    \{$/)) {
      const lineStart = i + 1;
      let text = lines[i];
      i++;
      while (i < lines.length && !lines[i].match(/^    \{$/) && !lines[i].match(/^\s*UNDEFINED_RACE/) && !lines[i].match(/^\};/)) {
        text += "\n" + lines[i];
        i++;
      }
      const lineEnd = i;
      entries.push({ text, lineStart, lineEnd });
    } else {
      i++;
    }
  }

  return entries.map((e) => finalizeRaceEntry(e.text, e.lineStart, e.lineEnd));
}

function finalizeRaceEntry(text: string, lineStart: number, lineEnd: number): RaceEntry {
  const lines = text.split("\n");
  const noun = lines[1] ? stripQuotes(lines[1].trim().replace(/,$/, "").trim()) : "";
  const adj = lines[2] ? stripQuotes(lines[2].trim().replace(/,$/, "").trim()) : "";
  const collective = lines[3] ? stripQuotes(lines[3].trim().replace(/,$/, "").trim()) : "";
  const filecode = lines[4] ? stripQuotes(lines[4].trim().replace(/,$/, "").trim()) : "";

  const pmMatch = text.match(/PM_[A-Z_]+/g);
  const monsterIndex = pmMatch && pmMatch[0] ? pmMatch[0] : "NON_PM";
  const mummyIndex = pmMatch && pmMatch[1] ? pmMatch[1] : "NON_PM";
  const zombieIndex = pmMatch && pmMatch[2] ? pmMatch[2] : "NON_PM";

  const maskMatch = text.match(/(MH_[A-Z_]+\s*\|.*)/);
  const allowedMask = maskMatch ? maskMatch[1].trim() : "";

  return {
    noun,
    adj,
    collective,
    filecode,
    monsterIndex,
    mummyIndex,
    zombieIndex,
    allowedMask,
    lineStart,
    lineEnd,
  };
}

export interface DungeonBranchEntry {
  name: string;
  bonetag: string;
  base: number;
  range: number;
  alignment: string;
  flags: string;
  lineStart: number;
  lineEnd: number;
}

export function parseDungeonBranches(source: string): DungeonBranchEntry[] {
  const lines = source.split("\n");
  const entries: DungeonBranchEntry[] = [];
  let inTable = false;
  let depth = 0;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.match(/^dungeon\s*=\s*\{/)) {
      inTable = true;
      depth = 1;
      i++;
      continue;
    }
    if (!inTable) {
      i++;
      continue;
    }

    for (const ch of trimmed) {
      if (ch === "{") depth++;
      else if (ch === "}") depth--;
    }

    if (depth <= 0) break;

    if (line.match(/^   \{$/)) {
      const lineStart = i + 1;
      let text = line;
      let j = i + 1;
      let innerDepth = 1;
      while (j < lines.length && innerDepth > 0) {
        const t = lines[j].trim();
        for (const ch of t) {
          if (ch === "{") innerDepth++;
          else if (ch === "}") innerDepth--;
        }
        if (innerDepth <= 0) break;
        text += "\n" + lines[j];
        j++;
      }
      const lineEnd = j;

      const nameMatch = text.match(/name\s*=\s*"([^"]*)"/);
      const bonetagMatch = text.match(/bonetag\s*=\s*"([^"]*)"/);
      const baseMatch = text.match(/base\s*=\s*(-?\d+)/);
      const rangeMatch = text.match(/range\s*=\s*(-?\d+)/);
      const alignmentMatch = text.match(/alignment\s*=\s*"([^"]*)"/);
      const flagsMatch = text.match(/flags\s*=\s*\{([^}]*)\}/);

      entries.push({
        name: nameMatch ? nameMatch[1] : "",
        bonetag: bonetagMatch ? bonetagMatch[1] : "",
        base: baseMatch ? parseInt(baseMatch[1], 10) : 0,
        range: rangeMatch ? parseInt(rangeMatch[1], 10) : 0,
        alignment: alignmentMatch ? alignmentMatch[1] : "",
        flags: flagsMatch ? flagsMatch[1].trim() : "",
        lineStart,
        lineEnd,
      });

      i = lineEnd;
      continue;
    }

    i++;
  }

  return entries;
}

export interface SkillEntry {
  name: string;
  value: number;
  lineStart: number;
  lineEnd: number;
}

export function parseSkills(source: string): SkillEntry[] {
  const lines = source.split("\n");
  const entries: SkillEntry[] = [];
  let inEnum = false;
  const skipNames = new Set(["P_NONE", "P_NUM_SKILLS"]);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.match(/enum\s+p_skills\s*\{/)) {
      inEnum = true;
      continue;
    }
    if (inEnum && line.match(/^\s*\}/)) {
      break;
    }
    if (!inEnum) continue;

    const m = line.match(/^\s*(P_[A-Z_0-9]+)\s*=\s*(-?\d+)/);
    if (m) {
      const name = m[1];
      const value = parseInt(m[2], 10);
      if (skipNames.has(name)) continue;
      entries.push({
        name,
        value,
        lineStart: i + 1,
        lineEnd: i + 1,
      });
    }
  }

  return entries;
}

export interface AttackTypeEntry {
  nativeId: string;
  name: string;
  value: number;
  lineStart: number;
  lineEnd: number;
}

export function parseAttackTypes(source: string): AttackTypeEntry[] {
  const entries: AttackTypeEntry[] = [];
  const skipNames = new Set(["AT_ANY"]);
  const lines = source.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(/^#define\s+(AT_\w+)\s+(-?\d+)/);
    if (!m) continue;

    const nativeId = m[1];
    if (skipNames.has(nativeId)) continue;

    const value = parseInt(m[2], 10);
    const name = nativeId
      .replace(/^AT_/, "")
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());

    entries.push({
      nativeId,
      name,
      value,
      lineStart: i + 1,
      lineEnd: i + 1,
    });
  }

  return entries;
}

export interface MonsterAbilityEntry {
  nativeId: string;
  name: string;
  flagGroup: string;
  lineStart: number;
  lineEnd: number;
}

export function parseMonsterAbilities(source: string): MonsterAbilityEntry[] {
  const entries: MonsterAbilityEntry[] = [];
  const skipNames = new Set([
    "M1_NOLIMBS", "M1_OMNIVORE",
    "M3_WANTSALL", "M3_COVETOUS", "M3_WAITMASK",
  ]);
  const seen = new Set<string>();
  const lines = source.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(/^#define\s+(M[123]_\w+)\s+/);
    if (!m) continue;

    const nativeId = m[1];
    if (skipNames.has(nativeId)) continue;
    if (seen.has(nativeId)) continue;
    seen.add(nativeId);

    const flagGroup = nativeId.startsWith("M1_") ? "M1"
      : nativeId.startsWith("M2_") ? "M2"
      : "M3";

    const name = nativeId
      .replace(/^M[123]_/, "")
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());

    entries.push({
      nativeId,
      name,
      flagGroup,
      lineStart: i + 1,
      lineEnd: i + 1,
    });
  }

  return entries;
}
