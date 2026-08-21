import { EvidenceAnchor } from "@roguelike-games-ib/knowledge-core";

/**
 * Redacted evidence anchor for public output.
 * Restricted/private evidence is excluded entirely.
 * Public evidence has locators and excerpts controlled by publication policy.
 */
export interface PublicEvidence {
  id: string;
  source_id: string;
  artifact_path: string;
  artifact_sha256: string;
  publication_access: string;
  locator: {
    symbol: string | null;
    line_start: number | null;
    line_end: number | null;
    byte_start: number | null;
    byte_end: number | null;
    data_key: string | null;
  } | null;
  fragment_hash: string | null;
  excerpt: string | null;
  license_ref: string | null;
}

/**
 * Filter and redact evidence for public output.
 * - Only public access evidence is included
 * - Locators are included only if expose_locator is true
 * - Excerpts follow excerpt_policy
 */
export function redactPublicEvidence(
  evidence: EvidenceAnchor[],
  options?: { excerptLimit?: number },
): PublicEvidence[] {
  const excerptLimit = options?.excerptLimit ?? 200;

  return evidence
    .filter((ev) => {
      const access = (ev as unknown as Record<string, unknown>)["publication"] as
        | Record<string, unknown>
        | undefined;
      return access?.["access"] === "public";
    })
    .map((ev) => {
      const pub = ev.publication;
      const evId = (ev as unknown as Record<string, unknown>)["id"] as string | undefined;

      const locator = pub.expose_locator
        ? { ...ev.locator }
        : null;

      let excerpt: string | null = null;
      if (pub.excerpt_policy === "short") {
        const text = (ev as unknown as Record<string, unknown>)["excerpt"] as string | undefined;
        if (text) {
          excerpt = text.slice(0, excerptLimit);
        }
      }

      return {
        id: evId ?? "",
        source_id: ev.source_id,
        artifact_path: ev.artifact.path,
        artifact_sha256: ev.artifact.sha256,
        publication_access: pub.access,
        locator,
        fragment_hash: ev.fragment_hash,
        excerpt,
        license_ref: pub.license_ref,
      };
    });
}

/**
 * Check if evidence is public.
 */
export function isPublicEvidence(ev: EvidenceAnchor): boolean {
  return ev.publication.access === "public";
}

/**
 * Check if evidence is restricted/private.
 */
export function isRestrictedEvidence(ev: EvidenceAnchor): boolean {
  return ev.publication.access === "restricted" || ev.publication.access === "private";
}
