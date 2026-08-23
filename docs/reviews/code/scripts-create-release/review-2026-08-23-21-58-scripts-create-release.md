---
reviewId: REVIEW-CODE-2026-08-23-01
date: 2026-08-23
reviewer:
  skill: fo-review
  model: unknown
verdict: needs-revision
diffRange: 73e250df652...HEAD
filesReviewed:
  - knowledge/manifest.yaml
  - packages/knowledge-core/src/config.ts
  - packages/knowledge-core/src/index.ts
  - packages/materializer/src/build.ts
  - packages/materializer/src/manifest.ts
  - packages/materializer/src/types.ts
  - scripts/create-release.ts
  - scripts/kb-health-summary.ts
  - apps/web/src/pages/dataset.astro
  - .github/workflows/ci.yml
  - tests/conformance/c18-dataset-version.test.ts
  - DATASET_CARD.md
  - CITATION.bib
  - README.md
  - AGENTS.md
---

# Code Review: 73e250df652...HEAD (RFC-0014 implementation)

### Verdict: Needs revision

The implementation is solid overall — all 6 decisions are implemented, tests pass, build passes. Three findings require attention: a duplicated type definition, a duplicated dist-manifest read path, and a concept_count field that reads the wrong manifest field.

### Mechanical floor

Pass — `pnpm exec turbo run build:check` (17/17 tasks), `pnpm exec vitest --run` (757/757 tests), `rfc.validate` (0 violations).

### Axis A — Structural correctness

1. **Duplicated type: `VersionHistoryEntry`** — `scripts/create-release.ts:21-28` redefines `VersionHistoryEntry` instead of importing from `@roguelike-games-ib/knowledge-core`. This is a Data Clumps smell — the same type lives in two places and can drift. Fix: import from knowledge-core.

2. **Duplicated dist-manifest read: `getRecordCount` and `getConceptCount`** — `scripts/create-release.ts:98-113` both read and parse `dist/manifest.json` independently. This is Duplicated Code. Fix: read once, extract both values.

3. **`getConceptCount` reads wrong field** — `scripts/create-release.ts:112` reads `dist.recordCounts?.coverage` for concept count. Coverage count ≠ concept count. The materialized manifest has no `concepts` field in `recordCounts`. This is a Mysterious Name / incorrect data issue. Fix: either read from the correct source or rename the field to reflect what it actually captures.

### Axis B — DNA alignment

No invariants file — invariant alignment skipped.

### Axis C — Ecosystem fit

No issues. Package boundaries are correct (materializer imports from knowledge-core, scripts are standalone). AGENTS.md updated with CI release check. Compass scaffolding present on all new non-trivial source files.

### Axis D — Forward-only compliance

No issues. `dataset_version` changed from `0.1.0-dev` to `1.0.0` directly — no compatibility shim. `version_history` is a new optional field, not a replacement of existing logic.

### Axis E — Agent-facing clarity

No issues. All new source files carry `MODULE_CONTRACT` and `CHANGE_SUMMARY`. Variable names are clear. The `dataset.astro` page has proper Compass scaffolding per `apps/web/AGENTS.md` conventions.

### Axis F — Pragmatism

1. **`getConceptCount` reads `coverage` count** — `scripts/create-release.ts:108-113` and `scripts/create-release.ts:180-181` use `recordCounts.coverage` as concept count. This is semantically wrong — coverage records ≠ concepts. If concept count is not available in the materialized manifest, use 0 or read from a different source. This is also a Pragmatism issue — the field name doesn't match the data.

### Axis G — Blind spots

1. **`stringifyYaml` may reorder manifest fields** — `scripts/create-release.ts:196` uses `stringifyYaml` from the `yaml` package to write the entire manifest. This may reorder fields or change formatting (quoting style, indentation), creating a large diff unrelated to the version bump. Consider a targeted text replacement instead of full YAML re-serialization.

2. **CI release check uses `require('yaml')`** — `.github/workflows/ci.yml:46` uses `require('yaml')` in a Node.js inline script. The `yaml` package is a dependency of the project, but in CI it runs in the workspace root after `pnpm install`, so it should resolve. However, if the package is hoisted to `node_modules/.pnpm`, `require('yaml')` from the workspace root may fail. Verify this works in CI or use `pnpm exec` to run a script file instead.

### Spec compliance

| Requirement from RFC-0014 | Status | Evidence |
| --- | --- | --- |
| D1: Semantic versioning in manifest | Done | knowledge/manifest.yaml:4-11 |
| D2: Dataset card | Done | DATASET_CARD.md |
| D3: Citation file | Done | CITATION.bib |
| D4: Enhanced /dataset page | Done | apps/web/src/pages/dataset.astro |
| D5: Release script | Partial | scripts/create-release.ts — concept_count reads wrong field |
| D6: CI release check | Done | .github/workflows/ci.yml:42-77 |
| Acceptance: build:check passes | Done | 17/17 tasks |
| Acceptance: vitest passes | Done | 757/757 tests |

### Questions for the author

1. `getConceptCount` reads `recordCounts.coverage` — is this intentional? Coverage records count ≠ concept count. What should this field contain?
2. Will `require('yaml')` resolve correctly in CI after `pnpm install` with pnpm's hoisting strategy?
3. Will `stringifyYaml` preserve the existing manifest field order and formatting, or will it produce a large diff on first release?
