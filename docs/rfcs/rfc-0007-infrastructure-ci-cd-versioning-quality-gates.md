---
id: RFC-0007
title: "Infrastructure — CI/CD pipeline, canonical versioning, and quality gates"
status: draft
kind: architecture
scope: workspace
owners:
  - architecture
reviewers:
  - human:andrii-syrokomskyi
createdAt: 2026-08-23
updatedAt: 2026-08-23
implementedAt:
closedAt:
supersedes: []
supersededBy:
amends: []
amendedBy:
related:
  - RFC-0001
  - PLAN-003
satisfies: []
versionBump: minor
commands:
  proposed: []
  added: []
  changed: []
  removed: []
appsImpacted: []
packagesImpacted: []
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
---

# RFC-0007: Infrastructure — CI/CD pipeline, canonical versioning, and quality gates

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

### D1: GitHub Actions CI pipeline

Create `.github/workflows/ci.yml` that runs on every push and PR:

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec turbo run build:check
      - run: pnpm exec vitest --run
      - run: pnpm exec turbo run verify
```

**Quality gates** (all must pass for green status):
1. `build:check` — TypeScript compiles for all packages
2. `vitest --run` — all 639+ tests pass
3. `turbo run verify` — verification checks pass

**Files**: `.github/workflows/ci.yml`

### D2: Canonical hash tracking

Add a hash tracking system that stores the canonical hash in a versioned file and compares it across builds:

1. **Hash file**: `.generated/knowledge/canonical-hash.txt` — contains the current canonical hash
2. **Hash history**: `.generated/knowledge/canonical-hash-history.jsonl` — append-only log of `{ hash, timestamp, commit_sha, record_count, claim_count, relation_count }`
3. **CI check**: a new test that compares the current hash against the last recorded hash. If the hash changes, the test prints a diff summary (record count delta, claim count delta, etc.)

**Implementation**:
- Modify `scripts/run-materialize.ts` to write the hash file and append to history
- Add `tests/conformance/c14-canonical-hash.test.ts` that reads the hash file and verifies it matches the materialized output
- Add a CI step that runs the materializer and checks if the hash changed (informational, not blocking)

**Files**: `scripts/run-materialize.ts`, `tests/conformance/c14-canonical-hash.test.ts`

### D3: Record count regression detection

Add a test that compares current record counts against a baseline file:

1. **Baseline file**: `.generated/knowledge/record-counts-baseline.json` — `{ definitions: 20500, claims: 112772, relations: 35438, semantic_records: 1033, concepts: 74 }`
2. **Test**: `tests/conformance/c15-record-count-regression.test.ts` — fails if any count decreases by more than 1% from baseline
3. **Update baseline**: a script `scripts/update-baseline.ts` that updates the baseline file after intentional changes (e.g., new extraction)

**Files**: `tests/conformance/c15-record-count-regression.test.ts`, `scripts/update-baseline.ts`

### D4: Full pipeline script

Create `scripts/run-pipeline.ts` that orchestrates the full pipeline in order:

```typescript
// 1. Extract (if source changed)
// 2. Derive (claims, relations, semantic records)
// 3. Generate concepts
// 4. Generate design primitives
// 5. Materialize
// 6. Build Obsidian vault
// 7. Build web app
// 8. Run tests
```

Each step:
- Checks if the previous step succeeded
- Logs timing and output counts
- Can be skipped with `--skip-extract`, `--skip-derive`, etc. flags
- Fails fast if any step errors

**Files**: `scripts/run-pipeline.ts`

### D5: Deploy workflow

Create `.github/workflows/deploy.yml` that deploys on merge to `main`:

```yaml
name: Deploy
on:
  push:
    branches: [main]
    paths:
      - 'apps/search-api/**'
      - 'apps/mcp/**'
      - 'knowledge/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    if: github.event.head_commit.message contains 'deploy:'
    steps:
      - uses: actions/checkout@v4
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

**Trigger**: only runs when commit message contains `deploy:` (opt-in deployment, not every merge).

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
3. Add `tests/conformance/c14-canonical-hash.test.ts` — verifies hash file exists and matches materialized output
4. Run and verify

**Files**: `scripts/run-materialize.ts`, `tests/conformance/c14-canonical-hash.test.ts`

### Step 3: Add record count regression test (D3)

1. Create `.generated/knowledge/record-counts-baseline.json` with current counts
2. Add `tests/conformance/c15-record-count-regression.test.ts` — compares current vs baseline with 1% tolerance
3. Add `scripts/update-baseline.ts` — updates baseline after intentional changes
4. Run and verify

**Files**: `tests/conformance/c15-record-count-regression.test.ts`, `scripts/update-baseline.ts`

### Step 4: Create full pipeline script (D4)

1. Create `scripts/run-pipeline.ts` — orchestrates all 8 steps
2. Add `--skip-*` flags for selective execution
3. Add timing and count logging
4. Test by running the full pipeline

**Files**: `scripts/run-pipeline.ts`

### Step 5: Create deploy workflow (D5)

1. Create `.github/workflows/deploy.yml`
2. Define deployment job with Cloudflare secrets
3. Add `deploy:` commit message trigger
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
4. All conformance tests pass (now 62+ with 2 new tests)

## Acceptance criteria

- [ ] `.github/workflows/ci.yml` runs on push and PR
- [ ] CI runs `build:check`, `vitest --run`, and `turbo run verify`
- [ ] Canonical hash is written to file and tracked in history
- [ ] `c14-canonical-hash.test.ts` passes
- [ ] Record count baseline file exists and `c15-record-count-regression.test.ts` passes
- [ ] `scripts/run-pipeline.ts` orchestrates the full 8-step pipeline
- [ ] `.github/workflows/deploy.yml` deploys on `deploy:` commit messages
- [ ] `scripts/kb-health-summary.ts` produces a health summary
- [ ] All existing tests pass (no regressions)

## Risks

- **CI runtime**: The full test suite takes ~2-3 minutes locally. On GitHub Actions with cold caches, it may take 5-10 minutes. Mitigation: use `pnpm` caching, split tests into parallel jobs if needed.
- **Cloudflare secrets**: Deploy workflow requires `CLOUDFLARE_API_TOKEN` and `INDEXING_TOKEN` secrets. Mitigation: document required secrets in README, make deploy opt-in.
- **Baseline staleness**: The record count baseline will become stale as new data is extracted. Mitigation: `scripts/update-baseline.ts` makes it easy to update after intentional changes. CI should print a warning (not fail) when baseline is stale.
- **Hash instability**: The canonical hash may change due to non-deterministic ordering in the materializer. Mitigation: verify materializer is deterministic (it should be — it sorts records by ID).
