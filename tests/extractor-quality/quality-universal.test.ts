import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  ReadonlySourceReader,
  EvidenceFactory,
  CandidateWriter,
  RefreshIdentityResolver,
  createNullSchemaFacade,
  createExtractorContext,
  type Extractor,
  type ExtractorContext,
  type ExtractorRunResult,
} from "@roguelike-games-ib/extractor-sdk";
import { createSourceBinding, readKeyRegistry, readAliasRegistry } from "@roguelike-games-ib/knowledge-core";
import { createTestWorkspace, cleanupTempWorkspace } from "@roguelike-games-ib/test-fixtures";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { runQualityChecks } from "./harness.ts";

const syntheticManifest = {
  schema: "werkstatt/knowledge-extractor@1" as const,
  extractorId: "synthetic-quality-test",
  extractorVersion: "1.0.0",
  sourceKinds: ["synthetic"],
  recordKinds: ["creature"],
  deterministic: true as const,
  parserMode: "static" as const,
  exhaustivePopulations: [
    { dimension: "creatures", denominatorKind: "extractor_population" as const, expected: 3, description: "All creatures in data file" },
  ],
};

function createSyntheticExtractor(): Extractor {
  return {
    manifest: syntheticManifest,
    async run(ctx: ExtractorContext): Promise<ExtractorRunResult> {
      const data = ctx.source.parseJson("creatures.json") as Array<{ id: string; name: string; hp: number }>;
      const sorted = [...data].sort((a, b) => a.id.localeCompare(b.id));

      let count = 0;
      for (const item of sorted) {
        const resolved = ctx.ids.resolveOrCreate("creature", item.id, item.id);
        const record = {
          id: resolved.id,
          key: resolved.key,
          record_type: "creature",
          schema: "rgkb/game-definition@2",
          name: { canonical: item.name, original: item.name },
          kind: "creature",
          source_identity: {
            source_id: ctx.binding.source_id,
            native_id: item.id,
            path: "creatures.json",
          },
          language: "en",
          scope: { source_id: ctx.binding.source_id, scope_kind: "source" as const },
          origin: { kind: "extractor" as const, actor_id: "synthetic-quality-test", run_id: null },
          epistemic: { status: "observed" as const, confidence: "verified" as const },
          aliases: [] as string[],
          activation: "active" as const,
          attributes: { hp: item.hp },
          evidence_refs: [] as string[],
        };
        ctx.output.writeRecord(record);

        const evidence = ctx.evidence.create({
          artifactPath: "creatures.json",
          locator: {
            symbol: null,
            line_start: null,
            line_end: null,
            byte_start: null,
            byte_end: null,
            data_key: item.id,
          },
        });
        ctx.output.writeEvidence(resolved.id, evidence);
        count++;
      }

      ctx.output.writePopulation("creatures", 3, count);

      return {
        extractorId: "synthetic-quality-test",
        extractorVersion: "1.0.0",
        runId: "quality-test",
        recordCount: count,
        populationCounts: [{ dimension: "creatures", expected: 3, extracted: count }],
        diagnostics: [],
      };
    },
  };
}

describe("harness validation with synthetic extractor", () => {
  let workspace!: string;
  let sourceRoot!: string;
  let stagingDir!: string;

  beforeEach(() => {
    workspace = createTestWorkspace({
      kbId: "quality-harness-test",
      sourceFiles: [
        {
          path: "creatures.json",
          content: JSON.stringify([
            { id: "goblin", name: "Goblin", hp: 3 },
            { id: "kobold", name: "Kobold", hp: 2 },
            { id: "ogre", name: "Ogre", hp: 8 },
          ]),
        },
      ],
    });
    const parentDir = join(workspace, "..");
    sourceRoot = join(parentDir, "quality-harness-test-source", "source");
    stagingDir = join(workspace, "staging");
    mkdirSync(stagingDir, { recursive: true });
  });

  afterEach(() => {
    cleanupTempWorkspace(workspace);
  });

  const extractor = createSyntheticExtractor();

  function createContext(): ExtractorContext {
    const binding = createSourceBinding(
      "quality-harness-test",
      sourceRoot,
      "1.0.0",
      "semver",
      "readme",
      "fakefingerprint",
      null,
    );
    const keysPath = join(workspace, "knowledge", "identity", "keys.jsonl");
    const aliasesPath = join(workspace, "knowledge", "identity", "aliases.jsonl");

    const source = new ReadonlySourceReader(sourceRoot);
    const evidence = new EvidenceFactory("quality-harness-test", binding.binding_digest, sourceRoot);
    const ids = new RefreshIdentityResolver(readKeyRegistry(keysPath), readAliasRegistry(aliasesPath), "quality-harness-test");
    const schemas = createNullSchemaFacade();
    const runId = `quality-run-${Date.now()}-${Math.random()}`;
    const output = new CandidateWriter(stagingDir, runId, "quality-harness-test", "synthetic-quality-test", "1.0.0");
    return createExtractorContext(source, binding, schemas, evidence, ids, output);
  }

  runQualityChecks(extractor, createContext, {
    sourceId: "quality-harness-test",
    sourceRoot,
    timeBudgetMs: 5000,
  });
});
