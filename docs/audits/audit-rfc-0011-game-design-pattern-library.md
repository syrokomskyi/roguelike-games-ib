---
rfcId: RFC-0011
auditId: AUDIT-RFC-0011-01
date: 2026-08-23
auditor:
  skill: fo-idea-audit
  model: claude-sonnet-4-20250514
verdict: needs-revision
---

# Audit: RFC-0011

## Verdict: Needs revision

The RFC has a direct contradiction between `nonGoals` ("Does not create new concept types") and D2 (creates `design_pattern` as a new concept type). It also has a V-24 error (architecture RFC without DNA invariant), 5 missing required sections, and several pragmatic gaps. The core idea is valuable but the RFC needs structural and semantic fixes before implementation.

## Mechanical validation (rfc.validate)

**Fail** — 1 error, 5 warnings:

- **V-24 (error)**: Architecture RFC created 2026-08-23 (>= 2026-07-07) must declare at least one DNA invariant in `satisfies`. The project has `invariantsFile: null` in `forge.yaml`, but V-24 still requires at least one entry. Prior RFCs in this project (RFC-0003, RFC-0004, RFC-0009) resolved this by using `kind: policy` instead of `kind: architecture`. Consider changing `kind` to `policy` or adding a DNA invariant.
- **V-13 (warning)**: Missing required sections: "Architectural fit", "Design", "Rollout", "Alternatives considered", "Implementation notes for agents".

## Axis A — Structural completeness

1. **Missing required sections**: "Architectural fit", "Design", "Rollout", "Alternatives considered", "Implementation notes for agents" are all absent. See V-13 warnings above.

2. **Decision format**: D1–D5 are individual decisions, which is acceptable. But they lack a "Design" wrapper providing TypeScript contracts, edge cases, and data shapes. The JSON examples in D1 and D2 are illustrative but not formal contracts.

3. **No Rollout section**: The RFC doesn't describe default behavior, adoption path for existing data, or migration window. The implementation plan has steps but no rollout narrative.

4. **No Alternatives considered**: The RFC doesn't explore alternatives. Key questions: Could `emergent_pattern` or `synergy_pattern` (existing concept_types enumerated in RFC-0003) be reused instead of creating `design_pattern`? Could the existing `SYNERGIZES_WITH` relation replace `TRIGGERED_BY_COMBINATION`?

5. **No Implementation notes for agents**: Missing behavioral rules for agents — which patterns to follow from prior RFCs, how to use `makeConceptEnvelope()`, which `ACTOR_ID` to use, whether `cleanDesignData()` should be extended.

6. **Acceptance criteria** are checkable but don't distinguish between code changes an agent can make and content that requires human authoring (D1 examples are "LLM-assisted" with "human review before committing").

## Axis B — DNA alignment

1. **`satisfies: []` with `kind: architecture`**: V-24 requires at least one DNA invariant. The project has `invariantsFile: null` — no invariants file exists. Prior RFCs used `kind: policy` to avoid this. Either change `kind` to `policy` or add a DNA invariant.

2. **`related: [RFC-0003, RFC-0004, RFC-0009]`**: All three are implemented and directly relevant. RFC-0003 created the design layer concepts this RFC builds on. RFC-0004 created the cross-game analysis tools this RFC extends. RFC-0009 added quality scoring that would need to account for new pattern records. Good.

## Axis C — Ecosystem fit

1. **Contradiction: new concept type vs nonGoals**: `nonGoals` states "Does not create new concept types — uses existing design_knob, failure_mode". But D2 explicitly creates `design_pattern` as a new `concept_type`. This is a direct contradiction. Either remove the nonGoal or change D2 to use an existing type.

2. **Existing concept types not checked**: RFC-0003 (line 82) lists existing concept_types in the MCP tool schema: `emergent_pattern`, `synergy_pattern`. The RFC doesn't explain why `design_pattern` is needed instead of reusing `emergent_pattern` or `synergy_pattern`.

3. **`TRIGGERED_BY_COMBINATION` relation type**: The RFC proposes this new relation type. The existing `COUNTERS` relation ("Source provides meaningful counterplay against target behavior/effect") has similar semantics. The RFC should explain why a new type is needed vs extending `COUNTERS` or using `CAN_FAIL_AS` (which already connects primitives to failure modes).

4. **Package boundaries**: `appsImpacted: [mcp, web]` — correct, both are touched. `packagesImpacted: []` — but the RFC touches `knowledge/ontology/relation-types.yaml` which is part of the knowledge core. Should `knowledge-core` or the ontology package be listed?

5. **AGENTS.md updates**: The RFC doesn't identify which `AGENTS.md` files need updates. If new concept types or relation types are added, the root `AGENTS.md` or `apps/mcp/AGENTS.md` may need rules.

6. **Compass sync**: The RFC doesn't mention whether `docs/*.xml` files need synchronization for new concept types or relation types.

## Axis D — Forward-only compliance

1. **No compatibility shims**: The RFC proposes new records and tools without legacy support paths. Good.

2. **No backward compatibility layers**: No dual-path or flag-gated behavior. Good.

3. **`concrete_examples` field**: D1 proposes adding a `concrete_examples` field to design knobs/primitives. This is a new field on existing concept records. The RFC should clarify whether this is a canonical field (written to `knowledge/concept/`) or a projection (added during materialization). If canonical, it changes the concept record schema.

## Axis E — Agent-facing policy

1. **No Implementation notes for agents**: Missing entirely. Agents need to know: which `ACTOR_ID` to use for pattern records, whether `cleanDesignData()` in `run-stage-design.ts` should remove pattern records on re-runs, whether to use `makeConceptEnvelope()` and `makeRelationEnvelope()` helpers.

2. **Anti-fabrication**: D1 says "LLM-assisted curation" with "human review before committing". The acceptance criteria says "15 design primitives have concrete examples (≥1 per game where present)". The RFC must distinguish between code an agent can write (scripts, tools, pages) and content that requires human curation (the examples themselves). An agent cannot generate accurate game-specific examples without human verification.

3. **No self-authorizing language**: Good — the RFC doesn't grant implementation permission while in draft.

4. **No NEEDS CLARIFICATION markers**: None found.

## Axis F — Pragmatism

1. **Two new scripts**: `scripts/run-stage-examples.ts` and `scripts/run-stage-patterns.ts`. Could these be combined into a single script? The existing `scripts/run-stage-design.ts` already manages design-layer concepts. Extending it would follow the established pattern.

2. **`concrete_examples` storage location**: D1 says examples go in `knowledge/concept/cross-game/examples/` — a new directory. But existing concepts are stored as `.jsonl` files in `knowledge/concept/cross-game/concept/`. Why a separate directory? This breaks the established pattern.

3. **Two new MCP tools**: `find_design_patterns` and `get_pattern_examples` — these are focused and single-purpose. Reasonable, but the RFC should check whether `find_cross_game_concepts` (existing) could be extended with a `concept_type: design_pattern` filter instead of a new tool.

4. **`packagesImpacted: []`**: Should list `knowledge-core` if the ontology file is modified.

## Axis G — Blind spots

1. **Schema for `concrete_examples`**: The RFC shows a JSON example but doesn't define where this field lives in the concept record schema. Is it a top-level field on `rgkb/concept@2`? Does it need schema changes? The materializer and quality scorer (RFC-0009) need to know about this field.

2. **Quality scoring interaction**: RFC-0009 computes `quality_score` for all concepts. New `design_pattern` concepts will get scored. The RFC doesn't address whether the scoring formula needs adjustment for patterns (e.g., richness based on member_primitives count).

3. **Edge cases**: What if a pattern has no member primitives? What if a game is neither in `games_where_present` nor `games_where_absent`? What if a failure mode has no triggering combination?

4. **Performance**: The LLM-assisted example generation (D1) will make API calls. No estimate of cost or time. The existing `systems-cache/llm-design-cache.json` pattern should be reused.

5. **`design_pattern` concept schema**: The RFC shows `member_primitives`, `member_pressures`, `games_where_present`, `games_where_absent` fields. Are these stored as concept attributes? In `ancestry`? The concept record structure needs to be defined.

## Questions for the author

1. **nonGoals contradiction**: D2 creates `design_pattern` as a new concept_type, but nonGoals says "Does not create new concept types". Which is correct? If `design_pattern` is new, remove the nonGoal. If it should reuse an existing type (`emergent_pattern`, `synergy_pattern`), rewrite D2.

2. **Why not extend `run-stage-design.ts`?** The existing script already manages all design-layer concepts with `cleanDesignData()` idempotency. Why create two new scripts instead of extending the existing one?

3. **Is `concrete_examples` canonical or projection?** If canonical, it changes the concept schema and needs to be in `knowledge/concept/cross-game/concept/` alongside other concept files. If projection, it belongs in the materializer. Where does it live?
