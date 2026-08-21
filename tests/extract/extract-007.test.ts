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
import { mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

describe("EXT-007: extractor output goes to staging only", () => {
  let workspace: string;
  let sourceRoot: string;
  let stagingDir: string;
  let canonicalDir: string;

  beforeEach(() => {
    workspace = createTestWorkspace({
      kbId: "ext007-test",
      sourceFiles: [
        { path: "data.json", content: JSON.stringify([{ id: "a", name: "Alpha" }]) },
      ],
    });
    const parentDir = join(workspace, "..");
    sourceRoot = join(parentDir, "ext007-test-source", "source");
    stagingDir = join(workspace, "staging");
    canonicalDir = join(workspace, "knowledge", "games");
    mkdirSync(stagingDir, { recursive: true });
  });

  afterEach(() => {
    cleanupTempWorkspace(workspace);
  });

  it("writes output under staging directory, not canonical", async () => {
    const extractor: Extractor = {
      manifest: {
        schema: "werkstatt/knowledge-extractor@1",
        extractorId: "staging-test",
        extractorVersion: "1.0.0",
        sourceKinds: ["synthetic"],
        recordKinds: ["creature"],
        deterministic: true,
        parserMode: "static",
      },
      async run(ctx: ExtractorContext): Promise<ExtractorRunResult> {
        const data = ctx.source.parseJson("data.json") as Array<{ id: string; name: string }>;
        for (const item of data) {
          const resolved = ctx.ids.resolveOrCreate("creature", item.id, item.id);
          ctx.output.writeRecord({
            id: resolved.id,
            key: resolved.key,
            record_type: "creature",
            name: item.name,
          });
        }
        ctx.output.writePopulation("creatures", 1, 1);
        return {
          extractorId: "staging-test",
          extractorVersion: "1.0.0",
          runId: "staging-run",
          recordCount: 1,
          populationCounts: [{ dimension: "creatures", expected: 1, extracted: 1 }],
          diagnostics: [],
        };
      },
    };

    const binding = createSourceBinding("ext007-test", sourceRoot, "1.0.0", "semver", "readme", "fakefp", null);
    const keysPath = join(workspace, "knowledge", "identity", "keys.jsonl");
    const aliasesPath = join(workspace, "knowledge", "identity", "aliases.jsonl");

    const source = new ReadonlySourceReader(sourceRoot);
    const evidence = new EvidenceFactory("ext007-test", binding.binding_digest, sourceRoot);
    const ids = new RefreshIdentityResolver(readKeyRegistry(keysPath), readAliasRegistry(aliasesPath), "ext007-test");
    const schemas = createNullSchemaFacade();
    const runId = "staging-run-001";
    const output = new CandidateWriter(stagingDir, runId, "ext007-test", "staging-test", "1.0.0");
    const ctx = createExtractorContext(source, binding, schemas, evidence, ids, output);

    await extractor.run(ctx);
    const outputDir = output.flush();

    // Output is under staging/
    expect(outputDir.startsWith(stagingDir)).toBe(true);
    expect(existsSync(join(outputDir, "batch.jsonl"))).toBe(true);
    expect(existsSync(join(outputDir, "batch-manifest.json"))).toBe(true);

    // No files written to canonical directory
    expect(existsSync(join(canonicalDir, "records.jsonl"))).toBe(false);
    expect(existsSync(join(canonicalDir, "batch.jsonl"))).toBe(false);
  });
});
