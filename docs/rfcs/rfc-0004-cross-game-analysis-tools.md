---
id: RFC-0004
title: "Cross-game analysis tools — concept-aware comparison and coverage matrix"
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
  - RFC-0001
  - RFC-0002
  - RFC-0003
  - PLAN-003
satisfies: []
versionBump: minor
commands:
  proposed: []
  added: []
  changed: []
  removed: []
appsImpacted:
  - mcp
packagesImpacted: []
successSignals:
  - compare_games returns concept coverage per game (which primitives are present)
  - get_coverage_matrix returns a game × concept_type matrix
  - get_concept_coverage returns which games implement a specific concept and how
  - MCP tools enable meaningful cross-game design analysis queries
nonGoals:
  - Does not modify the search API or web app — those are covered in RFC-0005
  - Does not create new concept types — uses existing concept_type taxonomy
  - Does not compute semantic similarity between games — returns structural coverage only
  - Does not define DNA invariants — the project has no invariants file configured (invariantsFile: null in forge.yaml)
---

# RFC-0004: Cross-game analysis tools — concept-aware comparison and coverage matrix

## Context

PLAN-003 introduced 74 concept records (15 design primitives, 31 design pressures, 28 cross-game mechanics) and 24 MCP tools. The existing `compare_games` tool (`apps/mcp/src/tools/compare.ts`) compares games by raw record counts and record types — it does not reason about concepts, design primitives, or cross-game mechanic coverage.

### Current `compare_games` output

```json
{
  "games": [
    {
      "source_id": "nethack",
      "record_count": 830,
      "record_types": { "definition": 830 },
      "records": [...]
    }
  ]
}
```

This is a flat record listing. It does not answer questions like:

- "Which design primitives are present in each game?"
- "How does each game implement the identification system?"
- "Which games have a religion/god system?"
- "What concepts does Crawl share with NetHack?"

### Existing tools that partially address this

- `find_cross_game_concepts` — lists concepts, optionally filtered by `concept_type`
- `get_concept_members` — resolves member records of a concept, grouped by source game
- `query_design_space` — queries design-space relations
- `find_by_attribute` — cross-game attribute search

But there is no tool that produces a **coverage matrix** (game × concept) or a **concept-aware comparison** (how each game implements a specific concept).

## Problem

Without concept-aware comparison tools:

1. **No coverage overview**: A user cannot ask "which design primitives does each game have?" in a single query. They must call `get_concept_members` for each primitive individually and check which games have members.

2. **No implementation comparison**: A user cannot ask "how does NetHack implement permadeath vs how BrogueCE implements it?" in a structured way. They must manually find records in each game and compare attributes.

3. **No gap analysis**: There is no way to identify which concepts are missing from which games — useful for both knowledge base quality (did we extract enough?) and game design analysis (which mechanics does each game lack?).

## Decision

### D1: Extend `compare_games` with concept coverage

Add an optional `include_concepts` parameter to `compare_games`. When true, the response includes a `concept_coverage` section per game:

```json
{
  "games": [
    {
      "source_id": "nethack",
      "record_count": 830,
      "record_types": { ... },
      "concept_coverage": {
        "design_primitives": ["permadeath", "procedural_generation", "inventory_management", ...],
        "cross_game_mechanics": ["fire_resistance", "cold_resistance", ...],
        "design_primitives_count": 12,
        "cross_game_mechanics_count": 8
      }
    }
  ]
}
```

**Logic**: For each game, check which concepts have `implementation_refs` that include records from that game (by matching `source_identity.source_id`). Also check `ancestry.source_games` for explicit game membership.

**Files**: `apps/mcp/src/tools/compare.ts` — `compareGames()` function.

### D2: New tool `get_coverage_matrix`

Returns a matrix of games × concept_types with counts:

```json
{
  "matrix": {
    "broguece": {
      "design_primitive": 7,
      "design_pressure": 0,
      "cross_game_mechanic": 12,
      "mutation_vector": 0,
      "design_knob": 0,
      "counterplay_pattern": 0,
      "failure_mode": 0
    },
    "nethack": {
      "design_primitive": 10,
      "design_pressure": 0,
      "cross_game_mechanic": 15,
      ...
    }
  },
  "concept_types": ["design_primitive", "design_pressure", "cross_game_mechanic", ...],
  "source_ids": ["broguece", "cataclysm-bn", "crawl", "nethack"]
}
```

**Logic**:
1. Get all concept records
2. For each concept, determine which games it covers (from `ancestry.source_games` or by resolving `implementation_refs` to records and checking their `source_id`)
3. Build a count matrix: `matrix[sourceId][conceptType] = count`

**Input**: `{}` (no parameters — returns full matrix)

**Files**: `apps/mcp/src/tools/derived.ts` — new `getCoverageMatrix()` function. Register in `server.ts`.

### D3: New tool `get_concept_coverage`

Returns detailed coverage for a single concept — which games implement it, which records exemplify it in each game, and what attributes are relevant:

```json
{
  "concept": {
    "record_id": "...",
    "record_key": "cross-game/concept/fire_resistance",
    "concept_type": "cross_game_mechanic",
    "title": "Fire Resistance",
    "definition": "..."
  },
  "coverage_by_game": {
    "nethack": {
      "member_count": 45,
      "sample_records": [
        { "record_id": "...", "record_key": "nethack/creature/red_dragon", "title": "Red Dragon" }
      ],
      "observed_in_notes": ["monsters.h resistance flags", "monsters.h conveys flags"]
    },
    "crawl": {
      "member_count": 0,
      "sample_records": [],
      "observed_in_notes": []
    }
  },
  "gaps": ["crawl"]
}
```

**Logic**:
1. Find the concept by `record_id` or `key`
2. Resolve `implementation_refs` and `ancestry.derived_from` to records
3. Group by `source_id`
4. For each game, list member records and `observed_in_notes` (from `ancestry.observed_in` — descriptive strings, not attribute names)
5. Identify games with zero members as gaps

**Input**: `{ record_id?: string; key?: string; limit?: number }`

**Files**: `apps/mcp/src/tools/derived.ts` — new `getConceptCoverage()` function. Register in `server.ts`.

### D4: New tool `compare_concept_implementations`

Compares how two or more games implement the same concept, showing attribute differences side by side:

```json
{
  "concept": { "record_key": "cross-game/concept/design-permadeath", "title": "Permadeath" },
  "comparisons": [
    {
      "source_id": "nethack",
      "implementation_summary": "Death is fully permanent. No respawn, no recovery. Character save file is deleted.",
      "exemplar_records": [...],
      "distinguishing_attributes": { "death_handling": "permanent", "respawn": "none" }
    },
    {
      "source_id": "broguece",
      "implementation_summary": "Death is fully permanent. Single-character game with no respawn mechanic.",
      "exemplar_records": [...],
      "distinguishing_attributes": { "death_handling": "permanent", "respawn": "none" }
    }
  ]
}
```

**Logic**: This is a curated comparison, not auto-generated. The tool reads a YAML data file at `apps/mcp/src/tools/concept-implementations.yaml` that provides human-written implementation summaries per game per concept. Storing curated content in a YAML data file (not inline TypeScript) separates content from code and simplifies maintenance.

**Input**: `{ concept_key: string; source_ids?: string[] }` (defaults to all 4 games)

**Files**: `apps/mcp/src/tools/derived.ts` — new `compareConceptImplementations()` function. `apps/mcp/src/tools/concept-implementations.yaml` — curated implementation summaries. Register in `server.ts`.

### D5: New tool `find_concept_gaps`

Identifies concepts that are missing from specific games — useful for both KB quality and game design analysis:

```json
{
  "gaps": [
    {
      "concept_key": "cross-game/concept/religion_and_god",
      "concept_title": "Religion and God System",
      "concept_type": "design_primitive",
      "missing_from": ["broguece"],
      "present_in": ["nethack", "crawl", "cataclysm-bn"]
    }
  ],
  "summary": {
    "total_concepts": 74,
    "concepts_with_gaps": 15,
    "games_with_most_gaps": [["broguece", 8], ["crawl", 3]]
  }
}
```

**Logic**:
1. For each concept, determine which games have members (from `ancestry.source_games` or `implementation_refs`)
2. Compare against all registered source IDs
3. Report concepts where at least one game is missing

**Input**: `{ concept_type?: string; source_id?: string }` (filter by concept type or find gaps for a specific game)

**Files**: `apps/mcp/src/tools/derived.ts` — new `findConceptGaps()` function. Register in `server.ts`.

## Architectural fit

The RFC extends the existing MCP tool suite in `apps/mcp/` without introducing new packages, new record types, or new pipeline stages. All 4 new tools follow the existing tool pattern: function in `tools/derived.ts`, registration in `server.ts`, entry in `REQUIRED_TOOLS`, `readOnly: true`.

**Package boundaries**: All changes are within `apps/mcp/`. No cross-app imports. The tools read from `ProjectionStore` (provided by `@roguelike-games-ib/projection-sdk`) — same as all existing tools.

**Concept schema**: Tools rely on existing `rgkb/concept@2` schema fields (`concept_type`, `implementation_refs`, `ancestry.source_games`, `ancestry.observed_in`, `ancestry.derived_from`). No schema changes.

**Relationship to existing tools**: `get_concept_coverage` (D3) overlaps with `get_concept_members` (existing) in member resolution, but differs in output shape — `get_concept_members` returns paginated member records; `get_concept_coverage` returns a coverage summary with gaps and `observed_in_notes`. `find_concept_gaps` (D5) overlaps with `get_coverage_matrix` (D2) in gap detection, but differs in granularity — D2 works at concept_type level, D5 works at individual concept level with filtering.

## Design

### TypeScript contracts

```typescript
// D1: compareGames input extension
interface CompareGamesInput {
  source_ids: string[];
  concept_key?: string;
  include_concepts?: boolean; // new
}

// D2: getCoverageMatrix — no input
function getCoverageMatrix(ctx: McpContext): Envelope<CoverageMatrixOutput>;

// D3: getConceptCoverage
function getConceptCoverage(
  ctx: McpContext,
  input: { record_id?: string; key?: string; limit?: number }
): Envelope<ConceptCoverageOutput>;

// D4: compareConceptImplementations
function compareConceptImplementations(
  ctx: McpContext,
  input: { concept_key: string; source_ids?: string[] }
): Envelope<ConceptComparisonOutput>;

// D5: findConceptGaps
function findConceptGaps(
  ctx: McpContext,
  input: { concept_type?: string; source_id?: string }
): Envelope<ConceptGapsOutput>;
```

### Data file: `concept-implementations.yaml`

```yaml
# Curated implementation summaries per game per concept
# Human-authored content — not auto-generated
design-permadeath:
  nethack:
    summary: "Death is fully permanent. No respawn, no recovery. Character save file is deleted."
    distinguishingAttributes:
      death_handling: permanent
      respawn: none
  broguece:
    summary: "Death is fully permanent. Single-character game with no respawn mechanic."
    distinguishingAttributes:
      death_handling: permanent
      respawn: none
```

### Edge cases

- **Concept with no `ancestry` and no `implementation_refs`**: Return `member_count: 0`, empty arrays, include in gaps. No error.
- **Dangling `implementation_refs`**: Handle gracefully (RFC-0002 addresses this). Report `member_count: 0` for unresolved refs.
- **Concept not found in `concept-implementations.yaml`**: `compare_concept_implementations` returns `implementation_summary: null` and empty `distinguishing_attributes` for games without curated notes.
- **Game with no concepts of a type**: `get_coverage_matrix` returns `0` for that cell. `find_concept_gaps` includes all concepts of that type in `missing_from` for that game.

## Implementation plan

### Step 1: Extend `compare_games` with concept coverage (D1)

1. Add `include_concepts?: boolean` parameter to `compareGames()` input schema
2. When `include_concepts` is true, for each game:
   - Find all concepts where `ancestry.source_games` includes the game's `source_id`
   - Also find concepts where `implementation_refs` resolves to records from that game
   - Group by `concept_type` and return counts + titles
3. Update tool schema in `server.ts`

**Files**: `apps/mcp/src/tools/compare.ts`, `apps/mcp/src/server.ts`

### Step 2: Implement `get_coverage_matrix` (D2)

1. Add `getCoverageMatrix()` to `apps/mcp/src/tools/derived.ts`
2. Register in `server.ts` with schema `{ type: "object", properties: {}, additionalProperties: false }`
3. Add to `REQUIRED_TOOLS`

**Files**: `apps/mcp/src/tools/derived.ts`, `apps/mcp/src/server.ts`

### Step 3: Implement `get_concept_coverage` (D3)

1. Add `getConceptCoverage()` to `apps/mcp/src/tools/derived.ts`
2. Register in `server.ts` with schema for `record_id` or `key` + `limit`
3. Add to `REQUIRED_TOOLS`

**Files**: `apps/mcp/src/tools/derived.ts`, `apps/mcp/src/server.ts`

### Step 4: Implement `compare_concept_implementations` (D4)

1. Create `apps/mcp/src/tools/concept-implementations.yaml` — a curated map of `{ conceptKey: { sourceId: { summary, distinguishingAttributes } } }`
2. Start with 5 key design primitives (20 summaries) — for each, write 1-2 sentences per game describing how that game implements the primitive. This is human-authored content, not auto-generated.
3. Add `compareConceptImplementations()` function to `apps/mcp/src/tools/derived.ts` that reads the YAML file
4. Register in `server.ts`

**Files**: `apps/mcp/src/tools/derived.ts`, `apps/mcp/src/tools/concept-implementations.yaml`, `apps/mcp/src/server.ts`

### Step 5: Implement `find_concept_gaps` (D5)

1. Add `findConceptGaps()` to `apps/mcp/src/tools/derived.ts`
2. Register in `server.ts` with schema for optional `concept_type` and `source_id` filters
3. Add to `REQUIRED_TOOLS`

**Files**: `apps/mcp/src/tools/derived.ts`, `apps/mcp/src/server.ts`

### Step 6: Add tests

1. Add `tests/mcp/mcp-012.test.ts` covering all 4 new tools
2. Test with known concepts (e.g., fire_resistance should have gaps for crawl if RFC-0002 is not yet implemented)
3. Verify coverage matrix returns correct counts for all 4 games

**Files**: `tests/mcp/mcp-012.test.ts`

### Step 7: Verify

1. `pnpm exec tsc --noEmit -p apps/mcp/tsconfig.json` — clean compile
2. `pnpm exec vitest --run` — all tests pass
3. Verify `REQUIRED_TOOLS` now includes 28 tools (24 existing + 4 new)

## Rollout

**Default behavior**: All 4 new tools are immediately available upon implementation. No feature flags, no gradual rollout.

**`compare_games` extension**: The `include_concepts` parameter defaults to `false`. Existing callers see no change in output. New callers opt in by setting `include_concepts: true`.

**Adoption path**: No migration needed — all tools are new read-only additions. Existing tests continue to pass unchanged.

**`concept-implementations.yaml` initial scope**: Start with 5 key design primitives (20 summaries). Expand incrementally. The tool gracefully handles missing entries (returns `null` summary).

## Acceptance criteria

- [ ] `compare_games` with `include_concepts: true` returns concept coverage per game
- [ ] `get_coverage_matrix` returns a game × concept_type count matrix
- [ ] `get_concept_coverage` returns detailed per-game coverage for a concept, including gaps
- [ ] `compare_concept_implementations` returns curated implementation summaries per game (code: tool reads YAML data file; content: human-authored summaries in `concept-implementations.yaml` — start with 5 primitives, expand incrementally)
- [ ] `find_concept_gaps` identifies concepts missing from specific games
- [ ] All 4 new tools are read-only and registered in `REQUIRED_TOOLS`
- [ ] All existing tests pass (no regressions)
- [ ] New tests cover all 4 tools
- [ ] Edge case: concepts with no `ancestry` and no `implementation_refs` return `member_count: 0` and appear in gaps (no error)

## Risks

- **Implementation notes curation**: `compare_concept_implementations` requires hand-written summaries for each game × concept pair. 15 primitives × 4 games = 60 summaries. Mitigation: start with 5 key primitives (20 summaries), expand incrementally.
- **Concept membership resolution**: `implementation_refs` may contain dangling refs (addressed in RFC-0002). Mitigation: handle missing refs gracefully, report `member_count: 0` instead of erroring.
- **Tool count growth**: Adding 4 tools brings the total to 28. This is still manageable but approaching the limit of what users can discover. Mitigation: consider tool categories or grouping in a future RFC.

## Alternatives considered

### A1: Single `concept_analysis` tool with mode parameter

Instead of 4 separate tools, one tool with a `mode` parameter (`coverage_matrix`, `concept_coverage`, `compare_implementations`, `find_gaps`).

**Rejected**: Each mode has a different input schema and output shape. A single tool with mode-dependent schemas is harder to discover and document than 4 focused tools. The MCP protocol benefits from clear, single-purpose tool descriptions.

### A2: Extend `get_concept_members` instead of creating `get_concept_coverage`

Add `include_gaps: true` and `include_observed_in: true` flags to the existing `get_concept_members` tool.

**Rejected**: `get_concept_members` returns paginated member records. `get_concept_coverage` returns a coverage summary with gaps and `observed_in_notes`. Mixing these output shapes in one tool would complicate the response schema and break existing callers who expect only member records.

### A3: Store `CONCEPT_IMPLEMENTATION_NOTES` as inline TypeScript constant

Keep the curated summaries as a TypeScript object in `derived.ts`.

**Rejected**: Curated content in TypeScript source is fragile and hard to maintain. A YAML data file separates content from code, allows non-developer edits, and simplifies incremental expansion. The tool reads the file at startup with minimal overhead.

## Implementation notes for agents

- **All 4 new tools are read-only**: Set `readOnly: true` in tool registration. The `assertNoWriteTools` function in `server.ts` must not flag any new tool names.
- **Register in `REQUIRED_TOOLS`**: Add all 4 new tool names to the `REQUIRED_TOOLS` array in `server.ts`. The conformance test checks that all required tools are registered.
- **No new dependencies**: The tools use existing `ProjectionStore` methods (`records`, `resolveRecordById`, `resolveRecordByKey`, `findSourceById`). No new imports needed beyond a YAML parser for `concept-implementations.yaml` (use `js-yaml` or read pre-parsed JSON).
- **`concept-implementations.yaml` is human-authored content**: An agent can create the file structure and write the tool code, but the summaries themselves require human knowledge of each game's implementation. Start with 5 primitives, mark missing entries explicitly.
- **Test file**: `tests/mcp/mcp-012.test.ts` should follow the pattern of existing MCP tests (e.g., `mcp-011.test.ts`). Use the test fixture projection store.
- **Edge cases are mandatory**: Every tool must handle concepts with no `ancestry`, no `implementation_refs`, and dangling refs gracefully. No tool may throw on missing data — return zeros and empty arrays.
