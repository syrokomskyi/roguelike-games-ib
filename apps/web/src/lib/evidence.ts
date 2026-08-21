import type { PublicEvidence } from "@roguelike-games-ib/materializer";
import { isRestricted } from "@roguelike-games-ib/projection-sdk";

export const DEFAULT_EXCERPT_LIMIT = 200;

export interface RenderedEvidence {
  id: string;
  source_id: string;
  artifact_path: string | null;
  artifact_sha256: string | null;
  locator: PublicEvidence["locator"];
  fragment_hash: string | null;
  excerpt: string | null;
  license_ref: string | null;
  restricted: boolean;
}

export function renderEvidence(
  evidence: PublicEvidence[],
  excerptLimit: number = DEFAULT_EXCERPT_LIMIT,
): RenderedEvidence[] {
  return evidence.map((ev) => {
    if (isRestricted(ev)) {
      return {
        id: ev.id,
        source_id: ev.source_id,
        artifact_path: null,
        artifact_sha256: null,
        locator: null,
        fragment_hash: null,
        excerpt: null,
        license_ref: null,
        restricted: true,
      };
    }

    const excerpt = ev.excerpt
      ? ev.excerpt.slice(0, excerptLimit)
      : null;

    return {
      id: ev.id,
      source_id: ev.source_id,
      artifact_path: ev.artifact_path,
      artifact_sha256: ev.artifact_sha256,
      locator: ev.locator,
      fragment_hash: ev.fragment_hash,
      excerpt,
      license_ref: ev.license_ref,
      restricted: false,
    };
  });
}

export function evidenceForRecord(
  evidence: PublicEvidence[],
  evidenceRefs: string[],
  excerptLimit: number = DEFAULT_EXCERPT_LIMIT,
): RenderedEvidence[] {
  const refSet = new Set(evidenceRefs);
  const filtered = evidence.filter((e) => refSet.has(e.id));
  return renderEvidence(filtered, excerptLimit);
}
