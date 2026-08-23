---
id: RFC-0005
title: "Web app enrichment — concept pages, design-space graph, and cross-game comparison view"
status: implemented
kind: architecture
scope: workspace
owners:
  - architecture
reviewers:
  - human:andrii-syrokomskyi
createdAt: 2026-08-23
updatedAt: 2026-08-23
enhancedAt: 2026-08-23
implementedAt: 2026-08-23
closedAt:
supersedes: []
supersededBy:
amends: []
amendedBy:
related:
  - RFC-0003
  - RFC-0004
  - PLAN-003
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
  - /design page shows interactive design-space graph with primitives, pressures, tensions
  - /concepts page lists all concepts grouped by concept_type with filtering
  - /compare page shows concept coverage matrix and per-game implementation differences
  - Individual concept pages show definition, criteria, implementation refs, and ancestry
  - Web app builds without errors after enrichment
nonGoals:
  - Does not add server-side rendering — the web app is statically generated (Astro `output: static`)
  - Does not add interactive JavaScript frameworks — uses Astro components and minimal client JS
  - Does not replace the Obsidian vault — both serve different audiences
  - Does not define DNA invariants — the project has no invariants file configured (invariantsFile: null in forge.yaml)
---

# RFC-0005: Web app enrichment — concept pages, design-space graph, and cross-game comparison view

## Context

The web app (`apps/web/`) is a statically generated Astro site with 16,195 pages. It already has:

- `/design` — Design Explorer page showing concepts, primitives, design relations, and realizations
- `/compare/[...filter]` — Game comparison page with record counts and types
- `/games/[sourceId]/` — Per-game pages with records, coverage, and evidence
- `/records/[...key]/` — Individual record pages
- `/search` — Semantic search (backed by search API Worker)
- `/ask` — AI-powered Q&A page

The `/design` page currently renders:
1. Cross-game concepts as flat cards (title, definition, source games, mutation dimensions)
2. Design primitives as flat cards (same format)
3. Design relations as a flat list (source → type → target)
4. Cross-game realizations as a flat list

### Current problems

1. **No dedicated concept pages**: Concepts link to `/records/{key}/` which renders them as generic records — no concept-specific sections (definition, inclusion/exclusion criteria, ancestry, implementation refs as game links).

2. **No design-space graph visualization**: Design relations are a flat list. The graph structure (primitive → pressure → tension ← pressure ← primitive) is not visualized. Users cannot see the design space topology.

3. **No concept filtering or grouping on `/design`**: All 74 concepts are in a single flat grid. No filter by `concept_type`, no grouping by design primitive, no search within concepts.

4. **`/compare` shows raw record counts only**: No concept coverage, no design primitive presence, no implementation comparison. The comparison is structural (how many records) not semantic (which mechanics).

5. **`design-data.ts` filters by `relation_scope === "design"`**: Our relations use `relation_scope: "cross_game"`, so the design page shows zero design relations. This is a bug.

## Problem

Without these improvements:

1. **Concepts are second-class citizens**: Users cannot browse concepts meaningfully — they see a flat list of titles with no context, no grouping, no filtering.

2. **Design space is opaque**: The tension graph (which pressures conflict and why) is invisible. Users cannot reason about design tradeoffs.

3. **Comparison is superficial**: Game comparison shows "NetHack has 830 records, Cataclysm-BN has 7,447" — informative for scale but not for design analysis.

4. **Design page is broken**: `design-data.ts` filters by `relation_scope === "design"` but our relations have `relation_scope: "cross_game"`. The design relations section shows zero items.

## Decision

### D1: Fix `design-data.ts` relation scope filter

Change the filter from `relation_scope === "design"` to also include `relation_scope === "cross_game"`:

```typescript
const designRelations = store.relations.filter(
  (r) => r.relation_scope === "design" || r.relation_scope === "cross_game",
);
```

Also filter to design-specific relation types only (same as MCP `queryDesignSpace`):

```typescript
const designRelationTypes = new Set([
  "CREATES_PRESSURE", "tensions_with", "pressures", "synergizes_with",
  "HAS_MUTATION_VECTOR", "IMPLEMENTED_AS", "HAS_COUNTERPLAY", "CAN_FAIL_AS",
]);
designRelations = designRelations.filter((r) => designRelationTypes.has(r.relation_type));
```

**Files**: `apps/web/src/lib/design-data.ts`

### D2: Add concept-specific record page rendering

In the record page template (`apps/web/src/pages/records/[...key]/` or equivalent), add concept-specific sections when `record_type === "concept"`:

- **Definition** — full text, prominently displayed
- **Inclusion criteria** — bulleted list
- **Exclusion criteria** — bulleted list
- **Implementation references** — links to game records, grouped by source game
- **Ancestry** — source games, observed_in, mutation_dimensions
- **Related concepts** — via relations (CREATES_PRESSURE, tensions_with, etc.)

**Files**: `apps/web/src/pages/records/` — add concept section to record page template. New `ConceptDetails.astro` component.

### D3: Add `/concepts` index page

Create a dedicated concepts index page at `/concepts` that:

1. Lists all concepts grouped by `concept_type` (design_primitive, design_pressure, cross_game_mechanic, mutation_vector, design_knob, counterplay_pattern, failure_mode)
2. Shows counts per type
3. Provides filter buttons (All, Design Primitives, Design Pressures, Cross-Game Mechanics, etc.)
4. Each concept links to its individual page
5. Search/filter within concepts by title

**Files**: `apps/web/src/pages/concepts.astro` — new page. `apps/web/src/lib/design-data.ts` — extend to provide grouped concept data.

### D4: Add design-space graph visualization on `/design`

Replace the flat design relations list with an interactive graph visualization:

- **Nodes**: design primitives (squares), design pressures (circles), tensions (diamonds)
- **Edges**: CREATES_PRESSURE (solid arrows), tensions_with (dashed bidirectional)
- **Layout**: force-directed or hierarchical (primitives at top, pressures below, tensions between)
- **Interactivity**: click a node to navigate to its concept page; hover to highlight connected edges

**Implementation approach**: Use a lightweight SVG-based graph renderer (no heavy JS framework). Generate the SVG server-side in the Astro component from the relation data. Add minimal client-side JS for hover effects and click navigation.

**Files**: `apps/web/src/components/DesignGraph.astro` — new component. `apps/web/src/pages/design.astro` — replace section 03 with graph component.

### D5: Enhance `/compare` with concept coverage

Extend the compare page to show:

1. **Concept coverage matrix**: a table of games × concept_types with counts
2. **Design primitive presence**: which primitives each game has (checkmarks/crosses)
3. **Concept gap analysis**: which concepts are missing from which games

**Files**: `apps/web/src/pages/compare/[...filter].astro` — extend with concept data. `apps/web/src/lib/design-data.ts` — add `buildCoverageMatrix()` function.

### D6: Add per-game concept section on `/games/[sourceId]/`

On each game's page, add a "Concepts" section showing:

1. Which design primitives this game implements
2. Which cross-game mechanics this game participates in
3. Which design pressures are relevant to this game
4. Links to concept pages

**Files**: `apps/web/src/pages/games/[sourceId]/` — add concept section. `apps/web/src/lib/design-data.ts` — add `buildGameConceptCoverage(sourceId)` function.

## Architectural fit

- **RFC-0003** (design layer expansion) — this RFC surfaces the concepts and relations created by RFC-0003 in the web UI. The 15 design primitives, 31 design pressures, 56 mutation vectors, 224 design knobs, 93 counterplay patterns, and 28 failure modes are all records in the projection store. The web app reads them via `ProjectionStore` — same as all existing pages.
- **RFC-0004** (cross-game analysis tools) — this RFC brings the MCP tool functionality (`get_coverage_matrix`, `get_concept_coverage`, `find_concept_gaps`) to the web UI. The web implementations are independent (pure projection over `ProjectionStore`), not calls to the MCP server.
- **PLAN-003** (knowledge base enrichment) — the design layer concepts and relations are the output of `scripts/run-stage-design.ts` (PLAN-003 task C-2). This RFC makes them visible in the web app.
- **`apps/web/src/lib/design-data.ts`** — existing module with `buildDesignData()`. All new data functions (`buildCoverageMatrix()`, `buildGameConceptCoverage()`) extend this module.
- **`apps/web/src/lib/page-data.ts`** — existing module with `buildCompareRows()`, `recordsForSource()`, `getStats()`. New functions follow the same pure-projection pattern.
- **Astro static generation** — all pages are pre-rendered at build time. New pages (`/concepts`) and modified pages (`/design`, `/compare`, `/games/[sourceId]/`, `/records/[...key]/`) follow the existing `getStaticPaths()` pattern.
- **Package boundaries** — all changes are within `apps/web/`. No cross-app imports. The web app reads from `ProjectionStore` (provided by `@roguelike-games-ib/projection-sdk`) — same as all existing pages.

## Design

### TypeScript contracts

```typescript
// design-data.ts — new functions

interface CoverageMatrixOutput {
  matrix: Record<string, Record<string, number>>; // sourceId → conceptType → count
  conceptTypes: string[];
  sourceIds: string[];
}

function buildCoverageMatrix(store: ProjectionStore): CoverageMatrixOutput;

interface GameConceptCoverage {
  designPrimitives: ConceptCard[];
  crossGameMechanics: ConceptCard[];
  designPressures: ConceptCard[];
}

function buildGameConceptCoverage(store: ProjectionStore, sourceId: string): GameConceptCoverage;

// ConceptDetails.astro — props
interface ConceptDetailsProps {
  record: CanonicalRecord;
  relations: Relation[];
  records: CanonicalRecord[];
}

// DesignGraph.astro — props
interface DesignGraphProps {
  designRelations: DesignRelationCard[];
  concepts: CanonicalRecord[];
  primitives: CanonicalRecord[];
}
```

### Edge cases

- **Empty design relations**: `DesignGraph.astro` renders an empty state message ("No design relations found.") when `designRelations.length === 0`. Same pattern as existing sections in `design.astro`.
- **Concept without `inclusion_criteria` or `exclusion_criteria`**: `ConceptDetails.astro` omits the section if the field is null or empty. No error.
- **Concept without `implementation_refs`**: `ConceptDetails.astro` shows "No implementation references." instead of an empty list.
- **Dangling `implementation_refs`**: `ConceptDetails.astro` resolves refs via `idToRecord` map. Unresolved refs are skipped (not rendered as broken links). Same pattern as `design-data.ts` line 18.
- **Concept without `ancestry`**: `ConceptDetails.astro` shows empty ancestry section. No error.
- **Game with no concepts**: `buildGameConceptCoverage()` returns empty arrays for all sections. The game page shows "No concepts found for this game."
- **Coverage matrix with zero counts**: `buildCoverageMatrix()` returns `0` for each game × concept_type cell where no concepts exist. No error.

### Progressive enhancement

Client-side JavaScript uses progressive enhancement:
- `/concepts` filter buttons: without JS, all concepts are visible in grouped sections. With JS, filter buttons show/hide sections by `concept_type`.
- `DesignGraph` hover effects: without JS, the graph is fully visible with all nodes and edges. With JS, hovering a node highlights connected edges.
- No functionality depends on JavaScript — JS only enhances the experience.

## Implementation plan

### Step 1: Fix design-data.ts scope filter (D1)

1. Update `designRelations` filter to include `cross_game` scope
2. Add design relation type filter
3. Rebuild web app and verify design relations now appear

**Files**: `apps/web/src/lib/design-data.ts`

**Verification**: `pnpm exec tsx scripts/run-build-web.ts` — design page shows relations.

### Step 2: Add ConceptDetails component (D2)

1. Create `apps/web/src/components/ConceptDetails.astro`
2. Render: definition, inclusion_criteria, exclusion_criteria, implementation_refs (as links), ancestry
3. In the record page template, detect `record_type === "concept"` and render `ConceptDetails`
4. Build and verify concept record pages render correctly

**Files**: `apps/web/src/components/ConceptDetails.astro`, record page template

### Step 3: Add /concepts index page (D3)

1. Create `apps/web/src/pages/concepts.astro`
2. Group concepts by `concept_type` with counts
3. Add filter buttons (client-side JS: show/hide sections by type)
4. Each concept card links to `/records/{key}/`
5. Build and verify

**Files**: `apps/web/src/pages/concepts.astro`, `apps/web/src/lib/design-data.ts`

### Step 4: Add DesignGraph component (D4)

1. Create `apps/web/src/components/DesignGraph.astro`
2. Generate SVG from design relations data:
   - Compute node positions (simple hierarchical layout: primitives row, pressures row)
   - Draw edges as SVG paths with arrowheads
   - Add text labels for nodes
3. Add minimal client JS for hover highlighting
4. Replace flat relations list in `design.astro` with `DesignGraph`
5. Build and verify graph renders

**Files**: `apps/web/src/components/DesignGraph.astro`, `apps/web/src/pages/design.astro`

### Step 5: Enhance /compare with concept coverage (D5)

1. Add `buildCoverageMatrix()` to `design-data.ts`
2. Extend `compare/[...filter].astro` to show:
   - Coverage matrix table (games × concept_types)
   - Design primitive presence table (games × primitives, with ✓/✗)
   - Gap analysis (concepts missing from each game)
3. Build and verify

**Files**: `apps/web/src/pages/compare/[...filter].astro`, `apps/web/src/lib/design-data.ts`

### Step 6: Add per-game concept section (D6)

1. Add `buildGameConceptCoverage(sourceId)` to `design-data.ts`
2. In `games/[sourceId]/` page template, add "Concepts" section
3. Show design primitives, cross-game mechanics, and pressures for this game
4. Build and verify

**Files**: `apps/web/src/pages/games/[sourceId]/`, `apps/web/src/lib/design-data.ts`

### Step 7: Rebuild and verify

1. `pnpm exec tsx scripts/run-build-web.ts` — full rebuild
2. Verify page count (should increase by ~1 for /concepts)
3. Spot-check: /design shows graph, /concepts shows grouped list, /compare shows coverage matrix, /games/nethack/ shows concept section
4. `pnpm exec vitest --run` — all tests pass

## Rollout

**Default behavior**: All changes are immediately active upon rebuild. No feature flags, no gradual rollout. The web app is statically generated — changes take effect on next `pnpm exec tsx scripts/run-build-web.ts`.

**Adoption path**: No migration needed — all changes are additions to existing pages or new pages. Existing pages (`/design`, `/compare`, `/games/[sourceId]/`, `/records/[...key]/`) are modified in place. The `/concepts` page is new.

**Build impact**: Adding `/concepts` is +1 page. Modifying existing pages does not change page count. SVG graph computation in `DesignGraph.astro` runs at build time — cost is proportional to design relations count (~100 relations), negligible compared to 16,195 pages.

## Acceptance criteria

- [x] `/design` page shows design-space graph (not flat list) with primitives, pressures, and tensions (evidence: apps/web/src/components/DesignGraph.astro:1-120, apps/web/src/pages/design.astro:93-115)
- [x] `/design` page shows design relations (fix: scope filter includes `cross_game`) (evidence: apps/web/src/lib/design-data.ts:28-30, build:check pass)
- [x] `/concepts` page lists all concepts grouped by `concept_type` with filtering (evidence: apps/web/src/pages/concepts.astro:1-85, apps/web/src/lib/design-data.ts:129-139)
- [x] Individual concept record pages show definition, criteria, implementation refs, ancestry (evidence: apps/web/src/components/ConceptDetails.astro:1-130, apps/web/src/pages/records/[...key].astro:90-92)
- [x] `/compare` page shows concept coverage matrix and design primitive presence (evidence: apps/web/src/pages/compare/[...filter].astro:100-160, apps/web/src/lib/design-data.ts:148-189)
- [x] `/games/[sourceId]/` pages show concept section with relevant primitives and mechanics (evidence: apps/web/src/pages/games/[sourceId]/[...filter].astro:131-168, apps/web/src/lib/design-data.ts:197-230)
- [x] Web app builds without errors (evidence: pnpm --filter web run build:check — pass, 0 errors)
- [x] All existing tests pass (no regressions) (evidence: pnpm exec vitest --run — 665 passed, 0 failed)

## Alternatives considered

**A. Use a JS graph library (D3.js, vis.js) instead of pure SVG** — Rejected because the web app is statically generated and the RFC's nonGoals exclude interactive JS frameworks. A pure SVG graph rendered server-side with minimal client JS for hover effects is sufficient and keeps the bundle small.

**B. Create separate `/concept/[key]` pages instead of enriching `/records/[...key]/`** — Rejected because concept records already have pages at `/records/{key}/`. Creating duplicate pages would break existing links and increase page count unnecessarily. Enriching the existing record page with concept-specific sections is simpler and maintains a single URL per record.

**C. Add concept coverage to `/compare` as a separate page instead of extending the existing page** — Rejected because the compare page already supports type/source filtering. Adding concept coverage as additional sections on the existing page is more cohesive than a separate page.

**D. Use MCP tools from the web app instead of reimplementing the logic** — Rejected because the web app is statically generated at build time. MCP tools are runtime server-side tools. The web app needs build-time data access via `ProjectionStore`, not runtime MCP calls.

## Risks

- **SVG graph complexity**: Force-directed layout in pure SVG is non-trivial. Mitigation: use a simple hierarchical layout (primitives in top row, pressures in bottom row, tensions as curved edges between pressures). No physics simulation needed.
- **Page count growth**: Adding /concepts is +1 page. Concept record pages already exist as /records/{key}/. No significant growth.
- **Build time**: The web app already builds 16,195 pages. Adding concept sections to existing pages should not significantly increase build time. Mitigation: profile build time before and after.
- **Client-side JS**: Adding filter buttons and hover effects requires minimal JS. Mitigation: use vanilla JS in `<script>` tags, no framework dependency. Progressive enhancement: pages work without JS, JS only enhances.
- **Agent misinterpretation**: agents may treat the SVG graph as a fully interactive visualization. It is a static SVG with hover-only interactivity. Mitigation: implementation notes specify the graph is server-rendered SVG with minimal client JS.
- **Large graph readability**: with 15 primitives, 31 pressures, and ~100 relations, the SVG graph may be visually dense. Mitigation: use a hierarchical layout (primitives row, pressures row, tensions as curved edges) with adequate spacing. Nodes are clickable to navigate to concept pages.

## Implementation notes for agents

- Agents MAY implement code changes ONLY when this RFC has status: `accepted` (or `implemented`).
- Agents MUST follow the existing patterns in `apps/web/src/lib/design-data.ts` and `apps/web/src/lib/page-data.ts` — pure projection functions over `ProjectionStore`, no side effects.
- Agents MUST use `HAS_COUNTERPLAY` (not `COUNTERED_BY`) in the designRelationTypes set — `HAS_COUNTERPLAY` is the canonical relation type established by RFC-0003.
- Agents MUST include `pressures` and `synergizes_with` in the designRelationTypes set to match the MCP `queryDesignSpace` tool.
- Agents MUST handle empty states gracefully — every new component and page section must render a meaningful message when data is empty, following the pattern of existing sections (e.g., "No design relations yet.").
- Agents MUST handle dangling `implementation_refs` gracefully — unresolved refs are skipped, not rendered as broken links.
- Agents MUST use progressive enhancement for client-side JS — pages must be fully functional without JS. JS only adds filter/hover enhancements.
- Agents MUST use vanilla JS in `<script>` tags — no framework dependencies (no React, Vue, Svelte client-side).
- Agents MUST NOT introduce cross-app imports — all changes are within `apps/web/`.
- Agents MUST run `pnpm exec tsx scripts/run-build-web.ts` after changes to verify the web app builds without errors.
- Agents MUST run `pnpm exec vitest --run` to verify no test regressions.
- Agents MUST NOT weaken or remove enforcement rules established by this RFC without a new RFC that supersedes it.
