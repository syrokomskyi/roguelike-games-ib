import { describe } from "vitest";
import { resolve, join } from "node:path";
import { mkdirSync } from "node:fs";
import { createNetHackExtractor } from "@roguelike-games-ib/nethack-extractor";
import {
  ReadonlySourceReader,
  EvidenceFactory,
  CandidateWriter,
  createNullSchemaFacade,
  createExtractorContext,
  RefreshIdentityResolver,
} from "@roguelike-games-ib/extractor-sdk";
import {
  createSourceBinding,
  computeSourceFingerprint,
} from "@roguelike-games-ib/knowledge-core";
import { runQualityChecks } from "./harness.ts";

const WORKSPACE = resolve(__dirname, "../..");
const SOURCE_ROOT = resolve(WORKSPACE, "../roguelike-games-ib-source/NetHack/include");
const STAGING_DIR = join(WORKSPACE, "staging", "quality-nethack");

mkdirSync(STAGING_DIR, { recursive: true });

const binding = createSourceBinding(
  "nethack",
  "NetHack",
  "5.0.0",
  "semver",
  "package_json",
  computeSourceFingerprint(SOURCE_ROOT),
  { repository: "https://github.com/NetHack/NetHack", commit: null, clean: null },
);

const extractor = createNetHackExtractor();

function createContext() {
  const source = new ReadonlySourceReader(SOURCE_ROOT);
  const evidence = new EvidenceFactory("nethack", binding.binding_digest, SOURCE_ROOT);
  const ids = new RefreshIdentityResolver([], [], "nethack");
  const schemas = createNullSchemaFacade();
  const output = new CandidateWriter(
    STAGING_DIR,
    "run-" + Math.random().toString(36).slice(2),
    "nethack",
    "nethack-factual",
    "1.0.0",
  );
  return createExtractorContext(source, binding, schemas, evidence, ids, output);
}

describe("nethack extractor quality", () => {
  runQualityChecks(extractor, createContext, {
    sourceId: "nethack",
    sourceRoot: SOURCE_ROOT,
    timeBudgetMs: 10000,
  });
});
