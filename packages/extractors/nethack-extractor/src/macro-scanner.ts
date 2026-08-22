/*
<MODULE_CONTRACT>
<purpose>C-Macro Scanner — owns line-scanning, macro-pattern matching, paren-depth accumulation, and optional preprocessor directive filtering for C header file parsing.</purpose>
<non-goals>
  <item>Does not extract fields from macro invocations — returns raw accumulated text with line ranges.</item>
  <item>Does not construct knowledge records — returns scanned macro invocations for the caller's finalize function.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: extracted from c-parser.ts to unify the duplicated paren-depth accumulation loop and preprocessor handling.</item>
</CHANGE_SUMMARY>
*/
export interface ScannedMacro {
  fullText: string;
  lineStart: number;
  lineEnd: number;
}

export function scanCMacros(
  source: string,
  macroPattern: RegExp,
  options?: { handlePreprocessor?: boolean },
): ScannedMacro[] {
  const lines = source.split("\n");
  const results: ScannedMacro[] = [];

  let skipDepth = 0;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (options?.handlePreprocessor) {
      if (
        trimmed.match(/^#if\s+0\b/) ||
        (trimmed.match(/^#if\b/) && skipDepth > 0) ||
        (trimmed.match(/^#ifdef\b/) && skipDepth > 0) ||
        (trimmed.match(/^#ifndef\b/) && skipDepth > 0)
      ) {
        skipDepth++;
        i++;
        continue;
      }
      if (trimmed.match(/^#endif\b/)) {
        if (skipDepth > 0) skipDepth--;
        i++;
        continue;
      }
      if (trimmed.match(/^#else\b/) || trimmed.match(/^#elif\b/)) {
        i++;
        continue;
      }
      if (skipDepth > 0) {
        i++;
        continue;
      }
    }

    const match = line.match(macroPattern);
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

    results.push({ fullText, lineStart, lineEnd });
    i = lineEnd;
  }

  return results;
}
