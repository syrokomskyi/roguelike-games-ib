# Contributing

## Candidate/Promotion Workflow

1. **Extractors** create factual candidates in `staging/candidates/`
2. **AI** creates semantic candidates in `staging/candidates/`
3. **Promotion engine** is the only service allowed to mutate `knowledge/` programmatically
4. **Direct canonical edits** are not permitted through projections

## Extractor Package Location

All game-specific extractor packages MUST live under `packages/extractors/`. Do not create extractor packages directly in `packages/`. The `packages/extractors/` directory is registered in `pnpm-workspace.yaml` as a workspace glob.

## No Direct Projection Edits

Projection outputs (Obsidian, Web, MCP) are disposable. Rebuilding them from canonical knowledge must be sufficient. Never edit canonical files through projection tools.

## Source Safety

Source repositories in `../roguelike-games-ib-source/` are read-only. Never execute code from source repositories during extraction.

## Governance

- Global ontology/normative semantic changes require RFC
- Governed cross-game concepts require ADR or RFC according to semantic impact
- See `docs/adrs/` and `docs/rfcs/` for decision records
