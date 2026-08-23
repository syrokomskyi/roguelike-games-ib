---
reviewId: REVIEW-CODE-2026-08-23-01
date: 2026-08-23
reviewer:
  skill: fo-review
  model: claude-sonnet-4-20250514
verdict: needs-revision
diffRange: 73a7bcc4b30^...HEAD
filesReviewed:
  - scripts/run-stage-design.ts
  - apps/mcp/src/tools/design.ts
  - apps/mcp/src/tools/queries.ts
  - knowledge/ontology/relation-types.yaml
---

# Code Review: 73a7bcc4b30^...HEAD (RFC-0003 design layer expansion)

### Verdict: Needs revision

The implementation correctly adds LLM-driven generation of mutation vectors, design knobs, counterplay patterns, and failure modes. The mechanical floor passes (tsc, rfc.validate, vitest 641/641). However, there are structural and clarity findings that should be addressed.

### Mechanical floor

Pass — tsc --noEmit (apps/mcp), rfc.validate (RFC-0003), vitest (641 tests, 0 failures).

### Axis A — Structural correctness

1. **Duplicated Code** — The four generation loops (mutation vectors, knobs, counterplay, failure modes) share the same pattern: LLM call → try/catch fallback → push concept → push relation. A shared helper `generateAndLinkConcepts()` would reduce ~200 lines of near-identical structure. (scripts/run-stage-design.ts:613-849)

2. **Primitive Obsession** — `findRecordsByKeywords` uses `string[]` for keywords and returns `string[]` for IDs. A `RecordRef` type or at least a named `RecordId` type would be clearer. (scripts/run-stage-design.ts:108-120)

3. **Error handling** — All four LLM catch blocks silently fall back to hardcoded defaults without logging the error. If the LLM returns malformed JSON, the error is swallowed. Add `console.warn` in each catch block. (scripts/run-stage-design.ts:633, 689, 750, 812)

### Axis B — DNA alignment

No invariants file — invariant alignment skipped.

### Axis C — Ecosystem fit

No issues. Package boundaries respected (scripts → packages/knowledge-core, packages/materializer). New relation types follow existing ontology patterns. MCP tool extensions follow existing patterns.

### Axis D — Forward-only compliance

No issues. No backward compatibility shims or dual paths. The old 2-level graph is replaced by the 5-level graph in a single forward-only change.

### Axis E — Agent-facing clarity

1. **Compass scaffolding** — `apps/mcp/src/tools/queries.ts` was modified (counterplay extension to `getDesignTensions`) but has no `MODULE_CONTRACT` or `CHANGE_SUMMARY` scaffolding. While it's an existing file, the change is non-trivial (28 new lines). Consider adding a `CHANGE_SUMMARY` entry. (apps/mcp/src/tools/queries.ts:218-255)

2. **Log-driven development** — LLM call logging (`[LLM] calling gpt-4o-mini...`) is present but doesn't include the prompt hash or cache hit/miss status. Adding `cache: hit|miss` would help debugging. (scripts/run-stage-design.ts:95)

### Axis F — Pragmatism

1. **New dependency** — `ai` and `@ai-sdk/openai` were added as devDependencies. This is justified by the RFC decision to use LLM-driven generation. However, the `ai` package is a meta-package; importing only `generateText` from `ai` pulls in more than needed. Consider importing from `@ai-sdk/openai` directly if it exports a `generateText` equivalent. (scripts/run-stage-design.ts:11)

2. **Existing patterns** — The `loadEnv()` function manually parses `.env` instead of using `dotenv` (which may already be available). Check if `dotenv` is a dependency before rolling a custom parser. (scripts/run-stage-design.ts:64-72)

### Axis G — Blind spots

1. **Edge cases** — If `OPENAI_API_KEY` is missing or invalid, the LLM calls will fail and all concepts fall back to hardcoded defaults. The script should check for the key at startup and warn/error early. (scripts/run-stage-design.ts:75)

2. **Performance** — The script makes ~180 sequential LLM calls (56 vectors + 56 knob batches + 34 counterplay + 14 failure modes). With caching this is acceptable for re-runs, but first runs take ~4 minutes. Consider adding a progress counter (e.g., `[LLM 3/180]`). (scripts/run-stage-design.ts:92-99)

### Spec compliance

| Requirement from RFC-0003 | Status | Evidence |
|---|---|---|
| 3 new relation types in ontology | Done | relation-types.yaml:350-373 |
| LLM + algorithm generation | Done | run-stage-design.ts:64-120, 613-849 |
| Mutation vectors with HAS_MUTATION_VECTOR | Done | 56 concepts, 56 relations |
| Design knobs with IMPLEMENTED_AS | Done | 224 concepts, 224 relations |
| Counterplay patterns with HAS_COUNTERPLAY | Done | 93 concepts, 93 relations |
| Failure modes with CAN_FAIL_AS | Done | 28 concepts, 28 relations |
| query_design_space extended | Done | design.ts:99-102 |
| get_design_tensions extended | Done | queries.ts:224-252 |
| All tests pass | Done | 641/641 |
| LLM cache for idempotent re-runs | Done | systems-cache/llm-design-cache.json |

### Questions for the author

1. Should the LLM catch blocks log warnings instead of silently falling back to defaults? Silent failures could mask API issues.
2. Is the manual `.env` parser in `loadEnv()` intentional, or should `dotenv` be used if available?
3. Should `queries.ts` get Compass `CHANGE_SUMMARY` scaffolding for the counterplay extension?
