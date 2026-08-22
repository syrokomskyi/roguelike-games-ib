/*
<MODULE_CONTRACT>
<purpose>Quality test for the Crawl extractor — runs the universal harness with sprite checks and coverage threshold.</purpose>
<non-goals>
  <item>Does not test semantic records — factual extraction only.</item>
</non-goals>
<CHANGE_SUMMARY>
  <item>Initial creation: quality test for Crawl extractor with sprite checks enabled.</item>
</CHANGE_SUMMARY>
*/
import { describe } from "vitest";
import { resolve, join } from "node:path";
import { mkdirSync } from "node:fs";
import { createCrawlExtractor } from "@roguelike-games-ib/crawl-extractor";
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
const SOURCE_ROOT = resolve(WORKSPACE, "../roguelike-games-ib-source/crawl/crawl-ref/source/dat");
const STAGING_DIR = join(WORKSPACE, "staging", "quality-crawl");

mkdirSync(STAGING_DIR, { recursive: true });

const binding = createSourceBinding(
  "crawl",
  "crawl",
  "0.32.0",
  "semver",
  "other",
  computeSourceFingerprint(SOURCE_ROOT),
  { repository: "https://github.com/crawl/crawl", commit: null, clean: null, default_branch: "master" },
  "crawl-ref/source/dat",
);

const extractor = createCrawlExtractor();

function createContext() {
  const source = new ReadonlySourceReader(SOURCE_ROOT);
  const evidence = new EvidenceFactory("crawl", binding.binding_digest, source);
  const ids = new RefreshIdentityResolver([], [], "crawl");
  const schemas = createNullSchemaFacade();
  const output = new CandidateWriter(
    STAGING_DIR,
    "run-" + Math.random().toString(36).slice(2),
    "crawl",
    "crawl-factual",
    "1.0.0",
  );
  return createExtractorContext(source, binding, schemas, evidence, ids, output);
}

describe("crawl extractor quality", () => {
  runQualityChecks(extractor, createContext, {
    sourceId: "crawl",
    sourceRoot: () => SOURCE_ROOT,
    workspaceRoot: () => WORKSPACE,
    timeBudgetMs: 30000,
    spriteChecks: true,
    spriteCoverageThreshold: 0.8,
  });
});
