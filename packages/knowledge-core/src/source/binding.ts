import { computeBindingDigest } from "../hash.ts";

export interface SourceBinding {
  source_id: string;
  source_unit_path: string;
  declared_version: string;
  version_scheme: string;
  metadata_origin: string;
  payload_path: string;
  fingerprint: {
    algorithm: string;
    value: string;
  };
  vcs: {
    repository: string | null;
    commit: string | null;
    clean: boolean | null;
  } | null;
  binding_digest: string;
}

export function createSourceBinding(
  sourceId: string,
  sourceUnitPath: string,
  declaredVersion: string,
  versionScheme: string,
  metadataOrigin: string,
  fingerprintValue: string,
  vcs: SourceBinding["vcs"],
): SourceBinding {
  const bindingDigest = computeBindingDigest(
    fingerprintValue,
    declaredVersion,
    sourceId,
  );

  return {
    source_id: sourceId,
    source_unit_path: sourceUnitPath,
    declared_version: declaredVersion,
    version_scheme: versionScheme,
    metadata_origin: metadataOrigin,
    payload_path: "source",
    fingerprint: {
      algorithm: "sha256-tree-v1",
      value: fingerprintValue,
    },
    vcs,
    binding_digest: bindingDigest,
  };
}
