---
rfcId: RFC-0007
auditId: AUDIT-RFC-0007-01
date: 2026-08-23
auditor:
  skill: fo-idea-audit
  model: claude-sonnet-4-20250514
verdict: needs-revision
---

# Audit: RFC-0007

## Verdict: Needs revision

RFC-0007 has a V-24 error (missing DNA invariant declaration), 5 missing required sections (V-13), a test filename collision with an existing conformance test, a Node.js version mismatch between the proposed CI workflow and `package.json`, invalid GitHub Actions syntax in the deploy workflow, and fails to acknowledge the already-existing `scripts/run-pipeline.ts`. The RFC also has empty `appsImpacted`/`packagesImpacted`/`commands.proposed` despite proposing scripts and deployment workflows that touch multiple apps.

## Mechanical validation (rfc.validate)

**Fail** — 1 error, 5 warnings:

- **V-24 (error)**: architecture RFC created 2026-08-23 (>= 2026-07-07) must declare at least one DNA invariant in `satisfies`.
- **V-13 (warning)**: Missing required sections: "Architectural fit", "Design", "Rollout", "Alternatives considered", "Implementation notes for agents".

## Axis A — Structural completeness

1. **Missing "Architectural fit" section** — No explanation of how this RFC fits with RFC-0001's extraction methodology, PLAN-003's enrichment pipeline, or the existing turbo monorepo task graph.

2. **Missing "Design" section** — No TypeScript contracts or file system responsibilities table. The RFC proposes modifying `scripts/run-materialize.ts` and creating `scripts/run-pipeline.ts`, `scripts/update-baseline.ts`, `scripts/kb-health-summary.ts` but doesn't document their interfaces, types, or exact file paths in a structured table.

3. **Missing "Rollout" section** — No description of how the project transitions from manual to CI/CD. Questions unanswered: Are existing developers required to set up GitHub secrets immediately? What happens to the pre-commit hook? Does the CI pipeline replace or complement the pre-commit hook?

4. **Missing "Alternatives considered" section** — No alternatives documented. Real alternatives exist: GitLab CI, local-only pre-commit hooks (already partially implemented), Make-based orchestration vs. `scripts/run-pipeline.ts`.

5. **Missing "Implementation notes for agents" section** — No behavioral rules for agents implementing this RFC. Agents need to know: should `.generated/` files be committed or gitignored? Should the CI workflow be tested with `act` before pushing? How should secrets be documented?

6. **"Decision" is a wishlist, not a single decision** — The RFC presents 6 separate decisions (D1–D6) rather than a single architectural decision in present tense. Each D-section reads as a mini-RFC. The RFC should either be split or present a unified decision with sub-components.

7. **No "Failure modes" specification** — The RFC doesn't specify exit codes or warn-vs-fail behavior for the new scripts. For example: should `kb-health-summary.ts` exit non-zero if record counts decrease, or just print a warning?

8. **Acceptance criteria are mostly checkable** but "All existing tests pass (no regressions)" is vague — which tests, how many, and what constitutes a regression?

## Axis B — DNA alignment

1. **`satisfies: []` is empty (V-24 error)** — This is an architecture RFC created after 2026-07-07. It must declare at least one DNA invariant. However, `forge.yaml` shows `bindings.paths.invariantsFile: null` — no DNA invariants file exists in this project. The RFC should either declare a self-referential DNA invariant (e.g., "CI gates are mandatory for all merges") or acknowledge that the project hasn't adopted DNA invariants yet and request a waiver.

2. **`related: [RFC-0001, PLAN-003]`** — relevant but the RFC body doesn't explain the relationship. RFC-0001 defines extraction methodology; this RFC adds CI gates that enforce it. PLAN-003 covers enrichment; this RFC automates its pipeline. These connections should be explicit.

## Axis C — Ecosystem fit

1. **`appsImpacted: []` is incorrect** — The deploy workflow (D5) explicitly deploys `apps/search-api` and references `apps/mcp`. Both should be listed in `appsImpacted`.

2. **`packagesImpacted: []` is incorrect** — The RFC modifies `scripts/run-materialize.ts` which imports from `packages/materializer`. The CI pipeline runs `turbo run build:check` across all packages. At minimum `materializer` is impacted.

3. **`commands.proposed: []` is incorrect** — The RFC proposes 3 new scripts: `scripts/run-pipeline.ts` (D4), `scripts/update-baseline.ts` (D3), `scripts/kb-health-summary.ts` (D6). These should be listed in `commands.proposed`.

4. **AGENTS.md updates not addressed** — If CI gates become mandatory, the root `AGENTS.md` should document that agents must not bypass CI checks. The RFC doesn't mention this.

5. **Turbo task graph** — The RFC correctly references existing turbo tasks (`build:check`, `verify`). No new turbo tasks are proposed, which is appropriate.

## Axis D — Forward-only compliance

No issues. The RFC proposes new infrastructure without backward compatibility layers or dual-path migrations. The pre-commit hook is not deprecated — it coexists with CI, which is additive rather than a compatibility shim.

## Axis E — Agent-facing policy

1. **No self-authorizing language** — Good. The RFC doesn't grant implementation permission while in draft.

2. **No NEEDS CLARIFICATION markers** — Good.

3. **`.generated/` persistence unclear** — The RFC proposes storing `canonical-hash.txt` and `record-counts-baseline.json` in `.generated/knowledge/`. If `.generated/` is gitignored (as is typical), these files won't persist in the repo and CI won't have access to them. The RFC must clarify: are these files committed to the repo, or generated fresh in CI? If committed, they need to be outside `.generated/` or explicitly un-ignored.

## Axis F — Pragmatism

1. **`scripts/run-pipeline.ts` already exists** — The RFC proposes creating it (D4, Step 4) but `scripts/run-pipeline.ts` already exists at 121 lines with source drift detection and materialize logic. The RFC should acknowledge the existing script and propose extending it (adding `--skip-*` flags, timing, 8-step orchestration) rather than creating it from scratch.

2. **Test filename collision** — The RFC proposes `tests/conformance/c14-canonical-hash.test.ts` (D2), but `tests/conformance/c14-concept-ref-integrity.test.ts` already exists. The new test should be `c16-canonical-hash.test.ts` (c15 is also proposed by D3).

3. **Invalid GitHub Actions syntax in deploy workflow** — Line 192: `if: github.event.head_commit.message contains 'deploy:'` is not valid GitHub Actions expression syntax. It should be `if: contains(github.event.head_commit.message, 'deploy:')`.

4. **Redundant deploy trigger** — The deploy workflow has both a `paths` filter and an `if` condition checking for `deploy:` in the commit message. The `paths` filter restricts which pushes trigger the workflow, but the `if` condition on the job further restricts execution. This is overly complex — pick one trigger mechanism.

5. **`appsImpacted`/`packagesImpacted`/`commands.proposed` all empty** despite clear impact — see Axis C findings.

## Axis G — Blind spots

1. **Node.js version mismatch** — `package.json` declares `"engines": { "node": ">=22" }` but the CI workflow (D1) uses `node-version: 20`. This will cause CI to fail or produce inconsistent behavior. The CI should use `node-version: 22` (or read from `.nvmrc`/`package.json`).

2. **pnpm version not pinned in CI** — `package.json` specifies `packageManager: pnpm@11.20.0` but the CI workflow uses `pnpm/action-setup@v2` without specifying a version. This may cause lockfile incompatibility. Should use `pnpm/action-setup@v4` with `version: 11.20.0` or rely on `packageManager` field detection.

3. **`.generated/` in CI** — If `.generated/` is gitignored, the canonical hash file, hash history, and baseline file won't be available in CI. The RFC doesn't address how CI accesses or creates these files. Options: (a) commit them to the repo outside `.generated/`, (b) run the materializer in CI before the tests, (c) store them as CI artifacts. The RFC must choose one.

4. **CI cold cache performance** — The risks section mentions 5-10 minutes on cold caches but doesn't propose mitigation beyond pnpm caching. Turbo remote cache is not mentioned. For a monorepo with 15+ packages, turbo remote cache (or at least `actions/cache` for `.turbo` directory) would significantly reduce CI time.

5. **No `paths` filter on CI workflow** — The CI workflow runs on every push to `main` and every PR to `main`. For a monorepo, this means every push runs the full test suite even if only docs changed. Consider adding `paths-ignore` for `docs/**`, `**/*.md`, etc.

6. **Secret management for local development** — The RFC documents GitHub secrets for deployment but doesn't address how developers test deployment locally. The `.env.example` pattern is used for search-api but not mentioned for the deploy workflow.

## Questions for the author

1. Should `.generated/knowledge/canonical-hash.txt` and `record-counts-baseline.json` be committed to the repo or generated in CI? If committed, how do they survive `.generated/` being gitignored?

2. The existing `scripts/run-pipeline.ts` already handles drift detection and materialization. Should D4 extend it or replace it? If extend, what specific capabilities are missing?

3. The test `c14-canonical-hash.test.ts` collides with the existing `c14-concept-ref-integrity.test.ts`. What should the correct numbering be?

4. Should the CI workflow use Node.js 22 (matching `package.json` engines) or should `package.json` be updated to support Node.js 20?

5. What DNA invariant does this RFC establish or enforce? If the project hasn't adopted DNA invariants, should this RFC declare one (e.g., "CI gates are mandatory for all merges to main")?
