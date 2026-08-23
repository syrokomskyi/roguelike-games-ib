/*
<MODULE_CONTRACT>
<purpose>Cloudflare Worker entry point — routes requests to search, design-search, index, and health endpoints. Uses Workers AI for embeddings and Vectorize for vector storage.</purpose>
<non-goals>
  <item>Does not implement the web UI — only the API.</item>
  <item>Does not manage Vectorize index lifecycle (creation, deletion).</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: search, design-search, index, and health endpoints with CORS and token auth.</item>
  <item>RFC-0010: Added concept_type filter to /api/search endpoint.</item>
</CHANGE_SUMMARY>
*/
import type {
  DesignConceptHit,
  DesignSearchApiResponse,
  Env,
  IndexRecord,
  IndexRequest,
  IndexResponse,
  SearchApiHit,
  SearchApiResponse,
  VectorMetadata,
} from "./types.ts";

const BATCH_SIZE = 100;
const MAX_QUERY_LENGTH = 1_000;
const MAX_RESULTS = 50;
const MAX_METADATA_TEXT_LENGTH = 2_000;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const corsHeaders = buildCorsHeaders(request, env);

    if (request.method === "OPTIONS") {
      return corsHeaders
        ? new Response(null, { status: 204, headers: corsHeaders })
        : new Response("Origin is not allowed", { status: 403 });
    }

    try {
      if (url.pathname === "/api/search" && request.method === "GET") {
        return handleSearch(url, env, corsHeaders);
      }

      if (url.pathname === "/api/design-search" && request.method === "GET") {
        return handleDesignSearch(url, env, corsHeaders);
      }

      if (url.pathname === "/api/index" && request.method === "POST") {
        return handleIndex(request, env, corsHeaders);
      }

      if (url.pathname === "/api/health" && request.method === "GET") {
        return jsonResponse({ status: "ok", model: env.EMBEDDING_MODEL }, corsHeaders);
      }

      return new Response("Not found", { status: 404, headers: corsHeaders ?? undefined });
    } catch (error) {
      console.error("search-api request failed", error);
      return jsonResponse({ error: "Search service is temporarily unavailable." }, corsHeaders, 500);
    }
  },
} satisfies ExportedHandler<Env>;

async function handleSearch(
  url: URL,
  env: Env,
  corsHeaders: HeadersInit | undefined,
): Promise<Response> {
  const q = requireQuery(url, corsHeaders);
  if (q instanceof Response) return q;

  const sourceId = normalizeFilter(url.searchParams.get("source"));
  const recordType = normalizeFilter(url.searchParams.get("type"));
  const kind = normalizeFilter(url.searchParams.get("kind"));
  const conceptType = normalizeFilter(url.searchParams.get("concept_type"));
  const limit = parseLimit(url.searchParams.get("limit"));
  const queryEmbedding = await embedTexts(env, [q]);

  if (queryEmbedding.length === 0) {
    return jsonResponse(emptySearch(q), corsHeaders);
  }

  const filter: Record<string, string> = {};
  if (sourceId) filter.source_id = sourceId;
  if (recordType) filter.record_type = recordType;
  if (kind) filter.kind = kind;
  if (conceptType) filter.concept_type = conceptType;
  const vectorMatches = await env.VECTOR_INDEX.query(queryEmbedding[0], {
    topK: limit,
    returnMetadata: "all",
    ...(Object.keys(filter).length > 0 ? { filter } : {}),
  });
  const hits = (vectorMatches.matches ?? []).map(toSearchHit);

  return jsonResponse({ hits, total: hits.length, query: q, mode: "semantic" } satisfies SearchApiResponse, corsHeaders);
}

async function handleDesignSearch(
  url: URL,
  env: Env,
  corsHeaders: HeadersInit | undefined,
): Promise<Response> {
  const q = requireQuery(url, corsHeaders);
  if (q instanceof Response) return q;

  const queryEmbedding = await embedTexts(env, [q]);
  if (queryEmbedding.length === 0) {
    return jsonResponse({ concepts: [], relations: [], query: q } satisfies DesignSearchApiResponse, corsHeaders);
  }

  const vectorMatches = await env.VECTOR_INDEX.query(queryEmbedding[0], {
    topK: 20,
    returnMetadata: "all",
    filter: { record_type: "concept" },
  });
  const concepts: DesignConceptHit[] = (vectorMatches.matches ?? []).map((match) => {
    const metadata = toMetadata(match.metadata);
    return {
      key: metadata.key,
      title: metadata.title || metadata.key,
      definition: metadata.summary,
      concept_type: metadata.concept_type ?? "concept",
      source_games: deserializeList(metadata.source_games),
      mutation_dimensions: deserializeList(metadata.mutation_dimensions),
      score: match.score,
    };
  });

  return jsonResponse({ concepts, relations: [], query: q } satisfies DesignSearchApiResponse, corsHeaders);
}

async function handleIndex(
  request: Request,
  env: Env,
  corsHeaders: HeadersInit | undefined,
): Promise<Response> {
  if (!isAuthorized(request, env)) {
    return jsonResponse({ error: "Unauthorized" }, corsHeaders, 401);
  }

  let body: IndexRequest;
  try {
    body = (await request.json()) as IndexRequest;
  } catch {
    return jsonResponse({ error: "JSON body required" }, corsHeaders, 400);
  }
  if (!Array.isArray(body.records) || body.records.length === 0 || body.records.length > 1_000) {
    return jsonResponse({ error: "records must contain 1 to 1000 entries" }, corsHeaders, 400);
  }

  const records = body.records.map(normalizeIndexRecord);
  const invalidRecord = records.find((record) => !record);
  if (invalidRecord) {
    return jsonResponse({ error: "Each record requires a valid vector_id, canonical_id, key, and record_type" }, corsHeaders, 400);
  }

  const errors: string[] = [];
  let indexed = 0;
  for (let offset = 0; offset < records.length; offset += BATCH_SIZE) {
    const batch = records.slice(offset, offset + BATCH_SIZE) as IndexRecord[];
    try {
      const embeddings = await embedTexts(env, batch.map(buildEmbeddingText));
      if (embeddings.length !== batch.length) {
        errors.push(`Batch ${offset / BATCH_SIZE + 1}: embedding count mismatch`);
        continue;
      }
      await env.VECTOR_INDEX.upsert(batch.map((record, index) => ({
        id: record.vector_id,
        values: embeddings[index],
        metadata: toVectorMetadata(record),
      })));
      indexed += batch.length;
    } catch (error) {
      console.error("indexing batch failed", error);
      errors.push(`Batch ${offset / BATCH_SIZE + 1}: could not be indexed`);
    }
  }

  return jsonResponse({ indexed, errors } satisfies IndexResponse, corsHeaders);
}

async function embedTexts(env: Env, texts: string[]): Promise<Float32Array[]> {
  const result = await env.AI.run(env.EMBEDDING_MODEL as never, { text: texts });
  const data = result as { data?: number[][] };
  return Array.isArray(data.data) ? data.data.map((values) => new Float32Array(values)) : [];
}

function requireQuery(url: URL, corsHeaders: HeadersInit | undefined): string | Response {
  const query = (url.searchParams.get("q") ?? "").trim();
  if (!query) return jsonResponse(emptySearch(""), corsHeaders);
  if (query.length > MAX_QUERY_LENGTH) {
    return jsonResponse({ error: `q must be at most ${MAX_QUERY_LENGTH} characters` }, corsHeaders, 400);
  }
  return query;
}

function emptySearch(query: string): SearchApiResponse {
  return { hits: [], total: 0, query, mode: "semantic" };
}

function normalizeFilter(value: string | null): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized !== "all" ? normalized.slice(0, 160) : undefined;
}

function parseLimit(value: string | null): number {
  const parsed = Number.parseInt(value ?? "20", 10);
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), MAX_RESULTS) : 20;
}

function toSearchHit(match: { score: number; metadata?: unknown }): SearchApiHit {
  const metadata = toMetadata(match.metadata);
  return {
    key: metadata.key,
    record_type: metadata.record_type,
    source_id: metadata.source_id,
    title: metadata.title,
    summary: metadata.summary,
    score: match.score,
    concept_type: metadata.concept_type || undefined,
    source_games: deserializeList(metadata.source_games),
    mutation_dimensions: deserializeList(metadata.mutation_dimensions),
    kind: metadata.kind || undefined,
    semantic_type: metadata.semantic_type || undefined,
  };
}

function toMetadata(value: unknown): VectorMetadata {
  const raw = (value ?? {}) as Partial<VectorMetadata>;
  return {
    canonical_id: raw.canonical_id ?? "",
    key: raw.key ?? "",
    record_type: raw.record_type ?? "",
    source_id: raw.source_id ?? "",
    content_language: raw.content_language ?? "en",
    title: raw.title ?? "",
    summary: raw.summary ?? "",
    concept_type: raw.concept_type ?? "",
    source_games: raw.source_games ?? "",
    mutation_dimensions: raw.mutation_dimensions ?? "",
    kind: raw.kind ?? "",
    semantic_type: raw.semantic_type ?? "",
  };
}

export function normalizeIndexRecord(value: IndexRecord): IndexRecord | undefined {
  if (!isVectorId(value.vector_id) || !value.canonical_id || !value.key || !value.record_type) return undefined;
  return {
    vector_id: value.vector_id,
    canonical_id: truncate(value.canonical_id, 256),
    key: truncate(value.key, 512),
    record_type: truncate(value.record_type, 80),
    source_id: truncate(value.source_id ?? "", 160),
    content_language: truncate(value.content_language || "en", 32),
    title: truncate(value.title ?? "", MAX_METADATA_TEXT_LENGTH),
    summary: truncate(value.summary ?? "", MAX_METADATA_TEXT_LENGTH),
    concept_type: value.concept_type ? truncate(value.concept_type, 160) : undefined,
    source_games: normalizeStringList(value.source_games),
    mutation_dimensions: normalizeStringList(value.mutation_dimensions),
    kind: value.kind ? truncate(value.kind, 80) : undefined,
    semantic_type: value.semantic_type ? truncate(value.semantic_type, 80) : undefined,
  };
}

export function toVectorMetadata(record: IndexRecord): VectorMetadata {
  return {
    canonical_id: record.canonical_id,
    key: record.key,
    record_type: record.record_type,
    source_id: record.source_id,
    content_language: record.content_language,
    title: record.title,
    summary: record.summary,
    concept_type: record.concept_type ?? "",
    source_games: record.source_games?.length ? serializeList(record.source_games) : "",
    mutation_dimensions: record.mutation_dimensions?.length ? serializeList(record.mutation_dimensions) : "",
    kind: record.kind ?? "",
    semantic_type: record.semantic_type ?? "",
  };
}

export function buildEmbeddingText(record: IndexRecord): string {
  return [
    `type: ${record.record_type}`,
    record.kind && `kind: ${record.kind}`,
    `key: ${record.key}`,
    record.title && `title: ${record.title}`,
    record.summary && `description: ${record.summary}`,
    record.concept_type && `concept: ${record.concept_type}`,
    record.semantic_type && `semantic_type: ${record.semantic_type}`,
    record.source_games?.length && `games: ${record.source_games.join(", ")}`,
    record.mutation_dimensions?.length && `dimensions: ${record.mutation_dimensions.join(", ")}`,
  ].filter(Boolean).join("\n");
}

function isAuthorized(request: Request, env: Env): boolean {
  const supplied = request.headers.get("Authorization");
  const expected = env.INDEXING_TOKEN;
  if (!expected || !supplied?.startsWith("Bearer ")) return false;
  const candidate = supplied.slice("Bearer ".length);
  if (candidate.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) difference |= candidate.charCodeAt(index) ^ expected.charCodeAt(index);
  return difference === 0;
}

function buildCorsHeaders(request: Request, env: Env): HeadersInit | undefined {
  const origin = request.headers.get("Origin");
  if (!origin) return { "Content-Type": "application/json" };
  const allowedOrigins = env.ALLOWED_ORIGINS.split(",").map((value) => value.trim()).filter(Boolean);
  if (!allowedOrigins.includes(origin)) return undefined;
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Vary": "Origin",
    "Content-Type": "application/json",
  };
}

function normalizeStringList(values: string[] | undefined): string[] | undefined {
  if (!values?.length) return undefined;
  return values.slice(0, 24).map((value) => truncate(String(value), 160));
}

function serializeList(values: string[]): string {
  return JSON.stringify(values);
}

function deserializeList(value: string | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) && parsed.every((item) => typeof item === "string") ? parsed : [];
  } catch {
    return [];
  }
}

function isVectorId(value: string): boolean {
  return /^[A-Za-z0-9_-]{1,64}$/.test(value);
}

function truncate(value: string, length: number): string {
  return value.slice(0, length);
}

function jsonResponse(data: unknown, headers: HeadersInit | undefined, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: headers ?? { "Content-Type": "application/json" },
  });
}
