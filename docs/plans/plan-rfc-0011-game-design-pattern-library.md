---
id: PLAN-RFC-0011
title: Game design pattern library — concrete examples, pattern combinations, and anti-patterns
status: accepted
scope: project-wide
decider: architecture
reviewers:
  - human:andrii-syrokomskyi
related:
  - RFC-0011
  - RFC-0003
  - RFC-0004
  - RFC-0009
created: 2026-08-23
accepted: 2026-08-23
implementedAt:
closedAt: null
---

# PLAN-RFC-0011: Game design pattern library — concrete examples, pattern combinations, and anti-patterns

## Context

RFC-0011 is accepted. The design layer (RFC-0003) has 469 concepts but lacks concrete examples, pattern combinations, and anti-pattern links. This plan implements the RFC's 5 decisions (D1–D5) across 6 steps.

## Objectives

1. Add `concrete_examples` field to 15 design primitive concept records
2. Create 10 `design_pattern` concept records with member primitives and game coverage
3. Add `TRIGGERED_BY_COMBINATION` relation type and ≥5 anti-pattern relations
4. Add `find_design_patterns` and `get_pattern_examples` MCP tools
5. Add `/patterns` web page with pattern data
6. All tests pass

## Steps

### Step 1: Add `TRIGGERED_BY_COMBINATION` relation type (D3)

Add the new relation type to the ontology.

**Actions**:
1. Add entry to `knowledge/ontology/relation-types.yaml`:
   - `id: TRIGGERED_BY_COMBINATION`
   - `semantics: Source failure mode is triggered by target design pattern combination.`
   - `direction: directed`
   - `evidence_required: true`
   - `domain: [concept]`
   - `range: [concept]`

**Files**: `knowledge/ontology/relation-types.yaml`

**Completion criterion**: `TRIGGERED_BY_COMBINATION` entry exists in `relation-types.yaml` with correct schema fields.

### Step 2: Extend `run-stage-design.ts` with pattern generation (D1, D2, D3)

Extend the existing design script to generate concrete examples, pattern records, and anti-pattern relations.

**Actions**:
1. Add `PATTERN_ACTOR_ID = "design-patterns"` constant
2. Extend `cleanDesignData()` to also remove records with `actor_id === "design-patterns"`
3. Add `DESIGN_PATTERNS` constant array with 10 curated patterns (from RFC D2)
4. Add concrete example generation loop:
   - For each of the 15 design primitives, call LLM to generate examples per game
   - Add `concrete_examples` field to the existing primitive concept record
   - Use `llmJson()` helper with caching via `systems-cache/llm-design-cache.json`
5. Add pattern record generation:
   - Create `design_pattern` concept records using `makeConceptEnvelope()` with `PATTERN_ACTOR_ID`
   - Include `member_primitives`, `member_pressures`, `games_where_present`, `games_where_absent` fields
   - Set `ancestry.derived_from` to member primitive concept IDs
   - Set `ancestry.source_games` to `games_where_present`
6. Add anti-pattern relation generation:
   - For each failure mode that matches a pattern's trigger conditions, create `TRIGGERED_BY_COMBINATION` relation
   - Use `makeRelationEnvelope()` with `PATTERN_ACTOR_ID`
7. Wire new generation steps into the main `main()` function after Step 6 (failure modes)

**Files**: `scripts/run-stage-design.ts`

**Completion criterion**: Script runs successfully, generates 10 `design_pattern` records, ≥5 `TRIGGERED_BY_COMBINATION` relations, and adds `concrete_examples` to 15 primitive records. Re-runs are idempotent (clean removes old pattern records).

**Human review point**: LLM-generated concrete examples and pattern definitions require human review before committing to canonical.

### Step 3: Run script and promote to canonical

Execute the extended script and commit results.

**Actions**:
1. Run `npx tsx scripts/run-stage-design.ts`
2. Review generated output — check pattern records for accuracy, check examples for correctness
3. Commit curated content to `knowledge/concept/cross-game/concept/`

**Files**: `knowledge/concept/cross-game/concept/`

**Completion criterion**: 10 `design_pattern` JSONL files exist in `knowledge/concept/cross-game/concept/`, 15 primitive records have `concrete_examples` field, ≥5 `TRIGGERED_BY_COMBINATION` relation files exist.

**Human review point**: Operator reviews LLM output before commit.

### Step 4: Add MCP tools (D4)

Add two new read-only MCP tools for querying patterns and examples.

**Actions**:
1. Add `findDesignPatterns()` to `apps/mcp/src/tools/derived.ts`:
   - Filter concepts by `concept_type === "design_pattern"`
   - Optional filter by `game` (checks `games_where_present`) or `primitive_key` (checks `member_primitives`)
   - Return pattern list with title, definition, member primitives, game coverage
2. Add `getPatternExamples()` to `apps/mcp/src/tools/derived.ts`:
   - Resolve pattern by key
   - Return `concrete_examples` from member primitives, grouped by game
3. Register both tools in `apps/mcp/src/server.ts`:
   - Add import to derived.ts import line
   - Add tool registration blocks with `readOnly: true`
   - Add tool names to `REQUIRED_TOOLS` array
4. Update `MODULE_CONTRACT` and `CHANGE_SUMMARY` comments in `derived.ts`

**Files**: `apps/mcp/src/tools/derived.ts`, `apps/mcp/src/server.ts`

**Completion criterion**: `find_design_patterns` and `get_pattern_examples` are registered in `REQUIRED_TOOLS`, have valid JSON schemas, and return correct results when called.

### Step 5: Add web pages (D5)

Add pattern index page and extend design data helpers.

**Actions**:
1. Add `buildPatternData()` to `apps/web/src/lib/design-data.ts`:
   - Filter concepts by `concept_type === "design_pattern"`
   - Return pattern cards with member primitives, pressures, game coverage, concrete examples
   - Update `MODULE_CONTRACT` and `CHANGE_SUMMARY` comments
2. Create `apps/web/src/pages/patterns.astro`:
   - List all design patterns with game coverage badges
   - Link to concept pages for member primitives
   - Include `MODULE_CONTRACT` and `CHANGE_SUMMARY` comments per `apps/web/AGENTS.md`
3. Add pattern section to `apps/web/src/pages/design.astro`:
   - Link to `/patterns` page

**Files**: `apps/web/src/lib/design-data.ts`, `apps/web/src/pages/patterns.astro`, `apps/web/src/pages/design.astro`

**Completion criterion**: `/patterns` page renders all 10 patterns with game coverage badges. `buildPatternData()` returns correct data from ProjectionStore.

### Step 6: Tests and verification

Add conformance tests and run full verification suite.

**Actions**:
1. Add conformance test `tests/conformance/c13-design-patterns.test.ts`:
   - Test that `design_pattern` concept records exist with required fields
   - Test that `TRIGGERED_BY_COMBINATION` relations exist
   - Test that `concrete_examples` field exists on design primitives
2. Add MCP tool tests to existing test structure:
   - Test `findDesignPatterns()` returns patterns
   - Test `getPatternExamples()` returns examples
3. Run `pnpm materialize` to compute quality scores for new records
4. Run `pnpm exec turbo run build:check`
5. Run `pnpm exec vitest --run`
6. Run `pnpm exec forge rfc.validate --id RFC-0011 --json`

**Files**: `tests/conformance/c13-design-patterns.test.ts`

**Completion criterion**: All tests pass. `build:check` succeeds. `vitest` passes. `rfc.validate` passes.

### Step 7: Review and fix

Run `fo-review` on all session code changes. Apply `fo-fix` if findings.

**Completion criterion**: Review complete, all findings addressed.

### Step 8: Stamp implemented

Run `pnpm exec forge rfc.implement.stamp --id RFC-0011 --implementation-commit <sha>` to transition `accepted → implemented`.

**Completion criterion**: RFC-0011 status is `implemented`.

## Validation suite

| Check | Command | When |
|---|---|---|
| RFC validation | `pnpm exec forge rfc.validate --id RFC-0011 --json` | After all changes |
| TypeScript | `pnpm exec turbo run build:check` | After code changes |
| Tests | `pnpm exec vitest --run` | After all changes |
| Materialize | `pnpm materialize` | After canonical changes |

## Risk mitigations

| Risk | Mitigation step |
|---|---|
| LLM example quality | Step 3 human review point |
| Pattern subjectivity | 10 curated patterns from RFC, not LLM-generated |
| Scope creep | Phase 1 = primitives only (60 examples) |
| Script idempotency | `cleanDesignData()` extended for `design-patterns` actor |
| MCP tool registration | Step 4 adds to `REQUIRED_TOOLS` |
