---
id: PLAN-RFC-0003
title: "Design layer expansion — mutation vectors, design knobs, counterplay patterns, and failure modes"
status: accepted
scope: project-wide
decider: architecture
reviewers:
  - human:andrii-syrokomskyi
related:
  - RFC-0003
  - PLAN-003
created: 2026-08-23
accepted: 2026-08-23
implementedAt:
closedAt: null
---

# PLAN-RFC-0003: Design layer expansion — mutation vectors, design knobs, counterplay patterns, and failure modes

## Context

RFC-0003 (accepted) expands the design layer from a 2-level graph (primitives → pressures → tensions) to a 5-level graph (primitives → mutation vectors → design knobs, pressures → counterplay patterns, primitives → failure modes). The expansion adds 4 new concept types (already in schema) and 3 new relation types (HAS_MUTATION_VECTOR, IMPLEMENTED_AS, CAN_FAIL_AS), reusing the existing HAS_COUNTERPLAY relation. All concept content is generated automatically via LLM (OpenAI API) + algorithmic clustering from canonical state — no manual curation.

## Objectives

1. Add 3 new relation types to the ontology
2. Add LLM integration (OpenAI via @ai-sdk/openai) to `scripts/run-stage-design.ts`
3. Implement mutation vector, design knob, counterplay pattern, and failure mode generation
4. Extend MCP `query_design_space` and `get_design_tensions` tools
5. Run the design script and verify output
6. Run materializer and Obsidian builder to verify downstream compatibility
7. All tests pass

## Steps

### Step 1: Add relation types to ontology

Add `HAS_MUTATION_VECTOR`, `IMPLEMENTED_AS`, `CAN_FAIL_AS` to `knowledge/ontology/relation-types.yaml`.

Each must have:
- `direction: directed`
- `evidence_required: true`
- `domain: [concept]`
- `range: [concept]`

**Completion criterion**: `relation-types.yaml` contains all 3 new types with `concept` in domain and range. Conformance test c11 passes.

**Files**: `knowledge/ontology/relation-types.yaml`

### Step 2: Add LLM integration to design script

Add `@ai-sdk/openai` import and LLM helper functions to `scripts/run-stage-design.ts`:

1. `generateConceptFields(prompt: string): Promise<{title, definition, inclusion_criteria, exclusion_criteria}>` — structured LLM call using `generateObject` from `ai` SDK with Zod schema
2. LLM response cache in `systems-cache/llm-design-cache.json` — keyed by prompt hash, enables idempotent re-runs without API calls
3. Batch prompts: multiple concepts per LLM call where possible
4. Read `OPENAI_API_KEY` from `process.env`

Use `gpt-4o-mini` model for cost efficiency.

**Completion criterion**: LLM helper functions exist and can generate structured concept fields from a prompt. Cache file is created on first run.

**Files**: `scripts/run-stage-design.ts`, `systems-cache/llm-design-cache.json`

### Step 3: Implement mutation vector generation

Add a mutation vector generation loop in `main()` after design primitive creation:

1. Iterate over `DESIGN_PRIMITIVES`, for each `mutation_dimensions` entry
2. Algorithmically create the mutation vector structure (key, concept_type, ancestry)
3. Call LLM to generate `title`, `definition`, `inclusion_criteria`, `exclusion_criteria` based on the primitive title and dimension name
4. Create `HAS_MUTATION_VECTOR` relation (primitive → mutation_vector) using `makeRelationEnvelope()`

**Completion criterion**: Script generates mutation_vector concepts for all 15 primitives with LLM-generated text fields. ~60 mutation_vector concepts created.

**Files**: `scripts/run-stage-design.ts`

### Step 4: Implement design knob generation

Add a design knob generation loop after mutation vector creation:

1. For each mutation vector, algorithmically cluster game records from canonical state by attribute values along the dimension axis
2. Identify 2-4 distinct knob values from the clusters
3. Call LLM to generate knob `title` and `definition` based on the clustered records and their attributes
4. Auto-compute `implementation_refs` from clustered record IDs
5. Derive `sourceGames` from record `source_identity`
6. Create `IMPLEMENTED_AS` relation (mutation_vector → design_knob)

**Completion criterion**: Script generates design_knob concepts with auto-computed implementation_refs for all mutation vectors. ~120-180 design_knob concepts created.

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

**Completion criterion**: Script generates failure_mode concepts for all 15 primitives. ~15-30 failure_mode concepts created.

**Files**: `scripts/run-stage-design.ts`

### Step 7: Extend MCP query_design_space tool

Update the `designRelationTypes` set in `apps/mcp/src/tools/design.ts` to include `HAS_MUTATION_VECTOR`, `IMPLEMENTED_AS`, `HAS_COUNTERPLAY`, `CAN_FAIL_AS`.

**Completion criterion**: `queryDesignSpace` returns relations of the new types when filtered.

**Files**: `apps/mcp/src/tools/design.ts`

### Step 8: Extend MCP get_design_tensions tool

Update `getDesignTensions` in `apps/mcp/src/tools/queries.ts` to also return counterplay patterns for each tension's pressures. For each pressure in a tension pair, follow `HAS_COUNTERPLAY` relations and include the counterplay pattern data in the response.

**Completion criterion**: `getDesignTensions` response includes a `counterplay` array for each tension entry, listing counterplay patterns for both source and target pressures.

**Files**: `apps/mcp/src/tools/queries.ts`

### Step 9: Run design script and verify output

Run `npx tsx scripts/run-stage-design.ts`. Verify:
- New concept files created in `knowledge/concept/cross-game/`
- New relation files created in `knowledge/relation/cross-game/`
- Counts: ~60 mutation_vectors, ~120-180 design_knobs, ~25-31 counterplay_patterns, ~15-30 failure_modes
- All relations have `evidence_refs` populated
- LLM cache file created in `systems-cache/llm-design-cache.json`

**Completion criterion**: Script exits with status 0. New concept and relation files exist in canonical knowledge.

### Step 10: Run materializer and verify

Run `npx tsx scripts/run-materialize.ts`. Verify the materializer accepts all new concept types and relation types without errors.

**Completion criterion**: Materializer completes with status 0. `dist/records.jsonl` includes new concepts and relations.

### Step 11: Run Obsidian builder and verify

Run `npx tsx scripts/run-build-obsidian.ts`. Verify concept notes are generated for new concept types with `concept_type`, `definition`, `inclusion_criteria`, and `exclusion_criteria` fields.

**Completion criterion**: Obsidian vault contains notes for at least one `mutation_vector` and one `failure_mode` concept with correct fields rendered.

### Step 12: Run tests

Run `pnpm exec vitest --run`. All tests must pass, including:
- Conformance test c11 (ontology freeze — new relation types registered, domain/range satisfied)
- MCP tests (design tools still work)
- Graph tests (relation validation passes)

**Completion criterion**: All tests pass. Zero failures.

### Step 13: Review and fix

Run `fo-review` on all code changes made in this session. If review has findings, run `fo-fix` to address them.

**Completion criterion**: Review report exists. All findings addressed or explicitly accepted.

### Step 14: Stamp implemented

Run `pnpm exec forge rfc.implement.stamp --id RFC-0003 --implementation-commit <sha>` to transition RFC-0003 from `accepted` to `implemented`.

**Completion criterion**: RFC-0003 frontmatter shows `status: implemented` and `implementedAt: 2026-08-23`.

## Validation suite

| Check | Command | When |
|---|---|---|
| RFC validation | `pnpm exec forge rfc.validate --id RFC-0003 --json` | After step 1 |
| Typecheck | `pnpm exec tsc --noEmit` | After step 8 |
| Design script | `npx tsx scripts/run-stage-design.ts` | Step 9 |
| Materializer | `npx tsx scripts/run-materialize.ts` | Step 10 |
| Obsidian builder | `npx tsx scripts/run-build-obsidian.ts` | Step 11 |
| Test suite | `pnpm exec vitest --run` | Step 12 |

## Acceptance criteria mapping

| RFC criterion | Plan step |
|---|---|
| Each of 15 design primitives has ≥1 mutation vector with HAS_MUTATION_VECTOR | Steps 3, 9 |
| Each mutation vector has ≥2 design knobs with IMPLEMENTED_AS | Steps 4, 9 |
| ≥25 of 31 design pressures have ≥1 counterplay pattern with HAS_COUNTERPLAY | Steps 5, 9 |
| Each of 15 design primitives has ≥1 failure mode with CAN_FAIL_AS | Steps 6, 9 |
| 3 new relation types registered in relation-types.yaml | Step 1 |
| query_design_space returns new relation types | Steps 7, 12 |
| get_design_tensions returns counterplay patterns | Steps 8, 12 |
| Obsidian vault renders new concept types | Step 11 |
| All existing tests pass | Step 12 |

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| LLM API cost (~250 concepts) | Use gpt-4o-mini, batch prompts, cache responses in systems-cache/ |
| LLM output quality | Include game record context in prompts; validate against schema |
| Conformance test c11 domain/range violations | New relation types have `concept` in both domain and range |
| Pressures without counterplay | Allow 0 patterns for ~6 pressures, log as exceptions |
| Knob clustering produces too few/many clusters | Fall back to LLM-generated knob values if clustering finds <2 or >6 clusters |
| LLM API rate limits | Batch prompts, add retry with exponential backoff |
