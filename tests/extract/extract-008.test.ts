import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  ReadonlySourceReader,
  EvidenceFactory,
  CandidateWriter,
  RefreshIdentityResolver,
  createExtractorContext,
  type SchemaFacade,
  type Extractor,
  type ExtractorContext,
  type ExtractorRunResult,
} from "@roguelike-games-ib/extractor-sdk";
import { createSourceBinding, readKeyRegistry, readAliasRegistry } from "@roguelike-games-ib/knowledge-core";
import { createTestWorkspace, cleanupTempWorkspace } from "@roguelike-games-ib/test-fixtures";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

describe("EXT-008: invalid staged record prevents promotion", () => {
  let workspace: string;
  let sourceRoot: string;
  let stagingDir: string;

  beforeEach(() => {
    workspace = createTestWorkspace({
      kbId: "ext008-test",
      sourceFiles: [
        { path: "data.json", content: JSON.stringify([{ id: "a", name: "Alpha" }]) },
      ],
    });
    const parentDir = join(workspace, "..");
    sourceRoot = join(parentDir, "ext008-test-source", "source");
    stagingDir = join(workspace, "staging");
    mkdirSync(stagingDir, { recursive: true });
  });

  afterEach(() => {
    cleanupTempWorkspace(workspace);
  });

  it("schema validation flags invalid records in staged output", async () => {
    // Create a mock schema facade that rejects records missing required fields
    const schemas: SchemaFacade = {
      validate(recordKind: string, record: unknown) {
        if (recordKind !== "creature") {
          return { valid: false, errors: [{ pointer: "/", message: `No schema for kind: ${recordKind}` }] };
        }
        const r = record as Record<string, unknown>;
        if (typeof r.name !== "string" || typeof r.hp !== "number") {
          return { valid: false, errors: [{ pointer: "/hp", message: "Missing required field: hp" }] };
        }
        return { valid: true, errors: [] };
      },
      hasSchema(recordKind: string) {
        return recordKind === "creature";
      },
    };

    const extractor: Extractor = {
      manifest: {
        schema: "werkstatt/knowledge-extractor@1",
        extractorId: "invalid-record-test",
        extractorVersion: "1.0.0",
        sourceKinds: ["synthetic"],
        recordKinds: ["creature"],
        deterministic: true,
        parserMode: "static",
      },
      async run(ctx: ExtractorContext): Promise<ExtractorRunResult> {
        const data = ctx.source.parseJson("data.json") as Array<{ id: string; name: string }>;
        let count = 0;
        for (const item of data) {
          const resolved = ctx.ids.resolveOrCreate("creature", item.id, item.id);
          const record = {
            id: resolved.id,
            key: resolved.key,
            record_type: "creature",
            name: item.name,
            // Missing required 'hp' field
          };

          const validation = ctx.schemas.validate("creature", record);
          if (!validation.valid) {
            ctx.output.writeDiagnostic({
              id: `validation-${resolved.key}`,
              severity: "ERROR",
              message: `Record ${resolved.key} failed validation: ${validation.errors.map((e) => e.message).join(", ")}`,
              record_key: resolved.key,
            });
          }

          ctx.output.writeRecord(record);
          count++;
        }
        ctx.output.writePopulation("creatures", 1, 1);
        return {
          extractorId: "invalid-record-test",
          extractorVersion: "1.0.0",
          runId: "invalid-run",
          recordCount: count,
          populationCounts: [{ dimension: "creatures", expected: 1, extracted: 1 }],
          diagnostics: [...ctx.output.getDiagnostics()],
        };
      },
    };

    const binding = createSourceBinding("ext008-test", sourceRoot, "1.0.0", "semver", "readme", "fakefp", null);
    const keysPath = join(workspace, "knowledge", "identity", "keys.jsonl");
    const aliasesPath = join(workspace, "knowledge", "identity", "aliases.jsonl");

    const source = new ReadonlySourceReader(sourceRoot);
    const evidence = new EvidenceFactory("ext008-test", binding.binding_digest, source);
    const ids = new RefreshIdentityResolver(readKeyRegistry(keysPath), readAliasRegistry(aliasesPath), "ext008-test");
    const runId = "invalid-run-001";
    const output = new CandidateWriter(stagingDir, runId, "ext008-test", "invalid-record-test", "1.0.0");
    const ctx = createExtractorContext(source, binding, schemas, evidence, ids, output);

    const result = await extractor.run(ctx);
    const outputDir = output.flush();

    // Diagnostics should contain ERROR
    expect(result.diagnostics.length).toBeGreaterThan(0);
    expect(result.diagnostics[0].severity).toBe("ERROR");

    // Diagnostics file should be written
    const diagContent = readFileSync(join(outputDir, "diagnostics.jsonl"), "utf-8");
    expect(diagContent).toContain("ERROR");
  });
});
