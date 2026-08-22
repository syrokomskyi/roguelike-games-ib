import { computeSourceFingerprint, computeBindingDigest } from "@roguelike-games-ib/knowledge-core";

const sourceRoot = "/home/syrokomskyi/projects/roguelike-games-ib-source/crawl/crawl-ref/source/dat";
const fingerprint = computeSourceFingerprint(sourceRoot);
const bindingDigest = computeBindingDigest(fingerprint, "0.32.0", "crawl");

console.log("fingerprint:", fingerprint);
console.log("binding_digest:", bindingDigest);
