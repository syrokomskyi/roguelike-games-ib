# Contributing

## Candidate/Promotion Workflow

1. **Extractors** create factual candidates in `staging/candidates/`
2. **AI** creates semantic candidates in `staging/candidates/`
3. **Promotion engine** is the only service allowed to mutate `knowledge/` programmatically
4. **Direct canonical edits** are not permitted through projections

## Extractor Package Location

All game-specific extractor packages MUST live under `packages/extractors/`. Do not create extractor packages directly in `packages/`. The `packages/extractors/` directory is registered in `pnpm-workspace.yaml` as a workspace glob.

## Extractor Creation

Use the `fo-create-extractor` skill (`.agents/skills/fo-create-extractor/`) when creating a new game-specific extractor. The skill guides the full workflow: source analysis, parser implementation, population denominators, and quality testing.

Quality tests for extractors live in `tests/extractor-quality/`. Import `runQualityChecks` from `harness.ts` and create a `<game>-quality.test.ts` file that validates the extractor against six quality dimensions (determinism, population completeness, evidence coverage, schema validation, record loss, performance). See ADR-0003 for details.

## No Direct Projection Edits

Projection outputs (Obsidian, Web, MCP) are disposable. Rebuilding them from canonical knowledge must be sufficient. Never edit canonical files through projection tools.

## Source Safety

Source repositories in `../roguelike-games-ib-source/` are read-only. Never execute code from source repositories during extraction.

## Governance

- Global ontology/normative semantic changes require RFC
- Governed cross-game concepts require ADR or RFC according to semantic impact
- See `docs/adrs/` and `docs/rfcs/` for decision records
