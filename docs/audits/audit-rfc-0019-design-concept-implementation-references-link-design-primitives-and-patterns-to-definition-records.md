---
rfcId: RFC-0019
auditId: AUDIT-RFC-0019-01
date: 2026-08-24
auditor:
  skill: fo-idea-audit
  model: claude-sonnet-4-20250514
verdict: needs-revision
---

# Audit: RFC-0019

## Verdict: Needs revision

RFC-0019 proposes a sound LLM-based matching step to populate `implementation_refs` on design primitives and patterns. The architectural approach is well-grounded in existing infrastructure. However, the conformance test naming conflicts with an existing test, the token budget undercounts by omitting design pattern matching calls, and the Step 7 / Step 7.5 ordering contains a circular dependency that must be resolved before implementation.

## Mechanical validation (rfc.validate)

**Pass** — 0 violations.

## Axis A — Structural completeness

No issues. Decision is present tense ("The design stage script gains…"). File system responsibilities table names concrete paths. Failure modes specify behavior for LLM failures, invalid IDs, and empty results. Rollout describes regeneration behavior and CI impact. Alternatives considered has 3 real alternatives with rejection reasons. Risks includes agent misinterpretation risk. Acceptance criteria are checkable. Implementation notes are explicit behavioral rules.

## Axis B — DNA alignment

No issues. `satisfies: []` — no DNA invariants declared. `invariantsFile` in `forge.yaml` is `null`, so no formal DNA invariants file exists. `related: [RFC-0002, RFC-0003, RFC-0011]` — all three are real, implemented RFCs that this RFC directly builds on. The RFC body explains how it extends each one.

## Axis C — Ecosystem fit

- **Conformance test naming conflict**: The RFC proposes `c17-design-implementation-refs.test.ts` and explicitly states "not `c16` — `c16-game-recommender.test.ts` already exists." However, `c17-record-count-regression.test.ts` already exists in `tests/conformance/`. The RFC's collision check was incomplete — it checked c16 but missed c17, c18, and c19. The next available test number is **c20**. The RFC must update the test name and the implementation notes.

## Axis D — Forward-only compliance

No issues. No compatibility shims or dual paths. Existing design concepts are regenerated from scratch via `cleanDesignData()`. No legacy code paths maintained behind flags.

## Axis E — Agent-facing policy

No issues. Status gate is correct — implementation notes say "Agents MAY implement code changes ONLY when this RFC has status: accepted (or implemented)." No self-authorizing language. No `NEEDS CLARIFICATION` markers. Anti-fabrication: acceptance criteria are code+LLM automated, not human content authoring.

## Axis F — Pragmatism

- **`packagesImpacted` accuracy**: The RFC lists `builders/obsidian-builder` but describes no code changes to that package. The builder renders `implementation_refs` as wiki-links — this is data impact (more links to render), not code impact. The builder needs no modifications. Consider removing it from `packagesImpacted` or clarifying that the impact is data-level, not code-level.

## Axis G — Blind spots

- **Token budget undercounts**: The RFC estimates "~200 LLM calls" but only counts primitive matching (14 × 4 = 56 Step A + ~140 Step B). Design patterns also receive the same two-step matching (10 patterns × 4 games = 40 Step A + ~100 Step B = ~140 calls). Total is ~340 calls, not ~200. The cost analysis and time estimate should be updated.

- **Step 7 / Step 7.5 ordering ambiguity**: The RFC says Step 7.5 runs "after concrete examples generation in Step 7, before design pattern generation in Step 8." But it also says "Step 7 (concrete examples) is extended: after generating the text description for each (primitive, game) pair, the matching results from Step 7.5 are used to populate `record_refs`." This creates a circular dependency: Step 7 must complete before Step 7.5 starts, but Step 7 needs Step 7.5 results to populate `record_refs`. The RFC must clarify the actual execution order — either Step 7.5 runs interleaved with Step 7 (matching per `(primitive, game)` pair before the example is finalized), or Step 7 is split into text generation (before 7.5) and ref population (after 7.5).

- **Step B sampling contradiction**: The RFC says Step B sends "a sample of record names (up to 50 records)" and the LLM "returns a JSON array of record IDs that implement the primitive." Only records in the sample can be selected. But the Risks section says "the primitive's `implementation_refs` can include all records of a relevant kind if the LLM determines the entire kind is relevant." These are contradictory — the LLM can only return IDs from the 50-record sample, not all records of the kind. If the intent is to allow "select all records of this kind" as a response, the prompt design and response schema must support that explicitly (e.g., a `"select_all": true` flag).

## Questions for the author

1. What is the actual execution order for Step 7 and Step 7.5? Does matching run interleaved with example generation, or is Step 7 split into two phases around Step 7.5?
2. Should Step B support a "select all records of this kind" response when the entire kind is relevant, or is the 50-record sample the ceiling for `implementation_refs` per `(primitive, game, kind)` triple?
3. Should `packagesImpacted` include `builders/obsidian-builder` given that no code changes are needed in that package?
