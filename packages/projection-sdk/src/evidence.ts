import { readJsonlFile } from "@roguelike-games-ib/materializer";
import { join } from "node:path";
import type { PublicEvidence } from "@roguelike-games-ib/materializer";

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
