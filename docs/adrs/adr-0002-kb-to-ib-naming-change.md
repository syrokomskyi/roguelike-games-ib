---
id: ADR-0002
title: Rename Knowledge Base (KB) to Inspiration Base (IB)
status: implemented
scope: project-wide
decider: architecture
reviewers:
  - human:andrii-syrokomskyi
related:
  - ADR-0001
created: 2026-08-21
accepted: 2026-08-21
implementedAt: 2026-08-21
closedAt: null
---

# ADR-0002: Rename Knowledge Base (KB) to Inspiration Base (IB)

## Context

The project was originally specified as `roguelike-games-kb` (Knowledge Base). The operator has redefined the concept from "Knowledge Base" to "Inspiration Base" to better reflect the project's purpose: drawing creative inspiration from roguelike games and channeling it toward artists.

The implementation specification and formal foundation use "KB" naming throughout. This ADR records the systematic renaming and its scope.

## Decision

Rename all project-facing identifiers from KB to IB:

- Repository/project id: `roguelike-games-kb` → `roguelike-games-ib`
- Source sibling: `roguelike-games-kb-source` → `roguelike-games-ib-source`
- Record URN prefix: `urn:roguelike-games-kb:record:` → `urn:roguelike-games-ib:record:`
- Package scope: `@roguelike-games-kb/` → `@roguelike-games-ib/`
- Config key: `knowledge_base_id: roguelike-games-kb` → `knowledge_base_id: roguelike-games-ib`
- Manifest id: `roguelike-games-kb` → `roguelike-games-ib`

Unchanged:
- Schema namespace prefix `rgkb` in `$id` URNs (e.g. `urn:rgkb:schema:...`) — this is a schema namespace, not a project name
- Schema version identifiers (e.g. `rgkb/knowledge-manifest@2`)
- Vendored formal foundation files remain as-is for reference provenance

## Justification

- The project's purpose is inspiration, not just knowledge storage
- The operator explicitly requested this naming change
- The change is cosmetic and does not alter authority, evidence, or promotion semantics

## Consequences

**Positive:**
- Project naming aligns with its creative purpose

**Negative:**
- Vendored formal foundation schemas contain `const: roguelike-games-kb` values that must be adapted in canonical copies
- Record ID patterns in schemas must use `roguelike-games-ib` instead of `roguelike-games-kb`

## Evolution

- If the project reverts to KB naming, update this ADR and reverse the changes
