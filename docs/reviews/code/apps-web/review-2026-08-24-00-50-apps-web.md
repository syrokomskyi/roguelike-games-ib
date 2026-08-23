---
reviewId: REVIEW-CODE-2026-08-24-01
date: 2026-08-24
reviewer:
  skill: fo-review
  model: claude-sonnet-4-20250514
verdict: needs-revision
diffRange: 889342bb4c4~1...HEAD
filesReviewed:
  - apps/web/src/lib/graph-data.ts
  - apps/web/src/pages/design-graph.astro
  - apps/web/src/layouts/Base.astro
  - apps/web/package.json
  - tests/conformance/c19-design-graph-data.test.ts
  - pnpm-lock.yaml
---

# Code Review: 889342bb4c4~1...HEAD (RFC-0015 implementation)

### Verdict: Needs revision

The implementation is functionally correct and architecturally sound. Three findings require attention: an unused import, a type safety gap in `graph-data.ts`, and a minor `innerHTML` XSS concern in the detail panel.

### Mechanical floor

Pass — `pnpm --filter @roguelike-games-ib/web build:check` (tsc --noEmit) passes clean. `pnpm exec vitest --run` passes all 760 tests. `pnpm build:web` builds 33,012 pages successfully.

### Axis A — Structural correctness

1. **Unused import** — `design-graph.astro:170` imports `event as d3Event` from `d3-selection` but never uses it. D3 v7 passes events as the first argument to event handlers, making the global `event` import unnecessary. Remove the import.

2. **Type safety gap in graph-data.ts** — `graph-data.ts:35` casts `r` to `Record<string, unknown>` to access fields like `title`, `concept_type`, `quality_score`, `ancestry`. This bypasses TypeScript's type system. The `ProjectionStore` records likely have typed fields or accessor methods. If the record type doesn't expose these fields directly, consider extending the projection SDK types or using a typed accessor. This is not a blocking issue but reduces type safety.

### Axis B — DNA alignment

No issues. No invariants file configured in `forge.yaml` (`invariantsFile: null`). DNA alignment skipped.

### Axis C — Ecosystem fit

No issues. `designRelationTypes` is correctly imported and reused from `design-data.ts` per `apps/web/AGENTS.md`. All changes are within `apps/web/` — no cross-app imports. D3 modular imports follow the "prefer existing packages" policy.

### Axis D — Forward-only compliance

No issues. No compatibility shims, no dual-paths. Existing `DesignGraph.astro` on `/design` remains unchanged — the two visualizations serve different purposes as documented in RFC D7.

### Axis E — Agent-facing clarity

1. **Compass scaffolding** — Both new files (`graph-data.ts` and `design-graph.astro`) carry `MODULE_CONTRACT` and `CHANGE_SUMMARY` comments. `Base.astro` `CHANGE_SUMMARY` updated with RFC-0015 entry. Pass.

2. **innerHTML XSS concern** — `design-graph.astro:372-396` uses `content.innerHTML` with template literals that interpolate `node.label`, `node.type`, `node.key`, and `node.gamesPresent` values. These values come from the knowledge base (not user input), so the XSS risk is low. However, if any label contains HTML special characters (`<`, `>`, `&`, `"`), they will be interpreted as HTML. Consider using `textContent` for individual elements or escaping the values before interpolation. This is a defensive coding finding, not a security vulnerability.

### Axis F — Pragmatism

No issues. Modular D3 imports (~60-80KB) instead of full package (~270KB). `buildGraphData` follows the same pure-projection pattern as `buildDesignData`. No speculative generality in interfaces. Scope is minimal — only `apps/web/` touched.

### Axis G — Blind spots

No issues. Empty state handled at two levels: server-side ("No design concepts found." when no nodes) and client-side ("No nodes match current filters." when filters exclude all). Mobile performance addressed via `alphaMin=0.001`, `alphaDecay=0.0228`, max 300 ticks, and mobile defaults hiding low-priority node types. Noscript fallback shows static node/edge lists.

### Spec compliance

| Requirement from RFC-0015 | Status | Evidence |
|---|---|---|
| D1: D3.js force-directed graph with modular imports | Done | `design-graph.astro:169-172`, `package.json:27-30` |
| D2: Pre-computed graph data at build time | Done | `graph-data.ts:31-65`, `design-graph.astro:30` |
| D3: Node color-coding by concept type | Done | `design-graph.astro:181-183`, color table at lines 33-43 |
| D4: Interactive filters | Done | `design-graph.astro:86-113`, filter handlers at 404-438 |
| D5: Detail panel on node click | Done | `design-graph.astro:357-398`, `showDetail()` |
| D6: New web page at /design-graph | Done | `design-graph.astro:1`, nav entry in `Base.astro:39` |
| D7: Coexistence with DesignGraph.astro | Done | Existing `DesignGraph.astro` unchanged |
| Risks: Mobile performance | Done | `alphaMin=0.001`, `alphaDecay=0.0228`, max 300 ticks, mobile defaults |
| Risks: Bundle size | Done | Modular imports, not full d3 package |
| Agent behavioral rules | Done | All rules followed: MODULE_CONTRACT, designRelationTypes reuse, progressive enhancement, vanilla JS |

### Questions for the author

1. Should the `d3Event` import be removed, or was it intended for a future use case?
2. Are the `Record<string, unknown>` casts in `graph-data.ts` acceptable, or should the projection SDK types be extended to expose `concept_type`, `quality_score`, and `ancestry` fields?
3. Should node labels be HTML-escaped before interpolation into `innerHTML` in the detail panel?
