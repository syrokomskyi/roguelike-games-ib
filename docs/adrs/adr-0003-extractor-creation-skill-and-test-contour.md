---
id: ADR-0003
title: Extractor creation skill and quality test contour
status: accepted
scope: project-wide
decider: architecture
reviewers:
  - human:andrii-syrokomskyi
related:
  - ADR-0001
created: 2026-08-21
accepted: 2026-08-21
implementedAt: null
closedAt: null
---

# ADR-0003: Extractor creation skill and quality test contour

## Context

The project has three game-specific extractors (nethack, broguece, cataclysm-bn) under `packages/extractors/`. Each was written manually by an AI agent. The process is repetitive: analyze source files, identify record kinds, estimate population denominators, write a parser, wire it into the `Extractor` interface, and verify quality.

There is no codified guidance for agents creating new extractors. Quality verification is split across `tests/extract/` (SDK-level tests with synthetic data) and `tests/conformance/` (game-specific tests against real source). Neither provides a reusable quality contour that an agent can run to get immediate feedback on a new extractor.

## Decision

Create two artifacts:

1. **Skill `fo-create-extractor`** — a FORGE skill in `.agents/skills/` that guides an agent through the full extractor creation workflow. Uses the cumulative knowledge pattern (L0/L1/L2) to accumulate learnings across extractor creation sessions.

2. **Quality test contour `tests/extractor-quality/`** — a dedicated test directory with a reusable harness (`harness.ts`) and universal quality checks. Agents import the harness to create a `<game>-quality.test.ts` file that validates their extractor against six quality dimensions.

## Skill design

- **Category**: `wg` (project-specific)
- **Invocation**: `user`
- **Concerns**: `code-mutation`
- **Knowledge files**:
  - `qa-log.md` (L0) — questions and answers during extractor creation sessions
  - `fix-patterns.md` (L1) — recurring error patterns and their fixes
  - `learned-principles.md` (L2) — distilled principles with confirmation counters

The skill body covers: source analysis, record kind selection, population denominator estimation, parser implementation, extractor wiring, quality test creation, and self-verification.

## Test contour design

Six quality dimensions, each implemented as a reusable function in `harness.ts`:

| Dimension | What it checks |
| --- | --- |
| Determinism | Two runs produce identical normalized hashes |
| Population completeness | `extracted == expected` for every declared population dimension |
| Evidence coverage | Every staged record has at least one evidence anchor |
| Schema validation | All records pass schema facade validation (or diagnostics are emitted) |
| Record loss | No unexpected record loss vs previous run (threshold-based) |
| Performance | Extractor completes within a configurable time budget |

The harness accepts an `Extractor` instance and a context factory, making it game-agnostic. Agents create a `<game>-quality.test.ts` that imports the harness and plugs in their extractor + source binding.

## Justification

- Codifying the creation process reduces variance between extractors written by different agents
- Cumulative knowledge captures hard-won insights (e.g., "don't forget to exclude sentinel entries from population counts")
- A dedicated quality contour gives agents immediate, structured feedback — separate from SDK tests and conformance trials
- The harness is reusable, so each new extractor gets the same quality checks without copy-pasting test boilerplate

## Consequences

**Positive:**
- New extractors follow a proven workflow with accumulated learnings
- Quality is measured consistently across all extractors
- Agents get fast feedback during development

**Negative:**
- The skill and harness must be maintained as the SDK evolves
- Agents must be instructed to use the skill (not bypass it)

## Evolution

- If the SDK gains new capabilities (e.g., streaming, incremental extraction), the skill and harness must be updated
- Quality dimensions may be added or refined based on production experience
