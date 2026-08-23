---
id: PLAN-RFC-0005
title: Web app enrichment — concept pages, design-space graph, and cross-game comparison view
status: accepted
scope: apps/web
decider: architecture
reviewers:
  - human:andrii-syrokomskyi
related:
  - RFC-0005
  - RFC-0003
  - RFC-0004
  - PLAN-003
created: 2026-08-23
accepted: 2026-08-23
implementedAt:
closedAt: null
---

# PLAN-RFC-0005: Web app enrichment — concept pages, design-space graph, and cross-game comparison view

## Context

RFC-0005 is accepted. The web app (`apps/web/`) is a statically generated Astro site with 16,195 pages. RFC-0003 created 15 design primitives, 31 design pressures, 56 mutation vectors, 224 design knobs, 93 counterplay patterns, and 28 failure modes. RFC-0004 created MCP tools for concept coverage analysis. This plan brings those concepts and relations to the web UI.

## Acceptance criteria (from RFC-0005)

- [ ] `/design` page shows design-space graph (not flat list) with primitives, pressures, and tensions
- [ ] `/design` page shows design relations (fix: scope filter includes `cross_game`)
- [ ] `/concepts` page lists all concepts grouped by `concept_type` with filtering
- [ ] Individual concept record pages show definition, criteria, implementation refs, ancestry
- [ ] `/compare` page shows concept coverage matrix and design primitive presence
- [ ] `/games/[sourceId]/` pages show concept section with relevant primitives and mechanics
- [ ] Web app builds without errors
- [ ] All existing tests pass (no regressions)

## Steps

### Step 1: Fix design-data.ts scope filter (D1)

**Objective**: Fix the bug where `designRelations` filters by `relation_scope === "design"` but actual relations use `relation_scope: "cross_game"`.

**Changes**:
1. In `apps/web/src/lib/design-data.ts`, change the `designRelations` filter to include both `"design"` and `"cross_game"` scopes
2. Add design relation type filter using the same set as MCP `queryDesignSpace`:
   ```typescript
   const designRelationTypes = new Set([
     "CREATES_PRESSURE", "tensions_with", "pressures", "synergizes_with",
     "HAS_MUTATION_VECTOR", "IMPLEMENTED_AS", "HAS_COUNTERPLAY", "CAN_FAIL_AS",
   ]);
   ```
3. Filter `designRelations` by `designRelationTypes.has(r.relation_type)`

**Files**: `apps/web/src/lib/design-data.ts`

**Completion criterion**: `designRelationCards.length > 0` after rebuild. Verify by checking the design page shows relations.

**Verification**: `pnpm exec tsx scripts/run-build-web.ts` — design page section 03 shows relations.

### Step 2: Add ConceptDetails component (D2)

**Objective**: Add concept-specific sections to record pages when `record_type === "concept"`.

**Changes**:
1. Create `apps/web/src/components/ConceptDetails.astro` with props: `record`, `relations`, `records`
2. Render sections:
   - **Definition** — `record.definition` (full text, prominently displayed)
   - **Inclusion criteria** — `record.inclusion_criteria` as bulleted list (omit if null/empty)
   - **Exclusion criteria** — `record.exclusion_criteria` as bulleted list (omit if null/empty)
   - **Implementation references** — resolve `record.implementation_refs` via `idToRecord` map, group by `source_id`, link to `/records/{key}/`. Skip unresolved refs. Show "No implementation references." if empty.
   - **Ancestry** — `record.ancestry.source_games`, `record.ancestry.observed_in`, `record.ancestry.mutation_dimensions`
   - **Related concepts** — from relations where `relation_type` is in designRelationTypes, link to concept pages
3. In `apps/web/src/pages/records/[...key].astro`, add conditional rendering: when `record.record_type === "concept"`, render `<ConceptDetails>` after `<RecordAttributes>` and before claims section
4. Handle edge cases: null fields, dangling refs, empty ancestry

**Files**: `apps/web/src/components/ConceptDetails.astro`, `apps/web/src/pages/records/[...key].astro`

**Completion criterion**: Concept record pages (e.g., `/records/cross-game/concept/design-permadeath/`) show definition, criteria, implementation refs, and ancestry sections.

**Verification**: Build web app, spot-check a concept record page.

### Step 3: Add /concepts index page (D3)

**Objective**: Create a dedicated concepts index page with grouping by `concept_type` and filtering.

**Changes**:
1. Add `buildConceptsByType(store)` function to `apps/web/src/lib/design-data.ts` — groups all concept records by `concept_type`, returns `{ type: string, concepts: ConceptCard[] }[]` sorted by type name
2. Create `apps/web/src/pages/concepts.astro`:
   - `getStaticPaths` not needed (single page, no dynamic params)
   - Group concepts by `concept_type` with counts per type
   - Each concept card links to `/records/{key}/`
   - Add filter buttons (All, Design Primitives, Design Pressures, Cross-Game Mechanics, etc.) using vanilla JS in `<script>` tag
   - Progressive enhancement: without JS, all groups visible; with JS, filter buttons show/hide groups
3. Add "Concepts" link to navigation (in `Base.astro` layout or wherever nav is defined)

**Files**: `apps/web/src/lib/design-data.ts`, `apps/web/src/pages/concepts.astro`, `apps/web/src/layouts/Base.astro` (nav update)

**Completion criterion**: `/concepts` page renders with all concepts grouped by type, filter buttons work.

**Verification**: Build web app, verify `/concepts` page exists and shows grouped concepts.

### Step 4: Add DesignGraph component (D4)

**Objective**: Replace the flat design relations list on `/design` with an SVG-based graph visualization.

**Changes**:
1. Create `apps/web/src/components/DesignGraph.astro` with props: `designRelations`, `concepts`, `primitives`
2. Generate SVG from design relations data:
   - Compute node positions using simple hierarchical layout: primitives in top row, pressures in middle row, tensions as curved edges between pressures
   - Draw edges as SVG paths with arrowheads (solid for CREATES_PRESSURE, dashed for tensions_with)
   - Add text labels for nodes (concept titles)
   - Nodes are clickable (`<a href="/records/{key}/">` wrapping or `xlink:href`)
   - Empty state: render "No design relations found." when `designRelations.length === 0`
3. Add minimal client JS in `<script>` tag for hover highlighting (add/remove CSS class on connected edges)
4. In `apps/web/src/pages/design.astro`, replace section 03 (flat list) with `<DesignGraph>` component
5. Progressive enhancement: graph is fully visible without JS; JS only adds hover effects

**Files**: `apps/web/src/components/DesignGraph.astro`, `apps/web/src/pages/design.astro`

**Completion criterion**: `/design` page section 03 shows SVG graph with primitives, pressures, and tension edges. Nodes are clickable.

**Verification**: Build web app, spot-check `/design` page shows graph instead of flat list.

### Step 5: Enhance /compare with concept coverage (D5)

**Objective**: Add concept coverage matrix and design primitive presence to the compare page.

**Changes**:
1. Add `buildCoverageMatrix(store)` to `apps/web/src/lib/design-data.ts`:
   - Returns `{ matrix: Record<string, Record<string, number>>, conceptTypes: string[], sourceIds: string[] }`
   - For each concept, determine which games it covers (from `ancestry.source_games` or by resolving `implementation_refs` to records and checking their `source_id`)
   - Build count matrix: `matrix[sourceId][conceptType] = count`
2. Extend `apps/web/src/pages/compare/[...filter].astro`:
   - Add coverage matrix table section (games × concept_types with counts)
   - Add design primitive presence table (games × primitives, with ✓/✗)
   - Add gap analysis section (concepts missing from each game)
   - These sections are shown on all compare pages (not filtered by type/source)
3. Handle edge cases: zero counts, missing concepts, games with no concepts

**Files**: `apps/web/src/lib/design-data.ts`, `apps/web/src/pages/compare/[...filter].astro`

**Completion criterion**: `/compare` page shows coverage matrix table and design primitive presence table.

**Verification**: Build web app, spot-check `/compare` page shows coverage data.

### Step 6: Add per-game concept section (D6)

**Objective**: Add a "Concepts" section to each game's page showing relevant design primitives, cross-game mechanics, and design pressures.

**Changes**:
1. Add `buildGameConceptCoverage(store, sourceId)` to `apps/web/src/lib/design-data.ts`:
   - Returns `{ designPrimitives: ConceptCard[], crossGameMechanics: ConceptCard[], designPressures: ConceptCard[] }`
   - For each category, find concepts where `ancestry.source_games` includes `sourceId` or `implementation_refs` resolves to records from that game
2. In `apps/web/src/pages/games/[sourceId]/[...filter].astro`, add a "Concepts" section (CollapsibleSection) after the Coverage section:
   - Show design primitives (with links to concept pages)
   - Show cross-game mechanics (with links)
   - Show design pressures (with links)
   - Empty state: "No concepts found for this game."
3. Handle edge cases: game with no concepts, empty sections

**Files**: `apps/web/src/lib/design-data.ts`, `apps/web/src/pages/games/[sourceId]/[...filter].astro`

**Completion criterion**: `/games/nethack/` page shows Concepts section with relevant primitives and mechanics.

**Verification**: Build web app, spot-check a game page shows concept section.

### Step 7: Rebuild and verify

**Objective**: Full rebuild and verification of all changes.

**Changes**:
1. Run `pnpm exec tsx scripts/run-build-web.ts` — full rebuild
2. Verify page count (should increase by ~1 for `/concepts`)
3. Spot-check:
   - `/design` shows SVG graph with primitives, pressures, tensions
   - `/design` shows design relations (scope filter fix)
   - `/concepts` shows grouped list with filter buttons
   - `/records/cross-game/concept/design-permadeath/` shows concept details
   - `/compare` shows coverage matrix and primitive presence
   - `/games/nethack/` shows concept section
4. Run `pnpm exec vitest --run` — all tests pass

**Completion criterion**: Web app builds without errors, all spot-checks pass, all tests pass.

**Verification**: Build output shows no errors. Test output shows 0 failures.

### Step 8: Review and fix

**Objective**: Run `fo-review` on all session code changes and `fo-fix` if findings.

**Changes**:
1. Run `fo-review` with scope: all code changes made in this session
2. If review has findings, run `fo-fix` to address them
3. Re-verify after fixes

**Completion criterion**: Review report exists in `docs/reviews/code/`, any findings addressed.

### Step 9: Stamp implemented

**Objective**: Transition RFC-0005 from `accepted` to `implemented`.

**Changes**:
1. Run `pnpm exec forge rfc.implement.stamp --id RFC-0005 --implementation-commit <sha>`
2. Verify RFC status is now `implemented`

**Completion criterion**: RFC-0005 status is `implemented` in frontmatter.

## File system responsibilities

| Path | Role |
|---|---|
| `apps/web/src/lib/design-data.ts` | Fix scope filter (D1), add `buildConceptsByType()`, `buildCoverageMatrix()`, `buildGameConceptCoverage()` |
| `apps/web/src/components/ConceptDetails.astro` | New component — concept-specific sections for record pages (D2) |
| `apps/web/src/pages/records/[...key].astro` | Add conditional ConceptDetails rendering (D2) |
| `apps/web/src/pages/concepts.astro` | New page — concepts index with grouping and filtering (D3) |
| `apps/web/src/layouts/Base.astro` | Add "Concepts" nav link (D3) |
| `apps/web/src/components/DesignGraph.astro` | New component — SVG graph visualization (D4) |
| `apps/web/src/pages/design.astro` | Replace flat relations list with DesignGraph (D4) |
| `apps/web/src/pages/compare/[...filter].astro` | Add coverage matrix and primitive presence sections (D5) |
| `apps/web/src/pages/games/[sourceId]/[...filter].astro` | Add Concepts section (D6) |

## Risks and mitigations

- **SVG graph complexity**: Use simple hierarchical layout (primitives row, pressures row, tensions as curved edges). No physics simulation. ~100 relations is manageable.
- **Build time**: SVG computation is proportional to design relations count (~100), negligible vs 16,195 pages.
- **Client-side JS**: Progressive enhancement — pages work without JS. Vanilla JS in `<script>` tags only.
- **Empty states**: Every new component handles empty data with meaningful messages.
