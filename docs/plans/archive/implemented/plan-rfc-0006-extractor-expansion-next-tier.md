---
id: PLAN-004
title: Extractor expansion — next-tier data types for all four games
status: accepted
scope: project-wide
decider: architecture
reviewers:
  - human:andrii-syrokomskyi
related:
  - RFC-0006
  - RFC-0001
  - PLAN-002
  - PLAN-003
created: 2026-08-23
accepted: 2026-08-23
implementedAt:
closedAt: null
---

# PLAN-004: Extractor expansion — next-tier data types for all four games

## Context

RFC-0006 is accepted. This plan implements the next-tier extraction of ~585 new records across Crawl, NetHack, and Cataclysm-BN. All new data types map to existing canonical kinds (no taxonomy extensions). The deriver needs one config change (`god` grouping attribute). Conformance tests and coverage files are updated in lockstep with extractor changes.

## Acceptance criteria (from RFC-0006)

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

## Steps

### Step 1: Crawl gods and piety rewards (D1)

**Files**: `packages/extractors/crawl-extractor/src/yaml-parser.ts`, `packages/extractors/crawl-extractor/src/extractor.ts`, `packages/extractors/crawl-extractor/src/index.ts`, `scripts/run-stage-deriver.ts`

1. Survey `dat/gods/*.yaml` in the Crawl source — count files, identify YAML schema (fields like `name`, `piety_gain`, `piety_loss`, `abilities`, `favours`)
2. Add `GodEntry` type and `parseGodYaml()` to `yaml-parser.ts` — one entry per YAML file
3. Add `PietyRewardEntry` type and `parsePietyRewards()` — extract ability definitions from within god YAML files
4. Add `godSpec()` and `pietyRewardSpec()` to `extractor.ts` — map gods to `kind: deity` / `native_kind: god`, piety rewards to `kind: ability` / `native_kind: piety_reward`
5. Add `deity` and `ability` to `manifest.recordKinds` (if `deity` not already present)
6. Add `gods` and `piety_rewards` to `manifest.exhaustivePopulations` with expected counts from survey
7. Wire new specs into `run()` function's specs array
8. Export new parsers from `index.ts`
9. Add `god` to `GROUPING_ATTRIBUTES` in `scripts/run-stage-deriver.ts:40`
10. Update `tests/conformance/c13-crawl.test.ts` — add population count assertions for `gods` and `piety_rewards` dimensions
11. Run extractor, verify record counts match file counts

**Completion criterion**: `pnpm exec vitest --run tests/conformance/c13-crawl.test.ts` passes with new population assertions. Extractor produces ~30 god records and ~150 piety reward records.

### Step 2: Crawl brands and item types (D2)

**Files**: `packages/extractors/crawl-extractor/src/yaml-parser.ts`, `packages/extractors/crawl-extractor/src/extractor.ts`, `packages/extractors/crawl-extractor/src/index.ts`

1. Survey `dat/brand/*.yaml` and `dat/item-type/*.yaml` in the Crawl source
2. Add `BrandEntry` type and `parseBrandYaml()` to `yaml-parser.ts`
3. Add `ItemTypeEntry` type and `parseItemTypeYaml()` to `yaml-parser.ts`
4. Add `brandSpec()` and `itemTypeSpec()` to `extractor.ts` — both map to `kind: item` with `native_kind: brand` / `native_kind: item_type`
5. Add `brands` and `item_types` to `manifest.exhaustivePopulations`
6. Wire new specs into `run()`
7. Export new parsers from `index.ts`
8. Update `tests/conformance/c13-crawl.test.ts` — add population count assertions for `brands` and `item_types`
9. Run extractor, verify record counts

**Completion criterion**: `pnpm exec vitest --run tests/conformance/c13-crawl.test.ts` passes. Extractor produces ~30 brand records and ~200 item type records.

### Step 3: Crawl clouds (D3)

**Files**: `packages/extractors/crawl-extractor/src/yaml-parser.ts`, `packages/extractors/crawl-extractor/src/extractor.ts`, `packages/extractors/crawl-extractor/src/index.ts`

1. Survey `dat/clouds/*.yaml` in the Crawl source
2. Add `CloudEntry` type and `parseCloudYaml()` to `yaml-parser.ts`
3. Add `cloudSpec()` to `extractor.ts` — maps to `kind: effect` / `native_kind: cloud`
4. Add `effect` to `manifest.recordKinds` (if not already present)
5. Add `clouds` to `manifest.exhaustivePopulations`
6. Wire new spec into `run()`
7. Export new parser from `index.ts`
8. Update `tests/conformance/c13-crawl.test.ts` — add population count assertion for `clouds`
9. Run extractor, verify record counts

**Completion criterion**: `pnpm exec vitest --run tests/conformance/c13-crawl.test.ts` passes. Extractor produces ~15 cloud records.

### Step 4: NetHack attack types and monster abilities (D4)

**Files**: `packages/extractors/nethack-extractor/src/extra-parsers.ts`, `packages/extractors/nethack-extractor/src/extractor.ts`, `packages/extractors/nethack-extractor/src/index.ts`

1. Survey `include/monattk.h` and `include/monflag.h` in the NetHack source
2. Add `AttackTypeEntry` type and `parseAttackTypes()` to `extra-parsers.ts` — parse C enum from `monattk.h`, map to `kind: damage_type` / `native_kind: attack_type`
3. Add `MonsterAbilityEntry` type and `parseMonsterAbilities()` to `extra-parsers.ts` — parse C flags from `monflag.h`, map to `kind: ability` / `native_kind: monster_ability`
4. Add `damage_type` and `ability` to `manifest.recordKinds` (if not already present)
5. Add `attack_types` and `monster_abilities` to `manifest.exhaustivePopulations`
6. Add spec builders and wire into `run()`
7. Export new parsers from `index.ts`
8. Update `tests/conformance/c12-nethack.test.ts` — add population count assertions for `attack_types` and `monster_abilities`
9. Run extractor, verify record counts

**Completion criterion**: `pnpm exec vitest --run tests/conformance/c12-nethack.test.ts` passes. Extractor produces ~20 attack type records and ~40 monster ability records.

### Step 5: Cataclysm-BN martial arts (D5)

**Files**: `packages/extractors/cataclysm-bn-extractor/src/extra-json-parsers.ts`, `packages/extractors/cataclysm-bn-extractor/src/extractor.ts`, `packages/extractors/cataclysm-bn-extractor/src/index.ts`

1. Survey `data/json/martial/*.json` in the Cataclysm-BN source
2. Add `MartialArtEntry` type and `parseMartialArtJson()` to `extra-json-parsers.ts` — map to `kind: ability` / `native_kind: martial_art`
3. Add `martial_arts` to `manifest.exhaustivePopulations`
4. Add spec builder and wire into `run()`
5. Export new parser from `index.ts`
6. Update `tests/conformance/c10-cataclysm-bn.test.ts` — add population count assertion for `martial_arts`
7. Run extractor, verify record counts

**Completion criterion**: `pnpm exec vitest --run tests/conformance/c10-cataclysm-bn.test.ts` passes. Extractor produces ~30 martial art records.

### Step 6: Cataclysm-BN NPC classes and monster groups (D6, D7)

**Files**: `packages/extractors/cataclysm-bn-extractor/src/extra-json-parsers.ts`, `packages/extractors/cataclysm-bn-extractor/src/extractor.ts`, `packages/extractors/cataclysm-bn-extractor/src/index.ts`

1. Survey `data/json/npc/*.json` and `data/json/monstergroups/*.json` in the Cataclysm-BN source
2. Add `NpcClassEntry` type and `parseNpcClassJson()` to `extra-json-parsers.ts` — map to `kind: npc` / `native_kind: npc_class`
3. Add `MonsterGroupEntry` type and `parseMonsterGroupJson()` to `extra-json-parsers.ts` — map to `kind: spawn_table` / `native_kind: monster_group`
4. Add `npc` and `spawn_table` to `manifest.recordKinds` (if not already present)
5. Add `npc_classes` and `monster_groups` to `manifest.exhaustivePopulations`
6. Add spec builders and wire into `run()`
7. Export new parsers from `index.ts`
8. Update `tests/conformance/c10-cataclysm-bn.test.ts` — add population count assertions for `npc_classes` and `monster_groups`
9. Run extractor, verify record counts

**Completion criterion**: `pnpm exec vitest --run tests/conformance/c10-cataclysm-bn.test.ts` passes. Extractor produces ~50 NPC class records and ~50 monster group records.

### Step 7: Update coverage files (D8)

**Files**: `knowledge/coverage/crawl.jsonl`, `knowledge/coverage/nethack.jsonl`, `knowledge/coverage/cataclysm-bn.jsonl`

1. Add new dimensions to `crawl.jsonl`: `gods`, `piety_rewards`, `brands`, `item_types`, `clouds`
2. Add new dimensions to `nethack.jsonl`: `attack_types`, `monster_abilities`
3. Add new dimensions to `cataclysm-bn.jsonl`: `martial_arts`, `npc_classes`, `monster_groups`
4. All dimensions: `state: exhaustive_for_binding`, `basis: extractor_population`, `expected` = count from extractor, `extracted` = count from extractor
5. Run conformance tests to verify coverage matches

**Completion criterion**: All three coverage files have new dimensions with `extracted == expected`. `pnpm exec vitest --run tests/conformance/` passes.

### Step 8: Re-run full pipeline (D9)

1. `pnpm exec tsx scripts/run-stage-deriver.ts` — regenerate all derived data (claims, relations, semantic records)
2. `pnpm exec tsx scripts/run-stage-concepts.ts` — regenerate concepts (new data may create new cross-game concepts)
3. `pnpm exec tsx scripts/run-stage-design.ts` — regenerate design primitives (update implementation_refs with new data)
4. `pnpm exec tsx scripts/run-materialize.ts` — re-materialize
5. `pnpm exec tsx scripts/run-build-obsidian.ts` — rebuild vault
6. `pnpm exec tsx scripts/run-build-web.ts` — rebuild web app
7. `pnpm exec vitest --run` — all tests pass

**Completion criterion**: All pipeline scripts complete without errors. `pnpm exec vitest --run` passes (0 failures). Knowledge base has ~21,100-21,200 definition records.

### Step 9: Review and fix

1. Run `fo-review` on all session code changes
2. If review has findings, run `fo-fix` to address them
3. Re-run `pnpm exec vitest --run` to verify no regressions from fixes

**Completion criterion**: Review report exists in `docs/reviews/code/`. All review findings addressed. Test suite passes.

### Step 10: Stamp implemented

1. Run `pnpm exec forge rfc.implement.stamp --id RFC-0006 --implementation-commit <sha>`
2. Verify RFC-0006 status transitions to `implemented`

**Completion criterion**: `rfc.validate --id RFC-0006 --json` shows `status: implemented`.

## Validation suite

| Check | Command | When |
|---|---|---|
| Conformance (Crawl) | `pnpm exec vitest --run tests/conformance/c13-crawl.test.ts` | After steps 1-3 |
| Conformance (NetHack) | `pnpm exec vitest --run tests/conformance/c12-nethack.test.ts` | After step 4 |
| Conformance (Cataclysm-BN) | `pnpm exec vitest --run tests/conformance/c10-cataclysm-bn.test.ts` | After steps 5-6 |
| Full test suite | `pnpm exec vitest --run` | After step 8 |
| RFC validation | `pnpm exec forge rfc.validate --id RFC-0006 --json` | After step 10 |

## Evidence strategy

- Population count assertions in conformance tests serve as machine-checkable evidence
- Coverage files with `extracted == expected` serve as completeness evidence
- `git diff` of extractor manifests shows new `recordKinds` and `exhaustivePopulations`
- Deriver output (claims, relations) demonstrates the derivation pipeline processes new records

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Crawl god YAML schema variability | Survey all files before writing adapter; handle optional fields gracefully |
| NetHack C header complexity | Reuse existing `CStructParser` patterns from `extra-parsers.ts` |
| Cataclysm-BN JSON schema drift | Preserve all fields in attributes; let deriver handle flattening |
| Conformance test count mismatches | Update expected counts after survey, before running tests |
