---
id: PLAN-RFC-0018
title: Public API and deployment — Cloudflare Workers for search-api and web app
status: accepted
scope: project-wide
decider: architecture
reviewers:
  - human:andrii-syrokomskyi
related:
  - RFC-0018
created: 2026-08-24
accepted: 2026-08-24
implementedAt:
closedAt: null
---

# PLAN-RFC-0018: Public API and deployment — Cloudflare Workers for search-api and web app

## Context

RFC-0018 defines the public deployment of the search API and web app to Cloudflare Workers. The search API already has `wrangler.jsonc` with Vectorize and Workers AI bindings. The web app already has `wrangler.jsonc` configured for static assets with `asciium.com` custom domain. The deploy workflow (`.github/workflows/deploy.yml`) already handles search-api deployment and embedding indexing.

The MCP server is explicitly out of scope — it is handled by RFC-0020 (D1 data layer migration).

## Steps

### Step 1: Update `ALLOWED_ORIGINS` in search-api wrangler.jsonc

Update `apps/search-api/wrangler.jsonc` `ALLOWED_ORIGINS` to include the production web app domain `https://asciium.com` (already present) and verify it's correct.

**Files**: `apps/search-api/wrangler.jsonc`

**Completion criterion**: `ALLOWED_ORIGINS` in `wrangler.jsonc` includes `https://asciium.com`.

### Step 2: Create API documentation page

Create `apps/web/src/pages/api-docs.astro` with `MODULE_CONTRACT` and `CHANGE_SUMMARY` comments per `apps/web/AGENTS.md`.

The page documents:
- Search API endpoints: `GET /api/search`, `GET /api/design-search`, `GET /api/health`
- Query parameters: `q`, `source`, `type`, `kind`, `concept_type`, `limit`
- Example curl commands and JSON response shapes
- CORS policy (origin allowlist)
- MCP tools overview (reference RFC-0020 for remote endpoint)
- Usage guidelines

The page uses `Base.astro` layout with `activeNav="api-docs"`. Static content — no data fetching needed.

**Files**: `apps/web/src/pages/api-docs.astro`

**Completion criterion**: `api-docs.astro` exists with `MODULE_CONTRACT`/`CHANGE_SUMMARY`, renders with Base layout, documents all search API endpoints with examples.

### Step 3: Add "API" to navigation

Add a nav item to `apps/web/src/layouts/Base.astro` `navItems` array:

```js
{ href: "/api-docs", label: "API", key: "api-docs" },
```

Add it after "Recommend" and before the GitHub icon.

**Files**: `apps/web/src/layouts/Base.astro`

**Completion criterion**: "API" nav link appears in the navigation bar, links to `/api-docs`.

### Step 4: Update `.env.example` for production

Update `apps/web/.env.example` to document the production `PUBLIC_SEARCH_API_URL`:

```
PUBLIC_SEARCH_API_URL=https://roguelike-ib-search-api.<account>.workers.dev
```

Already present — verify it's accurate and add a comment about production usage.

**Files**: `apps/web/.env.example`

**Completion criterion**: `.env.example` documents `PUBLIC_SEARCH_API_URL` with production URL pattern.

### Step 5: Add web app deploy step to deploy.yml

Add a "Deploy Web App" step to `.github/workflows/deploy.yml` after the existing "Index embeddings" step:

```yaml
- name: Build web app
  run: pnpm exec turbo run build:web
- name: Deploy Web App
  run: pnpm --filter @roguelike-games-ib/web exec wrangler deploy
  env:
    CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

**Files**: `.github/workflows/deploy.yml`

**Completion criterion**: `deploy.yml` includes web app build and deploy steps triggered by `deploy:` commit message.

### Step 6: Update CHANGE_SUMMARY in Base.astro

Add a `CHANGE_SUMMARY` entry to `apps/web/src/layouts/Base.astro`:

```html
<item>RFC-0018: Added "API" nav item linking to /api-docs.</item>
```

**Files**: `apps/web/src/layouts/Base.astro`

**Completion criterion**: `CHANGE_SUMMARY` in `Base.astro` includes RFC-0018 entry.

### Step 7: TypeScript build check and tests

Run:
```sh
pnpm exec turbo run build:check
pnpm exec vitest --run
```

Fix any errors.

**Completion criterion**: `build:check` and `vitest --run` pass with zero errors.

### Step 8: Review and fix

Run `fo-review` on all session code changes. Apply `fo-fix` if the review has findings.

**Completion criterion**: Review report exists in `docs/reviews/code/` and any findings are fixed.

### Step 9: Stamp implemented

Run:
```sh
pnpm exec forge rfc.implement.stamp --id RFC-0018 --implementation-commit <sha>
```

**Completion criterion**: RFC-0018 status transitions to `implemented`.

## Acceptance criteria mapping

| Criterion | Step |
|---|---|
| Search API publicly accessible and `/api/search` returns results | Pre-existing (search-api already deployed) |
| Search API `/api/health` returns `{"status":"ok"}` | Pre-existing |
| Web app deployed and all pages functional | Step 5 (CI/CD) + manual deploy |
| Web app `asciium.com` custom domain resolves | Pre-existing (wrangler.jsonc routes) |
| Web app search works against deployed API | Pre-existing (PUBLIC_SEARCH_API_URL) |
| `ALLOWED_ORIGINS` includes web app domain | Step 1 |
| `/api-docs` page documents all endpoints | Step 2 |
| `deploy.yml` includes web app deploy step | Step 5 |
| `build:check` passes | Step 7 |
| `vitest --run` passes | Step 7 |

## Notes

- The search API is already deployed via the existing `pnpm search-api:deploy` script and `deploy.yml`. This plan does not re-deploy the search API.
- The web app `wrangler.jsonc` already has `asciium.com` custom domain configured. No changes needed to the wrangler config.
- MCP server deployment is out of scope — see RFC-0020.
- No `AGENTS.md` updates needed — `apps/search-api/AGENTS.md` already documents deployment, and no new AGENTS.md rules are introduced by this RFC.
