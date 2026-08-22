# Handoff: Crawl Forms (C-4) + Crawl Abilities (C-2)

**Date**: 2026-08-22
**Session**: Crawl forms and abilities extraction
**Previous handoff**: `handoff-2026-08-22-crawl-spells-branches.md`

## Completed this session

### C-4: Crawl forms (35 records)
- **Source**: `dat/forms/*.yaml` (35 YAML files)
- **Parser**: `parseFormYaml` added to `yaml-parser.ts` — same YAML pattern as monsters/species/jobs
- **Canonical kind**: `mutation`
- **Native kind**: `FORM`
- **Population**: 35 (all YAML files in `dat/forms/`)
- **Attributes preserved**: description, equivalent_mons, short_name, long_name, talisman, skill, melds, str, dex, size, hp_mod, ac, ev, resists, fakemuts, badmuts, can_fly, can_swim, can_cast, is_badform, changes_anatomy, changes_substance, holiness, has_blood, has_hair, has_bones, has_feet, has_ears, unarmed, unarmed_colour, unarmed_name, unarmed_verbs, unarmed_brand, shout_verb, shout_volume, hand_name, foot_name, prayer_action, flesh_name, move_speed, offhand_punch, special_damage, special_damage_name, body_ac_mult, wiz_name
- **Tests**: `tests/extract/extract-crawl-forms.test.ts` (10 tests)

### C-2: Crawl abilities (216 records)
- **Source**: `ability-type.h` (C enum `ability_type`)
- **Parser**: `parseAbilityTypes` rewritten in `c-struct-parser.ts` — handles C enum with preprocessor directives
- **Canonical kind**: `ability`
- **Native kind**: `ABILITY`
- **Population**: 216 (all `ABIL_*` enum entries, TAG_MAJOR_VERSION == 34, excluding aliases, sentinels, and WIZARD-only entries)
- **Key decisions**:
  - `#ifdef WIZARD` blocks are excluded (treated as undefined macro → false)
  - `#ifndef` blocks are included (treated as true)
  - Alias entries (e.g., `ABIL_MIN_EVOKE = ABIL_EVOKE_BERSERK`) are skipped
  - Sentinel entries (`ABIL_NON_ABILITY`, `NUM_ABILITIES`) are skipped
  - `ability-type.h` is copied into `dat/` for evidence artifacts (same pattern as `spl-data.h` and `branch-data.h`)
  - `preprocessCSource` in `c-struct-parser.ts` updated to handle `#ifdef`/`#ifndef`
- **Tests**: `tests/extract/extract-crawl-abilities.test.ts` (13 tests)

## Test results
- **94/94 quality tests pass** (pre-commit requirement)
- **119/119 extract tests pass** (including 23 new tests)
- Conformance fingerprint mismatch is pre-existing (caused by previous session's header copies into `dat/`)

## Files changed
- `packages/extractors/crawl-extractor/src/yaml-parser.ts` — added `FormEntry` interface + `parseFormYaml`
- `packages/extractors/crawl-extractor/src/c-struct-parser.ts` — rewrote `parseAbilityTypes`, added `#ifdef`/`#ifndef` to `preprocessCSource`, updated `AbilityEntry` interface
- `packages/extractors/crawl-extractor/src/extractor.ts` — added `formSpec`, `abilitySpec`, wired into pipeline, updated manifest (recordKinds, exhaustivePopulations)
- `packages/extractors/crawl-extractor/src/index.ts` — exported `parseFormYaml`, `FormEntry`, `parseAbilityTypes`, `AbilityEntry`
- `tests/extract/extract-crawl-forms.test.ts` — new (10 tests)
- `tests/extract/extract-crawl-abilities.test.ts` — new (13 tests)

## PLAN-002 progress

### Completed (6/18)
- Q-1: Coverage files already updated
- Q-2: PLAN-001 status already implemented
- C-1: Crawl spells (418 records from spl-data.h)
- C-3: Crawl branches (41 records from branch-data.h)
- C-4: Crawl forms (35 records from dat/forms/*.yaml)
- C-2: Crawl abilities (216 records from ability-type.h)

### Remaining (12 tasks)

#### NetHack (6 tasks):
- N-1: artifacts — `include/artilist.h`, C macro array `A()`, 36 entries
- N-2: traps — `include/trap.h`, C enum, ~20 entries
- N-3: roles — `include/you.h` + `src/role.c`, C struct, ~13 entries
- N-4: races — `include/you.h` + `src/role.c`, C struct, ~5 entries
- N-5: dungeon branches — `include/dungeon.h` + `dat/dungeon.dat`, ~10 entries
- N-6: skills — `include/skills.h`, C enum `P_*`, 12 entries

#### Cataclysm-BN (6 tasks):
- CB-1: bionics — `data/json/bionics/*.json`, ~100+ entries
- CB-2: traps — `data/json/traps.json`, ~30+ entries
- CB-3: recipes — `data/json/recipes/*.json`, ~500+ entries
- CB-4: skills — `data/json/skills/*.json`, ~20+ entries
- CB-5: effects — `data/json/effects/*.json`, ~50+ entries
- CB-6: factions — `data/json/factions/*.json`, ~30+ entries

## Next priority per plan
1. NetHack tasks (N-1 through N-6) — requires creating a NetHack extractor package
2. Cataclysm-BN tasks (CB-1 through CB-6) — extends existing cataclysm-bn-extractor

## Key technical context for next agent
- **Crawl source root**: `/home/syrokomskyi/projects/roguelike-games-ib-source/crawl/crawl-ref/source/dat`
- **TAG_MAJOR_VERSION**: 34
- **Pre-commit hook**: `scripts/pre-commit-quality.sh` runs quality tests (~2 min), all 94 must pass
- **C-struct-parser.ts** has reusable functions: `preprocessCSource`, `extractEntries`, `parseEntryFields` — can be reused for NetHack C parsing
- **NetHack source root**: check `knowledge/manifest.yaml` or `scripts/run-stage*-nethack.ts` for path
- **Cataclysm-BN source root**: check existing `cataclysm-bn-extractor` package
- Use `fo-create-extractor` skill when creating new extractor packages (per AGENTS.md)
- Follow RFC-0001 extraction methodology (one source object = one record, evidence anchors, population completeness)
