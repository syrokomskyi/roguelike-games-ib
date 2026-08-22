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
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

describe("EXT-006: population denominator is recorded", () => {
  let workspace: string;
  let sourceRoot: string;
  let stagingDir: string;

  beforeEach(() => {
    workspace = createTestWorkspace({
      kbId: "ext006-test",
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
    sourceRoot = join(parentDir, "ext006-test-source", "source");
    stagingDir = join(workspace, "staging");
    mkdirSync(stagingDir, { recursive: true });
  });

  afterEach(() => {
    cleanupTempWorkspace(workspace);
  });

  it("records expected and extracted population counts", async () => {
    const extractor: Extractor = {
      manifest: {
        schema: "werkstatt/knowledge-extractor@1",
        extractorId: "synthetic-pop-test",
        extractorVersion: "1.0.0",
        sourceKinds: ["synthetic"],
        recordKinds: ["creature"],
        deterministic: true,
        parserMode: "static",
      },
      async run(ctx: ExtractorContext): Promise<ExtractorRunResult> {
        const data = ctx.source.parseJson("creatures.json") as Array<{ id: string; name: string }>;
        const count = data.length;

        for (const item of data) {
          const resolved = ctx.ids.resolveOrCreate("creature", item.id, item.id);
          ctx.output.writeRecord({
            id: resolved.id,
            key: resolved.key,
            record_type: "creature",
            name: item.name,
          });
        }

        ctx.output.writePopulation("creatures", 3, count);

        return {
          extractorId: "synthetic-pop-test",
          extractorVersion: "1.0.0",
          runId: "pop-test",
          recordCount: count,
          populationCounts: [{ dimension: "creatures", expected: 3, extracted: count }],
          diagnostics: [],
        };
      },
    };

    const binding = createSourceBinding("ext006-test", sourceRoot, "1.0.0", "semver", "readme", "fakefp", null);
    const keysPath = join(workspace, "knowledge", "identity", "keys.jsonl");
    const aliasesPath = join(workspace, "knowledge", "identity", "aliases.jsonl");

    const source = new ReadonlySourceReader(sourceRoot);
    const evidence = new EvidenceFactory("ext006-test", binding.binding_digest, source);
    const ids = new RefreshIdentityResolver(readKeyRegistry(keysPath), readAliasRegistry(aliasesPath), "ext006-test");
    const schemas = createNullSchemaFacade();
    const runId = "pop-test-run";
    const output = new CandidateWriter(stagingDir, runId, "ext006-test", "synthetic-pop-test", "1.0.0");
    const ctx = createExtractorContext(source, binding, schemas, evidence, ids, output);

    const result = await extractor.run(ctx);
    const outputDir = output.flush();

    expect(result.populationCounts).toHaveLength(1);
    expect(result.populationCounts[0].dimension).toBe("creatures");
    expect(result.populationCounts[0].expected).toBe(3);
    expect(result.populationCounts[0].extracted).toBe(3);

    const popContent = readFileSync(join(outputDir, "population.jsonl"), "utf-8");
    expect(popContent).toContain('"dimension":"creatures"');
    expect(popContent).toContain('"expected":3');
    expect(popContent).toContain('"extracted":3');
  });

  it("records mismatch when extracted < expected", async () => {
    const extractor: Extractor = {
      manifest: {
        schema: "werkstatt/knowledge-extractor@1",
        extractorId: "synthetic-pop-mismatch",
        extractorVersion: "1.0.0",
        sourceKinds: ["synthetic"],
        recordKinds: ["creature"],
        deterministic: true,
        parserMode: "static",
      },
      async run(ctx: ExtractorContext): Promise<ExtractorRunResult> {
        const data = ctx.source.parseJson("creatures.json") as Array<{ id: string }>;
        // Only extract 2 of 3
        const extracted = data.slice(0, 2);
        for (const item of extracted) {
          const resolved = ctx.ids.resolveOrCreate("creature", item.id, item.id);
          ctx.output.writeRecord({
            id: resolved.id,
            key: resolved.key,
            record_type: "creature",
          });
        }

        ctx.output.writePopulation("creatures", 3, 2);

        return {
          extractorId: "synthetic-pop-mismatch",
          extractorVersion: "1.0.0",
          runId: "mismatch-test",
          recordCount: 2,
          populationCounts: [{ dimension: "creatures", expected: 3, extracted: 2 }],
          diagnostics: [],
        };
      },
    };

    const binding = createSourceBinding("ext006-test", sourceRoot, "1.0.0", "semver", "readme", "fakefp", null);
    const keysPath = join(workspace, "knowledge", "identity", "keys.jsonl");
    const aliasesPath = join(workspace, "knowledge", "identity", "aliases.jsonl");

    const source = new ReadonlySourceReader(sourceRoot);
    const evidence = new EvidenceFactory("ext006-test", binding.binding_digest, source);
    const ids = new RefreshIdentityResolver(readKeyRegistry(keysPath), readAliasRegistry(aliasesPath), "ext006-test");
    const schemas = createNullSchemaFacade();
    const output = new CandidateWriter(stagingDir, "mismatch-run", "ext006-test", "synthetic-pop-mismatch", "1.0.0");
    const ctx = createExtractorContext(source, binding, schemas, evidence, ids, output);

    const result = await extractor.run(ctx);

    expect(result.populationCounts[0].expected).toBe(3);
    expect(result.populationCounts[0].extracted).toBe(2);
  });
});
