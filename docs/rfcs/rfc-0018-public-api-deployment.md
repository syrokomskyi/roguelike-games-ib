---
id: RFC-0018
title: "Public API and deployment — Cloudflare Workers for search-api and MCP server"
status: draft
kind: architecture
scope: workspace
owners:
  - architecture
reviewers:
  - human:andrii-syrokomskyi
createdAt: 2026-08-24
updatedAt: 2026-08-24
closedAt:
supersedes: []
supersededBy:
amends: []
amendedBy:
related:
  - RFC-0007
  - RFC-0010
  - RFC-0014
satisfies: []
versionBump: minor
commands:
  proposed: []
  added: []
  changed: []
  removed: []
appsImpacted:
  - search-api
  - mcp
  - web
packagesImpacted: []
successSignals:
  - search-api deployed to Cloudflare Workers and accessible via public URL
  - MCP server deployed as Cloudflare Workers AI tool with stdio bridge
  - Web app deployed to Cloudflare Pages with search and dataset pages functional
  - API documentation page at /api-docs describes available endpoints
  - Rate limiting and CORS configured for public access
nonGoals:
  - Does not require authentication for read-only API access
  - Does not deploy the full knowledge base to Workers — only the search index and API layer
  - Does not implement write endpoints — all public endpoints are read-only
---

# RFC-0018: Public API and deployment — Cloudflare Workers for search-api and MCP server

## Context

The project has a search API (`apps/search-api`) and MCP server (`apps/mcp`) that run locally. The web app (`apps/web`) builds to static HTML. To make the inspiration base accessible to researchers, game designers, and other tools, we need to deploy these services publicly.

Cloudflare Workers is already configured for the search-api (wrangler.toml exists). The web app can deploy to Cloudflare Pages. The MCP server can deploy as a Workers-based MCP server.

## Problem

1. **No public access** — the knowledge base is only accessible locally or via GitHub repository
2. **Search API is local-only** — the vector search endpoint cannot be queried by external tools
3. **MCP tools are local-only** — AI assistants cannot query the knowledge base without local setup
4. **No API documentation** — there is no public page describing available API endpoints
5. **Web app is not deployed** — the Astro site only runs locally

## Decision

### D1: Deploy search-api to Cloudflare Workers

The search-api already has:
- `wrangler.jsonc` configuration
- Vectorize index binding (`VECTOR_INDEX`)
- Workers AI embedding model binding
- CORS headers

Deployment steps:
1. Create production Vectorize index: `roguelike-games-ib-vectors`
2. Run `scripts/index-embeddings.ts` to populate the index
3. Deploy via `wrangler deploy`
4. Configure custom domain or Workers subdomain

### D2: Deploy web app to Cloudflare Pages

The web app is an Astro static site. Deploy via:
1. Build with `pnpm exec turbo run build` (produces `dist/`)
2. Deploy `apps/web/dist/` to Cloudflare Pages
3. Set environment variables for search API URL
4. Configure custom domain

### D3: Deploy MCP server as Cloudflare Workers MCP endpoint

Convert the MCP server to a Workers-compatible MCP endpoint:
1. Create `apps/mcp/src/worker.ts` — Workers entry point that creates an MCP server using `@modelcontextprotocol/sdk`
2. Use Durable Objects for session state (if needed)
3. Deploy via `wrangler deploy`
4. Expose MCP endpoint at `https://mcp.roguelike-games-ib.workers.dev/sse`

### D4: API documentation page

New web page `/api-docs` documenting:
- Search API endpoints (`/search`, `/health`)
- MCP tools list (30+ tools with input schemas)
- Example curl commands and JSON responses
- Rate limits and usage guidelines

### D5: Rate limiting and CORS

- **Search API**: 100 requests/minute per IP (Cloudflare built-in rate limiting)
- **MCP**: 50 requests/minute per IP
- **CORS**: Allow all origins for read-only endpoints
- **Web app**: No rate limiting (static content)

### D6: CI/CD integration

Update `.github/workflows/ci.yml` to add deploy jobs:
- **Trigger**: Commit message contains `deploy:` (existing pattern)
- **Search API**: `wrangler deploy --config apps/search-api/wrangler.jsonc`
- **Web app**: `wrangler pages deploy apps/web/dist`
- **MCP**: `wrangler deploy --config apps/mcp/wrangler.jsonc`
- **Secrets**: `CLOUDFLARE_API_TOKEN`, `SEARCH_API_URL`, `INDEXING_TOKEN` (already configured)

## Architectural fit

- **Cloudflare Workers**: Already used for search-api — extending to MCP is natural
- **Static web app**: Astro builds to static HTML, perfect for Cloudflare Pages
- **Read-only public API**: No authentication needed for read-only access
- **CI/CD**: Follows existing `deploy:` commit message trigger pattern
- **Dataset publication**: Complements RFC-0014 dataset versioning — public API makes the dataset accessible

## Rollout

1. **Search API deployment**:
   - Verify `wrangler.jsonc` configuration
   - Create production Vectorize index
   - Run embedding indexing script
   - Deploy and test public endpoint

2. **Web app deployment**:
   - Set `SEARCH_API_URL` environment variable to deployed search API URL
   - Build and deploy to Cloudflare Pages
   - Verify search functionality works against deployed API

3. **MCP server deployment**:
   - Create `apps/mcp/src/worker.ts` Workers entry point
   - Add `wrangler.jsonc` for MCP app
   - Deploy and test MCP endpoint

4. **API documentation**:
   - Create `apps/web/src/pages/api-docs.astro`
   - Document all endpoints with examples
   - Add "API" to navigation

5. **CI/CD**:
   - Add deploy jobs to `ci.yml`
   - Test deploy flow on a branch

## Alternatives

- **Vercel/Netlify for web app** — Cloudflare Pages is simpler and already in the Cloudflare ecosystem
- **Railway/Render for MCP** — Cloudflare Workers is cheaper (free tier) and already configured
- **API Gateway + Lambda** — over-engineered for a read-only knowledge base API
- **GraphQL instead of REST** — unnecessary; the search API is already REST and MCP uses JSON-RPC

## Acceptance criteria

- [ ] Search API is publicly accessible and returns search results
- [ ] Web app is deployed and all pages functional (search, design, patterns, laboratory, recommend)
- [ ] MCP endpoint is accessible and responds to tool calls
- [ ] `/api-docs` page documents all endpoints
- [ ] Rate limiting is configured
- [ ] CI/CD deploy jobs work with `deploy:` commit message
