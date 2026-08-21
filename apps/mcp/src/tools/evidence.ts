/*
<MODULE_CONTRACT>
<purpose>Returns evidence by id, enforcing publication policy — restricted evidence is redacted to metadata only.</purpose>
<non-goals>
  <item>Does not list or search evidence — single-id lookup only.</item>
  <item>Does not verify evidence artifact integrity — returns stored hashes as-is.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: get_evidence tool handler with publication-policy redaction.</item>
</CHANGE_SUMMARY>
*/
import type { McpContext } from "../context.ts";
import { envelope } from "../envelope.ts";
import { isRestricted, buildEvidenceUrl } from "@roguelike-games-ib/projection-sdk";
import { NotFoundError } from "../errors.ts";

export function getEvidence(
  ctx: McpContext,
  input: { evidence_id: string },
) {
  const evidence = ctx.store.evidence.find((e) => e.id === input.evidence_id);
  if (!evidence) {
    throw new NotFoundError(`Evidence not found: ${input.evidence_id}`);
  }

  if (isRestricted(evidence)) {
    return envelope(ctx, {
      evidence_id: evidence.id,
      source_id: evidence.source_id,
      restricted: true,
      message: "Evidence is not publicly accessible",
      artifact_path: null,
      artifact_sha256: null,
      locator: null,
      fragment_hash: null,
      excerpt: null,
      license_ref: null,
      github_url: null,
    });
  }

  return envelope(ctx, {
    evidence_id: evidence.id,
    source_id: evidence.source_id,
    restricted: false,
    message: null,
    artifact_path: evidence.artifact_path,
    artifact_sha256: evidence.artifact_sha256,
    locator: evidence.locator,
    fragment_hash: evidence.fragment_hash,
    excerpt: evidence.excerpt,
    license_ref: evidence.license_ref,
    github_url: buildEvidenceUrl(evidence, ctx.store.sources),
  });
}
