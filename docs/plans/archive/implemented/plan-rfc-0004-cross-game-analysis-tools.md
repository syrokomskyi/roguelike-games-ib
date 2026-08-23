# Plan: RFC-0004 — Cross-game analysis tools

- **RFC**: RFC-0004
- **Status**: accepted
- **Created**: 2026-08-23

## Objectives

1. Extend `compare_games` with optional `include_concepts` parameter (D1)
2. Add `get_coverage_matrix` tool (D2)
3. Add `get_concept_coverage` tool (D3)
4. Add `compare_concept_implementations` tool with YAML data file (D4)
5. Add `find_concept_gaps` tool (D5)
6. Add tests covering all 4 new tools + extension
7. Verify clean compile, all tests pass, REQUIRED_TOOLS has 28 entries

## Steps

### Step 1: Extend `compare_games` with concept coverage (D1)

**Files**: `apps/mcp/src/tools/compare.ts`, `apps/mcp/src/server.ts`

1. Add `include_concepts?: boolean` to `compareGames()` input type
2. When `include_concepts` is true, for each game:
   - Filter all concept records where `ancestry.source_games` includes the game's `source_id`
   - Also find concepts where `implementation_refs` resolves to records from that game (resolve each ref via `ctx.store.resolveRecordById`, check `source_identity.source_id`)
   - Deduplicate concepts found by both methods
   - Group by `concept_type`, return counts + concept titles
3. Add `include_concepts` to the `compare_games` input schema in `server.ts` (optional boolean, default false)
4. Existing behavior unchanged when `include_concepts` is absent or false

**Completion criterion**: `compareGames(ctx, { source_ids: ["src-a","src-b"], include_concepts: true })` returns `concept_coverage` per game with counts grouped by concept_type.

### Step 2: Implement `get_coverage_matrix` (D2)

**Files**: `apps/mcp/src/tools/derived.ts`, `apps/mcp/src/server.ts`

1. Add `getCoverageMatrix()` to `derived.ts`:
   - Get all concept records (`record_type === "concept"`)
   - For each concept, determine covered games: check `ancestry.source_games` (array of source IDs) and resolve `implementation_refs` to records and check their `source_identity.source_id`
   - Build `matrix[sourceId][conceptType] = count`
   - Collect all unique concept_types and source_ids
   - Return `{ matrix, concept_types, source_ids }`
2. Register in `server.ts`:
   - Name: `get_coverage_matrix`
   - Schema: `{ type: "object", properties: {}, additionalProperties: false }`
   - `readOnly: true`
3. Add `"get_coverage_matrix"` to `REQUIRED_TOOLS`

**Completion criterion**: `getCoverageMatrix(ctx, {})` returns a matrix with all registered source_ids as rows and all concept_types as columns.

### Step 3: Implement `get_concept_coverage` (D3)

**Files**: `apps/mcp/src/tools/derived.ts`, `apps/mcp/src/server.ts`

1. Add `getConceptCoverage()` to `derived.ts`:
   - Find concept by `record_id` or `key` (reuse pattern from `getConceptMembers`)
   - Validate it's a concept record
   - Resolve `implementation_refs` and `ancestry.derived_from` to records
   - Group resolved records by `source_identity.source_id`
   - For each game: return `member_count`, `sample_records` (up to `limit`, default 10), `observed_in_notes` (from `ancestry.observed_in` — descriptive strings)
   - Identify gaps: registered source_ids with zero members
   - Return `{ concept, coverage_by_game, gaps }`
2. Handle edge cases:
   - Concept with no `ancestry` → empty coverage, all games are gaps
   - Dangling `implementation_refs` → skip unresolved refs, no error
3. Register in `server.ts`:
   - Name: `get_concept_coverage`
   - Schema: `{ type: "object", properties: { record_id: {type: string}, key: {type: string}, limit: {type: integer, minimum: 1, maximum: 100} }, additionalProperties: false }`
   - `readOnly: true`
4. Add `"get_concept_coverage"` to `REQUIRED_TOOLS`

**Completion criterion**: `getConceptCoverage(ctx, { key: "fire-resistance" })` returns coverage by game with member counts, sample records, observed_in_notes, and gaps array.

### Step 4: Implement `compare_concept_implementations` (D4)

**Files**: `apps/mcp/src/tools/derived.ts`, `apps/mcp/src/tools/concept-implementations.yaml`, `apps/mcp/src/server.ts`

1. Create `apps/mcp/src/tools/concept-implementations.yaml`:
   - Structure: `{ conceptKey: { sourceId: { summary: string, distinguishingAttributes: { key: value } } } }`
   - Start with 5 key design primitives: `permadeath`, `procedural_generation`, `inventory_management`, `identification_system`, `religion_and_god`
   - For each primitive, write 1-2 sentence summaries for all 4 games (broguece, cataclysm-bn, crawl, nethack)
   - This is human-authored content — the agent writes best-effort summaries based on game knowledge
2. Add `compareConceptImplementations()` to `derived.ts`:
   - Read and parse the YAML file (use `node:fs.readFileSync` + `yaml` package, or parse as JSON if using `js-yaml`)
   - Check if `js-yaml` is available; if not, use a JSON file instead (`concept-implementations.json`)
   - Find concept by `concept_key`
   - For each requested `source_ids` (default: all registered sources):
     - Look up `conceptKey.sourceId` in the YAML data
     - If found: return `implementation_summary`, `distinguishing_attributes`, `exemplar_records` (resolve `implementation_refs` for that game)
     - If not found: return `implementation_summary: null`, empty `distinguishing_attributes`, empty `exemplar_records`
   - Return `{ concept, comparisons }`
3. Register in `server.ts`:
   - Name: `compare_concept_implementations`
   - Schema: `{ type: "object", properties: { concept_key: {type: string}, source_ids: {type: array, items: {type: string}} }, required: ["concept_key"], additionalProperties: false }`
   - `readOnly: true`
4. Add `"compare_concept_implementations"` to `REQUIRED_TOOLS`

**Completion criterion**: `compareConceptImplementations(ctx, { concept_key: "permadeath" })` returns comparisons for all 4 games with summaries from the YAML file.

### Step 5: Implement `find_concept_gaps` (D5)

**Files**: `apps/mcp/src/tools/derived.ts`, `apps/mcp/src/server.ts`

1. Add `findConceptGaps()` to `derived.ts`:
   - Get all concept records (optionally filtered by `concept_type`)
   - For each concept, determine which games have members (from `ancestry.source_games` or `implementation_refs` resolution)
   - Compare against all registered source IDs (from `ctx.store.sources`)
   - Report concepts where at least one game is missing
   - If `source_id` filter provided: only report gaps for that game
   - Build summary: total_concepts, concepts_with_gaps, games_with_most_gaps (sorted desc)
   - Return `{ gaps, summary }`
2. Handle edge case: concept with no `ancestry` and no `implementation_refs` → all games are gaps
3. Register in `server.ts`:
   - Name: `find_concept_gaps`
   - Schema: `{ type: "object", properties: { concept_type: {type: string}, source_id: {type: string} }, additionalProperties: false }`
   - `readOnly: true`
4. Add `"find_concept_gaps"` to `REQUIRED_TOOLS`

**Completion criterion**: `findConceptGaps(ctx, {})` returns gaps array with concepts missing from at least one game, plus summary with counts.

### Step 6: Add tests

**Files**: `tests/mcp/mcp-012.test.ts`

1. Create test file following the pattern of `mcp-011.test.ts`
2. Test fixtures: 2-3 sources, concept records with `ancestry.source_games`, `ancestry.derived_from`, `implementation_refs`, `ancestry.observed_in`
3. Test cases:
   - **D1**: `compare_games` with `include_concepts: true` returns `concept_coverage` per game
   - **D1**: `compare_games` without `include_concepts` returns unchanged output
   - **D2**: `get_coverage_matrix` returns correct counts for all sources × concept_types
   - **D2**: `get_coverage_matrix` includes all registered source_ids
   - **D3**: `get_concept_coverage` returns member counts and observed_in_notes per game
   - **D3**: `get_concept_coverage` identifies gaps correctly
   - **D3**: `get_concept_coverage` handles concept with no ancestry (no error)
   - **D3**: `get_concept_coverage` works with both `record_id` and `key`
   - **D4**: `compare_concept_implementations` returns summaries for games with curated notes
   - **D4**: `compare_concept_implementations` returns null summary for games without curated notes
   - **D5**: `find_concept_gaps` identifies concepts missing from specific games
   - **D5**: `find_concept_gaps` filters by `concept_type`
   - **D5**: `find_concept_gaps` filters by `source_id`
   - **D5**: `find_concept_gaps` summary has correct counts
   - **Registration**: all 4 new tools are registered, read-only, in REQUIRED_TOOLS, no write patterns in names

**Completion criterion**: `pnpm exec vitest --run tests/mcp/mcp-012.test.ts` passes all tests.

### Step 7: Verify

1. `pnpm exec tsc --noEmit -p apps/mcp/tsconfig.json` — clean compile
2. `pnpm exec vitest --run` — all tests pass (no regressions)
3. Verify `REQUIRED_TOOLS` includes 28 entries (24 existing + 4 new)
4. Run `pnpm exec forge rfc.validate --id RFC-0004 --json` — passes

**Completion criterion**: All 3 commands pass with zero errors.

### Step 8: Review & Fix

1. Run `fo-review` on all session code changes
2. If review has findings, run `fo-fix` to address them
3. Re-run tests after any fixes

**Completion criterion**: Review report exists in `docs/reviews/code/`, any findings addressed.

### Step 9: Stamp implemented

1. Run `pnpm exec forge rfc.implement.stamp --id RFC-0004 --implementation-commit <sha>`
2. Verify RFC status transitions to `implemented`

**Completion criterion**: RFC-0004 status is `implemented` in frontmatter.

## Acceptance criteria mapping

| Criterion | Step |
|---|---|
| `compare_games` with `include_concepts: true` returns concept coverage per game | Step 1 |
| `get_coverage_matrix` returns a game × concept_type count matrix | Step 2 |
| `get_concept_coverage` returns detailed per-game coverage for a concept, including gaps | Step 3 |
| `compare_concept_implementations` returns curated implementation summaries per game | Step 4 |
| `find_concept_gaps` identifies concepts missing from specific games | Step 5 |
| All 4 new tools are read-only and registered in `REQUIRED_TOOLS` | Steps 2-5 |
| All existing tests pass (no regressions) | Step 7 |
| New tests cover all 4 tools | Step 6 |
| Edge case: concepts with no ancestry return member_count: 0 and appear in gaps | Steps 3, 5, 6 |

## Risks and mitigations

- **YAML parsing**: If `js-yaml` is not available as a dependency, use `concept-implementations.json` instead. Check `package.json` dependencies before deciding.
- **Dangling refs**: All tools handle unresolved `implementation_refs` gracefully (skip, count 0, no error).
- **Tool count**: 28 tools total — within manageable range. No action needed for this RFC.
