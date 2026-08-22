# Handoff: PLAN-002 Extraction Work

**Date**: 2026-08-22
**Session**: Crawl spells & branches extraction
**Commit**: `e4a25ca09e`

## What was done this session

### C-1: Crawl spells (DONE)
- Parsed 418 spell entries from `spl-data.h` (C struct array `spelldata[]`)
- Parser: `packages/extractors/crawl-extractor/src/c-struct-parser.ts`
- Functions: `parseSpellData()`, `extractEntries()`, `preprocessCSource()`
- Integrated into extractor pipeline with `spellSpec()` entity spec
- Population contract: 418 (verified passing quality tests)

### C-3: Crawl branches (DONE)
- Parsed 41 branch entries from `branch-data.h` (C struct array `branches[NUM_BRANCHES]`)
- Function: `parseBranchData()`
- Integrated into extractor pipeline with `branchSpec()` entity spec
- Population contract: 41 (43 raw minus 2 in `#if TAG_MAJOR_VERSION > 34` blocks)

### Tests
- `tests/extract/extract-crawl-spells.test.ts` — 7 tests, all passing
- `tests/conformance/c13-crawl.test.ts` — 9 tests, all passing
- `tests/extractor-quality/crawl-quality.test.ts` — 18 tests, all passing

## Key technical decisions

1. **C preprocessor handling**: `preprocessCSource()` in `c-struct-parser.ts` handles `#if TAG_MAJOR_VERSION == 34` (active) and `#if TAG_MAJOR_VERSION > 34` (skipped). TAG_MAJOR_VERSION is 34 for current Crawl source.

2. **Evidence for files outside dat/**: C header files (`spl-data.h`, `branch-data.h`) live in `source/` not `source/dat/`. The `ReadonlySourceReader` is sandboxed to `dat/`. Solution: copy headers into `dat/` before running pipeline, leave them there so quality tests can verify evidence artifacts.

3. **Comment stripping**: C++ line comments (`//`) are stripped per-line in `extractEntries()` before joining entry content, so comment text doesn't interfere with field splitting.

4. **Leading `{` stripping**: Content from `extractEntries()` includes the opening `{`. This is stripped before `parseEntryFields()` to avoid brace depth issues that prevent comma splitting.

5. **Entry filtering**: `parseSpellData()` filters entries by `SPELL_` prefix to exclude AXED_SPELL macro templates. `parseBranchData()` filters by `BRANCH_` prefix.

## What's next (priority order from PLAN-002)

### Crawl (2 remaining):
1. **C-4: Crawl forms** — `dat/forms/*.yaml`, ~35 entries, YAML parser (familiar pattern). Canonical kind: `mutation`. Attributes: badmuts, weight, duration, hp_mod, ac_mod, ev_mod, sh_mod, speed_mod.
2. **C-2: Crawl abilities** — `ability.h` + `ability-type.h`, C enum parser, ~50 entries. Canonical kind: `ability`. Attributes: flags, hotkey, fail_rate, is_invocation.

### NetHack (6 tasks):
3. **N-1**: artifacts — `include/artilist.h`, C macro array `A()`, 36 entries
4. **N-3**: roles — `include/you.h` + `src/role.c`, C struct, ~13 entries
5. **N-4**: races — same source as roles, ~5 entries
6. **N-2**: traps — `include/trap.h`, C enum, ~20 entries
7. **N-6**: skills — `include/skills.h`, C enum `P_*`, 12 entries
8. **N-5**: dungeon branches — `include/dungeon.h` + `dat/dungeon.dat`, ~10 entries

### Cataclysm-BN (6 tasks):
9. **CB-1**: bionics — `data/json/bionics/*.json`, ~100+ entries
10. **CB-3**: recipes — `data/json/recipes/*.json`, ~500+ entries
11. **CB-2**: traps — `data/json/traps.json`, ~30+ entries
12. **CB-5**: effects — `data/json/effects/*.json`, ~50+ entries
13. **CB-6**: factions — `data/json/factions/*.json`, ~30+ entries
14. **CB-4**: skills — `data/json/skills/*.json`, ~20+ entries

## Files modified this session
- `packages/extractors/crawl-extractor/src/c-struct-parser.ts` (NEW)
- `packages/extractors/crawl-extractor/src/extractor.ts` (MODIFIED)
- `packages/extractors/crawl-extractor/src/index.ts` (MODIFIED)
- `tests/extract/extract-crawl-spells.test.ts` (NEW)

## Key files to read for context
- `docs/plans/plan-002-remaining-extraction-work.md` — full plan with all 18 tasks
- `packages/extractors/crawl-extractor/src/c-struct-parser.ts` — C struct parser
- `packages/extractors/crawl-extractor/src/yaml-parser.ts` — existing YAML parser (reference for C-4 forms)
- `packages/extractors/crawl-extractor/src/extractor.ts` — main extractor with all entity specs
- `packages/extractor-sdk/src/entity-pipeline.ts` — entity pipeline (EntitySpec/EntityAdapter interfaces)
- `packages/extractor-sdk/src/evidence-builder.ts` — evidence factory (requires artifactPath within source root)
- `tests/conformance/c13-crawl.test.ts` — conformance test template
- `tests/extractor-quality/crawl-quality.test.ts` — quality test (run by pre-commit hook)

## Pre-commit hook
The pre-commit hook (`scripts/pre-commit-quality.sh`) runs `pnpm exec vitest run tests/extractor-quality/` when extractor files change. All 94 quality tests must pass for commit to succeed. Current runtime: ~2 minutes.
