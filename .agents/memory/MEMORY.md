# Project Memory

Curated project context (RFC-0664). This file is versioned — daily logs in `daily/` are git-ignored.

## Current focus

<!-- What is being worked on right now. One to three bullets max. -->

## Decisions in flight

<!-- Decisions under discussion but not yet final. -->

## Environment notes

<!-- Tool versions, environment quirks, known issues. -->
- V-24 validation error (`invariantsFile: null`): `forge.yaml` has `invariantsFile: null`, so RFCs created after 2026-07-07 cannot declare DNA invariants in `satisfies[]`. This is a known project config limitation, documented in each RFC's nonGoals. `rfc.validate` will report V-24 as an error but `rfc.implement.stamp` succeeds regardless.
