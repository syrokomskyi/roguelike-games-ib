---
id: RFC-0014
title: "Dataset versioning and publication — semantic versioning, dataset card, citation"
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
  - RFC-0007
satisfies: []
versionBump: minor
commands:
  proposed: []
  added: []
  changed: []
  removed: []
appsImpacted:
  - web
packagesImpacted:
  - materializer
successSignals:
  - Dataset has a semantic version (v1.0.0) stored in manifest.yaml
  - Version bumps automatically when record counts change significantly
  - /dataset page shows dataset card with metadata, license, version, stats
  - Citation format (BibTeX) is available
  - GitHub release is created on version bump
nonGoals:
  - Does not publish to external data registries (Zenodo, HuggingFace) — that is a future concern
  - Does not create a separate dataset repository — the dataset lives in this repo
  - Does not version individual records — versions the entire dataset
  - Does not auto-generate DATASET_CARD.md prose sections — statistics are auto-generated, prose is human-maintained
---

# RFC-0014: Dataset versioning and publication — semantic versioning, dataset card, citation

## Architectural fit

RFC-0007 (implemented) added canonical hash tracking, record count regression detection, and a health summary script. Its nonGoals explicitly state: "Does not define a release process for the dataset — that is a separate RFC." RFC-0014 is that separate RFC.

The existing `knowledge/manifest.yaml` already contains a `dataset_version: 0.1.0-dev` field (line 4). This RFC formalizes that field with SemVer rules and adds `version_history` for append-only release tracking. The materializer (`packages/materializer`) reads `manifest.yaml` and produces `dist/manifest.json` — it must propagate the version and history to the materialized output.

The existing `/dataset` web page (`apps/web/src/pages/dataset.astro`) already displays: dataset ID, dataset version, model version, canonical hash, license, logical dump hash, and record counts. This RFC enhances that page with structured dataset card content, download links, and citation — it does not create the page from scratch.

This RFC is `kind: policy` (not `architecture`) because `forge.yaml` has `invariantsFile: null` — the project has no DNA invariants file. This matches the pattern established by RFC-0002, RFC-0003, and RFC-0004.

## Context

The knowledge base has 22,476 records, 113,291 claims, 35,839 relations, and 469 concepts. RFC-0007 added canonical hash tracking and a health summary script. But there is no:

- **Semantic version** for the dataset
- **Dataset card** (like HuggingFace model cards) describing what the dataset is
- **Citation format** for academic use
- **Release process** for publishing versioned snapshots

### Current state

- `knowledge/manifest.yaml` — describes the knowledge base schema and structure; already contains `dataset_version: 0.1.0-dev` (line 4)
- `.generated/knowledge/canonical-hash.txt` — current hash
- `.generated/knowledge/canonical-hash-history.jsonl` — append-only hash log
- `scripts/kb-health-summary.ts` — prints stats with baseline comparison
- `apps/web/src/pages/dataset.astro` — shows dataset ID, version, model version, canonical hash, license, logical dump hash, record counts
- `NOTICE.dataset.md` — dataset license notice (CC-BY-4.0)

## Problem

1. **No version identity**: The dataset has no version number. Users cannot say "I'm using v1.2" — they can only reference a git commit hash.
2. **No dataset card**: New visitors to `/dataset` see basic stats but no structured metadata (purpose, composition, collection method, limitations).
3. **No citation**: Academic users cannot cite the dataset in papers — no BibTeX or other citation format.
4. **No release process**: There is no way to mark a commit as a release, generate release notes, or create a GitHub release with the dataset attached.

## Decision

### D1: Semantic versioning

Formalize the existing `dataset_version` field in `knowledge/manifest.yaml` with SemVer rules. The field already exists as `dataset_version: 0.1.0-dev` (line 4) — this RFC changes it to `dataset_version: "1.0.0"` and adds `version_history`:

```yaml
dataset_version: "1.0.0"
version_history:
  - version: "1.0.0"
    date: "2026-08-23"
    commit: "0d1c655"
    record_count: 22476
    concept_count: 469
    changes: "Initial versioned release"
```

**Versioning rules** (SemVer for datasets):
- **Major** (2.0.0): Breaking schema change (e.g., `rgkb/definition@3` replaces `@2`)
- **Minor** (1.1.0): New data added (new games, new data types, new concepts)
- **Patch** (1.0.1): Data corrections, bug fixes, no new records

**Automatic detection**: `scripts/kb-health-summary.ts` compares current record count against last version:
- Record count increase > 100 → suggest minor bump
- Record count decrease → warn (potential data loss)
- Schema version change → suggest major bump

### D2: Dataset card

Create `DATASET_CARD.md` at repository root with structured metadata:

```markdown
# Roguelike Games Inspiration Base — Dataset Card

## Overview
- **Name**: Roguelike Games Inspiration Base
- **Version**: 1.0.0
- **License**: CC-BY-4.0
- **Repository**: https://github.com/syrokomskyi/roguelike-games-ib

## Composition
- **Games**: 4 (BrogueCE, Cataclysm-BN, Crawl, NetHack)
- **Records**: 22,476 definitions, 469 concepts, 113,291 claims, 35,839 relations
- **Data types**: creatures, items, spells, abilities, species, professions, vaults, branches, traps, skills, artifacts, gods, brands, effects, martial arts, ...

## Collection method
- **Extractors**: TypeScript adapters parsing game source files (YAML, JSON, C headers)
- **Methodology**: RFC-0001 — one source object = one record, factual extraction without loss
- **Evidence**: Every record has source file + line range evidence anchor

## Quality
- **Coverage**: All dimensions exhaustive_for_binding (see coverage files)
- **Concepts**: 469 cross-game concepts with quality scores (RFC-0009)
- **Conformance**: 688 tests, 94 test files

## Limitations
- 4 games only (no ToME4, Caves of Qud, etc.)
- No balance data (damage numbers are extracted but not normalized)
- No playtest data (design analysis is structural, not experiential)
- English-only record text

## Citation
See `CITATION.bib`
```

**Files**: `DATASET_CARD.md` (new)

### D3: Citation file

Create `CITATION.bib`:

```bibtex
@dataset{roguelike_games_ib,
  title        = {Roguelike Games Inspiration Base},
  version      = {1.0.0},
  year         = {2026},
  publisher    = {Andrii Syrokomskyi},
  license      = {CC-BY-4.0},
  url          = {https://github.com/syrokomskyi/roguelike-games-ib},
  description  = {A structured knowledge base of 22,476 records from 4 roguelike games, with 469 cross-game design concepts.}
}
```

**Files**: `CITATION.bib` (new)

### D4: Enhanced /dataset web page

The existing `/dataset` page (`apps/web/src/pages/dataset.astro`) already shows: dataset ID, dataset version, model version, canonical hash, license, logical dump hash, and record counts. Enhance it to also show:
1. **Dataset card sections** — composition, collection method, quality, limitations (rendered from hardcoded content in Astro, matching `DATASET_CARD.md`)
2. **Version badge** — already displayed via `manifest.datasetVersion`, add visual badge styling
3. **Download section** — links to: raw JSONL, Obsidian vault, citation
4. **License section** — CC-BY-4.0 with link to full text (already shown, add link to `LICENSES/CC-BY-4.0.txt`)

**Files**: `apps/web/src/pages/dataset.astro`

### D5: Release script

Create `scripts/create-release.ts` that:
1. Reads current `dataset_version` from `manifest.yaml`
2. Compares record counts against last release in `version_history`
3. Suggests version bump (major/minor/patch)
4. Updates `manifest.yaml` with new `dataset_version` and appends to `version_history`
5. Generates release notes from git log since last release tag
6. Creates a git tag `v{version}`
7. Optionally creates a GitHub release (via `gh` CLI — checks availability first; if `gh` is not installed or not authenticated, prints manual instructions and exits 0)

**Edge cases handled**:
- Git tag already exists → error, exit 1
- Dirty working tree → error, exit 1 (commit or stash first)
- Empty `version_history` → initialize with first entry
- `--dry-run` flag → print planned actions without modifying files or creating tags

**Usage**: `pnpm exec tsx scripts/create-release.ts --bump minor`

**Files**: `scripts/create-release.ts`

### D6: CI release check

Add a CI job that verifies:
1. `manifest.yaml` has a `dataset_version` field
2. Version is valid SemVer (regex: `^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?$`)
3. Version history is append-only — CI uses `git diff` to check that existing `version_history` entries were not modified or removed (only new entries appended at the end are allowed)

**Append-only check mechanism**: The CI step runs `git diff HEAD~1 -- knowledge/manifest.yaml` and parses the diff. If any existing `version_history` entry lines show `-` (removal) or `~` (modification), the check fails. Only lines with `+` (addition) at the end of the `version_history` array are allowed.

**Files**: `.github/workflows/ci.yml` — add release check step

## Implementation plan

### Step 1: Add versioning to manifest (D1)

1. Change `dataset_version` in `knowledge/manifest.yaml` from `0.1.0-dev` to `"1.0.0"`
2. Add `version_history` array with initial entry
3. Add version detection logic to `scripts/kb-health-summary.ts`

**Files**: `knowledge/manifest.yaml`, `scripts/kb-health-summary.ts`

### Step 2: Create dataset card and citation (D2, D3)

1. Create `DATASET_CARD.md` with full metadata
2. Create `CITATION.bib`
3. Link from README.md

**Files**: `DATASET_CARD.md`, `CITATION.bib`, `README.md`

### Step 3: Enhance /dataset page (D4)

1. Enhance `apps/web/src/pages/dataset.astro` — add dataset card sections (composition, collection method, quality, limitations), download links, license link
2. Add visual version badge styling
3. Build and verify

**Files**: `apps/web/src/pages/dataset.astro`

### Step 4: Create release script (D5)

1. Create `scripts/create-release.ts`
2. Implement version bump detection, manifest update, tag creation
3. Test with `--dry-run`

**Files**: `scripts/create-release.ts`

### Step 5: Add CI release check (D6)

1. Add release check step to `.github/workflows/ci.yml`

**Files**: `.github/workflows/ci.yml`

### Step 6: Tests and verify

1. Add test verifying manifest version format
2. `pnpm exec turbo run build:check && pnpm exec vitest --run`

## Design

### TypeScript contracts

```typescript
// scripts/create-release.ts
interface ReleaseOptions {
  bump: "major" | "minor" | "patch";
  dryRun?: boolean;
  skipGithubRelease?: boolean;
}

interface VersionHistoryEntry {
  version: string;
  date: string;
  commit: string;
  record_count: number;
  concept_count: number;
  changes: string;
}

interface ReleaseResult {
  newVersion: string;
  previousVersion: string;
  tagCreated: boolean;
  githubReleaseCreated: boolean;
  releaseNotes: string;
}
```

### File system responsibilities

| File | Action | Purpose |
|---|---|---|
| `knowledge/manifest.yaml` | Modify | Change `dataset_version` to `1.0.0`, add `version_history` |
| `DATASET_CARD.md` | Create | Structured dataset card with metadata |
| `CITATION.bib` | Create | BibTeX citation for academic use |
| `README.md` | Modify | Add links to `DATASET_CARD.md` and `CITATION.bib` |
| `apps/web/src/pages/dataset.astro` | Modify | Add dataset card sections, download links, license link |
| `scripts/create-release.ts` | Create | Release script with version bump, tag creation, GitHub release |
| `scripts/kb-health-summary.ts` | Modify | Add version detection and bump suggestion |
| `.github/workflows/ci.yml` | Modify | Add release check step |
| `packages/materializer/src/build.ts` | Modify | Propagate `dataset_version` and `version_history` to `dist/manifest.json` |

### Failure modes

| Script | Failure condition | Exit code | Behavior |
|---|---|---|---|
| `create-release.ts` | Git tag already exists | 1 | Print error: "Tag v{version} already exists" |
| `create-release.ts` | Dirty working tree | 1 | Print error: "Commit or stash changes first" |
| `create-release.ts` | `gh` CLI not installed | 0 | Print warning + manual instructions, skip GitHub release |
| `create-release.ts` | `gh` not authenticated | 0 | Print warning + manual instructions, skip GitHub release |
| `create-release.ts` | `--dry-run` | 0 | Print planned actions, modify nothing |
| CI release check | `dataset_version` missing | fail | Print: "manifest.yaml must have dataset_version" |
| CI release check | Invalid SemVer | fail | Print: "dataset_version must be valid SemVer" |
| CI release check | `version_history` modified | fail | Print: "version_history is append-only" |

## Rollout

1. **Manifest update**: `dataset_version` changes from `0.1.0-dev` to `1.0.0`. The existing field is replaced — no dual-field transition. The materializer is updated to propagate the new `version_history` to `dist/manifest.json`.

2. **Web page enhancement**: The existing `/dataset` page is enhanced in place. No new route. Existing content (dataset ID, version, hash, counts) remains; new sections (card content, downloads, license link) are added below.

3. **CI check**: Added as a new step in the existing CI workflow. Runs after materialize. Does not block existing quality gates — it is an additional check.

4. **Release script**: Manual invocation. Not triggered automatically by CI. The operator runs `pnpm exec tsx scripts/create-release.ts --bump minor` when ready to cut a release.

5. **AGENTS.md**: Root `AGENTS.md` → CI Gates Policy section should be updated to mention the release check step. Web app `AGENTS.md` requires `MODULE_CONTRACT` and `CHANGE_SUMMARY` comments in the modified `dataset.astro`.

## Acceptance criteria

- [ ] `knowledge/manifest.yaml` has `dataset_version: "1.0.0"` and `version_history`
- [ ] `DATASET_CARD.md` exists with structured metadata
- [ ] `CITATION.bib` exists with valid BibTeX
- [ ] `/dataset` page shows dataset card sections, download links, license link
- [ ] `scripts/create-release.ts` creates version tags with `--dry-run` support
- [ ] `scripts/create-release.ts` handles edge cases (existing tag, dirty tree, empty history)
- [ ] CI checks `dataset_version` format and `version_history` append-only
- [ ] `pnpm exec turbo run build:check` passes
- [ ] `pnpm exec vitest --run` passes

## Risks

- **Version bump discipline**: Forgetting to bump version on data changes. Mitigation: CI check compares record counts and warns if version is stale.
- **Dataset card maintenance**: Card must be updated when games or data types are added. Mitigation: `kb-health-summary.ts` auto-generates statistics section, human maintains prose sections.
- **GitHub release scope**: What to include in a release — just the dataset, or the entire repo? Mitigation: release notes reference the dataset, the repo is the dataset. No separate archive needed.
- **`gh` CLI availability**: `create-release.ts` optionally creates GitHub releases via `gh`. If `gh` is not installed or not authenticated, the script prints manual instructions and exits 0. GitHub release creation is not mandatory for a version tag to be valid.
- **Agent misinterpretation**: Agents may attempt to run `create-release.ts` automatically. Mitigation: the script is manual-only — agents must not run it without operator instruction. AGENTS.md should document this.

## Alternatives considered

1. **Git tags as the sole versioning mechanism** — Rejected because git tags alone don't provide structured `version_history` with record counts and change descriptions. Tags are machine-readable but not human-friendly for dataset metadata. The manifest field gives a single source of truth that the web page, health summary, and release script can all read.

2. **semantic-release / release-please** — Rejected because these tools are designed for software package versioning (npm, GitHub releases). Dataset versioning has different semantics (record count changes, not code changes). A custom script is simpler and more appropriate for the dataset-specific bump rules.

3. **External dataset registry (Zenodo, HuggingFace)** — Deferred to a future RFC. This RFC focuses on internal versioning, citation, and GitHub releases. External registry publication adds complexity (DOI minting, metadata schemas) that is not needed yet.

4. **Separate dataset repository** — Rejected because the dataset lives in this repo. Creating a separate repo would require mirroring infrastructure and complicate evidence traceability.

## Implementation notes for agents

1. **RFC status gate**: This RFC must be `accepted` before implementation begins. Do not implement while `status: draft`.

2. **Use `dataset_version`, not `version`**: The existing `manifest.yaml` field is `dataset_version` (line 4). Do not introduce a new `version` field — rename the existing one to `1.0.0`.

3. **`version_history` is append-only**: Never modify or remove existing entries. Only append new entries at the end of the array. CI checks this via `git diff`.

4. **`create-release.ts` is manual**: Do not run `create-release.ts` automatically in CI. It is a manual operator action. CI only validates the manifest version format and append-only history.

5. **Materializer propagation**: `packages/materializer` must read `dataset_version` and `version_history` from `manifest.yaml` and include them in `dist/manifest.json`. The web page reads from the materialized manifest, not directly from `manifest.yaml`.

6. **Web app AGENTS.md**: The modified `dataset.astro` must include `MODULE_CONTRACT` and `CHANGE_SUMMARY` comments in the frontmatter, per `apps/web/AGENTS.md` conventions.

7. **Root AGENTS.md**: After implementation, update root `AGENTS.md` → CI Gates Policy to mention the release check step.

8. **`DATASET_CARD.md` statistics**: The statistics section (record counts, concept counts, test counts) should be auto-generated by `kb-health-summary.ts` or a similar script. The prose sections (overview, collection method, limitations) are human-maintained. Do not hardcode counts in the card — they will go stale.
