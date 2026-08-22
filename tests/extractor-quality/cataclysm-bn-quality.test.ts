import { describe } from "vitest";
import { resolve, join } from "node:path";
import { mkdirSync } from "node:fs";
import { createCataclysmBNExtractor } from "@roguelike-games-ib/cataclysm-bn-extractor";
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
const SOURCE_ROOT = resolve(WORKSPACE, "../roguelike-games-ib-source/Cataclysm-BN/data/json");
const STAGING_DIR = join(WORKSPACE, "staging", "quality-cataclysm-bn");

mkdirSync(STAGING_DIR, { recursive: true });

const binding = createSourceBinding(
  "cataclysm-bn",
  "Cataclysm-BN",
  "0.7.1",
  "semver",
  "package_json",
  computeSourceFingerprint(SOURCE_ROOT),
  { repository: "https://github.com/cataclysmbnteam/Cataclysm-BN", commit: null, clean: null, default_branch: "main" },
  "data/json",
);

const extractor = createCataclysmBNExtractor();

function createContext() {
  const source = new ReadonlySourceReader(SOURCE_ROOT);
  const evidence = new EvidenceFactory("cataclysm-bn", binding.binding_digest, source);
  const ids = new RefreshIdentityResolver([], [], "cataclysm-bn");
  const schemas = createNullSchemaFacade();
  const output = new CandidateWriter(
    STAGING_DIR,
    "run-" + Math.random().toString(36).slice(2),
    "cataclysm-bn",
    "cataclysm-bn-factual",
    "1.0.0",
  );
  return createExtractorContext(source, binding, schemas, evidence, ids, output);
}

describe("cataclysm-bn extractor quality", () => {
  runQualityChecks(extractor, createContext, {
    sourceId: "cataclysm-bn",
    sourceRoot: () => SOURCE_ROOT,
    timeBudgetMs: 30000,
  });
});
