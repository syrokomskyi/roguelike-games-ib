---
id: RFC-0006
title: "Extractor expansion — next-tier data types for all four games"
status: draft
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
  - PLAN-002
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
  - extractor-sdk
  - extractors/broguece-extractor
  - extractors/cataclysm-bn-extractor
  - extractors/crawl-extractor
  - extractors/nethack-extractor
successSignals:
  - All 4 games have ≥10 extracted data types
  - Coverage files declare population contracts for all new dimensions
  - New data types map to existing canonical kinds without taxonomy extensions
  - Deriver automatically generates claims, relations, and semantic records for new data
  - Cross-game concepts expand to cover new data types
nonGoals:
  - Does not redefine the extraction methodology — RFC-0001 governs that
  - Does not add new canonical kinds to the taxonomy — uses existing kinds
  - Does not modify the deriver — new data flows through existing derivation pipeline
---

# RFC-0006: Extractor expansion — next-tier data types for all four games

## Context

PLAN-002 is fully complete. All originally identified data types have been extracted:

| Game | Extracted kinds | Record count |
|---|---|---|
| broguece | terrain, feature, item, creature, trait, status_effect, ability, spawn_table, mutation, other_definition | 1,353 |
| cataclysm-bn | item, recipe, mutation, creature, profession, effect, ability (bionics), faction, trap, skill | 11,257 |
| crawl | vault, creature, spell, ability, species, branch, mutation (form), profession | 7,710 |
| nethack | item, creature, skill, artifact, trap, class (role), branch, species (race) | 952 |

However, each game source has additional data types that are not yet extracted. These represent the "next tier" — data that is less central to gameplay analysis but still valuable for cross-game comparison and comprehensive coverage.

### Current extraction state (per coverage files)

All existing dimensions are `exhaustive_for_binding` — every identified data type has been fully extracted with matching population contracts. The gaps are in **data types not yet surveyed**, not in incomplete extraction.

## Problem

Without extracting the next tier of data types:

1. **Cross-game comparison is incomplete**: We can compare creatures and items across all 4 games, but cannot compare traps (only NetHack and Cataclysm-BN have traps extracted), skills (only NetHack and Cataclysm-BN), or maps/levels (only Crawl has vaults).

2. **Design primitive coverage is uneven**: The "Shop and Economy" design primitive (RFC-0003) requires shop/NPC data that is not extracted from any game. The "Religion and God" primitive requires god/piety data that is not extracted from Crawl or NetHack.

3. **Knowledge base is dominated by Cataclysm-BN**: 11,257 of 20,500 records (55%) are from Cataclysm-BN. Extracting more data from other games will rebalance the knowledge base.

4. **Semantic records and concepts miss opportunities**: Without trap data from Crawl and BrogueCE, we cannot generate cross-game "trap" concepts. Without god/religion data from Crawl, we cannot link the religion design primitive to specific game implementations.

## Decision

### Survey of next-tier data types

#### BrogueCE

| Data type | Source | Canonical kind | Estimated records | Priority |
|---|---|---|---|---|
| Runes (previously missing) | `src/item.c` | item | ~26 | Medium |
| Key items | `src/item.c` | item | ~5 | Low |
| Staffs (weapon category) | `src/item.c` | item | ~10 | Low |
| Wand effects | `src/item.c` | item | ~15 | Low |

**Note**: BrogueCE is nearly exhausted. The remaining data is sub-categories of items that are already extracted as `kind: item`. These would be attribute enrichments, not new record types.

**Recommendation**: Skip BrogueCE expansion — diminishing returns.

#### Crawl

| Data type | Source | Canonical kind | Estimated records | Priority |
|---|---|---|---|---|
| Gods | `dat/gods/*.yaml` | deity | ~30 | High |
| Piety rewards | `dat/gods/*.yaml` | ability | ~150 | High |
| Brands (weapon enchantments) | `dat/brand/*.yaml` | item | ~30 | Medium |
| Item types (base item definitions) | `dat/item-type/*.yaml` | item | ~200 | Medium |
| Monster spells (unique from spells) | `dat/mons/*.yaml` | ability | ~50 | Low |
| Clouds (gas, fire, etc.) | `dat/clouds/*.yaml` | effect | ~15 | Medium |
| Terrain features | `dat/terrain/*.yaml` | terrain | ~20 | Low |

**Rationale**: Gods and piety rewards are high priority because they directly support the "Religion and God" design primitive (RFC-0003). Brands and item types expand the item space for cross-game material/enchantment concepts.

#### NetHack

| Data type | Source | Canonical kind | Estimated records | Priority |
|---|---|---|---|---|
| Attack types | `include/monattk.h` | damage_type | ~20 | Medium |
| Monster abilities | `include/monflag.h` | ability | ~40 | Medium |
| Dungeon levels | `dat/*.lua` | map_template | ~131 | Low |
| Quest levels | `dat/quest*.lua` | map_template | ~60 | Low |
| Descriptions | `dat/descript/*.txt` | — | — | Skip (text only) |

**Rationale**: Attack types and monster abilities expand the ability space for cross-game comparison. Dungeon levels are low priority — they are map templates, not gameplay mechanics. Descriptions are text-only, not structured data.

#### Cataclysm-BN

| Data type | Source | Canonical kind | Estimated records | Priority |
|---|---|---|---|---|
| Martial arts | `data/json/martial/*.json` | ability | ~30 | Medium |
| NPC classes | `data/json/npc/*.json` | npc | ~50 | Low |
| Mapgen definitions | `data/json/mapgen/*.json` | map_template | ~500+ | Low |
| Scenarios | `data/json/scenarios/*.json` | — | ~20 | Skip (meta-game) |
| Monster groups | `data/json/monstergroups/*.json` | spawn_table | ~50 | Low |
| Vehicle definitions | `data/json/vehicles/*.json` | — | ~100 | Skip (not roguelike core) |
| Materials | `data/json/materials/*.json` | — | ~50 | Skip (attribute data) |
| Anatomy | `data/json/anatomy/*.json` | — | ~20 | Skip (body part mapping) |

**Rationale**: Cataclysm-BN already dominates the knowledge base. Martial arts and NPC classes are the most valuable additions for cross-game comparison. Mapgen is large but low value for design analysis. Scenarios, vehicles, materials, and anatomy are either meta-game or attribute-level data not worth extracting as separate records.

### D1: Crawl gods and piety rewards (high priority)

Extract gods from `dat/gods/*.yaml` as `kind: deity` (canonical kind from `society` category in `game-content-taxonomy.yaml`). Each god is a YAML file with attributes like `name`, `piety_gain`, `piety_loss`, `abilities`, `favours`.

- **Population contract**: count of `*.yaml` files in `dat/gods/`
- **Evidence**: source file with line range
- **Attributes**: preserve all YAML fields (piety thresholds, abilities, favours, dislikes)

Extract piety rewards as `kind: ability` records, linked to their god via `PART_OF` relation (deriver will handle this if `god` is a grouping attribute).

**Deriver config**: Add `god` to `GROUPING_ATTRIBUTES` in `scripts/run-stage-deriver.ts:40` to generate `PART_OF` relations from piety rewards to gods.

**Files**: `packages/extractors/crawl-extractor/src/` — add god and piety reward adapters.

### D2: Crawl brands and item types (medium priority)

Extract weapon brands from `dat/brand/*.yaml` as `kind: item` with `native_kind: brand`. The taxonomy does not have a dedicated `brand` or `enchantment` kind; `item` is the nearest canonical kind per RFC-0001 Principle 3 (hierarchical mapping with `native_kind` differentiation). Extract base item types from `dat/item-type/*.yaml` as `kind: item` with `native_kind: item_type`.

**Files**: `packages/extractors/crawl-extractor/src/` — add brand and item type adapters.

### D3: Crawl clouds (medium priority)

Extract cloud/effect definitions from `dat/clouds/*.yaml` as `kind: effect` with `native_kind: cloud`.

**Files**: `packages/extractors/crawl-extractor/src/` — add cloud adapter.

### D4: NetHack attack types and monster abilities (medium priority)

Extract attack types from `include/monattk.h` (C enum) as `kind: damage_type` with `native_kind: attack_type`, following the RFC-0001 mapping table. Extract monster abilities from `include/monflag.h` (C enum/flags) as `kind: ability` with `native_kind: monster_ability`.

**Files**: `packages/extractors/nethack-extractor/src/` — add attack type and monster ability adapters.

### D5: Cataclysm-BN martial arts (medium priority)

Extract martial arts from `data/json/martial/*.json` as `kind: ability` with `native_kind: martial_art`. Each JSON file defines a martial art with techniques, buffs, and requirements.

**Files**: `packages/extractors/cataclysm-bn-extractor/src/` — add martial arts adapter.

### D6: Cataclysm-BN NPC classes (low priority)

Extract NPC classes from `data/json/npc/*.json` as `kind: npc` with `native_kind: npc_class`, following the RFC-0001 mapping table.

**Files**: `packages/extractors/cataclysm-bn-extractor/src/` — add NPC class adapter.

### D7: Cataclysm-BN monster groups (low priority)

Extract monster groups from `data/json/monstergroups/*.json` as `kind: spawn_table` with `native_kind: monster_group`.

**Files**: `packages/extractors/cataclysm-bn-extractor/src/` — add monster group adapter.

### D8: Update coverage files

For each new data type extracted, add a coverage dimension to the game's coverage file with:
- `id`: dimension identifier (e.g., `gods`, `brands`, `attack_types`)
- `state`: `exhaustive_for_binding`
- `basis`: `extractor_population`
- `expected`: count from source survey
- `extracted`: count from extractor
- `notes`: description of what was counted

### D9: Re-run deriver and materializer

After all new data types are extracted:
1. Run deriver to generate claims, relations, and semantic records for new data
2. Run concept generation to create new cross-game concepts (e.g., "god/piety system" concept linking Crawl gods with NetHack roles)
3. Run materializer to update `dist/records.jsonl`
4. Rebuild Obsidian vault and web app

## Architectural fit

- **RFC-0001** (extraction methodology) — this RFC follows all 11 principles: one source object = one record (P1), factual extraction without loss (P2), canonical kind mapping declared in manifest (P3), evidence anchors (P4), population contracts (P5), composite data in attributes (P6), one extractor per game (P7). No taxonomy extensions are needed (P9) — all new data types map to existing canonical kinds.
- **game-content-taxonomy.yaml** — all proposed kind mappings use existing canonical kinds: `deity`, `ability`, `item`, `effect`, `damage_type`, `npc`, `spawn_table`. No new kinds are introduced.
- **extractor-sdk EntitySpec/EntityAdapter** — new adapters use the existing SDK pipeline. `EntitySpec.kind` maps to canonical kinds, `EntityAdapter.nativeKind` carries the game-local type name, `EntityAdapter.getAttributes` preserves native attributes.
- **Attribute Deriver** (`scripts/run-stage-deriver.ts`) — new records flow through the existing derivation pipeline. The only deriver change is adding `god` to `GROUPING_ATTRIBUTES` (line 40) to generate `PART_OF` relations from piety rewards to gods. No other deriver changes are needed.
- **Coverage files** (`knowledge/coverage/*.jsonl`) — new dimensions are added to existing coverage files with `exhaustive_for_binding` state and `extractor_population` basis.
- **Conformance tests** (`tests/conformance/c*.test.ts`) — each game's conformance test is updated with new population dimensions to verify `extracted == expected`.
- **RFC-0003** (design layer expansion) — new data types (especially Crawl gods) provide implementation references for the "Religion and God" design primitive.

## Design

### Kind mapping table (new data types)

| Game | Data type | Canonical kind | native_kind | RFC-0001 mapping |
|---|---|---|---|---|
| Crawl | Gods | `deity` | `god` | New (not in RFC-0001 table) |
| Crawl | Piety rewards | `ability` | `piety_reward` | New |
| Crawl | Brands | `item` | `brand` | New (no `brand` kind in taxonomy; `item` is nearest) |
| Crawl | Item types | `item` | `item_type` | New |
| Crawl | Clouds | `effect` | `cloud` | New |
| NetHack | Attack types | `damage_type` | `attack_type` | RFC-0001 line 239 |
| NetHack | Monster abilities | `ability` | `monster_ability` | New |
| Cataclysm-BN | Martial arts | `ability` | `martial_art` | New |
| Cataclysm-BN | NPC classes | `npc` | `npc_class` | RFC-0001 line 232 |
| Cataclysm-BN | Monster groups | `spawn_table` | `monster_group` | RFC-0001 line 229 |

### File system responsibilities

| Path | Role |
|---|---|
| `packages/extractors/crawl-extractor/src/extractor.ts` | Add god, piety reward, brand, item type, cloud specs to manifest and run() |
| `packages/extractors/crawl-extractor/src/yaml-parser.ts` | Add god, brand, item type, cloud YAML parsers |
| `packages/extractors/nethack-extractor/src/extractor.ts` | Add attack type, monster ability specs to manifest and run() |
| `packages/extractors/nethack-extractor/src/extra-parsers.ts` | Add attack type, monster ability C header parsers |
| `packages/extractors/cataclysm-bn-extractor/src/extractor.ts` | Add martial arts, NPC class, monster group specs to manifest and run() |
| `packages/extractors/cataclysm-bn-extractor/src/extra-json-parsers.ts` | Add martial arts, NPC class, monster group JSON parsers |
| `scripts/run-stage-deriver.ts:40` | Add `god` to `GROUPING_ATTRIBUTES` array |
| `knowledge/coverage/crawl.jsonl` | Add gods, piety_rewards, brands, item_types, clouds dimensions |
| `knowledge/coverage/nethack.jsonl` | Add attack_types, monster_abilities dimensions |
| `knowledge/coverage/cataclysm-bn.jsonl` | Add martial_arts, npc_classes, monster_groups dimensions |
| `tests/conformance/c09-crawl.test.ts` | Add new population dimension assertions |
| `tests/conformance/c10-cataclysm-bn.test.ts` | Add new population dimension assertions |
| `tests/conformance/c12-nethack.test.ts` | Add new population dimension assertions |

### Derived data impact estimate

Per RFC-0001 Principle 11, each new record with M attributes produces M claims plus grouping relations and semantic records. Estimated impact:

| Data type | Records | Avg attributes | Estimated claims | Estimated relations |
|---|---|---|---|---|
| Crawl gods | ~30 | ~10 | ~300 | ~60 (god grouping) |
| Crawl piety rewards | ~150 | ~5 | ~750 | ~150 (PART_OF god) |
| Crawl brands | ~30 | ~5 | ~150 | ~30 |
| Crawl item types | ~200 | ~8 | ~1,600 | ~400 |
| Crawl clouds | ~15 | ~5 | ~75 | ~15 |
| NetHack attack types | ~20 | ~2 | ~40 | ~0 |
| NetHack monster abilities | ~40 | ~3 | ~120 | ~20 |
| Cataclysm-BN martial arts | ~30 | ~8 | ~240 | ~60 |
| Cataclysm-BN NPC classes | ~50 | ~5 | ~250 | ~50 |
| Cataclysm-BN monster groups | ~50 | ~4 | ~200 | ~50 |
| **Total** | **~585** | — | **~3,725** | **~835** |

This is a conservative estimate — some data types (gods, item types) may have more attributes than estimated, producing more derived data.

## Rollout

- **Existing records are unaffected** — all new data types are additive. No existing records are modified, renamed, or deleted. Existing population contracts remain valid.
- **Existing extractors gain new specs** — each extractor's `run()` function adds new `EntitySpec` entries to its specs array. The `manifest.recordKinds` and `manifest.exhaustivePopulations` arrays are extended.
- **Deriver change is backward-compatible** — adding `god` to `GROUPING_ATTRIBUTES` only affects records that have a `god` attribute. Existing records without this attribute are unaffected.
- **Conformance tests are updated in the same commit** as the extractor changes — no grace period.
- **Coverage files are regenerated** after extraction — the new dimensions appear alongside existing ones.
- **Web app and Obsidian vault** are rebuilt in the final step. No code changes to either builder are needed — they already handle all canonical kinds generically. New kinds like `deity` and `damage_type` are already in the taxonomy and will be rendered by the existing templates.

## Alternatives considered

**A. Extract Crawl gods as `kind: profession`** — rejected because the taxonomy defines `deity` in the `society` category, which is a semantically correct fit. Using `profession` would misclassify gods as character-defining entities and break cross-game queries for deities.

**B. Skip low-priority data types (D6, D7)** — rejected because NPC classes (~50 records) and monster groups (~50 records) are small effort and provide cross-game comparison value. The total effort is ~1 hour for both.

**C. Create a new `brand` canonical kind** — rejected because the taxonomy does not need a dedicated kind for weapon enchantments. RFC-0001 Principle 3 says to use the nearest canonical kind with `native_kind` differentiation. `item` with `native_kind: brand` follows this rule.

**D. Extract BrogueCE sub-categories** — rejected because BrogueCE is nearly exhausted. The remaining data (runes, key items, staffs, wand effects) are sub-categories of already-extracted `kind: item` records. These would be attribute enrichments, not new record types.

## Implementation notes for agents

- Agents MAY implement extraction code changes ONLY when this RFC has status: `accepted` (or `implemented`).
- Agents MUST follow RFC-0001 Principle 3 for kind mapping — use the canonical kind from the taxonomy, differentiate via `native_kind`.
- Agents MUST declare population contracts for every new data dimension in the extractor manifest (RFC-0001 Principle 5).
- Agents MUST preserve all gameplay-relevant attributes in native form (RFC-0001 Principle 2).
- Agents MUST update conformance tests in the same commit as extractor changes — no grace period for test coverage.
- Agents MUST NOT normalize attributes across games during extraction (RFC-0001 Principle 2).
- Agents MUST NOT create sub-entity records for embedded references (RFC-0001 Principle 6).
- Agents MUST NOT propose new canonical kinds without an RFC (RFC-0001 Principle 9) — all data types in this RFC map to existing kinds.

## Implementation plan

### Phase 1: High-priority extractions

#### Step 1: Crawl gods and piety rewards (D1)

1. Survey `dat/gods/*.yaml` — count files, identify schema
2. Add `GodAdapter` to crawl-extractor: reads YAML, maps to `kind: deity`, `native_kind: god`
3. Add `PietyRewardAdapter`: reads ability definitions within god YAML, maps to `kind: ability`, `native_kind: piety_reward`
4. Add `god` to `GROUPING_ATTRIBUTES` in `scripts/run-stage-deriver.ts:40` (to create PART_OF relations from piety rewards to gods)
5. Add population contract for `gods` dimension
6. Update conformance test `tests/conformance/c09-crawl.test.ts` with new dimensions
7. Run extractor, verify record count matches file count
8. Run deriver, verify relations and claims are generated

**Estimated effort**: 2-3 hours (YAML parsing, similar to existing crawl adapters)

### Phase 2: Medium-priority extractions

#### Step 2: Crawl brands and item types (D2)

1. Survey `dat/brand/*.yaml` and `dat/item-type/*.yaml`
2. Add adapters for both
3. Add population contracts
4. Run extractor and deriver

**Estimated effort**: 1-2 hours (similar to existing YAML adapters)

#### Step 3: Crawl clouds (D3)

1. Survey `dat/clouds/*.yaml`
2. Add `CloudAdapter`: maps to `kind: effect`, `native_kind: cloud`
3. Add population contract
4. Run extractor and deriver

**Estimated effort**: 30 minutes (small file count)

#### Step 4: NetHack attack types and monster abilities (D4)

1. Survey `include/monattk.h` and `include/monflag.h`
2. Add `AttackTypeAdapter`: parses C enum, maps to `kind: damage_type`, `native_kind: attack_type`
3. Add `MonsterAbilityAdapter`: parses C flags, maps to `kind: ability`, `native_kind: monster_ability`
4. Add population contracts
5. Update conformance test `tests/conformance/c12-nethack.test.ts` with new dimensions
6. Run extractor and deriver

**Estimated effort**: 2 hours (C header parsing, similar to existing nethack adapters)

#### Step 5: Cataclysm-BN martial arts (D5)

1. Survey `data/json/martial/*.json`
2. Add `MartialArtAdapter`: reads JSON, maps to `kind: ability`, `native_kind: martial_art`
3. Add population contract
4. Run extractor and deriver

**Estimated effort**: 1 hour (JSON parsing, similar to existing cataclysm adapters)

### Phase 3: Low-priority extractions

#### Step 6: Cataclysm-BN NPC classes and monster groups (D6, D7)

1. Survey `data/json/npc/*.json` and `data/json/monstergroups/*.json`
2. Add adapters for both
3. Add population contracts
4. Update conformance test `tests/conformance/c10-cataclysm-bn.test.ts` with new dimensions
5. Run extractor and deriver

**Estimated effort**: 1 hour

### Phase 4: Integration

#### Step 7: Update coverage files (D8)

1. Add new dimensions to each game's coverage file
2. Verify all dimensions are `exhaustive_for_binding`
3. Update conformance tests with new population dimensions
4. Run conformance tests

#### Step 8: Re-run full pipeline (D9)

1. `pnpm exec tsx scripts/run-stage-deriver.ts` — regenerate all derived data
2. `pnpm exec tsx scripts/run-stage-concepts.ts` — regenerate concepts (new data may create new cross-game concepts)
3. `pnpm exec tsx scripts/run-stage-design.ts` — regenerate design primitives (update implementation_refs with new data)
4. `pnpm exec tsx scripts/run-materialize.ts` — re-materialize
5. `pnpm exec tsx scripts/run-build-obsidian.ts` — rebuild vault
6. `pnpm exec tsx scripts/run-build-web.ts` — rebuild web app
7. `pnpm exec vitest --run` — all tests pass

## Acceptance criteria

- [ ] Crawl gods extracted (~30 records, `kind: deity`)
- [ ] Crawl piety rewards extracted (~150 records, `kind: ability`)
- [ ] Crawl brands extracted (~30 records, `kind: item`)
- [ ] Crawl item types extracted (~200 records, `kind: item`)
- [ ] Crawl clouds extracted (~15 records, `kind: effect`)
- [ ] NetHack attack types extracted (~20 records, `kind: damage_type`)
- [ ] NetHack monster abilities extracted (~40 records, `kind: ability`)
- [ ] Cataclysm-BN martial arts extracted (~30 records, `kind: ability`)
- [ ] Cataclysm-BN NPC classes extracted (~50 records, `kind: npc`)
- [ ] Cataclysm-BN monster groups extracted (~50 records, `kind: spawn_table`)
- [ ] All new dimensions have coverage contracts with `exhaustive_for_binding` state
- [ ] Deriver generates claims and relations for all new data
- [ ] All conformance tests pass (no regressions)
- [ ] Knowledge base grows by ~600-700 records (from ~20,500 to ~21,100-21,200)

## Risks

- **Crawl god YAML schema variability**: Different god YAML files may have different schemas. Mitigation: survey all files before writing the adapter, handle optional fields gracefully.
- **NetHack C header complexity**: `monattk.h` and `monflag.h` may have complex preprocessor directives. Mitigation: reuse existing `CStructParser` from nethack-extractor.
- **Cataclysm-BN JSON schema drift**: Martial arts JSON may have nested structures or optional fields. Mitigation: preserve all fields in attributes, let deriver handle flattening.
- **Record count imbalance**: Adding ~200 Crawl records and ~80 NetHack records does not significantly rebalance vs 11,257 Cataclysm-BN records. Mitigation: this is expected — Cataclysm-BN genuinely has more data. Rebalancing is not a goal; comprehensive coverage is.
- **Agent misinterpretation**: agents may treat the kind mapping table as exhaustive and fail to map new data types not listed. The table is illustrative for this RFC's scope; RFC-0001 Principle 3 (check taxonomy, map to nearest kind, use `native_kind` for differentiation) is binding for any future data types.
- **Population count drift**: as game sources update, population `expected` values become stale. Mitigation: population contracts include a `description` field documenting how to count, enabling re-verification.
