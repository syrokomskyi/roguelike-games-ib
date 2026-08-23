---
reviewId: REVIEW-CODE-2026-08-23-01
date: 2026-08-23
reviewer:
  skill: fo-review
  model: claude-sonnet-4-20250514
verdict: needs-revision
diffRange: 0569f76fc62~1...HEAD
filesReviewed:
  - scripts/run-stage-design.ts
  - apps/mcp/src/tools/derived.ts
  - apps/mcp/src/server.ts
  - apps/web/src/lib/design-data.ts
  - apps/web/src/pages/patterns.astro
  - apps/web/src/pages/design.astro
  - tests/conformance/c13-design-patterns.test.ts
  - tests/mcp/mcp-012.test.ts
  - knowledge/ontology/relation-types.yaml
---

# Code Review: RFC-0011 implementation (0569f76fc62~1...HEAD)

### Verdict: Needs revision

One finding on Axis A (dead code). The implementation is otherwise clean, follows established patterns, and passes all mechanical checks.

### Mechanical floor

Pass — 17/17 `build:check` tasks pass, 712/712 vitest tests pass, `rfc.validate` passes.

### Axis A — Structural correctness

- **Dead code**: `memberPressureIds` is computed in `run-stage-design.ts` (Step 8) but never used. The variable resolves member pressure IDs from the map but is not referenced in the concept push or anywhere else. Remove the variable and its computation block.

### Axis B — DNA alignment

No invariants file — invariant alignment skipped.

### Axis C — Ecosystem fit

No issues. New tools follow existing MCP registration patterns. New page follows existing Astro page conventions. Relation type added to ontology correctly.

### Axis D — Forward-only compliance

No issues. No compatibility shims or dual-paths.

### Axis E — Agent-facing clarity

No issues. `patterns.astro` carries `MODULE_CONTRACT` and `CHANGE_SUMMARY`. `derived.ts` and `design-data.ts` have updated `CHANGE_SUMMARY`. Variable names are clear.

### Axis F — Pragmatism

No issues beyond the dead code finding in Axis A. The implementation extends existing scripts and patterns rather than creating new ones.

### Axis G — Blind spots

No issues. LLM-generated content is cached. Edge cases (missing failure mode slugs) are handled with warnings.

### Spec compliance

| Requirement from RFC-0011 | Status | Evidence |
| --- | --- | --- |
| D1: Concrete examples on primitives | Done | 56 examples across 14 primitives |
| D2: 10 design_pattern records | Done | 10 pattern-*.jsonl files in canonical |
| D3: TRIGGERED_BY_COMBINATION relations | Done | 6 relations, ontology updated |
| D4: MCP tools | Done | find_design_patterns, get_pattern_examples registered |
| D5: /patterns web page | Done | patterns.astro created, linked from design.astro |
| Tests | Done | c13-design-patterns.test.ts: 8 tests pass |

### Questions for the author

1. Why is `memberPressureIds` computed but unused? Was it intended to be stored on the pattern record?
