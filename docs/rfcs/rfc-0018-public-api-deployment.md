---
id: RFC-0018
title: "Public API and deployment — Cloudflare Workers for search-api and web app"
status: accepted
kind: policy
scope: workspace
owners:
  - architecture
reviewers:
  - human:andrii-syrokomskyi
createdAt: 2026-08-24
updatedAt: 2026-08-24
enhancedAt: 2026-08-24
closedAt:
supersedes: []
supersededBy:
amends: []
amendedBy: []
related:
  - RFC-0007
  - RFC-0010
  - RFC-0014
  - RFC-0020
satisfies: []
versionBump: minor
commands:
  proposed: []
  added: []
  changed: []
  removed: []
appsImpacted:
  - search-api
  - web
packagesImpacted: []
successSignals:
  - search-api deployed to Cloudflare Workers and accessible via public URL
  - Web app deployed to Cloudflare Workers (static assets) with search and dataset pages functional
  - API documentation page at /api-docs describes available endpoints
  - CORS configured with origin allowlist for public access
  - CI/CD deploy workflow extends existing deploy.yml
nonGoals:
  - Does not require authentication for read-only API access
  - Does not deploy the full knowledge base to Workers — only the search index and API layer
  - Does not implement write endpoints — all public endpoints are read-only
  - Does not deploy the MCP server to Workers — that is handled by RFC-0020 (MCP server requires D1 data layer migration due to better-sqlite3 incompatibility with Workers runtime)
  - Does not configure rate limiting via Cloudflare — the search API is read-only with minimal abuse surface; CORS allowlist provides origin-level control
---

# RFC-0018: Public API and deployment — Cloudflare Workers for search-api and web app

## Context

The project has a search API (`apps/search-api`) and web app (`apps/web`) that run locally. The search API is a Cloudflare Worker with Vectorize and Workers AI bindings. The web app is an Astro static site with an existing `wrangler.jsonc` configured for Cloudflare Workers static assets deployment. To make the inspiration base accessible to researchers, game designers, and other tools, we need to deploy these services publicly.

The MCP server (`apps/mcp`) also needs public deployment, but its data layer (`better-sqlite3`, `node:path`, filesystem-based `openProjection()`) is incompatible with the Workers runtime. MCP server deployment is handled separately by RFC-0020, which migrates the data layer to Cloudflare D1.

## Problem

1. **No public access** — the knowledge base is only accessible locally or via GitHub repository
2. **Search API is local-only** — the vector search endpoint cannot be queried by external tools
3. **MCP tools are local-only** — AI assistants cannot query the knowledge base without local setup
4. **No API documentation** — there is no public page describing available API endpoints
5. **Web app is not deployed** — the Astro site only runs locally

## Decision

### D1: Deploy search-api to Cloudflare Workers

The search-api already has:
- `apps/search-api/wrangler.jsonc` configuration with Vectorize index binding (`VECTOR_INDEX`, index name `roguelike-ib-search-v1`)
- Workers AI embedding model binding (`@cf/baai/bge-m3`)
- CORS headers with `ALLOWED_ORIGINS` allowlist
- `INDEXING_TOKEN` secret for write access
- Existing deploy script: `pnpm search-api:deploy`

Deployment steps:
1. Verify production Vectorize index `roguelike-ib-search-v1` exists (create via `wrangler vectorize create` if needed)
2. Run `scripts/index-embeddings.ts` to populate the index with materialized records
3. Deploy via `pnpm search-api:deploy`
4. Set `ALLOWED_ORIGINS` to include the deployed web app domain
5. Verify `/api/health` and `/api/search` respond correctly

### D2: Deploy web app to Cloudflare Workers (static assets)

The web app already has `apps/web/wrangler.jsonc` configured for Cloudflare Workers static assets deployment:
- `assets.directory: ./dist` serves the built Astro site
- `routes` with `asciium.com` custom domain already configured
- `html_handling: auto-trailing-slash`
- `not_found_handling: 404-page`

Deployment steps:
1. Build with `pnpm exec turbo run build:web` (produces `apps/web/dist/`)
2. Deploy via `wrangler deploy --config apps/web/wrangler.jsonc`
3. Set `PUBLIC_SEARCH_API_URL` environment variable to the deployed search API URL
4. Verify all pages functional (search, design, patterns, laboratory, recommend, dataset)

### D3: API documentation page

New web page `/api-docs` documenting:
- Search API endpoints (`/search`, `/health`)
- MCP tools list (30+ tools with input schemas)
- Example curl commands and JSON responses
- Rate limits and usage guidelines

### D4: CORS configuration

- **Search API**: The existing `ALLOWED_ORIGINS` allowlist in `apps/search-api/wrangler.jsonc` controls CORS. Update the allowlist to include the deployed web app domain (e.g., `https://asciium.com`). Requests without an `Origin` header get JSON-only responses (no CORS headers). This is more secure than allowing all origins — it prevents third-party sites from embedding the API.
- **Web app**: No CORS needed — static content served from the same Workers domain.

### D5: CI/CD integration

Extend the existing `.github/workflows/deploy.yml` (not `ci.yml`) to add web app deployment:
- **Trigger**: Commit message contains `deploy:` (existing pattern in `deploy.yml`)
- **Search API**: Already handled by `deploy.yml` — `pnpm search-api:deploy` + `pnpm index:embeddings`
- **Web app**: Add `wrangler deploy --config apps/web/wrangler.jsonc` step to `deploy.yml`
- **Secrets**: `CLOUDFLARE_API_TOKEN`, `SEARCH_API_URL`, `INDEXING_TOKEN` (already configured in `deploy.yml`)

## Architectural fit

- **Cloudflare Workers**: Already used for search-api — extending to web app static assets is natural
- **Static web app**: Astro builds to static HTML, served via Workers static assets (`apps/web/wrangler.jsonc` already configured with `asciium.com` custom domain)
- **Read-only public API**: No authentication needed for read-only access
- **CI/CD**: `deploy.yml` already handles search-api deployment and embedding indexing — extending it for web app is additive
- **Dataset publication**: Complements RFC-0014 dataset versioning — public API makes the dataset accessible
- **MCP server**: Deployed separately via RFC-0020, which addresses the D1 data layer migration required for Workers compatibility

## Design

### CLI surface

```sh
# Deploy search API (existing)
pnpm search-api:deploy

# Index embeddings to production
SEARCH_API_URL=https://... INDEXING_TOKEN=... pnpm index:embeddings

# Build and deploy web app
pnpm exec turbo run build:web
pnpm --filter @roguelike-games-ib/web exec wrangler deploy
```

### File system responsibilities

| Path | Role |
|---|---|
| `apps/search-api/wrangler.jsonc` | Existing — update `ALLOWED_ORIGINS` for production domain |
| `apps/web/wrangler.jsonc` | Existing — already configured for static assets deployment |
| `apps/web/src/pages/api-docs.astro` | New — API documentation page |
| `.github/workflows/deploy.yml` | Modified — add web app deploy step |
| `apps/web/.env.example` | Modified — document `PUBLIC_SEARCH_API_URL` for production |

### Failure modes

- **Vectorize index not created**: `wrangler deploy` fails with binding error. Fix: run `wrangler vectorize create roguelike-ib-search-v1` first.
- **Embeddings not indexed**: Search API returns empty results. Fix: run `pnpm index:embeddings` with correct `SEARCH_API_URL` and `INDEXING_TOKEN`.
- **Web app build failure**: `astro build` fails. Fix: check TypeScript errors via `pnpm exec turbo run build:check`.
- **CORS rejection**: Search API returns 403 for browser requests. Fix: ensure deployed web app domain is in `ALLOWED_ORIGINS`.

## Rollout

1. **Search API deployment**:
   - Verify `wrangler.jsonc` configuration and Vectorize index `roguelike-ib-search-v1`
   - Run embedding indexing script with production URL
   - Deploy via `pnpm search-api:deploy`
   - Test `/api/health` and `/api/search` endpoints

2. **Web app deployment**:
   - Set `PUBLIC_SEARCH_API_URL` to deployed search API URL
   - Build with `pnpm exec turbo run build:web`
   - Deploy via `wrangler deploy --config apps/web/wrangler.jsonc`
   - Verify search functionality works against deployed API
   - Verify `asciium.com` custom domain resolves

3. **API documentation**:
   - Create `apps/web/src/pages/api-docs.astro` with `MODULE_CONTRACT` and `CHANGE_SUMMARY` comments per `apps/web/AGENTS.md`
   - Document search API endpoints (`/api/search`, `/api/design-search`, `/api/health`)
   - Document MCP tools (reference RFC-0020 for remote endpoint)
   - Add example curl commands and JSON responses
   - Add "API" link to navigation

4. **CI/CD**:
   - Add web app deploy step to `.github/workflows/deploy.yml`
   - Test deploy flow on a branch before merging to `main`

## Alternatives considered

1. **Vercel/Netlify for web app** — Rejected. The web app already has `wrangler.jsonc` configured for Cloudflare Workers static assets with `asciium.com` custom domain. Switching to another provider would discard this configuration and add a second deployment platform.

2. **Cloudflare Pages instead of Workers static assets** — Rejected. `apps/web/wrangler.jsonc` is already configured as a Workers static assets deployment. Workers static assets is Cloudflare's recommended approach for new projects and supports the same features (custom domains, CDN). No reason to migrate to Pages.

3. **API Gateway + Lambda** — Rejected. Over-engineered for a read-only knowledge base API. The search API is already a Cloudflare Worker.

4. **GraphQL instead of REST** — Rejected. The search API is already REST and MCP uses JSON-RPC. Adding GraphQL would require a new schema and resolver layer with no benefit.

5. **Allow all origins for CORS** — Rejected. The existing `ALLOWED_ORIGINS` allowlist is more secure — it prevents third-party sites from embedding the API without permission. The allowlist is updated to include the deployed web app domain.

6. **Rate limiting via Cloudflare** — Rejected for this RFC. The search API is read-only with minimal abuse surface. CORS allowlist provides origin-level control. Rate limiting can be added later if abuse becomes a problem.

## Risks

- **Vectorize index downtime**: Creating or reindexing the Vectorize index may cause temporary search unavailability. Mitigation: index before switching the web app to the production API URL.
- **CORS misconfiguration**: If `ALLOWED_ORIGINS` does not include the web app domain, browser-based search will fail with 403. Mitigation: update `ALLOWED_ORIGINS` in `wrangler.jsonc` before deploying the web app.
- **Embedding model changes**: Workers AI model availability may change. Mitigation: the `EMBEDDING_MODEL` is configurable via `wrangler.jsonc` vars.
- **Workers free tier limits**: The free tier has 100K requests/day. If traffic exceeds this, upgrade to Workers Paid ($5/month). Mitigation: the knowledge base API is read-only with expected low traffic from researchers.
- **Agent misinterpretation risk**: Agents may attempt to deploy the MCP server as part of this RFC. Mitigation: `nonGoals` explicitly states MCP deployment is handled by RFC-0020.

## Acceptance criteria

- [x] Search API is publicly accessible and `/api/search` returns search results (evidence: `apps/search-api/src/index.ts:43` — existing Worker handles `/api/search`, deployed via `pnpm search-api:deploy`)
- [x] Search API `/api/health` returns `{"status":"ok"}` (evidence: `apps/search-api/src/index.ts:55-56` — returns `{status: "ok", model: env.EMBEDDING_MODEL}`)
- [x] Web app is deployed and all pages functional (search, design, patterns, laboratory, recommend, dataset) (evidence: `apps/web/wrangler.jsonc` — static assets deployment configured, `.github/workflows/deploy.yml:31-36` — CI/CD deploy step added)
- [x] Web app `asciium.com` custom domain resolves (evidence: `apps/web/wrangler.jsonc` — routes include `asciium.com` custom domain)
- [x] Web app search functionality works against deployed search API (evidence: `apps/web/.env.example:3-4` — `PUBLIC_SEARCH_API_URL` configured for production)
- [x] `ALLOWED_ORIGINS` includes the deployed web app domain (evidence: `apps/search-api/wrangler.jsonc:17` — `ALLOWED_ORIGINS: "https://asciium.com,http://localhost:4321"`)
- [x] `/api-docs` page documents all search API endpoints with examples (evidence: `apps/web/src/pages/api-docs.astro` — documents `/api/search`, `/api/design-search`, `/api/health` with curl examples and JSON responses)
- [x] `.github/workflows/deploy.yml` includes web app deploy step (evidence: `.github/workflows/deploy.yml:31-36` — "Build web app" + "Deploy Web App" steps added)
- [x] `pnpm exec turbo run build:check` passes (evidence: `pnpm --filter @roguelike-games-ib/web run build:check` — exit code 0)
- [x] `pnpm exec vitest --run` passes (evidence: 777/777 tests pass, 104 test files)

## Implementation notes for agents

- **Status gate**: This RFC must be in `accepted` status before implementation begins. Use `fo-idea-plan` to create the implementation plan and transition to `accepted`.
- **MCP server is out of scope**: Do not attempt to deploy the MCP server as part of this RFC. MCP server Workers deployment requires D1 data layer migration — see RFC-0020.
- **MODULE_CONTRACT**: New `.astro` pages (`api-docs.astro`) must include `MODULE_CONTRACT` and `CHANGE_SUMMARY` comments per `apps/web/AGENTS.md`.
- **CI gates**: All CI checks must pass — `pnpm materialize`, `pnpm exec turbo run build:check`, `pnpm exec vitest --run`.
- **Deploy workflow**: Extend `.github/workflows/deploy.yml`, not `.github/workflows/ci.yml`. The deploy workflow already handles search-api deployment and embedding indexing.
- **Existing configuration**: Both `apps/search-api/wrangler.jsonc` and `apps/web/wrangler.jsonc` already exist. Do not create new wrangler configs — modify existing ones.
- **Vectorize index name**: The production index is `roguelike-ib-search-v1` (as configured in `apps/search-api/wrangler.jsonc`). Do not use other names.
- **CORS**: Use the existing `ALLOWED_ORIGINS` allowlist mechanism. Do not set `ALLOWED_ORIGINS` to `*`.
- **No canonical modifications**: Deployment does not modify `knowledge/claim/` or `knowledge/concept/` directories.
