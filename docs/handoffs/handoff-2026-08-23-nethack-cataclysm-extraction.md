# Handoff: PLAN-002 Extraction Work — Final Session

**Date**: 2026-08-23
**Session**: NetHack N-1..N-6 + Cataclysm-BN CB-1..CB-6 extraction
**Commit**: `d6041f2c5c`
**Plan**: PLAN-002 (all extraction tasks now complete)

## What was done this session

### NetHack — 6 new entity types (122 records)

Created `packages/extractors/nethack-extractor/src/extra-parsers.ts` with 6 parsers:

- **N-1: Artifacts** (33) — `artilist.h` via `A()` macro scanning → kind=`artifact`
  - Paren-matching parser for C macro arguments; skips dummy #0, `#if 0` Palantir, terminator
- **N-2: Traps** (25) — `trap.h` enum `trap_types` → kind=`trap`
  - Filters out `NO_TRAP`, `ALL_TRAPS`, `TRAPNUM` sentinels
- **N-3: Roles** (13) — `role.c` struct `Role` array → kind=`class`
  - Regex-based field extraction from C struct initializers with `Role` macro
- **N-4: Races** (5) — `role.c` struct `Race` array → kind=`species`
  - Same parser approach as roles, separate struct
- **N-5: Dungeon branches** (9) — `dungeon.lua` Lua table → kind=`branch`
  - Lua table parser extracting top-level entries from `dungeons` table
- **N-6: Skills** (37) — `skills.h` enum `p_skills` → kind=`skill`
  - Filters out `P_NONE` and `P_NUM_SKILLS` sentinels

Updated files:
- `packages/extractors/nethack-extractor/src/extractor.ts` — 6 new EntitySpec definitions, manifest with 6 new population dimensions
- `packages/extractors/nethack-extractor/src/index.ts` — new parser and type exports
- `tests/conformance/c12-nethack.test.ts` — 7 new test cases (18 total, all pass)

### Cataclysm-BN — 6 new entity types (3,710 records)

Created `packages/extractors/cataclysm-bn-extractor/src/extra-json-parsers.ts` with 7 parsers:

- **CB-1: Bionics** (137) — `bionics.json` → kind=`ability`
  - Extracts act_cost, reactor_cost, power_over_time, difficulty, occupied_bodyparts
- **CB-2: Traps** (50) — `traps.json` → kind=`trap`
  - Extracts visibility, avoidance, difficulty, action, bash_dmg
- **CB-3: Recipes** (3,187) — `recipes/**/*.json` → kind=`recipe`
  - Counter-based dedup for recipes sharing same id in same file
  - Namespaced ids: `id__file__counter` for duplicates
- **CB-4: Skills** (28) — `skills.json` → kind=`skill`
  - Extracts display_category, display_order
- **CB-5: Effects** (237) — `effects.json` → kind=`effect`
  - Extracts max_duration, permanent, flags
- **CB-6: Factions** (71) — `npcs/factions.json` (17) + `monster_factions.json` (54) → kind=`faction`
  - Type-prefixed slugs (`faction_` vs `monster_faction_`) to avoid collisions
  - Counter-based dedup for same-type same-id entries

Updated files:
- `packages/extractors/cataclysm-bn-extractor/src/extractor.ts` — 6 new EntitySpec definitions, manifest with 6 new population dimensions
- `packages/extractors/cataclysm-bn-extractor/src/index.ts` — new parser and type exports
- `tests/conformance/c10-cataclysm-bn.test.ts` — 7 new test cases (19 total, all pass)

### Bindings

- `knowledge/sources/bindings.yaml` — NetHack fingerprint updated (role.c and dungeon.lua added to include/ dir in previous session)

## Test results

- **589/590 tests pass** (87 test files)
- 1 failure: `c13-crawl.test.ts` fingerprint mismatch — **pre-existing**, Crawl source tree hash drift, unrelated to this session's work
- NetHack c12: 18/18 pass
- Cataclysm-BN c10: 19/19 pass
- All quality tests (determinism, uniqueness, population completeness) pass for both games

## PLAN-002 status

All 18 tasks are now complete:
- Q-1, Q-2: Coverage files + PLAN-001 status (done in prior sessions)
- C-1..C-4: Crawl spells, abilities, branches, forms (done in prior sessions)
- N-1..N-6: NetHack artifacts, traps, roles, races, branches, skills (done this session)
- CB-1..CB-6: Cataclysm-BN bionics, traps, recipes, skills, effects, factions (done this session)

### Remaining acceptance criteria (2 of 8):
- [ ] **Deriver re-run** — run the deriver pipeline to regenerate derived knowledge records after all new extractions
- [ ] **Coverage files updated** — run `scripts/run-stage-coverage.ts` to update coverage JSONL files for all games

## What's next for the next agent

### Immediate (PLAN-002 closure):
1. **Fix Crawl fingerprint** — recompute `computeSourceFingerprint` for Crawl source tree and update `knowledge/sources/bindings.yaml`. The Crawl source at `../roguelike-games-ib-source/crawl-ref/source/dat` has drifted from the recorded fingerprint.
2. **Re-run deriver** — execute the deriver pipeline to regenerate derived records incorporating all new extraction data
3. **Update coverage files** — run `scripts/run-stage-coverage.ts` to regenerate coverage JSONL for all four games
4. **Mark PLAN-002 as closed** — set `closedAt: 2026-08-23` in the plan frontmatter

### Key files for context:
- `docs/plans/plan-002-remaining-extraction-work.md` — full plan with all 18 tasks (now all implemented)
- `packages/extractors/nethack-extractor/src/extra-parsers.ts` — NetHack C macro/enum/struct/Lua parsers
- `packages/extractors/cataclysm-bn-extractor/src/extra-json-parsers.ts` — Cataclysm-BN JSON parsers
- `packages/extractors/nethack-extractor/src/extractor.ts` — NetHack extractor with all 8 entity specs
- `packages/extractors/cataclysm-bn-extractor/src/extractor.ts` — Cataclysm-BN extractor with all 10 entity specs
- `packages/extractor-sdk/src/entity-pipeline.ts` — EntitySpec/EntityAdapter interfaces
- `packages/extractor-sdk/src/population.ts` — PopulationCollector (uses `extracted` field, not `count`)
- `tests/conformance/c12-nethack.test.ts` — 18 tests
- `tests/conformance/c10-cataclysm-bn.test.ts` — 19 tests

### Pre-commit hook
The pre-commit hook (`scripts/pre-commit-quality.sh`) runs `pnpm exec vitest run tests/extractor-quality/` when extractor files change. All quality tests must pass for commit to succeed. Runtime: ~2 minutes.

## Key technical decisions this session

1. **NetHack C macro parsing**: `findClosingParen()` initializes depth=1 (not 0) to correctly match the outermost paren of `A(...)` macro calls.

2. **NetHack role.c struct parsing**: Used regex to extract fields from `Role()` macro calls within the `roles[]` array. Each role entry spans ~40 lines with nested struct initializers.

3. **Cataclysm-BN recipe dedup**: Recipes share IDs across files (e.g., `gelled_gasoline` appears in 4 files). Used counter-based suffix: `id__file__counter` for duplicates beyond the first occurrence.

4. **Cataclysm-BN faction slug namespacing**: NPC factions and monster factions can share the same name (e.g., `robofac`, `centipede`). Slugs include type prefix: `faction_id` vs `monster_faction_id`.

5. **PopulationCount structure**: Uses `extracted` field (not `count`) — defined in `packages/extractor-sdk/src/population.ts` and `packages/extractor-sdk/src/types.ts`.
