/*
<MODULE_CONTRACT>
<purpose>Creates and validates evidence anchors linking claims to source artifacts with hashes, locators, and publication policies. Supports supplemental roots for artifacts outside payload root.</purpose>
<non-goals>
  <item>Does not re-anchor evidence after refresh — use reanchor module.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: EvidenceAnchor type, createEvidenceAnchor, validateEvidenceAnchor.</item>
  <item>RFC-0008: Extended validateEvidenceAnchor with optional supplementalRoots for prefixed artifact paths.</item>
</CHANGE_SUMMARY>
*/
import { sha256, sha256File, computeFragmentHash } from "../hash.ts";
import { EvidenceError } from "../errors.ts";
import { existsSync } from "node:fs";
import { resolve, relative, isAbsolute } from "node:path";

export interface SupplementalRootEntry {
  name: string;
  root: string;
}

export interface MediaQuery {
  mime_type: string;
  width: number | null;
  height: number | null;
  alt_text: string | null;
}

export interface EvidenceAnchor {
  source_id: string;
  source_binding_digest: string;
  evidence_kind: string;
  artifact: {
    path: string;
    sha256: string;
  };
  media: MediaQuery | null;
  locator: {
    symbol: string | null;
    line_start: number | null;
    line_end: number | null;
    byte_start: number | null;
    byte_end: number | null;
    data_key: string | null;
  };
  fragment_hash: string | null;
  publication: {
    access: "public" | "restricted" | "private";
    expose_locator: boolean;
    excerpt_policy: "none" | "short" | "source_policy";
    license_ref: string | null;
  };
}

/**
 * Create an evidence anchor from source data.
 */
export function createEvidenceAnchor(
  sourceId: string,
  sourceBindingDigest: string,
  artifactPath: string,
  artifactSha256: string,
  locator: EvidenceAnchor["locator"],
  publication: EvidenceAnchor["publication"],
  fragmentHash?: string | null,
  evidenceKind?: string,
  media?: MediaQuery | null,
): EvidenceAnchor {
  return {
    source_id: sourceId,
    source_binding_digest: sourceBindingDigest,
    evidence_kind: evidenceKind ?? "source_code",
    artifact: {
      path: artifactPath,
      sha256: artifactSha256,
    },
    media: media ?? null,
    locator,
    fragment_hash: fragmentHash ?? null,
    publication,
  };
}

/**
 * Validate an evidence anchor against actual source files.
 * If supplementalRoots is provided, artifact paths with a matching prefix
 * (e.g. "headers/spl-data.h") are resolved against the corresponding root.
 */
export function validateEvidenceAnchor(
  anchor: EvidenceAnchor,
  sourceRoot: string,
  supplementalRoots?: SupplementalRootEntry[],
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check artifact path is within source root
  if (isAbsolute(anchor.artifact.path) || anchor.artifact.path.includes("..")) {
    errors.push(`Artifact path '${anchor.artifact.path}' is not relative`);
  }

  // Determine which root to resolve against
  let resolveRoot = sourceRoot;
  let artifactSubPath = anchor.artifact.path;

  if (supplementalRoots && supplementalRoots.length > 0) {
    const slashIdx = anchor.artifact.path.indexOf("/");
    if (slashIdx !== -1) {
      const prefix = anchor.artifact.path.slice(0, slashIdx);
      const sr = supplementalRoots.find((s) => s.name === prefix);
      if (sr) {
        resolveRoot = sr.root;
        artifactSubPath = anchor.artifact.path.slice(slashIdx + 1);
      }
    }
  }

  // Check artifact exists and hash matches
  const artifactPath = resolve(resolveRoot, artifactSubPath);
  const rel = relative(resolveRoot, artifactPath);
  if (rel.startsWith("..") || isAbsolute(rel)) {
    errors.push(`Artifact path escapes source root: '${anchor.artifact.path}'`);
  } else if (existsSync(artifactPath)) {
    const actualHash = sha256File(artifactPath);
    if (actualHash !== anchor.artifact.sha256) {
      errors.push(
        `Artifact hash mismatch: expected ${anchor.artifact.sha256}, got ${actualHash}`,
      );
    }
  } else {
    errors.push(`Artifact not found: ${anchor.artifact.path}`);
  }

  // Validate binding digest format
  if (!/^[a-f0-9]{64}$/.test(anchor.source_binding_digest)) {
    errors.push(`Invalid binding_digest format: ${anchor.source_binding_digest}`);
  }

  // Validate fragment hash format if present
  if (anchor.fragment_hash !== null && !/^[a-f0-9]{64}$/.test(anchor.fragment_hash)) {
    errors.push(`Invalid fragment_hash format: ${anchor.fragment_hash}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
