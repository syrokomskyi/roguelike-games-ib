/*
<MODULE_CONTRACT>
<purpose>Re-exports computeSourceFingerprint and creates FingerprintResult wrappers with algorithm metadata for source verification.</purpose>
<non-goals>
  <item>Does not implement fingerprint computation — delegates to hash.ts.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: FingerprintResult type and createFingerprintResult function.</item>
</CHANGE_SUMMARY>
*/
export { computeSourceFingerprint } from "../hash.ts";

export interface FingerprintResult {
  algorithm: "sha256-tree-v1";
  value: string;
}

export function createFingerprintResult(value: string): FingerprintResult {
  return {
    algorithm: "sha256-tree-v1",
    value,
  };
}
