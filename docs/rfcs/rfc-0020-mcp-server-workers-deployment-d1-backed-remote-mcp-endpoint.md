---
id: RFC-0020
title: "MCP server Workers deployment — D1-backed remote MCP endpoint"
status: draft
kind: policy
scope: workspace
owners:
  - architecture
reviewers:
  - human:andrii-syrokomskyi
createdAt: 2026-08-24
updatedAt: 2026-08-24
implementedAt:
closedAt:
supersedes: []
supersededBy:
amends: []
amendedBy: []
related:
  - RFC-0018
  - RFC-0010
satisfies: []
versionBump: minor
commands:
  proposed: []
  added: []
  changed: []
  removed: []
appsImpacted:
  - mcp
packagesImpacted:
  - projection-sdk
successSignals:
  - MCP server deployed as remote MCP endpoint on Cloudflare Workers
  - MCP tools accessible via Streamable HTTP transport at /mcp
  - Projection data served from D1 database
  - All 30+ existing MCP tools work against D1-backed data
  - Local stdio mode preserved for development
nonGoals:
  - Does not add authentication to the MCP endpoint — read-only access is public
  - Does not change MCP tool definitions or input schemas
  - Does not deploy the search API — that is handled by RFC-0018
  - Does not add write endpoints — all MCP tools remain read-only
---

# RFC-0020: MCP server Workers deployment — D1-backed remote MCP endpoint

## Context

The MCP server (`apps/mcp`) provides 30+ read-only tools for querying the knowledge base. It currently runs locally via stdio transport, using `better-sqlite3` (native Node.js addon) and `node:path` to load projection data from the filesystem. AI assistants cannot query the knowledge base without local setup.

RFC-0018 (Public API and deployment) originally proposed deploying the MCP server to Cloudflare Workers, but the audit (AUDIT-RFC-0018-01) identified a critical incompatibility: the MCP server's data layer (`better-sqlite3`, `node:path`, filesystem-based `openProjection()`) is fundamentally incompatible with the Cloudflare Workers runtime, which has no filesystem access and cannot load native addons. This RFC was split out to address the data layer migration separately.

## Problem

1. **Native addon incompatibility**: `better-sqlite3` is a C++ addon — Workers runtime only supports JavaScript/WASM
2. **Filesystem dependency**: `createMcpContext()` in `apps/mcp/src/context.ts` calls `openProjection(distDir)` which opens a SQLite database file from disk — Workers have no filesystem
3. **Node.js built-ins**: `context.ts` imports `node:path` — not available in Workers runtime
4. **Search index dependency**: `buildSearchIndex({ dbPath })` also depends on filesystem SQLite

## Decision

### D1: Migrate projection data to Cloudflare D1

Create a D1 database (`roguelike-ib-projection`) that mirrors the materialized projection data. The materializer (`packages/materializer`) gains a D1 export mode that populates the database during `pnpm materialize`. The D1 schema matches the existing SQLite schema used by `projection-sdk`.

### D2: Create Workers MCP entry point using Agents SDK

Create `apps/mcp/src/worker.ts` using `@cloudflare/agents` and `@modelcontextprotocol/sdk` to expose the MCP server as a remote MCP endpoint with Streamable HTTP transport at `/mcp`. The worker creates a `McpAgent` that registers all existing tools, backed by D1 instead of local SQLite.

### D3: Adapt projection-sdk for D1

Extend `@roguelike-games-ib/projection-sdk` to support a D1-backed projection store. The existing `ProjectionStore` interface stays the same; a new `D1ProjectionStore` implementation uses `D1Database` bindings instead of `better-sqlite3`. The local `SqliteProjectionStore` remains for development and testing.

### D4: Adapt search index for Workers

The local search index uses `better-sqlite3` for full-text search. On Workers, the MCP server calls the deployed search API (from RFC-0018) for semantic search operations instead of using a local index. For keyword-based tool operations that currently use SQLite queries, D1 handles them directly.

### D5: Add wrangler.jsonc for MCP app

Create `apps/mcp/wrangler.jsonc` with:
- D1 database binding (`PROJECTION_DB`)
- Workers AI binding (for embedding operations if needed)
- Observability enabled
- Compatibility date matching the search-api

### D6: Preserve local stdio mode

The existing stdio transport (`apps/mcp/src/index.ts`) remains unchanged for local development. The Workers entry point (`worker.ts`) is additive — it imports the same tool definitions and registers them with the Agents SDK MCP handler.

## Architectural fit

- **Cloudflare D1**: Serverless SQLite — natural migration path from `better-sqlite3`
- **Agents SDK**: Cloudflare's official framework for remote MCP servers on Workers
- **Streamable HTTP**: The standard transport for remote MCP connections (SSE deprecated)
- **Read-only tools**: All MCP tools are already read-only (`readOnly: true`) — no write concerns
- **RFC-0018**: Complements search API deployment — MCP server can call the search API for semantic search
- **RFC-0010**: The search API already supports concept_type filtering — MCP tools can leverage this

## Design

### CLI surface

```sh
# Create D1 database (one-time)
pnpm --filter @roguelike-games-ib/mcp exec wrangler d1 create roguelike-ib-projection

# Export projection data to D1
pnpm exec tsx scripts/export-to-d1.ts

# Deploy MCP server to Workers
pnpm --filter @roguelike-games-ib/mcp exec wrangler deploy

# Local development (unchanged)
pnpm --filter @roguelike-games-ib/mcp exec tsx src/index.ts
```

### TypeScript contracts

```ts
// apps/mcp/src/worker.ts
import { McpAgent } from "@cloudflare/agents";
import type { D1Database } from "@cloudflare/workers-types";

interface Env {
  PROJECTION_DB: D1Database;
  SEARCH_API_URL: string;
}

export class RoguelikeIbMcp extends McpAgent<Env> {
  // Registers all 30+ existing tools with D1-backed handlers
}
```

```ts
// packages/projection-sdk/src/d1-store.ts
import type { D1Database } from "@cloudflare/workers-types";

export interface D1ProjectionStore extends ProjectionStore {
  // Same interface as SqliteProjectionStore
  // Implemented using D1 prepared statements
}
```

### File system responsibilities

| Path | Role |
|---|---|
| `apps/mcp/src/worker.ts` | New — Workers MCP entry point |
| `apps/mcp/wrangler.jsonc` | New — Workers configuration with D1 binding |
| `apps/mcp/package.json` | Modified — add `@cloudflare/agents`, `@modelcontextprotocol/sdk` deps |
| `packages/projection-sdk/src/d1-store.ts` | New — D1-backed projection store |
| `scripts/export-to-d1.ts` | New — exports materialized data to D1 |

### Failure modes

- **D1 query failure**: Worker returns MCP error response with `{"error": "Projection database unavailable"}` and 500 status
- **Search API unreachable**: MCP search tools return graceful degradation message; non-search tools continue working via D1
- **D1 database not populated**: Worker returns error on first request; `scripts/export-to-d1.ts` must be run before deploy

## Rollout

1. **D1 database creation**: Create the D1 database via `wrangler d1 create`
2. **D1 export script**: Create `scripts/export-to-d1.ts` that reads materialized data from `.generated/knowledge/dist/` and populates D1
3. **D1 projection store**: Implement `D1ProjectionStore` in `projection-sdk` with the same interface as `SqliteProjectionStore`
4. **Workers entry point**: Create `apps/mcp/src/worker.ts` using Agents SDK `McpAgent` class
5. **Tool adaptation**: Each tool handler that currently uses `ctx.store` (SqliteProjectionStore) is adapted to work with `D1ProjectionStore`
6. **Search tool adaptation**: `searchRecords` and `searchDesignSpace` tools call the deployed search API instead of local search index
7. **Deploy and test**: Deploy via `wrangler deploy`, test with MCP inspector
8. **CI/CD**: Add MCP deploy step to `.github/workflows/deploy.yml`

## Alternatives considered

1. **R2-backed SQLite** — Workers cannot read SQLite files from R2 at runtime. D1 is the only serverless SQL option on Cloudflare.

2. **Workers KV for all data** — KV is key-value, not SQL. The projection store uses complex SQL queries (joins, filters, cursors) that would require significant rework. D1 preserves the SQL interface.

3. **Thin proxy to search API** — The MCP tools do more than search — they traverse relations, get records, compare games, generate reports. A thin proxy cannot replicate this functionality.

4. **Defer MCP deployment entirely** — The MCP server is a key differentiator for the project. Remote access enables AI assistants to query the knowledge base without local setup.

5. **Durable Objects for in-memory state** — Unnecessary complexity. D1 provides persistent storage without the overhead of Durable Object lifecycle management. The MCP server is stateless per request.

## Risks

- **D1 latency**: D1 queries may be slower than local SQLite. Mitigation: D1 is co-located with Workers in the same region; query times are typically <5ms for indexed lookups.
- **D1 row limits**: D1 has a 100K row limit per database on the free tier. The knowledge base has ~22K records, ~113K claims, ~36K relations — the claims table may exceed the free tier. Mitigation: Workers Paid plan ($5/month) raises the limit to 10M rows.
- **Materializer changes**: Exporting to D1 requires changes to the materializer or a new export script. Mitigation: the export script reads from `dist/` output, not the materializer itself — no materializer changes needed.
- **Tool handler refactoring**: Each tool handler currently receives `McpContext` with `store: ProjectionStore`. Adapting to D1 requires changing the store implementation, not the tool interfaces. Mitigation: `D1ProjectionStore` implements the same `ProjectionStore` interface.
- **Agent misinterpretation risk**: Agents may assume the MCP server works the same way locally and on Workers. Mitigation: `## Implementation notes for agents` section explicitly documents the dual-mode architecture.

## Acceptance criteria

- [ ] D1 database `roguelike-ib-projection` created and populated with projection data
- [ ] `D1ProjectionStore` implements `ProjectionStore` interface with D1 prepared statements
- [ ] `apps/mcp/src/worker.ts` exposes all 30+ MCP tools via Streamable HTTP at `/mcp`
- [ ] MCP endpoint is accessible and responds to tool calls from MCP inspector
- [ ] Local stdio mode (`apps/mcp/src/index.ts`) remains functional for development
- [ ] `apps/mcp/wrangler.jsonc` configured with D1 binding
- [ ] `apps/mcp/package.json` includes `@cloudflare/agents` and `@modelcontextprotocol/sdk` dependencies
- [ ] `scripts/export-to-d1.ts` populates D1 from materialized dist output
- [ ] `pnpm exec turbo run build:check` passes
- [ ] `pnpm exec vitest --run` passes
- [ ] `apps/mcp/AGENTS.md` created with Workers deployment documentation

## Implementation notes for agents

- **Status gate**: This RFC must be in `accepted` status before implementation begins. Use `fo-idea-plan` to create the implementation plan and transition to `accepted`.
- **Dual-mode architecture**: The MCP server supports two modes — local stdio (existing) and remote Workers (new). Tool definitions and input schemas are shared between both modes. Only the data access layer differs (`SqliteProjectionStore` vs `D1ProjectionStore`).
- **No tool changes**: Do not modify tool names, descriptions, or input schemas. The 30+ existing tools must work identically in both modes.
- **Read-only invariant**: All MCP tools must remain `readOnly: true`. The `assertNoWriteTools` guard in `server.ts` must pass.
- **CI gates**: All CI checks must pass — `pnpm materialize`, `pnpm exec turbo run build:check`, `pnpm exec vitest --run`.
- **D1 export**: The export script reads from `.generated/knowledge/dist/` — it does not modify the materializer or knowledge base.
- **Agents SDK**: Use `@cloudflare/agents` package's `McpAgent` class for the Workers entry point. Use `createMcpHandler` for Streamable HTTP transport.
- **Search API dependency**: The Workers MCP server calls the deployed search API (from RFC-0018) for semantic search operations. The search API URL is passed as an environment variable.
