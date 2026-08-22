/*
<MODULE_CONTRACT>
<purpose>Builds evidence anchors with artifact SHA-256, fragment hashes, and publication policy for extractor output.</purpose>
<non-goals>
  <item>Does not verify evidence content — computes hashes only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: EvidenceFactory with create and createPrivate methods.</item>
</CHANGE_SUMMARY>
*/
import { createHash } from "node:crypto";
import {
  createEvidenceAnchor,
  computeFragmentHash,
  defaultPublicPolicy,
  defaultPrivatePolicy,
  type EvidenceAnchor,
  type MediaQuery,
  type PublicationPolicy,
} from "@roguelike-games-ib/knowledge-core";
import type { ReadonlySourceReader } from "./source-reader.ts";

export interface EvidenceBuildOptions {
  artifactPath: string;
  locator: EvidenceAnchor["locator"];
  publication?: Partial<PublicationPolicy>;
  fragmentLines?: { lineStart: number; lineEnd: number };
  evidenceKind?: string;
  media?: MediaQuery | null;
}

export class EvidenceFactory {
  constructor(
    private readonly sourceId: string,
    private readonly bindingDigest: string,
    private readonly reader: ReadonlySourceReader,
  ) {}

  create(opts: EvidenceBuildOptions): EvidenceAnchor {
    const buf = this.reader.readBytes(opts.artifactPath);
    const artifactSha = createHash("sha256").update(buf).digest("hex");

    let fragmentHash: string | null = null;
    if (opts.fragmentLines) {
      const content = this.reader.readText(opts.artifactPath);
      fragmentHash = computeFragmentHash(
        content,
        opts.fragmentLines.lineStart,
        opts.fragmentLines.lineEnd,
      );
    }

    const policy = opts.publication
      ? { ...defaultPublicPolicy(), ...opts.publication }
      : defaultPublicPolicy();

    return createEvidenceAnchor(
      this.sourceId,
      this.bindingDigest,
      opts.artifactPath,
      artifactSha,
      opts.locator,
      policy,
      fragmentHash,
      opts.evidenceKind,
      opts.media,
    );
  }

  createPrivate(opts: EvidenceBuildOptions): EvidenceAnchor {
    return this.create({
      ...opts,
      publication: defaultPrivatePolicy(),
    });
  }
}
