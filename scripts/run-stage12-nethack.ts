import { createNetHackExtractor } from "../packages/extractors/nethack-extractor/src/index.ts";
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
  type TransactionOperation,
} from "../packages/knowledge-core/src/index.ts";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const WORKSPACE = "/home/syrokomskyi/projects/roguelike-games-ib";
const SOURCE_ROOT = "/home/syrokomskyi/projects/roguelike-games-ib-source/NetHack/include";
const CANONICAL_ROOT = join(WORKSPACE, "knowledge");
const STAGING_ROOT = join(WORKSPACE, "staging");

const FINGERPRINT = "3644218fae3cfcd1eb58f3b908ddd323f66e02cc743bfff192a1505ced0d95d0";
const BINDING_DIGEST = "40dde88fe3b4529a92a27cce53ba855682346cdb9b3715383850f0bf1ec1fc78";

async function main() {
  const t0 = Date.now();
  const memBefore = process.memoryUsage();

  const binding = createSourceBinding(
    "nethack",
    "NetHack",
    "5.0.0",
    "semver",
    "package_json",
    FINGERPRINT,
    { repository: "https://github.com/NetHack/NetHack", commit: null, clean: null, default_branch: "NetHack-5.0" },
    "include",
  );

  const extractor = createNetHackExtractor();
  const runId = "nethack-stage12-run";
  const stagingRunDir = join(STAGING_ROOT, runId);
  mkdirSync(stagingRunDir, { recursive: true });

  const source = new ReadonlySourceReader(SOURCE_ROOT);
  const evidence = new EvidenceFactory("nethack", BINDING_DIGEST, source);
  const ids = new RefreshIdentityResolver([], [], "nethack");
  const schemas = createNullSchemaFacade();
  const output = new CandidateWriter(STAGING_ROOT, runId, "nethack", "nethack-factual", "1.0.0");

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
    const evRecord = {
      schema: "rgkb/evidence@2",
      id: createRecordId(),
      key: `nethack/evidence/${(ev as any).record_id.split(":").pop()}`,
      record_type: "evidence",
      language: "en",
      scope: { source_id: "nethack", scope_kind: "source" },
      origin: { kind: "extractor", actor_id: "nethack-factual", run_id: runId },
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

  const txId = "nethack-stage12-tx";
  const plan = preparePromotion(txId, "nethack", ops, {});
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
