---
id: RFC-0020
title: "MCP server Workers deployment — D1-backed remote MCP endpoint"
status: accepted
kind: policy
scope: workspace
owners:
  - architecture
reviewers:
  - human:andrii-syrokomskyi
createdAt: 2026-08-24
updatedAt: 2026-08-24
enhancedAt: 2026-08-24
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
  - search
successSignals:
  - MCP server deployed as remote MCP endpoint on Cloudflare Workers
  - MCP tools accessible via Streamable HTTP transport at /mcp
  - Projection data served from D1 database
  - All 30+ existing MCP tools work against D1-backed data
  - Local stdio mode preserved for development
nonGoals:
  - Does not add authentication to the MCP endpoint — read-only access is public
  - Does not change MCP tool names, descriptions, or input schemas — handler implementations are refactored but tool contracts stay identical
  - Does not deploy the search API — that is handled by RFC-0018
  - Does not add write endpoints — all MCP tools remain read-only
  - Does not modify the materializer — the export script reads from pre-materialized dist output
---

# RFC-0020: MCP server Workers deployment — D1-backed remote MCP endpoint

## Context

The MCP server (`apps/mcp`) provides 34 read-only tools for querying the knowledge base. It currently runs locally via stdio transport. The data layer has two filesystem-dependent components: (1) `projection-sdk` reads materialized JSONL/JSON files from disk via `node:fs` and `node:path`, and (2) the search index (`@roguelike-games-ib/search`) builds an in-memory SQLite index via `better-sqlite3` (native C++ addon). Both are incompatible with the Cloudflare Workers runtime, which has no filesystem access and cannot load native addons. AI assistants cannot query the knowledge base without local setup.

RFC-0018 (Public API and deployment) originally proposed deploying the MCP server to Cloudflare Workers, but the audit (AUDIT-RFC-0018-01) identified this incompatibility. This RFC was split out to address the data layer migration separately.

## Problem

1. **Native addon incompatibility**: `better-sqlite3` (used by `@roguelike-games-ib/search` for the local search index) is a C++ addon — Workers runtime only supports JavaScript/WASM
2. **Filesystem dependency**: `projection-sdk` reads materialized JSONL/JSON files (records.jsonl, claims.jsonl, relations.jsonl, etc.) from disk via `node:fs` — Workers have no filesystem. `ProjectionStore.open(distDir)` loads all data into in-memory arrays at construction time.
3. **Node.js built-ins**: `context.ts` and `projection-sdk` import `node:path` and `node:fs` — not available in Workers runtime
4. **Search index dependency**: `buildSearchIndex({ dbPath })` in `context.ts` opens a SQLite database file via `better-sqlite3` — not available in Workers
5. **In-memory array access**: Tool handlers directly access `ctx.store.records`, `ctx.store.claims`, `ctx.store.relations` (public readonly arrays on `ProjectionStore`) and call `.filter()` on them. A D1-backed store cannot expose in-memory arrays — handlers must be refactored to use query methods on an interface.

## Decision

### D1: Migrate projection data to Cloudflare D1

Create a D1 database (`roguelike-ib-projection`) that mirrors the materialized projection data. A new export script (`scripts/export-to-d1.ts`) reads JSONL/JSON files from `.generated/knowledge/dist/` and populates D1 via `wrangler d1 execute`. The D1 table schema is derived from the JSONL/JSON structure of the materialized output — there is no existing SQLite schema in `projection-sdk` to match. The export script does not modify the materializer.

D1 table schema (simplified):

```sql
CREATE TABLE records (id TEXT PRIMARY KEY, key TEXT, record_type TEXT, kind TEXT, source_identity TEXT, title TEXT, summary TEXT, attributes TEXT);
CREATE TABLE claims (id TEXT PRIMARY KEY, subject_id TEXT, predicate TEXT, object_ref TEXT, assertion_state TEXT, evidence_refs TEXT);
CREATE TABLE relations (id TEXT PRIMARY KEY, source_record_id TEXT, target_record_id TEXT, relation_type TEXT, attributes TEXT);
CREATE TABLE evidence (id TEXT PRIMARY KEY, source_id TEXT, artifact_path TEXT, evidence_kind TEXT, publication_access TEXT, locator TEXT);
CREATE TABLE coverage (source_id TEXT, dimension TEXT, count INTEGER);
CREATE TABLE sources (source_id TEXT PRIMARY KEY, payload_path TEXT, vcs TEXT, fingerprint TEXT, binding_digest TEXT);
CREATE TABLE key_map (key TEXT PRIMARY KEY, record_id TEXT);
CREATE TABLE alias_map (old_key TEXT PRIMARY KEY, current_key TEXT);
```

### D2: Create Workers MCP entry point using Agents SDK

Create `apps/mcp/src/worker.ts` using the `agents` package (`import { McpAgent } from "agents/mcp"`) and `@modelcontextprotocol/sdk` to expose the MCP server as a remote MCP endpoint with Streamable HTTP transport at `/mcp`. The worker creates a `McpAgent` subclass that registers all 34 existing tools with D1-backed handlers. Use `McpAgent.serve("/mcp")` as the Worker export for Streamable HTTP transport.

The existing tool definitions use JSON Schema for input schemas. The Agents SDK `McpServer.tool()` accepts zod schemas. A conversion step is needed: either use `jsonSchemaToZod` conversion utility or register tools via the lower-level `server.setRequestHandler()` API that accepts raw JSON Schema. The conversion approach must be documented in the implementation plan.

### D3: Extract IProjectionStore interface and implement D1ProjectionStore

The current `ProjectionStore` is a concrete class with a private constructor and public readonly arrays (`records`, `claims`, `relations`, etc.). Tool handlers access these arrays directly (e.g., `ctx.store.records.filter(...)`). This architecture is incompatible with D1, which cannot expose in-memory arrays.

Step 1: Extract an `IProjectionStore` interface from `ProjectionStore` that replaces direct array access with query methods (e.g., `findRecords(predicate)`, `findClaimsBySubject(recordId)`, `findRelationsBySource(recordId)`). The existing `ProjectionStore` class implements this interface using in-memory array operations — preserving local mode behavior.

Step 2: Create `D1ProjectionStore` implementing `IProjectionStore` using D1 prepared statements. Each query method maps to a SQL query against the D1 tables.

Step 3: Refactor all tool handlers to use `IProjectionStore` interface methods instead of direct array access. Tool names, descriptions, and input schemas remain unchanged — only handler implementations are refactored.

The local `ProjectionStore` (filesystem-backed) remains for development and testing. `McpContext.store` type changes from `ProjectionStore` to `IProjectionStore`.

### D4: Adapt search for Workers

The local search index (`@roguelike-games-ib/search`) uses `better-sqlite3` for full-text and hybrid search. On Workers, `buildSearchIndex()` cannot run. The `McpContext` interface is modified: `searchIndex: SearchIndex` is replaced with `searchBackend: SearchBackend`, where `SearchBackend` is a new interface with a `search()` method. Two implementations:

- `LocalSearchBackend` — wraps the existing `SearchIndex` (for local stdio mode)
- `RemoteSearchBackend` — calls the deployed search API (from RFC-0018) via `fetch()` for semantic search operations

The `searchRecords` and `searchDesignSpace` tool handlers call `ctx.searchBackend.search()` instead of `ctx.searchIndex.search()`. The interface is identical — only the implementation differs.

### D5: Add wrangler.jsonc for MCP app

Create `apps/mcp/wrangler.jsonc` with:
- D1 database binding (`PROJECTION_DB`)
- `SEARCH_API_URL` environment variable (URL of the deployed search API from RFC-0018)
- Observability enabled
- Compatibility date matching the search-api

### D6: Preserve local stdio mode

The existing stdio transport (`apps/mcp/src/index.ts`) remains for local development. It builds `McpContext` with `ProjectionStore` (filesystem) and `LocalSearchBackend`. The Workers entry point (`worker.ts`) builds `McpContext` with `D1ProjectionStore` and `RemoteSearchBackend`. Both share the same tool definitions, input schemas, and handler functions — only the context construction differs.

## Architectural fit

- **Cloudflare D1**: Serverless SQLite — natural migration path for the JSONL/JSON-based projection data to a queryable SQL store
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
import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { D1Database } from "@cloudflare/workers-types";

interface Env {
  PROJECTION_DB: D1Database;
  SEARCH_API_URL: string;
}

export class RoguelikeIbMcp extends McpAgent<Env> {
  server = new McpServer({ name: "roguelike-ib", version: "1.0.0" });

  async init() {
    // Registers all 34 existing tools with D1-backed handlers
    // Tool input schemas converted from JSON Schema to zod or registered via low-level API
  }
}

export default RoguelikeIbMcp.serve("/mcp");
```

```ts
// packages/projection-sdk/src/types.ts (new — extracted interface)
import type { CanonicalRecord, ClaimRecord, RelationRecord } from "@roguelike-games-ib/knowledge-core";

export interface IProjectionStore {
  readonly manifest: MaterializationManifest;
  readonly canonicalHash: string;
  resolveRecordById(id: string): Promise<CanonicalRecord | undefined>;
  resolveRecordByKey(key: string): Promise<CanonicalRecord | undefined>;
  findRecords(predicate: RecordPredicate): Promise<CanonicalRecord[]>;
  findClaimsBySubject(recordId: string): Promise<ClaimRecord[]>;
  findClaimsByObjectRef(recordId: string): Promise<ClaimRecord[]>;
  findRelationsBySource(recordId: string): Promise<RelationRecord[]>;
  findRelationsByTarget(recordId: string): Promise<RelationRecord[]>;
  // ... other query methods replacing direct array access
}
```

```ts
// packages/projection-sdk/src/d1-store.ts (new — D1 implementation)
import type { D1Database } from "@cloudflare/workers-types";
import type { IProjectionStore } from "./types.ts";

export class D1ProjectionStore implements IProjectionStore {
  // Implements all query methods using D1 prepared statements
  // Each method maps to a SQL query against D1 tables
}
```

### File system responsibilities

| Path | Role |
|---|---|
| `apps/mcp/src/worker.ts` | New — Workers MCP entry point using Agents SDK |
| `apps/mcp/wrangler.jsonc` | New — Workers configuration with D1 binding and SEARCH_API_URL |
| `apps/mcp/package.json` | Modified — add `agents`, `@modelcontextprotocol/sdk` deps |
| `apps/mcp/src/context.ts` | Modified — `McpContext.store` → `IProjectionStore`, `searchIndex` → `searchBackend: SearchBackend` |
| `packages/projection-sdk/src/types.ts` | New — `IProjectionStore` interface extracted from `ProjectionStore` |
| `packages/projection-sdk/src/d1-store.ts` | New — `D1ProjectionStore` implementing `IProjectionStore` |
| `packages/projection-sdk/src/open.ts` | Modified — `ProjectionStore` implements `IProjectionStore`, array access replaced with query methods |
| `packages/search/src/search-backend.ts` | New — `SearchBackend` interface, `LocalSearchBackend`, `RemoteSearchBackend` |
| `apps/mcp/src/tools/*.ts` | Modified — all tool handlers refactored to use `IProjectionStore` methods and `SearchBackend` instead of direct array access |
| `scripts/export-to-d1.ts` | New — exports materialized JSONL/JSON data to D1 |
| `apps/mcp/AGENTS.md` | New — Workers deployment documentation |

### Failure modes

- **D1 query failure**: Worker returns MCP error response with `{"error": "Projection database unavailable"}` and HTTP 500 status
- **Search API unreachable**: MCP search tools (`search_records`, `search_design_space`) return `{"error": "Search API unavailable"}` with HTTP 503 status; non-search tools continue working via D1 with HTTP 200
- **D1 database not populated**: Worker returns `{"error": "Projection database not initialized"}` with HTTP 500 status on first request; `scripts/export-to-d1.ts` must be run before deploy
- **D1 row limit exceeded**: If D1 database exceeds plan limits, queries fail with HTTP 500; Workers Paid plan ($5/month, 10M row limit) is required — the free tier (100K rows) is insufficient for ~113K claims

## Rollout

1. **Extract IProjectionStore interface**: Extract interface from `ProjectionStore` class, replacing direct array access with async query methods. `ProjectionStore` implements the interface using in-memory array operations.
2. **Implement SearchBackend interface**: Create `SearchBackend` interface with `LocalSearchBackend` (wraps existing `SearchIndex`) and `RemoteSearchBackend` (calls search API via `fetch()`).
3. **Refactor tool handlers**: All tool handlers in `apps/mcp/src/tools/*.ts` are refactored to use `IProjectionStore` methods and `SearchBackend` instead of direct array access and `SearchIndex`. Tool names, descriptions, and input schemas remain unchanged.
4. **Modify McpContext**: Change `store: ProjectionStore` to `store: IProjectionStore`, `searchIndex: SearchIndex` to `searchBackend: SearchBackend`. Local mode constructs `ProjectionStore` + `LocalSearchBackend`; Workers mode constructs `D1ProjectionStore` + `RemoteSearchBackend`.
5. **D1 database creation**: Create the D1 database via `wrangler d1 create roguelike-ib-projection`
6. **D1 export script**: Create `scripts/export-to-d1.ts` that reads materialized JSONL/JSON from `.generated/knowledge/dist/` and populates D1 via `wrangler d1 execute`
7. **D1 projection store**: Implement `D1ProjectionStore` in `projection-sdk` with D1 prepared statements for all `IProjectionStore` methods
8. **Workers entry point**: Create `apps/mcp/src/worker.ts` using `McpAgent` from `agents/mcp`, register all 34 tools with D1-backed handlers, export via `McpAgent.serve("/mcp")`
9. **Schema conversion**: Convert existing JSON Schema input schemas to zod schemas for `McpServer.tool()`, or use lower-level registration API that accepts raw JSON Schema
10. **Deploy and test**: Deploy via `wrangler deploy`, test with MCP inspector (`npx @modelcontextprotocol/inspector`)
11. **CI/CD**: Add MCP deploy step to `.github/workflows/deploy.yml`

## Alternatives considered

1. **R2-backed SQLite** — Workers cannot read SQLite files from R2 at runtime. D1 is the only serverless SQL option on Cloudflare.

2. **Workers KV for all data** — KV is key-value, not SQL. The projection store uses complex filter and relation traversal operations that would require significant rework. D1 preserves a SQL query interface.

3. **Thin proxy to search API** — The MCP tools do more than search — they traverse relations, get records, compare games, generate reports. A thin proxy cannot replicate this functionality.

4. **Defer MCP deployment entirely** — The MCP server is a key differentiator for the project. Remote access enables AI assistants to query the knowledge base without local setup.

5. **Durable Objects for in-memory state** — Unnecessary complexity. D1 provides persistent storage without the overhead of Durable Object lifecycle management. The MCP server is stateless per request.

## Risks

- **D1 latency**: D1 queries may be slower than local in-memory array operations. Mitigation: D1 is co-located with Workers in the same region; query times are typically <5ms for indexed lookups. The `IProjectionStore` interface allows future optimization (caching, batch queries).
- **D1 row limits**: D1 has a 100K row limit per database on the free tier. The knowledge base has ~22K records, ~113K claims, ~36K relations — the claims table exceeds the free tier. **Workers Paid plan ($5/month, 10M row limit) is required** — the free tier is insufficient.
- **Interface extraction refactoring**: Extracting `IProjectionStore` and refactoring all tool handlers is a significant change. Mitigation: tool names, descriptions, and input schemas remain unchanged — only handler implementations are refactored. The `ProjectionStore` class continues to implement the interface for local mode.
- **Schema conversion**: Converting 34 JSON Schema input schemas to zod for the Agents SDK may introduce errors. Mitigation: use a conversion utility or test each tool individually with the MCP inspector.
- **Concurrency**: Multiple MCP clients may issue concurrent D1 queries. D1 supports concurrent reads natively. The MCP server is stateless per request — no shared state concerns.
- **Agent misinterpretation risk**: Agents may assume the MCP server works the same way locally and on Workers. Mitigation: `## Implementation notes for agents` section explicitly documents the dual-mode architecture and the interface-based design.

## Acceptance criteria

- [ ] `IProjectionStore` interface extracted from `ProjectionStore` in `packages/projection-sdk/src/types.ts`
- [ ] `ProjectionStore` class implements `IProjectionStore` using in-memory array operations
- [ ] `D1ProjectionStore` implements `IProjectionStore` with D1 prepared statements in `packages/projection-sdk/src/d1-store.ts`
- [ ] `SearchBackend` interface created with `LocalSearchBackend` and `RemoteSearchBackend` implementations
- [ ] All tool handlers in `apps/mcp/src/tools/*.ts` refactored to use `IProjectionStore` methods and `SearchBackend`
- [ ] `McpContext` uses `IProjectionStore` and `SearchBackend` interface types instead of concrete classes
- [ ] D1 database `roguelike-ib-projection` created and populated with projection data
- [ ] `apps/mcp/src/worker.ts` exposes all 34 MCP tools via Streamable HTTP at `/mcp` using `McpAgent.serve()`
- [ ] MCP endpoint is accessible and responds to tool calls (verified via `npx @modelcontextprotocol/inspector`)
- [ ] Local stdio mode (`apps/mcp/src/index.ts`) remains functional for development
- [ ] `apps/mcp/wrangler.jsonc` configured with D1 binding (`PROJECTION_DB`) and `SEARCH_API_URL`
- [ ] `apps/mcp/package.json` includes `agents` and `@modelcontextprotocol/sdk` dependencies
- [ ] `scripts/export-to-d1.ts` populates D1 from materialized JSONL/JSON dist output
- [ ] `pnpm exec turbo run build:check` passes
- [ ] `pnpm exec vitest --run` passes
- [ ] `apps/mcp/AGENTS.md` created with Workers deployment documentation

## Implementation notes for agents

- **Status gate**: This RFC must be in `accepted` status before implementation begins. Use `fo-idea-plan` to create the implementation plan and transition to `accepted`.
- **Dual-mode architecture**: The MCP server supports two modes — local stdio (existing) and remote Workers (new). Tool names, descriptions, and input schemas are shared between both modes. Only the context construction differs: local mode uses `ProjectionStore` + `LocalSearchBackend`, Workers mode uses `D1ProjectionStore` + `RemoteSearchBackend`.
- **No tool schema changes**: Do not modify tool names, descriptions, or input schemas. The 34 existing tools must work identically in both modes. Handler implementations are refactored to use `IProjectionStore` and `SearchBackend` interfaces, but tool contracts stay the same.
- **Interface-based design**: `McpContext.store` is typed as `IProjectionStore` (interface), not `ProjectionStore` (concrete class). `McpContext.searchBackend` is typed as `SearchBackend` (interface), not `SearchIndex` (concrete class). This allows both local and Workers modes to construct the appropriate implementation.
- **Read-only invariant**: All MCP tools must remain `readOnly: true`. The `assertNoWriteTools` guard in `server.ts` must pass.
- **CI gates**: All CI checks must pass — `pnpm materialize`, `pnpm exec turbo run build:check`, `pnpm exec vitest --run`.
- **D1 export**: The export script reads from `.generated/knowledge/dist/` — it does not modify the materializer or knowledge base.
- **Agents SDK**: Use the `agents` package's `McpAgent` class (`import { McpAgent } from "agents/mcp"`). Use `McpAgent.serve("/mcp")` for Streamable HTTP transport. Do not use `@cloudflare/agents` — the npm package is `agents`.
- **Schema conversion**: The existing tool definitions use JSON Schema for input schemas. The Agents SDK `McpServer.tool()` accepts zod schemas. Convert JSON Schema to zod, or use the lower-level `server.setRequestHandler()` API that accepts raw JSON Schema. Document the chosen approach in the implementation plan.
- **Search API dependency**: The Workers MCP server calls the deployed search API (from RFC-0018) for semantic search operations via `RemoteSearchBackend`. The search API URL is passed as the `SEARCH_API_URL` environment variable in `wrangler.jsonc`.
- **Workers Paid plan required**: The free tier D1 limit (100K rows) is insufficient for ~113K claims. Workers Paid plan ($5/month, 10M row limit) is required for deployment.
