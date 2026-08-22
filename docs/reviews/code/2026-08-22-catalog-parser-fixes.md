# Code Review: BrogueCE Catalog Parser Fixes

- **Date**: 2026-08-22
- **Commit**: `b7b10b0`
- **Base**: `fa537b7`
- **Reviewer**: Cascade (fo-review)
- **Files**: 6 changed, +32 / -17

## Mechanical Floor

| Check | Result |
|-------|--------|
| `tsc --noEmit` (broguece-extractor) | PASS |
| `astro check` (web) | PASS (0 errors, 0 warnings, 1 pre-existing hint in `verify.ts`) |
| `vitest run tests/mig/mig-003.test.ts` | 15/15 PASS |
| `vitest run tests/extractor-quality/broguece-quality.test.ts` | 16/18 PASS (2 pre-existing sprite-file failures) |

## Axis A — Structural Correctness

| Item | Status | Notes |
|------|--------|-------|
| Strict typing | PASS | No new `any` introduced. `kind` field typed as `string \| null`. Casts use `as string \| null` pattern consistent with existing code. |
| Magic numbers | PASS | No new magic numbers. Expected counts in manifest are named config, not inline literals. |
| Minimalism | PASS | Dungeon feature parser refactored from `.map()` to `for...of` with dedup — justified by the need to skip duplicates. No over-engineering. |
| Dead code | PASS | No dead code introduced. |
| Unjustified removals | PASS | No removals — all changes are additive or regex modifications. |
| Error handling | N/A | Parser functions return arrays; no error paths changed. |
| Fowler code smells | PASS | No new smells. The `kind ?? record_type` fallback pattern appears in 3 places (compare page filter, compare page type list, CompareTable display) — minor Duplicated Code, but each site has a slightly different context (filter predicate vs. Set construction vs. display), so extraction would be speculative. |

## Axis B — DNA Alignment

`forge.yaml` `bindings.paths.invariantsFile` is `null` — **no invariants file**. Invariant alignment skipped.

## Axis C — Ecosystem Fit

| Item | Status | Notes |
|------|--------|-------|
| Package boundaries | PASS | No new imports across package boundaries. `page-data.ts` change is internal to web app. Parser changes are internal to broguece-extractor. |
| Export surface | PASS | `CompareRow` interface extended with `kind` field — additive, backward compatible. No existing consumer breaks. |
| Workspace deps | PASS | No dependency changes. |
| AGENTS.md rules | PASS | Extractor package remains under `packages/extractors/` as required. |

## Axis D — Forward-Only Discipline

| Item | Status | Notes |
|------|--------|-------|
| No silent breaking changes | PASS | `CompareRow.kind` is additive. Parser output changes are bug fixes, not API breaks. |
| Migration path | PASS | Expected count changes in manifest are internal config, validated by Q-002 test. |
| Version bumps | N/A | Package is `0.1.0` private, no version bump required for internal parser fixes. |

## Axis E — Agent Clarity

| Item | Status | Notes |
|------|--------|-------|
| Commit message | PASS | Clear, descriptive, lists all changes with rationale. |
| Code comments | PASS | No new comments added, no existing comments removed — consistent with project style. |
| Naming | PASS | `firstField`, `seen`, `results` are clear names in the dungeon feature parser refactor. |

## Axis F — Pragmatism

| Item | Status | Notes |
|------|--------|-------|
| Minimal diff | PASS | Each change is targeted — regex patterns, one interface field, one display expression. No drive-by refactors. |
| Test coverage | **FINDING** | Parser fixes have no unit tests. The mig-003 test checks creature/terrain/item counts but not mutation/dungeon_feature/light counts directly. The extractor-quality Q-002 test validates counts but doesn't test parser output in isolation. A targeted unit test (e.g. `parseMutationCatalog` returns 8 entries with correct names) would prevent regressions. |
| Pre-existing issues | NOTE | `kindsForSource` and `defRecordsForSourceKind` in `page-data.ts` still filter by `record_type` instead of `kind`. The games/[sourceId]/definitions/[kind] page will show "definition" as the only kind tab, same issue as the compare table had before this fix. This is out of scope for this diff but should be addressed in a follow-up. |

## Axis G — Test Fitness

| Item | Status | Notes |
|------|--------|-------|
| Existing tests pass | PASS | All mig-003 tests pass. Q-002 population counts match new expected values. |
| No tests weakened | PASS | No test modifications. |
| Regression risk | **FINDING** | The `entryPattern` regex changes are critical to record extraction. If a future BrogueCE source format change adds a line that starts with `{"` but isn't a catalog entry, the mutation/monster_class parsers would create a false record. No unit test guards against this. |

## Findings Summary

### F-001: No unit tests for parser entryPattern changes (medium)

**Location**: `packages/extractors/broguece-extractor/src/c-parser.ts`

The `entryPattern` regex changes for mutation, dungeon_feature, light, and monster_class parsers are the core of this fix but have no dedicated unit tests. The Q-002 population count test validates the aggregate count but doesn't verify entry names, slugs, or descriptions. A regression could silently change record keys without failing the count check (e.g. if a new mutation were added, the parser might miss it or create a duplicate).

**Recommendation**: Add a test file like `tests/extract/extract-broguece-catalogs.test.ts` that calls each `parse*Catalog` function with a small fixture string and asserts entry count, nativeId, and description.

### F-002: `kindsForSource` and `defRecordsForSourceKind` still use `record_type` (low, out of scope)

**Location**: `apps/web/src/lib/page-data.ts:125-141`

These functions power the games/[sourceId]/definitions/[kind] page and still filter by `record_type` instead of `kind`. This means the kind tabs on that page will show "definition", "concept", "semantic_record" instead of "creature", "terrain", "item", etc. — the same issue fixed in the compare table.

**Recommendation**: Apply the same `kind ?? record_type` pattern to `kindsForSource` and `defRecordsForSourceKind` in a follow-up.

## Verdict

**PASS** — The diff is structurally sound, mechanically verified, and correctly fixes the parser bugs. Two findings (F-001, F-002) are noted for follow-up but do not block this commit.
