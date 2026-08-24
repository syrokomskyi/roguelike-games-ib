---
reviewId: REVIEW-CODE-2026-08-24-01
date: 2026-08-24
reviewer:
  skill: fo-review
  model: claude-sonnet-4-20250514
verdict: needs-revision
diffRange: 56afd437c30~1...HEAD
filesReviewed:
  - scripts/run-stage-design.ts
  - tests/conformance/c20-design-implementation-refs.test.ts
---

# Code Review: 56afd437c30~1...HEAD (RFC-0019 implementation)

### Verdict: Needs revision

Two findings: a `// Aliases` comment violates the no-comments rule, and the `matchPatternToGame` function has an unused parameter `_primitiveTitles` that should be removed or used.

### Mechanical floor

Pass — `rfc.validate` passes, `vitest --run` passes (777 tests), `pnpm materialize` succeeds.

### Axis A — Structural correctness

1. **Unused parameter** — `matchPatternToGame` accepts `_primitiveTitles: Map<string, string>` but never uses it (renamed to `_` prefix). This is dead code from the LLM-based version. Remove the parameter and update the call site.

2. **Duplicated Code** — `matchPrimitiveToGame` and `matchPatternToGame` share the same structure: get game kinds, filter by PRIMITIVE_KIND_MAP, collect records. The pattern version just unions kinds from multiple member primitives. Consider extracting a shared `matchByKinds(state, kinds, game, limit)` helper.

### Axis B — DNA alignment

No invariants file — invariant alignment skipped.

### Axis C — Ecosystem fit

No issues. The script is in `scripts/`, the test is in `tests/conformance/`, both follow existing patterns.

### Axis D — Forward-only compliance

No issues. The old `findRecordsByKeywords` function is still used for design knobs and counterplay patterns — those were not in scope for this RFC and remain unchanged.

### Axis E — Agent-facing clarity

1. **Comment in code** — `// Aliases used by DESIGN_PATTERNS member_primitives` in `PRIMITIVE_KIND_MAP` violates the project's no-comments rule. The aliases are self-explanatory from the key names.

### Axis F — Pragmatism

1. **Minimality** — The `PRIMITIVE_KIND_MAP` with hardcoded kind mappings is a reasonable fallback given the user's request to avoid LLM calls. However, the `getGameKinds` and `getRecordsByKind` helper functions are now only used by the matching functions — they could be inlined since the matching logic is simple. This is minor and acceptable.

### Axis G — Blind spots

1. **Matching quality** — The keyword-based fallback picks the first N records of each kind (sorted by file order, not relevance). This means `implementation_refs` are not semantically matched — they're just "some creatures" or "some items". The conformance test checks existence and resolution, not semantic relevance. This is acceptable given the user's explicit choice to avoid LLM calls, but should be documented.

### Spec compliance

| Requirement from RFC-0019 | Status | Evidence |
| --- | --- | --- |
| All 14 primitives have non-empty implementation_refs | Done | c20 test passes |
| All patterns have non-empty implementation_refs | Done | c20 test passes |
| concrete_examples have record_refs for >=2 games | Done | c20 test passes |
| Conformance test c20 passes | Done | 6/6 tests pass |
| pnpm materialize succeeds | Done | canonical hash computed |
| All existing tests pass | Done | 777 tests pass |
| rfc.validate passes | Done | 0 violations |
| LLM-based matching (Step A + Step B) | Scope change | Replaced with keyword-based fallback per operator request |

### Questions for the author

1. Should the unused `_primitiveTitles` parameter be removed, or is it kept for future LLM-based matching?
2. Is the keyword-based fallback a permanent replacement or a temporary measure until LLM calls are available?
