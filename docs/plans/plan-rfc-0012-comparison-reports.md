---
id: PLAN-RFC-0012
title: Comparison reports — auto-generated markdown cross-game analysis
status: accepted
scope: project-wide
decider: architecture
reviewers:
  - human:andrii-syrokomskyi
related:
  - RFC-0012
  - RFC-0004
  - RFC-0009
  - RFC-0011
created: 2026-08-23
accepted: 2026-08-23
implementedAt:
closedAt: null
---

# PLAN-RFC-0012: Comparison reports — auto-generated markdown cross-game analysis

## Context

RFC-0012 is accepted. It adds a `generate_comparison_report` MCP tool that synthesizes 6 existing tool outputs into a single markdown report, Obsidian vault report notes, and a web "Download report" button. All features are additive — no existing tools or pages are modified.

## Objectives

1. Create `generate_comparison_report` MCP tool in `apps/mcp/src/tools/report.ts`
2. Add Obsidian report note generation in `packages/builders/obsidian-builder/src/report.ts`
3. Add web `generateReport()` function and "Download report" button on `/compare`
4. All tests pass

## Steps

### Step 1: Create MCP report tool (D1, D2)

Create the new MCP tool that synthesizes 6 existing tool functions into a markdown report.

**Actions**:
1. Create `apps/mcp/src/tools/report.ts`:
   - Import `compareGames` from `./compare.ts`
   - Import `getCoverageMatrix`, `compareConceptImplementations`, `findConceptGaps` from `./derived.ts`
   - Import `queryDesignSpace` from `./design.ts`
   - Import `findByAttribute` from `./queries.ts`
   - Import `envelope` from `../envelope.ts`, `ValidationError` from `../errors.ts`
   - Define `GenerateComparisonReportInput` interface: `{ source_ids: string[]; concept_key?: string; format?: "markdown" | "json"; sections?: string[] }`
   - Implement `generateComparisonReport(ctx, input)`:
     - Validate `source_ids.length >= 2 && <= 8` (throw `ValidationError` otherwise)
     - Determine which sections to include (all if `sections` not provided; filter valid names)
     - Build each section by calling the corresponding tool function with `ctx`
     - For `format: "markdown"`: assemble sections into a single markdown string, return `envelope(ctx, { report: markdown })`
     - For `format: "json"`: return `envelope(ctx, { sections: sectionDataObject })`
     - Handle edge cases per RFC Design section (missing curated summaries → "No curated summary available", invalid section names → silently ignored, missing concept_key → empty primitives section with note)
   - Add `MODULE_CONTRACT` and `CHANGE_SUMMARY` comments at top of file
2. Export `generateComparisonReport` from `apps/mcp/src/index.ts`
3. Register tool in `apps/mcp/src/server.ts`:
   - Import `generateComparisonReport` from `./tools/report.ts`
   - Add `registry.register({ name: "generate_comparison_report", description: "...", inputSchema: {...}, handler: generateComparisonReport, readOnly: true })`
   - Add `"generate_comparison_report"` to `REQUIRED_TOOLS` array
4. Update `MODULE_CONTRACT` and `CHANGE_SUMMARY` in `server.ts` and `index.ts`

**Files**: `apps/mcp/src/tools/report.ts` (new), `apps/mcp/src/server.ts`, `apps/mcp/src/index.ts`

**Completion criterion**: `generate_comparison_report` is registered in `REQUIRED_TOOLS`, callable via the registry, and returns markdown for a 2-game comparison. `build:check` passes.

### Step 2: Add Obsidian report generation (D3)

Add optional report note generation to the Obsidian vault builder.

**Actions**:
1. Create `packages/builders/obsidian-builder/src/report.ts`:
   - Import `ProjectionStore` from `@roguelike-games-ib/projection-sdk`
   - Import `PathResolver` from `./paths.ts`
   - Import `makeWikiLink` from `./links.ts`
   - Implement `generateComparisonNotes(store, resolver, vaultRoot): string[]`:
     - Generate all unique pairs of source IDs from `store.sources`
     - For each pair, build a markdown report note (same 6 sections as MCP tool, reading from `store` directly)
     - Write each note to `reports/comparisons/<src-a>-vs-<src-b>.md` via `writeFileSync`
     - Include wiki-links to concept and record notes using `makeWikiLink(resolver, store.aliasMap, recordId)`
     - Return list of generated note paths (relative to vault root)
   - Add `MODULE_CONTRACT` and `CHANGE_SUMMARY` comments
2. Modify `packages/builders/obsidian-builder/src/build.ts`:
   - Add `reports?: boolean` to `ObsidianBuildOptions` interface
   - After rendering MOC and concepts MOC (line ~112), if `options.reports`:
     - Call `generateComparisonNotes(store, resolver, vaultRoot)`
     - Push returned paths to `notePaths`
   - Update `MODULE_CONTRACT` and `CHANGE_SUMMARY`
3. Modify `packages/builders/obsidian-builder/src/moc.ts`:
   - Add optional `reportPaths?: string[]` parameter to `renderMoc()`
   - If `reportPaths` provided and non-empty, append a "## Comparison Reports" section listing wiki-links to report notes
   - Update `MODULE_CONTRACT` and `CHANGE_SUMMARY`
   - Thread `reportPaths` from `build.ts` → `renderMoc()`
4. Modify `packages/builders/obsidian-builder/src/index.ts`:
   - Export `generateComparisonNotes` from `./report.ts`
5. Modify `scripts/run-build-obsidian.ts`:
   - Add `reports: process.argv.includes("--report")` to `buildObsidianVault()` call options

**Files**: `packages/builders/obsidian-builder/src/report.ts` (new), `packages/builders/obsidian-builder/src/build.ts`, `packages/builders/obsidian-builder/src/moc.ts`, `packages/builders/obsidian-builder/src/index.ts`, `scripts/run-build-obsidian.ts`

**Completion criterion**: `buildObsidianVault({ workspaceRoot, reports: true })` generates comparison report notes in `reports/comparisons/` with wiki-links that resolve. Default behavior (without `reports: true`) is unchanged. `build:check` passes.

### Step 3: Add web report generation (D4)

Add client-side report generation and download button on the compare page.

**Actions**:
1. Create `apps/web/src/lib/report.ts`:
   - Import `ProjectionStore` type from `@roguelike-games-ib/projection-sdk`
   - Import `getSourceId` from `./page-data.ts` (per `apps/web/AGENTS.md` convention)
   - Implement `generateReport(store: ProjectionStore, sourceIds: string[], options?: { conceptKey?: string; sections?: string[] }): string`:
     - Build the same 6 report sections as the MCP tool, reading from `store` directly
     - Return markdown string
   - Add `MODULE_CONTRACT` and `CHANGE_SUMMARY` comments per `apps/web/AGENTS.md`
2. Modify `apps/web/src/pages/compare/[...filter].astro`:
   - Import `generateReport` from `../../lib/report`
   - In `getStaticPaths()`, serialize the data needed for report generation into page props (follow existing `coverageMatrix` / `primitivePresence` pattern)
   - Add a "Download report" button in the page template (visible when `activeSource !== "all"`)
   - Add `<script>` tag with client-side download logic:
     - On button click, call `generateReport()` with serialized store data
     - Create `Blob` with `type: 'text/markdown'`
     - Trigger download via `URL.createObjectURL()` and temporary `<a>` element
   - Add `MODULE_CONTRACT` and `CHANGE_SUMMARY` comments per `apps/web/AGENTS.md`

**Files**: `apps/web/src/lib/report.ts` (new), `apps/web/src/pages/compare/[...filter].astro`

**Completion criterion**: Compare page has a "Download report" button that downloads a `.md` file when clicked. `build:check` passes.

### Step 4: Tests

Add tests for the MCP report tool, Obsidian report generation, and web report function.

**Actions**:
1. Create `tests/mcp/mcp-013.test.ts`:
   - Follow the pattern of `tests/mcp/mcp-012.test.ts` (use `setupMcpWorkspace`, `testId`, fixture records)
   - Test 2-game comparison: verify report contains all 6 sections
   - Test `sections` parameter: verify only requested sections are included
   - Test `format: "json"`: verify response has `sections` object with section keys
   - Test `concept_key` single-concept mode: verify only relevant sections render
   - Test edge case: 1 `source_id` throws `ValidationError`
   - Test edge case: missing curated summary shows "No curated summary available"
   - Test that `generate_comparison_report` is in `REQUIRED_TOOLS`
2. Add Obsidian report test (in `tests/obsidian/` or extend existing obsidian test):
   - Test that `buildObsidianVault({ workspaceRoot, reports: true })` generates report notes
   - Test that report notes contain wiki-links
   - Test that default build (without `reports: true`) does NOT generate report notes
3. Add web report test:
   - Test that `generateReport()` returns a non-empty markdown string
   - Test that markdown contains expected section headers

**Files**: `tests/mcp/mcp-013.test.ts` (new), obsidian test file (new or extended)

**Completion criterion**: All new tests pass. `pnpm exec vitest --run` succeeds.

### Step 5: Validation

Run the full validation suite.

**Actions**:
1. `pnpm exec turbo run build:check` — TypeScript compilation
2. `pnpm exec vitest --run` — full test suite
3. `pnpm exec forge rfc.validate --id RFC-0012 --json` — RFC validation

**Completion criterion**: All three commands pass with zero errors.

### Step 6: Review and fix

Run `fo-review` on all session code changes. Apply `fo-fix` if findings.

**Completion criterion**: Review complete, all findings addressed.

### Step 7: Stamp implemented

Run `pnpm exec forge rfc.implement.stamp --id RFC-0012 --implementation-commit <sha>` to transition `accepted → implemented`.

**Completion criterion**: RFC-0012 status is `implemented`.

## Validation suite

| Check | Command | When |
|---|---|---|
| TypeScript | `pnpm exec turbo run build:check` | After code changes |
| Tests | `pnpm exec vitest --run` | After all changes |
| RFC validation | `pnpm exec forge rfc.validate --id RFC-0012 --json` | After all changes |

## Risk mitigations

| Risk | Mitigation step |
|---|---|
| Report length (50-100 KB) | `sections` parameter in D1 input — Step 1 implements |
| Curated summaries missing | "No curated summary available" fallback — Step 1 implements, Step 4 tests |
| Duplicated report logic (MCP + web) | Section structure (D2) is the contract — both follow same 6-section order |
| Client-side generation | `generateReport()` reads from `ProjectionStore` directly — Step 3 implements |
| Circular dependency (report.ts → compare.ts → derived.ts) | `report.ts` is a new file that imports from all modules without creating cycles — Step 1 creates |
| MCP tool registration | Step 1 adds to `REQUIRED_TOOLS` and `index.ts` exports |
| Obsidian default behavior unchanged | `reports?: boolean` is opt-in — Step 2 implements, Step 4 tests |
