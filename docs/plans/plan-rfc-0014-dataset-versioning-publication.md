---
id: PLAN-RFC-0014
title: Dataset versioning and publication — semantic versioning, dataset card, citation
status: active
scope: project-wide
decider: architecture
reviewers:
  - human:andrii-syrokomskyi
related:
  - RFC-0014
  - RFC-0007
created: 2026-08-23
accepted: 2026-08-23
implementedAt: null
closedAt: null
---

# PLAN-RFC-0014: Dataset versioning and publication

## Context

RFC-0014 (accepted) defines dataset versioning, dataset card, citation, enhanced /dataset page, release script, and CI release check. This plan implements all 6 decisions (D1–D6) across 6 steps.

Key architectural facts verified during planning:
- `knowledge/manifest.yaml` already has `dataset_version: 0.1.0-dev` (line 4)
- `KnowledgeManifest` interface in `packages/knowledge-core/src/config.ts:47` already includes `dataset_version: string`
- Materializer (`packages/materializer/src/build.ts:155`) already reads `paths.manifest.dataset_version` and passes it to `createManifest`
- `MaterializationManifest` interface in `packages/materializer/src/types.ts:48-59` already includes `datasetVersion: string`
- Web context (`apps/web/src/lib/context.ts:52`) already reads `manifest.datasetVersion` from materialized manifest
- `/dataset` page (`apps/web/src/pages/dataset.astro`) already displays dataset ID, version, model version, canonical hash, license, logical dump hash, record counts
- `kb-health-summary.ts` already compares counts against baseline

What's new:
- `version_history` field in `manifest.yaml` → new field in `KnowledgeManifest` and `MaterializationManifest`
- `DATASET_CARD.md`, `CITATION.bib` → new files
- Enhanced `/dataset` page → add card sections, download links, license link
- `scripts/create-release.ts` → new script
- CI release check → new step in `ci.yml`

## Steps

### Step 1: Add versioning to manifest and materializer (D1)

1. Update `knowledge/manifest.yaml`:
   - Change `dataset_version: 0.1.0-dev` → `dataset_version: "1.0.0"`
   - Add `version_history` array with initial entry (version, date, commit, record_count, concept_count, changes)

2. Add `version_history` to `KnowledgeManifest` interface in `packages/knowledge-core/src/config.ts`:
   ```typescript
   version_history?: VersionHistoryEntry[];
   ```
   Add `VersionHistoryEntry` interface:
   ```typescript
   interface VersionHistoryEntry {
     version: string;
     date: string;
     commit: string;
     record_count: number;
     concept_count: number;
     changes: string;
   }
   ```

3. Add `versionHistory` to `MaterializationManifest` interface in `packages/materializer/src/types.ts`:
   ```typescript
   versionHistory?: VersionHistoryEntry[];
   ```

4. Update `createManifest` in `packages/materializer/src/manifest.ts` to accept and propagate `versionHistory`.

5. Update `materialize()` in `packages/materializer/src/build.ts` to pass `paths.manifest.version_history` to `createManifest`.

6. Add version detection logic to `scripts/kb-health-summary.ts`:
   - Read `dataset_version` and `version_history` from manifest
   - Compare current record count against last `version_history` entry
   - Suggest minor bump if record count increase > 100
   - Warn if record count decreased
   - Print version info in summary output

**Completion criterion**: `pnpm materialize` succeeds, `dist/manifest.json` contains `versionHistory`, `kb-health-summary.ts` prints version info.

**Files**: `knowledge/manifest.yaml`, `packages/knowledge-core/src/config.ts`, `packages/materializer/src/types.ts`, `packages/materializer/src/manifest.ts`, `packages/materializer/src/build.ts`, `scripts/kb-health-summary.ts`

### Step 2: Create dataset card and citation (D2, D3)

1. Create `DATASET_CARD.md` at repository root with structured metadata:
   - Overview (name, version, license, repository)
   - Composition (games, records, data types)
   - Collection method (extractors, methodology, evidence)
   - Quality (coverage, concepts, conformance)
   - Limitations (4 games only, no balance data, no playtest data, English-only)
   - Citation reference to `CITATION.bib`

2. Create `CITATION.bib` at repository root with valid BibTeX entry.

3. Add links from `README.md` to `DATASET_CARD.md` and `CITATION.bib` in the "Open dataset" section.

**Completion criterion**: `DATASET_CARD.md` and `CITATION.bib` exist at repo root, `README.md` links to both.

**Files**: `DATASET_CARD.md`, `CITATION.bib`, `README.md`

### Step 3: Enhance /dataset page (D4)

1. Enhance `apps/web/src/pages/dataset.astro`:
   - Add dataset card sections below existing content: composition, collection method, quality, limitations
   - Add download section with links to: raw JSONL (`.generated/knowledge/dist/records.jsonl`), Obsidian vault (`projections/obsidian/`), citation (`CITATION.bib`)
   - Add license link to `LICENSES/CC-BY-4.0.txt`
   - Add visual version badge styling for the existing `manifest.datasetVersion` display
   - Add `MODULE_CONTRACT` and `CHANGE_SUMMARY` comments in frontmatter (per `apps/web/AGENTS.md`)

2. Build and verify the web app compiles.

**Completion criterion**: `pnpm build:web` succeeds, page shows card sections + download links + license link.

**Files**: `apps/web/src/pages/dataset.astro`

### Step 4: Create release script (D5)

1. Create `scripts/create-release.ts`:
   - Read `dataset_version` from `knowledge/manifest.yaml`
   - Read `version_history` for last entry comparison
   - Accept `--bump <major|minor|patch>` and `--dry-run` flags
   - Compute new version based on bump type
   - Update `manifest.yaml`: set `dataset_version` to new version, append new `version_history` entry
   - Generate release notes from `git log` since last release tag
   - Create git tag `v{version}` (skip in dry-run)
   - Check `gh` CLI availability; if available and authenticated, create GitHub release; otherwise print manual instructions and exit 0
   - Handle edge cases: existing tag (exit 1), dirty working tree (exit 1), empty `version_history` (initialize)

2. Test with `--dry-run` to verify output without side effects.

**Completion criterion**: `pnpm exec tsx scripts/create-release.ts --dry-run --bump patch` prints planned actions without modifying files.

**Files**: `scripts/create-release.ts`

### Step 5: Add CI release check (D6)

1. Add a release check step to `.github/workflows/ci.yml` after the materialize step:
   - Verify `manifest.yaml` has `dataset_version` field
   - Verify version matches SemVer regex `^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?$`
   - Verify `version_history` is append-only via `git diff HEAD~1 -- knowledge/manifest.yaml` (no removal/modification of existing entries)

2. The check should be a shell script step (inline or called via `tsx`).

**Completion criterion**: CI workflow file contains release check step with all 3 validations.

**Files**: `.github/workflows/ci.yml`

### Step 6: Tests, verify, and stamp

1. Add a conformance test `tests/conformance/c18-dataset-version.test.ts`:
   - Verify `manifest.yaml` has `dataset_version` matching SemVer
   - Verify `version_history` exists and is non-empty
   - Verify `version_history` entries have required fields (version, date, commit, record_count, concept_count, changes)

2. Run full verification:
   ```bash
   pnpm materialize
   pnpm exec turbo run build:check
   pnpm exec vitest --run
   ```

3. Update root `AGENTS.md` → CI Gates Policy to mention the release check step.

4. Stamp implemented:
   ```bash
   pnpm exec forge rfc.implement.stamp --id RFC-0014 --implementation-commit <sha>
   ```

**Completion criterion**: All tests pass, `build:check` passes, RFC-0014 status is `implemented`.

**Files**: `tests/conformance/c18-dataset-version.test.ts`, `AGENTS.md`

## Validation suite

| Check | Command | When |
|---|---|---|
| TypeScript compilation | `pnpm exec turbo run build:check` | After steps 1, 3, 4 |
| Materialization | `pnpm materialize` | After step 1 |
| Web build | `pnpm build:web` | After step 3 |
| Full test suite | `pnpm exec vitest --run` | After step 6 |
| RFC validation | `pnpm exec forge rfc.validate --id RFC-0014 --json` | After stamp |

## Evidence strategy

- `pnpm materialize` output showing `versionHistory` in manifest
- `pnpm exec tsx scripts/create-release.ts --dry-run --bump patch` output
- `pnpm exec vitest --run` output showing c18 test passing
- `git log --oneline` showing implementation commits

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Materializer breaks after `KnowledgeManifest` interface change | Step 1 updates all 3 files (config.ts, types.ts, manifest.ts) in sequence |
| Web build fails after dataset.astro changes | Step 3 includes build verification |
| `version_history` YAML formatting breaks materializer | Use `parseYaml` which handles arrays; test with `pnpm materialize` |
