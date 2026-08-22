---
id: ADR-0007
title: Remap brogueCE non-canonical recordKinds to existing taxonomy kinds
status: implemented
scope: project-wide
decider: architecture
reviewers:
  - human:andrii-syrokomskyi
related:
  - RFC-0001
  - ADR-0006
created: 2026-08-22
accepted: 2026-08-22
implementedAt: 2026-08-22
closedAt: null
---

# ADR-0007: Remap brogueCE non-canonical recordKinds to existing taxonomy kinds

## Context

The brogueCE extractor declares 6 recordKinds that are not present in `knowledge/ontology/game-content-taxonomy.yaml`:

| Non-canonical kind | Records | Attributes | Source |
|---|---|---|---|
| `image_asset` | varies | mime_type, width, height, alt_text | Image files in `bin/assets/` |
| `dungeon_feature` | 145 | layer, start, decay, flags | `dungeonFeatureCatalog` in `Globals.c` |
| `light` | 60 | color, radius_min, radius_max, fade_percent, pass_through_creatures | `lightCatalog` in `Globals.c` |
| `monster_class` | 15 | frequency, max_depth, members | `monsterClassCatalog` in `Globals.c` |
| `monster_behavior` | 29 | description, is_always_active | `monsterBehaviorCatalog` in `Globals.c` |
| `monster_ability` | 18 | description, is_always_active | `monsterAbilityCatalog` in `Globals.c` |

These were added before the taxonomy was formalized. RFC-0001 documents them as "existing technical debt" in its nonGoals and compliance review. This ADR resolves the debt by remapping all 6 to existing canonical kinds — no taxonomy extensions are needed.

## Decision

Remap all 6 non-canonical brogueCE recordKinds to existing canonical kinds from `game-content-taxonomy.yaml`. The `native_kind` field in each `EntityAdapter` already carries the game-local type name, providing differentiation.

### Mapping

| Non-canonical kind | Canonical kind | Category | native_kind | Rationale |
|---|---|---|---|---|
| `image_asset` | `other_definition` | fallback | `image` | Not a game concept — file metadata. Fallback kind is appropriate since image assets are pipeline artifacts, not game definitions. |
| `dungeon_feature` | `feature` | world | `dungeonFeature` | Direct semantic match. `feature` covers dungeon features (gas, fire, fog, etc.) with layer, start, decay, flags attributes. |
| `light` | `feature` | world | `lightSource` | Light sources are world features. They share the same structural pattern as dungeon features (catalog entries with display + gameplay properties). `native_kind: lightSource` differentiates from `dungeonFeature`. |
| `monster_class` | `spawn_table` | economy | `monsterClass` | Monster classes define spawn groups (frequency, max_depth, member list). This is semantically a spawn table — a grouping of creatures with spawn rules. |
| `monster_behavior` | `trait` | abilities_character | `monsterBehavior` | Behavioral patterns (e.g., `MONST_DUTIFUL`, `MONST_FLICKERS`, `MONST_CARRY_HEALING_POTION`) are character traits that modify how creatures act. `trait` in `abilities_character` is the canonical match. |
| `monster_ability` | `ability` | abilities_character | `monsterAbility` | Direct semantic match. Monster abilities (e.g., `MA_ATTACKS_ADJACENT`, `MA_CLIMBS_WALLS`) are capabilities that creatures can use. `ability` in `abilities_character` is the canonical kind. |

### Implementation

The remapping requires changes only in `packages/extractors/broguece-extractor/src/extractor.ts`:

1. Update `manifest.recordKinds` — replace the 6 non-canonical kinds with their canonical equivalents
2. Update `simpleSpec` calls — change the `kind` parameter for each affected spec
3. Update `imageAssetSpec` — change `kind` from `"image_asset"` to `"other_definition"`
4. Keep `nativeKind` unchanged — it already carries the game-local type name

No changes to:
- `game-content-taxonomy.yaml` — no new kinds needed
- `c-parser.ts` — parsing logic is kind-agnostic
- Population contracts — dimensions stay the same (they reference population dimensions, not kinds)
- Conformance tests — they check population counts, not kind names

### Impact on derived data

The Attribute Deriver (`scripts/run-stage-deriver.ts`) uses `record.kind` for grouping semantic records. After remapping:
- `feature` records will include both dungeon features and lights, grouped by attributes like `flags`, `layer`
- `spawn_table` records will include monster classes, grouped by `frequency`, `max_depth`
- `trait` records will include monster behaviors, grouped by `is_always_active`
- `ability` records will include monster abilities, grouped by `is_always_active`

This is correct — the semantic groupings will now cross-cut game-local types within the same canonical kind, which is the intended behavior per RFC-0001 Principle 2 (factual extraction without cross-game normalization, but canonical kind alignment).

### Impact on existing records

Existing brogueCE records in `knowledge/definition/broguece/` have `kind` set to the non-canonical values. After remapping:
- New extraction runs will produce records with canonical kinds
- Old records with non-canonical kinds will remain until a full re-extraction is performed
- The `RefreshIdentityResolver` uses slug-based identity, so records will be updated in-place (same `native_id` → same record ID, but `kind` field changes)

**Migration**: run `pnpm exec extractor:run broguece` to re-extract all brogueCE records with canonical kinds. The old records will be overwritten.

## Justification

- All 6 non-canonical kinds have clear semantic matches in the existing taxonomy
- No taxonomy extensions needed — confirms ADR-0006's coverage analysis
- `native_kind` field provides game-local differentiation without polluting the canonical kind space
- Resolves the technical debt documented in RFC-0001 nonGoals and compliance review
- Aligns brogueCE with RFC-0001 Principle 3 (canonical kind mapping declared in manifest)

## Alternatives considered

### Add all 6 kinds to the taxonomy

Rejected. The 6 kinds are game-local concepts that fit existing canonical kinds. Adding them would bloat the taxonomy with game-specific kinds, violating RFC-0001 Principle 9 (taxonomy extension only when existing kinds are insufficient).

### Add only `light` to the taxonomy

Considered but rejected. `light` fits `feature` (world category) — both are catalog entries describing world-level phenomena with display and gameplay properties. The `native_kind: lightSource` field differentiates lights from dungeon features within the same canonical kind.

### Remove `image_asset` records entirely

Considered but rejected. Image asset records provide evidence for sprite extraction and are referenced by terrain/creature records. Keeping them as `other_definition` preserves the data without polluting game-concept kinds.

## Consequences

**Positive:**
- brogueCE extractor becomes fully compliant with RFC-0001 Principle 3
- All 4 extractors now use only canonical kinds from the taxonomy
- Taxonomy remains stable — no extensions needed
- Semantic records from the deriver will group brogueCE features/abilities/traits with other games' equivalents

**Negative:**
- Existing brogueCE records need re-extraction to update `kind` fields
- Downstream consumers that filter by `kind: dungeon_feature` or `kind: light` will need to update to `kind: feature` with `native_kind` filter
- Semantic record keys will change (e.g., `broguece/semantic/dungeon_feature-flags-*` → `broguece/semantic/feature-flags-*`), requiring re-derivation

## Rollout

1. Update brogueCE extractor (`extractor.ts`) with canonical kind mappings
2. Run `pnpm exec vitest tests/conformance/ --run` to verify no regressions
3. Re-extract brogueCE records: `pnpm exec extractor:run broguece`
4. Re-run deriver: `pnpm exec tsx scripts/run-stage-deriver.ts`
5. Verify derived data: check that semantic records now use canonical kinds
