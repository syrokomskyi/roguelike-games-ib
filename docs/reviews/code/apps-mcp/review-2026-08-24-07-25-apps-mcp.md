---
reviewId: REVIEW-CODE-2026-08-24-01
date: 2026-08-24
reviewer:
  skill: fo-review
  model: claude-sonnet-4-20250514
verdict: needs-revision
diffRange: 7dae6408e71...HEAD
filesReviewed:
  - apps/mcp/src/tools/derived.ts
  - apps/mcp/src/server.ts
  - apps/mcp/src/index.ts
  - apps/web/src/lib/recommend.ts
  - apps/web/src/pages/recommend.astro
  - apps/web/src/layouts/Base.astro
  - tests/conformance/c16-game-recommender.test.ts
  - tests/mcp/mcp-012.test.ts
---

# Code Review: 7dae6408e71...HEAD (RFC-0016 game recommender)

### Verdict: Needs revision

Two findings: a logic bug in `totalCount` (always equals `totalMatchedCount`, making rationale text "N of N" instead of "N of M") and unescaped HTML in template literals in `recommend.astro`.

### Mechanical floor

Pass — `tsc --noEmit` passes for both `@roguelike-games-ib/mcp` and `@roguelike-games-ib/web`. All 11 conformance tests pass.

### Axis A — Structural correctness

**Finding A1: `totalCount` bug in `recommendGames`** — `totalCount` is incremented only inside the `if (present)` block at `apps/mcp/src/tools/derived.ts:1019`, but it represents the total number of relevant concepts in the rationale template. It should be incremented outside the `if (present)` block (after `totalWeight += weight`). Currently the rationale always says "N of N relevant concepts are present" because `totalCount` only counts matched concepts.

Evidence:
```typescript
// derived.ts:1015-1027
totalWeight += weight;
if (present) {
  weightedSum += weight;
  matchedCount++;
  totalCount++;  // ← should be outside this block
  ...
}
```

**Finding A2: Same `totalCount` bug in `computeRecommendations`** — `apps/web/src/lib/recommend.ts:155` has the same issue. `totalCount` is incremented inside `if (present)` block.

### Axis B — DNA alignment

No invariants file configured — invariant alignment skipped.

### Axis C — Ecosystem fit

No issues. Package boundaries correct (`apps/web` imports from `@roguelike-games-ib/projection-sdk`, `apps/mcp` imports from its own tools). Compass scaffolding present on all new files. Tool registration follows established pattern.

### Axis D — Forward-only compliance

No issues. No compatibility shims, no dual paths, no legacy code maintained.

### Axis E — Agent-facing clarity

No issues. All new files carry `MODULE_CONTRACT` and `CHANGE_SUMMARY`. Variable names are clear. No ungrounded assertions.

### Axis F — Pragmatism

No issues. The scoring logic duplication between MCP `recommendGames` and web `computeRecommendations` is the established pattern (same as `laboratory.astro` vs MCP `generateDesignSeed`). No unnecessary dependencies.

### Axis G — Blind spots

**Finding G1: Unescaped HTML in `recommend.astro` template literals** — `rec.rationale`, `rec.source_id`, `p.title` are injected into HTML via template literals without escaping. If any concept title or source ID contains `<`, `>`, or `&`, the page could break or be vulnerable to XSS. The `laboratory.astro` page has the same pattern, but this should be fixed in new code.

Evidence:
```javascript
// recommend.astro:96
`<a href="/games/${encodeURIComponent(rec.source_id)}/" class="...">${rec.source_id}</a>`
// recommend.astro:99
`<p class="mt-3 text-ib-muted leading-7">${rec.rationale}</p>`
```

`encodeURIComponent` is used for href attributes (good), but text content is not escaped. Add an `escapeHtml` helper function.

### Spec compliance

| Requirement from RFC-0016 | Status | Evidence |
|---|---|---|
| `recommend_games` MCP tool returns ranked games | Done | derived.ts:930-1085 |
| Tool is in `REQUIRED_TOOLS` and read-only | Done | server.ts:629-644, server.ts:703 |
| `/recommend` page with sensation selector | Done | recommend.astro:1-120 |
| Each recommendation includes matched patterns, primitives, rationale | Done | derived.ts:1041-1066 |
| Unknown sensations fall back to semantic search | Done | derived.ts:961-970 |
| Missing `quality_score` fallback works | Done | derived.ts:1003 |
| Conformance test verifies tool registration and output shape | Done | c16-game-recommender.test.ts, 11 tests pass |

### Questions for the author

1. Should `totalCount` count all relevant concepts for the requested sensations (not just matched ones)? The rationale template "N of M relevant concepts are present" implies M should be the total, not just the matched count.
2. Is there a shared `escapeHtml` utility in the web app, or should one be created for `recommend.astro`?
