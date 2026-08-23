---
id: PLAN-RFC-0002
rfcId: RFC-0002
title: "Concept quality — semantic equivalence mappings, noise filtering, and implementation reference integrity"
status: accepted
scope: workspace
decider: architecture
reviewers:
  - human:andrii-syrokomskyi
related:
  - RFC-0002
  - PLAN-003
created: 2026-08-23
accepted: 2026-08-23
implementedAt:
closedAt: null
---

# Plan: RFC-0002 — Concept quality

## Objectives

1. Extend `extractAttributeValues()` to handle object-valued attributes (Crawl mutation `resists`)
2. Add Crawl and BrogueCE value aliases to `VALUE_NORMALIZATIONS` and re-add mappings to `SEMANTIC_EQUIVALENCES`
3. Replace `NOISY_ATTRS` blocklist with `INFORMATIVE_ATTRS` allowlist
4. Deduplicate exact-match concepts against semantic equivalence concepts
5. Add `validateConceptRefs()` post-generation validation
6. Extend Obsidian `validateAllLinks` to check concept implementation_refs
7. Add conformance test `c14-concept-ref-integrity.test.ts`
8. Re-run full pipeline and verify all acceptance criteria

## Key findings from codebase exploration

- **Crawl creatures** do NOT have `resists` — they have `flags` as `string[]` (e.g., `["flies", "warm_blood"]`). The existing `extractAttributeValues()` already handles arrays of strings.
- **Crawl mutations** (forms) have `resists` as an object (e.g., `{poison: 1, fire: 2}`). D1's object handling is needed for this kind.
- **BrogueCE creatures** have `flags` as a pipe-separated string (e.g., `"MONST_MAINTAINS_DISTANCE | MONST_IMMUNE_TO_FIRE | MONST_FIERY"`). The existing `extractAttributeValues()` already handles pipe-separated strings.
- **NetHack creatures** have `resistances` and `conveys` as pipe-separated strings (e.g., `"MR_FIRE | MR_COLD | MR_POISON"`). Already handled.
- **Cataclysm-BN creatures** have `flags` as `string[]` (e.g., `["SEES", "HEARS", "FLIES", "STUMBLES"]`). Already handled.
- The RFC's P1 says "Crawl stores resistances as boolean flags inside a `resists` object" — this is true for Crawl **mutations**, not creatures. The `SEMANTIC_EQUIVALENCES` for resistance concepts use `kind: "creature"`. To include Crawl, we need to either:
  - **Option A**: Add a separate `SEMANTIC_EQUIVALENCES` entry with `kind: "mutation"` for Crawl resistances (e.g., `attrMapping: [{ sourceId: "crawl", attr: "resists" }]` with `kind: "mutation"`). This creates a second concept record for Crawl form resistances.
  - **Option B**: Change the existing resistance concept `kind` to cover both `creature` and `mutation` — but `SEMANTIC_EQUIVALENCES` has a single `kind` field. This would require schema changes to the concept generation logic.
- **Decision**: Option B — extend `SEMANTIC_EQUIVALENCES` to support multiple `kind` values per entry. Replace `kind: string` with `kinds: string[]`. `generateSemanticEquivalenceConcepts()` filters by `equiv.kinds.includes(r.kind)`. This unifies creature and mutation resistance concepts into a single concept record per element. Crawl `resists` on `mutation` kind and Crawl `flags` on `creature` kind both contribute to the same concept.

- **BrogueCE creature flags** are pipe-separated strings containing values like `MONST_IMMUNE_TO_FIRE`. The existing `extractAttributeValues()` splits on `|` and trims. The `normalizeValue()` function lowercases. So `MONST_IMMUNE_TO_FIRE` → `monst_immune_to_fire` → needs to be in `VALUE_NORMALIZATIONS["Fire Resistance"]` map. The RFC already has `"monst_immune_to_fire": "fire"` in the map.

- Current test count: **639 tests, 89 files**. All pass.

## Steps

### Step 1: Extend `extractAttributeValues()` for object-valued attributes (D1)

**Files**: `scripts/run-stage-concepts.ts`

1. Add object-valued attribute handling to `extractAttributeValues()` — extract keys where value is truthy (`true`, `1`, `"true"`)
2. This enables Crawl mutation `resists: { fire: 2, poison: -1 }` to produce `["fire", "poison"]` (only truthy positive values; negative values mean vulnerability, not resistance)

**Completion criterion**: `extractAttributeValues({ fire: 2, cold: 0, poison: -1 })` returns `["fire"]` (only positive truthy values).

### Step 2: Add Crawl and BrogueCE normalization aliases and extend SEMANTIC_EQUIVALENCES (D1)

**Files**: `scripts/run-stage-concepts.ts`

1. **Extend `SEMANTIC_EQUIVALENCES` schema**: Replace `kind: string` with `kinds: string[]` in the type definition. Update all existing entries to use `kinds: ["creature"]` (or `kinds: ["creature", "mutation"]` for resistance concepts that include Crawl).
2. **Update `generateSemanticEquivalenceConcepts()`**: Replace `r.kind === equiv.kind` with `equiv.kinds.includes(r.kind)`.
3. Add Crawl mutation `resists` value aliases to `VALUE_NORMALIZATIONS` for each resistance concept:
   - `"Fire Resistance"`: `"fire": "fire"` (already present)
   - `"Cold Resistance"`: `"cold": "cold"` (already present)
   - `"Poison Resistance"`: `"poison": "poison"` (already present)
   - `"Electricity Resistance"`: add `"elec": "electricity"` (Crawl uses `elec`, not `electricity`)
   - `"Acid Resistance"`: `"acid": "acid"` (already present)
   - `"Sleep Resistance"`: no Crawl equivalent — skip
4. Add BrogueCE flag aliases to `VALUE_NORMALIZATIONS`:
   - `"Fire Resistance"`: `"monst_immune_to_fire": "fire"` (already present), add `"rf_fire": "fire"`
   - `"Cold Resistance"`: add `"rf_cold": "cold"`, `"monst_immune_to_cold": "cold"`
   - `"Poison Resistance"`: add `"rf_poison": "poison"`, `"monst_immune_to_poison": "poison"`
   - `"Electricity Resistance"`: add `"rf_elec": "electricity"`, `"monst_immune_to_electricity": "electricity"`
5. Update `SEMANTIC_EQUIVALENCES` entries:
   - Fire/Cold/Poison/Electricity/Acid Resistance: add `kinds: ["creature", "mutation"]`, add Crawl `resists` (mutation) and BrogueCE `flags` (creature) to `attrMapping`
   - Flight Capability: add Crawl `flags` (creature) to `attrMapping` (already has BrogueCE `flags` and Cataclysm-BN `flags`)

**Completion criterion**: After running concept generation, Fire Resistance concept includes ≥3 games with records from both creature and mutation kinds.

### Step 3: Replace `NOISY_ATTRS` blocklist with `INFORMATIVE_ATTRS` allowlist (D2)

**Files**: `scripts/run-stage-concepts.ts`

1. Define `INFORMATIVE_ATTRS` set as specified in RFC D2
2. Replace `NOISY_ATTRS.has(attrName)` check with `!INFORMATIVE_ATTRS.has(attrName)` in `generateExactMatchConcepts()`
3. Remove the `NOISY_ATTRS` set definition

**Completion criterion**: `creature_speed_*` concepts are no longer generated. `item_material_*` concepts still generated.

### Step 4: Deduplicate exact-match concepts against semantic equivalence concepts (D3)

**Files**: `scripts/run-stage-concepts.ts`

1. After combining exact-match and semantic-equivalence concepts in `main()`, before the dedup-by-key step, filter out exact-match concepts whose `(attr, normalizedValue)` pair is covered by a semantic equivalence mapping
2. Build a `Set<string>` of `"${attr}:${normalizedValue}"` pairs from semantic equivalence concepts — for each semantic concept, iterate its `attrMapping` entries and normalize each possible value via `VALUE_NORMALIZATIONS[conceptName]`
3. For each exact-match concept, compute `"${group.attr}:${normalizeValue(conceptName, group.value)}"` and check if it's in the semantic set. If yes, skip it.
4. Note: the exact-match concept's `conceptName` may not directly correspond to a semantic concept name. Use the `(attr, value)` pair directly — if the exact-match concept's attr is `flags` and value is `flies`, check if any semantic mapping covers `(flags, flies)`.

**Completion criterion**: `creature_flags_flies` exact-match concept is not in the final set when "Flight Capability" semantic concept exists.

### Step 5: Add `validateConceptRefs()` post-generation validation (D4)

**Files**: `scripts/run-stage-concepts.ts`

1. Implement `validateConceptRefs()` with proper types (`ConceptRecord[]`, `CanonicalRecord[]` — use `any[]` with JSDoc if types are not exported)
2. Call after concept generation, before building the transaction
3. Strip dangling refs from `implementation_refs` and sync `ancestry.derived_from`
4. Delete concepts where ALL `implementation_refs` are dangling
5. Log warnings for dangling refs and deleted concepts

**Completion criterion**: No concept in the output has `implementation_refs` containing IDs not in the canonical record set.

### Step 6: Add conformance test `c14-concept-ref-integrity.test.ts` (D4)

**Files**: `tests/conformance/c14-concept-ref-integrity.test.ts`

1. Load all concept records from `knowledge/concept/`
2. Load all definition records from `knowledge/definition/`
3. Assert every `implementation_refs` entry resolves to an existing record ID
4. Assert every `ancestry.derived_from` entry resolves to an existing record ID

**Completion criterion**: `pnpm exec vitest tests/conformance/c14-concept-ref-integrity.test.ts --run` passes.

### Step 7: Extend Obsidian `validateAllLinks` for concept refs (D5)

**Files**: `packages/builders/obsidian-builder/src/links.ts`, `packages/builders/obsidian-builder/src/build.ts`

1. In `build.ts`, collect concept `implementation_refs` as links (in the record loop, when `record.record_type === "concept"`, push refs to `allLinks`)
2. The existing `validateAllLinks` already checks all links in the `allLinks` array — no change needed to `links.ts` itself
3. If validation fails on concept refs, the build will throw (existing behavior for unresolved links)

**Completion criterion**: `pnpm exec tsx scripts/run-build-obsidian.ts` succeeds with no unresolved link errors.

### Step 8: Re-run full pipeline

1. `pnpm exec tsx scripts/run-stage-concepts.ts` — regenerate concepts
2. `pnpm exec tsx scripts/run-materialize.ts` — re-materialize
3. `pnpm exec tsx scripts/run-build-obsidian.ts` — rebuild vault
4. `pnpm exec vitest --run` — all 639+ tests pass (plus new c14 test)

**Completion criterion**: All commands exit 0. Concept count is reasonable (≥5 semantic equivalence concepts, ≤20 exact-match concepts after noise filtering).

### Step 9: Review and fix

1. Run `fo-review` on all session code changes
2. Run `fo-fix` if review has findings

**Completion criterion**: Review report exists in `docs/reviews/code/`. No unfixed findings.

### Step 10: Stamp implemented

1. Run `pnpm exec forge rfc.implement.stamp --id RFC-0002 --implementation-commit <sha>`
2. Update RFC status to `implemented`

**Completion criterion**: RFC-0002 status is `implemented`.

## Validation suite

- `pnpm exec forge rfc.validate --id RFC-0002 --json` — passes
- `pnpm exec vitest --run` — all tests pass (639 existing + 1 new)
- `pnpm exec tsx scripts/run-stage-concepts.ts` — exits 0, concepts generated
- `pnpm exec tsx scripts/run-build-obsidian.ts` — exits 0, no broken links

## Acceptance criteria mapping

| Criterion | Step(s) | Verification |
|---|---|---|
| All resistance concepts include ≥3 games | 1, 2, 8 | Check concept files for `source_games` array length |
| No exact-match concepts for numeric attributes | 3, 8 | Check no `creature_speed_*` concept files exist |
| No exact-match concepts duplicating semantic concepts | 4, 8 | Check no `creature_flags_flies` concept file exists |
| All `implementation_refs` resolve | 5, 6, 8 | `c14-concept-ref-integrity.test.ts` passes |
| Obsidian vault has no broken concept links | 7, 8 | `run-build-obsidian.ts` exits 0 |
| All existing tests pass | 8 | `vitest --run` shows 639+ tests pass |
| New conformance test passes | 6, 8 | `c14-concept-ref-integrity.test.ts` passes |

## Risks and mitigations

- **Crawl `resists` on mutations, not creatures**: The RFC assumes `resists` is on creatures. Mitigation: add separate `SEMANTIC_EQUIVALENCES` entries with `kind: "mutation"` for Crawl resistance concepts.
- **BrogueCE flag normalization**: BrogueCE flags like `MONST_IMMUNE_TO_FIRE` are long strings. The `normalizeValue()` function uses `includes()` matching, so `monst_immune_to_fire` will match the key `"fire"` via includes. Verify this doesn't cause false positives.
- **Allowlist too restrictive**: Review all 22 current exact-match concepts and verify their attributes are in `INFORMATIVE_ATTRS`.
