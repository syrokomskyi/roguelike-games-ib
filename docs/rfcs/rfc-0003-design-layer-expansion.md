---
id: RFC-0003
title: "Design layer expansion — mutation vectors, design knobs, counterplay patterns, and failure modes"
status: accepted
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
  - Does not add new concept_types — all proposed types already exist in concept.schema.yaml and design-space.yaml
  - Does not manually curate design layer content — all concepts are generated algorithmically and via LLM prompts from game records
  - Does not align per-primitive mutation_dimensions with the abstract cross-cutting dimensions in design-space.yaml — they serve different purposes (concrete per-primitive vs abstract cross-cutting)
  - Does not add new relation types where existing ones suffice — uses existing HAS_COUNTERPLAY instead of proposing COUNTERED_BY
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

The design layer gains four new concept types (mutation_vector, design_knob, counterplay_pattern, failure_mode) and three new relation types (HAS_MUTATION_VECTOR, IMPLEMENTED_AS, CAN_FAIL_AS), using the existing HAS_COUNTERPLAY relation for counterplay. The `scripts/run-stage-design.ts` script generates these concepts and relations automatically using an LLM + algorithm approach: structure is computed algorithmically from canonical state (game records, attributes, existing primitives/pressures), and textual content (definitions, inclusion/exclusion criteria) is generated via LLM API calls. MCP tools are extended to traverse the expanded graph.

## Architectural fit

- **RFC-0001** (extraction methodology) — this RFC operates in the concept/relation layer, which RFC-0001 explicitly separates from the extraction layer. No extraction changes are needed.
- **PLAN-003** (knowledge base enrichment) — this RFC directly extends the design layer introduced by PLAN-003 task C-2. The 15 design primitives and 31 design pressures created by `scripts/run-stage-design.ts` are the foundation for the expansion.
- **concept.schema.yaml** (`rgkb/concept@2`) — all four proposed concept_types (`mutation_vector`, `design_knob`, `counterplay_pattern`, `failure_mode`) already exist in the schema enum. No schema changes needed.
- **design-space.yaml** (`rgkb/design-space-ontology@2`) — all four concept types are already described with `governed_cross_game: true`. No ontology changes needed for concept types.
- **relation-types.yaml** — `HAS_COUNTERPLAY` already exists with domain/range including `concept → concept`, suitable for pressure → counterplay_pattern. Three new relation types are added: `HAS_MUTATION_VECTOR`, `IMPLEMENTED_AS`, `CAN_FAIL_AS`.
- **MCP tools** — `find_cross_game_concepts` already enumerates all new concept_types in its schema. `query_design_space` needs its `designRelationTypes` set extended. `get_design_tensions` needs extension to return counterplay patterns.
- **Obsidian builder** — `render-record.ts` already renders `concept_type` and associated fields. No builder changes needed for new concept types.
- **`cleanDesignData()` in `run-stage-design.ts`** — existing cleanup mechanism removes all records with `actor_id === "design-primitives"` before each run. New concepts and relations will use the same actor_id, ensuring idempotent regeneration.

## Design

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

**Relation**: `HAS_COUNTERPLAY` (pressure → counterplay_pattern) — existing relation type in `relation-types.yaml`, domain/range includes `concept → concept`.

**Example**:
```
pressure-information_asymmetry --HAS_COUNTERPLAY--> counterplay-information_asymmetry-identify_scroll
pressure-risk_aversion --HAS_COUNTERPLAY--> counterplay-risk_aversion-save_scumming (controversial)
pressure-time_pressure --HAS_COUNTERPLAY--> counterplay-time_pressure-food_management
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

Add three new relation types to `knowledge/ontology/relation-types.yaml`. The existing `HAS_COUNTERPLAY` relation type is reused for pressure → counterplay_pattern (domain/range already includes `concept → concept`):

| Relation type | Source → Target | Scope | Description |
|---|---|---|---|
| `HAS_MUTATION_VECTOR` | design_primitive → mutation_vector | cross_game | Primitive has this axis of variation |
| `IMPLEMENTED_AS` | mutation_vector → design_knob | cross_game | Mutation vector is concretely realized as this knob |
| `HAS_COUNTERPLAY` (existing) | design_pressure → counterplay_pattern | cross_game | Pressure can be mitigated by this pattern |
| `CAN_FAIL_AS` | design_primitive → failure_mode | cross_game | Primitive can degenerate into this failure mode |

### D6: Extend `scripts/run-stage-design.ts` with LLM-driven concept generators

Add four new generation sections to the design script using an LLM + algorithm approach:

1. **Mutation vector generation**: iterate over `DESIGN_PRIMITIVES`, for each `mutation_dimensions` entry, create a `mutation_vector` concept and `HAS_MUTATION_VECTOR` relation. Definitions generated via LLM prompt: "Given the design primitive '{title}' and dimension '{dimension}', generate a definition, inclusion_criteria, and exclusion_criteria for this mutation vector."
2. **Design knob generation**: for each mutation vector, algorithmically cluster game records by attribute values along the dimension axis to identify 2-4 knob values. LLM generates knob titles and definitions based on the clustered records. `implementation_refs` auto-computed from the clustered record IDs. `sourceGames` derived from record `source_identity`.
3. **Counterplay pattern generation**: for each pressure concept, algorithmically search game records for items/abilities/spells that mitigate the pressure (using attribute matching and relation traversal). LLM generates counterplay pattern titles and definitions based on the matched records. `implementation_refs` auto-computed.
4. **Failure mode generation**: for each design primitive, LLM generates 1-2 failure mode concepts with definitions, inclusion_criteria, and exclusion_criteria based on the primitive's description and known game mechanics.

The script uses `@ai-sdk/openai` (Vercel AI SDK) with `OPENAI_API_KEY` from `.env`. LLM calls are batched and cached to minimize API usage.

### D7: Extend MCP tools

- `query_design_space`: extend to filter by new relation types (`HAS_MUTATION_VECTOR`, `IMPLEMENTED_AS`, `HAS_COUNTERPLAY`, `CAN_FAIL_AS`)
- `find_cross_game_concepts`: already enumerates the new concept_types in its schema — no change needed
- `get_design_tensions`: extend to also return counterplay patterns for each tension's pressures by following `HAS_COUNTERPLAY` relations from each pressure

## Rollout

### Step 1: Add relation types to ontology

1. Add `HAS_MUTATION_VECTOR`, `IMPLEMENTED_AS`, `CAN_FAIL_AS` to `knowledge/ontology/relation-types.yaml` (`HAS_COUNTERPLAY` already exists)
2. Verify conformance tests still pass (new relation types should not break existing tests)

**Files**: `knowledge/ontology/relation-types.yaml`

### Step 2: Add LLM integration to design script

Add `@ai-sdk/openai` import and LLM helper functions to `scripts/run-stage-design.ts`:

1. `generateText(prompt: string): Promise<string>` — calls OpenAI API with `OPENAI_API_KEY` from environment
2. `generateConceptFields(prompt: string): Promise<{title, definition, inclusion_criteria, exclusion_criteria}>` — structured LLM call for concept fields
3. LLM response cache in `systems-cache/llm-design-cache.json` — keyed by prompt hash
4. Batch prompts: multiple concepts per LLM call to minimize API usage

**Completion criterion**: LLM helper functions exist and can generate structured concept fields from a prompt.

**Files**: `scripts/run-stage-design.ts`, `systems-cache/llm-design-cache.json`

### Step 3: Implement mutation vector generation

Add a mutation vector generation loop in `main()` after design primitive creation:

1. Iterate over `DESIGN_PRIMITIVES`, for each `mutation_dimensions` entry
2. Algorithmically create the mutation vector structure (key, concept_type, ancestry)
3. Call LLM to generate `title`, `definition`, `inclusion_criteria`, `exclusion_criteria` based on the primitive title and dimension name
4. Create `HAS_MUTATION_VECTOR` relation (primitive → mutation_vector)

**Completion criterion**: Script generates mutation_vector concepts for all 15 primitives with LLM-generated text fields.

**Files**: `scripts/run-stage-design.ts`

### Step 4: Implement design knob generation

Add a design knob generation loop after mutation vector creation:

1. For each mutation vector, algorithmically cluster game records from canonical state by attribute values along the dimension axis
2. Identify 2-4 distinct knob values from the clusters
3. Call LLM to generate knob `title` and `definition` based on the clustered records and their attributes
4. Auto-compute `implementation_refs` from clustered record IDs
5. Derive `sourceGames` from record `source_identity`
6. Create `IMPLEMENTED_AS` relation (mutation_vector → design_knob)

**Completion criterion**: Script generates design_knob concepts with auto-computed implementation_refs for all mutation vectors.

**Files**: `scripts/run-stage-design.ts`

### Step 5: Implement counterplay pattern generation

Add a counterplay pattern generation loop after design pressure creation:

1. For each pressure, algorithmically search game records for items/abilities/spells that mitigate the pressure (attribute matching, relation traversal)
2. If matches found, call LLM to generate counterplay pattern `title` and `definition` based on matched records
3. Auto-compute `implementation_refs` from matched record IDs
4. Create `HAS_COUNTERPLAY` relation (pressure → counterplay_pattern)
5. If no matches found, skip and log the pressure as having no counterplay

**Completion criterion**: Script generates counterplay_pattern concepts for ≥25 of 31 pressures. Pressures without counterplay are logged.

**Files**: `scripts/run-stage-design.ts`

### Step 6: Implement failure mode generation

Add a failure mode generation loop after design primitive creation:

1. For each primitive, call LLM to generate 1-2 failure mode concepts with `title`, `definition`, `inclusion_criteria`, `exclusion_criteria` based on the primitive description and game mechanics
2. Create `CAN_FAIL_AS` relation (primitive → failure_mode)

**Completion criterion**: Script generates failure_mode concepts for all 15 primitives.

**Files**: `scripts/run-stage-design.ts`

### Step 7: Extend MCP `query_design_space` tool

Update the `designRelationTypes` set in `apps/mcp/src/tools/design.ts` to include the new relation types:

```typescript
const designRelationTypes = new Set([
  "CREATES_PRESSURE", "tensions_with", "pressures", "synergizes_with",
  "HAS_MUTATION_VECTOR", "IMPLEMENTED_AS", "HAS_COUNTERPLAY", "CAN_FAIL_AS",
]);
```

**Files**: `apps/mcp/src/tools/design.ts`

### Step 8: Run and verify

1. Run `scripts/run-stage-design.ts` — verify new concepts and relations are created. The script's `cleanDesignData()` function removes all previous records with `actor_id === "design-primitives"` before regeneration, ensuring idempotent runs.
2. Run `scripts/run-materialize.ts` — verify materializer accepts new concept types and relation types
3. Run `scripts/run-build-obsidian.ts` — verify concept notes render for new concept_types (the builder already renders `concept_type` fields — `render-record.ts:58`)
4. Run `pnpm exec vitest --run` — all tests pass
5. Verify MCP `query_design_space` returns new relation types

## File system responsibilities

| Path | Role |
|---|---|
| `knowledge/ontology/relation-types.yaml` | Add 3 new relation types (HAS_MUTATION_VECTOR, IMPLEMENTED_AS, CAN_FAIL_AS) |
| `scripts/run-stage-design.ts` | LLM integration, mutation vector/knob/counterplay/failure mode generation loops in main() |
| `apps/mcp/src/tools/design.ts` | Extend designRelationTypes set in queryDesignSpace |
| `apps/mcp/src/tools/queries.ts` | Extend getDesignTensions to follow HAS_COUNTERPLAY relations |
| `systems-cache/llm-design-cache.json` | LLM response cache for idempotent re-runs |
| `knowledge/concept/cross-game/` | Output: new concept records (mutation_vector, design_knob, counterplay_pattern, failure_mode) |
| `knowledge/relation/cross-game/` | Output: new relation records (HAS_MUTATION_VECTOR, IMPLEMENTED_AS, HAS_COUNTERPLAY, CAN_FAIL_AS) |

## Acceptance criteria

- [ ] Each of 15 design primitives has ≥1 mutation vector concept with `HAS_MUTATION_VECTOR` relation
- [ ] Each mutation vector has ≥2 design knob concepts with `IMPLEMENTED_AS` relations
- [ ] ≥25 of 31 design pressures have ≥1 counterplay pattern concept with `HAS_COUNTERPLAY` relation (pressures without meaningful counterplay are documented)
- [ ] Each of 15 design primitives has ≥1 failure mode concept with `CAN_FAIL_AS` relation
- [ ] 3 new relation types registered in `relation-types.yaml` (HAS_MUTATION_VECTOR, IMPLEMENTED_AS, CAN_FAIL_AS — HAS_COUNTERPLAY already exists)
- [ ] `query_design_space` MCP tool returns new relation types
- [ ] `get_design_tensions` MCP tool returns counterplay patterns for each tension's pressures
- [ ] Obsidian vault renders new concept types — verify that `render-record.ts` produces notes with `concept_type`, `definition`, `inclusion_criteria`, and `exclusion_criteria` fields for at least one `mutation_vector` and one `failure_mode` concept
- [ ] All existing tests pass (no regressions)

**Note on code vs content**: criteria 1–4 are fully automated via LLM + algorithm generation. No manual curation is required. The acceptance criteria verify structural completeness (counts and relations). LLM-generated content quality should be reviewed post-generation but does not block acceptance.

## Alternatives considered

**A. Extend mutation_dimensions in-place without first-class concepts** — keep `mutation_dimensions` as strings on design primitives, add a separate query mechanism to interpret them. Rejected because strings cannot be queried, related, or traversed in the design-space graph. First-class concepts enable MCP `traverse_relations` and `query_design_space` to navigate the full graph.

**B. Use existing `VARIANT_OF` relation instead of new `IMPLEMENTED_AS`** — `VARIANT_OF` exists in the ontology with semantics "Source is a semantically recognized variant of target." Rejected because `IMPLEMENTED_AS` has different semantics: it connects an abstract axis (mutation_vector) to a concrete implementation choice (design_knob), not a variant relationship between two entities of the same type.

**C. Use existing `COUNTERS` relation instead of `HAS_COUNTERPLAY`** — `COUNTERS` exists with semantics "Source provides meaningful counterplay against target behavior/effect." Rejected in favor of `HAS_COUNTERPLAY` because `HAS_COUNTERPLAY` better expresses the directionality from pressure to counterplay (pressure HAS counterplay), while `COUNTERS` implies the counterplay is the source, which inverts the natural query direction.

**D. Purely manual curation without LLM** — define all mutation vectors, knobs, counterplay patterns, and failure modes as hand-written constants in the script. Rejected because it requires significant operator effort (~250 concepts) and is not scalable. The LLM + algorithm approach automates content generation while grounding it in actual game data.

**E. Start with all 15 primitives at once** — implement all mutation vectors, knobs, counterplay patterns, and failure modes in a single pass. Accepted: the LLM + algorithm approach makes full coverage feasible in one run. LLM responses are cached for idempotent re-runs.

## Risks

- **Curated data volume**: 15 primitives × ~4 dimensions × ~3 knobs = ~180 knob concepts, plus ~25-31 counterplay patterns and ~15-30 failure modes. All generated automatically via LLM + algorithm. Mitigation: LLM calls are batched and cached; script can be re-run idempotently.
- **LLM API cost**: generating ~250 concepts via OpenAI API incurs cost. Mitigation: use batched prompts (multiple concepts per call), cache responses in `systems-cache/llm-design-cache.json`, and use a cost-effective model (gpt-4o-mini).
- **LLM output quality**: LLM-generated definitions may be generic or inaccurate. Mitigation: include game record context in prompts; validate output against schema; manual review of a sample before full acceptance.
- **Implementation refs for knobs**: Knob `implementation_refs` are auto-computed by clustering game records by attribute values along the mutation vector axis. Mitigation: use `find_by_attribute` logic to find candidate records, cluster by attribute similarity.
- **Relation type proliferation**: Adding 3 new relation types increases ontology complexity. Mitigation: all 3 are within the `cross_game` scope and follow the existing pattern of typed directional relations. `HAS_COUNTERPLAY` is reused rather than creating a duplicate.
- **Agent misinterpretation**: agents may treat the LLM-generated content as authoritative. The content is auto-generated and may need refinement. Mitigation: implementation notes specify that content is LLM-generated and should be reviewed before final acceptance.
- **Performance**: the `run-stage-design.ts` script runs sequentially with LLM API calls. ~250 concepts × ~1s per LLM call = ~4 minutes. Acceptable for batch generation. LLM responses are cached for re-runs.
- **Edge cases**: a design primitive without `mutation_dimensions` would produce zero mutation vectors. All 15 current primitives have dimensions. A pressure without meaningful counterplay (e.g., `analysis_paralysis`) may have 0 counterplay patterns — documented as exception.

## Implementation notes for agents

- Agents MAY implement code changes ONLY when this RFC has status: `accepted` (or `implemented`).
- Agents MUST follow the existing patterns in `scripts/run-stage-design.ts` — use `makeConceptEnvelope()`, `makeRelationEnvelope()`, and `makeEvidenceEnvelope()` helpers for all new records.
- Agents MUST use the same `ACTOR_ID = "design-primitives"` for all new concepts and relations, ensuring `cleanDesignData()` removes them on re-runs.
- Agents MUST NOT create concept records outside `scripts/run-stage-design.ts` — all design-layer concepts are managed by this script.
- Agents MUST use `HAS_COUNTERPLAY` (existing) for pressure → counterplay_pattern relations, NOT a new `COUNTERED_BY` type.
- Agents MUST add new relation types to `relation-types.yaml` before using them in the script.
- Agents MUST use `@ai-sdk/openai` with `OPENAI_API_KEY` from environment for LLM calls. Cache responses in `systems-cache/llm-design-cache.json` for idempotent re-runs.
- Agents MUST include game record context in LLM prompts to ground generated content in actual game data.
- Agents MUST validate LLM output against `concept.schema.yaml` before writing to canonical state.
- Agents MUST run `pnpm exec forge rfc.validate --id RFC-0003 --json` after changes to verify no mechanical violations.
- Agents MUST NOT weaken or remove enforcement rules established by this RFC without a new RFC that supersedes it.
- Agents SHOULD review a sample of LLM-generated concepts for quality before full acceptance.
