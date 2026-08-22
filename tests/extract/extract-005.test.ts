import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  ReadonlySourceReader,
  EvidenceFactory,
  CandidateWriter,
  RefreshIdentityResolver,
  createSchemaFacade,
  createNullSchemaFacade,
  createExtractorContext,
  runExtractorDeterministic,
  hashRunResult,
  type Extractor,
  type ExtractorContext,
  type ExtractorRunResult,
  type ExtractorManifest,
} from "@roguelike-games-ib/extractor-sdk";
import {
  createSourceBinding,
  readKeyRegistry,
  readAliasRegistry,
  canonicalJsonStringify,
} from "@roguelike-games-ib/knowledge-core";
import { createTestWorkspace, cleanupTempWorkspace } from "@roguelike-games-ib/test-fixtures";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const syntheticManifest: ExtractorManifest = {
  schema: "werkstatt/knowledge-extractor@1",
  extractorId: "synthetic-all-model",
  extractorVersion: "1.0.0",
  sourceKinds: ["synthetic"],
  recordKinds: ["creature"],
  deterministic: true,
  parserMode: "static",
  exhaustivePopulations: [
    { dimension: "creatures", denominatorKind: "extractor_population", expected: 2, description: "All creatures in data file" },
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
          name: item.name,
          hp: item.hp,
          source_identity: {
            source_id: ctx.binding.source_id,
            native_id: item.id,
            path: "creatures.json",
          },
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

      ctx.output.writePopulation("creatures", 2, count);

      return {
        extractorId: ctx.binding.source_id,
        extractorVersion: "1.0.0",
        runId: "test-run",
        recordCount: count,
        populationCounts: [{ dimension: "creatures", expected: 2, extracted: count }],
        diagnostics: [],
      };
    },
  };
}

describe("EXT-005: extractor run twice gives same normalized hash", () => {
  let workspace: string;
  let sourceRoot: string;
  let stagingDir: string;

  beforeEach(() => {
    workspace = createTestWorkspace({
      kbId: "ext005-test",
      sourceFiles: [
        {
          path: "creatures.json",
          content: JSON.stringify([
            { id: "goblin", name: "Goblin", hp: 3 },
            { id: "kobold", name: "Kobold", hp: 2 },
          ]),
        },
      ],
    });
    const parentDir = join(workspace, "..");
    sourceRoot = join(parentDir, "ext005-test-source", "source");
    stagingDir = join(workspace, "staging");
    mkdirSync(stagingDir, { recursive: true });
  });

  afterEach(() => {
    cleanupTempWorkspace(workspace);
  });

  it("produces identical hashes on two runs", async () => {
    const extractor = createSyntheticExtractor();
    const binding = createSourceBinding(
      "ext005-test",
      sourceRoot,
      "1.0.0",
      "semver",
      "readme",
      "fakefingerprint",
      null,
    );

    const keysPath = join(workspace, "knowledge", "identity", "keys.jsonl");
    const aliasesPath = join(workspace, "knowledge", "identity", "aliases.jsonl");

    const result = await runExtractorDeterministic(extractor, () => {
      const source = new ReadonlySourceReader(sourceRoot);
      const evidence = new EvidenceFactory("ext005-test", binding.binding_digest, source);
      const keys = readKeyRegistry(keysPath);
      const aliases = readAliasRegistry(aliasesPath);
      const ids = new RefreshIdentityResolver(keys, aliases, "ext005-test");
      const schemas = createNullSchemaFacade();
      const output = new CandidateWriter(stagingDir, `run-${Date.now()}-${Math.random()}`, "ext005-test", "synthetic-all-model", "1.0.0");
      return createExtractorContext(source, binding, schemas, evidence, ids, output);
    });

    expect(result.deterministic).toBe(true);
    expect(result.hash1).toBe(result.hash2);
  });

  it("hash is stable regardless of run ID or timestamp", async () => {
    const extractor = createSyntheticExtractor();
    const binding = createSourceBinding(
      "ext005-test",
      sourceRoot,
      "1.0.0",
      "semver",
      "readme",
      "fakefingerprint",
      null,
    );

    const keysPath = join(workspace, "knowledge", "identity", "keys.jsonl");
    const aliasesPath = join(workspace, "knowledge", "identity", "aliases.jsonl");

    // Run 1
    const ctx1 = (() => {
      const source = new ReadonlySourceReader(sourceRoot);
      const evidence = new EvidenceFactory("ext005-test", binding.binding_digest, source);
      const keys = readKeyRegistry(keysPath);
      const aliases = readAliasRegistry(aliasesPath);
      const ids = new RefreshIdentityResolver(keys, aliases, "ext005-test");
      const schemas = createNullSchemaFacade();
      const output = new CandidateWriter(stagingDir, "run-A", "ext005-test", "synthetic-all-model", "1.0.0");
      return createExtractorContext(source, binding, schemas, evidence, ids, output);
    })();

    const run1 = await extractor.run(ctx1);
    const hash1 = hashRunResult(run1);

    // Run 2 with different run ID
    const ctx2 = (() => {
      const source = new ReadonlySourceReader(sourceRoot);
      const evidence = new EvidenceFactory("ext005-test", binding.binding_digest, source);
      const keys = readKeyRegistry(keysPath);
      const aliases = readAliasRegistry(aliasesPath);
      const ids = new RefreshIdentityResolver(keys, aliases, "ext005-test");
      const schemas = createNullSchemaFacade();
      const output = new CandidateWriter(stagingDir, "run-B", "ext005-test", "synthetic-all-model", "1.0.0");
      return createExtractorContext(source, binding, schemas, evidence, ids, output);
    })();

    const run2 = await extractor.run(ctx2);
    const hash2 = hashRunResult(run2);

    expect(hash1).toBe(hash2);
  });
});
