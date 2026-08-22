---
id: PLAN-002
title: Remaining extraction work — all games coverage expansion
status: closed
scope: project-wide
decider: architecture
reviewers:
  - human:andrii-syrokomskyi
related:
  - RFC-0001
  - ADR-0005
  - ADR-0006
  - PLAN-001
created: 2026-08-22
accepted: 2026-08-22
implementedAt: 2026-08-23
closedAt: 2026-08-23
---

# PLAN-002: Remaining extraction work — all games coverage expansion

## Context

RFC-0001 methodology is established (implemented). ADR-0007 brogueCE kind remap is done. PLAN-001 (Crawl vaults) is implemented. This plan covers all remaining extraction work to maximize knowledge base coverage across the four current game sources.

## Current extraction state

| Game | Records | Kinds extracted | Kinds remaining |
|---|---|---|---|
| brogueCE | 681 | creature, terrain, item, feature, mutation, spawn_table, status_effect, trait, ability, other_definition | — (fully extracted) |
| cataclysm-bn | 11,157 | creature, item, mutation, profession, ability, trap, recipe, skill, effect, faction | — (fully extracted) |
| crawl | 7,000 | creature, species, profession, vault, spell, branch, mutation, ability | — (fully extracted) |
| nethack | 952 | creature, item, artifact, trap, class, species, branch, skill | — (fully extracted) |

## Quick wins (immediate)

### Q-1: Update coverage files

Coverage JSONL files don't include Crawl vaults dimension. Run `scripts/run-stage-coverage.ts` to regenerate.

**Effort**: 1 command
**Files**: `knowledge/coverage/crawl.jsonl`

### Q-2: Update PLAN-001 status to implemented

PLAN-001 is fully implemented but still has `status: accepted` in frontmatter.

**Effort**: 1 edit

## Extraction tasks

### Crawl — 3 new data types

#### C-1: Crawl spells

- **Source**: `spl-data.h` — C struct array `spelldata[]`
- **Population**: ~418 entries (lines starting with `SPELL_`)
- **Canonical kind**: `spell` (abilities_character)
- **Parser**: C struct parser, similar to `c-parser.ts` in brogueCE
- **Attributes**: schools, flags, level, power_cap, min_range, max_range, effect_noise, tile

#### C-2: Crawl abilities

- **Source**: `ability.h` + `ability-type.h` — ability type enum + ability flags
- **Population**: ~50 entries (ability types in enum)
- **Canonical kind**: `ability` (abilities_character)
- **Parser**: C enum parser
- **Attributes**: flags, hotkey, fail_rate, is_invocation

#### C-3: Crawl branches

- **Source**: `branch-data.h` — C struct array `branches[]`
- **Population**: ~43 entries (lines with `{ BRANCH_`)
- **Canonical kind**: `branch` (world)
- **Parser**: C struct parser
- **Attributes**: parent_branch, mindepth, maxdepth, depth, absdepth, flags, short_name, long_name, abbrev, floor_colour, rock_colour, travel_shortcut, runes, ambient_noise

#### C-4: Crawl forms (transformations)

- **Source**: `dat/forms/*.yaml` — 35 YAML files
- **Population**: ~35 entries
- **Canonical kind**: `mutation` (abilities_character) — forms are transformation mutations
- **Parser**: YAML parser, similar to existing `yaml-parser.ts`
- **Attributes**: badmuts, weight, duration, hp_mod, ac_mod, ev_mod, sh_mod, speed_mod, etc.

### Cataclysm-BN — 6 new data types

#### CB-1: Cataclysm-BN bionics

- **Source**: `data/json/bionics/*.json` — 8 JSON files
- **Population**: ~100+ entries (bionic definitions across files)
- **Canonical kind**: `ability` (abilities_character) — bionics are installed abilities
- **Parser**: JSON parser, similar to existing cataclysm-bn parser
- **Attributes**: name, description, capacity, weight, flags, difficulty, installation_data, fake_item

#### CB-2: Cataclysm-BN traps

- **Source**: `data/json/traps.json` or similar — 7 JSON files
- **Population**: ~30+ entries
- **Canonical kind**: `trap` (world)
- **Parser**: JSON parser
- **Attributes**: name, description, color, symbol, visibility, difficulty, action_flags, etc.

#### CB-3: Cataclysm-BN recipes

- **Source**: `data/json/recipes/*.json` — 60 JSON files
- **Population**: ~500+ entries (recipes across files)
- **Canonical kind**: `recipe` (economy)
- **Parser**: JSON parser
- **Attributes**: result, type, category, subtype, time, difficulty, skills, tools, components, charges, etc.

#### CB-4: Cataclysm-BN skills

- **Source**: `data/json/skills/*.json` — 2 JSON files
- **Population**: ~20+ entries
- **Canonical kind**: `skill` (abilities_character)
- **Parser**: JSON parser
- **Attributes**: name, description, display_order, category, time_to_learn, etc.

#### CB-5: Cataclysm-BN effects (status effects)

- **Source**: `data/json/effects/*.json` — 6 JSON files
- **Population**: ~50+ entries
- **Canonical kind**: `effect` (simulation) or `status_effect` (simulation)
- **Parser**: JSON parser
- **Attributes**: name, description, max_intensity, decay_rate, flags, etc.

#### CB-6: Cataclysm-BN factions

- **Source**: `data/json/factions/*.json` — 3 JSON files
- **Population**: ~30+ entries
- **Canonical kind**: `faction` (society)
- **Parser**: JSON parser
- **Attributes**: name, description, likes, dislikes, attitude, base_rank, etc.

### NetHack — 6 new data types

#### N-1: NetHack artifacts

- **Source**: `include/artilist.h` — C macro array `A()`
- **Population**: 36 entries
- **Canonical kind**: `artifact` (objects)
- **Parser**: C macro parser, similar to existing nethack parser
- **Attributes**: name, prop_mask, alignment, role, race, gender, attack_type, etc.

#### N-2: NetHack traps

- **Source**: `include/trap.h` — C enum + trap definitions
- **Population**: ~20 entries (trap type defines)
- **Canonical kind**: `trap` (world)
- **Parser**: C enum parser
- **Attributes**: name, is_magical, is_visible, etc.

#### N-3: NetHack roles (classes)

- **Source**: `include/you.h` + `src/role.c` — role struct definitions
- **Population**: ~13 entries (Barbarian, Caveman, Healer, Knight, Monk, Priest, Rogue, Ranger, Samurai, Tourist, Valkyrie, Wizard, Samurai)
- **Canonical kind**: `class` (abilities_character)
- **Parser**: C struct parser
- **Attributes**: name, rank_names, hitdie, energydie, align, str, int, dex, con, cha, san, etc.

#### N-4: NetHack races

- **Source**: `include/you.h` + `src/role.c` — race struct definitions
- **Population**: ~5 entries (human, elf, dwarf, gnome, orc)
- **Canonical kind**: `species` (abilities_character)
- **Parser**: C struct parser
- **Attributes**: name, noun, adj, hitdie, energydie, align, str, int, dex, con, cha, san, etc.

#### N-5: NetHack dungeon branches

- **Source**: `include/dungeon.h` + `dat/dungeon.dat` — branch definitions
- **Population**: ~10 entries (main, mines, gehennom, knox, sokoban, quest, astral, etc.)
- **Canonical kind**: `branch` (world)
- **Parser**: C struct / data file parser
- **Attributes**: name, dnum, levels, parent_branch, entry_ stairs, etc.

#### N-6: NetHack skills

- **Source**: `include/skills.h` — C enum `P_*` defines
- **Population**: 12 entries (bare hands, dagger, sword, etc.)
- **Canonical kind**: `skill` (abilities_character)
- **Parser**: C enum parser
- **Attributes**: name, category, max_level, etc.

## Execution order

Priority based on impact (record count) and ease (format familiarity):

1. **Q-1**: Update coverage files (1 min)
2. **Q-2**: Update PLAN-001 status (1 min)
3. **C-1**: Crawl spells — 418 records, C struct parser (familiar pattern)
4. **C-3**: Crawl branches — 43 records, C struct parser
5. **C-4**: Crawl forms — 35 records, YAML parser (familiar pattern)
6. **C-2**: Crawl abilities — ~50 records, C enum parser
7. **N-1**: NetHack artifacts — 36 records, C macro parser (familiar pattern)
8. **N-3**: NetHack roles — ~13 records, C struct parser
9. **N-4**: NetHack races — ~5 records, C struct parser
10. **N-2**: NetHack traps — ~20 records, C enum parser
11. **N-6**: NetHack skills — 12 records, C enum parser
12. **N-5**: NetHack branches — ~10 records, data file parser
13. **CB-1**: Cataclysm-BN bionics — ~100+ records, JSON parser (familiar pattern)
14. **CB-3**: Cataclysm-BN recipes — ~500+ records, JSON parser
15. **CB-2**: Cataclysm-BN traps — ~30+ records, JSON parser
16. **CB-5**: Cataclysm-BN effects — ~50+ records, JSON parser
17. **CB-6**: Cataclysm-BN factions — ~30+ records, JSON parser
18. **CB-4**: Cataclysm-BN skills — ~20+ records, JSON parser

After each game's tasks complete: re-extract that game + re-run deriver.

## Acceptance criteria

- [x] Coverage files updated with Crawl vaults dimension
- [x] PLAN-001 status updated to implemented
- [x] Crawl: spells, abilities, branches, forms extracted and passing conformance
- [x] Cataclysm-BN: bionics, traps, recipes, skills, effects, factions extracted and passing conformance
- [x] NetHack: artifacts, traps, roles, races, branches, skills extracted and passing conformance
- [x] All conformance tests pass (no regressions) — 590/590 pass (Crawl fingerprint fixed)
- [x] Deriver re-run after all extractions
- [x] Coverage files updated for all games

## Risks

- **C struct parsing complexity**: Crawl `spl-data.h` and `branch-data.h` have nested struct initializers. Parser must handle multi-line entries with brace matching (similar to brogueCE `dungeonFeatureCatalog` parser).
- **Cataclysm-BN recipe volume**: ~500+ recipes may add significant extraction time. Should stay under 10s conformance budget.
- **NetHack role/race struct complexity**: `role.c` uses macro-based definitions that may require custom parsing logic.
- **Population accuracy**: All population denominators must be exact — off-by-one errors will fail quality tests.
