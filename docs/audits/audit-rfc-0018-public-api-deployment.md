---
rfcId: RFC-0018
auditId: AUDIT-RFC-0018-01
date: 2026-08-24
auditor:
  skill: fo-idea-audit
  model: claude-sonnet-4-20250514
verdict: needs-revision
---

# Audit: RFC-0018

## Verdict: Needs revision

RFC-0018 proposes deploying three services to Cloudflare, but contains a critical architectural blind spot: the MCP server uses `better-sqlite3` (native Node.js addon) and `node:path` — both incompatible with Cloudflare Workers runtime. The RFC does not address this incompatibility at all. Additionally, the RFC has 4 missing required sections (V-13) and a V-24 error (architecture RFC without DNA invariant). Several claims about existing infrastructure are factually incorrect.

## Mechanical validation (rfc.validate)

**Fail** — 5 violations:

- **V-13** (warning): Missing required section `## Design`
- **V-13** (warning): Missing required section `## Alternatives considered` (the RFC has `## Alternatives` — wrong heading)
- **V-13** (warning): Missing required section `## Risks`
- **V-13** (warning): Missing required section `## Implementation notes for agents`
- **V-24** (error): architecture RFC created 2026-08-24 (>= 2026-07-07) must declare at least one DNA invariant in `satisfies`

## Axis A — Structural completeness

- **Missing sections**: `## Design`, `## Alternatives considered`, `## Risks`, `## Implementation notes for agents` — all required by V-13.
- **Decision** is a task list (D1–D6) describing deployment steps, not a single architectural decision in present tense. Each sub-section reads as a rollout checklist rather than a design contract.
- **No TypeScript contracts**: The RFC proposes `apps/mcp/src/worker.ts` but provides no type signatures or interface definitions.
- **No file system responsibilities table**: The RFC mentions files inline but does not provide a structured table of concrete paths.
- **No failure modes**: No discussion of deploy failures, rollback, or error behavior.
- **Rollout** describes implementation steps but does not address default behavior or adoption path for existing infrastructure.
- **Acceptance criteria** are checkable but insufficient — no criterion for CORS configuration specifically (D5 mentions CORS but acceptance criteria only say "Rate limiting is configured"), no criterion for embedding index population, no criterion for web app environment variable configuration.
- **`## Alternatives`** heading should be `## Alternatives considered` per V-13.

## Axis B — DNA alignment

- **`satisfies: []`** — V-24 error. RFC-0007 (also `kind: architecture`) declares `satisfies: [DNA-1]`. The project has `invariantsFile: null` in `forge.yaml`, but the V-24 rule still requires at least one entry. The RFC must either declare a DNA invariant or change `kind` to `policy` (as RFC-0010, RFC-0014 do).
- `related: [RFC-0007, RFC-0010, RFC-0014]` — all relevant. RFC-0007 established CI/CD infrastructure, RFC-0010 built the search API, RFC-0014 added dataset versioning. The relationship is genuine, not decorative.

## Axis C — Ecosystem fit

- **"wrangler.toml exists"** (line 52) — factually incorrect. The actual file is `apps/search-api/wrangler.jsonc`. The RFC should reference the correct filename.
- **"Cloudflare Pages" for web app** (D2, line 78) — the web app already has `apps/web/wrangler.jsonc` configured as a Cloudflare Workers static assets deployment (not Pages). The RFC proposes Pages but the existing infrastructure uses Workers with `assets.directory`. The RFC should acknowledge the existing Workers config.
- **Deploy workflow** — the RFC says "Update `.github/workflows/ci.yml`" (D6, line 111) but the actual deploy workflow is `.github/workflows/deploy.yml`, which already handles search-api deployment and embedding indexing. The RFC should reference `deploy.yml`, not `ci.yml`.
- **MCP `wrangler.jsonc`** — the RFC says "Add `wrangler.jsonc` for MCP app" (Rollout step 3) but no `wrangler.jsonc` exists in `apps/mcp/`. The RFC should acknowledge this is a new file creation.
- **`@modelcontextprotocol/sdk`** — the RFC proposes using this package (D3, line 89) but it is not listed in `apps/mcp/package.json` dependencies. The RFC should note the dependency addition.
- **Package boundaries**: No violations — all proposed changes are within `apps/`.
- **AGENTS.md updates**: The RFC does not identify which `AGENTS.md` files need updates. `apps/search-api/AGENTS.md` already documents deployment. `apps/mcp/` has no `AGENTS.md` — one should be created if the MCP server gains a Workers entry point.

## Axis D — Forward-only compliance

- No backward compatibility layers, shims, or dual-paths proposed. All deployment is new infrastructure.
- No legacy code paths to remove.
- No issues.

## Axis E — Agent-facing policy

- **No self-authorizing language** — the RFC does not grant implementation permission while in draft.
- **No `## Implementation notes for agents`** section (V-13) — agents have no behavioral rules for this RFC.
- **No NEEDS CLARIFICATION markers** found.
- **Storage policy**: The MCP server uses `better-sqlite3` (native SQLite via `node:sqlite`/`better-sqlite3`) and `openProjection(distDir)` which reads from the filesystem. This is fundamentally incompatible with Cloudflare Workers, which have no filesystem access. The RFC does not address this at all — no mention of D1 storage, KV, R2, or any alternative data source for the Workers-based MCP server.

## Axis F — Pragmatism

- **Durable Objects "if needed"** (D3, line 90) — vague. The RFC should either justify Durable Objects or drop them. The MCP server is currently stateless (creates context per invocation from filesystem data), so Durable Objects may be unnecessary.
- **Rate limiting values** (D5) — 100 req/min for search API, 50 req/min for MCP. These values are stated without justification. The RFC should explain why these limits are appropriate.
- **CORS "allow all origins"** (D5, line 106) — contradicts the existing search-api implementation which uses an `ALLOWED_ORIGINS` allowlist (`apps/search-api/wrangler.jsonc` line 17: `https://asciium.com,http://localhost:4321`). The RFC should reconcile this with the existing approach.
- **Scope discipline**: `appsImpacted: [search-api, mcp, web]` is correct. `packagesImpacted: []` is correct — no package changes needed for deployment.

## Axis G — Blind spots

- **Critical: MCP server Workers incompatibility** — The MCP server (`apps/mcp/src/context.ts`) uses:
  - `better-sqlite3` (native C++ addon) — not available in Workers runtime
  - `node:path` (Node.js built-in) — not available in Workers runtime
  - `openProjection(distDir)` — opens a SQLite database from the filesystem, which doesn't exist on Workers
  - `buildSearchIndex({ dbPath })` — also depends on filesystem SQLite

  The RFC proposes "Create `apps/mcp/src/worker.ts`" but does not address how the MCP server will access projection data on Workers. This is the single biggest gap in the RFC. Options include: (a) using D1 (Cloudflare's SQLite), (b) using R2 to store and serve the projection data, (c) using Workers KV with pre-materialized data, or (d) making the MCP server call the search API instead of using a local index. The RFC must choose one and document the architecture.

- **Vectorize index name mismatch** — the RFC says "Create production Vectorize index: `roguelike-games-ib-vectors`" (D1, line 73) but the existing `wrangler.jsonc` uses `roguelike-ib-search-v1` (line 12). The RFC should use the existing index name or explain the rename.

- **Web app custom domain** — `apps/web/wrangler.jsonc` already configures `routes` with `asciium.com` as a custom domain. The RFC says "Configure custom domain" (D2, line 84) but doesn't acknowledge the existing configuration.

- **Workers CPU/memory limits** — no discussion of Workers execution limits (CPU time, memory) for the MCP server, which currently loads a full SQLite database into memory.

- **Embedding indexing in CI** — `deploy.yml` already runs `pnpm index:embeddings` after deploy. The RFC doesn't mention this existing step or how it fits with the proposed CI/CD changes.

- **Security** — the RFC says "Allow all origins for read-only endpoints" but the existing implementation uses an allowlist. Opening CORS to all origins for a public API has abuse implications (scraping, excessive usage). The RFC should address this.

## Questions for the author

1. How will the MCP server access projection data on Cloudflare Workers? The current architecture uses `better-sqlite3` and filesystem access — both unavailable in Workers runtime. What alternative data source will be used (D1, R2, KV, or API calls to the search-api)?

2. Why does the RFC propose Cloudflare Pages for the web app when `apps/web/wrangler.jsonc` is already configured as a Cloudflare Workers static assets deployment? Should the RFC align with the existing Workers config instead?

3. The RFC says to update `ci.yml` with deploy jobs, but `.github/workflows/deploy.yml` already exists and handles search-api deployment. Should the RFC propose extending `deploy.yml` instead of duplicating deploy logic in `ci.yml`?

4. What is the relationship between the proposed Vectorize index name `roguelike-games-ib-vectors` and the existing `roguelike-ib-search-v1` in `wrangler.jsonc`? Is this a rename or a new index?

5. Why does the RFC propose "allow all origins" for CORS when the existing search-api uses an `ALLOWED_ORIGINS` allowlist? What is the security rationale for opening public access?
