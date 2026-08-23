---
rfcId: RFC-0001
title: Extraction methodology for multi-game knowledge base
status: accepted
planDate: 2026-08-22
---

# Plan: RFC-0001 — Extraction methodology for multi-game knowledge base

## Objectives

Implement the governance and policy changes defined by RFC-0001:

1. Add `profession` to the canonical taxonomy
2. Update the `fo-create-extractor` skill to reference RFC-0001 as methodology source
3. Update `AGENTS.md` with a reference to RFC-0001 for extractor creation
4. Review existing extractors for compliance with all 11 principles
5. Verify ADR-0005 and ADR-0006 exist and reference RFC-0001

The "first new extraction" acceptance criterion is deferred to future work — it will be satisfied when someone implements a new extraction (e.g., Crawl vaults) following the methodology.

## Steps

### Step 1: Add `profession` to `game-content-taxonomy.yaml`

Add `profession` to the `abilities_character` category in `knowledge/ontology/game-content-taxonomy.yaml`.

**Completion criterion:** `profession` appears in the `abilities_character.kinds` array. The existing `c11-ontology-freeze.test.ts` conformance test still passes (it checks taxonomy kinds against extracted record kinds — adding a kind should not break it).

### Step 2: Update `fo-create-extractor` skill to reference RFC-0001

Add a reference to RFC-0001 in the skill's `SKILL.md` as the methodology source. The skill currently lists common kinds and workflow steps but does not reference the formal methodology.

**Completion criterion:** `SKILL.md` contains a reference to `RFC-0001` and its principles (e.g., "Follow RFC-0001 extraction methodology" in the process or constraints section).

### Step 3: Update `AGENTS.md` with RFC-0001 reference

Add a rule to the root `AGENTS.md` directing agents to RFC-0001 when creating extractors. The current `AGENTS.md` only has the extractor package location rule.

**Completion criterion:** `AGENTS.md` contains a paragraph referencing RFC-0001 as the binding extraction methodology for all extractors.

### Step 4: Review existing extractors for compliance with all 11 principles

Audit each extractor (`broguece`, `cataclysm-bn`, `crawl`, `nethack`) against the 11 principles. Document findings as a comment block or section in each extractor's `MODULE_CONTRACT` or a shared review document.

Checklist per extractor:
- Principle 1: one source object = one record ✓
- Principle 2: factual extraction without loss (no normalization) ✓
- Principle 3: canonical kind mapping declared in manifest ✓
- Principle 4: evidence anchors for every record ✓
- Principle 5: population completeness contracts ✓
- Principle 6: composite data stays in attributes ✓
- Principle 7: one extractor per game ✓
- Principle 8: onboarding process (existing extractors predate this — document compliance)
- Principle 9: taxonomy extension (no new kinds proposed beyond `profession`)
- Principle 10: versioning and refresh (extractorVersion in manifest)
- Principle 11: extraction–derivation contract (attributes preserved for deriver)

**Completion criterion:** A review document exists at `docs/audits/rfc-0001-extractor-compliance-review.md` documenting compliance status for each extractor against all 11 principles.

### Step 5: Verify ADR-0005 and ADR-0006 exist and reference RFC-0001

Confirm `docs/adrs/adr-0005-new-game-onboarding-process.md` and `docs/adrs/adr-0006-taxonomy-coverage-confirmation.md` exist, have `status: accepted`, and list `RFC-0001` in their `related` frontmatter.

**Completion criterion:** Both ADR files exist, status is `accepted`, and `related` includes `RFC-0001`.

### Step 6: Run validation

Run `rfc.validate` on RFC-0001 and run the conformance test suite to verify no regressions from the taxonomy change.

```sh
pnpm exec forge rfc.validate --id RFC-0001 --json
pnpm exec vitest tests/conformance/ --run
```

**Completion criterion:** `rfc.validate` passes with zero violations. Conformance tests pass (the taxonomy addition of `profession` should not break any test — it only adds a kind that was already used by extractors).

### Step 7: Review and fix

Run `fo-review` on all session code changes. Run `fo-fix` if the review has findings.

**Completion criterion:** Review report exists in `docs/reviews/code/`. Any findings are fixed or acknowledged.

### Step 8: Stamp implemented

Run `rfc.implement.stamp` to transition RFC-0001 from `accepted` to `implemented`.

```sh
pnpm exec forge rfc.implement.stamp --id RFC-0001 --implementation-commit <sha>
```

**Completion criterion:** RFC-0001 frontmatter shows `status: implemented` and `implementedAt: 2026-08-22`.

## Acceptance criteria mapping

| Criterion | Step | Status |
|---|---|---|
| RFC-0001 validated with `rfc.validate` and passes | Step 6 | planned |
| ADR-0005 created and references this RFC | Step 5 | already exists |
| ADR-0006 created and references this RFC | Step 5 | already exists |
| `profession` added to taxonomy | Step 1 | planned |
| Existing extractors reviewed for compliance with all 11 principles | Step 4 | planned |
| `fo-create-extractor` skill updated to reference this RFC | Step 2 | planned |
| First new extraction follows methodology and passes conformance | deferred | future work |
| `AGENTS.md` updated with reference to this RFC | Step 3 | planned |

## Risks and mitigations

- **Taxonomy freeze test**: `c11-ontology-freeze.test.ts` checks `record-types.yaml`, `relation-types.yaml`, `schema-registry.yaml`, and `manifest.yaml` — NOT `game-content-taxonomy.yaml`. Adding `profession` to the taxonomy will not break c11. No mitigation needed.
- **brogueCE non-standard kinds**: The compliance review (Step 4) will document these as technical debt. No code changes are planned for them — they are explicitly out of scope per the RFC's nonGoals.
