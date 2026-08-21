/*
<MODULE_CONTRACT>
<purpose>Re-anchors evidence locators after source refresh by matching fragment hashes at original or new locations.</purpose>
<non-goals>
  <item>Does not modify source files — read-only re-anchoring.</item>
  <item>Does not auto-resolve ambiguous matches — flags for manual review.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: reanchorEvidence with exact-match, unique-match, and ambiguity detection.</item>
</CHANGE_SUMMARY>
*/
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { sha256, computeFragmentHash } from "../hash.ts";

export interface ReanchorResult {
  reanchored: boolean;
  new_locator: {
    line_start: number | null;
    line_end: number | null;
  } | null;
  new_fragment_hash: string | null;
  ambiguous: boolean;
  reason: string;
}

/**
 * Re-anchor evidence after a source refresh.
 *
 * Priority:
 * 1. Exact fragment hash match at same relative path → automatic rebind
 * 2. Unique fragment hash match anywhere in the same file → automatic re-anchor
 * 3. Multiple matches → ambiguous, requires review
 * 4. No match → unresolved review item
 */
export function reanchorEvidence(
  sourceRoot: string,
  artifactPath: string,
  oldFragmentHash: string,
  oldLineStart: number | null,
  oldLineEnd: number | null,
): ReanchorResult {
  const fullPath = join(sourceRoot, artifactPath);

  if (!existsSync(fullPath)) {
    return {
      reanchored: false,
      new_locator: null,
      new_fragment_hash: null,
      ambiguous: false,
      reason: "Artifact file not found after refresh",
    };
  }

  const content = readFileSync(fullPath, "utf-8");
  const lines = content.split("\n");

  // 1. Try exact match at same location
  if (oldLineStart !== null && oldLineEnd !== null) {
    const currentHash = computeFragmentHash(content, oldLineStart, oldLineEnd);
    if (currentHash === oldFragmentHash) {
      return {
        reanchored: true,
        new_locator: { line_start: oldLineStart, line_end: oldLineEnd },
        new_fragment_hash: currentHash,
        ambiguous: false,
        reason: "Exact match at same location",
      };
    }
  }

  // 2. Search for unique fragment match in the file
  const matches: { line_start: number; line_end: number }[] = [];

  // Try different window sizes around the original
  const originalSize = (oldLineEnd ?? 1) - (oldLineStart ?? 1) + 1;
  const windowSizes = [originalSize, originalSize + 1, originalSize - 1, 1, 2, 3, 5, 10, 20, 50];

  for (const windowSize of windowSizes) {
    if (windowSize < 1) continue;
    for (let i = 0; i <= lines.length - windowSize; i++) {
      const fragment = lines.slice(i, i + windowSize).join("\n");
      const hash = sha256(fragment);
      if (hash === oldFragmentHash) {
        matches.push({ line_start: i + 1, line_end: i + windowSize });
      }
    }
    // If we found matches with this window size, stop searching
    if (matches.length > 0) break;
  }

  if (matches.length === 0) {
    return {
      reanchored: false,
      new_locator: null,
      new_fragment_hash: null,
      ambiguous: false,
      reason: "Fragment not found in file after refresh",
    };
  }

  if (matches.length === 1) {
    return {
      reanchored: true,
      new_locator: matches[0],
      new_fragment_hash: oldFragmentHash,
      ambiguous: false,
      reason: "Unique fragment match found",
    };
  }

  return {
    reanchored: false,
    new_locator: null,
    new_fragment_hash: null,
    ambiguous: true,
    reason: `Fragment hash matched ${matches.length} locations — manual review required`,
  };
}
