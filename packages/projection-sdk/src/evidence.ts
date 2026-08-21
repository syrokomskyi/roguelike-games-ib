import { readJsonlFile } from "@roguelike-games-ib/materializer";
import { join } from "node:path";
import type { PublicEvidence } from "@roguelike-games-ib/materializer";
import type { SourceBinding } from "@roguelike-games-ib/knowledge-core";

export function readPublicEvidence(distDir: string): PublicEvidence[] {
  return readJsonlFile(join(distDir, "evidence.public.jsonl")) as unknown as PublicEvidence[];
}

export function evidenceForClaim(evidence: PublicEvidence[], evidenceRefs: string[]): PublicEvidence[] {
  const refSet = new Set(evidenceRefs);
  return evidence.filter((e) => refSet.has(e.id));
}

export function isRestricted(evidence: PublicEvidence): boolean {
  return evidence.publication_access !== "public";
}

export function buildEvidenceUrl(
  evidence: PublicEvidence,
  sources: SourceBinding[],
): string | null {
  const source = sources.find((s) => s.source_id === evidence.source_id);
  if (!source?.vcs?.repository) return null;

  const repo = source.vcs.repository.replace(/\/+$/, "");
  const ref = source.vcs.commit ?? "HEAD";
  const path = evidence.artifact_path;
  if (!path) return null;

  let url = `${repo}/blob/${ref}/${path}`;

  const loc = evidence.locator;
  if (loc?.line_start != null) {
    if (loc.line_end != null && loc.line_end !== loc.line_start) {
      url += `#L${loc.line_start}-L${loc.line_end}`;
    } else {
      url += `#L${loc.line_start}`;
    }
  }

  return url;
}
