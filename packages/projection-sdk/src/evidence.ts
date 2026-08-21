/*
<MODULE_CONTRACT>
<purpose>Reads public evidence from materialized output, filters evidence by claim references, and builds GitHub URLs for evidence artifacts.</purpose>
<non-goals>
  <item>Does not redact evidence — reading and URL building only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: readPublicEvidence, evidenceForClaim, isRestricted, buildEvidenceUrl.</item>
</CHANGE_SUMMARY>
*/
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
  const ref = source.vcs.commit ?? source.vcs.default_branch ?? "HEAD";
  const artifactPath = evidence.artifact_path;
  if (!artifactPath) return null;

  const fullPath = source.payload_path && source.payload_path !== "source"
    ? `${source.payload_path}/${artifactPath}`
    : artifactPath;

  let url = `${repo}/blob/${ref}/${fullPath}`;

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
