# Plan: RFC-0016 — Game recommender by sensations

**RFC**: RFC-0016
**Title**: Game recommender by sensations — match player preferences to game design profiles
**Status**: accepted
**Created**: 2026-08-24

## Objectives

1. Add `recommendGames()` MCP tool to `apps/mcp/src/tools/derived.ts` that ranks games by sensation match score
2. Register `recommend_games` in `server.ts` and add to `REQUIRED_TOOLS`
3. Create `apps/web/src/lib/recommend.ts` with `buildRecommendationData(store)` and `computeRecommendations(data, sensations)`
4. Create `apps/web/src/pages/recommend.astro` with sensation selector + ranked results
5. Add "Recommend" to navigation in `Base.astro`
6. Add conformance test `tests/conformance/c16-game-recommender.test.ts`

## Steps

### Step 1: Add `recommendGames()` to MCP `derived.ts`

**Files**: `apps/mcp/src/tools/derived.ts`

1. Implement `recommendGames(ctx, input)` function:
   - Input: `{ sensations: string[]; limit?: number; min_score?: number }`
   - For each sensation: look up `SENSATION_MAP` → get relevant patterns/primitives/pressures
   - For unknown sensations: call `searchDesignSpace(ctx, { query: sensation })` as fallback
   - For each game (from `ctx.store.bindings`): compute per-sensation score using weighted formula (weight = `quality_score.overall` or 1.0 fallback, presence_weight = 1 if game in `games_where_present` or `ancestry.source_games`)
   - Aggregate: arithmetic mean of per-sensation scores
   - Build rationale from template (D4)
   - Filter by `min_score` (default 0.1), sort descending, limit
   - Return `envelope(ctx, { recommendations, total })`
2. Update `MODULE_CONTRACT` purpose and `CHANGE_SUMMARY` in `derived.ts`

**Completion criterion**: `recommendGames` function exists, exported from `derived.ts`, compiles without errors.

### Step 2: Register `recommend_games` in `server.ts`

**Files**: `apps/mcp/src/server.ts`, `apps/mcp/src/index.ts`

1. Add `recommendGames` to the import from `./tools/derived.ts` in `server.ts`
2. Register tool with name `recommend_games`, description, input schema (`sensations: array of string, required; limit: integer; min_score: number`), `readOnly: true`
3. Add `"recommend_games"` to `REQUIRED_TOOLS` array
4. Add `recommendGames` to barrel export in `apps/mcp/src/index.ts`

**Completion criterion**: `recommend_games` is in `REQUIRED_TOOLS`, registered in `createMcpToolRegistry`, and exported from the MCP package barrel.

### Step 3: Create web app `recommend.ts` library

**Files**: `apps/web/src/lib/recommend.ts` (new)

1. Create `buildRecommendationData(store: ProjectionStore): RecommendationData` — extract games, concepts (with quality_score, games_where_present, ancestry.source_games), and sensation map from the projection store
2. Create `computeRecommendations(data: RecommendationData, sensations: string[]): RecommendationItem[]` — client-side scoring logic mirroring the MCP tool algorithm
3. Include `MODULE_CONTRACT` and `CHANGE_SUMMARY` comments per `apps/web/AGENTS.md`
4. Import `SENSATION_MAP` from `./sensation-map.ts`

**Completion criterion**: `recommend.ts` compiles, exports `buildRecommendationData` and `computeRecommendations`, includes `MODULE_CONTRACT`/`CHANGE_SUMMARY`.

### Step 4: Create `/recommend` web page

**Files**: `apps/web/src/pages/recommend.astro` (new)

1. Create Astro page with `MODULE_CONTRACT` and `CHANGE_SUMMARY` comments
2. Build-time: call `buildRecommendationData(ctx.store)` and serialize as JSON in a `<script>` tag
3. UI: 15 sensation checkboxes (from `SENSATION_MAP` keys), results section
4. Client-side JS: on sensation selection change, call `computeRecommendations(data, selectedSensations)`, render ranked game cards with score, matched patterns (links to `/records/{key}/`), matched primitives (links), rationale text
5. Progressive enhancement: without JS, show message "Enable JavaScript to get recommendations" with fallback link to `/laboratory`
6. Use `Base` layout with `activeNav="recommend"`

**Completion criterion**: `/recommend` page builds, renders sensation selector, and shows ranked results when JS is enabled.

### Step 5: Add "Recommend" to navigation

**Files**: `apps/web/src/layouts/Base.astro`

1. Add `{ href: "/recommend", label: "Recommend", key: "recommend" }` to `navItems` array (after Laboratory)

**Completion criterion**: "Recommend" link appears in nav bar, links to `/recommend`.

### Step 6: Add conformance test

**Files**: `tests/conformance/c16-game-recommender.test.ts` (new)

1. Test `recommend_games` is in `REQUIRED_TOOLS` and registered in `createMcpToolRegistry`
2. Test `recommend_games` is read-only (`assertNoWriteTools` passes)
3. Test `recommendGames` with known sensations (e.g., `["dread"]`) returns non-empty array with `source_id`, `score`, `matched_patterns`, `matched_primitives`, `rationale`
4. Test unknown sensation (e.g., `"boredom"`) falls back to semantic search — does not throw, returns results or empty array
5. Test missing `quality_score` fallback — concept with `quality_score: null` uses weight = 1.0
6. Test empty sensations array returns empty result
7. Follow the pattern of `c14-design-seed-generator.test.ts` (setup MCP workspace with test records)

**Completion criterion**: All test cases pass with `pnpm exec vitest --run tests/conformance/c16-game-recommender.test.ts`.

### Step 7: Validation

1. Run `pnpm exec forge rfc.validate --id RFC-0016 --json` — verify 0 violations
2. Run `pnpm exec turbo run build:check` — verify TypeScript compilation passes
3. Run `pnpm exec vitest --run` — verify all tests pass (existing + new conformance test)

**Completion criterion**: All three commands pass with 0 errors.

### Step 8: Review & Fix

1. Run `fo-review` on all session code changes
2. Run `fo-fix` if review has findings

**Completion criterion**: Review report exists in `docs/reviews/code/`, all findings addressed.

### Step 9: Stamp implemented

1. Run `pnpm exec forge rfc.implement.stamp --id RFC-0016 --implementation-commit <sha>`
2. Verify RFC status transitions to `implemented`

**Completion criterion**: RFC-0016 status is `implemented` in frontmatter.

## Acceptance criteria mapping

| Criterion | Step |
|---|---|
| `recommend_games` MCP tool returns ranked games | Step 1, 6 |
| Tool is in `REQUIRED_TOOLS` and read-only | Step 2, 6 |
| `/recommend` page lets users select sensations and see ranked results | Step 4, 5 |
| Each recommendation includes matched patterns, primitives, and rationale | Step 1, 6 |
| Unknown sensations fall back to semantic search | Step 1, 6 |
| Missing `quality_score` fallback works | Step 1, 6 |
| Conformance test verifies tool registration and output shape | Step 6 |
