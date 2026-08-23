---
reviewId: REVIEW-CODE-2026-08-23-01
date: 2026-08-23
reviewer:
  skill: fo-review
  model: unknown
verdict: needs-revision
diffRange: dc56db9cbaf...HEAD
filesReviewed:
  - apps/mcp/src/tools/report.ts
  - apps/mcp/src/server.ts
  - apps/mcp/src/index.ts
  - packages/builders/obsidian-builder/src/report.ts
  - packages/builders/obsidian-builder/src/build.ts
  - packages/builders/obsidian-builder/src/moc.ts
  - packages/builders/obsidian-builder/src/index.ts
  - apps/web/src/lib/report.ts
  - apps/web/src/index.ts
  - apps/web/src/pages/compare/[...filter].astro
  - scripts/run-build-obsidian.ts
  - tests/mcp/mcp-013.test.ts
  - tests/obs/obs-007-report.test.ts
  - tests/web/web-008-report.test.ts
  - tests/mcp/mcp-012.test.ts
---

# Code Review: dc56db9cbaf...HEAD (RFC-0012 Comparison Reports)

### Verdict: Needs revision

One unused parameter in `renderGaps` and a minor Duplicated Code observation. Otherwise the implementation is clean, well-structured, and follows existing codebase patterns.

### Mechanical floor

Pass — `turbo run build:check` 17/17 pass, `vitest --run` 738/738 pass, `forge rfc.validate --id RFC-0012` pass.

### Axis A — Structural correctness

No issues. The `as unknown as Record<string, unknown>` pattern for accessing record fields is consistent with existing MCP tools (`compare.ts`, `derived.ts`). The `buildSection` switch is exhaustive over `SectionName`. Error handling in `buildPrimitivesSection` uses bare `catch` blocks but this is intentional — `compareConceptImplementations` throws `NotFoundError`/`ValidationError` and the fallback data is the correct behavior per RFC-0012.

### Axis B — DNA alignment

No invariants file — invariant alignment skipped.

### Axis C — Ecosystem fit

No issues. Package boundaries respected: MCP tool imports only from sibling `tools/*.ts` modules; Obsidian builder imports from sibling `paths.ts`/`links.ts`; web `report.ts` imports `getSourceId` from `page-data.ts` per AGENTS.md convention. All new source files carry `MODULE_CONTRACT` and `CHANGE_SUMMARY`. The compare page now has Compass scaffolding per AGENTS.md.

### Axis D — Forward-only compliance

No issues. The `reports?: boolean` option is a new opt-in feature, not a compatibility shim. No legacy code paths.

### Axis E — Agent-facing clarity

**Finding E1**: `renderGaps` in `packages/builders/obsidian-builder/src/report.ts:142` accepts `resolver: PathResolver` but never references it in the function body. The parameter should be removed to avoid confusing future agents.

### Axis F — Pragmatism

No issues. The `buildSection` dispatch function is a thin middle-man but provides exhaustive switch typing. The duplicated report logic between MCP and web is explicitly acknowledged in RFC-0012 Risks section as intentional design.

### Axis G — Blind spots

No issues. Performance is documented in RFC-0012 (6 full-record iterations). Edge cases handled: empty concepts, missing ancestry, missing curated summaries, empty source_ids (validated at entry).

### Spec compliance

| Requirement from RFC-0012 | Status | Evidence |
| --- | --- | --- |
| MCP tool `generate_comparison_report` | Done | `apps/mcp/src/tools/report.ts:30-55` |
| 6 report sections (overview, coverage, primitives, gaps, tensions, attributes) | Done | `VALID_SECTIONS` at line 20, `buildSection` switch at 62-75 |
| `sections` parameter filters sections | Done | Lines 39-41, test "sections parameter filters" |
| `format: "json"` returns JSON | Done | Lines 49-50, test "format: json" |
| Obsidian comparison notes with wiki-links | Done | `packages/builders/obsidian-builder/src/report.ts:21-42` |
| MOC includes Comparison Reports section | Done | `moc.ts:57-64`, test "MOC includes" |
| Web Download report button | Done | `compare/[...filter].astro:178-187`, script at 203-253 |
| Curated summary fallback text | Done | `report.ts:137`, test "missing curated summary" |
| All tests pass | Done | 738/738 pass |

### Questions for the author

1. Why does `renderGaps` in the Obsidian builder accept `resolver: PathResolver` if it never uses it?
