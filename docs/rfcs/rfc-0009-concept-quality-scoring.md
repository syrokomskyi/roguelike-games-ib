---
id: RFC-0009
title: "Concept quality scoring — coverage, evidence, and richness scores"
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
  - RFC-0002
  - RFC-0003
  - RFC-0004
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
  - materializer
successSignals:
  - Every concept has quality_score with coverage, evidence, and richness sub-scores
  - MCP get_concept_quality tool returns scores for individual or all concepts
  - Web app shows quality badges on concept cards
  - Low-scoring concepts are identifiable for improvement
nonGoals:
  - Does not modify concept generation logic — scoring is computed post-hoc
  - Does not auto-fix low-scoring concepts — scoring is informational
  - Does not score definition records — only concepts
  - Does not define DNA invariants — the project has no invariants file configured (invariantsFile: null in forge.yaml)
---

# RFC-0009: Concept quality scoring — coverage, evidence, and richness scores

## Context

The knowledge base now has 469 concepts (15 design primitives, 31 pressures, 56 mutation vectors, 224 design knobs, 93 counterplay patterns, 28 failure modes, 22 cross-game mechanics). There is no way to assess which concepts are well-supported vs. thinly evidenced.

### Current concept structure

Each concept has:
- `implementation_refs` — record IDs that exemplify the concept
- `ancestry.source_games` — games the concept covers
- `ancestry.derived_from` — parent concepts
- `evidence_refs` — evidence record IDs
- `concept_type` — design_primitive, design_pressure, mutation_vector, design_knob, counterplay_pattern, failure_mode, cross_game_mechanic

## Problem

Without quality scoring:

1. **No triage**: Cannot identify which concepts need more evidence, which have sparse game coverage, or which are richly developed.
2. **No ranking**: MCP tools return concepts unsorted — users see low-quality and high-quality concepts mixed together.
3. **No web indicators**: The web app shows all concepts equally — no visual distinction between a 4-game concept with 50 implementation_refs and a 1-game concept with 0 refs.

## Architectural fit

This RFC builds on the concept infrastructure established by RFC-0002 (concept quality — semantic equivalence and ref integrity), RFC-0003 (design layer expansion — mutation vectors, knobs, counterplay, failure modes), and RFC-0004 (cross-game analysis tools — coverage matrix and concept coverage). All three are implemented.

The scoring is a post-hoc projection over existing concept data. It does not modify the concept generation pipeline (`scripts/run-stage-design.ts`), the canonical concept schema, or the deriver. Scores are computed during materialization and stored alongside records in the dist output — they are not canonical data.

The project has no DNA invariants file (`invariantsFile: null` in `forge.yaml`), consistent with prior RFCs (RFC-0002, RFC-0003, RFC-0004) which are all `kind: policy` with `satisfies: []`.

## Decision

The materializer gains a quality scoring step that computes `quality_score` (coverage, evidence, richness, overall) for every concept record during materialization. Scores are embedded in `dist/records.jsonl` and the SQLite read model as a non-canonical projection. A new MCP tool `get_concept_quality` exposes scores to consumers. The web app renders A/B/C quality badges on concept cards. Existing MCP tools sort by quality by default. Thresholds are configurable via `knowledge.config.yaml`.

## Design

### D1: Quality score computation

Add a `quality_score` field to every concept record during materialization. Three sub-scores:

**Coverage score** (0–1): Fraction of registered source bindings that the concept covers.
```
coverage = |ancestry.source_games ∩ all_source_ids| / |all_source_ids|
```
Where `all_source_ids` is the set of `source_id` values from `state.bindings` in `CanonicalState`.

**Evidence score** (0–1): Ratio of valid implementation_refs to a target count.
```
evidence = min(|valid_implementation_refs| / EVIDENCE_TARGET, 1.0)
```
Where `valid_implementation_refs` are refs from the `implementation_refs` array that resolve to existing records in the canonical state. `EVIDENCE_TARGET` is 10 (configurable, see D6). Capped at 1.0.

**Richness score** (0–1): Computed differently for design primitives vs other concept types.

For `design_primitive` concepts — based on design-space relations where the concept is the source record:
```
richness (primitive) = min((mutation_vectors + knobs + counterplay + failure_modes) / RICHNESS_TARGET, 1.0)
```
Where:
- `mutation_vectors` = count of relations with type `HAS_MUTATION_VECTOR` and source = concept
- `knobs` = count of relations with type `IMPLEMENTED_AS` and source = concept
- `counterplay` = count of relations with type `HAS_COUNTERPLAY` and source = concept
- `failure_modes` = count of relations with type `CAN_FAIL_AS` and source = concept
- `RICHNESS_TARGET` is 20 (configurable, see D6)

For other concept types — based on all design-space relations where the concept is source or target:
```
richness (other) = min(related_concepts / RICHNESS_OTHER_TARGET, 1.0)
```
Where `related_concepts` is the count of distinct records connected to this concept via any design-space relation (scope = `design` or `cross_game`). `RICHNESS_OTHER_TARGET` is 5 (configurable).

**Overall score**: `quality_score = round((coverage * 0.4 + evidence * 0.3 + richness * 0.3) * 100) / 100`

Edge cases: Concepts with no `ancestry`, no `implementation_refs`, or no relations receive 0 for the respective sub-score. Concepts with empty `source_games` get coverage = 0.

### D2: Computation location

Compute scores in `packages/materializer/src/build.ts` inside the `materialize()` function, after `readCanonicalState()` and `verifyCanonicalState()` but before `writeRecordsJsonl()` and `buildSqlite()`. This ensures scores appear in both `dist/records.jsonl` and the SQLite read model (the `json` column of the `records` table stores the full record JSON).

Add a `computeQualityScores()` function in `packages/materializer/src/quality-scores.ts` that takes `CanonicalState` and returns a map of `record_id → quality_score`. In `build.ts`, apply scores to each concept record before passing to `writeRecordsJsonl` and `buildSqlite`.

Do **not** modify canonical concept records in `knowledge/` — scoring is a projection, not canonical data. The `quality_score` field is added to the `CanonicalRecord` object in memory before writing to dist.

### D3: MCP tool `get_concept_quality`

New MCP tool that returns quality scores:

```json
{
  "concept_key": "cross-game/concept/design-permadeath",
  "quality_score": { "coverage": 1.0, "evidence": 0.0, "richness": 0.85, "overall": 0.66 },
  "coverage_detail": { "covered_games": ["broguece", "cataclysm-bn", "crawl", "nethack"], "missing_games": [] },
  "evidence_detail": { "ref_count": 0, "target": 10 },
  "richness_detail": { "mutation_vectors": 4, "knobs": 16, "counterplay": 0, "failure_modes": 2 }
}
```

**Input**: `{ record_id?: string; key?: string; min_score?: number }` — returns single concept or all concepts above threshold.

**Graceful fallback**: If `quality_score` is missing from a record (e.g., materialized before this RFC was implemented), the tool returns `quality_score: null` with a message: "Quality scores not available. Run `pnpm materialize` to compute."

**Files**: `apps/mcp/src/tools/derived.ts`, `apps/mcp/src/server.ts`

### D4: Web app quality badges

On concept cards in `/design` and `/concepts`, show a quality badge:
- **A** (overall ≥ 0.8): green badge
- **B** (overall ≥ 0.5): yellow badge
- **C** (overall < 0.5): gray badge

Extend `ConceptCard` interface in `apps/web/src/lib/design-data.ts` to include `qualityScore?: { coverage: number; evidence: number; richness: number; overall: number } | null`. Add badge rendering to concept card templates in `apps/web/src/pages/design.astro` and `apps/web/src/pages/concepts.astro`. Badges are purely visual — no JavaScript required.

**Graceful fallback**: If `quality_score` is missing, no badge is rendered.

**Files**: `apps/web/src/lib/design-data.ts`, `apps/web/src/pages/design.astro`, `apps/web/src/pages/concepts.astro`

### D5: Sort concepts by quality in MCP tools

Update `find_cross_game_concepts` and `find_design_primitives` to sort results by `quality_score.overall` descending when no other sort is specified. Records without `quality_score` sort last.

**Files**: `apps/mcp/src/tools/design.ts`

### D6: Configurable thresholds

Store scoring thresholds in `knowledge.config.yaml` under a new `quality_scoring` key:
```yaml
quality_scoring:
  evidence_target: 10
  richness_target: 20
  richness_other_target: 5
  weights: { coverage: 0.4, evidence: 0.3, richness: 0.3 }
```

The materializer reads these at computation time. If the key is absent, use the defaults above.

## Rollout

After implementation, the next `pnpm materialize` run automatically computes and embeds `quality_score` on all concept records. No migration step is needed — the field is additive. Existing MCP tools and web pages that do not reference `quality_score` continue to work unchanged. Tools that sort by quality (D5) degrade gracefully when scores are absent (sort last).

## Alternatives considered

1. **Compute scores on-the-fly in MCP tools instead of during materialization.** Rejected because: (a) every MCP call would recompute scores, adding latency; (b) the web app would need to replicate the computation; (c) scores would not be available in `dist/records.jsonl` for offline analysis. Materialization-time computation is consistent with the existing pattern where derived data is precomputed.

2. **Extend `get_concept_coverage` instead of creating `get_concept_quality`.** Rejected because `get_concept_coverage` returns per-game member records and gaps — a different concern. Quality scores are a summary metric, not a coverage breakdown. Combining them would overload the tool's response shape.

3. **Store scores in a separate `quality-scores.json` file instead of embedding in records.** Rejected because: (a) MCP and web app would need to join two data sources; (b) the SQLite read model stores full record JSON, so embedding is natural; (c) a separate file adds I/O and sync complexity.

## Implementation notes for agents

- **Status gate**: This RFC must be in `accepted` status before implementation begins. Use `fo-idea-plan` to create the implementation plan and transition to `accepted`.
- **MODULE_CONTRACT**: New files in `apps/web/` must include `MODULE_CONTRACT` and `CHANGE_SUMMARY` comments per `apps/web/AGENTS.md`.
- **Materializer package**: The `quality-scores.ts` module must include `MODULE_CONTRACT` and `CHANGE_SUMMARY` comments per the materializer's existing conventions.
- **No canonical modifications**: Scores are added to records in memory during materialization only. Do not write `quality_score` to `knowledge/claim/` or `knowledge/concept/` directories.
- **Testing**: Add a test that verifies scores for known concepts (e.g., `design-permadeath` has coverage = 1.0 across 4 games). Test edge cases: concept with no implementation_refs, concept with no relations.
- **CI gates**: All CI checks must pass — `pnpm materialize`, `pnpm exec turbo run build:check`, `pnpm exec vitest --run`.

## Implementation plan

### Step 1: Add quality score computation to materializer

1. Create `packages/materializer/src/quality-scores.ts` with `computeQualityScores(state: CanonicalState, config: QualityScoringConfig): Map<string, QualityScore>`
2. In `packages/materializer/src/build.ts`, call `computeQualityScores()` after `verifyCanonicalState()` and apply scores to concept records before `writeRecordsJsonl()` and `buildSqlite()`
3. Add `quality_scoring` section to `knowledge.config.yaml` with defaults
4. Add `QualityScore` interface to `packages/materializer/src/types.ts`

**Files**: `packages/materializer/src/quality-scores.ts` (new), `packages/materializer/src/build.ts`, `packages/materializer/src/types.ts`, `knowledge.config.yaml`

### Step 2: Add MCP tool

1. Add `getConceptQuality()` to `apps/mcp/src/tools/derived.ts`
2. Register in `server.ts` with schema
3. Add `get_concept_quality` to `REQUIRED_TOOLS`

**Files**: `apps/mcp/src/tools/derived.ts`, `apps/mcp/src/server.ts`

### Step 3: Add quality badges to web app

1. Extend `ConceptCard` interface and `extractConceptCard()` in `apps/web/src/lib/design-data.ts` to include `qualityScore`
2. Add badge rendering to concept cards in `apps/web/src/pages/design.astro` and `apps/web/src/pages/concepts.astro`

**Files**: `apps/web/src/lib/design-data.ts`, `apps/web/src/pages/design.astro`, `apps/web/src/pages/concepts.astro`

### Step 4: Sort by quality in existing tools

1. Update `findCrossGameConcepts()` and `findDesignPrimitives()` to sort by `quality_score.overall` desc (records without scores sort last)

**Files**: `apps/mcp/src/tools/design.ts`

### Step 5: Tests and verify

1. Add test verifying scores are computed correctly for known concepts
2. Add test for edge cases (no refs, no relations, no ancestry)
3. `pnpm exec turbo run build:check`
4. `pnpm exec vitest --run`

## Acceptance criteria

- [ ] Every concept in `dist/records.jsonl` has `quality_score` with `coverage`, `evidence`, `richness`, `overall`
- [ ] `quality_score` appears in the SQLite read model (records table `json` column)
- [ ] `get_concept_quality` MCP tool returns scores for individual concepts and supports `min_score` threshold
- [ ] `get_concept_quality` returns `null` with fallback message for records without scores
- [ ] Web app shows quality badges (A/B/C) on concept cards in `/design` and `/concepts`
- [ ] `find_cross_game_concepts` sorts by quality by default (records without scores sort last)
- [ ] Scoring thresholds are configurable via `knowledge.config.yaml`
- [ ] All tests pass including edge case tests

## Risks

- **Score staleness**: Scores computed at materialization time become stale if concepts change. Mitigation: scores are recomputed on every `pnpm materialize` run.
- **Richness formula tuning**: The thresholds (10 refs, 20 related concepts) are initial guesses. Mitigation: thresholds are configurable via `knowledge.config.yaml`, adjust after seeing real distributions.
- **Weight sensitivity**: The 0.4/0.3/0.3 weighting prioritizes coverage over evidence and richness. If the knowledge base grows to many games, coverage may dominate. Mitigation: weights are configurable.
- **Agent misinterpretation**: Agents may treat low scores as actionable issues rather than informational signals. Mitigation: `nonGoals` explicitly states scoring is informational, not auto-fix.
