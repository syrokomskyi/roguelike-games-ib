/*
<MODULE_CONTRACT>
<purpose>Detects source drift by comparing canonical binding fingerprint and version against current values.</purpose>
<non-goals>
  <item>Does not trigger re-extraction — drift detection and reporting only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: DriftResult type and detectSourceDrift function.</item>
</CHANGE_SUMMARY>
*/
export interface DriftResult {
  drifted: boolean;
  reason: string;
  old_fingerprint?: string;
  new_fingerprint?: string;
  old_version?: string;
  new_version?: string;
}

/**
 * Detect source drift by comparing current fingerprint/version with canonical binding.
 */
export function detectSourceDrift(
  canonicalBinding: {
    fingerprint: { value: string };
    declared_version: string;
    binding_digest: string;
  },
  currentFingerprint: string,
  currentVersion: string,
): DriftResult {
  if (canonicalBinding.fingerprint.value !== currentFingerprint) {
    if (canonicalBinding.declared_version !== currentVersion) {
      return {
        drifted: true,
        reason: "Version changed and fingerprint changed",
        old_fingerprint: canonicalBinding.fingerprint.value,
        new_fingerprint: currentFingerprint,
        old_version: canonicalBinding.declared_version,
        new_version: currentVersion,
      };
    }
    return {
      drifted: true,
      reason: "Fingerprint changed without version bump",
      old_fingerprint: canonicalBinding.fingerprint.value,
      new_fingerprint: currentFingerprint,
      old_version: canonicalBinding.declared_version,
      new_version: currentVersion,
    };
  }

  if (canonicalBinding.declared_version !== currentVersion) {
    return {
      drifted: true,
      reason: "Version changed",
      old_version: canonicalBinding.declared_version,
      new_version: currentVersion,
    };
  }

  return {
    drifted: false,
    reason: "No drift detected",
  };
}
