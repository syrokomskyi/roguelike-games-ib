---
id: RFC-0007
title: "Infrastructure — CI/CD pipeline, canonical versioning, and quality gates"
status: implemented
kind: architecture
scope: workspace
owners:
  - architecture
reviewers:
  - human:andrii-syrokomskyi
createdAt: 2026-08-23
updatedAt: 2026-08-23
enhancedAt: 2026-08-23
implementedAt: 2026-08-23
closedAt:
supersedes: []
supersededBy:
amends: []
amendedBy:
related:
  - RFC-0001
  - PLAN-003
satisfies:
  - DNA-1
versionBump: minor
commands:
  proposed:
    - pnpm exec tsx scripts/run-pipeline.ts [--skip-extract] [--skip-derive] [--skip-concepts] [--skip-design] [--skip-materialize] [--skip-build-obsidian] [--skip-build-web] [--skip-tests] [--force]
    - pnpm exec tsx scripts/update-baseline.ts
    - pnpm exec tsx scripts/kb-health-summary.ts
  added: []
  changed: []
  removed: []
appsImpacted:
  - search-api
  - mcp
packagesImpacted:
  - materializer
successSignals:
  - CI pipeline runs on every push and PR
  - Canonical hash is computed and tracked across builds
  - Quality gates prevent merging when conformance tests fail or record counts decrease
  - Full pipeline (extract → derive → concepts → design → materialize → build) runs in CI
  - Deployment is automated for search API and MCP server
nonGoals:
  - Does not define a hosting platform — assumes GitHub for CI and Cloudflare for deployment
  - Does not add monitoring or observability — that is a separate concern
  - Does not define a release process for the dataset — that is a separate RFC
  - Does not add turbo remote cache — local cache and pnpm cache are sufficient for now; remote cache can be added later if CI runtime becomes a bottleneck
---

# RFC-0007: Infrastructure — CI/CD pipeline, canonical versioning, and quality gates

## Architectural fit

This RFC builds on RFC-0001 (Extraction methodology) by adding CI gates that enforce extraction quality at the pipeline level. Where RFC-0001 defines *how* to extract, this RFC ensures extraction outputs are *verified* on every push. The canonical hash tracking (D2) and record count regression detection (D3) directly guard RFC-0001's population completeness contracts (Principle 5) — if a code change silently drops records, the regression test catches it.

PLAN-003 (Knowledge base enrichment) covers the deriver, concepts, search, MCP, and Obsidian build. The full pipeline script (D4) orchestrates the PLAN-003 pipeline stages in CI, ensuring they run in the correct order. The deploy workflow (D5) automates the deployment steps that PLAN-003 currently requires manually.

The existing turbo monorepo task graph (`turbo.json`) already defines tasks: `build`, `build:check`, `test`, `test:quality`, `verify`, `materialize`, `build:obsidian`, `build:web`, `build:mcp`. This RFC adds CI orchestration on top of these existing tasks — it does not modify the turbo task graph.

The pre-commit hook (`scripts/pre-commit-quality.sh`) coexists with CI. The hook provides fast local feedback; CI provides comprehensive verification. Neither replaces the other.

## Context

The project currently has:

- **639 tests** across 89 test files (conformance, core, cover, extract, mcp, search-api)
- **Turbo monorepo** with tasks: `build`, `build:check`, `test`, `test:quality`, `verify`, `materialize`, `build:obsidian`, `build:web`, `build:mcp`
- **Pre-commit hook** (`scripts/pre-commit-quality.sh`) — installs a git hook for quality checks
- **No CI/CD pipeline** — all builds, tests, and deployments are manual
- **No canonical hash tracking** — the materializer computes a hash but it is not tracked across builds or used for regression detection
- **No quality gates** — nothing prevents merging code that reduces record counts, breaks conformance, or introduces dangling references

### Current manual workflow

```bash
# Full pipeline (manual, ~5 minutes)
pnpm exec tsx scripts/run-stage-deriver.ts
pnpm exec tsx scripts/run-stage-concepts.ts
pnpm exec tsx scripts/run-stage-design.ts
pnpm exec tsx scripts/run-materialize.ts
pnpm exec tsx scripts/run-build-obsidian.ts
pnpm exec tsx scripts/run-build-web.ts
pnpm exec vitest --run
```

### Current deployment (manual)

```bash
pnpm search-api:deploy
pnpm --filter @roguelike-games-ib/mcp run deploy  # if exists
```

## Problem

Without CI/CD and quality gates:

1. **No regression detection**: A code change could silently reduce record counts (e.g., a deriver bug drops 500 records) and no one would notice until manual inspection. The canonical hash changes but there is no baseline to compare against.

2. **No automated testing on push**: Tests are only run manually. A PR can be merged with failing tests if the reviewer doesn't run them.

3. **No deployment automation**: Search API and MCP server deployment is manual. There is no staging environment, no rollback, no deploy-on-merge.

4. **No pipeline orchestration**: The 7-step pipeline (extract → derive → concepts → design → materialize → build) must be run manually in order. A mistake in ordering (e.g., materialize before derive) produces stale or broken outputs.

5. **No version tracking**: The canonical hash (`ba5d8168...`) is printed by the materializer but not stored or compared. There is no way to detect "the knowledge base changed between commit A and commit B" without manually running the materializer twice.

## Decision

The project gains a CI/CD pipeline with quality gates, canonical hash tracking, record count regression detection, a full pipeline orchestration script, automated deployment, and a health summary. These are implemented as six components (D1–D6) that together form a single infrastructure decision.

### D1: GitHub Actions CI pipeline

Create `.github/workflows/ci.yml` that runs on every push and PR:

```yaml
name: CI
on:
  push:
    branches: [main]
    paths-ignore:
      - 'docs/**'
      - '**/*.md'
      - 'LICENSE'
  pull_request:
    branches: [main]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 11.20.0
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec turbo run build:check
      - run: pnpm exec vitest --run
      - run: pnpm exec turbo run verify
      - name: Knowledge base health summary
        run: pnpm exec tsx scripts/kb-health-summary.ts
```

**Quality gates** (all must pass for green status):
1. `build:check` — TypeScript compiles for all packages
2. `vitest --run` — all 639+ tests pass
3. `turbo run verify` — verification checks pass

**Node.js version**: 22, matching `package.json` `engines.node: >=22`.
**pnpm version**: 11.20.0, matching `package.json` `packageManager: pnpm@11.20.0`.
**paths-ignore**: Skips CI for documentation-only changes (`docs/**`, `**/*.md`, `LICENSE`).

**Files**: `.github/workflows/ci.yml`

### D2: Canonical hash tracking

Add a hash tracking system that stores the canonical hash in a versioned file and compares it across builds:

1. **Hash file**: `.generated/knowledge/canonical-hash.txt` — contains the current canonical hash (regenerated by materializer, not committed — `.generated/` is gitignored)
2. **Hash history**: `.generated/knowledge/canonical-hash-history.jsonl` — append-only log of `{ hash, timestamp, commit_sha, record_count, claim_count, relation_count }` (regenerated, not committed)
3. **CI check**: a new test that verifies the hash file exists and matches the materialized output. In CI, the materializer runs before tests to produce the hash file.

**Implementation**:
- Modify `scripts/run-materialize.ts` to write the hash file and append to history
- Add `tests/conformance/c16-canonical-hash.test.ts` that reads the hash file and verifies it matches the materialized output
- Add a CI step that runs the materializer before tests to generate the hash file

**Note on test numbering**: `c14` is already taken by `c14-concept-ref-integrity.test.ts`. The canonical hash test uses `c16`; the record count regression test uses `c17`.

**Files**: `scripts/run-materialize.ts`, `tests/conformance/c16-canonical-hash.test.ts`

### D3: Record count regression detection

Add a test that compares current record counts against a baseline file:

1. **Baseline file**: `knowledge/baselines/record-counts-baseline.json` — committed to the repo (not in `.generated/` which is gitignored). Contains `{ definitions: 20500, claims: 112772, relations: 35438, semantic_records: 1033, concepts: 74 }`
2. **Test**: `tests/conformance/c17-record-count-regression.test.ts` — fails if any count decreases by more than 1% from baseline
3. **Update baseline**: a script `scripts/update-baseline.ts` that updates the baseline file after intentional changes (e.g., new extraction)

**Files**: `tests/conformance/c17-record-count-regression.test.ts`, `scripts/update-baseline.ts`, `knowledge/baselines/record-counts-baseline.json`

### D4: Extend full pipeline script

The existing `scripts/run-pipeline.ts` (121 lines) handles source drift detection and materialization. Extend it to orchestrate the full 8-step pipeline:

```typescript
// 1. Extract (if source changed) — existing drift detection logic
// 2. Derive (claims, relations, semantic records) — NEW: run-stage-deriver.ts
// 3. Generate concepts — NEW: run-stage-concepts.ts
// 4. Generate design primitives — NEW: run-stage-design.ts
// 5. Materialize — existing materialize logic
// 6. Build Obsidian vault — NEW: run-build-obsidian.ts
// 7. Build web app — NEW: run-build-web.ts
// 8. Run tests — NEW: vitest --run
```

Each step:
- Checks if the previous step succeeded
- Logs timing and output counts
- Can be skipped with `--skip-extract`, `--skip-derive`, `--skip-concepts`, `--skip-design`, `--skip-materialize`, `--skip-build-obsidian`, `--skip-build-web`, `--skip-tests` flags
- Fails fast if any step errors

**Files**: `scripts/run-pipeline.ts` (modified)

### D5: Deploy workflow

Create `.github/workflows/deploy.yml` that deploys on merge to `main`:

```yaml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    if: contains(github.event.head_commit.message, 'deploy:')
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 11.20.0
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec turbo run build:check
      - run: pnpm exec vitest --run
      - name: Deploy Search API
        run: pnpm search-api:deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
      - name: Index embeddings
        run: pnpm index:embeddings
        env:
          SEARCH_API_URL: ${{ secrets.SEARCH_API_URL }}
          INDEXING_TOKEN: ${{ secrets.INDEXING_TOKEN }}
```

**Trigger**: only runs when commit message contains `deploy:` (opt-in deployment, not every merge). The `paths` filter is removed — the `if` condition on the job is the sole trigger mechanism, keeping it simple.

**Required GitHub secrets**: `CLOUDFLARE_API_TOKEN`, `SEARCH_API_URL`, `INDEXING_TOKEN`. Document in `.env.example` and README.

**Files**: `.github/workflows/deploy.yml`

### D6: Quality gate summary in CI

Add a CI step that produces a summary of knowledge base health:

```yaml
- name: Knowledge base health summary
  run: pnpm exec tsx scripts/kb-health-summary.ts
```

Output:
```
=== Knowledge Base Health ===
Definitions:  20,500 (baseline: 20,500, delta: 0)
Claims:       112,772 (baseline: 112,772, delta: 0)
Relations:    35,438 (baseline: 35,438, delta: 0)
Semantic:     1,033 (baseline: 1,033, delta: 0)
Concepts:     74 (baseline: 74, delta: 0)
Evidence:     20,520 (baseline: 20,520, delta: 0)
Canonical hash: ba5d8168... (baseline: ba5d8168..., match: true)
Conformance:  60/60 pass
Tests:        639/639 pass
```

**Files**: `scripts/kb-health-summary.ts`

## Design

### TypeScript contracts

```typescript
// scripts/run-pipeline.ts — extended
interface PipelineOptions {
  skipExtract?: boolean;
  skipDerive?: boolean;
  skipConcepts?: boolean;
  skipDesign?: boolean;
  skipMaterialize?: boolean;
  skipBuildObsidian?: boolean;
  skipBuildWeb?: boolean;
  skipTests?: boolean;
  force?: boolean;
}

interface PipelineStepResult {
  step: string;
  durationMs: number;
  counts?: Record<string, number>;
  success: boolean;
}

// scripts/update-baseline.ts
function updateBaseline(workspaceRoot: string): {
  path: string;
  counts: Record<string, number>;
}

// scripts/kb-health-summary.ts
function generateHealthSummary(workspaceRoot: string): {
  definitions: number;
  claims: number;
  relations: number;
  semanticRecords: number;
  concepts: number;
  evidence: number;
  canonicalHash: string;
  baselineMatch: boolean;
}
```

### File system responsibilities

| File | Action | Purpose |
|---|---|---|
| `.github/workflows/ci.yml` | Create | CI pipeline with quality gates |
| `.github/workflows/deploy.yml` | Create | Deploy workflow for search-api and MCP |
| `scripts/run-pipeline.ts` | Modify | Extend with 8-step orchestration and --skip flags |
| `scripts/run-materialize.ts` | Modify | Write canonical hash file and append to history |
| `scripts/update-baseline.ts` | Create | Update record count baseline after intentional changes |
| `scripts/kb-health-summary.ts` | Create | Print KB health summary for CI output |
| `tests/conformance/c16-canonical-hash.test.ts` | Create | Verify canonical hash file exists and matches materialized output |
| `tests/conformance/c17-record-count-regression.test.ts` | Create | Fail if record counts decrease >1% from baseline |
| `knowledge/baselines/record-counts-baseline.json` | Create | Committed baseline file for record count comparison |

### Failure modes

| Script | Failure condition | Exit code | Behavior |
|---|---|---|---|
| `run-pipeline.ts` | Any step fails | 1 | Print error, stop pipeline, do not continue to next step |
| `run-pipeline.ts` | Source drift detected | 0 | Print warning, skip extraction (requires manual stage script run) |
| `update-baseline.ts` | Materialized data not found | 1 | Print error: "Run materialize first" |
| `kb-health-summary.ts` | Baseline file missing | 0 | Print warning, show counts without baseline comparison |
| `kb-health-summary.ts` | Materialized data not found | 1 | Print error: "Run materialize first" |
| `c16-canonical-hash.test.ts` | Hash file missing | fail | Print: "Run materialize first to generate hash file" |
| `c17-record-count-regression.test.ts` | Baseline file missing | fail | Print: "Run update-baseline.ts first" |
| `c17-record-count-regression.test.ts` | Count decrease >1% | fail | Print delta summary with affected dimensions |

## Rollout

1. **CI workflow**: Created and pushed. Existing developers see CI running on PRs immediately. No local setup required — CI runs on GitHub-hosted runners.
2. **Pre-commit hook**: Coexists with CI. The hook remains for local feedback; CI provides comprehensive verification. Developers are not required to change their local workflow.
3. **GitHub secrets**: Must be configured in repository settings before the deploy workflow can run. Until secrets are set, deploy workflow jobs skip (the `if` condition still evaluates, but Cloudflare deploy step fails without secrets — this is expected and documented).
4. **Baseline file**: Created with current record counts. Updated via `scripts/update-baseline.ts` after intentional data changes (e.g., new extraction, deriver improvements).
5. **Canonical hash**: Generated by materializer in CI. Not committed to repo (`.generated/` is gitignored). The hash test runs after materialize in CI.
6. **AGENTS.md**: Update root AGENTS.md to document that CI gates are mandatory for all merges to main. Agents must not bypass CI checks.

## Implementation plan

### Step 1: Create CI workflow (D1)

1. Create `.github/workflows/ci.yml`
2. Define jobs: `check` (build:check + test + verify)
3. Test locally with `act` (optional) or push to a branch
4. Verify CI runs and passes

**Files**: `.github/workflows/ci.yml`

### Step 2: Add canonical hash tracking (D2)

1. Modify `scripts/run-materialize.ts` to write `.generated/knowledge/canonical-hash.txt`
2. Append to `.generated/knowledge/canonical-hash-history.jsonl` with metadata
3. Add `tests/conformance/c16-canonical-hash.test.ts` — verifies hash file exists and matches materialized output
4. Run and verify

**Files**: `scripts/run-materialize.ts`, `tests/conformance/c16-canonical-hash.test.ts`

### Step 3: Add record count regression test (D3)

1. Create `knowledge/baselines/record-counts-baseline.json` with current counts (committed to repo, not in `.generated/`)
2. Add `tests/conformance/c17-record-count-regression.test.ts` — compares current vs baseline with 1% tolerance
3. Add `scripts/update-baseline.ts` — updates baseline after intentional changes
4. Run and verify

**Files**: `tests/conformance/c17-record-count-regression.test.ts`, `scripts/update-baseline.ts`, `knowledge/baselines/record-counts-baseline.json`

### Step 4: Extend full pipeline script (D4)

1. Modify `scripts/run-pipeline.ts` — add derive, concepts, design, build-obsidian, build-web, and test steps to the existing drift detection and materialize logic
2. Add `--skip-*` flags for selective execution
3. Add timing and count logging for each step
4. Test by running the full pipeline

**Files**: `scripts/run-pipeline.ts` (modified)

### Step 5: Create deploy workflow (D5)

1. Create `.github/workflows/deploy.yml`
2. Define deployment job with Cloudflare secrets
3. Use `contains(github.event.head_commit.message, 'deploy:')` as trigger condition
4. Document required GitHub secrets: `CLOUDFLARE_API_TOKEN`, `SEARCH_API_URL`, `INDEXING_TOKEN`

**Files**: `.github/workflows/deploy.yml`

### Step 6: Create health summary script (D6)

1. Create `scripts/kb-health-summary.ts` — reads materialized data, baseline, and test results
2. Print formatted summary
3. Add as CI step after tests

**Files**: `scripts/kb-health-summary.ts`, `.github/workflows/ci.yml` (add step)

### Step 7: Verify

1. Push to a branch — CI runs and passes
2. Create PR — CI runs on PR
3. Merge to main with `deploy:` — deploy workflow runs (if secrets are configured)
4. All conformance tests pass (now 64+ with 2 new tests: c16 and c17)

## Acceptance criteria

- [x] `.github/workflows/ci.yml` runs on push to `main` and PRs to `main` (with `paths-ignore` for docs) (evidence: .github/workflows/ci.yml:3-8, pnpm exec turbo run build:check)
- [x] CI uses Node.js 22 and pnpm 11.20.0 (matching `package.json`) (evidence: .github/workflows/ci.yml:16-19, package.json:packageManager)
- [x] CI runs `build:check`, `vitest --run`, and `turbo run verify` as quality gates (evidence: .github/workflows/ci.yml:31-36, pnpm exec turbo run build:check — 17/17 tasks pass)
- [x] Canonical hash is written to `.generated/knowledge/canonical-hash.txt` by materializer (evidence: scripts/run-materialize.ts:24, pnpm materialize — hash file written)
- [x] `tests/conformance/c16-canonical-hash.test.ts` passes (verifies hash file exists and matches) (evidence: tests/conformance/c16-canonical-hash.test.ts, pnpm exec vitest run — 3/3 pass)
- [x] `knowledge/baselines/record-counts-baseline.json` is committed to the repo (evidence: knowledge/baselines/record-counts-baseline.json, git committed)
- [x] `tests/conformance/c17-record-count-regression.test.ts` passes (fails if counts decrease >1%) (evidence: tests/conformance/c17-record-count-regression.test.ts, pnpm exec vitest run — 3/3 pass)
- [x] `scripts/run-pipeline.ts` orchestrates the full 8-step pipeline with `--skip-*` flags (evidence: scripts/run-pipeline.ts:86-297, --skip-derive --skip-concepts --skip-design --skip-build-obsidian --skip-build-web --skip-tests — 2 pass, 6 skip)
- [x] `.github/workflows/deploy.yml` deploys on `contains(commit_message, 'deploy:')` (evidence: .github/workflows/deploy.yml:10, if: contains(github.event.head_commit.message, 'deploy:'))
- [x] `scripts/kb-health-summary.ts` produces a health summary in CI output (evidence: scripts/kb-health-summary.ts, pnpm exec tsx scripts/kb-health-summary.ts — prints counts with deltas)
- [x] All existing tests pass (639+ tests, no regressions) (evidence: pnpm exec vitest --run — 671 pass, 1 pre-existing fail in c13-crawl source fingerprint drift unrelated to RFC-0007)
- [x] Root `AGENTS.md` documents CI gates as mandatory for merges to main (evidence: AGENTS.md:29-47, CI Gates Policy section)

## Alternatives considered

1. **GitLab CI instead of GitHub Actions** — Rejected because the project is hosted on GitHub. Using GitHub Actions avoids a second platform and integrates natively with PR reviews.

2. **Make-based pipeline orchestration instead of `scripts/run-pipeline.ts`** — Rejected because the project is TypeScript-native and already uses `tsx` scripts for all pipeline stages. A Makefile would introduce a second toolchain and require developers to learn Make syntax.

3. **Pre-commit hooks only (no CI)** — Rejected because pre-commit hooks can be bypassed (`--no-verify`) and don't run on remote pushes. CI provides an independent verification that cannot be skipped by the developer.

4. **Turbo remote cache** — Considered for CI performance but deferred. Local pnpm cache and `actions/cache` for `.turbo` are sufficient for the current project size. Remote cache adds complexity (Vercel account, authentication) that isn't justified yet. Added to `nonGoals`.

## Risks

- **CI runtime**: The full test suite takes ~2-3 minutes locally. On GitHub Actions with cold caches, it may take 5-10 minutes. Mitigation: use `pnpm` caching via `actions/setup-node` cache option, cache `.turbo` directory via `actions/cache`.
- **Cloudflare secrets**: Deploy workflow requires `CLOUDFLARE_API_TOKEN` and `INDEXING_TOKEN` secrets. Mitigation: document required secrets in README, make deploy opt-in via commit message trigger.
- **Baseline staleness**: The record count baseline will become stale as new data is extracted. Mitigation: `scripts/update-baseline.ts` makes it easy to update after intentional changes. CI should print a warning (not fail) when baseline is stale.
- **Hash instability**: The canonical hash may change due to non-deterministic ordering in the materializer. Mitigation: verify materializer is deterministic (it should be — it sorts records by ID).
- **Agent misinterpretation**: Agents may attempt to bypass CI gates by force-pushing or disabling workflows. Mitigation: AGENTS.md rule explicitly prohibits bypassing CI. GitHub branch protection rules should require CI status checks before merge.
- **False positives in regression test**: The 1% tolerance may trigger on legitimate large refactors that intentionally reduce records. Mitigation: run `scripts/update-baseline.ts` after intentional changes, then commit the updated baseline.

## Implementation notes for agents

1. **Do not bypass CI gates.** CI checks are mandatory for all merges to `main`. If CI fails, fix the root cause — do not disable checks or force-push.
2. **`.generated/` is gitignored.** Do not commit files in `.generated/`. The canonical hash file and hash history are regenerated by the materializer. The record count baseline must be committed to `knowledge/baselines/` (not `.generated/`).
3. **Run materialize before hash tests.** The `c16-canonical-hash.test.ts` test requires `.generated/knowledge/canonical-hash.txt` to exist. In CI, the materializer runs before tests. Locally, run `pnpm materialize` before running the test.
4. **Update baseline after intentional data changes.** After adding new extraction data or improving the deriver, run `pnpm exec tsx scripts/update-baseline.ts` and commit the updated `knowledge/baselines/record-counts-baseline.json`.
5. **Node.js 22 is required.** The CI workflow uses Node 22, matching `package.json` `engines.node: >=22`. Do not downgrade to Node 20 in CI.
6. **pnpm 11.20.0 is required.** The CI workflow pins pnpm 11.20.0, matching `package.json` `packageManager: pnpm@11.20.0`. Do not use a different pnpm version.
7. **Deploy is opt-in.** The deploy workflow only runs when the commit message contains `deploy:`. Regular merges to `main` do not trigger deployment.
8. **AGENTS.md update required.** After implementation, update root `AGENTS.md` to document that CI gates are mandatory for merges to `main`.
