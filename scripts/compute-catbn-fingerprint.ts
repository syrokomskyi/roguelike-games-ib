import { computeSourceFingerprint, computeBindingDigest, createSourceBinding } from "@roguelike-games-ib/knowledge-core";
import { resolve } from "node:path";

const sourceRoot = "/home/syrokomskyi/projects/roguelike-games-ib-source/Cataclysm-BN/data/json";
const fingerprint = computeSourceFingerprint(sourceRoot);
const bindingDigest = computeBindingDigest(fingerprint, "0.7.1", "cataclysm-bn");

console.log("fingerprint:", fingerprint);
console.log("binding_digest:", bindingDigest);
