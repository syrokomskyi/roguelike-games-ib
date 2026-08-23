/*
<MODULE_CONTRACT>
<purpose>Creates source bindings with fingerprint, version, VCS metadata, binding digest, and optional supplemental paths for evidence extraction outside payload root.</purpose>
<non-goals>
  <item>Does not compute fingerprints — receives fingerprint values from caller.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: SourceBinding type and createSourceBinding function.</item>
  <item>RFC-0008: Added SupplementalPath type, supplemental_paths field on SourceBinding, validation in createSourceBinding.</item>
</CHANGE_SUMMARY>
*/
import { computeBindingDigest } from "../hash.ts";

export interface SupplementalPath {
  name: string;
  path: string;
  glob: string;
  fingerprint: {
    algorithm: string;
    value: string;
  };
}

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
  supplemental_paths?: SupplementalPath[];
  vcs: {
    repository: string | null;
    commit: string | null;
    clean: boolean | null;
    default_branch: string | null;
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
  payloadPath = "source",
  supplementalPaths?: SupplementalPath[],
): SourceBinding {
  if (supplementalPaths && supplementalPaths.length > 0) {
    const seenNames = new Set<string>();
    for (const sp of supplementalPaths) {
      if (seenNames.has(sp.name)) {
        throw new Error(`Duplicate supplemental path name: '${sp.name}' — names must be unique within a binding`);
      }
      seenNames.add(sp.name);
    }
  }

  const supplementalFingerprints = supplementalPaths?.map((sp) => sp.fingerprint.value) ?? [];

  const bindingDigest = computeBindingDigest(
    fingerprintValue,
    declaredVersion,
    sourceId,
    supplementalFingerprints.length > 0 ? supplementalFingerprints : undefined,
  );

  return {
    source_id: sourceId,
    source_unit_path: sourceUnitPath,
    declared_version: declaredVersion,
    version_scheme: versionScheme,
    metadata_origin: metadataOrigin,
    payload_path: payloadPath,
    fingerprint: {
      algorithm: "sha256-tree-v1",
      value: fingerprintValue,
    },
    ...(supplementalPaths && supplementalPaths.length > 0 ? { supplemental_paths: supplementalPaths } : {}),
    vcs,
    binding_digest: bindingDigest,
  };
}
