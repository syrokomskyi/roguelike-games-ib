---
reviewId: REVIEW-CODE-2026-08-23-01
date: 2026-08-23
reviewer:
  skill: fo-review
  model: claude-sonnet-4-20250514
verdict: needs-revision
diffRange: 4fd24ba84bf^...HEAD
filesReviewed:
  - apps/web/src/components/ConceptDetails.astro
  - apps/web/src/components/DesignGraph.astro
  - apps/web/src/layouts/Base.astro
  - apps/web/src/lib/design-data.ts
  - apps/web/src/pages/compare/[...filter].astro
  - apps/web/src/pages/concepts.astro
  - apps/web/src/pages/design.astro
  - apps/web/src/pages/games/[sourceId]/[...filter].astro
  - apps/web/src/pages/records/[...key].astro
  - docs/rfcs/rfc-0005-web-app-enrichment.md
---

# Code Review: 4fd24ba84bf^...HEAD (RFC-0005 web app enrichment)

### Verdict: Needs revision

Implementation is functionally correct — build:check passes, 665 tests pass, all acceptance criteria met. However, there are findings on axes A, E, and G that should be addressed before stamping implemented.

### Mechanical floor

Pass — `pnpm --filter web run build:check` (0 errors), `pnpm exec vitest --run` (665/665 passed).

### Axis A — Structural correctness

1. **Duplicated code — `extractConceptCard` vs `extractAncestry`**: `design-data.ts` has both `extractAncestry()` (lines 38-44) and `extractConceptCard()` (lines 113-127). `extractConceptCard` duplicates the ancestry extraction logic. Consider having `extractConceptCard` call `extractAncestry` or removing `extractAncestry` if no longer needed.

2. **Duplicated code — `getSourceId` pattern**: The `getSourceId` helper from `page-data.ts` is reimplemented inline in `buildCoverageMatrix` (lines 173-176) and `buildGameConceptCoverage` (lines 209-212) with the same `source_identity` → `scope` fallback pattern. Should use the existing `getSourceId` from `page-data.ts`.

3. **Duplicated `designRelationTypes` set**: The set is defined in `design-data.ts:15-18` and again in `ConceptDetails.astro:22-24`. Should be exported from `design-data.ts` and imported.

### Axis B — DNA alignment

No invariants file — invariant alignment skipped.

### Axis C — Ecosystem fit

No issues. All changes are within `apps/web/`. No cross-app imports. Package boundaries respected.

### Axis D — Forward-only compliance

No issues. The old flat list on `/design` is replaced by the graph (with a collapsible list fallback). No dual-paths, no feature flags.

### Axis E — Agent-facing clarity

1. **Missing Compass scaffolding on new files**: `ConceptDetails.astro` and `DesignGraph.astro` are non-trivial new components but lack `MODULE_CONTRACT` and `CHANGE_SUMMARY` scaffolding. `concepts.astro` also lacks scaffolding. The existing `design-data.ts` was updated with scaffolding (good).

2. **`designRelationTypes` duplicated without reference**: The duplicated set in `ConceptDetails.astro` should import from `design-data.ts` to maintain a single source of truth and make the relationship clear to agents.

### Axis F — Pragmatism

No issues. All new functions follow the existing pure-projection pattern. No new dependencies. SVG graph uses vanilla JS — no framework added. Progressive enhancement correctly applied.

### Axis G — Blind spots

1. **DesignGraph large graph readability**: The graph uses a simple grid layout with up to 8 primitives per row and 10 pressures per row. With 15 primitives and 31 pressures, this produces 2 rows of primitives and 4 rows of pressures. The SVG height could be significant. The `max-height: 600px` CSS constraint with `overflow-visible` may cause the graph to be clipped. Consider using `overflow-auto` instead or removing the max-height constraint.

2. **ConceptDetails `allRelations` variable**: The record page passes `allRelations` to `ConceptDetails` but this variable name is not defined in the visible diff. Verify it exists in the record page's frontmatter scope.

### Spec compliance

| Requirement from RFC-0005 | Status | Evidence |
|---|---|---|
| D1: Fix scope filter | Done | design-data.ts:28-30 |
| D2: ConceptDetails | Done | ConceptDetails.astro, records/[...key].astro:90-92 |
| D3: /concepts page | Done | concepts.astro, Base.astro nav |
| D4: DesignGraph | Done | DesignGraph.astro, design.astro:93-115 |
| D5: Compare coverage | Done | compare/[...filter].astro:100-160 |
| D6: Per-game concepts | Done | games/[sourceId]/[...filter].astro:131-168 |
| Acceptance: build passes | Done | build:check 0 errors |
| Acceptance: tests pass | Done | vitest 665/665 |

### Questions for the author

1. Should `extractAncestry` be removed now that `extractConceptCard` covers the same logic, or is it still used elsewhere?
2. Is `allRelations` defined in the record page's frontmatter? If not, the `ConceptDetails` component will receive `undefined` for its `relations` prop.
