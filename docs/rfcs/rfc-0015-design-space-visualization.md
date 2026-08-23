---
id: RFC-0015
title: "Design space visualization — interactive graph of primitives, pressures, tensions, and patterns"
status: draft
kind: policy
scope: workspace
owners:
  - architecture
reviewers:
  - human:andrii-syrokomskyi
createdAt: 2026-08-24
updatedAt: 2026-08-24
closedAt:
supersedes: []
supersededBy:
amends: []
amendedBy:
related:
  - RFC-0003
  - RFC-0005
  - RFC-0011
  - RFC-0013
satisfies: []
versionBump: minor
commands:
  proposed: []
  added: []
  changed: []
  removed: []
appsImpacted:
  - web
packagesImpacted: []
successSignals:
  - /design-graph page renders an interactive force-directed graph of design concepts and relations
  - Nodes are color-coded by concept type (primitive, pressure, pattern, mutation vector, failure mode)
  - Edges represent design relations (CREATES_PRESSURE, tensions_with, HAS_MUTATION_VECTOR, IMPLEMENTED_AS, TRIGGERED_BY_COMBINATION)
  - Clicking a node shows a detail panel with definition, quality score, and links to related records
  - Graph filters by concept type, relation type, and game presence
  - Graph data is pre-computed at build time and served as static JSON
nonGoals:
  - Does not use a heavyweight graph framework — D3.js is a composable library, not a framework
  - Does not support graph editing — read-only exploration
  - Does not render 3D or VR — 2D force-directed layout
---

# RFC-0015: Design space visualization — interactive graph of primitives, pressures, tensions, and patterns

## Context

The knowledge base contains ~469 concepts connected by design relations (CREATES_PRESSURE, tensions_with, HAS_MUTATION_VECTOR, IMPLEMENTED_AS, HAS_COUNTERPLAY, CAN_FAIL_AS, TRIGGERED_BY_COMBINATION). The current `/design` page presents these as flat lists. Designers cannot easily see how primitives connect to pressures, which tensions exist between pressures, or how patterns combine primitives.

An interactive force-directed graph would let designers explore the design space visually — clicking nodes to see details, filtering by type, and understanding the topology of roguelike design.

## Problem

1. **Flat lists hide topology** — the design page shows concepts and relations as separate lists, making it hard to see the overall structure
2. **No visual exploration** — designers must mentally reconstruct the graph from text descriptions
3. **Pattern membership is opaque** — which primitives belong to which patterns, and how patterns overlap, is not visually apparent
4. **Tension networks are invisible** — the 14 tension pairs between pressures are listed but not shown as a network

## Decision

### D1: D3.js force-directed graph

Use D3.js (v7) force simulation for the graph layout. D3 is the industry standard for data visualization — well-documented, battle-tested, and provides force simulation, zoom, drag, and SVG manipulation out of the box. Writing a force simulation from scratch would be ~500 lines of fragile code vs. a single `import`.

D3 is a library, not a framework — it composes with vanilla JS and Astro's progressive enhancement model. The graph page degrades gracefully: without JS, the page shows a static list of nodes and edges; with JS, D3 renders the interactive force-directed graph.

### D2: Pre-computed graph data at build time

Extract graph nodes and edges from `ProjectionStore` at Astro build time, serialize as JSON in a `<script define:vars>` block. No runtime data fetching — the graph is static.

Node shape:
```typescript
interface GraphNode {
  id: string;       // record ID
  key: string;      // record key
  label: string;    // title or key
  type: string;     // concept_type: design_primitive, design_pressure, design_pattern, mutation_vector, failure_mode, counterplay_pattern, design_knob
  qualityScore: number | null;
  gamesPresent: string[];
}
```

Edge shape:
```typescript
interface GraphEdge {
  source: string;   // node id
  target: string;   // node id
  type: string;     // relation_type: CREATES_PRESSURE, tensions_with, HAS_MUTATION_VECTOR, IMPLEMENTED_AS, HAS_COUNTERPLAY, CAN_FAIL_AS, TRIGGERED_BY_COMBINATION
}
```

### D3: Node color-coding by concept type

| Concept type | Color |
|---|---|
| design_primitive | Blue |
| design_pressure | Amber |
| design_pattern | Green |
| mutation_vector | Purple |
| design_knob | Cyan |
| counterplay_pattern | Teal |
| failure_mode | Red |

### D4: Interactive filters

Sidebar filters:
- **Concept type** checkboxes (show/hide node types)
- **Relation type** checkboxes (show/hide edge types)
- **Game presence** dropdown (show only nodes present in selected game)
- **Quality score threshold** slider (show only nodes with quality >= threshold)

### D5: Detail panel on node click

When a node is clicked, a side panel shows:
- Record key (link to `/records/{key}/`)
- Title and definition
- Quality score badge (A/B/C)
- Games where present
- Connected relations (list of edges with target labels)

### D6: New web page at /design-graph

New Astro page `apps/web/src/pages/design-graph.astro` with:
- Full-viewport SVG container
- Filter sidebar (collapsible on mobile)
- Detail panel (slide-in from right)
- Legend showing node colors and edge types

## Architectural fit

- **Projection-only**: Graph data is derived from `ProjectionStore` at build time — no canonical mutations
- **Astro static**: No server-side rendering needed — all data is serialized into the page
- **D3 client-side**: D3 force simulation runs in the browser, no build-time layout computation
- **Consistent with existing patterns**: Follows the same `buildDesignData` pattern used by `/design` and `/patterns` pages

## Rollout

1. Create `apps/web/src/lib/graph-data.ts` — `buildGraphData(store)` returning `{ nodes, edges }`
2. Create `apps/web/src/pages/design-graph.astro` — page with SVG, filters, detail panel
3. Add `d3` as a dependency in `apps/web/package.json`
4. Add "Design Graph" to navigation in `Base.astro`
5. Add conformance test verifying graph data contains expected node/edge types

## Alternatives

- **Cytoscape.js** — more feature-rich but heavier dependency. D3 is sufficient for force-directed layout.
- **WebGL (e.g. Sigma.js)** — better for very large graphs, but ~469 nodes is well within SVG/D3 performance budget.
- **Vanilla JS only** — writing force simulation from scratch is ~500 lines of fragile code; D3 is battle-tested.
- **Server-side rendering** — unnecessary for a static graph; client-side D3 is simpler.

## Implementation notes

- D3 force simulation parameters: charge=-300, linkDistance=80, collision radius=20
- Node radius proportional to degree (number of connected edges) — hub nodes appear larger
- Edge stroke opacity by relation type (tensions_with more visible than IMPLEMENTED_AS)
- Pan and zoom via D3 zoom behavior
- Touch support for mobile (pinch-to-zoom, tap-to-select)

## Acceptance criteria

- [ ] `/design-graph` page renders with all design concepts as nodes and design relations as edges
- [ ] Nodes are color-coded by concept type per D3 color table
- [ ] Clicking a node opens a detail panel with record info and links
- [ ] Filters for concept type, relation type, and game presence work
- [ ] Graph is responsive (mobile-friendly with collapsible sidebar)
- [ ] Build-time graph data is correct (verified by conformance test)
