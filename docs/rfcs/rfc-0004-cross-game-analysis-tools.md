---
id: RFC-0004
title: "Cross-game analysis tools — concept-aware comparison and coverage matrix"
status: draft
kind: architecture
scope: workspace
owners:
  - architecture
reviewers:
  - human:andrii-syrokomskyi
createdAt: 2026-08-23
updatedAt: 2026-08-23
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
packagesImpacted:
  - mcp
successSignals:
  - compare_games returns concept coverage per game (which primitives are present)
  - get_coverage_matrix returns a game × concept_type matrix
  - get_concept_coverage returns which games implement a specific concept and how
  - MCP tools enable meaningful cross-game design analysis queries
nonGoals:
  - Does not modify the search API or web app — those are covered in RFC-0005
  - Does not create new concept types — uses existing concept_type taxonomy
  - Does not compute semantic similarity between games — returns structural coverage only
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
      "matched_attributes": ["resistances", "conveys"]
    },
    "crawl": {
      "member_count": 0,
      "sample_records": [],
      "matched_attributes": []
    }
  },
  "gaps": ["crawl"]
}
```

**Logic**:
1. Find the concept by `record_id` or `key`
2. Resolve `implementation_refs` and `ancestry.derived_from` to records
3. Group by `source_id`
4. For each game, list member records and matched attributes (from `ancestry.observed_in`)
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

**Logic**: This is a curated comparison, not auto-generated. The tool reads a `CONCEPT_IMPLEMENTATION_NOTES` mapping (similar to `SEMANTIC_EQUIVALENCES` in the concepts script) that provides human-written implementation summaries per game per concept.

**Input**: `{ concept_key: string; source_ids?: string[] }` (defaults to all 4 games)

**Files**: `apps/mcp/src/tools/derived.ts` — new `compareConceptImplementations()` function. Register in `server.ts`.

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

1. Define `CONCEPT_IMPLEMENTATION_NOTES` mapping in `apps/mcp/src/tools/derived.ts` — a curated map of `{ conceptKey: { sourceId: { summary, distinguishingAttributes } } }`
2. Start with the 15 design primitives — for each, write 1-2 sentences per game describing how that game implements the primitive
3. Add `compareConceptImplementations()` function
4. Register in `server.ts`

**Files**: `apps/mcp/src/tools/derived.ts`, `apps/mcp/src/server.ts`

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

## Acceptance criteria

- [ ] `compare_games` with `include_concepts: true` returns concept coverage per game
- [ ] `get_coverage_matrix` returns a game × concept_type count matrix
- [ ] `get_concept_coverage` returns detailed per-game coverage for a concept, including gaps
- [ ] `compare_concept_implementations` returns curated implementation summaries per game
- [ ] `find_concept_gaps` identifies concepts missing from specific games
- [ ] All 4 new tools are read-only and registered in `REQUIRED_TOOLS`
- [ ] All existing tests pass (no regressions)
- [ ] New tests cover all 4 tools

## Risks

- **Implementation notes curation**: `compare_concept_implementations` requires hand-written summaries for each game × concept pair. 15 primitives × 4 games = 60 summaries. Mitigation: start with 5 key primitives (20 summaries), expand incrementally.
- **Concept membership resolution**: `implementation_refs` may contain dangling refs (addressed in RFC-0002). Mitigation: handle missing refs gracefully, report `member_count: 0` instead of erroring.
- **Tool count growth**: Adding 4 tools brings the total to 28. This is still manageable but approaching the limit of what users can discover. Mitigation: consider tool categories or grouping in a future RFC.
