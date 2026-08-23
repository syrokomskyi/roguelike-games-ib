# Search API (Cloudflare Worker)

## Purpose

Semantic search API for the Roguelike Inspiration Base. Uses Cloudflare Workers AI for embeddings and Vectorize for vector storage.

## Endpoints

- `GET /api/search?q=...&source=...&type=...&kind=...&concept_type=...&limit=...` — semantic search with optional metadata filters (`type` filters by `record_type`, `concept_type` filters by concept type)
- `GET /api/design-search?q=...` — design concept search
- `POST /api/index` — bulk index records (requires `X-Indexing-Token` header or `?token=` param matching `INDEXING_TOKEN` secret)
- `GET /api/health` — health check

## Bindings

- `AI` — Cloudflare Workers AI
- `VECTOR_INDEX` — Vectorize index (`roguelike-ib-search-v1`)

## Environment

- `EMBEDDING_MODEL` — Workers AI embedding model name (default: `@cf/baai/bge-m3`)
- `ALLOWED_ORIGINS` — CORS origin whitelist (comma-separated, `*` for all)
- `INDEXING_TOKEN` — secret token required for `/api/index` endpoint

## Deployment

```sh
pnpm search-api:deploy
```

Before first deploy, set the indexing secret:

```sh
pnpm --filter @roguelike-games-ib/search-api exec wrangler secret put INDEXING_TOKEN
```

## Indexing

```sh
SEARCH_API_URL=https://... INDEXING_TOKEN=... pnpm index:embeddings
```

This loads materialized records from `.generated/knowledge/dist/records.jsonl`, generates embeddings, and pushes them to the Worker.

## Production notes

- **CORS**: The Worker validates the `Origin` header against `ALLOWED_ORIGINS` (comma-separated). Requests without an `Origin` header get JSON-only responses (no CORS headers). Set `ALLOWED_ORIGINS` to the production domain in `wrangler.jsonc` or via `wrangler vars put`.
- **Auth**: `/api/index` requires `Authorization: Bearer <INDEXING_TOKEN>` header. The token is compared in constant time. Set it via `wrangler secret put INDEXING_TOKEN`.
- **Web client fallback**: When `PUBLIC_SEARCH_API_URL` is unset, the web client fetches `/api/search` (relative URL). In production, either set `PUBLIC_SEARCH_API_URL` to the Worker URL, or configure a proxy/route so `/api/*` reaches the Worker.
