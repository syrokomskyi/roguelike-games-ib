/*
<MODULE_CONTRACT>
<purpose>Defines coverage dimension types — states, denominator kinds, dimension and record interfaces.</purpose>
<non-goals>
  <item>Does not compute coverage — type definitions only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: CoverageState, DenominatorKind, CoverageDimension, CoverageRecord types.</item>
</CHANGE_SUMMARY>
*/
export type CoverageState =
  | "not_assessed"
  | "partial"
  | "substantially_covered"
  | "exhaustive_for_binding"
  | "blocked";

export type DenominatorKind =
  | "extractor_population"
  | "declared_target_set"
  | "qualitative";

export interface CoverageDimension {
  id: string;
  state: CoverageState;
  basis: string;
  expected: number | null;
  extracted: number | null;
  validated: number | null;
  unresolved: number | null;
  notes: string | null;
}

export interface CoverageRecord {
  schema: string;
  source_id: string;
  binding_digest: string;
  dimensions: CoverageDimension[];
}
