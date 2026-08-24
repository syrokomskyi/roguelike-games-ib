---
id: PLAN-RFC-0019
title: Design concept implementation references — link design primitives and patterns to definition records
status: accepted
scope: project-wide
decider: architecture
reviewers:
  - human:andrii-syrokomskyi
related:
  - RFC-0019
  - RFC-0002
  - RFC-0003
  - RFC-0011
created: 2026-08-24
accepted: 2026-08-24
implementedAt:
closedAt: null
---

# PLAN-RFC-0019: Design concept implementation references — link design primitives and patterns to definition records

## Context

RFC-0019 is accepted. The design stage script (`scripts/run-stage-design.ts`) generates design primitives, patterns, and concrete examples but leaves `implementation_refs: []` for primitives and patterns, and `record_refs: []` for concrete examples. This plan implements an LLM-based matching step (Step 6.5) that populates these fields by semantically matching each primitive/pattern against definition records from each game.

## Objectives

1. Add a two-step LLM matching function (kind selection → record selection) to `scripts/run-stage-design.ts`
2. Populate `implementation_refs` on all 14 design primitives with record IDs from at least 1 game
3. Populate `implementation_refs` on all 10 design patterns with record IDs from at least 1 game
4. Populate `concrete_examples[].record_refs` using matching results (no separate LLM call)
5. Add conformance test `c20-design-implementation-refs.test.ts` verifying refs are non-empty and resolve
6. All existing tests pass

## Steps

### Step 1: Add matching helper functions to `run-stage-design.ts`

Add the two-step LLM matching infrastructure.

**Actions**:
1. Add `getGameKinds(state, game)` function:
   - Filter `state.records` for `record_type === "definition"` and `source_identity.game === game`
   - Group by `kind` field, count records per kind
   - Return array of `{ kind: string, count: number }` sorted by count descending
2. Add `getRecordsByKind(state, game, kind, limit = 50)` function:
   - Filter `state.records` for matching game, kind, and `record_type === "definition"`
   - Return up to `limit` records as `{ id: string, name: string }` pairs
3. Add `matchPrimitiveToGame(state, primitive, game)` async function:
   - Step A: Call `llmJson()` with kind list + primitive title/definition → returns `string[]` of relevant kinds
   - Step B: For each relevant kind, call `llmJson()` with sample record names + primitive title/definition → returns `{ select_all: boolean, record_ids: string[] }`
   - If `select_all: true`, collect all record IDs of that kind via `getRecordsByKind(state, game, kind, Infinity)`
   - If `select_all: false`, use the returned `record_ids` as-is
   - Return union of all matched record IDs for this `(primitive, game)` pair
   - Wrap in try/catch: on failure, return `[]` and log warning
4. Add `matchPatternToGame(state, pattern, game)` async function:
   - Same two-step process, but prompt includes pattern title/definition + `member_primitives` titles as context
   - Return union of matched record IDs

**Files**: `scripts/run-stage-design.ts`

**Completion criterion**: Functions exist, compile without errors, and return record ID arrays. LLM calls use existing `llm()` / `llmJson()` with cache.

### Step 2: Insert Step 6.5 matching loop and wire into Step 7 and Step 8

Insert the matching step between failure mode generation (Step 6, line ~1002) and concrete examples (Step 7, line ~1004).

**Actions**:
1. After Step 6 (failure modes), add Step 6.5 block:
   ```typescript
   // === Step 6.5: Match primitives and patterns to definition records ===
   const GAMES = ["nethack", "broguece", "crawl", "cataclysm-bn"];
   const primitiveRefs = new Map<string, string[]>(); // slug -> record IDs
   for (const dp of DESIGN_PRIMITIVES) {
     const allRefs: string[] = [];
     for (const game of GAMES) {
       const refs = await matchPrimitiveToGame(state, dp, game);
       allRefs.push(...refs);
     }
     primitiveRefs.set(dp.slug, allRefs);
     // Update the primitive concept's implementation_refs
     const primConcept = concepts.find(c => c.key === `cross-game/concept/design-${dp.slug}`);
     if (primConcept) primConcept.implementation_refs = allRefs;
   }
   ```
2. Extend Step 7 (concrete examples): after generating the text description for each `(primitive, game)` pair, populate `record_refs` from `primitiveRefs`:
   ```typescript
   const refs = primitiveRefs.get(dp.slug) ?? [];
   const gameRefs = refs.filter(id => {
     const rec = state.records.find(r => r.id === id);
     return rec?.source_identity?.game === game;
   });
   examples.push({ game, ...example, record_refs: gameRefs });
   ```
3. After Step 8 (design pattern generation), add pattern matching block:
   ```typescript
   // === Step 8.5: Match design patterns to definition records ===
   for (const pattern of DESIGN_PATTERNS) {
     const allRefs: string[] = [];
     for (const game of pattern.games_where_present) {
       const refs = await matchPatternToGame(state, pattern, game);
       allRefs.push(...refs);
     }
     const patConcept = concepts.find(c => c.key === `cross-game/concept/pattern-${pattern.slug}`);
     if (patConcept) patConcept.implementation_refs = allRefs;
   }
   ```
4. Update `llmTotalCalls` estimate to include matching calls (~340 total)

**Files**: `scripts/run-stage-design.ts`

**Completion criterion**: Script runs end-to-end. Primitives have non-empty `implementation_refs`. Patterns have non-empty `implementation_refs`. Concrete examples have non-empty `record_refs` for at least 2 games per primitive.

**Human review point**: Operator reviews LLM matching quality before committing to canonical.

### Step 3: Run script and promote to canonical

Execute the extended script and commit results.

**Actions**:
1. Run `npx tsx scripts/run-stage-design.ts`
2. Review generated output — verify `implementation_refs` are populated and resolve to real records
3. Commit updated canonical files to `knowledge/concept/cross-game/concept/`

**Files**: `knowledge/concept/cross-game/concept/design-*.jsonl`, `knowledge/concept/cross-game/concept/pattern-*.jsonl`

**Completion criterion**: 14 `design-*.jsonl` files have non-empty `implementation_refs`. 10 `pattern-*.jsonl` files have non-empty `implementation_refs`. Concrete examples have `record_refs` populated.

**Human review point**: Operator reviews LLM output before commit.

### Step 4: Add conformance test `c20-design-implementation-refs.test.ts`

Add a new conformance test verifying design concept ref completeness and resolution.

**Actions**:
1. Create `tests/conformance/c20-design-implementation-refs.test.ts`:
   - Read all concepts from `knowledge/concept/cross-game/`
   - Read all definitions from `knowledge/definition/`
   - Build a set of all record IDs
   - Test 1: All `design_primitive` concepts have non-empty `implementation_refs`
   - Test 2: All `design_pattern` concepts have non-empty `implementation_refs`
   - Test 3: All `implementation_refs` on design primitives and patterns resolve to existing record IDs
   - Test 4: All `concrete_examples` on design primitives have non-empty `record_refs` for at least 2 games
   - Test 5: All `record_refs` in concrete examples resolve to existing record IDs
2. Follow the pattern of `c14-concept-ref-integrity.test.ts` for file reading

**Files**: `tests/conformance/c20-design-implementation-refs.test.ts`

**Completion criterion**: Test file exists, compiles, and passes when run with `pnpm exec vitest tests/conformance/c20-design-implementation-refs.test.ts --run`.

### Step 5: Validate and verify

Run the full validation suite.

**Actions**:
1. Run `pnpm exec forge rfc.validate --id RFC-0019 --json`
2. Run `pnpm exec turbo run build:check`
3. Run `pnpm exec vitest --run`
4. Run `pnpm materialize` to verify canonical state is consistent

**Completion criterion**: All checks pass. No new test failures. `rfc.validate` is clean.

### Step 6: Review and fix

Run `fo-review` on all session code changes. Apply `fo-fix` if findings.

**Completion criterion**: Review complete, all findings addressed.

### Step 7: Stamp implemented

Run `pnpm exec forge rfc.implement.stamp --id RFC-0019 --implementation-commit <sha>` to transition `accepted → implemented`.

**Completion criterion**: RFC-0019 status is `implemented`.

## Validation suite

| Check | Command | When |
|---|---|---|
| RFC validation | `pnpm exec forge rfc.validate --id RFC-0019 --json` | After all changes |
| TypeScript | `pnpm exec turbo run build:check` | After code changes |
| Tests | `pnpm exec vitest --run` | After all changes |
| Materialize | `pnpm materialize` | After canonical changes |

## Risk mitigations

| Risk | Mitigation step |
|---|---|
| LLM matching false positives | Step 3 human review point; conformance test checks existence not correctness |
| LLM cost (~340 calls) | All calls cached in `systems-cache/llm-design-cache.json`; one-time cost |
| LLM returns invalid record IDs | Existing `validateConceptRefs()` in `run-stage-concepts.ts` strips dangling refs; c20 test catches |
| Primitive has no implementation in any game | Conformance test checks total refs across all games, not per-game |
| Script idempotency | `cleanDesignData()` removes all previous design records before regeneration |
| Step 6.5 ordering | Matching runs before concrete examples (Step 7) to reuse results for `record_refs` |
