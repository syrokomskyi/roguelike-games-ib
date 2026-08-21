/*
<MODULE_CONTRACT>
<purpose>Validates claim records by checking subject IDs, object refs, and evidence refs against known record IDs.</purpose>
<non-goals>
  <item>Does not resolve contested claims — flags them for contradiction validation.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: ClaimRecord type and validateClaims function.</item>
</CHANGE_SUMMARY>
*/
import { GraphIntegrityError } from "../errors.ts";

export interface ClaimRecord {
  id: string;
  subject_id: string;
  predicate: string;
  object_ref?: string;
  value?: unknown;
  assertion_state: "supported" | "contested";
  evidence_refs: string[];
}

/**
 * Validate that all claim subjects and evidence refs exist.
 */
export function validateClaims(
  claims: ClaimRecord[],
  knownIds: Set<string>,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const claim of claims) {
    if (!knownIds.has(claim.subject_id)) {
      errors.push(`Claim ${claim.id}: dangling subject_id '${claim.subject_id}'`);
    }

    if (claim.object_ref && !knownIds.has(claim.object_ref)) {
      errors.push(`Claim ${claim.id}: dangling object_ref '${claim.object_ref}'`);
    }

    for (const evidenceRef of claim.evidence_refs) {
      if (!knownIds.has(evidenceRef)) {
        errors.push(`Claim ${claim.id}: dangling evidence_ref '${evidenceRef}'`);
      }
    }

    if (claim.assertion_state === "contested") {
      // Contested claims must remain visibly contested — no auto-resolution
      // This is validated at the contradiction pass
    }
  }

  return { valid: errors.length === 0, errors };
}
