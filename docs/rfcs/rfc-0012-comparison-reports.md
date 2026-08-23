---
id: RFC-0012
title: "Comparison reports — auto-generated markdown cross-game analysis"
status: draft
kind: policy
scope: workspace
owners:
  - architecture
reviewers:
  - human:andrii-syrokomskyi
createdAt: 2026-08-23
updatedAt: 2026-08-23
enhancedAt: 2026-08-23
implementedAt:
closedAt:
supersedes: []
supersededBy:
amends: []
amendedBy:
related:
  - RFC-0004
  - RFC-0009
  - RFC-0011
satisfies: []
versionBump: minor
commands:
  proposed: []
  added: []
  changed: []
  removed: []
appsImpacted:
  - mcp
  - web
packagesImpacted:
  - builders/obsidian-builder
successSignals:
  - MCP generate_comparison_report produces structured markdown for any concept × games pair
  - Reports include coverage, implementation differences, attribute comparison, and design tensions
  - Reports are exportable to Obsidian vault
  - Web app has "Download report" button on compare page
nonGoals:
  - Does not generate PDF or HTML reports — markdown only
  - Does not auto-publish reports — generation is on-demand
  - Does not compare definition records — focuses on concepts and design space
  - Does not share report generation logic between MCP and web via a shared package — each implements independently following the existing pattern (MCP tools in apps/mcp/, web functions in apps/web/src/lib/)
---

# RFC-0012: Comparison reports — auto-generated markdown cross-game analysis

## Context

The MCP `compare_games` tool (RFC-0004) returns JSON with record counts and concept coverage. The `compare_concept_implementations` tool returns curated implementation summaries. But there is no way to generate a **readable report** that combines all available cross-game analysis into a single document.

### Current tools

- `compare_games` — JSON output with record counts, concept coverage
- `compare_concept_implementations` — JSON output with curated summaries
- `get_coverage_matrix` — JSON matrix of games × concept_types
- `find_concept_gaps` — JSON list of missing concepts per game

Each tool returns a slice of data. A user wanting a full comparison must call 4+ tools and synthesize the results manually.

## Problem

1. **No synthesized output**: Cross-game analysis requires multiple tool calls and manual synthesis.
2. **No exportable format**: Results are JSON — not readable by humans without formatting.
3. **No Obsidian integration**: The Obsidian vault has no comparison notes — users cannot browse comparisons alongside record notes.
4. **No web export**: The web app `/compare` page shows data but has no "download as report" option.

## Architectural fit

- **RFC-0004** (cross-game analysis tools) — this RFC synthesizes the output of 6 tools created by RFC-0004 and related RFCs into a single report. The new tool follows the existing pattern: function in a tools module, registration in `server.ts`, `readOnly: true`, entry in `REQUIRED_TOOLS`.
- **RFC-0009** (concept quality scoring) — quality scores are visible in the report's concept coverage section. No scoring changes needed.
- **RFC-0011** (game design pattern library) — design patterns and concrete examples are available as additional report content. The report includes pattern coverage when `concept_key` is omitted.
- **Package boundaries**: MCP tool goes in `apps/mcp/src/tools/report.ts` (new file, not `derived.ts`, to avoid circular dependency with `compare.ts` which imports from `derived.ts`). Web report function goes in `apps/web/src/lib/report.ts`. Obsidian report generation goes in `packages/builders/obsidian-builder/src/report.ts`. All follow existing import patterns: `apps/* → packages/*`, no `apps/* → apps/*`.
- **No shared report logic between MCP and web**: The MCP tool calls existing tool functions via `McpContext`. The web app generates reports from `ProjectionStore` directly. These are different data access patterns — `McpContext` wraps `ProjectionStore` with envelope/pagination helpers, while the web app accesses `ProjectionStore` directly. A shared package would require abstracting over both access patterns, which is speculative generality for the current scope. Each implements independently, consistent with the existing pattern where MCP tools and web functions do not share logic.
- **AGENTS.md updates**: No `AGENTS.md` rule changes needed. New web files must include `MODULE_CONTRACT` and `CHANGE_SUMMARY` comments per `apps/web/AGENTS.md`.
- **Concept schema**: No schema changes. The report tool reads existing fields from `rgkb/concept@2` records.

## Decision

### D1: MCP tool `generate_comparison_report`

New MCP tool that produces a structured markdown report:

```markdown
# Cross-game comparison: NetHack vs Crawl

## Overview
- **NetHack**: 1,041 records, 10 dimensions
- **Crawl**: 7,834 records, 12 dimensions

## Concept coverage
| Concept type | NetHack | Crawl |
|---|---|---|
| design_primitive | 10 | 12 |
| cross_game_mechanic | 15 | 18 |
| ...

## Design primitive comparison
### Permadeath
- **NetHack**: Death is fully permanent. No respawn. Save file deleted.
- **Crawl**: Death is permanent. No respawn. No meta-progression.

### Identification
- **NetHack**: Scroll/scroll/spell identification. Items have hidden properties.
- **Crawl**: Scroll identification only. Simpler system.

## Concept gaps
- **Missing from NetHack**: religion_and_god (Crawl has gods, NetHack has no god system)
- **Missing from Crawl**: ...

## Design tensions
- Both games share: information_scarcity ↔ consequence_persistence
- NetHack-specific: alignment ↔ chaos
- Crawl-specific: species_diversity ↔ build_commitment

## Attribute comparison (top 5 shared attributes)
| Attribute | NetHack values | Crawl values |
|---|---|---|
| material | iron, wood, silver, ... | iron, wood, ...
| ...
```

**Input**: `{ source_ids: string[]; concept_key?: string; format?: "markdown" | "json"; sections?: string[] }`

When `concept_key` is provided, generates a single-concept comparison (only sections relevant to that concept). When omitted, generates a full game comparison.

When `sections` is provided, only the named sections are included. Valid section names: `"overview"`, `"coverage"`, `"primitives"`, `"gaps"`, `"tensions"`, `"attributes"`. When omitted, all sections are included.

**Output**: Markdown string (or JSON object with section keys if `format: "json"`).

**Files**: `apps/mcp/src/tools/report.ts` (new), `apps/mcp/src/server.ts`

### D2: Report sections

The report assembles data by calling existing tool functions directly. The new `generateComparisonReport()` function in `tools/report.ts` imports and calls these functions, passing `ctx` (McpContext) through:

1. **Overview** — calls `compareGames(ctx, { source_ids, include_concepts: true })` from `tools/compare.ts`
2. **Concept coverage** — calls `getCoverageMatrix(ctx, {})` from `tools/derived.ts`, filters matrix to requested `source_ids`
3. **Design primitive comparison** — calls `compareConceptImplementations(ctx, { concept_key, source_ids })` from `tools/derived.ts` for each design primitive concept
4. **Concept gaps** — calls `findConceptGaps(ctx, {})` from `tools/derived.ts`, filters gaps to requested `source_ids`
5. **Design tensions** — calls `queryDesignSpace(ctx, {})` from `tools/design.ts` (no `primitive_key` filter — returns all design-space relations)
6. **Attribute comparison** — calls `findByAttribute(ctx, { attribute, value })` from `tools/queries.ts` for top shared attributes across games

The function lives in `tools/report.ts` (new file) to avoid circular dependency: `compare.ts` already imports `getConceptSourceIds` from `derived.ts`, so `derived.ts` cannot import from `compare.ts` without creating a cycle. `report.ts` imports from all needed modules without creating cycles.

### D3: Obsidian vault integration

Add an optional `reports` flag to `ObsidianBuildOptions` and a `generateComparisonNotes()` function in `packages/builders/obsidian-builder/src/report.ts`. When enabled, `buildObsidianVault()` generates comparison report notes after rendering record/source notes:

- Notes stored in `reports/comparisons/` in the vault
- Each note has wiki-links to relevant concept and record notes (resolved via existing `PathResolver` and `makeWikiLink()` from `links.ts`)
- Report notes are NOT canonical records — they are generated artifacts, similar to the MOC. Wiki-links from report notes to record notes use `makeWikiLink(resolver, aliasMap, recordId)` which resolves via the existing `PathResolver`.
- MOC entry: extend `renderMoc()` in `moc.ts` to include a "## Comparison Reports" section listing generated report notes. Alternatively, add a separate `renderReportsMoc()` function.
- `scripts/run-build-obsidian.ts` passes `reports: true` in `ObsidianBuildOptions` when `--report` flag is present (parsed via `process.argv.includes('--report')`)

**Files**: `packages/builders/obsidian-builder/src/report.ts` (new), `packages/builders/obsidian-builder/src/build.ts`, `packages/builders/obsidian-builder/src/moc.ts`, `scripts/run-build-obsidian.ts`

### D4: Web app "Download report" button

The web app is static — it cannot call the MCP tool. The report must be generated client-side from `ProjectionStore` data (the same data the compare page uses).

Add a `generateReport()` function in `apps/web/src/lib/report.ts` that builds markdown from projection store data. The function takes `store: ProjectionStore` and `sourceIds: string[]` and returns a markdown string. It assembles the same 6 sections as the MCP tool, but reads from `store` directly instead of calling MCP tool functions.

On `/compare`, add a "Download report" button that:
1. Calls `generateReport(store, sourceIds)` client-side
2. Creates a `Blob` with `type: 'text/markdown'`
3. Triggers download via `URL.createObjectURL()` and a temporary `<a>` element

The compare page is a static `.astro` page. Add a `<script>` tag with the download logic. The `store` data is serialized into the page during `getStaticPaths()` (same pattern as `coverageMatrix` and `primitivePresence` props).

**Files**: `apps/web/src/lib/report.ts` (new), `apps/web/src/pages/compare/[...filter].astro`

## Implementation plan

### Step 1: Implement generate_comparison_report MCP tool (D1, D2)

1. Create `apps/mcp/src/tools/report.ts` with `generateComparisonReport()`
2. Import and call existing tool functions from `compare.ts`, `derived.ts`, `design.ts`, `queries.ts`
3. Assemble report sections, return markdown string (or JSON object if `format: "json"`)
4. Register in `server.ts` with `readOnly: true`
5. Add `generate_comparison_report` to `REQUIRED_TOOLS`

**Files**: `apps/mcp/src/tools/report.ts` (new), `apps/mcp/src/server.ts`

### Step 2: Add Obsidian report generation (D3)

1. Create `packages/builders/obsidian-builder/src/report.ts` with `generateComparisonNotes()`
2. Add `reports?: boolean` to `ObsidianBuildOptions` in `build.ts`
3. When `reports: true`, call `generateComparisonNotes()` after rendering record/source notes
4. Extend `renderMoc()` in `moc.ts` with a "## Comparison Reports" section
5. Update `scripts/run-build-obsidian.ts` to pass `reports: true` when `--report` flag is present

**Files**: `packages/builders/obsidian-builder/src/report.ts` (new), `packages/builders/obsidian-builder/src/build.ts`, `packages/builders/obsidian-builder/src/moc.ts`, `scripts/run-build-obsidian.ts`

### Step 3: Add web report generation (D4)

1. Create `apps/web/src/lib/report.ts` with `generateReport(store: ProjectionStore, sourceIds: string[]): string`
2. Add "Download report" button to compare page with `<script>` tag for client-side download
3. Serialize necessary store data into page props during `getStaticPaths()`
4. Client-side JS calls `generateReport()`, creates Blob, triggers download via `URL.createObjectURL()`

**Files**: `apps/web/src/lib/report.ts` (new), `apps/web/src/pages/compare/[...filter].astro`

### Step 4: Tests and verify

1. Add `tests/mcp/mcp-013.test.ts` testing MCP tool with 2-game and 4-game comparisons, `sections` filter, `format: "json"`, and `concept_key` single-concept mode
2. Add test for Obsidian report generation (report notes exist, wiki-links resolve)
3. Add test for web `generateReport()` function
4. `pnpm exec turbo run build:check && pnpm exec vitest --run`

**Files**: `tests/mcp/mcp-013.test.ts` (new)

## Design

### TypeScript contracts

```typescript
// MCP tool (apps/mcp/src/tools/report.ts)
interface GenerateComparisonReportInput {
  source_ids: string[]; // 2..8
  concept_key?: string; // single-concept mode
  format?: "markdown" | "json"; // default: "markdown"
  sections?: string[]; // subset of: overview, coverage, primitives, gaps, tensions, attributes
}

function generateComparisonReport(
  ctx: McpContext,
  input: GenerateComparisonReportInput,
): Envelope<{ report: string } | { sections: Record<string, unknown> }>;

// Web report (apps/web/src/lib/report.ts)
function generateReport(
  store: ProjectionStore,
  sourceIds: string[],
  options?: { conceptKey?: string; sections?: string[] },
): string; // markdown string

// Obsidian report (packages/builders/obsidian-builder/src/report.ts)
function generateComparisonNotes(
  store: ProjectionStore,
  resolver: PathResolver,
  vaultRoot: string,
): string[]; // list of generated note paths
```

### Edge cases

- **Only 1 `source_id` provided**: `compare_games` requires 2..8 source_ids. The report tool validates input and throws `ValidationError` if fewer than 2 source_ids are provided.
- **`source_id` doesn't exist**: `compare_games` throws `NotFoundError`. The report tool propagates this error.
- **`concept_key` doesn't match any concept**: The report returns an empty primitives section with a note: "No concept found for key: <concept_key>". Other sections (overview, coverage, gaps) still render.
- **All curated summaries missing**: `compare_concept_implementations` returns `implementation_summary: null` for games without curated notes. The report shows "No curated summary available" and falls back to attribute-based comparison.
- **Empty `concept-implementations.json`**: All primitive comparison entries show "No curated summary available". The section still renders with attribute-based fallback.
- **`sections` parameter with invalid names**: Unknown section names are silently ignored. Valid names are processed in order.
- **`format: "json"`**: Returns a JSON object with section names as keys and section data as values (not markdown strings). Example: `{ "overview": { games: [...] }, "coverage": { matrix: {...} }, ... }`.

### Performance

The MCP tool calls 6 existing tool functions internally. Each function iterates over `ctx.store.records` (currently ~10,000 records). The total cost is 6 full-record iterations. For a 4-game comparison, the response payload could be 50-100 KB of markdown. This is acceptable for an on-demand tool — no caching needed.

The web `generateReport()` function iterates over `store.records` directly with the same 6-pass pattern. The store is already loaded in the page props. No additional data fetching needed.

## Acceptance criteria

- [ ] `generate_comparison_report` MCP tool produces structured markdown for 2+ games (code: agent can implement and test)
- [ ] Report includes: overview, coverage, primitive comparison, gaps, tensions, attribute comparison (code: agent can verify via test)
- [ ] `sections` parameter correctly filters report sections (code: agent can test)
- [ ] `format: "json"` returns structured JSON object (code: agent can test)
- [ ] Obsidian vault includes comparison notes with wiki-links that resolve via `PathResolver` (code: agent can test)
- [ ] Web app compare page has "Download report" button that downloads `.md` file (code: agent can implement and test)
- [ ] Curated summary gaps show "No curated summary available" with attribute-based fallback (code: agent can test; content: curated summaries in `concept-implementations.json` are human-authored and may be incomplete — this is expected and handled gracefully)
- [ ] All tests pass (`pnpm exec turbo run build:check && pnpm exec vitest --run`)

## Risks

- **Report length**: Full 4-game comparison could be 50-100 KB of markdown. Mitigation: the `sections` parameter allows selecting specific sections.
- **Curated summaries dependency**: `compare_concept_implementations` depends on curated notes (RFC-0004 D4). If notes are incomplete, report sections will have `null` summaries. Mitigation: show "No curated summary available" and fall back to attribute-based comparison.
- **Duplicated report logic**: MCP and web implement report generation independently. When report sections change, both implementations must be updated. Mitigation: both follow the same section structure defined in D2. The section list and order are the contract between them.
- **Client-side generation**: Web app is static — no server to call MCP. Mitigation: generate from projection store data directly, same as compare page does.
- **Agent misinterpretation**: Agents may treat the report as authoritative analysis rather than a synthesis of existing data. Mitigation: the report is a projection — it reflects the current state of the knowledge base, including gaps in curated content.

## Rollout

**Default behavior**: All new tools and features are immediately available upon implementation. No feature flags, no gradual rollout.

**MCP tool**: `generate_comparison_report` is a new read-only tool. No existing tools are modified. Existing callers see no change.

**Obsidian vault**: Report generation is opt-in via `reports: true` in `ObsidianBuildOptions` or `--report` flag on `scripts/run-build-obsidian.ts`. Default behavior (without flag) is unchanged — no report notes generated.

**Web app**: The "Download report" button is additive — it does not change existing compare page functionality. The button is visible on all compare pages.

**Adoption path**: No migration needed — all features are additive. Existing tests continue to pass unchanged.

## Alternatives considered

### A1: Generate reports as a materialization-time projection

Instead of on-demand generation, precompute comparison reports during `pnpm materialize` and store them in `dist/reports/`.

**Rejected**: Reports are parameterized by `source_ids`, `concept_key`, `sections`, and `format`. Precomputing all combinations is infeasible (4 games = 6 pairs × 469 concepts × 64 section subsets = ~180,000 reports). On-demand generation is the right model.

### A2: Share report logic between MCP and web via a shared package

Create a `packages/report-builder/` package with a `buildReport(store, options)` function used by both MCP and web.

**Rejected**: The MCP tool calls existing tool functions via `McpContext` (which wraps `ProjectionStore` with envelope/pagination helpers). The web app accesses `ProjectionStore` directly. A shared package would need to abstract over both access patterns, which is speculative generality. The existing pattern in this project is that MCP tools and web functions do not share logic — each implements independently. The section structure (D2) is the contract between them.

### A3: Extend `compare_games` with `format: "markdown"` parameter instead of new tool

Add a `format` parameter to the existing `compare_games` tool that returns markdown instead of JSON.

**Rejected**: `compare_games` returns a structured JSON response with per-game data. A markdown report assembles data from 6 different tools, not just `compare_games`. Overloading `compare_games` with report generation would change its response shape and break existing callers.

## Implementation notes for agents

- **Status gate**: This RFC must be in `accepted` status before implementation begins. Use `fo-idea-plan` to create the implementation plan and transition to `accepted`.
- **New file `apps/mcp/src/tools/report.ts`**: Do NOT add `generateComparisonReport()` to `derived.ts` — `compare.ts` imports `getConceptSourceIds` from `derived.ts`, so `derived.ts` cannot import from `compare.ts` without creating a circular dependency. `report.ts` imports from `compare.ts`, `derived.ts`, `design.ts`, and `queries.ts` without cycles.
- **Register in `REQUIRED_TOOLS`**: Add `generate_comparison_report` to the `REQUIRED_TOOLS` array in `server.ts`. The conformance test checks that all required tools are registered.
- **`readOnly: true`**: The tool is read-only. Set `readOnly: true` in tool registration.
- **MODULE_CONTRACT**: New files in `apps/web/` and `packages/builders/obsidian-builder/` must include `MODULE_CONTRACT` and `CHANGE_SUMMARY` comments per `apps/web/AGENTS.md` and existing package conventions.
- **Obsidian report notes are NOT canonical Records**: They are generated artifacts. Do not create record envelopes for them. Use `writeFileSync()` directly, same as MOC generation in `build.ts`.
- **Web `generateReport()` data access**: The function takes `ProjectionStore` directly. The compare page already serializes store data into props (see `coverageMatrix`, `primitivePresence` in `getStaticPaths()`). Follow the same pattern — serialize the data needed for report generation into page props.
- **Client-side download**: Use `Blob` + `URL.createObjectURL()` pattern. Create a temporary `<a>` element with `download` attribute, click it, then revoke the object URL. This is standard browser API — no dependencies needed.
- **Test file**: `tests/mcp/mcp-013.test.ts` should follow the pattern of existing MCP tests (e.g., `mcp-012.test.ts`). Use the test fixture projection store.
- **Edge cases are mandatory**: The tool must handle missing curated summaries, invalid section names, and `format: "json"` mode. No tool may throw on missing data — return graceful fallbacks.
- **CI gates**: All CI checks must pass — `pnpm materialize`, `pnpm exec turbo run build:check`, `pnpm exec vitest --run`.
- **Validate**: Run `pnpm exec forge rfc.validate --id RFC-0012 --json` after changes to verify no mechanical violations.
