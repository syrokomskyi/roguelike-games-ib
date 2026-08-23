---
id: RFC-0003
title: "Design layer expansion — mutation vectors, design knobs, counterplay patterns, and failure modes"
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
  - PLAN-003
satisfies: []
versionBump: minor
commands:
  proposed: []
  added: []
  changed: []
  removed: []
appsImpacted: []
packagesImpacted:
  - knowledge-core
  - builders/obsidian-builder
  - mcp
successSignals:
  - Each design primitive has ≥1 mutation vector and ≥1 design knob concept
  - Each design primitive has ≥1 counterplay pattern
  - Each design primitive has ≥1 failure mode
  - Design-space graph connects primitives → pressures → tensions → counterplay → failure modes
  - MCP tools can traverse the full design-space graph
nonGoals:
  - Does not redefine the concept record schema — uses existing rgkb/concept@2
  - Does not add new relation types beyond those defined in relation-types.yaml
  - Does not automate design layer generation — this is a curated analytical layer
---

# RFC-0003: Design layer expansion — mutation vectors, design knobs, counterplay patterns, and failure modes

## Context

PLAN-003 introduced 15 design primitives and 31 design pressure concepts in `scripts/run-stage-design.ts`. Each primitive has `mutation_dimensions` in its ancestry (e.g., `["detection_range", "alertness_persistence", "stealth_methods", "lighting_impact"]` for stealth), but these dimensions are stored as plain strings — they are not first-class concepts and cannot be queried, related, or traversed.

The current design-space graph is:

```
design_primitive --CREATES_PRESSURE--> design_pressure
design_pressure --tensions_with--> design_pressure
```

This is a two-level graph (primitives → pressures → tensions). It captures **what** each primitive does (creates pressures) and **how** pressures conflict (tensions), but it does not capture:

1. **How** a primitive can be varied (mutation vectors / design knobs)
2. **What counters** a primitive (counterplay patterns)
3. **What goes wrong** when a primitive is misbalanced (failure modes)

### Current state

| Component | Count | concept_type |
|---|---|---|
| Design primitives | 15 | `design_primitive` |
| Design pressures | 31 | `design_pressure` |
| CREATES_PRESSURE relations | 15 × ~3 = ~45 | — |
| tensions_with relations | 14 | — |
| Mutation vectors | 0 (stored as strings) | — |
| Design knobs | 0 | — |
| Counterplay patterns | 0 | — |
| Failure modes | 0 | — |

### Existing concept_type values

The concept schema (`rgkb/concept@2`) supports any `concept_type` string. The MCP `find_cross_game_concepts` tool already enumerates: `cross_game_mechanic`, `design_primitive`, `design_pressure`, `design_tension`, `design_knob`, `mutation_vector`, `counterplay_pattern`, `failure_mode`, `negative_space`, `emergent_pattern`, `synergy_pattern`.

These types were anticipated in the MCP tool schema but have no data behind them.

## Problem

The design layer is currently a static taxonomy — it names primitives and pressures but does not model the full design space. Without mutation vectors, design knobs, counterplay patterns, and failure modes:

1. **No variation analysis**: `mutation_dimensions` are opaque strings. A user or agent cannot query "what are the knobs for permadeath?" or "how does stealth vary across games?"

2. **No balance analysis**: Without failure modes, there is no way to reason about what happens when a primitive is misbalanced (e.g., hunger clock too fast → game becomes a speedrun, not a tactical experience).

3. **No counterplay analysis**: Without counterplay patterns, there is no way to reason about how players mitigate design pressures (e.g., identification system pressure is countered by scroll of identify).

4. **No graph traversal**: The design-space graph is flat (2 levels). A richer graph (primitive → pressure → tension → counterplay → failure mode) would enable meaningful design-space exploration via MCP `traverse_relations` and `query_design_space`.

## Decision

### D1: Promote mutation_dimensions to first-class `mutation_vector` concepts

For each design primitive, create one `mutation_vector` concept per dimension listed in `mutation_dimensions`. Each mutation vector concept:

- **Key**: `cross-game/concept/mutation-{primitive_slug}-{dimension_slug}`
- **concept_type**: `mutation_vector`
- **title**: Human-readable dimension name (e.g., "Detection Range" for `detection_range`)
- **definition**: What this dimension controls and how it varies across games
- **inclusion_criteria**: How to identify this dimension in a game's implementation
- **exclusion_criteria**: What is NOT this dimension
- **ancestry.derived_from**: `[primitive_concept_id]`
- **implementation_refs**: `[]` (no direct game records — this is an analytical abstraction)

**Relation**: `HAS_MUTATION_VECTOR` (primitive → mutation_vector)

**Example**:
```
design-permadeath --HAS_MUTATION_VECTOR--> mutation-permadeath-permanence_degree
design-permadeath --HAS_MUTATION_VECTOR--> mutation-permadeath-recovery_mechanism
design-permadeath --HAS_MUTATION_VECTOR--> mutation-permadeath-death_cause_scope
```

### D2: Create `design_knob` concepts for each mutation vector

A design knob is a concrete implementation choice along a mutation vector's axis. While mutation vectors describe **what** can vary, design knobs describe **how** specific games implement that variation.

For each mutation vector, create 2-4 design knob concepts representing the spectrum of implementations observed across the 4 games:

- **Key**: `cross-game/concept/knob-{mutation_vector_slug}-{value_slug}`
- **concept_type**: `design_knob`
- **title**: Implementation choice name (e.g., "Hard Permadeath" vs "Soft Permadeath")
- **definition**: How this implementation choice works
- **implementation_refs**: Game records that exemplify this knob (from the 4 games)
- **ancestry.derived_from**: `[mutation_vector_concept_id]`
- **ancestry.source_games**: Games where this knob is observed

**Relation**: `IMPLEMENTED_AS` (mutation_vector → design_knob)

**Example for permadeath permanence_degree**:
```
mutation-permadeath-permanence_degree --IMPLEMENTED_AS--> knob-permadeath-permanence_hard (NetHack, BrogueCE)
mutation-permadeath-permanence_degree --IMPLEMENTED_AS--> knob-permadeath-permanence_soft (Cataclysm-BN has respawn)
```

### D3: Create `counterplay_pattern` concepts

For each design pressure, create 1-3 counterplay patterns — strategies or mechanics that mitigate the pressure:

- **Key**: `cross-game/concept/counterplay-{pressure_slug}-{strategy_slug}`
- **concept_type**: `counterplay_pattern`
- **title**: Strategy name (e.g., "Scroll of Identify" for information_asymmetry pressure)
- **definition**: How this counterplay works and what pressure it mitigates
- **implementation_refs**: Game records that provide this counterplay (e.g., the scroll of identify item record)
- **ancestry.derived_from**: `[pressure_concept_id]`

**Relation**: `COUNTERED_BY` (pressure → counterplay_pattern)

**Example**:
```
pressure-information_asymmetry --COUNTERED_BY--> counterplay-information_asymmetry-identify_scroll
pressure-risk_aversion --COUNTERED_BY--> counterplay-risk_aversion-save_scumming (controversial)
pressure-time_pressure --COUNTERED_BY--> counterplay-time_pressure-food_management
```

### D4: Create `failure_mode` concepts

For each design primitive, create 1-2 failure mode concepts — what happens when the primitive is misbalanced:

- **Key**: `cross-game/concept/failure-{primitive_slug}-{mode_slug}`
- **concept_type**: `failure_mode`
- **title**: Failure mode name (e.g., "Grind Spiral" for level progression)
- **definition**: What goes wrong, why, and how to detect it
- **inclusion_criteria**: Symptoms that indicate this failure mode
- **exclusion_criteria**: What is NOT this failure mode
- **ancestry.derived_from**: `[primitive_concept_id]`

**Relation**: `CAN_FAIL_AS` (primitive → failure_mode)

**Example**:
```
design-level_progression --CAN_FAIL_AS--> failure-level_progression-grind_spiral
design-hunger_clock --CAN_FAIL_AS--> failure-hunger_clock-clock_dominance
design-procedural_generation --CAN_FAIL_AS--> failure-procedural_generation-unfair_generation
```

### D5: Add new relation types to ontology

Add the following relation types to `knowledge/ontology/relation-types.yaml`:

| Relation type | Source → Target | Scope | Description |
|---|---|---|---|
| `HAS_MUTATION_VECTOR` | design_primitive → mutation_vector | cross_game | Primitive has this axis of variation |
| `IMPLEMENTED_AS` | mutation_vector → design_knob | cross_game | Mutation vector is concretely realized as this knob |
| `COUNTERED_BY` | design_pressure → counterplay_pattern | cross_game | Pressure can be mitigated by this pattern |
| `CAN_FAIL_AS` | design_primitive → failure_mode | cross_game | Primitive can degenerate into this failure mode |

### D6: Extend `scripts/run-stage-design.ts` with new concept generators

Add four new sections to the design script:

1. **Mutation vector generation**: iterate over `DESIGN_PRIMITIVES`, for each `mutation_dimensions` entry, create a `mutation_vector` concept and `HAS_MUTATION_VECTOR` relation.
2. **Design knob generation**: for each mutation vector, define 2-4 knob values with game-specific `implementation_refs`. This is a curated list, not auto-generated.
3. **Counterplay pattern generation**: for each pressure concept, define 1-3 counterplay patterns with `COUNTERED_BY` relations. Curated.
4. **Failure mode generation**: for each design primitive, define 1-2 failure modes with `CAN_FAIL_AS` relations. Curated.

### D7: Extend MCP tools

- `query_design_space`: extend to filter by new relation types (`HAS_MUTATION_VECTOR`, `IMPLEMENTED_AS`, `COUNTERED_BY`, `CAN_FAIL_AS`)
- `find_cross_game_concepts`: already enumerates the new concept_types in its schema — no change needed
- `get_design_tensions`: extend to also return counterplay patterns for each tension's pressures

## Implementation plan

### Step 1: Add relation types to ontology

1. Add `HAS_MUTATION_VECTOR`, `IMPLEMENTED_AS`, `COUNTERED_BY`, `CAN_FAIL_AS` to `knowledge/ontology/relation-types.yaml`
2. Verify conformance tests still pass (new relation types should not break existing tests)

**Files**: `knowledge/ontology/relation-types.yaml`

### Step 2: Define mutation vector data

For each of the 15 design primitives, expand `mutation_dimensions` from plain strings to structured objects with titles, definitions, and 2-4 knob values:

```typescript
const MUTATION_VECTORS: {
  primitiveSlug: string;
  dimensions: {
    slug: string;
    title: string;
    definition: string;
    knobs: {
      slug: string;
      title: string;
      definition: string;
      sourceGames: string[];
      implementationRefs?: string[];  // record IDs from canonical state
    }[];
  }[];
}[] = [
  {
    primitiveSlug: "permadeath",
    dimensions: [
      {
        slug: "permanence_degree",
        title: "Permanence Degree",
        definition: "How irreversible death is — from fully permanent to recoverable.",
        knobs: [
          { slug: "hard", title: "Hard Permadeath", definition: "Death is fully irreversible. Character and all progress are lost.", sourceGames: ["nethack", "broguece"] },
          { slug: "soft", title: "Soft Permadeath", definition: "Death is permanent but some progress carries over (e.g., world state, unlocks).", sourceGames: ["cataclysm-bn"] },
        ],
      },
      // ... more dimensions
    ],
  },
  // ... more primitives
];
```

**Files**: `scripts/run-stage-design.ts` — new `MUTATION_VECTORS` constant.

### Step 3: Define counterplay pattern data

For each design pressure, define 1-3 counterplay patterns:

```typescript
const COUNTERPLAY_PATTERNS: {
  pressureSlug: string;
  patterns: {
    slug: string;
    title: string;
    definition: string;
    sourceGames: string[];
  }[];
}[] = [
  {
    pressureSlug: "information_asymmetry",
    patterns: [
      { slug: "identify_scroll", title: "Identification Items", definition: "Consumable items that reveal unknown item properties.", sourceGames: ["nethack", "crawl"] },
      { slug: "trial_and_error", title: "Safe Trial", definition: "Testing unknown items in low-risk situations to learn their effects.", sourceGames: ["broguece", "nethack"] },
    ],
  },
  // ... more pressures
];
```

**Files**: `scripts/run-stage-design.ts` — new `COUNTERPLAY_PATTERNS` constant.

### Step 4: Define failure mode data

For each design primitive, define 1-2 failure modes:

```typescript
const FAILURE_MODES: {
  primitiveSlug: string;
  modes: {
    slug: string;
    title: string;
    definition: string;
    inclusionCriteria: string[];
    exclusionCriteria: string[];
  }[];
}[] = [
  {
    primitiveSlug: "hunger_clock",
    modes: [
      {
        slug: "clock_dominance",
        title: "Clock Dominance",
        definition: "Hunger clock is too aggressive, forcing players to prioritize food acquisition over all other gameplay. The game becomes a food-management simulator rather than a dungeon exploration experience.",
        inclusionCriteria: ["Players report feeling rushed constantly", "Food consumption dominates strategic decisions", "Exploration is penalized more than rewarded"],
        exclusionCriteria: ["Normal time pressure that encourages forward momentum"],
      },
    ],
  },
  // ... more primitives
];
```

**Files**: `scripts/run-stage-design.ts` — new `FAILURE_MODES` constant.

### Step 5: Implement generation logic

Add four generation loops in `main()`:

1. After creating design primitives → generate mutation vectors + `HAS_MUTATION_VECTOR` relations
2. After creating mutation vectors → generate design knobs + `IMPLEMENTED_AS` relations
3. After creating design pressures → generate counterplay patterns + `COUNTERED_BY` relations
4. After creating design primitives → generate failure modes + `CAN_FAIL_AS` relations

**Files**: `scripts/run-stage-design.ts` — `main()` function.

### Step 6: Extend MCP `query_design_space` tool

Update the `designRelationTypes` set in `apps/mcp/src/tools/design.ts` to include the new relation types:

```typescript
const designRelationTypes = new Set([
  "CREATES_PRESSURE", "tensions_with", "pressures", "synergizes_with",
  "HAS_MUTATION_VECTOR", "IMPLEMENTED_AS", "COUNTERED_BY", "CAN_FAIL_AS",
]);
```

**Files**: `apps/mcp/src/tools/design.ts`

### Step 7: Run and verify

1. Run `scripts/run-stage-design.ts` — verify new concepts and relations are created
2. Run `scripts/run-materialize.ts` — verify materializer accepts new concept types and relation types
3. Run `scripts/run-build-obsidian.ts` — verify concept notes render for new concept_types
4. Run `pnpm exec vitest --run` — all tests pass
5. Verify MCP `query_design_space` returns new relation types

## Acceptance criteria

- [ ] Each of 15 design primitives has ≥1 mutation vector concept with `HAS_MUTATION_VECTOR` relation
- [ ] Each mutation vector has ≥2 design knob concepts with `IMPLEMENTED_AS` relations
- [ ] Each of 31 design pressures has ≥1 counterplay pattern concept with `COUNTERED_BY` relation
- [ ] Each of 15 design primitives has ≥1 failure mode concept with `CAN_FAIL_AS` relation
- [ ] 4 new relation types registered in `relation-types.yaml`
- [ ] `query_design_space` MCP tool returns new relation types
- [ ] Obsidian vault renders new concept types with appropriate sections
- [ ] All existing tests pass (no regressions)

## Risks

- **Curated data volume**: 15 primitives × ~4 dimensions × ~3 knobs = ~180 knob concepts, plus ~31 counterplay patterns and ~15-30 failure modes. This is a significant amount of hand-curated data. Mitigation: start with 5 most important primitives and expand incrementally.
- **Implementation refs for knobs**: Knob concepts need `implementation_refs` pointing to actual game records. This requires knowing which records exemplify each knob. Mitigation: use `find_by_attribute` MCP tool to find candidate records, then curate manually.
- **Relation type proliferation**: Adding 4 new relation types increases ontology complexity. Mitigation: all 4 are within the `cross_game` scope and follow the existing pattern of typed directional relations.
