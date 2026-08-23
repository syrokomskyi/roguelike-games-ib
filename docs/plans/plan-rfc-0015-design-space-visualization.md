---
id: PLAN-RFC-0015
title: "Design space visualization — interactive graph of primitives, pressures, tensions, and patterns"
status: active
scope: project-wide
decider: architecture
reviewers:
  - human:andrii-syrokomskyi
related:
  - RFC-0015
  - RFC-0003
  - RFC-0005
  - RFC-0011
created: 2026-08-24
accepted: 2026-08-24
implementedAt: null
closedAt: null
---

# PLAN-RFC-0015: Design space visualization

## Context

RFC-0015 (accepted) defines an interactive D3.js force-directed graph page at `/design-graph` for exploring design concepts and relations. This plan implements all 7 decisions (D1–D7) across 5 steps.

Key architectural facts verified during planning:
- `apps/web/src/lib/design-data.ts` exports `designRelationTypes` set (line 18) — must be reused, not duplicated
- `apps/web/src/lib/design-data.ts` has `buildDesignData()` pattern — `buildGraphData()` follows the same pattern
- `apps/web/src/lib/context.ts` provides `createWebContext(distDir)` returning `WebContext` with `store: ProjectionStore`
- `apps/web/src/pages/patterns.astro` and `design.astro` show the established page structure: `MODULE_CONTRACT` + `CHANGE_SUMMARY` comments, `createWebContext`, `Base` layout, `activeNav` prop
- `apps/web/src/layouts/Base.astro` has `navItems` array (line 34) — add "Graph" entry there
- `apps/web/src/components/DesignGraph.astro` is the existing static SVG graph on `/design` — remains unchanged per D7
- `apps/web/package.json` has no D3 dependencies yet — add modular packages
- Conformance tests in `tests/conformance/` follow pattern: read canonical JSONL, assert properties
- `scripts/run-build-web.ts` materializes and builds Obsidian vault; web build requires `pnpm build:web` from `apps/web`
- `apps/web/AGENTS.md` requires `MODULE_CONTRACT` and `CHANGE_SUMMARY` comments for new `.astro` files
- `apps/web/AGENTS.md` requires progressive enhancement — page works without JS, D3 enhances

What's new:
- `apps/web/src/lib/graph-data.ts` — `buildGraphData(store)` returning `{ nodes, edges }`
- `apps/web/src/pages/design-graph.astro` — interactive D3 force-directed graph page
- D3 modular dependencies: `d3-force`, `d3-zoom`, `d3-selection`, `d3-scale` in `apps/web/package.json`
- "Graph" nav item in `Base.astro`
- Conformance test `tests/conformance/c19-design-graph-data.test.ts`

## Steps

### Step 1: Create graph-data.ts (D2)

1. Create `apps/web/src/lib/graph-data.ts` with `MODULE_CONTRACT` and `CHANGE_SUMMARY` comments.
2. Import `designRelationTypes` from `./design-data.ts` — reuse, do not duplicate.
3. Import `ProjectionStore` type from `@roguelike-games-ib/projection-sdk`.
4. Define `GraphNode` and `GraphEdge` interfaces per RFC D2:
   ```typescript
   interface GraphNode {
     id: string;
     key: string;
     label: string;
     type: string;
     qualityScore: number | null;
     gamesPresent: string[];
   }
   interface GraphEdge {
     source: string;
     target: string;
     type: string;
   }
   ```
5. Implement `buildGraphData(store: ProjectionStore): { nodes: GraphNode[]; edges: GraphEdge[] }`:
   - Filter `store.records` for `record_type === "concept"` → map to `GraphNode[]`
   - For each concept: `id = r.id`, `key = r.key`, `label = r.title ?? r.key`, `type = r.concept_type`, `qualityScore = r.quality_score?.overall ?? null`, `gamesPresent = r.ancestry?.source_games ?? []`
   - Filter `store.relations` for design/cross_game scope where `designRelationTypes.has(r.relation_type)` → map to `GraphEdge[]`
   - For each relation: `source = rel.source_record_id`, `target = rel.target_record_id`, `type = rel.relation_type`
   - Only include edges whose source AND target nodes exist in the nodes array (skip dangling)
6. Export `GraphNode`, `GraphEdge`, `buildGraphData`.

**Completion criterion**: `pnpm exec tsc --noEmit` passes in `apps/web/`, `buildGraphData` returns nodes and edges from a `ProjectionStore`.

**Files**: `apps/web/src/lib/graph-data.ts`

### Step 2: Add D3 dependencies (D1)

1. Add to `apps/web/package.json` dependencies:
   - `"d3-force": "^3.0.0"`
   - `"d3-zoom": "^3.0.0"`
   - `"d3-selection": "^3.0.0"`
   - `"d3-scale": "^4.0.0"`
2. Add to `apps/web/package.json` devDependencies:
   - `"@types/d3-force": "^3.0.0"`
   - `"@types/d3-zoom": "^3.0.0"`
   - `"@types/d3-selection": "^3.0.0"`
   - `"@types/d3-scale": "^4.0.0"`
3. Run `pnpm install` from workspace root to update lockfile.

**Completion criterion**: `pnpm install` succeeds, `apps/web/package.json` contains 4 D3 packages + 4 type packages.

**Files**: `apps/web/package.json`, `pnpm-lock.yaml`

### Step 3: Create design-graph.astro page (D1, D3, D4, D5, D6)

1. Create `apps/web/src/pages/design-graph.astro` with `MODULE_CONTRACT` and `CHANGE_SUMMARY` comments in frontmatter.
2. Frontmatter:
   - Import `Base` from `../layouts/Base.astro`
   - Import `createWebContext` from `../lib/context`
   - Import `getPageMetadata` from `../lib/metadata`
   - Import `buildGraphData` from `../lib/graph-data`
   - Create web context, call `buildGraphData(ctx.store)`, serialize `{ nodes, edges }` as JSON
3. HTML structure (progressive enhancement):
   - `<Base title="Design Graph" metadata={meta} activeNav="graph">`
   - Header section matching existing page style (atlas-label, h1)
   - **Without JS fallback**: `<noscript>` block showing static list of nodes and edges
   - **With JS**: full-viewport SVG container (`<svg id="graph-svg">`)
   - Filter sidebar (collapsible on mobile via CSS):
     - Concept type checkboxes (design_primitive, design_pressure, design_pattern, mutation_vector, design_knob, counterplay_pattern, failure_mode)
     - Relation type checkboxes (CREATES_PRESSURE, tensions_with, HAS_MUTATION_VECTOR, IMPLEMENTED_AS, HAS_COUNTERPLAY, CAN_FAIL_AS, TRIGGERED_BY_COMBINATION)
     - Game presence dropdown (all games + individual games)
     - Quality score threshold slider (0.0 – 1.0)
   - Detail panel (hidden by default, slide-in from right on node click):
     - Record key (link to `/records/{key}/`)
     - Title and definition
     - Quality score badge (A/B/C)
     - Games where present
     - Connected relations (list of edges with target labels)
   - Legend showing node colors and edge types
   - `<script define:vars={{ nodes, edges }}>` block to pass graph data to client JS
4. Client-side `<script>`:
   - Import D3 modules: `import { forceSimulation, forceManyBody, forceLink, forceCenter, forceCollide } from "d3-force"; import { select } from "d3-selection"; import { zoom, zoomIdentity } from "d3-zoom"; import { scaleOrdinal } from "d3-scale";`
   - Color scale per D3 color table: design_primitive=blue, design_pressure=amber, design_pattern=green, mutation_vector=purple, design_knob=cyan, counterplay_pattern=teal, failure_mode=red
   - Force simulation: `charge=-300`, `linkDistance=80`, `collisionRadius=20`, `alphaMin=0.001`, `alphaDecay=0.0228`, max 300 ticks
   - Node radius proportional to degree (number of connected edges)
   - Edge stroke opacity by relation type
   - Pan and zoom via D3 zoom behavior
   - Touch support (pinch-to-zoom, tap-to-select)
   - On mobile, default filters hide `design_knob` and `mutation_vector` nodes
   - Node click → show detail panel with node data
   - Filter change → re-render graph with filtered nodes/edges
   - Empty state: if no nodes/edges, show "No design concepts found."
5. Use Tailwind CSS classes consistent with existing pages (ib-bg, ib-surface, ib-border, ib-text, ib-muted, ib-accent, ib-blue).

**Completion criterion**: `pnpm build:web` succeeds, page renders at `/design-graph` with SVG, filters, detail panel, legend, and noscript fallback.

**Files**: `apps/web/src/pages/design-graph.astro`

### Step 4: Add navigation entry (D6)

1. Edit `apps/web/src/layouts/Base.astro`:
   - Add `{ href: "/design-graph", label: "Graph", key: "graph" }` to `navItems` array (after "Design Space" entry, before "Concepts")
2. Update `CHANGE_SUMMARY` comment in `Base.astro` to note the new nav item.

**Completion criterion**: "Graph" link appears in navigation, links to `/design-graph`, active state highlights on the design-graph page.

**Files**: `apps/web/src/layouts/Base.astro`

### Step 5: Conformance test, validation, and stamp

1. Create `tests/conformance/c19-design-graph-data.test.ts`:
   - Read concept JSONL from `knowledge/concept/cross-game/concept/`
   - Read relation JSONL from `knowledge/relation/cross-game/relation/`
   - Verify all concept types referenced in RFC D3 color table exist in the data (design_primitive, design_pressure, design_pattern, mutation_vector, design_knob, counterplay_pattern, failure_mode)
   - Verify all relation types from `designRelationTypes` set exist in the data (CREATES_PRESSURE, tensions_with, HAS_MUTATION_VECTOR, IMPLEMENTED_AS, HAS_COUNTERPLAY, CAN_FAIL_AS, TRIGGERED_BY_COMBINATION)
   - Verify `buildGraphData` function exists and is exported from `apps/web/src/lib/graph-data.ts` (import check)

2. Run full verification:
   ```bash
   pnpm exec turbo run build:check
   pnpm exec vitest --run
   pnpm build:web
   ```

3. Stamp implemented:
   ```bash
   pnpm exec forge rfc.implement.stamp --id RFC-0015 --implementation-commit <sha>
   ```

**Completion criterion**: All tests pass, `build:check` passes, web build succeeds, RFC-0015 status is `implemented`.

**Files**: `tests/conformance/c19-design-graph-data.test.ts`

## Validation suite

| Check | Command | When |
|---|---|---|
| TypeScript compilation | `pnpm exec turbo run build:check` | After steps 1, 2, 3 |
| Web build | `pnpm build:web` (from `apps/web/`) | After step 3 |
| Full test suite | `pnpm exec vitest --run` | After step 5 |
| RFC validation | `pnpm exec forge rfc.validate --id RFC-0015 --json` | After stamp |

## Evidence strategy

- `pnpm exec turbo run build:check` output showing no TypeScript errors
- `pnpm build:web` output showing successful Astro build with `/design-graph` page
- `pnpm exec vitest --run` output showing c19 test passing
- Screenshot or browser preview of `/design-graph` page rendering
- `git log --oneline` showing implementation commits

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| D3 modular imports don't work with Astro bundler | Step 2 installs packages first; step 3 verifies build. If Astro can't resolve, use `import` from CDN or full `d3` package as fallback |
| Force simulation too slow on mobile | D1 specifies `alphaMin=0.001`, `alphaDecay=0.0228`, max 300 ticks; mobile defaults hide design_knob and mutation_vector nodes |
| SVG performance with ~469 nodes | D3 force simulation with SVG handles 500+ nodes in modern browsers; collision radius prevents overlap |
| Astro `<script>` tag doesn't support ES module imports | Use `<script type="module">` for D3 imports; Astro supports this natively |
| Conformance test fails if concept types missing from data | Test reads canonical data directly; if types are absent, test reveals data gap, not code bug |
