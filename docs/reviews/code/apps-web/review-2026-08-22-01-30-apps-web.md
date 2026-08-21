---
reviewId: REVIEW-CODE-2026-08-22-01
date: 2026-08-22
reviewer:
  skill: fo-review
  model: unknown
verdict: needs-revision
diffRange: cfa33e3a2...HEAD
filesReviewed:
  - apps/search-api/src/index.ts
  - apps/search-api/src/types.ts
  - apps/search-api/wrangler.jsonc
  - apps/search-api/package.json
  - apps/search-api/tsconfig.json
  - apps/web/src/pages/index.astro
  - apps/web/src/pages/search.astro
  - apps/web/src/pages/games/index.astro
  - apps/web/src/pages/404.astro
  - apps/web/src/pages/compare/[...filter].astro
  - apps/web/src/pages/games/[sourceId]/[...filter].astro
  - apps/web/src/pages/games/[sourceId]/mechanics.astro
  - apps/web/src/pages/games/[sourceId]/systems.astro
  - apps/web/src/pages/games/[sourceId]/definitions/[kind].astro
  - apps/web/src/pages/design.astro
  - apps/web/src/pages/dataset.astro
  - apps/web/src/pages/about/method.astro
  - apps/web/src/layouts/Base.astro
  - apps/web/src/components/CompareTable.astro
  - apps/web/src/components/RecordHeader.astro
  - apps/web/src/components/EvidenceList.astro
  - apps/web/src/styles/global.css
  - scripts/index-embeddings.ts
  - pnpm-workspace.yaml
  - package.json
  - apps/web/.env.example
---

# Code Review: cfa33e3a2...HEAD (13 commits, 29 files)

## Verdict: Needs revision

The diff introduces a new `search-api` Cloudflare Worker, a redesigned homepage, client-side semantic search, and site-wide visual polish. The web app passes `astro check` cleanly, but the `search-api` package has 3 TypeScript compilation errors that block `build:check`. Several structural and pragmatic issues also need attention.

## Mechanical floor

**Fail** — `@roguelike-games-ib/search-api` `tsc --noEmit` produces 3 errors:

1. `src/index.ts:78` — `TS2352`: `Conversion of type 'Record<string, VectorizeVectorMetadata>' to type 'VectorMetadata' may be a mistake`. The cast `(match.metadata ?? {}) as VectorMetadata` is unsafe because `VectorizeVector.metadata` is `Record<string, VectorizeVectorMetadata>`, not `VectorMetadata`.
2. `src/index.ts:131` — Same TS2352 on the identical cast in `handleDesignSearch`.
3. `src/index.ts:193` — `TS2345`: `VectorMetadata` is not assignable to `Record<string, VectorizeVectorMetadata>` (missing index signature). The `upsert` call fails because `metadata` is typed as `VectorMetadata` but `VectorizeVector` expects `Record<string, VectorizeVectorMetadata>`.

**Pass** — `@roguelike-games-ib/web` `astro check`: 0 errors, 0 warnings, 0 hints.

## Axis A — Structural correctness

1. **Fail — Strict typing**: `apps/search-api/src/index.ts:78,131` — `(match.metadata ?? {}) as VectorMetadata` is an unsafe cast. `VectorizeVector.metadata` is `Record<string, VectorizeVectorMetadata>` (values are `string | number | boolean | null`), not `VectorMetadata`. The cast silences the compiler but the runtime shape may not match. Fix: add an index signature to `VectorMetadata` or use `as unknown as VectorMetadata`, or better — parse metadata fields individually with runtime guards.

2. **Fail — Strict typing**: `apps/search-api/src/index.ts:193` — `vectors` array has `metadata: VectorMetadata` but `VectorizeVector.metadata` expects `Record<string, VectorizeVectorMetadata>`. `VectorMetadata` has named string/array fields but no index signature. Fix: add `[key: string]: string | string[] | undefined` to `VectorMetadata`, or cast metadata to `Record<string, VectorizeVectorMetadata>` at the upsert site.

3. **Fail — Error handling**: `apps/web/src/pages/search.astro:77-81` — `.catch` handler sets `status.innerHTML` with `err.message` interpolated directly into HTML. Although `escapeHtml` is defined, it is not applied to `err.message`. An error message containing HTML tags from a malicious or malformed API response would be injected into the DOM. Fix: `escapeHtml(err.message)`.

4. **Fail — Dead code / unused**: `apps/search-api/src/types.ts:79-81` — `Env.EMBEDDING_MODEL`, `Env.EMBEDDING_DIMENSIONS`, and `Env.CORS_ORIGIN` are declared as required string fields, but `EMBEDDING_MODEL` is never read from `env` (the constant `EMBEDDING_MODEL` at `index.ts:13` is used instead). `EMBEDDING_DIMENSIONS` is never read anywhere. `CORS_ORIGIN` is used at `index.ts:228` with `env.CORS_ORIGIN || "*"` fallback, but it's declared as `string` (required) not `string | undefined`.

5. **Fail — Duplicated code**: `scripts/index-embeddings.ts:24-34` defines `IndexRecord` interface that duplicates `apps/search-api/src/types.ts:59-69` `IndexRecord`. Same fields, same name, two locations. If one changes, the other silently drifts. Fix: import from `@roguelike-games-ib/search-api` or extract to a shared types package.

6. **Fail — Magic number**: `apps/search-api/src/index.ts:14` — `BATCH_SIZE = 100` is defined, but `apps/web/src/pages/search.astro:138` — `hits.slice(0, 25)` uses a hardcoded `25` for the client-side display limit. Should be a named constant.

7. **Pass — Fowler code smells**: No significant code smells in the web app changes. The homepage is long but consists of declarative static sections, not complex logic.

## Axis B — DNA alignment

No invariants file (`forge.yaml` binding `invariantsFile: null`) — invariant alignment skipped.

## Axis C — Ecosystem fit

1. **Pass — Package boundaries**: `apps/search-api` imports only from `./types.ts` (local). `apps/web` imports from `../lib/context`, `../lib/page-data`, `../components/*` — all local. No cross-app imports. `scripts/index-embeddings.ts` is standalone (no imports from packages). Boundary discipline maintained.

2. **Pass — Workspace registration**: `apps/search-api` is correctly placed under `apps/` and auto-discovered via `apps/*` glob in `pnpm-workspace.yaml`. No workspace entry needed.

3. **Fail — AGENTS.md update**: The new `apps/search-api` app introduces a Cloudflare Worker with Vectorize binding. `AGENTS.md` documents only the extractor package location convention. No `apps/AGENTS.md` or `apps/search-api/AGENTS.md` exists to document the new app's purpose, deployment, or env requirements. An agent encountering this app has no guidance.

4. **Pass — Command lifecycle**: New root scripts `index:embeddings`, `search-api:dev`, `search-api:deploy` are registered in root `package.json` with clear names.

## Axis D — Forward-only compliance

1. **Pass — No compatibility shims**: The search page (`search.astro`) was rewritten from server-side rendering to client-side fetch. The old `createWebContext`/`SearchHit`/`SearchFilters` imports and server-side search logic were fully removed — no dual-path or legacy fallback.

2. **Pass — Direct contract change**: `prerender` changed from `false` to `true` on `search.astro`, making it a static page that fetches from the API at runtime. This is a clean architecture change, not a bridge.

## Axis E — Agent-facing clarity

1. **Fail — Compass scaffolding**: `apps/search-api/src/index.ts` and `apps/search-api/src/types.ts` have no `MODULE_CONTRACT` or `CHANGE_SUMMARY` headers. `scripts/index-embeddings.ts` also lacks them. These are non-trivial new source files.

2. **Pass — No ungrounded assertions**: Code comments and inline references point to real APIs (`VectorizeIndex`, `Ai`). No invented functions or phantom parameters.

3. **Pass — Readable names**: Function names (`handleSearch`, `handleDesignSearch`, `handleIndex`, `embedTexts`, `buildEmbeddingText`) clearly describe their purpose. Variable names are meaningful.

4. **Pass — Anti-fabrication**: The homepage content sections ("Verified knowledge" vs "Creative hypotheses") correctly distinguish between evidence-backed facts and generated hypotheses, aligned with the dataset's authority model.

## Axis F — Pragmatism

1. **Pass — Minimality ladder**: The search API uses Cloudflare Workers AI + Vectorize, which is the correct platform choice for embeddings. No unnecessary dependencies were added — `search-api/package.json` has zero runtime dependencies, only `@cloudflare/workers-types` and `wrangler` as devDependencies.

2. **Fail — Existing patterns**: `scripts/index-embeddings.ts:4` — `const WORKSPACE = "/home/syrokomskyi/projects/roguelike-games-ib"` is a hardcoded absolute path. Other scripts in the repo (`scripts/run-materialize.ts`, etc.) likely use `process.cwd()` or relative paths. This script will break for any other developer or CI environment.

3. **Pass — Scope discipline**: The visual polish changes (transition-colors, zebra striping, active nav, footer) are minimal and scoped to their purpose. The homepage redesign is a single-file change with no scope creep.

4. **Fail — Duplicated logic**: `apps/web/src/pages/index.astro:15-18` and `apps/web/src/pages/games/index.astro:13-17` both iterate `ctx.store.records` to build `recordsBySource` maps with identical logic. This pattern is also in `apps/web/src/lib/page-data.ts`. Could be extracted to a shared helper.

## Axis G — Blind spots

1. **Fail — Security**: `apps/search-api/src/index.ts:228` — `CORS_ORIGIN` defaults to `"*"` in `wrangler.jsonc:18` and in the fallback `env.CORS_ORIGIN || "*"`. The `/api/index` endpoint accepts POST with no authentication. Anyone can index arbitrary data into the Vectorize index. This is acceptable for development but must be documented as a pre-production hardening item.

2. **Fail — Edge cases**: `apps/web/src/pages/search.astro:65-67` — When `SEARCH_API` env is empty, the client fetches `/api/search?...` — a relative URL. In the static prerendered site, there is no `/api/search` endpoint. The fetch will 404. The fallback path needs either a Worker route binding or documentation that the web app must be deployed behind a proxy that routes `/api/*` to the search Worker.

3. **Pass — Performance**: The embedding indexing script batches at 100 records, which is reasonable for Cloudflare Workers AI. The search API limits to `topK: 50` (200 max), preventing abuse.

4. **Pass — Migration path**: The search page migration from SSR to client-side fetch is clean — no migration needed since the old SSR search is fully replaced.

## Spec compliance

No spec available — spec compliance skipped.

## Questions for the author

1. `apps/search-api/src/types.ts` — `VectorMetadata` needs an index signature (`[key: string]: string | string[] | undefined`) to be compatible with `VectorizeVector.metadata`. Was this tested against a real Vectorize index, or only type-checked?
2. `apps/web/src/pages/search.astro:65-67` — When `PUBLIC_SEARCH_API_URL` is unset, the client fetches `/api/search` which doesn't exist on the static site. How is this supposed to work in production without a proxy?
3. `scripts/index-embeddings.ts:4` — The hardcoded `WORKSPACE` path will break for any developer not named `syrokomskyi`. Should this use `process.cwd()` instead?
4. `apps/search-api/src/index.ts:36` — The `/api/index` POST endpoint has no authentication. Is this intended for production, or should there be a shared secret?
