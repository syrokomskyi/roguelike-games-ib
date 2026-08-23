---
rfcId: RFC-0006
auditId: AUDIT-RFC-0006-01
date: 2026-08-23
auditor:
  skill: fo-idea-audit
  model: claude-sonnet-4-20250514
verdict: needs-revision
---

# Audit: RFC-0006

## Verdict: Needs revision

RFC-0006 has significant kind-mapping inconsistencies with RFC-0001's canonical mapping table, a missing required DNA invariant declaration (V-24 error), and 5 missing required sections (V-13 warnings). The kind-mapping issues are architectural — they would create taxonomy drift if implemented as written.

## Mechanical validation (rfc.validate)

**Fail** — 1 error, 5 warnings:

- **V-24 (error)**: architecture RFC created 2026-08-23 (>= 2026-07-07) must declare at least one DNA invariant in `satisfies`.
- **V-13 (warning)**: Missing required sections: "Architectural fit", "Design", "Rollout", "Alternatives considered", "Implementation notes for agents".

## Axis A — Structural completeness

1. **Missing "Architectural fit" section** — RFC-0001 has a detailed architectural fit section explaining relationships to ADRs, the taxonomy, the SDK, and the deriver. RFC-0006 lacks this entirely. The RFC should explain how it fits with RFC-0001's methodology, the existing taxonomy, and the deriver pipeline.

2. **Missing "Design" section** — No TypeScript contracts or file system responsibilities table. RFC-0001 documents the SDK types and file paths. RFC-0006 should at minimum document which files in each extractor will be modified and what new types/parsers are needed.

3. **Missing "Rollout" section** — No description of how existing extractors transition to the new state. The implementation plan has phases but no rollout narrative (e.g., "existing records are unaffected, new records are additive").

4. **Missing "Alternatives considered" section** — No alternatives documented. For example: why not extract gods as `deity` instead of `profession`? Why not skip low-priority items entirely?

5. **Missing "Implementation notes for agents" section** — No behavioral rules for implementing agents. RFC-0001 has explicit "agents MUST/MAY/SHALL" rules. RFC-0006 should include similar guidance (e.g., "agents MUST follow RFC-0001 Principle 3 for kind mapping").

6. **Acceptance criteria** are present (12 items) and checkable. No issues here.

7. **Risks section** exists but doesn't address agent misinterpretation risk or false-positive rate for population contracts.

## Axis B — DNA alignment

1. **`satisfies: []` is empty (V-24 error)** — Architecture RFCs created on or after 2026-07-07 must declare at least one DNA invariant. The `invariantsFile` in `forge.yaml` is `null`, meaning no DNA invariants file exists yet. The RFC must either: (a) declare a DNA invariant and ensure the invariants file is created, or (b) acknowledge this is a gap and propose a DNA invariant this RFC establishes (e.g., "DNA-1: extractors map game-local types to canonical kinds per RFC-0001 Principle 3").

2. **`related: [RFC-0001, PLAN-002, PLAN-003]`** — RFC-0001 is directly relevant (extraction methodology). PLAN-002 and PLAN-003 are plans, not RFCs — including them in `related` is unconventional but not harmful.

## Axis C — Ecosystem fit

1. **Crawl gods mapped to `kind: profession` — inconsistent with taxonomy** — The taxonomy (`game-content-taxonomy.yaml:20`) defines `deity` in the `society` category. RFC-0006 line 101 maps gods to `kind: profession`. Gods are not professions. RFC-0001's mapping table does not include gods. The RFC should use `kind: deity` with `native_kind: god`, which aligns with the existing taxonomy.

2. **NetHack attack types mapped to `kind: ability` — inconsistent with RFC-0001** — RFC-0001's mapping table (line 239) maps NetHack attack types to `kind: damage_type` with `native_kind: attack_type`. RFC-0006 line 116 maps them to `kind: ability`. This directly contradicts the established methodology mapping.

3. **Cataclysm-BN NPC classes mapped to `kind: profession` — inconsistent with RFC-0001** — RFC-0001's mapping table (line 232) maps Cataclysm-BN NPC JSON to `kind: npc` with `native_kind: npc_class`. RFC-0006 line 177 maps them to `kind: profession`. The taxonomy has both `npc` (actors) and `profession` (abilities_character). RFC-0001's mapping should be followed.

4. **Crawl brands mapped to `kind: item`** — Brands are weapon enchantments, not items. The taxonomy doesn't have a "brand" or "enchantment" kind. Using `kind: item` with `native_kind: brand` follows RFC-0001's hierarchical mapping rule (Principle 3), but the RFC should justify why no existing kind fits better.

5. **Deriver config change under-specified** — D1 step 4 says "Add `god` to `GROUPING_ATTRIBUTES` in deriver". This is a deriver code change, not just an extractor change. The RFC should identify which file contains `GROUPING_ATTRIBUTES` and what the impact is on derived relations.

6. **Package boundaries** are correct — all proposed changes are within existing `packages/extractors/` packages. No new packages proposed.

7. **Conformance tests not addressed** — New data types will require updates to existing conformance tests (`tests/conformance/c*.test.ts`). The RFC doesn't mention this.

## Axis D — Forward-only compliance

No issues. The RFC is purely additive — new data types are added to existing extractors. No backward compatibility layers, no dual paths, no deprecation.

## Axis E — Agent-facing policy

1. **No self-authorizing language** — the RFC does not claim implementation can proceed while in `draft` status. No issues.

2. **No NEEDS CLARIFICATION markers** found.

3. **No implementation gate** — the RFC doesn't state that implementation requires `accepted` status, as RFC-0001 does. The "Implementation notes for agents" section (missing) should include this.

## Axis F — Pragmatism

1. **BrogueCE skip is well-justified** — diminishing returns correctly identified.

2. **Scope discipline** — `packagesImpacted` lists 5 packages (extractor-sdk + 4 extractors). However, the RFC also proposes deriver changes (D1 step 4) and coverage file updates (D8). The deriver is in `scripts/`, not a package. This should be noted.

3. **Low-priority items included** — D6 (NPC classes, ~50 records) and D7 (monster groups, ~50 records) are low priority but still included. The RFC could be more aggressive about cutting scope — 100 records is marginal value vs. implementation effort.

4. **Estimated record counts** (~600-700) are reasonable and grounded in source surveys.

## Axis G — Blind spots

1. **No schema examples** — the RFC says "survey all files before writing the adapter" for Crawl gods but doesn't provide an example YAML schema. This makes it hard to assess parsing complexity.

2. **Derived data impact not estimated** — RFC-0001 emphasizes that "more records with more attributes = exponentially more derived data". RFC-0006 doesn't estimate the impact on claims, relations, and semantic records. Crawl gods with piety thresholds, abilities, and favours could generate significant derived data.

3. **Conformance test updates not mentioned** — adding new population dimensions requires updating conformance tests. The implementation plan (Step 7) mentions "run conformance tests" but not updating them.

4. **Web app and Obsidian vault rebuild** — Step 8 mentions rebuilding both, but doesn't specify what changes are needed to handle new kinds (e.g., `deity` if the kind mapping is corrected).

5. **Performance** — adding ~200 Crawl item types on top of the existing 6,246 vaults and 680 monsters is not a bottleneck. No issues.

## Questions for the author

1. Why map Crawl gods to `kind: profession` when the taxonomy defines `deity`? This creates taxonomy drift and contradicts RFC-0001 Principle 3 (map to the nearest canonical kind).

2. Why map NetHack attack types to `kind: ability` when RFC-0001's mapping table explicitly maps them to `kind: damage_type`? This contradicts the established methodology.

3. Why map Cataclysm-BN NPC classes to `kind: profession` when RFC-0001 maps them to `kind: npc`? Should RFC-0006 supersede RFC-0001's mapping, or follow it?
