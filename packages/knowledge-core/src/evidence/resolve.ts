import { sha256, sha256File, computeFragmentHash } from "../hash.ts";
import { EvidenceError } from "../errors.ts";
import { existsSync } from "node:fs";
import { resolve, relative, isAbsolute } from "node:path";

export interface EvidenceAnchor {
  source_id: string;
  source_binding_digest: string;
  artifact: {
    path: string;
    sha256: string;
  };
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
): EvidenceAnchor {
  return {
    source_id: sourceId,
    source_binding_digest: sourceBindingDigest,
    artifact: {
      path: artifactPath,
      sha256: artifactSha256,
    },
    locator,
    fragment_hash: fragmentHash ?? null,
    publication,
  };
}

/**
 * Validate an evidence anchor against actual source files.
 */
export function validateEvidenceAnchor(
  anchor: EvidenceAnchor,
  sourceRoot: string,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check artifact path is within source root
  if (isAbsolute(anchor.artifact.path) || anchor.artifact.path.includes("..")) {
    errors.push(`Artifact path '${anchor.artifact.path}' is not relative`);
  }

  // Check artifact exists and hash matches
  const artifactPath = resolve(sourceRoot, anchor.artifact.path);
  const rel = relative(sourceRoot, artifactPath);
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
