import { computeSourceFingerprint, computeSupplementalFingerprint, computeBindingDigest } from "@roguelike-games-ib/knowledge-core";

const sourceRoot = "/home/syrokomskyi/projects/roguelike-games-ib-source/crawl/crawl-ref/source/dat";
const headersRoot = "/home/syrokomskyi/projects/roguelike-games-ib-source/crawl/crawl-ref/source";

const fingerprint = computeSourceFingerprint(sourceRoot);
const supplementalFingerprint = computeSupplementalFingerprint(headersRoot, "*.h");
const bindingDigest = computeBindingDigest(fingerprint, "0.32.0", "crawl", [supplementalFingerprint]);

console.log("fingerprint:", fingerprint);
console.log("supplemental_fingerprint:", supplementalFingerprint);
console.log("binding_digest:", bindingDigest);
