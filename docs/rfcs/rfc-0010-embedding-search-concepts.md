---
id: RFC-0010
title: "Embedding search for concepts — semantic search over design space"
status: accepted
kind: policy
scope: workspace
owners:
  - architecture
reviewers:
  - human:andrii-syrokomskyi
createdAt: 2026-08-23
updatedAt: 2026-08-23
enhancedAt: 2026-08-23
implementedAt:
closedAt:
supersedes: []
supersededBy:
amends: []
amendedBy:
related:
  - RFC-0003
  - RFC-0004
  - RFC-0009
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
  - Concept records are indexed in the search API with embeddings
  - Semantic search returns relevant concepts for design queries
  - MCP search_design_space tool finds concepts by meaning, not just keywords
  - Web app /search supports concept_type filter
nonGoals:
  - Does not change the embedding model (Workers AI)
  - Does not reindex definition records — only adds concepts to the index
  - Does not add a separate vector store — uses existing search API infrastructure
---

# RFC-0010: Embedding search for concepts — semantic search over design space

## Context

The search API (`apps/search-api/`) indexes 22,476 records via Cloudflare Workers AI embeddings. The indexing script (`scripts/index-embeddings.ts`) already handles concept records — it extracts `concept_type`, `source_games`, `mutation_dimensions`, and `definition` as the embedding text.

However, the search API has no `concept_type` filter. A query like "risk-reward tension" returns definition records that mention those words, but does not return the design primitive "Risk-Reward Identification" or the pressure "Time Pressure" unless those exact words appear in the record text.

### Current search behavior

The search API exposes two endpoints:

- `GET /api/search?q=...&source=...&type=...&kind=...&limit=...` — semantic search across all records. The `type` parameter already filters by `record_type` (e.g., `type=concept` returns only concept hits). The response includes `mode: "semantic"` as a hardcoded field.
- `GET /api/design-search?q=...` — dedicated concept search. Hardcodes `filter: { record_type: "concept" }` in the Vectorize query and returns concept-specific fields (`concept_type`, `source_games`, `mutation_dimensions`).

The existing `type` parameter on `/api/search` already supports filtering by `record_type`. But there is no way to:
1. Filter by `concept_type` (e.g., only design primitives) within either endpoint
2. Search by design-space semantics from the MCP server ("which concepts involve resource scarcity?")
3. Filter concepts in the web app search UI

### Current index-embeddings.ts

The script (`scripts/index-embeddings.ts:56-79`) already maps concept fields to `IndexRecord`:
- `concept_type` → metadata
- `source_games` → metadata
- `mutation_dimensions` → metadata
- `definition` → used in `summary` (embedding text)

So concepts are **already indexed**. Additionally, `buildEmbeddingText()` in `apps/search-api/src/index.ts:282-294` already includes `concept_type` (as "concept: ..."), `source_games` (as "games: ..."), and `mutation_dimensions` (as "dimensions: ...") in the actual embedding text. The gap is in search-time `concept_type` filtering and MCP/web integration.

## Architectural fit

This RFC builds on the concept infrastructure established by RFC-0003 (design layer expansion — mutation vectors, knobs, counterplay, failure modes), RFC-0004 (cross-game analysis tools — coverage matrix and concept coverage), and RFC-0009 (concept quality scoring — coverage, evidence, richness scores). All three are implemented.

The project has no DNA invariants file (`invariantsFile: null` in `forge.yaml`), consistent with prior RFCs (RFC-0002, RFC-0003, RFC-0004, RFC-0009) which are all `kind: policy` with `satisfies: []`.

The `concept_type` filter is additive — it uses the existing `VectorMetadata.concept_type` field already stored in Vectorize. The MCP tool uses the existing `ctx.searchIndex` (local search package), consistent with `searchRecords` in `apps/mcp/src/tools/search.ts`. The web app changes extend the existing filter UI in `search.astro`.

## Problem

1. **No `concept_type` filter**: The existing `type` parameter filters by `record_type` (e.g., `type=concept`), but there is no way to filter by `concept_type` (e.g., only `design_primitive`). A query for "inventory" with `type=concept` returns all concept types mixed together.

2. **No MCP semantic concept search**: The MCP server has `query_design_space` for structured relation traversal, but no tool for semantic search over concepts by meaning. A user asking "which concepts involve resource scarcity?" cannot get semantic matches — only exact keyword or relation matches.

3. **No `inclusion_criteria` in embedding text**: `buildEmbeddingText()` in the Worker includes `concept_type`, `source_games`, and `mutation_dimensions`, but not `inclusion_criteria` — one of the most semantically rich fields for design search.

4. **No concept filter in web UI**: The web app `/search` page has source and type filter links but no "Concepts only" toggle or `concept_type` dropdown.

## Decision

### D1: Add `concept_type` filter to search API

Add an optional `concept_type` query parameter to `/api/search`:

```
GET /api/search?q=risk+reward&type=concept&concept_type=design_primitive
```

The filter is applied as a Vectorize metadata filter alongside the existing `source_id`, `record_type`, and `kind` filters in `handleSearch()`. The `concept_type` field is already stored in `VectorMetadata` and serialized by `toVectorMetadata()`.

The existing `type` parameter already handles `record_type` filtering — no new `record_type` parameter is needed.

**Files**: `apps/search-api/src/index.ts` — add `concept_type` to the filter object in `handleSearch()` (line 84-87).

### D2: Enhance concept embedding text with `inclusion_criteria`

`buildEmbeddingText()` in `apps/search-api/src/index.ts:282-294` already includes `concept_type` (as "concept: ..."), `source_games` (as "games: ..."), and `mutation_dimensions` (as "dimensions: ...") in the embedding text. The `summary` field (set by `toIndexRecord()` in `scripts/index-embeddings.ts:62`) is used as `description:` in `buildEmbeddingText()`.

For concept records, enrich the `summary` in `toIndexRecord()` to include `inclusion_criteria`:

```
{definition}. Inclusion criteria: {inclusion_criteria.join(', ')}.
```

This is the only field not already covered by `buildEmbeddingText()`. The enriched `summary` flows through to the embedding text via the existing `description:` line.

Edge cases: Concepts with empty or missing `inclusion_criteria` use the existing `summary` (just `definition`). No special handling needed — the `inclusion_criteria` segment is omitted when the array is empty.

**Files**: `scripts/index-embeddings.ts` — modify `toIndexRecord()` to enrich `summary` for concept records.

### D3: MCP tool `search_design_space`

New MCP tool that uses the local search index (`ctx.searchIndex`) to find concepts by semantic similarity, consistent with the existing `searchRecords` tool in `apps/mcp/src/tools/search.ts`.

```json
{
  "query": "resource scarcity and tension",
  "concept_type": "design_pressure",
  "limit": 10
}
```

The tool calls `ctx.searchIndex.search()` with `filters: { record_type: "concept" }` and the user's query. If `concept_type` is provided, results are post-filtered by matching `concept_type` on the returned records (since `SearchFilters` in the search package does not include `concept_type`).

After search results are retrieved, the tool looks up `quality_score` from `ctx.store` for each hit (by record ID), consistent with how `getConceptQuality` in `derived.ts` accesses scores. Records without `quality_score` return `null` — same graceful fallback as RFC-0009.

**Input**: `{ query: string; concept_type?: string; limit?: number }`

**Files**: `apps/mcp/src/tools/derived.ts`, `apps/mcp/src/server.ts`

### D4: Web app search supports concept filter

The existing `/search` page in `apps/web/src/pages/search.astro` already has source and type filter links (rendered dynamically from search results). Add a "Concepts only" toggle that sets `type=concept` in the URL params, and a `concept_type` dropdown that sets `concept_type=concept_type_value`.

The `SearchBox.astro` component already supports `source` and `recordType` hidden inputs — extend with an optional `conceptType` prop.

**Files**: `apps/web/src/pages/search.astro`, `apps/web/src/components/SearchBox.astro`

## Design

The `concept_type` filter leverages Vectorize's metadata filtering — `concept_type` is already stored as a string in `VectorMetadata` and serialized by `toVectorMetadata()`. Adding it to the filter object in `handleSearch()` is a one-line change:

```typescript
if (conceptType) filter.concept_type = conceptType;
```

The MCP `search_design_space` tool follows the existing `searchRecords` pattern: call `ctx.searchIndex.search()` with filters, then post-process results. Post-filtering by `concept_type` is needed because `SearchFilters` in `@roguelike-games-ib/search` does not include `concept_type` — extending it would touch the search package, which is out of scope for this RFC.

The embedding text enhancement targets `toIndexRecord()` in `scripts/index-embeddings.ts` (client-side), not `buildEmbeddingText()` in the Worker (server-side). This is because `buildEmbeddingText()` already includes the fields the RFC wants to enrich — the gap is `inclusion_criteria`, which is not a separate field in `IndexRecord` but can be included in the `summary` text.

## Rollout

After implementation:

1. **Search API**: Deploy the updated Worker. The `concept_type` parameter is optional — existing callers are unaffected. No migration needed.
2. **Embedding text**: A full reindex (`pnpm index:embeddings`) is required to update concept embeddings with `inclusion_criteria`. The `index-embeddings.ts` script does not support filtering by `record_type` during indexing, so all 22,476 records are reindexed. This is acceptable — the script batches at 100 records per API call and completes in minutes.
3. **MCP tool**: The `search_design_space` tool is additive — existing tools are unchanged. The tool degrades gracefully when `quality_score` is absent (returns `null`).
4. **Web app**: The concept filter is additive — existing search behavior is unchanged when the toggle is off.

## Alternatives considered

1. **Extend `/api/design-search` instead of adding `concept_type` to `/api/search`.** Rejected because `/api/design-search` has a different response shape (`DesignSearchApiResponse` with `concepts` and `relations` arrays) and hardcodes `topK: 20`. Adding `concept_type` to `/api/search` is simpler and works with the existing `type=concept` filter.

2. **Extend `query_design_space` MCP tool instead of creating `search_design_space`.** Rejected because `query_design_space` does structured relation traversal (primitive → pressure → knob), not semantic text search. The two tools serve different purposes: `query_design_space` answers "what is related to this primitive?" while `search_design_space` answers "which concepts match this semantic query?"

3. **Add `inclusion_criteria` as a separate field in `IndexRecord` and `buildEmbeddingText()`.** Rejected because it requires changing the Worker's `IndexRecord` type, `VectorMetadata`, and `buildEmbeddingText()`. Enriching the `summary` in `toIndexRecord()` achieves the same result with a client-side-only change.

4. **Extend `SearchFilters` in the search package to include `concept_type`.** Rejected as out of scope — it would touch `@roguelike-games-ib/search` package, which is not in `packagesImpacted`. Post-filtering in the MCP tool is simpler and sufficient for the concept count (469 records).

## Implementation plan

### Step 1: Add `concept_type` filter to search API

1. In `handleSearch()` in `apps/search-api/src/index.ts`, read `url.searchParams.get("concept_type")` via `normalizeFilter()`
2. Add `if (conceptType) filter.concept_type = conceptType;` to the filter object (line 84-87)
3. Deploy updated Worker

**Files**: `apps/search-api/src/index.ts`

### Step 2: Enhance concept embedding text

1. In `toIndexRecord()` in `scripts/index-embeddings.ts`, detect `record_type === "concept"` and build a richer `summary` that appends `inclusion_criteria`
2. Re-run `pnpm index:embeddings` to reindex all records with enhanced concept summaries

**Files**: `scripts/index-embeddings.ts`

### Step 3: Add MCP `search_design_space` tool

1. Add `searchDesignSpace()` to `apps/mcp/src/tools/derived.ts` — calls `ctx.searchIndex.search()` with `filters: { record_type: "concept" }`, post-filters by `concept_type` if provided, looks up `quality_score` from `ctx.store`
2. Register in `server.ts` with input schema
3. Add `search_design_space` to `REQUIRED_TOOLS`

**Files**: `apps/mcp/src/tools/derived.ts`, `apps/mcp/src/server.ts`

### Step 4: Add concept filter to web search

1. Add "Concepts only" toggle to `search.astro` that sets `type=concept` in URL params
2. Add `concept_type` dropdown that sets `concept_type` param
3. Extend `SearchBox.astro` with optional `conceptType` prop

**Files**: `apps/web/src/pages/search.astro`, `apps/web/src/components/SearchBox.astro`

### Step 5: Tests and verify

1. Test search API with `concept_type` filter
2. Test MCP `search_design_space` tool
3. `pnpm exec turbo run build:check && pnpm exec vitest --run`

## Acceptance criteria

- [x] Search API `/api/search` supports `concept_type` query parameter for filtering by concept type (evidence: apps/search-api/src/index.ts:77,89 — `conceptType` read from URL params and added to Vectorize filter object)
- [x] Concept embeddings include `inclusion_criteria` in the `summary` field (evidence: scripts/index-embeddings.ts:64-68 — `toIndexRecord()` appends inclusion_criteria for concept records)
- [x] `search_design_space` MCP tool returns concept hits with `quality_score` from local store (evidence: apps/mcp/src/tools/derived.ts:516-567 — `searchDesignSpace()` calls `ctx.searchIndex.search()` with `record_type: "concept"` filter, looks up `quality_score` from `ctx.store`; apps/mcp/src/server.ts:545-560 — registered with `readOnly: true`; server.ts:614 — added to `REQUIRED_TOOLS`)
- [x] Web app `/search` has "Concepts only" toggle and `concept_type` dropdown (evidence: apps/web/src/pages/search.astro:64 — reads `concept_type` from URL params; search.astro:79 — passes to API; search.astro:154-173 — renders concept_type filter links; apps/web/src/components/SearchBox.astro:19,30 — `conceptType` prop and hidden input)
- [x] All tests pass (`pnpm exec turbo run build:check && pnpm exec vitest --run`) (evidence: `pnpm --filter @roguelike-games-ib/search-api run build:check` exit 0; `pnpm --filter @roguelike-games-ib/mcp run build:check` exit 0; `pnpm --filter @roguelike-games-ib/web run build:check` exit 0; `pnpm exec vitest --run` — 704 tests passed, 0 failed)

## Risks

- **Reindexing cost**: A full reindex of 22,476 records is required because `index-embeddings.ts` does not support filtering by `record_type`. Mitigation: the script batches at 100 records per API call and completes in minutes.
- **Search API deployment**: Adding the `concept_type` filter requires deploying the Worker. Mitigation: backward compatible — the new parameter is optional.
- **Embedding quality**: Enhanced text with `inclusion_criteria` may not produce better embeddings if the model doesn't handle multi-field concatenation well. Mitigation: test with known queries before/after.
- **Post-filtering performance**: The MCP tool post-filters by `concept_type` after search. With 469 concepts, this is negligible. If the concept count grows significantly, consider extending `SearchFilters` in the search package.

## Implementation notes for agents

- **Status gate**: This RFC must be in `accepted` status before implementation begins. Use `fo-idea-plan` to create the implementation plan and transition to `accepted`.
- **MODULE_CONTRACT**: New files and modified non-trivial `.astro` components in `apps/web/` must include `MODULE_CONTRACT` and `CHANGE_SUMMARY` comments per `apps/web/AGENTS.md`.
- **MCP tool convention**: The `search_design_space` tool must be read-only (`readOnly: true`) and registered with a JSON schema in `server.ts`. Add to `REQUIRED_TOOLS` array.
- **CI gates**: All CI checks must pass — `pnpm materialize`, `pnpm exec turbo run build:check`, `pnpm exec vitest --run`.
- **No canonical modifications**: The embedding text enhancement is in the indexing script only. Do not modify `knowledge/claim/` or `knowledge/concept/` directories.
- **Search API endpoint**: The parameter name is `concept_type` (snake_case) in the URL query string, consistent with existing parameters (`source`, `type`, `kind`).
