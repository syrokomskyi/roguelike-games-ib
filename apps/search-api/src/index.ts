import type {
  Env,
  SearchApiResponse,
  SearchApiHit,
  DesignSearchApiResponse,
  DesignConceptHit,
  IndexRequest,
  IndexResponse,
  IndexRecord,
  VectorMetadata,
} from "./types.ts";

const EMBEDDING_MODEL = "@cf/baai/bge-base-en-v1.5";
const BATCH_SIZE = 100;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    const corsHeaders = buildCorsHeaders(env);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      if (path === "/api/search" && request.method === "GET") {
        return handleSearch(request, url, env, corsHeaders);
      }

      if (path === "/api/design-search" && request.method === "GET") {
        return handleDesignSearch(request, url, env, corsHeaders);
      }

      if (path === "/api/index" && request.method === "POST") {
        return handleIndex(request, env, corsHeaders);
      }

      if (path === "/api/health" && request.method === "GET") {
        return jsonResponse({ status: "ok", model: EMBEDDING_MODEL }, corsHeaders);
      }

      return new Response("Not found", { status: 404, headers: corsHeaders });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return jsonResponse({ error: msg }, corsHeaders, 500);
    }
  },
} satisfies ExportedHandler<Env>;

async function handleSearch(
  _request: Request,
  url: URL,
  env: Env,
  corsHeaders: HeadersInit,
): Promise<Response> {
  const q = url.searchParams.get("q") ?? "";
  if (!q.trim()) {
    return jsonResponse({ hits: [], total: 0, query: q, mode: "semantic" } as SearchApiResponse, corsHeaders);
  }

  const sourceFilter = url.searchParams.get("source");
  const typeFilter = url.searchParams.get("type");
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "50"), 200);

  const queryEmbedding = await embedTexts(env, [q]);
  if (queryEmbedding.length === 0) {
    return jsonResponse({ hits: [], total: 0, query: q, mode: "semantic" } as SearchApiResponse, corsHeaders);
  }

  const vectorMatches = await env.VECTOR_INDEX.query(queryEmbedding[0], {
    topK: limit,
    returnMetadata: "all",
  });

  let hits: SearchApiHit[] = (vectorMatches.matches ?? []).map((match) => {
    const meta = (match.metadata ?? {}) as VectorMetadata;
    return {
      key: meta.key ?? "",
      record_type: meta.record_type ?? "",
      source_id: meta.source_id ?? "",
      title: meta.title ?? "",
      summary: meta.summary ?? "",
      score: match.score,
      concept_type: meta.concept_type,
      source_games: meta.source_games,
      mutation_dimensions: meta.mutation_dimensions,
    };
  });

  if (sourceFilter && sourceFilter !== "all") {
    hits = hits.filter((h) => h.source_id === sourceFilter);
  }
  if (typeFilter && typeFilter !== "all") {
    hits = hits.filter((h) => h.record_type === typeFilter);
  }

  return jsonResponse({
    hits,
    total: hits.length,
    query: q,
    mode: "semantic",
  } as SearchApiResponse, corsHeaders);
}

async function handleDesignSearch(
  _request: Request,
  url: URL,
  env: Env,
  corsHeaders: HeadersInit,
): Promise<Response> {
  const q = url.searchParams.get("q") ?? "";
  if (!q.trim()) {
    return jsonResponse({ concepts: [], relations: [], query: q } as DesignSearchApiResponse, corsHeaders);
  }

  const queryEmbedding = await embedTexts(env, [q]);
  if (queryEmbedding.length === 0) {
    return jsonResponse({ concepts: [], relations: [], query: q } as DesignSearchApiResponse, corsHeaders);
  }

  const vectorMatches = await env.VECTOR_INDEX.query(queryEmbedding[0], {
    topK: 20,
    returnMetadata: "all",
  });

  const conceptHits: DesignConceptHit[] = [];

  for (const match of vectorMatches.matches ?? []) {
    const meta = (match.metadata ?? {}) as VectorMetadata;
    if (meta.record_type === "concept") {
      conceptHits.push({
        key: meta.key ?? "",
        title: meta.title ?? meta.key ?? "",
        definition: meta.summary ?? "",
        concept_type: meta.concept_type ?? "concept",
        source_games: meta.source_games ?? [],
        mutation_dimensions: meta.mutation_dimensions ?? [],
        score: match.score,
      });
    }
  }

  conceptHits.sort((a, b) => b.score - a.score);

  return jsonResponse({
    concepts: conceptHits,
    relations: [],
    query: q,
  } as DesignSearchApiResponse, corsHeaders);
}

async function handleIndex(
  request: Request,
  env: Env,
  corsHeaders: HeadersInit,
): Promise<Response> {
  const body = (await request.json()) as IndexRequest;
  if (!body.records || !Array.isArray(body.records)) {
    return jsonResponse({ error: "records array required" }, corsHeaders, 400);
  }

  const errors: string[] = [];
  let indexed = 0;

  for (let i = 0; i < body.records.length; i += BATCH_SIZE) {
    const batch = body.records.slice(i, i + BATCH_SIZE);
    try {
      const texts = batch.map((r) => buildEmbeddingText(r));
      const embeddings = await embedTexts(env, texts);

      if (embeddings.length !== batch.length) {
        errors.push(`Batch ${i / BATCH_SIZE}: embedding count mismatch (${embeddings.length} vs ${batch.length})`);
        continue;
      }

      const vectors = batch.map((record, j) => ({
        id: record.id,
        values: embeddings[j],
        metadata: {
          key: record.key,
          record_type: record.record_type,
          source_id: record.source_id,
          title: record.title,
          summary: record.summary,
          concept_type: record.concept_type ?? null,
          source_games: record.source_games ?? null,
          mutation_dimensions: record.mutation_dimensions ?? null,
        } as VectorMetadata,
      }));

      await env.VECTOR_INDEX.upsert(vectors);
      indexed += batch.length;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Batch ${i / BATCH_SIZE}: ${msg}`);
    }
  }

  return jsonResponse({ indexed, errors } as IndexResponse, corsHeaders);
}

async function embedTexts(env: Env, texts: string[]): Promise<Float32Array[]> {
  const result = await env.AI.run(EMBEDDING_MODEL as never, { text: texts });
  const data = result as { data?: number[][]; shape?: number[] };
  if (data.data && Array.isArray(data.data)) {
    return data.data.map((arr) => new Float32Array(arr));
  }
  return [];
}

function buildEmbeddingText(record: IndexRecord): string {
  const parts = [
    record.record_type,
    record.key,
    record.title,
    record.summary,
  ];
  if (record.concept_type) parts.push(record.concept_type);
  if (record.source_games?.length) parts.push(record.source_games.join(" "));
  if (record.mutation_dimensions?.length) parts.push(record.mutation_dimensions.join(" "));
  return parts.filter(Boolean).join(" ");
}

function buildCorsHeaders(env: Env): HeadersInit {
  return {
    "Access-Control-Allow-Origin": env.CORS_ORIGIN || "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };
}

function jsonResponse(data: unknown, headers: HeadersInit, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers });
}
