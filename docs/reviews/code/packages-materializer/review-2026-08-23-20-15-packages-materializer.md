---
reviewId: REVIEW-CODE-2026-08-23-01
date: 2026-08-23
reviewer:
  skill: fo-review
  model: unknown
verdict: needs-revision
diffRange: a1c780cb8aa...HEAD
filesReviewed:
  - packages/materializer/src/quality-scores.ts
  - packages/materializer/src/types.ts
  - packages/materializer/src/index.ts
  - packages/materializer/src/build.ts
  - packages/knowledge-core/src/config.ts
  - knowledge.config.yaml
  - apps/mcp/src/tools/derived.ts
  - apps/mcp/src/tools/design.ts
  - apps/mcp/src/server.ts
  - apps/web/src/lib/design-data.ts
  - apps/web/src/pages/design.astro
  - apps/web/src/pages/concepts.astro
  - tests/materializer/quality-scores.test.ts
  - tests/mcp/mcp-012.test.ts
---

# Code Review: a1c780cb8aa...HEAD (RFC-0009 implementation)

### Verdict: Needs revision

Two minor findings: hardcoded `target: 10` in `buildEvidenceDetail` and missing CHANGE_SUMMARY entry in `index.ts`. The implementation is architecturally sound, well-tested (16 unit tests + 704 passing), and correctly preserves canonical hash determinism.

### Mechanical floor

Pass — all 4 workspaces (`knowledge-core`, `materializer`, `mcp`, `web`) pass `build:check`. Full test suite: 704 passed, 0 failed.

### Axis A — Structural correctness

**Finding A1**: `buildEvidenceDetail` in `apps/mcp/src/tools/derived.ts:487` hardcodes `target: 10` as the return value. This magic number should reference `DEFAULT_QUALITY_SCORING_CONFIG.evidence_target` or the configured value. If an operator changes `evidence_target` in `knowledge.config.yaml`, this display value will be stale.

### Axis B — DNA alignment

No invariants file — invariant alignment skipped.

### Axis C — Ecosystem fit

No issues. Package boundaries correct (`apps → packages`). Compass inventory regenerated. No new commands or packages.

### Axis D — Forward-only compliance

No issues. No compatibility shims. Quality scores are a new projection field, not a replacement for existing behavior.

### Axis E — Agent-facing clarity

**Finding E1**: `packages/materializer/src/index.ts` CHANGE_SUMMARY not updated with RFC-0009 entry. The barrel now exports `computeQualityScores`, `DEFAULT_QUALITY_SCORING_CONFIG`, `QualityScore`, and `QualityScoringConfig` but the CHANGE_SUMMARY only lists "Initial creation".

### Axis F — Pragmatism

No issues. `sortByQuality` is a minimal 8-line function. `computeQualityScores` is straightforward O(n*m) which is fine for current KB size. No new dependencies. No over-engineering.

### Axis G — Blind spots

No issues. Edge cases (empty state, no refs, no relations, no ancestry) are tested. Missing scores handled gracefully in MCP tools (null fallback) and web app (badge not rendered). Performance is acceptable — single pass over relations per concept.

### Spec compliance

| Requirement from RFC-0009 | Status | Evidence |
| --- | --- | --- |
| Quality scores in records.jsonl | Done | `build.ts:91-97` |
| Quality scores in SQLite | Done | `build.ts:91-97` — scores applied before `buildSqlite` |
| `get_concept_quality` MCP tool | Done | `derived.ts:405-466`, `server.ts:529-543` |
| Graceful fallback for missing scores | Done | `derived.ts:432-437` |
| Web app A/B/C badges | Done | `design.astro:37-43`, `concepts.astro:64-72` |
| Sort by quality in existing tools | Done | `design.ts:33`, `design.ts:68` |
| Configurable thresholds | Done | `knowledge.config.yaml:21-28`, `config.ts:35-40` |
| All tests pass | Done | 704 passed, 0 failed |

### Questions for the author

1. Should `buildEvidenceDetail` read the `evidence_target` from config rather than hardcoding `10`? The MCP context doesn't currently have access to the config, but the default could be imported from `DEFAULT_QUALITY_SCORING_CONFIG`.
2. Should the `index.ts` CHANGE_SUMMARY be updated to reflect the RFC-0009 exports?
