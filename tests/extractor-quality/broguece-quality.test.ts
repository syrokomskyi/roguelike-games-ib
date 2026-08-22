import { describe } from "vitest";
import { resolve, join } from "node:path";
import { mkdirSync } from "node:fs";
import { createBrogueCEExtractor } from "@roguelike-games-ib/broguece-extractor";
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
const SOURCE_ROOT = resolve(WORKSPACE, "../roguelike-games-ib-source/BrogueCE");
const STAGING_DIR = join(WORKSPACE, "staging", "quality-broguece");

mkdirSync(STAGING_DIR, { recursive: true });

const binding = createSourceBinding(
  "broguece",
  "BrogueCE",
  "1.0.0",
  "semver",
  "package_json",
  computeSourceFingerprint(SOURCE_ROOT),
  { repository: "https://github.com/tmewett/BrogueCE", commit: null, clean: null, default_branch: "master" },
  "source",
);

const extractor = createBrogueCEExtractor();

function createContext() {
  const source = new ReadonlySourceReader(SOURCE_ROOT);
  const evidence = new EvidenceFactory("broguece", binding.binding_digest, source);
  const ids = new RefreshIdentityResolver([], [], "broguece");
  const schemas = createNullSchemaFacade();
  const output = new CandidateWriter(
    STAGING_DIR,
    "run-" + Math.random().toString(36).slice(2),
    "broguece",
    "broguece-factual",
    "1.0.0",
  );
  return createExtractorContext(source, binding, schemas, evidence, ids, output);
}

describe("broguece extractor quality", () => {
  runQualityChecks(extractor, createContext, {
    sourceId: "broguece",
    sourceRoot: () => SOURCE_ROOT,
    timeBudgetMs: 10000,
  });
});
