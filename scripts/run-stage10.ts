import { createCataclysmBNExtractor } from "../packages/extractors/cataclysm-bn-extractor/src/index.ts";
import {
  ReadonlySourceReader,
  EvidenceFactory,
  CandidateWriter,
  createNullSchemaFacade,
  createExtractorContext,
  RefreshIdentityResolver,
} from "../packages/extractor-sdk/src/index.ts";
import {
  createSourceBinding,
  createRecordId,
  preparePromotion,
  applyPromotionTransaction,
  readKeyRegistry,
  writeKeyRegistry,
  readAliasRegistry,
  type KeyEntry,
  type AliasEntry,
  type TransactionOperation,
} from "../packages/knowledge-core/src/index.ts";
import { mkdirSync, existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

function loadExistingKeys(canonicalRoot: string, sourceId: string): KeyEntry[] {
  const keysPath = join(canonicalRoot, "identity", "keys.jsonl");
  const fromRegistry = readKeyRegistry(keysPath);
  if (fromRegistry.length > 0) {
    return fromRegistry.filter((k) => k.key.startsWith(`${sourceId}/`));
  }

  const keys: KeyEntry[] = [];
  const defRoot = join(canonicalRoot, "definition", sourceId);
  if (!existsSync(defRoot)) return keys;

  function walkDefDir(dir: string) {
    const items = readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      const fullPath = join(dir, item.name);
      if (item.isDirectory()) {
        walkDefDir(fullPath);
      } else if (item.isFile() && item.name.endsWith(".jsonl")) {
        const text = readFileSync(fullPath, "utf-8");
        for (const line of text.split("\n")) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const obj = JSON.parse(trimmed);
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

  walkDefDir(defRoot);
  return keys;
}

function loadExistingEvidenceIds(canonicalRoot: string, sourceId: string): Map<string, string> {
  const map = new Map<string, string>();
  const evRoot = join(canonicalRoot, "evidence", sourceId, "evidence");
  if (!existsSync(evRoot)) return map;

  const files = readdirSync(evRoot);
  for (const file of files) {
    if (!file.endsWith(".jsonl")) continue;
    const text = readFileSync(join(evRoot, file), "utf-8");
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const obj = JSON.parse(trimmed);
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

const WORKSPACE = "/home/syrokomskyi/projects/roguelike-games-ib";
const SOURCE_ROOT = "/home/syrokomskyi/projects/roguelike-games-ib-source/Cataclysm-BN/data/json";
const CANONICAL_ROOT = join(WORKSPACE, "knowledge");
const STAGING_ROOT = join(WORKSPACE, "staging");

const FINGERPRINT = "0747e1f4fd386b076663592f1a2ffafaf625b93c140117ae609e18b30c8e2713";
const BINDING_DIGEST = "a8b27380f9ca96a859a50604569e6993c3da98bd1c8507f9a8421f5f5d979cbd";

async function main() {
  const t0 = Date.now();
  const memBefore = process.memoryUsage();

  const binding = createSourceBinding(
    "cataclysm-bn",
    "Cataclysm-BN",
    "0.7.1",
    "semver",
    "package_json",
    FINGERPRINT,
    { repository: "https://github.com/cataclysmbnteam/Cataclysm-BN", commit: null, clean: null, default_branch: "main" },
    "data/json",
  );

  const extractor = createCataclysmBNExtractor();
  const runId = "cataclysm-bn-stage10-run";
  const stagingRunDir = join(STAGING_ROOT, runId);
  mkdirSync(stagingRunDir, { recursive: true });

  const existingKeys = loadExistingKeys(CANONICAL_ROOT, "cataclysm-bn");
  const existingAliases = readAliasRegistry(join(CANONICAL_ROOT, "identity", "aliases.jsonl"));
  const existingEvidenceIds = loadExistingEvidenceIds(CANONICAL_ROOT, "cataclysm-bn");
  console.log(`Loaded ${existingKeys.length} existing keys, ${existingAliases.length} aliases, ${existingEvidenceIds.size} evidence IDs`);

  const source = new ReadonlySourceReader(SOURCE_ROOT);
  const evidence = new EvidenceFactory("cataclysm-bn", BINDING_DIGEST, source);
  const ids = new RefreshIdentityResolver(existingKeys, existingAliases, "cataclysm-bn");
  const schemas = createNullSchemaFacade();
  const output = new CandidateWriter(STAGING_ROOT, runId, "cataclysm-bn", "cataclysm-bn-factual", "1.0.0");

  const ctx = createExtractorContext(source, binding, schemas, evidence, ids, output);
  const result = await extractor.run(ctx);

  const t1 = Date.now();
  const memAfter = process.memoryUsage();

  console.log("=== Extraction Results ===");
  console.log("Record count:", result.recordCount);
  console.log("Population counts:", JSON.stringify(result.populationCounts, null, 2));
  console.log("Extraction runtime:", `${t1 - t0}ms`);
  console.log("Peak heap used:", `${Math.round(memAfter.heapUsed / 1024 / 1024)}MB`);
  console.log("Peak RSS:", `${Math.round(memAfter.rss / 1024 / 1024)}MB`);

  const factualRecords = output.getRecords();
  const factualEvidence = output.getEvidence();

  const ops: TransactionOperation[] = [];

  for (const record of factualRecords) {
    ops.push({
      type: "create",
      record_id: record.id,
      record_type: "definition",
      key: record.key,
      data: record,
    });
  }

  for (const ev of factualEvidence) {
    const recordId = (ev as any).record_id;
    const existingEvId = existingEvidenceIds.get(recordId);
    const evRecord = {
      schema: "rgkb/evidence@2",
      id: existingEvId ?? createRecordId(),
      key: `cataclysm-bn/evidence/${recordId.split(":").pop()}`,
      record_type: "evidence",
      language: "en",
      scope: { source_id: "cataclysm-bn", scope_kind: "source" },
      origin: { kind: "extractor", actor_id: "cataclysm-bn-factual", run_id: runId },
      epistemic: { status: "observed", confidence: "verified" },
      aliases: [],
      record_id: (ev as any).record_id,
      anchor: (ev as any).anchor,
    };
    ops.push({
      type: "create",
      record_id: evRecord.id,
      record_type: "evidence",
      key: evRecord.key,
      data: evRecord,
    });
  }

  const txId = "cataclysm-bn-stage10-tx";
  const plan = preparePromotion(txId, "cataclysm-bn", ops, {});
  const t2 = Date.now();
  const applyResult = applyPromotionTransaction(plan, CANONICAL_ROOT, STAGING_ROOT);
  const t3 = Date.now();

  console.log("=== Promotion Results ===");
  console.log("Transaction status:", applyResult.status);
  console.log("Promotion runtime:", `${t3 - t2}ms`);
  console.log("Total records promoted:", ops.length);

  if (applyResult.status !== "COMMITTED") {
    console.error("Transaction failed:", JSON.stringify(applyResult.plan.diagnostics, null, 2));
    process.exit(1);
  }

  const allKeys: KeyEntry[] = [];
  for (const record of factualRecords) {
    allKeys.push({ id: record.id, key: record.key, record_type: "definition" });
  }
  for (const op of ops) {
    if (op.record_type === "evidence") {
      allKeys.push({ id: op.record_id, key: op.key, record_type: "evidence" });
    }
  }
  const existingNonCatBnKeys = readKeyRegistry(join(CANONICAL_ROOT, "identity", "keys.jsonl"))
    .filter((k) => !k.key.startsWith("cataclysm-bn/"));
  writeKeyRegistry(join(CANONICAL_ROOT, "identity", "keys.jsonl"), [...existingNonCatBnKeys, ...allKeys]);
  console.log(`Updated keys.jsonl with ${allKeys.length} cataclysm-bn entries`);

  console.log("=== Benchmarks ===");
  console.log(JSON.stringify({
    extractionRuntimeMs: t1 - t0,
    promotionRuntimeMs: t3 - t2,
    totalRuntimeMs: t3 - t0,
    peakHeapMB: Math.round(memAfter.heapUsed / 1024 / 1024),
    peakRssMB: Math.round(memAfter.rss / 1024 / 1024),
    canonicalRecordCount: ops.length,
    recordCounts: {
      gameDefinitions: factualRecords.length,
      evidence: factualEvidence.length,
    },
    populationCounts: result.populationCounts,
  }, null, 2));

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
