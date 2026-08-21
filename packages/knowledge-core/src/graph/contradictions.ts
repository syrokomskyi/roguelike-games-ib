export interface ContradictionRecord {
  id: string;
  claim_refs: string[];
  contradiction_status: "unresolved" | "resolved";
  resolution: string | null;
  resolution_evidence_refs: string[];
}

/**
 * Validate that all contradiction claim refs exist.
 * Unresolved contradictions must remain visibly unresolved.
 */
export function validateContradictions(
  contradictions: ContradictionRecord[],
  knownIds: Set<string>,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  for (const contra of contradictions) {
    if (contra.claim_refs.length < 2) {
      errors.push(`Contradiction ${contra.id}: must reference at least 2 claims`);
    }

    for (const claimRef of contra.claim_refs) {
      if (!knownIds.has(claimRef)) {
        errors.push(`Contradiction ${contra.id}: dangling claim_ref '${claimRef}'`);
      }
    }

    // Unresolved contradictions must not masquerade as resolved facts
    if (contra.contradiction_status === "unresolved" && contra.resolution !== null) {
      errors.push(
        `Contradiction ${contra.id}: unresolved contradiction must not have a resolution`,
      );
    }

    for (const evidenceRef of contra.resolution_evidence_refs) {
      if (!knownIds.has(evidenceRef)) {
        errors.push(
          `Contradiction ${contra.id}: dangling resolution_evidence_ref '${evidenceRef}'`,
        );
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
