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
import {
  createSourceBinding,
  createRecordId,
  readKeyRegistry,
  readAliasRegistry,
  writeKeyRegistry,
  preparePromotion,
  applyPromotionTransaction,
  type KeyEntry,
  type TransactionOperation,
} from "@roguelike-games-ib/knowledge-core";
import { createTestWorkspace, cleanupTempWorkspace } from "@roguelike-games-ib/test-fixtures";
import { mkdirSync, existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";

function loadExistingKeysFromCanonical(canonicalRoot: string, sourceId: string): KeyEntry[] {
  const keys: KeyEntry[] = [];
  const defRoot = join(canonicalRoot, "definition", sourceId);
  if (!existsSync(defRoot)) return keys;

  function walk(dir: string) {
    const items = readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      const full = join(dir, item.name);
      if (item.isDirectory()) {
        walk(full);
      } else if (item.isFile() && item.name.endsWith(".jsonl")) {
        const text = readFileSync(full, "utf-8");
        for (const line of text.split("\n")) {
          const t = line.trim();
          if (!t) continue;
          try {
            const obj = JSON.parse(t);
            if (obj.id && obj.key && obj.record_type) {
              keys.push({ id: obj.id, key: obj.key, record_type: obj.record_type });
            }
          } catch {
            continue;
          }
        }
      }
    }
  }
  walk(defRoot);
  return keys;
}

function loadExistingEvidenceIds(canonicalRoot: string, sourceId: string): Map<string, string> {
  const map = new Map<string, string>();
  const evRoot = join(canonicalRoot, "evidence", sourceId, "evidence");
  if (!existsSync(evRoot)) return map;

  for (const file of readdirSync(evRoot)) {
    if (!file.endsWith(".jsonl")) continue;
    const text = readFileSync(join(evRoot, file), "utf-8");
    for (const line of text.split("\n")) {
      const t = line.trim();
      if (!t) continue;
      try {
        const obj = JSON.parse(t);
        if (obj.record_id && obj.id) {
          map.set(obj.record_id, obj.id);
        }
      } catch {
        continue;
      }
    }
  }
  return map;
}

const syntheticManifest = {
  schema: "werkstatt/knowledge-extractor@1" as const,
  extractorId: "synthetic-id-stability",
  extractorVersion: "1.0.0",
  sourceKinds: ["synthetic"],
  recordKinds: ["creature"],
  deterministic: true as const,
  parserMode: "static" as const,
};

function createExtractor(): Extractor {
  return {
    manifest: syntheticManifest,
    async run(ctx: ExtractorContext): Promise<ExtractorRunResult> {
      const data = ctx.source.parseJson("creatures.json") as Array<{
        id: string;
        name: string;
        hp: number;
      }>;
      const sorted = [...data].sort((a, b) => a.id.localeCompare(b.id));

      let count = 0;
      for (const item of sorted) {
        const resolved = ctx.ids.resolveOrCreate("creature", item.id, item.id);
        ctx.output.writeRecord({
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
        });

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

      ctx.output.writePopulation("creatures", sorted.length, count);

      return {
        extractorId: "synthetic-id-stability",
        extractorVersion: "1.0.0",
        runId: "test-run",
        recordCount: count,
        populationCounts: [
          { dimension: "creatures", expected: sorted.length, extracted: count },
        ],
        diagnostics: [],
      };
    },
  };
}

function buildOps(
  records: readonly { id: string; key: string; record_type: string }[],
  evidence: readonly { record_id: string; anchor: unknown }[],
  existingEvIds: Map<string, string>,
  runId: string,
): TransactionOperation[] {
  const ops: TransactionOperation[] = [];

  for (const record of records) {
    ops.push({
      type: "create" as const,
      record_id: record.id,
      record_type: "definition",
      key: record.key,
      data: record,
    });
  }

  for (const ev of evidence) {
    const existingEvId = existingEvIds.get(ev.record_id);
    const evRecord = {
      schema: "rgkb/evidence@2",
      id: existingEvId ?? createRecordId(),
      key: `ext016-test/evidence/${ev.record_id.split(":").pop()}`,
      record_type: "evidence",
      language: "en",
      scope: { source_id: "ext016-test", scope_kind: "source" },
      origin: { kind: "extractor", actor_id: "synthetic-id-stability", run_id: runId },
      epistemic: { status: "observed", confidence: "verified" },
      aliases: [],
      record_id: ev.record_id,
      anchor: ev.anchor,
    };
    ops.push({
      type: "create" as const,
      record_id: evRecord.id,
      record_type: "evidence",
      key: evRecord.key,
      data: evRecord,
    });
  }

  return ops;
}

describe("EXT-016: record and evidence ID stability across re-runs", () => {
  let workspace: string;
  let sourceRoot: string;
  let stagingDir: string;
  let canonicalRoot: string;

  beforeEach(() => {
    workspace = createTestWorkspace({
      kbId: "ext016-test",
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
    sourceRoot = join(parentDir, "ext016-test-source", "source");
    stagingDir = join(workspace, "staging");
    canonicalRoot = join(workspace, "knowledge");
    mkdirSync(stagingDir, { recursive: true });
  });

  afterEach(() => {
    cleanupTempWorkspace(workspace);
  });

  it("produces identical record IDs when keys are loaded from canonical files", async () => {
    const extractor = createExtractor();
    const binding = createSourceBinding(
      "ext016-test",
      sourceRoot,
      "1.0.0",
      "semver",
      "readme",
      "fakefingerprint",
      null,
    );
    const keysPath = join(canonicalRoot, "identity", "keys.jsonl");
    const aliasesPath = join(canonicalRoot, "identity", "aliases.jsonl");

    // Run 1 — no existing keys, generates new IDs
    let run1RecordIds: string[] = [];
    {
      const source = new ReadonlySourceReader(sourceRoot);
      const evidence = new EvidenceFactory("ext016-test", binding.binding_digest, source);
      const ids = new RefreshIdentityResolver(
        readKeyRegistry(keysPath),
        readAliasRegistry(aliasesPath),
        "ext016-test",
      );
      const schemas = createNullSchemaFacade();
      const output = new CandidateWriter(stagingDir, "run-1", "ext016-test", "synthetic-id-stability", "1.0.0");
      const ctx = createExtractorContext(source, binding, schemas, evidence, ids, output);
      await extractor.run(ctx);

      const records = output.getRecords();
      run1RecordIds = records.map((r) => r.id);

      // Promote to canonical
      const ops = buildOps(records, output.getEvidence(), new Map(), "run-1");
      const plan = preparePromotion("ext016-tx-1", "ext016-test", ops, {});
      const result = applyPromotionTransaction(plan, canonicalRoot, stagingDir);
      expect(result.status).toBe("COMMITTED");

      // Update key registry
      const allKeys: KeyEntry[] = records.map((r) => ({
        id: r.id,
        key: r.key,
        record_type: "definition",
      }));
      for (const op of ops) {
        if (op.record_type === "evidence") {
          allKeys.push({ id: op.record_id, key: op.key, record_type: "evidence" });
        }
      }
      writeKeyRegistry(keysPath, allKeys);
    }

    // Run 2 — load keys from canonical definition files (simulating loadExistingKeys)
    let run2RecordIds: string[] = [];
    {
      const canonicalKeys = loadExistingKeysFromCanonical(canonicalRoot, "ext016-test");
      expect(canonicalKeys.length).toBeGreaterThan(0);

      const source = new ReadonlySourceReader(sourceRoot);
      const evidence = new EvidenceFactory("ext016-test", binding.binding_digest, source);
      const ids = new RefreshIdentityResolver(
        canonicalKeys,
        readAliasRegistry(aliasesPath),
        "ext016-test",
      );
      const schemas = createNullSchemaFacade();
      const output = new CandidateWriter(stagingDir, "run-2", "ext016-test", "synthetic-id-stability", "1.0.0");
      const ctx = createExtractorContext(source, binding, schemas, evidence, ids, output);
      await extractor.run(ctx);

      run2RecordIds = output.getRecords().map((r) => r.id);
    }

    // IDs must be identical
    expect(run2RecordIds).toEqual(run1RecordIds);
  });

  it("produces identical evidence IDs when loaded from canonical evidence files", async () => {
    const extractor = createExtractor();
    const binding = createSourceBinding(
      "ext016-test",
      sourceRoot,
      "1.0.0",
      "semver",
      "readme",
      "fakefingerprint",
      null,
    );
    const keysPath = join(canonicalRoot, "identity", "keys.jsonl");
    const aliasesPath = join(canonicalRoot, "identity", "aliases.jsonl");

    // Run 1 — promote to canonical
    let run1EvidenceIds: string[] = [];
    {
      const source = new ReadonlySourceReader(sourceRoot);
      const evidence = new EvidenceFactory("ext016-test", binding.binding_digest, source);
      const ids = new RefreshIdentityResolver(
        readKeyRegistry(keysPath),
        readAliasRegistry(aliasesPath),
        "ext016-test",
      );
      const schemas = createNullSchemaFacade();
      const output = new CandidateWriter(stagingDir, "run-ev-1", "ext016-test", "synthetic-id-stability", "1.0.0");
      const ctx = createExtractorContext(source, binding, schemas, evidence, ids, output);
      await extractor.run(ctx);

      const records = output.getRecords();
      const ev = output.getEvidence();
      const ops = buildOps(records, ev, new Map(), "run-ev-1");
      const plan = preparePromotion("ext016-tx-ev-1", "ext016-test", ops, {});
      const result = applyPromotionTransaction(plan, canonicalRoot, stagingDir);
      expect(result.status).toBe("COMMITTED");

      // Extract evidence IDs from ops
      run1EvidenceIds = ops
        .filter((op) => op.record_type === "evidence")
        .map((op) => op.record_id);

      // Update key registry
      const allKeys: KeyEntry[] = records.map((r) => ({
        id: r.id,
        key: r.key,
        record_type: "definition",
      }));
      for (const op of ops) {
        if (op.record_type === "evidence") {
          allKeys.push({ id: op.record_id, key: op.key, record_type: "evidence" });
        }
      }
      writeKeyRegistry(keysPath, allKeys);
    }

    // Run 2 — load existing evidence IDs from canonical
    let run2EvidenceIds: string[] = [];
    {
      const canonicalKeys = loadExistingKeysFromCanonical(canonicalRoot, "ext016-test");
      const existingEvIds = loadExistingEvidenceIds(canonicalRoot, "ext016-test");
      expect(existingEvIds.size).toBeGreaterThan(0);

      const source = new ReadonlySourceReader(sourceRoot);
      const evidence = new EvidenceFactory("ext016-test", binding.binding_digest, source);
      const ids = new RefreshIdentityResolver(
        canonicalKeys,
        readAliasRegistry(aliasesPath),
        "ext016-test",
      );
      const schemas = createNullSchemaFacade();
      const output = new CandidateWriter(stagingDir, "run-ev-2", "ext016-test", "synthetic-id-stability", "1.0.0");
      const ctx = createExtractorContext(source, binding, schemas, evidence, ids, output);
      await extractor.run(ctx);

      const records = output.getRecords();
      const ev = output.getEvidence();
      const ops = buildOps(records, ev, existingEvIds, "run-ev-2");

      run2EvidenceIds = ops
        .filter((op) => op.record_type === "evidence")
        .map((op) => op.record_id);
    }

    // Evidence IDs must be identical
    expect(run2EvidenceIds.sort()).toEqual(run1EvidenceIds.sort());
  });

  it("generates new IDs when no existing keys are provided (baseline)", async () => {
    const extractor = createExtractor();
    const binding = createSourceBinding(
      "ext016-test",
      sourceRoot,
      "1.0.0",
      "semver",
      "readme",
      "fakefingerprint",
      null,
    );

    // Run A — empty keys
    let runAIds: string[];
    {
      const source = new ReadonlySourceReader(sourceRoot);
      const evidence = new EvidenceFactory("ext016-test", binding.binding_digest, source);
      const ids = new RefreshIdentityResolver([], [], "ext016-test");
      const schemas = createNullSchemaFacade();
      const output = new CandidateWriter(stagingDir, "run-a", "ext016-test", "synthetic-id-stability", "1.0.0");
      const ctx = createExtractorContext(source, binding, schemas, evidence, ids, output);
      await extractor.run(ctx);
      runAIds = output.getRecords().map((r) => r.id);
    }

    // Run B — also empty keys
    let runBIds: string[];
    {
      const source = new ReadonlySourceReader(sourceRoot);
      const evidence = new EvidenceFactory("ext016-test", binding.binding_digest, source);
      const ids = new RefreshIdentityResolver([], [], "ext016-test");
      const schemas = createNullSchemaFacade();
      const output = new CandidateWriter(stagingDir, "run-b", "ext016-test", "synthetic-id-stability", "1.0.0");
      const ctx = createExtractorContext(source, binding, schemas, evidence, ids, output);
      await extractor.run(ctx);
      runBIds = output.getRecords().map((r) => r.id);
    }

    // IDs must be different (UUIDv7 includes timestamp)
    expect(runAIds).not.toEqual(runBIds);
  });
});
