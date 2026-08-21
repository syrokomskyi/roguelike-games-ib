import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  createEvidenceAnchor,
  computeFragmentHash,
  sha256File,
  defaultPublicPolicy,
  defaultPrivatePolicy,
  type EvidenceAnchor,
  type PublicationPolicy,
} from "@roguelike-games-ib/knowledge-core";

export interface EvidenceBuildOptions {
  artifactPath: string;
  locator: EvidenceAnchor["locator"];
  publication?: Partial<PublicationPolicy>;
  fragmentLines?: { lineStart: number; lineEnd: number };
}

export class EvidenceFactory {
  constructor(
    private readonly sourceId: string,
    private readonly bindingDigest: string,
    private readonly sourceRoot: string,
  ) {}

  create(opts: EvidenceBuildOptions): EvidenceAnchor {
    const fullPath = resolve(this.sourceRoot, opts.artifactPath);
    const artifactSha = sha256File(fullPath);

    let fragmentHash: string | null = null;
    if (opts.fragmentLines) {
      const content = readFileSync(fullPath, "utf-8");
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
    );
  }

  createPrivate(opts: EvidenceBuildOptions): EvidenceAnchor {
    return this.create({
      ...opts,
      publication: defaultPrivatePolicy(),
    });
  }
}
