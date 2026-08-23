---
rfcId: RFC-0012
auditId: AUDIT-RFC-0012-01
date: 2026-08-23
auditor:
  skill: fo-idea-audit
  model: claude-sonnet-4-20250514
verdict: needs-revision
---

# Audit: RFC-0012

## Verdict: Needs revision

The RFC has a V-24 error (architecture RFC without DNA invariant — same pattern as RFC-0011), 5 missing required sections, and several semantic gaps: contradictory statements about web app architecture, no TypeScript contracts, duplicated report generation logic between MCP and web, and missing edge cases. The core idea is sound — a synthesized report tool is a natural extension of the existing tool suite — but the RFC needs structural and semantic fixes before implementation.

## Mechanical validation (rfc.validate)

**Fail** — 1 error, 5 warnings:

- **V-24 (error)**: Architecture RFC created 2026-08-23 (>= 2026-07-07) must declare at least one DNA invariant in `satisfies`. The project has `invariantsFile: null` in `forge.yaml`. Prior RFCs (RFC-0003, RFC-0004, RFC-0009, RFC-0011) resolved this by using `kind: policy`. Consider changing `kind` to `policy`.
- **V-13 (warning)**: Missing required sections: "Architectural fit", "Design", "Rollout", "Alternatives considered", "Implementation notes for agents".

## Axis A — Structural completeness

1. **Missing required sections**: "Architectural fit", "Design", "Rollout", "Alternatives considered", "Implementation notes for agents" are all absent. See V-13 warnings above.

2. **No TypeScript contracts**: The RFC shows a markdown example and an input shape (`{ source_ids: string[]; concept_key?: string; format?: "markdown" | "json" }`) but no formal TypeScript contracts for the tool function, report sections, or web `generateReport()` function.

3. **No Rollout section**: The RFC doesn't describe default behavior, adoption path, or migration. The implementation plan has 4 steps but no rollout narrative.

4. **No Alternatives considered**: The RFC doesn't explore alternatives. Key questions: Could the report be generated as a projection during materialization instead of on-demand? Could the web app reuse the MCP tool logic via a shared package instead of duplicating it?

5. **No Implementation notes for agents**: Missing behavioral rules — which existing tool functions to call internally, how to handle the `format` parameter, whether to register in `REQUIRED_TOOLS`, MODULE_CONTRACT requirements for new web files.

6. **Acceptance criteria** are checkable but don't distinguish between code changes an agent can make and content that depends on curated data (`compare_concept_implementations` reads human-authored summaries from `concept-implementations.json`).

## Axis B — DNA alignment

1. **`satisfies: []` with `kind: architecture`**: V-24 requires at least one DNA invariant. The project has `invariantsFile: null` — no invariants file exists. Prior RFCs used `kind: policy` to avoid this. Either change `kind` to `policy` or add a DNA invariant.

2. **`related: [RFC-0004, RFC-0009, RFC-0011]`**: All three are implemented and directly relevant. RFC-0004 created the cross-game analysis tools this RFC synthesizes. RFC-0009 added quality scoring visible in reports. RFC-0011 added design patterns and concrete examples. Good.

## Axis C — Ecosystem fit

1. **Contradictory web app architecture**: D4 says "Calls the MCP `generate_comparison_report` tool (via an API endpoint or client-side generation)" but then immediately says "Since the web app is static, the report must be generated client-side from the materialized data". The first statement is misleading — a static site cannot call an MCP tool. The RFC should state upfront that web report generation is client-side only.

2. **Duplicated report logic**: D1 creates `generateComparisonReport()` in `apps/mcp/src/tools/derived.ts` and D4 creates `generateReport()` in `apps/web/src/lib/report.ts`. Both assemble the same 6 report sections from the same data. No shared package or function is proposed. This violates DRY and creates maintenance risk — when report sections change, two implementations must be updated.

3. **Cross-module tool calls**: D2 says the report assembles data from `compare_games`, `get_coverage_matrix`, `compare_concept_implementations`, `find_concept_gaps`, `query_design_space`, `find_by_attribute`. These functions live in three different modules: `tools/compare.ts`, `tools/derived.ts`, `tools/design.ts`, `tools/queries.ts`. The RFC doesn't clarify whether `generateComparisonReport()` calls these functions directly (requiring cross-module imports) or reimplements their logic.

4. **`packagesImpacted: [builders/obsidian-builder]`**: Correct — D3 modifies the obsidian builder. But D3 also proposes adding a `--report` flag to `scripts/run-build-obsidian.ts`. The script is a 13-line file that calls `buildObsidianVault()`. Adding a `--report` flag to the script requires modifying `ObsidianBuildOptions` and `buildObsidianVault()` in `build.ts`. The RFC should specify this.

5. **`design_pattern` concept type missing from MCP enum**: The `find_cross_game_concepts` tool schema in `server.ts:314` doesn't include `design_pattern` in its enum, even though RFC-0011 (implemented) created `design_pattern` concept records. This is a pre-existing bug, not caused by RFC-0012, but the report tool should be aware that `design_pattern` concepts exist and may appear in coverage data.

6. **AGENTS.md updates**: The RFC doesn't identify which `AGENTS.md` files need updates. New web files need `MODULE_CONTRACT` and `CHANGE_SUMMARY` comments per `apps/web/AGENTS.md`. The RFC should state this.

## Axis D — Forward-only compliance

1. **No compatibility shims**: The RFC proposes a new tool and new web functionality without legacy support paths. Good.

2. **No backward compatibility layers**: No dual-path or flag-gated behavior. Good.

3. **`format` parameter**: The `"markdown" | "json"` format option is additive. Good. But the RFC doesn't define what the JSON format looks like — is it the raw section data as JSON, or the same structure as the markdown but as JSON objects?

## Axis E — Agent-facing policy

1. **No Implementation notes for agents**: Missing entirely. Agents need to know: whether to register in `REQUIRED_TOOLS`, whether the tool is `readOnly: true`, how to handle cross-module function calls, MODULE_CONTRACT requirements for new files, whether `generateReport()` in the web app should share logic with the MCP tool.

2. **Anti-fabrication**: D2 section 3 says "Design primitive comparison — `compare_concept_implementations` for each primitive". This tool reads from `concept-implementations.json` which has human-authored content. The RFC acknowledges in Risks that "if notes are incomplete, report sections will have `null` summaries" but the acceptance criteria don't distinguish between code an agent can write and content that depends on human curation.

3. **No self-authorizing language**: Good — the RFC doesn't grant implementation permission while in draft.

4. **No NEEDS CLARIFICATION markers**: None found.

## Axis F — Pragmatism

1. **Duplicated report generation**: D1 (MCP tool) and D4 (web function) both assemble the same 6 report sections. A shared report-builder package or function would eliminate duplication. The RFC should at minimum acknowledge this and explain why duplication is acceptable or propose a shared module.

2. **`sections` parameter in Risks but not in design**: Risks says "Mitigation: add `sections` parameter to select which sections to include." But the input schema in D1 doesn't include a `sections` parameter. If this is a planned mitigation, it should be in the design, not just in Risks.

3. **Obsidian `--report` flag**: D3 proposes adding a `--report` flag to `scripts/run-build-obsidian.ts`. The script is 13 lines and has no argument parsing. Adding flag parsing would require either a CLI args parser or manual `process.argv` parsing. The RFC should specify the mechanism.

4. **`appsImpacted` and `packagesImpacted` scope**: `appsImpacted: [mcp, web]` and `packagesImpacted: [builders/obsidian-builder]` — all three are actually touched. Good scope discipline.

## Axis G — Blind spots

1. **Performance**: The MCP tool calls 6 existing tool functions internally, each iterating over records. No estimate of response time or payload size for a 4-game comparison. A full 4-game report with all sections could be very large (the RFC acknowledges this in Risks but provides no size estimate).

2. **Edge cases**: The RFC doesn't consider: What if only 1 `source_id` is provided? What if a `source_id` doesn't exist? What if `concept_key` doesn't match any concept? What if all curated summaries are missing (empty `concept-implementations.json`)?

3. **Web report data access**: D4 says `generateReport(store, sourceIds)` but doesn't define the `store` parameter type. The compare page uses `ProjectionStore` from `@roguelike-games-ib/projection-sdk`. The RFC should specify the interface.

4. **Client-side download mechanism**: D4 says "Client-side JS generates markdown and triggers download" but doesn't specify how — Blob URL, Data URI, or File API. The compare page is a static `.astro` page with no client-side JS currently. Adding interactivity requires a `<script>` tag or framework component.

5. **Obsidian report note structure**: D3 says notes go in `reports/comparisons/` with wiki-links to concept and record notes. But the existing `buildPathResolver()` in `paths.ts` maps records to `games/<source_id>/` or `cross-game/` or `design/` scopes. Report notes in `reports/comparisons/` would be outside the existing path resolution system — wiki-links from report notes to record notes need the resolver, but the resolver doesn't know about report notes.

6. **MOC entry**: D3 says "MOC entry in the main MOC". The existing `renderMoc()` in `moc.ts` generates the MOC from `store.records`. Report notes are not records — they would need a separate MOC entry mechanism. The RFC should specify how.

## Questions for the author

1. **Shared report logic or duplication?** D1 creates `generateComparisonReport()` in MCP and D4 creates `generateReport()` in the web app. Both assemble the same 6 sections. Should this be a shared function in a package, or is duplication acceptable? If duplication, explain why.

2. **`kind: architecture` or `kind: policy`?** V-24 requires a DNA invariant for architecture RFCs. All prior RFCs in this project use `kind: policy`. Will you change to `policy` or add a DNA invariant?

3. **How does the MCP tool call existing functions?** The 6 source functions live in 4 different modules (`compare.ts`, `derived.ts`, `design.ts`, `queries.ts`). Does `generateComparisonReport()` import and call them directly, or reimplement the logic? If calling directly, how is the `McpContext` passed?
