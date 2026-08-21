---
reviewId: REVIEW-CODE-2026-08-21-01
date: 2026-08-21
reviewer:
  skill: fo-review
  model: unknown
verdict: needs-revision
diffRange: afab88527^...HEAD
filesReviewed:
  - packages/extractors/cataclysm-bn-extractor/src/extractor.ts
---

# Code Review: afab88527^...HEAD

### Verdict: Needs revision

The code correctly implements the ADR-0004 decision to namespace duplicate native_ids with file suffixes. However, there is a duplicated code pattern between items and mutations deduplication logic that should be extracted.

### Mechanical floor

Pass — `tsc --noEmit` clean, 15/15 quality tests pass.

### Axis A — Structural correctness

**Finding A1: Duplicated Code (Fowler).** The deduplication logic for items (lines 201-213) and mutations (lines 277-289) is structurally identical — same `Map<string, number>` pattern, same file suffix derivation, same slug/nativeId namespacing. The only difference is the `items/` vs `mutations/` prefix in the regex. This should be extracted into a shared helper function (e.g., `namespaceDuplicateId(id, file, prefix)` returning `{ slug, nativeId }`).

### Axis B — DNA alignment

No invariants file — invariant alignment skipped.

### Axis C — Ecosystem fit

No issues. Package boundaries respected, no cross-app imports.

### Axis D — Forward-only compliance

No issues. The old `item.id` / `mut.id` direct usage is replaced, not maintained alongside.

### Axis E — Agent-facing clarity

No issues. Variable names are clear (`seenItemIds`, `seenMutationIds`, `nativeId`, `fileSuffix`).

### Axis F — Pragmatism

**Finding F1: Same as A1.** The duplicated dedup pattern is a pragmatism concern — a helper would reduce 24 lines to ~10.

### Axis G — Blind spots

No issues. Edge cases (first occurrence keeps original id) are handled correctly.

### Spec compliance

| Requirement from ADR-0004 | Status | Evidence |
| --- | --- | --- |
| Namespace duplicate native_ids with file suffix | Done | `extractor.ts:211` `nativeId = \`${item.id}__${fileSuffix}\`` |
| First occurrence keeps original native_id | Done | `extractor.ts:204` `let nativeId = item.id` (only modified when `seenCount > 0`) |
| Preserve all records and evidence anchors | Done | No skip/drop logic, all entries written |
| Population counts remain unchanged | Done | `itemCount++` / `mutationCount++` still increments for every entry |

### Questions for the author

1. Could the items and mutations dedup logic be extracted into a shared helper to reduce duplication?
