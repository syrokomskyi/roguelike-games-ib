import { CoverageDimension, CoverageState, DenominatorKind, CoverageRecord } from "./dimensions.ts";

/**
 * Compute coverage state for a dimension.
 *
 * Rules:
 * - exhaustive_for_binding requires expected === extracted === validated and unresolved === 0
 * - qualitative dimensions can never be exhaustive
 * - source drift invalidates exhaustive_for_binding
 * - the project must never expose a single boolean `complete: true`
 */
export function computeDimensionState(
  denominatorKind: DenominatorKind,
  expected: number | null,
  extracted: number | null,
  validated: number | null,
  unresolved: number | null,
  bindingDrifted: boolean,
): CoverageState {
  // Qualitative dimensions can never be exhaustive
  if (denominatorKind === "qualitative") {
    if (unresolved && unresolved > 0) return "blocked";
    if (validated && validated > 0) return "substantially_covered";
    return "partial";
  }

  // Drift invalidates exhaustive
  if (bindingDrifted) {
    if (extracted && extracted > 0) return "partial";
    return "not_assessed";
  }

  // Exhaustive requires exact denominator equality
  if (
    expected !== null &&
    extracted !== null &&
    validated !== null &&
    unresolved !== null &&
    expected === extracted &&
    extracted === validated &&
    unresolved === 0
  ) {
    return "exhaustive_for_binding";
  }

  if (unresolved && unresolved > 0) return "blocked";

  if (
    expected !== null &&
    extracted !== null &&
    extracted > 0 &&
    extracted >= expected * 0.8
  ) {
    return "substantially_covered";
  }

  if (extracted && extracted > 0) return "partial";

  return "not_assessed";
}

/**
 * Compute coverage for a source binding.
 */
export function computeCoverage(
  sourceId: string,
  bindingDigest: string,
  dimensions: CoverageDimension[],
  bindingDrifted = false,
): CoverageRecord {
  return {
    schema: "rgkb/coverage@2",
    source_id: sourceId,
    binding_digest: bindingDigest,
    dimensions: dimensions.map((d) => ({
      ...d,
      state: bindingDrifted && d.state === "exhaustive_for_binding"
        ? "partial"
        : d.state,
    })),
  };
}

/**
 * Assert that no universal complete boolean is exposed.
 */
export function assertNoCompleteBoolean(record: Record<string, unknown>): string[] {
  const errors: string[] = [];
  if ("complete" in record && typeof record.complete === "boolean") {
    errors.push("Coverage record must not expose a universal 'complete' boolean");
  }
  return errors;
}
