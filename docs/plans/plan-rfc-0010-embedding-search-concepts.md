# Plan: RFC-0010 — Embedding search for concepts

- **RFC**: RFC-0010
- **Title**: Embedding search for concepts — semantic search over design space
- **Status**: accepted
- **Created**: 2026-08-23

## Objectives

1. Add `concept_type` filter to the search API `/api/search` endpoint
2. Enrich concept embedding text with `inclusion_criteria` in `toIndexRecord()`
3. Add `search_design_space` MCP tool using local search index
4. Add "Concepts only" toggle and `concept_type` dropdown to web search page
5. All tests pass

## Steps

### Step 1: Add `concept_type` filter to search API

**Files**: `apps/search-api/src/index.ts`

1. In `handleSearch()`, read `url.searchParams.get("concept_type")` via `normalizeFilter()`
2. Add `if (conceptType) filter.concept_type = conceptType;` to the filter object (after line 87)
3. Update `CHANGE_SUMMARY` comment in `index.ts`

**Completion criterion**: `GET /api/search?q=test&type=concept&concept_type=design_primitive` applies both `record_type` and `concept_type` filters in the Vectorize query. TypeScript compiles (`pnpm exec turbo run build:check --filter @roguelike-games-ib/search-api`).

### Step 2: Enhance concept embedding text with `inclusion_criteria`

**Files**: `scripts/index-embeddings.ts`

1. In `toIndexRecord()`, after computing `summary`, check if `r.record_type === "concept"` and `r` has `inclusion_criteria` (accessed via `r["inclusion_criteria"]` since `MaterializedRecord` uses `[key: string]: unknown`)
2. If present and non-empty array, append `. Inclusion criteria: {items.join(', ')}.` to `summary`
3. Update `CHANGE_SUMMARY` comment

**Completion criterion**: `toIndexRecord()` for a concept with `inclusion_criteria: ["a", "b"]` produces a `summary` containing "Inclusion criteria: a, b". Concepts without `inclusion_criteria` produce unchanged `summary`. TypeScript compiles.

### Step 3: Add MCP `search_design_space` tool

**Files**: `apps/mcp/src/tools/derived.ts`, `apps/mcp/src/server.ts`

1. Add `searchDesignSpace()` function to `derived.ts`:
   - Call `ctx.searchIndex.search({ text: input.query, filters: { record_type: "concept" }, limit })`
   - Post-filter hits by `concept_type` if `input.concept_type` is provided (match on `hit.record` cast to access `concept_type`)
   - For each hit, look up `quality_score` from `ctx.store.resolveRecordById(hit.record.id)` — cast to access `quality_score`
   - Return envelope with `concepts` array: `{ key, record_id, title, concept_type, quality_score, score }`
2. Update `MODULE_CONTRACT` and `CHANGE_SUMMARY` in `derived.ts`
3. Register in `server.ts`:
   - Import `searchDesignSpace` from `derived.ts`
   - Register with name `"search_design_space"`, description, input schema (`query: string` required, `concept_type: string` optional, `limit: integer 1-100` optional), `readOnly: true`
4. Add `"search_design_space"` to `REQUIRED_TOOLS` array

**Completion criterion**: `search_design_space` tool is registered, appears in `REQUIRED_TOOLS`, and returns concept hits with `quality_score`. TypeScript compiles.

### Step 4: Add concept filter to web search

**Files**: `apps/web/src/pages/search.astro`, `apps/web/src/components/SearchBox.astro`

1. In `SearchBox.astro`:
   - Add `conceptType?: string` to `Props` interface
   - Add hidden input for `concept_type` if prop is provided
   - Update `CHANGE_SUMMARY` comment
2. In `search.astro`:
   - Read `concept_type` from URL params in `initSearch()`
   - Pass `concept_type` to the API fetch URL if set
   - Add "Concepts only" toggle link that sets `type=concept` (using existing `filterLink` pattern)
   - Add `concept_type` dropdown with known concept types (design_primitive, design_pressure, mutation_vector, design_knob, counterplay_pattern, failure_mode, cross_game_mechanic)
   - Update `CHANGE_SUMMARY` comment

**Completion criterion**: Web search page has "Concepts only" toggle and `concept_type` dropdown. Selecting them adds the corresponding URL params. TypeScript compiles.

### Step 5: Tests and validation

1. Add test for search API `concept_type` filter — verify `handleSearch()` applies the filter (unit test or integration test)
2. Add test for MCP `search_design_space` tool — verify it returns concept hits with `quality_score`
3. Run `pnpm exec turbo run build:check`
4. Run `pnpm exec vitest --run`

**Completion criterion**: All tests pass. `build:check` and `vitest` exit 0.

### Step 6: Review and fix

1. Run `fo-review` on all session code changes
2. Run `fo-fix` if review has findings

**Completion criterion**: Review report exists in `docs/reviews/code/`. All findings addressed.

### Step 7: Stamp implemented

1. Run `pnpm exec forge rfc.implement.stamp --id RFC-0010 --implementation-commit <sha>`
2. Verify RFC status transitions to `implemented`

**Completion criterion**: RFC-0010 frontmatter shows `status: implemented` and `implementedAt: 2026-08-23`.

## Validation suite

- `pnpm exec turbo run build:check` — TypeScript compilation across all workspaces
- `pnpm exec vitest --run` — full test suite
- `pnpm exec forge rfc.validate --id RFC-0010 --json` — mechanical validation

## Evidence strategy

- Git diff showing `concept_type` filter in `handleSearch()`
- Git diff showing `inclusion_criteria` enrichment in `toIndexRecord()`
- Git diff showing `searchDesignSpace` function and registration
- Git diff showing web UI concept filter
- Test output showing all tests pass
- `rfc.implement.stamp` output confirming status transition

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Reindexing requires full 22K record reindex | Document in rollout — script batches at 100, completes in minutes |
| `concept_type` post-filtering in MCP tool may miss results if search returns <limit after filtering | Acceptable with 469 concepts — over-fetch by 3x limit before post-filtering |
| Web app concept_type dropdown needs hardcoded list | Use the same enum values as `find_cross_game_concepts` in server.ts |
