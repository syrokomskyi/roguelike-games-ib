---
id: PLAN-RFC-0009
title: "Concept quality scoring — coverage, evidence, and richness scores"
status: accepted
scope: project-wide
decider: architecture
reviewers:
  - human:andrii-syrokomskyi
related:
  - RFC-0009
created: 2026-08-23
accepted: 2026-08-23
implementedAt:
closedAt: null
---

# PLAN-RFC-0009: Concept quality scoring — coverage, evidence, and richness scores

## Context

RFC-0009 adds a `quality_score` field to every concept record during materialization. Scores are computed in the materializer package and embedded in both `dist/records.jsonl` and the SQLite read model. A new MCP tool `get_concept_quality` exposes scores. The web app renders A/B/C quality badges. Existing MCP tools sort by quality by default. Thresholds are configurable via `knowledge.config.yaml`.

## Data flow

1. `materialize()` in `packages/materializer/src/build.ts` reads canonical state → writes `records.jsonl` + `knowledge.sqlite`
2. `ProjectionStore.open(distDir)` reads `records.jsonl` via `readJsonlFile()` — MCP tools access `ctx.store.records`
3. `buildSearchIndex()` reads `knowledge.sqlite` for FTS5 search
4. Web app reads `records.jsonl` via `ProjectionStore` in `createWebContext()`

Scores must be applied to the records array in memory **before** both `writeRecordsJsonl()` and `buildSqlite()` calls.

## Steps

### Step 1: Add `QualityScore` types and `quality-scores.ts` module

**Files**: `packages/materializer/src/types.ts`, `packages/materializer/src/quality-scores.ts` (new), `packages/materializer/src/index.ts`

1. Add `QualityScore` interface to `types.ts`:
   ```typescript
   export interface QualityScore {
     coverage: number;
     evidence: number;
     richness: number;
     overall: number;
   }
   ```
2. Add `QualityScoringConfig` interface to `types.ts`:
   ```typescript
   export interface QualityScoringConfig {
     evidence_target: number;
     richness_target: number;
     richness_other_target: number;
     weights: { coverage: number; evidence: number; richness: number };
   }
   ```
3. Create `packages/materializer/src/quality-scores.ts` with:
   - `DEFAULT_QUALITY_SCORING_CONFIG: QualityScoringConfig` (evidence_target=10, richness_target=20, richness_other_target=5, weights={coverage:0.4, evidence:0.3, richness:0.3})
   - `computeQualityScores(state: CanonicalState, config?: QualityScoringConfig): Map<string, QualityScore>` — iterates `state.records`, filters `record_type === "concept"`, computes three sub-scores per concept
   - Coverage: `|ancestry.source_games ∩ all_source_ids| / |all_source_ids|` where `all_source_ids` = `state.bindings.map(b => b.source_id)`
   - Evidence: `min(valid_implementation_refs / evidence_target, 1.0)` where valid refs resolve to records in `state.records` by id
   - Richness (primitive): count design-space relations (`HAS_MUTATION_VECTOR`, `IMPLEMENTED_AS`, `HAS_COUNTERPLAY`, `CAN_FAIL_AS`) where concept is `source_record_id`, sum / `richness_target`, cap 1.0
   - Richness (other): count distinct records connected via design/cross_game scope relations, / `richness_other_target`, cap 1.0
   - Overall: `round((coverage * w.coverage + evidence * w.evidence + richness * w.richness) * 100) / 100`
   - Module must include `MODULE_CONTRACT` and `CHANGE_SUMMARY` comments
4. Export `computeQualityScores`, `DEFAULT_QUALITY_SCORING_CONFIG`, `QualityScore`, `QualityScoringConfig` from `index.ts`

**Completion criterion**: `packages/materializer/src/quality-scores.ts` exists, exports `computeQualityScores`, TypeScript compiles.

### Step 2: Wire scoring into `materialize()` and add config

**Files**: `packages/materializer/src/build.ts`, `packages/knowledge-core/src/config.ts`, `knowledge.config.yaml`

1. In `build.ts`, the scoring step must be inserted **after** `computeCanonicalHash()` but **before** `writeRecordsJsonl()` and `buildSqlite()`:
   - Current order: verify → compute hash → write JSONL → build SQLite
   - New order: verify → compute hash → **compute & apply quality scores** → write JSONL → build SQLite
   - This preserves the canonical hash — scores are a projection, not canonical data
2. Load `QualityScoringConfig` from `knowledge.config.yaml` via `paths.config` (already parsed by `resolveKnowledgePaths`). Access `quality_scoring` key with fallback to `DEFAULT_QUALITY_SCORING_CONFIG`
3. Call `computeQualityScores(state, config)` → `Map<string, QualityScore>`
4. For each record in `state.records`, if it's a concept and has a score, add `quality_score` field to the record object (mutating in place)
5. Add `quality_scoring` section to `knowledge.config.yaml` with default values
6. The `quality_score` field flows into both `writeRecordsJsonl(distDir, state.records)` and `buildSqlite(distDir, { records: state.records, ... })` since both receive the same mutated array
7. Extend `KnowledgeConfig` interface in `packages/knowledge-core/src/config.ts` with `quality_scoring?: QualityScoringConfig` for type-safe access

**Completion criterion**: Running `pnpm materialize` produces `records.jsonl` where concept records have `quality_score` field. SQLite `json` column also contains `quality_score`.

### Step 3: Add MCP `get_concept_quality` tool

**Files**: `apps/mcp/src/tools/derived.ts`, `apps/mcp/src/server.ts`

1. Add `getConceptQuality()` handler to `derived.ts`:
   - Input: `{ record_id?: string; key?: string; min_score?: number }`
   - If `record_id` or `key`: return single concept with `quality_score`, `coverage_detail`, `evidence_detail`, `richness_detail`
   - If `min_score`: return all concepts with `overall >= min_score`
   - If none: return all concepts with their scores
   - Graceful fallback: if `quality_score` missing, return `quality_score: null` with message
2. Register in `server.ts` with input schema
3. Add `get_concept_quality` to `REQUIRED_TOOLS` array

**Completion criterion**: `get_concept_quality` is registered, appears in tool list, returns scores for concepts.

### Step 4: Sort by quality in existing MCP tools

**Files**: `apps/mcp/src/tools/design.ts`

1. In `findCrossGameConcepts()`: after filtering, sort by `quality_score.overall` descending; records without `quality_score` sort last
2. In `findDesignPrimitives()`: same sort logic
3. Sorting happens before pagination

**Completion criterion**: `find_cross_game_concepts` and `find_design_primitives` return results sorted by quality score descending.

### Step 5: Add quality badges to web app

**Files**: `apps/web/src/lib/design-data.ts`, `apps/web/src/pages/design.astro`, `apps/web/src/pages/concepts.astro`

1. In `design-data.ts`:
   - Add `qualityScore?: { coverage: number; evidence: number; richness: number; overall: number } | null` to `ConceptCard` interface
   - Update `extractConceptCard()` to read `quality_score` from record
   - Update `buildDesignData()` concept cards to include `qualityScore`
2. In `design.astro`: add badge element to concept card template (A/B/C with color classes)
3. In `concepts.astro`: add badge element to concept card template
4. Badges are pure HTML/CSS — no JavaScript needed
5. If `qualityScore` is null, no badge rendered

**Completion criterion**: `/design` and `/concepts` pages show A/B/C quality badges on concept cards.

### Step 6: Tests

**Files**: `tests/` (new test file)

1. Add test for `computeQualityScores()`:
   - Verify coverage score for a concept with `source_games` covering all bindings = 1.0
   - Verify evidence score for a concept with 10+ valid refs = 1.0
   - Verify richness score for a design primitive with known relations
   - Verify edge cases: no ancestry, no refs, no relations → sub-scores = 0
   - Verify overall score formula
2. Add test for MCP `getConceptQuality` tool:
   - Returns scores for a known concept
   - Returns null for records without scores
   - `min_score` threshold filters correctly

**Completion criterion**: All new tests pass.

### Step 7: Validation

1. `pnpm materialize` — verify scores appear in `dist/records.jsonl`
2. `pnpm exec turbo run build:check` — TypeScript compilation
3. `pnpm exec vitest --run` — full test suite
4. Verify `get_concept_quality` appears in `REQUIRED_TOOLS`
5. Verify web pages render badges (visual check or snapshot)

**Completion criterion**: All CI gates pass.

### Step 8: Review and fix

1. Run `fo-review` on all session code changes
2. Run `fo-fix` if review has findings

**Completion criterion**: Review report exists, no unresolved findings.

### Step 9: Stamp implemented

1. Run `forge rfc.implement.stamp --id RFC-0009 --implementation-commit <sha>`
2. Update `AGENTS.md` if needed
3. Commit

**Completion criterion**: RFC-0009 status is `implemented`.

## Acceptance criteria mapping

| Criterion | Step |
|---|---|
| Every concept in `dist/records.jsonl` has `quality_score` | Step 2 |
| `quality_score` in SQLite read model | Step 2 |
| `get_concept_quality` MCP tool returns scores | Step 3 |
| `get_concept_quality` returns null with fallback for missing scores | Step 3 |
| Web app shows quality badges on concept cards | Step 5 |
| `find_cross_game_concepts` sorts by quality by default | Step 4 |
| Scoring thresholds configurable via `knowledge.config.yaml` | Step 2 |
| All tests pass including edge case tests | Step 6, Step 7 |

## Risks and mitigations

- **Score staleness**: Recomputed on every `pnpm materialize` run — no action needed
- **Missing scores in old dist**: Graceful fallback in MCP tool (null + message) and web app (no badge)
- **Config parsing failure**: Default config used if `quality_scoring` key absent or malformed
