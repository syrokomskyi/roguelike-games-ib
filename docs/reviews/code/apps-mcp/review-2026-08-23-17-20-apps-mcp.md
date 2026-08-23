---
reviewId: REVIEW-CODE-2026-08-23-01
date: 2026-08-23
reviewer:
  skill: fo-review
  model: unknown
verdict: needs-revision
diffRange: 8ee51e98f86...HEAD
filesReviewed:
  - apps/mcp/src/index.ts
  - apps/mcp/src/server.ts
  - apps/mcp/src/tools/compare.ts
  - apps/mcp/src/tools/concept-implementations.json
  - apps/mcp/src/tools/derived.ts
  - tests/mcp/mcp-012.test.ts
  - docs/rfcs/rfc-0004-cross-game-analysis-tools.md
---

# Code Review: 8ee51e98f86...HEAD (RFC-0004 cross-game analysis tools)

### Verdict: Needs revision

Two duplicated code patterns and one RFC documentation inconsistency. The implementation is functionally correct — all 665 tests pass and the scoped build is clean — but the duplicated concept-coverage logic between `compare.ts` and `derived.ts` should be consolidated.

### Mechanical floor

Pass — `pnpm --filter @roguelike-games-ib/mcp run build:check` and `pnpm exec vitest --run` both pass.

### Axis A — Structural correctness

1. **Duplicated Code** — `conceptCoversGame` in `apps/mcp/src/tools/compare.ts:59-76` and `getConceptSourceIds` in `apps/mcp/src/tools/derived.ts:131-148` implement the same logic: check `ancestry.source_games` then resolve `implementation_refs` to find source IDs. The `compare.ts` version returns `boolean`, the `derived.ts` version returns `Set<string>`. The `compare.ts` version should call `getConceptSourceIds` and check `.has(sourceId)` instead of duplicating the logic.

2. **Duplicated Code** — The ref-resolution-by-source-id pattern is repeated in `getConceptCoverage` (`derived.ts:217-225`) and `compareConceptImplementations` (`derived.ts:299-307`). Both iterate `allRefs`, resolve records via `ctx.store.resolveRecordById`, and filter by `source_identity.source_id === sid`. Extract a shared helper like `resolveRefsBySource(ctx, refIds, sourceId)`.

### Axis B — DNA alignment

No issues. No invariants file is configured (`invariantsFile: null` in `forge.yaml`).

### Axis C — Ecosystem fit

No issues. Package boundaries are respected — all new code is within `apps/mcp/`. Tool registration follows existing patterns in `server.ts`. `REQUIRED_TOOLS` updated correctly with 4 new entries (28 total).

### Axis D — Forward-only compliance

No issues. No compatibility shims or dual-paths. The `include_concepts` parameter defaults to `false` and is purely additive.

### Axis E — Agent-facing clarity

1. **RFC documentation inconsistency** — `docs/rfcs/rfc-0004-cross-game-analysis-tools.md:400` references `concept-implementations.yaml` in the Rollout section, but the actual implementation uses `concept-implementations.json`. The acceptance criteria (line 407) correctly says `concept-implementations.json`. The Rollout section should be updated to match.

2. **Compass scaffolding** — `derived.ts` and `compare.ts` both have proper `MODULE_CONTRACT` and `CHANGE_SUMMARY` scaffolding with RFC-0004 entries. Good.

### Axis F — Pragmatism

1. **Module-level mutable cache** — `implementationNotesCache` in `derived.ts:258` is a module-level `let` variable. In a long-running process, this cache could become stale if the JSON file is updated. Since the MCP server reads from a static file that ships with the package, this is acceptable for now. Consider documenting that the cache is intentional and tied to package deployment lifecycle.

### Axis G — Blind spots

No issues. Edge cases are handled: concepts with no ancestry return empty coverage and appear in gaps. Dangling `implementation_refs` are skipped gracefully. Empty matrix entries are initialized for all registered source IDs.

### Spec compliance

| Requirement from RFC-0004 | Status | Evidence |
| --- | --- | --- |
| D1: `compare_games` with `include_concepts` | Done | `compare.ts:49-125`, test mcp-012:155-163 |
| D2: `get_coverage_matrix` | Done | `derived.ts:152-170`, test mcp-012:170-179 |
| D3: `get_concept_coverage` with gaps | Done | `derived.ts:179-259`, test mcp-012:190-215 |
| D4: `compare_concept_implementations` with data file | Done | `derived.ts:278-334`, `concept-implementations.json`, test mcp-012:222-237 |
| D5: `find_concept_gaps` | Done | `derived.ts:336-402`, test mcp-012:242-268 |
| All tools read-only, in REQUIRED_TOOLS | Done | `server.ts:470-527`, test mcp-012:112-135 |
| No regressions | Done | 665 tests pass |
| Edge case: no ancestry | Done | test mcp-012:210-215, 264-268 |

### Questions for the author

1. Why was `concept-implementations.json` chosen instead of the `concept-implementations.yaml` specified in the RFC Design section? Was the decision to avoid adding `js-yaml` as a dependency?
2. Could `getConceptSourceIds` be exported from `derived.ts` and reused in `compare.ts` to eliminate the duplication?
