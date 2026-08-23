---
reviewId: REVIEW-CODE-2026-08-23-01
date: 2026-08-23
reviewer:
  skill: fo-review
  model: claude-sonnet-4-20250514
verdict: needs-revision
diffRange: c89e510e433...HEAD
filesReviewed:
  - apps/mcp/src/tools/derived.ts
  - apps/mcp/src/server.ts
  - apps/search-api/src/index.ts
  - scripts/index-embeddings.ts
  - apps/web/src/pages/search.astro
  - apps/web/src/components/SearchBox.astro
  - tests/mcp/mcp-012.test.ts
  - apps/search-api/AGENTS.md
---

# Code Review: c89e510e433...HEAD (RFC-0010 implementation)

### Verdict: Needs revision

Two minor findings: duplicated JSON parsing in `searchDesignSpace` and a hardcoded concept type list in `search.astro` that duplicates the server enum. Both are cosmetic but should be addressed for consistency.

### Mechanical floor

Pass — `pnpm --filter @roguelike-games-ib/search-api run build:check` exit 0; `pnpm --filter @roguelike-games-ib/mcp run build:check` exit 0; `pnpm --filter @roguelike-games-ib/web run build:check` exit 0; `pnpm exec vitest --run` — 704 tests passed.

### Axis A — Structural correctness

**Finding A1: Duplicated JSON.parse in searchDesignSpace.** The `filter` callback at `derived.ts:537` calls `JSON.parse(hit.record.json)` to access `concept_type`, and the `map` callback at `derived.ts:544-546` calls `ctx.store.resolveRecordById()` with a fallback to `JSON.parse(hit.record.json)` again. The parsed record from the filter step is discarded. With 469 concepts this is negligible performance-wise, but the duplication can be eliminated by caching the parsed record during filtering or by combining the filter and map into a single pass.

### Axis B — DNA alignment

No invariants file — invariant alignment skipped.

### Axis C — Ecosystem fit

No issues. Package boundaries respected — no cross-app imports. AGENTS.md updated for `apps/search-api`. Compass scaffolding added to `SearchBox.astro` and `search.astro`. `MODULE_CONTRACT` and `CHANGE_SUMMARY` updated in all modified files.

### Axis D — Forward-only compliance

No issues. The `concept_type` parameter is additive and optional — no legacy paths maintained. No backward compatibility shims.

### Axis E — Agent-facing clarity

No issues. Variable names are clear (`conceptType`, `inclusionCriteria`, `overfetchLimit`). Compass scaffolding present on all modified files. No ungrounded assertions.

### Axis F — Pragmatism

**Finding F1: Hardcoded CONCEPT_TYPES array in search.astro.** The `CONCEPT_TYPES` array at `search.astro:154-159` duplicates the enum values in the `search_design_space` tool registration at `server.ts:552`. If a new concept type is added, both places need updating. For a static Astro site this is the pragmatic choice (no runtime access to the MCP server's types), but a comment noting the duplication would help future agents keep them in sync.

### Axis G — Blind spots

No issues. Edge cases handled: concepts without `inclusion_criteria` (segment omitted), concepts without `quality_score` (returns `null`), empty query (search index handles gracefully). Overfetch factor of 3x is reasonable for post-filtering with 469 concepts.

### Spec compliance

| Requirement from RFC-0010 | Status | Evidence |
| --- | --- | --- |
| D1: Add concept_type filter to /api/search | Done | `apps/search-api/src/index.ts:77,89` |
| D2: Enhance concept embedding text with inclusion_criteria | Done | `scripts/index-embeddings.ts:64-68` |
| D3: MCP search_design_space tool | Done | `apps/mcp/src/tools/derived.ts:516-567`, `server.ts:545-560` |
| D4: Web app concept filter | Done | `apps/web/src/pages/search.astro:64,79,154-173`, `SearchBox.astro:19,30` |
| Acceptance: All tests pass | Done | 704 tests passed, 0 failed |

### Questions for the author

1. Should the duplicated `JSON.parse` in `searchDesignSpace` be consolidated into a single pass, or is the current two-step filter-then-map acceptable given the small concept count?
2. Should the `CONCEPT_TYPES` array in `search.astro` be extracted to a shared constant file to keep it in sync with the server enum, or is the static-site constraint sufficient justification for duplication?
