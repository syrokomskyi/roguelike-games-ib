/*
<MODULE_CONTRACT>
<purpose>Validates the full canonical graph by running reference, claim, relation, contradiction, and authority passes in sequence.</purpose>
<non-goals>
  <item>Does not repair graph integrity — reports errors only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: validateCanonicalGraph orchestrating all validation passes.</item>
</CHANGE_SUMMARY>
*/
import { validateClaims, ClaimRecord } from "./claims.ts";
import { validateRelations, RelationRecord, RelationTypeDefinition } from "./relations.ts";
import { validateContradictions, ContradictionRecord } from "./contradictions.ts";
import { validateReferences, collectReferences, isCanonicalRecordId } from "./references.ts";

export interface CanonicalGraphInput {
  records: Map<string, { record_type: string; data: Record<string, unknown> }>;
  claims: ClaimRecord[];
  relations: RelationRecord[];
  contradictions: ContradictionRecord[];
  relationTypes: Map<string, RelationTypeDefinition>;
  laboratoryRecordIds?: Set<string>;
  stagingRecordIds?: Set<string>;
}

export interface GraphValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate the full canonical graph.
 * Runs all validation passes: references, claims, relations, contradictions.
 */
export function validateCanonicalGraph(input: CanonicalGraphInput): GraphValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const knownIds = new Set<string>(input.records.keys());
  const knownRecordTypes = new Map<string, string>();
  for (const [id, record] of input.records) {
    knownRecordTypes.set(id, record.record_type);
  }

  // Reference pass
  const refResult = validateReferences(
    knownIds,
    knownIds,
    input.laboratoryRecordIds ?? new Set<string>(),
    input.stagingRecordIds ?? new Set<string>(),
  );
  errors.push(...refResult.errors);

  // Claim pass
  const claimResult = validateClaims(input.claims, knownIds);
  errors.push(...claimResult.errors);

  // Relation pass
  const relationResult = validateRelations(
    input.relations,
    knownIds,
    knownRecordTypes,
    input.relationTypes,
  );
  errors.push(...relationResult.errors);

  // Contradiction pass
  const contraResult = validateContradictions(input.contradictions, knownIds);
  errors.push(...contraResult.errors);

  // Authority pass — no Laboratory refs in canonical
  for (const [id, record] of input.records) {
    const refs = collectReferences(record.data);
    for (const ref of refs) {
      if (!isCanonicalRecordId(ref)) {
        errors.push(`Record ${id}: invalid reference format '${ref}'`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
