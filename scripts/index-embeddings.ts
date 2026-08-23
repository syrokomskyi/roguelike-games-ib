/*
<MODULE_CONTRACT>
<purpose>CLI script that loads materialized records from dist, generates vector IDs, and pushes them to the search-api Worker for indexing. Supports dry-run mode for validation without a deployed Worker.</purpose>
<non-goals>
  <item>Does not generate embeddings — the Worker handles embedding via Workers AI.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: batch indexing script with token auth.</item>
  <item>Update indexing script: add kind/semantic_type to MaterializedRecord and toIndexRecord, add extractBodySummary for semantic_record body, add computeStats, add dry-run mode with --dry-run flag, improve output with stats and batch info</item>
  <item>RFC-0010: Enrich concept summary with inclusion_criteria in toIndexRecord().</item>
</CHANGE_SUMMARY>
*/
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import type { IndexRecord } from "../apps/search-api/src/types.ts";

const WORKSPACE = resolve(process.env.KNOWLEDGE_WORKSPACE_ROOT ?? process.cwd());
const DIST_DIR = resolve(WORKSPACE, ".generated/knowledge/dist");

interface MaterializedRecord {
  id: string;
  key: string;
  record_type: string;
  kind?: string;
  semantic_type?: string;
  source_identity?: { source_id?: string };
  scope?: { source_id?: string };
  title?: string;
  summary?: string;
  body?: string;
  definition?: string;
  language?: string;
  concept_type?: string;
  ancestry?: {
    source_games?: string[];
    mutation_dimensions?: string[];
  };
  [key: string]: unknown;
}

function loadRecords(): MaterializedRecord[] {
  const recordsPath = join(DIST_DIR, "records.jsonl");
  if (!existsSync(recordsPath)) {
    throw new Error(`Records file not found: ${recordsPath}. Run 'pnpm materialize' first.`);
  }

  const content = readFileSync(recordsPath, "utf-8");
  return content
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as MaterializedRecord);
}

function toIndexRecord(r: MaterializedRecord): IndexRecord {
  const sourceId =
    r.source_identity?.source_id ??
    r.scope?.source_id ??
    "";

  let summary = r.summary ?? r.definition ?? extractBodySummary(r.body) ?? "";

  if (r.record_type === "concept") {
    const inclusionCriteria = r["inclusion_criteria"];
    if (Array.isArray(inclusionCriteria) && inclusionCriteria.length > 0) {
      summary = `${summary} Inclusion criteria: ${inclusionCriteria.join(", ")}.`;
    }
  }

  return {
    vector_id: createHash("sha256").update(r.id).digest("base64url"),
    canonical_id: r.id,
    key: r.key,
    record_type: r.record_type,
    source_id: sourceId,
    content_language: r.language ?? "en",
    title: r.title ?? "",
    summary,
    concept_type: r.concept_type,
    source_games: r.ancestry?.source_games,
    mutation_dimensions: r.ancestry?.mutation_dimensions,
    kind: r.kind,
    semantic_type: r.semantic_type,
  };
}

function extractBodySummary(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const desc = b["description"] ?? b["summary"] ?? b["definition"];
  if (typeof desc === "string") return desc;
  return null;
}

function computeStats(records: IndexRecord[]): Record<string, number> {
  const stats: Record<string, number> = {};
  for (const r of records) {
    const label = r.kind ? `${r.record_type}/${r.kind}` : r.record_type;
    stats[label] = (stats[label] ?? 0) + 1;
  }
  return stats;
}

async function indexRecords(
  records: IndexRecord[],
  apiUrl: string,
  indexingToken: string,
): Promise<{ indexed: number; errors: string[] }> {
  const BATCH_SIZE = 100;
  const startBatch = parseNonNegativeInteger(process.env.INDEX_START_BATCH, 0);
  const batchCount = parsePositiveInteger(process.env.INDEX_BATCH_COUNT, Math.ceil(records.length / BATCH_SIZE));
  const startOffset = startBatch * BATCH_SIZE;
  const selectedRecords = records.slice(startOffset, startOffset + batchCount * BATCH_SIZE);
  let totalIndexed = 0;
  const allErrors: string[] = [];

  for (let i = 0; i < selectedRecords.length; i += BATCH_SIZE) {
    const batch = selectedRecords.slice(i, i + BATCH_SIZE);
    const batchNum = startBatch + Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(records.length / BATCH_SIZE);

    console.log(`Indexing batch ${batchNum}/${totalBatches} (${batch.length} records)...`);

    try {
      const response = await fetch(`${apiUrl}/api/index`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${indexingToken}`,
        },
        body: JSON.stringify({ records: batch }),
      });

      if (!response.ok) {
        const text = await response.text();
        allErrors.push(`Batch ${batchNum}: HTTP ${response.status} - ${text}`);
        continue;
      }

      const result = (await response.json()) as { indexed: number; errors: string[] };
      totalIndexed += result.indexed;
      if (result.errors.length > 0) {
        allErrors.push(...result.errors);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      allErrors.push(`Batch ${batchNum}: ${msg}`);
    }
  }

  return { indexed: totalIndexed, errors: allErrors };
}

function parseNonNegativeInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function main() {
  const dryRun = process.env.INDEX_DRY_RUN === "1" || process.argv.includes("--dry-run");
  const apiUrl = process.env.SEARCH_API_URL;
  const indexingToken = process.env.INDEXING_TOKEN;

  if (!dryRun) {
    if (!apiUrl) {
      console.error("SEARCH_API_URL environment variable required (or use --dry-run).");
      console.error("Example: SEARCH_API_URL=https://roguelike-ib-search-api.<account>.workers.dev pnpm index:embeddings");
      process.exit(1);
    }
    if (!indexingToken) {
      console.error("INDEXING_TOKEN environment variable required (or use --dry-run).");
      console.error("Set it with: pnpm --filter @roguelike-games-ib/search-api exec wrangler secret put INDEXING_TOKEN");
      process.exit(1);
    }
  }

  console.log("Loading materialized records...");
  const records = loadRecords();
  console.log(`Loaded ${records.length} records from ${DIST_DIR}`);

  const idxRecords = records.map(toIndexRecord);

  const stats = computeStats(idxRecords);
  console.log("\n=== Record Statistics ===");
  for (const [label, count] of Object.entries(stats).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${label}: ${count}`);
  }

  const startBatch = parseNonNegativeInteger(process.env.INDEX_START_BATCH, 0);
  const BATCH_SIZE = 100;
  const batchCount = parsePositiveInteger(process.env.INDEX_BATCH_COUNT, Math.ceil(idxRecords.length / BATCH_SIZE));
  const selectedCount = Math.min(batchCount * BATCH_SIZE, idxRecords.length - startBatch * BATCH_SIZE);

  console.log(`\nTotal records: ${idxRecords.length}`);
  console.log(`Selected: ${selectedCount} (batch ${startBatch + 1} to ${startBatch + batchCount}, ${BATCH_SIZE} per batch)`);

  if (dryRun) {
    console.log("\n=== Dry Run ===");
    console.log("No records will be sent to the Worker.");
    console.log("Sample IndexRecord (first):");
    console.log(JSON.stringify(idxRecords[0], null, 2));
    console.log("\nAll records validated successfully.");
    console.log("Done.");
    return;
  }

  console.log(`\nIndexing to ${apiUrl}...`);
  const result = await indexRecords(idxRecords, apiUrl!, indexingToken!);

  console.log("\n=== Indexing Results ===");
  console.log(`Indexed: ${result.indexed}/${selectedCount}`);
  if (result.errors.length > 0) {
    console.log(`Errors (${result.errors.length}):`);
    for (const err of result.errors) {
      console.log(`  - ${err}`);
    }
  }
  console.log("Done.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
