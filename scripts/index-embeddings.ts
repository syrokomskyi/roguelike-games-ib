/*
<MODULE_CONTRACT>
<purpose>CLI script that loads materialized records from dist, generates vector IDs, and pushes them to the search-api Worker for indexing.</purpose>
<non-goals>
  <item>Does not generate embeddings — the Worker handles embedding via Workers AI.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: batch indexing script with token auth.</item>
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

  return {
    vector_id: createHash("sha256").update(r.id).digest("base64url"),
    canonical_id: r.id,
    key: r.key,
    record_type: r.record_type,
    source_id: sourceId,
    content_language: r.language ?? "en",
    title: r.title ?? "",
    summary: r.summary ?? r.definition ?? r.body ?? "",
    concept_type: r.concept_type,
    source_games: r.ancestry?.source_games,
    mutation_dimensions: r.ancestry?.mutation_dimensions,
  };
}

async function indexRecords(
  records: IndexRecord[],
  apiUrl: string,
  indexingToken: string,
): Promise<{ indexed: number; errors: string[] }> {
  const BATCH_SIZE = 100;
  let totalIndexed = 0;
  const allErrors: string[] = [];

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
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

async function main() {
  const apiUrl = process.env.SEARCH_API_URL;
  const indexingToken = process.env.INDEXING_TOKEN;
  if (!apiUrl) {
    console.error("SEARCH_API_URL environment variable required.");
    console.error("Example: SEARCH_API_URL=https://roguelike-ib-search-api.<account>.workers.dev pnpm index:embeddings");
    process.exit(1);
  }
  if (!indexingToken) {
    console.error("INDEXING_TOKEN environment variable required.");
    console.error("Set it with: pnpm --filter @roguelike-games-ib/search-api exec wrangler secret put INDEXING_TOKEN");
    process.exit(1);
  }

  console.log("Loading materialized records...");
  const records = loadRecords();
  console.log(`Loaded ${records.length} records from ${DIST_DIR}`);

  const indexRecords_ = records.map(toIndexRecord);

  console.log(`Indexing to ${apiUrl}...`);
  const result = await indexRecords(indexRecords_, apiUrl, indexingToken);

  console.log("\n=== Indexing Results ===");
  console.log(`Indexed: ${result.indexed}/${records.length}`);
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
