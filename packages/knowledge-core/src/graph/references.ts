/**
 * Validate that all canonical references exist and no Laboratory/staging refs
 * appear in canonical authority.
 */
export function validateReferences(
  allRecordIds: Set<string>,
  canonicalRecordIds: Set<string>,
  laboratoryRecordIds: Set<string>,
  stagingRecordIds: Set<string>,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // No canonical record should reference Laboratory records
  for (const labId of laboratoryRecordIds) {
    if (canonicalRecordIds.has(labId)) {
      errors.push(`Record '${labId}' appears in both canonical and Laboratory`);
    }
  }

  // No canonical record should reference staging records
  for (const stagingId of stagingRecordIds) {
    if (canonicalRecordIds.has(stagingId)) {
      errors.push(`Record '${stagingId}' appears in both canonical and staging`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Check that a record ID follows the canonical URN pattern.
 */
export function isCanonicalRecordId(id: string): boolean {
  return /^urn:roguelike-games-ib:record:[0-9a-fA-F-]{36}$/.test(id);
}

/**
 * Collect all referenced IDs from a record (evidence_refs, claim_refs, etc.)
 */
export function collectReferences(record: Record<string, unknown>): string[] {
  const refs: string[] = [];
  const fields = [
    "evidence_refs",
    "claim_refs",
    "participant_refs",
    "implementation_refs",
    "subject_id",
    "object_ref",
    "source_record_id",
    "target_record_id",
  ];

  for (const field of fields) {
    const value = record[field];
    if (typeof value === "string" && isCanonicalRecordId(value)) {
      refs.push(value);
    } else if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === "string" && isCanonicalRecordId(item)) {
          refs.push(item);
        }
      }
    }
  }

  return refs;
}
