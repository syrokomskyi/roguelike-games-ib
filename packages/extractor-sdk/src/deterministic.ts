/*
<MODULE_CONTRACT>
<purpose>Runs an extractor twice and compares SHA-256 hashes of normalized run results to verify determinism.</purpose>
<non-goals>
  <item>Does not validate record content — only compares run metadata hashes.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: deterministic run verifier with normalizeRunResult, hashRunResult, and createExtractorContext.</item>
</CHANGE_SUMMARY>
*/
import { createHash } from "node:crypto";
import { canonicalJsonStringify } from "@roguelike-games-ib/knowledge-core";
import type { Extractor, ExtractorContext, ExtractorRunResult } from "./types.ts";

export interface DeterministicRunResult {
  run1: ExtractorRunResult;
  run2: ExtractorRunResult;
  hash1: string;
  hash2: string;
  deterministic: boolean;
}

export function normalizeRunResult(result: ExtractorRunResult): string {
  const normalized = {
    extractorId: result.extractorId,
    extractorVersion: result.extractorVersion,
    recordCount: result.recordCount,
    populationCounts: result.populationCounts,
    diagnostics: result.diagnostics,
  };
  return canonicalJsonStringify(normalized);
}

export function hashRunResult(result: ExtractorRunResult): string {
  return createHash("sha256").update(normalizeRunResult(result)).digest("hex");
}

export async function runExtractorDeterministic(
  extractor: Extractor,
  createContext: () => ExtractorContext,
): Promise<DeterministicRunResult> {
  const ctx1 = createContext();
  const run1 = await extractor.run(ctx1);
  const hash1 = hashRunResult(run1);

  const ctx2 = createContext();
  const run2 = await extractor.run(ctx2);
  const hash2 = hashRunResult(run2);

  return {
    run1,
    run2,
    hash1,
    hash2,
    deterministic: hash1 === hash2,
  };
}

// Re-exported from runner.ts for backward compatibility
export { createExtractorContext } from "./runner.ts";
