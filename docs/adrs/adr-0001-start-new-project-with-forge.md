---
id: ADR-0001
title: Start new project with Forge
status: accepted
scope: workspace
decider: architecture
reviewers:
  - human:andrii-syrokomskyi
related: []
created: 2026-08-21
accepted: 2026-08-21
implementedAt: null
closedAt: null
---

# ADR-0001: Start new project with Forge

## Context

A new knowledge system project — "Knowledge (Inspiration) Base by roguelike games for great Artists" — is being created from scratch. The project uses the `knowledge-typescript-turborepo` Forge profile, which provides a Turborepo monorepo structure with TypeScript, knowledge ontology support, and web/MCP projections. The operator chose Forge as the project management and governance framework to leverage RFC/ADR workflows, skills, and AI-agent-driven development.

## Decision

We start the project using Forge with the `knowledge-typescript-turborepo` profile, TypeScript stack, and pnpm as the package manager.

## Justification

- Forge provides structured governance (RFC/ADR workflows), AI-agent skills, and project bootstrapping out of the box.
- The `knowledge-typescript-turborepo` profile matches the project's goal: a knowledge system with evidence-backed claims, ontology schemas, and web/MCP projections.
- TypeScript is the natural choice for a knowledge system with web projections and MCP tooling.
- pnpm is the recommended package manager for Forge projects and supports workspace monorepos natively.

## Consequences

**Positive:**
- Full Forge governance stack available from day one (skills, RFC/ADR workflows, session tracking).
- Turborepo monorepo structure supports scaling to multiple apps and packages.
- Knowledge ontology and schema registry provide a foundation for structured data.

**Negative:**
- Initial setup complexity — many directories and config files that are not yet populated.
- Learning curve for Forge-specific workflows (mitigated by AI-agent-driven development).

**Postponed:**
- Web and MCP projection apps (`apps/web`, `apps/mcp`) are empty — to be built during the first creation moment.
- Knowledge manifest and ontology schemas need to be defined based on the project's domain.

## Evolution

- If the project outgrows the Turborepo structure, consider migrating to a different monorepo tool.
- If non-TypeScript components are needed, revisit the stack configuration.
