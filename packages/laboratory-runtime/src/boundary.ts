/*
<MODULE_CONTRACT>
<purpose>Enforces authority boundaries — no laboratory refs in canonical records, no canonical mutations from laboratory, canonical IDs only in ancestry.</purpose>
<non-goals>
  <item>Does not validate seed content — boundary enforcement only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: assertNoLabRefInCanonical, assertNoCanonicalMutation, assertCanonicalIdsOnly, assertNoSeedSelfReference.</item>
</CHANGE_SUMMARY>
*/
import { isLaboratoryRecordId, isCanonicalRecordId } from "./schema.ts";

export interface BoundaryCheckResult {
  valid: boolean;
  violations: string[];
}

export function assertNoLabRefInCanonical(
  canonicalRecords: Array<Record<string, unknown>>,
): BoundaryCheckResult {
  const violations: string[] = [];
  const refFields = [
    "evidence_refs",
    "claim_refs",
    "participant_refs",
    "implementation_refs",
    "subject_id",
    "object_ref",
    "source_record_id",
    "target_record_id",
  ];

  for (const record of canonicalRecords) {
    for (const field of refFields) {
      const value = record[field];
      if (typeof value === "string" && isLaboratoryRecordId(value)) {
        violations.push(`Canonical record references laboratory id in field '${field}': ${value}`);
      } else if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === "string" && isLaboratoryRecordId(item)) {
            violations.push(`Canonical record references laboratory id in field '${field}': ${item}`);
          }
        }
      }
    }
  }

  return { valid: violations.length === 0, violations };
}

export function assertNoCanonicalMutation(
  laboratoryRoot: string,
  canonicalRoot: string,
  writePath: string,
): void {
  const normalizedWrite = writePath.replace(/\\/g, "/");
  const normalizedCanonical = canonicalRoot.replace(/\\/g, "/");

  if (normalizedWrite.startsWith(normalizedCanonical)) {
    throw new Error(
      `Authority boundary violation: laboratory operation attempted to write to canonical root: ${writePath}`,
    );
  }
}

export function assertCanonicalIdsOnly(ids: string[]): BoundaryCheckResult {
  const violations: string[] = [];
  for (const id of ids) {
    if (!isCanonicalRecordId(id)) {
      violations.push(`Expected canonical record id but got: ${id}`);
    }
  }
  return { valid: violations.length === 0, violations };
}

export function assertNoSeedSelfReference(seedId: string, referencedIds: string[]): BoundaryCheckResult {
  const violations: string[] = [];
  for (const ref of referencedIds) {
    if (ref === seedId) {
      violations.push(`Seed ${seedId} cannot reference itself as evidence or ancestry`);
    }
  }
  return { valid: violations.length === 0, violations };
}
