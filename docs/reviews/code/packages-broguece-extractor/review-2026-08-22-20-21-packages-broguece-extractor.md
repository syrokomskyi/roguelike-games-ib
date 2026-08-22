---
reviewId: REVIEW-CODE-2026-08-22-01
date: 2026-08-22
reviewer:
  skill: fo-review
  model: unknown
verdict: approved
diffRange: f7ec272...HEAD
filesReviewed:
  - packages/extractors/broguece-extractor/src/extractor.ts
  - packages/extractors/broguece-extractor/src/image-asset-adapter.ts
---

# Code Review: f7ec272...HEAD

### Verdict: Approved

Finding E-1 fixed in commit 762a177 — MODULE_CONTRACT purpose now lists canonical kind names. All axes pass.

### Mechanical floor

Pass — `tsc --noEmit` and `vitest run tests/extract/extract-broguece-catalogs.test.ts` both pass. Pre-commit quality tests (94 tests) pass after slug collision fix.

### Axis A — Structural correctness

No issues. The changes are minimal kind-name replacements and slug prefix additions. The `simpleSpec` generic typing is preserved. Slug prefixing with nativeKind (`dungeonFeature-`, `lightSource-`) follows the existing pattern in `itemSpec` which prefixes slugs with `tableName/`. No magic numbers, no dead code, no unjustified removals.

### Axis B — DNA alignment

No invariants file — invariant alignment skipped.

### Axis C — Ecosystem fit

No issues. Package boundaries unchanged. Compass CHANGE_SUMMARY entries added to both modified files. No AGENTS.md or Compass XML updates needed per doc audit.

### Axis D — Forward-only compliance

No issues. Old kind names are directly replaced — no dual-paths, no compatibility shims, no legacy flags.

### Axis E — Agent-facing clarity

**Finding E-1 (fixed):** `packages/extractors/broguece-extractor/src/extractor.ts:3` — MODULE_CONTRACT `<purpose>` previously listed old non-canonical kind names. Fixed in commit 762a177 — purpose now lists canonical kind names: feature, mutation, spawn_table, status_effect, trait, ability, other_definition.

### Axis F — Pragmatism

No issues. Changes are minimal — only kind names and slug prefixes were changed. The slug prefixing is the minimal fix for the collision discovered when two catalogs (dungeonFeatureCatalog and lightCatalog) map to the same canonical kind `feature`.

### Axis G — Blind spots

No issues. The slug collision edge case (entries sharing nativeId across dungeonFeatureCatalog and lightCatalog) is handled. Migration path (re-extraction) is documented in the ADR.

### Spec compliance

| Requirement from ADR-0007 | Status | Evidence |
| --- | --- | --- |
| Update manifest.recordKinds | Done | `extractor.ts:70` — canonical kinds list |
| Update simpleSpec kind parameters | Done | `extractor.ts:295,304,322,340,349` |
| Update imageAssetSpec kind | Done | `image-asset-adapter.ts:77` |
| Keep nativeKind unchanged | Done | All nativeKind values preserved |
| No taxonomy changes | Done | `game-content-taxonomy.yaml` untouched |
| No conformance test changes | Done | Tests pass without modification |

### Questions for the author

1. The slug prefixing (`dungeonFeature-`, `lightSource-`) was not mentioned in ADR-0007's implementation section. Should the ADR be updated to document this collision fix?
