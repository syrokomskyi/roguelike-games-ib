import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const WORKSPACE = "/home/syrokomskyi/projects/roguelike-games-ib";
const DIST_DIR = resolve(WORKSPACE, "systems-cache/generated/dist");

interface MaterializedRecord {
  id: string;
  key: string;
  record_type: string;
  source_identity?: { source_id?: string };
  scope?: { source_id?: string };
  title?: string;
  summary?: string;
  body?: string;
  concept_type?: string;
  ancestry?: {
    source_games?: string[];
    mutation_dimensions?: string[];
  };
  [key: string]: unknown;
}

interface IndexRecord {
  id: string;
  key: string;
  record_type: string;
  source_id: string;
  title: string;
  summary: string;
  concept_type?: string;
  source_games?: string[];
  mutation_dimensions?: string[];
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
    id: r.id,
    key: r.key,
    record_type: r.record_type,
    source_id: sourceId,
    title: r.title ?? "",
    summary: r.summary ?? "",
    concept_type: r.concept_type,
    source_games: r.ancestry?.source_games,
    mutation_dimensions: r.ancestry?.mutation_dimensions,
  };
}

async function indexRecords(
  records: IndexRecord[],
  apiUrl: string,
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
        headers: { "Content-Type": "application/json" },
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
  if (!apiUrl) {
    console.error("SEARCH_API_URL environment variable required.");
    console.error("Example: SEARCH_API_URL=https://roguelike-ib-search-api.<account>.workers.dev pnpm index:embeddings");
    process.exit(1);
  }

  console.log("Loading materialized records...");
  const records = loadRecords();
  console.log(`Loaded ${records.length} records from ${DIST_DIR}`);

  const indexRecords_ = records.map(toIndexRecord);

  console.log(`Indexing to ${apiUrl}...`);
  const result = await indexRecords(indexRecords_, apiUrl);

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
