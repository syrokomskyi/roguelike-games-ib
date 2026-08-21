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
