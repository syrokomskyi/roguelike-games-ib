import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  ReadonlySourceReader,
  EvidenceFactory,
  CandidateWriter,
  RefreshIdentityResolver,
  createNullSchemaFacade,
  ExtractorRunner,
  type Extractor,
  type ExtractorContext,
  type ExtractorRunResult,
  type ExtractorManifest,
} from "@roguelike-games-ib/extractor-sdk";
import { createSourceBinding } from "@roguelike-games-ib/knowledge-core";
import { createTempWorkspace, cleanupTempWorkspace } from "@roguelike-games-ib/test-fixtures";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const manifest: ExtractorManifest = {
  schema: "werkstatt/knowledge-extractor@1",
  extractorId: "runner-test",
  extractorVersion: "1.0.0",
  sourceKinds: ["synthetic"],
  recordKinds: ["creature"],
  deterministic: true,
  parserMode: "static",
  exhaustivePopulations: [
    { dimension: "creatures", denominatorKind: "extractor_population", expected: 2, description: "test creatures" },
  ],
};

function createExtractor(): Extractor {
  return {
    manifest,
    async run(ctx: ExtractorContext): Promise<ExtractorRunResult> {
      const content = ctx.source.readText("data.txt");
      const lines = content.split("\n").filter((l) => l.trim().length > 0);
      const ids = new RefreshIdentityResolver([], [], "runner-test");

      for (const line of lines) {
        const [name, nativeId] = line.split("|");
        const resolved = ids.resolveOrCreate("creature" as never, name.trim(), nativeId.trim());
        ctx.output.writeRecord({
          id: resolved.id,
          key: resolved.key,
          schema: "test/creature@1",
          record_type: "factual",
          language: "en",
          scope: "test",
          origin_actor_id: "runner-test",
          epistemic_status: "observed",
          aliases: [],
          kind: "creature",
          native_kind: "test",
          name: { canonical: name.trim(), original: name.trim() },
          source_identity: {
            source_id: ctx.binding.source_id,
            native_id: nativeId.trim(),
            path: "data.txt",
          },
          activation: "active",
          attributes: {},
          evidence_refs: [],
        });
        const evidence = ctx.evidence.create({
          artifactPath: "data.txt",
          locator: {
            symbol: name.trim(),
            line_start: 1,
            line_end: 1,
            byte_start: null,
            byte_end: null,
            data_key: nativeId.trim(),
          },
          fragmentLines: { lineStart: 1, lineEnd: 1 },
        });
        ctx.output.writeEvidence(resolved.id, evidence);
      }

      const recordCount = lines.length;
      ctx.output.writePopulation("creatures", 2, recordCount);

      return {
        extractorId: manifest.extractorId,
        extractorVersion: "1.0.0",
        runId: "runner-test",
        recordCount,
        populationCounts: [{ dimension: "creatures", expected: 2, extracted: recordCount }],
        diagnostics: [],
      };
    },
  };
}

describe("ExtractorRunner", () => {
  let workspace: string;
  let sourceRoot: string;
  let stagingDir: string;

  beforeEach(() => {
    workspace = createTempWorkspace();
    sourceRoot = join(workspace, "source");
    stagingDir = join(workspace, "staging");
    mkdirSync(sourceRoot, { recursive: true });
    mkdirSync(stagingDir, { recursive: true });
    writeFileSync(
      join(sourceRoot, "data.txt"),
      "Goblin|goblin_1\nOrc|orc_1\n",
    );
  });

  afterEach(() => {
    cleanupTempWorkspace(workspace);
  });

  it("runDeterministic produces identical hashes across two runs", async () => {
    const binding = createSourceBinding("runner-test", sourceRoot, "1.0.0", "semver", "readme", "fakefp", null);
    const extractor = createExtractor();
    const runner = new ExtractorRunner(extractor);

    const createOpts = () => {
      const source = new ReadonlySourceReader(sourceRoot);
      const evidence = new EvidenceFactory("runner-test", binding.binding_digest, source);
      const ids = new RefreshIdentityResolver([], [], "runner-test");
      const schemas = createNullSchemaFacade();
      const output = new CandidateWriter(stagingDir, `run-${Math.random()}`, "runner-test", "runner-test", "1.0.0");
      return { source, binding, schemas, evidence, ids, output };
    };

    const result = await runner.runDeterministic(createOpts);

    expect(result.deterministic).toBe(true);
    expect(result.hash1).toBe(result.hash2);
    expect(result.run1.recordCount).toBe(2);
    expect(result.run2.recordCount).toBe(2);
  });

  it("createContext assembles a valid ExtractorContext", async () => {
    const binding = createSourceBinding("runner-test", sourceRoot, "1.0.0", "semver", "readme", "fakefp", null);
    const extractor = createExtractor();
    const runner = new ExtractorRunner(extractor);

    const source = new ReadonlySourceReader(sourceRoot);
    const evidence = new EvidenceFactory("runner-test", binding.binding_digest, source);
    const ids = new RefreshIdentityResolver([], [], "runner-test");
    const schemas = createNullSchemaFacade();
    const output = new CandidateWriter(stagingDir, "run-1", "runner-test", "runner-test", "1.0.0");

    const ctx = runner.createContext({ source, binding, schemas, evidence, ids, output });
    expect(ctx.source).toBe(source);
    expect(ctx.binding).toBe(binding);
    expect(ctx.evidence).toBe(evidence);
    expect(ctx.ids).toBe(ids);
    expect(ctx.output).toBe(output);
  });

  it("run executes the extractor and returns the result", async () => {
    const binding = createSourceBinding("runner-test", sourceRoot, "1.0.0", "semver", "readme", "fakefp", null);
    const extractor = createExtractor();
    const runner = new ExtractorRunner(extractor);

    const source = new ReadonlySourceReader(sourceRoot);
    const evidence = new EvidenceFactory("runner-test", binding.binding_digest, source);
    const ids = new RefreshIdentityResolver([], [], "runner-test");
    const schemas = createNullSchemaFacade();
    const output = new CandidateWriter(stagingDir, "run-1", "runner-test", "runner-test", "1.0.0");

    const ctx = runner.createContext({ source, binding, schemas, evidence, ids, output });
    const result = await runner.run(ctx);

    expect(result.extractorId).toBe("runner-test");
    expect(result.recordCount).toBe(2);
  });
});
