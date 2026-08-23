---
id: PLAN-RFC-0007
rfcId: RFC-0007
title: "Infrastructure — CI/CD pipeline, canonical versioning, and quality gates"
status: accepted
scope: workspace
decider: architecture
reviewers:
  - human:andrii-syrokomskyi
related:
  - RFC-0007
  - RFC-0001
  - PLAN-003
created: 2026-08-23
accepted: 2026-08-23
implementedAt:
closedAt: null
---

# PLAN-RFC-0007: Infrastructure — CI/CD pipeline, canonical versioning, and quality gates

## Objectives

1. Create GitHub Actions CI workflow with quality gates (build:check, vitest, verify)
2. Add canonical hash tracking via materializer output
3. Add record count regression detection with committed baseline
4. Extend existing `scripts/run-pipeline.ts` with full 8-step orchestration
5. Create GitHub Actions deploy workflow (opt-in via commit message)
6. Create KB health summary script for CI output
7. Update AGENTS.md with CI gate policy

## Key design decisions

- **CI runs tests only, not the full pipeline.** The design stage (`run-stage-design.ts`) requires `OPENAI_API_KEY` for LLM calls. CI runs: materialize → build:check → vitest → verify → health summary. The full pipeline (`run-pipeline.ts`) is for local/manual use.
- **Materialize runs in CI before tests** to generate `.generated/knowledge/canonical-hash.txt` for the c16 test. The materializer reads from the committed `knowledge/` directory — no API key needed.
- **Baseline file is committed to `knowledge/baselines/`** (not `.generated/` which is gitignored).
- **Test numbering**: c16 (canonical hash), c17 (record count regression) — c14 and c15 are already taken.

## Steps

### Step 1: Create CI workflow (D1)

**Actions:**
1. Create `.github/workflows/ci.yml`
2. Define `check` job: checkout → pnpm setup (v4, 11.20.0) → Node 22 → install → materialize → build:check → vitest → verify → health summary
3. Add `paths-ignore` for `docs/**`, `**/*.md`, `LICENSE`
4. Add `actions/cache` for `.turbo` directory

**Completion criterion:** `.github/workflows/ci.yml` exists and is valid YAML. The workflow runs on push to `main` and PRs to `main`.

**Files:** `.github/workflows/ci.yml`

### Step 2: Add canonical hash tracking (D2)

**Actions:**
1. Modify `scripts/run-materialize.ts` to write `.generated/knowledge/canonical-hash.txt` with the canonical hash from `MaterializationResult.canonicalHash`
2. Append to `.generated/knowledge/canonical-hash-history.jsonl` with `{ hash, timestamp, commit_sha, record_count, claim_count, relation_count }` (use `git rev-parse HEAD` for commit_sha)
3. Create `tests/conformance/c16-canonical-hash.test.ts`:
   - Skip if `.generated/knowledge/canonical-hash.txt` does not exist (with message "Run materialize first")
   - Read hash file
   - Read materialized manifest from `.generated/knowledge/dist/manifest.json`
   - Assert hash file content matches `manifest.canonicalHash`
4. Run materialize and verify hash file is created
5. Run c16 test and verify it passes

**Completion criterion:** `pnpm materialize` creates `.generated/knowledge/canonical-hash.txt`. `pnpm exec vitest run tests/conformance/c16-canonical-hash.test.ts` passes.

**Files:** `scripts/run-materialize.ts`, `tests/conformance/c16-canonical-hash.test.ts`

### Step 3: Add record count regression test (D3)

**Actions:**
1. Create `knowledge/baselines/` directory
2. Run materialize and capture current record counts from `.generated/knowledge/dist/manifest.json`
3. Create `knowledge/baselines/record-counts-baseline.json` with current counts
4. Create `scripts/update-baseline.ts`:
   - Read `.generated/knowledge/dist/manifest.json`
   - Write counts to `knowledge/baselines/record-counts-baseline.json`
   - Print summary
5. Create `tests/conformance/c17-record-count-regression.test.ts`:
   - Read baseline from `knowledge/baselines/record-counts-baseline.json`
   - Read current counts from `.generated/knowledge/dist/manifest.json` (skip if missing)
   - For each dimension, fail if current < baseline * 0.99 (1% tolerance)
   - Print delta summary on failure
6. Run c17 test and verify it passes

**Completion criterion:** `knowledge/baselines/record-counts-baseline.json` exists and is committed. `pnpm exec vitest run tests/conformance/c17-record-count-regression.test.ts` passes. `pnpm exec tsx scripts/update-baseline.ts` updates the baseline file.

**Files:** `knowledge/baselines/record-counts-baseline.json`, `scripts/update-baseline.ts`, `tests/conformance/c17-record-count-regression.test.ts`

### Step 4: Extend full pipeline script (D4)

**Actions:**
1. Modify `scripts/run-pipeline.ts` to add steps after existing drift detection + materialize:
   - Step 2: Run `scripts/run-stage-deriver.ts` (skip with `--skip-derive`)
   - Step 3: Run `scripts/run-stage-concepts.ts` (skip with `--skip-concepts`)
   - Step 4: Run `scripts/run-stage-design.ts` (skip with `--skip-design`, warn if `OPENAI_API_KEY` missing)
   - Step 5: Existing materialize logic (skip with `--skip-materialize`)
   - Step 6: Run `scripts/run-build-obsidian.ts` (skip with `--skip-build-obsidian`)
   - Step 7: Run `scripts/run-build-web.ts` (skip with `--skip-build-web`)
   - Step 8: Run `pnpm exec vitest --run` (skip with `--skip-tests`)
2. Add timing logging (record `durationMs` for each step)
3. Add count logging (print record counts after materialize, note counts after build)
4. Parse `--skip-*` flags from `process.argv`
5. Fail fast: if any step exits with non-zero, stop and report
6. Print summary at end: step name, duration, success/fail

**Completion criterion:** `pnpm exec tsx scripts/run-pipeline.ts --skip-derive --skip-concepts --skip-design --skip-build-obsidian --skip-build-web --skip-tests` runs drift detection + materialize only (equivalent to current behavior). Full run with no skips orchestrates all 8 steps.

**Files:** `scripts/run-pipeline.ts` (modified)

### Step 5: Create deploy workflow (D5)

**Actions:**
1. Create `.github/workflows/deploy.yml`
2. Define `deploy` job: checkout → pnpm setup (v4, 11.20.0) → Node 22 → install → build:check → vitest → deploy search-api → index embeddings
3. Use `if: contains(github.event.head_commit.message, 'deploy:')` as job condition
4. Add `CLOUDFLARE_API_TOKEN`, `SEARCH_API_URL`, `INDEXING_TOKEN` as env vars from secrets
5. Document required secrets in `.env.example` comments

**Completion criterion:** `.github/workflows/deploy.yml` exists and is valid YAML. The workflow triggers only on pushes to `main` where commit message contains `deploy:`.

**Files:** `.github/workflows/deploy.yml`

### Step 6: Create health summary script (D6)

**Actions:**
1. Create `scripts/kb-health-summary.ts`:
   - Read `.generated/knowledge/dist/manifest.json` for current counts and canonical hash
   - Read `knowledge/baselines/record-counts-baseline.json` for baseline counts
   - Read `.generated/knowledge/canonical-hash.txt` for current hash
   - Print formatted summary with current vs baseline deltas
   - Exit 0 if materialized data missing (print warning), exit 1 only on internal errors
2. Add as CI step in `.github/workflows/ci.yml` (after verify step)

**Completion criterion:** `pnpm exec tsx scripts/kb-health-summary.ts` prints a formatted health summary. If materialized data exists, shows counts with deltas. If missing, prints warning and exits 0.

**Files:** `scripts/kb-health-summary.ts`, `.github/workflows/ci.yml` (add step)

### Step 7: Update AGENTS.md

**Actions:**
1. Add section to root `AGENTS.md` documenting CI gates policy:
   - CI checks are mandatory for all merges to `main`
   - Agents must not bypass CI checks (no force-push, no disabling workflows)
   - If CI fails, fix the root cause
   - The pre-commit hook coexists with CI for local feedback

**Completion criterion:** Root `AGENTS.md` contains CI gates policy section.

**Files:** `AGENTS.md` (modified)

### Step 8: Validation

**Actions:**
1. Run `pnpm exec forge rfc.validate --id RFC-0007 --json` — must pass
2. Run `pnpm exec turbo run build:check` — must pass (all packages compile)
3. Run `pnpm exec vitest --run` — all tests pass including c16 and c17
4. Run `pnpm exec tsx scripts/kb-health-summary.ts` — prints summary
5. Verify `.github/workflows/ci.yml` and `.github/workflows/deploy.yml` are valid YAML
6. Verify `scripts/run-pipeline.ts --skip-derive --skip-concepts --skip-design --skip-build-obsidian --skip-build-web --skip-tests` works

**Completion criterion:** All validation checks pass. No regressions in existing 639+ tests. Two new tests (c16, c17) pass.

### Step 9: Review & Fix

**Actions:**
1. Run `fo-review` on all code changes made in this session
2. If review has findings, run `fo-fix` to address them
3. Re-run validation after fixes

**Completion criterion:** Review report exists in `docs/reviews/code/`. All findings addressed or explicitly accepted.

### Step 10: Stamp implemented

**Actions:**
1. Run `pnpm exec forge rfc.implement.stamp --id RFC-0007 --implementation-commit <sha>`
2. Verify RFC-0007 status transitions to `implemented`

**Completion criterion:** RFC-0007 `status: implemented` in frontmatter. `implementedAt` set to today's date.

## Acceptance criteria mapping

| Criterion | Step |
|---|---|
| `.github/workflows/ci.yml` runs on push and PR with paths-ignore | Step 1 |
| CI uses Node 22 and pnpm 11.20.0 | Step 1 |
| CI runs build:check, vitest, verify as quality gates | Step 1 |
| Canonical hash written to file by materializer | Step 2 |
| `c16-canonical-hash.test.ts` passes | Step 2, Step 8 |
| `knowledge/baselines/record-counts-baseline.json` committed | Step 3 |
| `c17-record-count-regression.test.ts` passes | Step 3, Step 8 |
| `run-pipeline.ts` orchestrates 8-step pipeline with --skip flags | Step 4 |
| `.github/workflows/deploy.yml` deploys on `deploy:` commit | Step 5 |
| `kb-health-summary.ts` produces health summary | Step 6 |
| All existing tests pass (no regressions) | Step 8 |
| Root AGENTS.md documents CI gates | Step 7 |

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| CI runtime with materialize step | Materialize reads from committed knowledge/ dir — should add <30s. Cache .turbo directory. |
| c16 test fails in CI if materialize fails | Materialize runs as a CI step before tests; if it fails, CI fails fast |
| Baseline staleness after new extraction | `scripts/update-baseline.ts` + commit updated baseline |
| Design stage needs OPENAI_API_KEY | CI does not run design stage — full pipeline is local only |
| Hash instability | Materializer sorts records by ID — deterministic by design |
