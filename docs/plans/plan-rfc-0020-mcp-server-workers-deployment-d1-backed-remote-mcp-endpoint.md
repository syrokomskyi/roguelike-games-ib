---
id: PLAN-RFC-0020
title: "MCP server Workers deployment — D1-backed remote MCP endpoint"
status: accepted
scope: workspace
decider: architecture
reviewers:
  - human:andrii-syrokomskyi
related:
  - RFC-0020
  - RFC-0018
  - RFC-0010
created: 2026-08-24
accepted: 2026-08-24
implementedAt:
closedAt: null
---

# PLAN-RFC-0020: MCP server Workers deployment — D1-backed remote MCP endpoint

## Context

RFC-0020 (accepted) defines the deployment of the MCP server to Cloudflare Workers with a D1-backed data layer and Streamable HTTP transport. The current MCP server runs locally via stdio, reading JSONL/JSON files via `node:fs` and using `better-sqlite3` for search. Both are incompatible with the Workers runtime.

## Current state

| Component | Status | What changes |
|---|---|---|
| `ProjectionStore` | Concrete class, private constructor, public readonly arrays, query methods | Extract `IProjectionStore` interface; add query methods replacing direct array access; `ProjectionStore` implements interface |
| `McpContext` | `store: ProjectionStore`, `searchIndex: SearchIndex` | `store: IProjectionStore`, `searchBackend: SearchBackend` |
| Tool handlers (34 tools) | Direct array access (`ctx.store.records.filter(...)`) | Refactored to use `IProjectionStore` query methods |
| `SearchIndex` | `SqliteSearchIndex` via `better-sqlite3` | `SearchBackend` interface with `LocalSearchBackend` and `RemoteSearchBackend` |
| `apps/mcp/src/index.ts` | stdio entry point | Unchanged — local mode |
| `apps/mcp/src/worker.ts` | Does not exist | New — Workers MCP entry point via `McpAgent.serve()` |
| `apps/mcp/wrangler.jsonc` | Does not exist | New — D1 binding, SEARCH_API_URL |
| `scripts/export-to-d1.ts` | Does not exist | New — exports JSONL/JSON to D1 |
| `.github/workflows/deploy.yml` | Deploys search-api and web | Add MCP deploy step |

## Tasks

### Phase 1 — Contracts (interface extraction)

#### S1: Extract `IProjectionStore` interface

Extract interface from `ProjectionStore` class. Include existing query methods plus new methods that replace direct array access patterns used by tool handlers.

**New methods needed** (based on tool handler analysis):

- `findRecords(filter: RecordFilter): Promise<CanonicalRecord[]>` — replaces `ctx.store.records.filter(...)` with filters on `record_type`, `semantic_type`, `kind`, `source_identity.source_id`, `concept_type`, `scope.source_id`
- `findAllRecords(): Promise<CanonicalRecord[]>` — replaces `ctx.store.records` direct access (for summary/count operations)
- `findClaimsByPredicate(predicate: string, sourceId?: string, assertionState?: string): Promise<ClaimRecord[]>` — replaces `ctx.store.claims.filter(c => c.predicate === ...)`
- `findAllClaims(): Promise<ClaimRecord[]>` — replaces `ctx.store.claims` direct access (for summary counts)
- `findRelations(filter: RelationFilter): Promise<RelationRecord[]>` — replaces `ctx.store.relations.filter(...)` with filters on `relation_scope`, `relation_type`, `source_record_id`, `target_record_id`
- `findAllRelations(): Promise<RelationRecord[]>` — replaces `ctx.store.relations` direct access
- `findEvidenceById(id: string): Promise<PublicEvidence | undefined>` — replaces `ctx.store.evidence.find(...)`
- `findCoverageBySource(sourceId: string): Promise<CoverageRecord[]>` — already exists as `coverageForSource`
- `findSourceById(sourceId: string): Promise<SourceBinding | undefined>` — already exists
- `findAllSources(): Promise<SourceBinding[]>` — replaces `ctx.store.sources` direct access
- `resolveRecordByKey(key: string): Promise<CanonicalRecord | undefined>` — already exists (sync → async)
- `resolveRecordById(id: string): Promise<CanonicalRecord | undefined>` — already exists (sync → async)
- `resolveRecord(identifier: string): Promise<CanonicalRecord | undefined>` — already exists (sync → async)

**Key design decision**: All methods become `async` (return `Promise`). `ProjectionStore` implements them with synchronous in-memory operations wrapped in `Promise.resolve()`. `D1ProjectionStore` implements them with D1 queries.

**Files**:
- `packages/projection-sdk/src/types.ts` (new — `IProjectionStore` interface, `RecordFilter`, `RelationFilter` types)
- `packages/projection-sdk/src/index.ts` (modified — export `IProjectionStore`)

**Completion criterion**: `IProjectionStore` interface defined with all methods. `pnpm exec turbo run build:check` passes for `projection-sdk`.

#### S2: Make `ProjectionStore` implement `IProjectionStore`

Modify `ProjectionStore` class to implement `IProjectionStore`. Existing query methods become async. Direct array access properties (`records`, `claims`, `relations`, `evidence`, `coverage`, `sources`, `keyMap`, `aliasMap`) remain as private/internal — no longer part of the public interface.

**Important**: The public readonly arrays remain on `ProjectionStore` class (for backward compat in local mode tests), but `IProjectionStore` interface does not include them. Tool handlers use `IProjectionStore` methods, not array access.

**Files**:
- `packages/projection-sdk/src/open.ts` (modified — `implements IProjectionStore`, async methods)

**Completion criterion**: `ProjectionStore implements IProjectionStore`. `pnpm exec turbo run build:check` passes.

#### S3: Create `SearchBackend` interface

```ts
export interface SearchBackend {
  readonly canonicalHash: string;
  search(query: SearchQuery): Promise<SearchResult>;
}
```

`SearchBackend` wraps the existing `SearchIndex.search()` method. Two implementations:
- `LocalSearchBackend` — wraps `SearchIndex` (for local stdio mode)
- `RemoteSearchBackend` — calls search API via `fetch()`, maps `SearchApiResponse` → `SearchResult`

**Files**:
- `packages/search/src/search-backend.ts` (new — `SearchBackend` interface, `LocalSearchBackend`, `RemoteSearchBackend`)
- `packages/search/src/index.ts` (modified — export `SearchBackend`, `LocalSearchBackend`, `RemoteSearchBackend`)

**Completion criterion**: `SearchBackend` interface and both implementations compile. `pnpm exec turbo run build:check` passes for `search` package.

#### S4: Modify `McpContext` to use interface types

```ts
export interface McpContext {
  manifest: MaterializationManifest;
  store: IProjectionStore;
  searchBackend: SearchBackend;
  canonicalHash: string;
  license: string;
  datasetId: string;
  datasetVersion: string;
  modelVersion: string;
}
```

Remove `distDir` and `searchIndex` from `McpContext`. Add `searchBackend`.

**Files**:
- `apps/mcp/src/context.ts` (modified — `McpContext` interface, `createMcpContext` for local mode)

**Completion criterion**: `McpContext` uses `IProjectionStore` and `SearchBackend`. `pnpm exec turbo run build:check` passes for `mcp` app.

### Phase 2 — Handler refactoring

#### S5: Refactor all tool handlers to use `IProjectionStore` and `SearchBackend`

All 34 tool handlers in `apps/mcp/src/tools/*.ts` must be refactored:

- Replace `ctx.store.records.filter(...)` → `await ctx.store.findRecords({...})`
- Replace `ctx.store.records` (full array) → `await ctx.store.findAllRecords()`
- Replace `ctx.store.claims.filter(...)` → `await ctx.store.findClaimsByPredicate(...)` or `await ctx.store.claimsForRecord(...)`
- Replace `ctx.store.claims` (full array) → `await ctx.store.findAllClaims()`
- Replace `ctx.store.relations.filter(...)` → `await ctx.store.findRelations({...})`
- Replace `ctx.store.relations` (full array) → `await ctx.store.findAllRelations()`
- Replace `ctx.store.evidence.find(...)` → `await ctx.store.findEvidenceById(...)`
- Replace `ctx.store.sources.find(...)` → `await ctx.store.findSourceById(...)`
- Replace `ctx.store.sources` (full array) → `await ctx.store.findAllSources()`
- Replace `ctx.store.coverage.filter(...)` → `await ctx.store.findCoverageBySource(...)`
- Replace `ctx.store.resolveRecordById(...)` (sync) → `await ctx.store.resolveRecordById(...)` (async)
- Replace `ctx.searchIndex.search(...)` → `await ctx.searchBackend.search(...)`
- All handler functions become `async`

**Tool handler files to modify** (all in `apps/mcp/src/tools/`):
- `dataset.ts` — `getDatasetInfo`
- `sources.ts` — `listSources`, `getSourceStatus`
- `records.ts` — `getRecord`, `resolveKey`
- `search.ts` — `searchRecords`
- `definitions.ts` — `listDefinitions`
- `mechanics.ts` — `findMechanics`, `findSystems`
- `graph.ts` — `traverseRelations`
- `claims.ts` — `getClaims`
- `evidence.ts` — `getEvidence`
- `compare.ts` — `compareRecords`, `compareGames`
- `design.ts` — `findCrossGameConcepts`, `findDesignPrimitives`, `queryDesignSpace`
- `derived.ts` — `findSemanticRecords`, `getDerivedSummary`, `getCoverageMatrix`, `getConceptCoverage`, `compareConceptImplementations`, `findConceptGaps`, `getConceptQuality`, `searchDesignSpace`, `findDesignPatterns`, `getPatternExamples`, `generateDesignSeed`, `recommendGames`
- `coverage.ts` — `getCoverage`
- `queries.ts` — `getClaimsByPredicate`, `getConceptMembers`, `getDesignTensions`, `findByAttribute`
- `report.ts` — `generateComparisonReport`

**Completion criterion**: No direct array access (`ctx.store.records`, `ctx.store.claims`, etc.) in any tool handler. All handlers are `async`. `pnpm exec turbo run build:check` passes. All existing MCP tests pass with updated `McpContext`.

#### S6: Update `createMcpToolRegistry` and `ToolHandler` type

`ToolHandler` type already returns `O | Promise<O>`. No change needed. `createMcpToolRegistry` stays the same — it registers tool definitions, not context.

**Completion criterion**: `createMcpToolRegistry()` still registers all 34 tools. `assertNoWriteTools` passes.

#### S7: Update test helpers

`tests/mcp/helpers.ts` — `setupMcpWorkspace` calls `createMcpContext(distDir)`. The helper must be updated to work with the new `McpContext` that uses `IProjectionStore` and `SearchBackend`.

`createMcpContext` for local mode constructs:
- `store = ProjectionStore.open(distDir)` (implements `IProjectionStore`)
- `searchBackend = new LocalSearchBackend(searchIndex)` where `searchIndex = await buildSearchIndex({dbPath, canonicalHash})`

**Files**:
- `tests/mcp/helpers.ts` (modified)
- `tests/mcp/mcp-*.test.ts` (modified if any test accesses `ctx.store.records` directly)

**Completion criterion**: All 13 MCP tests pass. `pnpm exec vitest --run tests/mcp/` passes.

### Phase 3 — D1 implementation

#### S8: Create `D1ProjectionStore`

Implement `D1ProjectionStore` class that implements `IProjectionStore` using D1 prepared statements.

**D1 table schema** (in `scripts/export-to-d1.ts`):

```sql
CREATE TABLE IF NOT EXISTS records (id TEXT PRIMARY KEY, key TEXT, record_type TEXT, kind TEXT, source_identity TEXT, title TEXT, summary TEXT, attributes TEXT);
CREATE TABLE IF NOT EXISTS claims (id TEXT PRIMARY KEY, subject_id TEXT, predicate TEXT, object_ref TEXT, assertion_state TEXT, evidence_refs TEXT, value TEXT);
CREATE TABLE IF NOT EXISTS relations (id TEXT PRIMARY KEY, source_record_id TEXT, target_record_id TEXT, relation_type TEXT, relation_scope TEXT, attributes TEXT);
CREATE TABLE IF NOT EXISTS evidence (id TEXT PRIMARY KEY, source_id TEXT, artifact_path TEXT, evidence_kind TEXT, publication_access TEXT, locator TEXT, artifact_sha256 TEXT, fragment_hash TEXT, excerpt TEXT, license_ref TEXT);
CREATE TABLE IF NOT EXISTS coverage (source_id TEXT, dimension_id TEXT, state TEXT, basis TEXT, expected INTEGER, extracted INTEGER, validated INTEGER, unresolved INTEGER);
CREATE TABLE IF NOT EXISTS sources (source_id TEXT PRIMARY KEY, payload_path TEXT, vcs TEXT, fingerprint TEXT, binding_digest TEXT, declared_version TEXT, version_scheme TEXT, metadata_origin TEXT);
CREATE TABLE IF NOT EXISTS key_map (key TEXT PRIMARY KEY, record_id TEXT);
CREATE TABLE IF NOT EXISTS alias_map (old_key TEXT PRIMARY KEY, current_key TEXT);
CREATE TABLE IF NOT EXISTS manifest (id INTEGER PRIMARY KEY, data TEXT);
```

**Files**:
- `packages/projection-sdk/src/d1-store.ts` (new)
- `packages/projection-sdk/src/index.ts` (modified — export `D1ProjectionStore`)

**Completion criterion**: `D1ProjectionStore` implements all `IProjectionStore` methods. `pnpm exec turbo run build:check` passes.

#### S9: Create D1 export script

`scripts/export-to-d1.ts` reads JSONL/JSON files from `.generated/knowledge/dist/` and populates D1 via `wrangler d1 execute --command`.

The script:
1. Reads `manifest.json`, `records.jsonl`, `claims.jsonl`, `relations.jsonl`, `evidence.public.jsonl`, `coverage.json`, `sources.json`, `key-map.json`, `alias-map.json`
2. Generates SQL INSERT statements
3. Executes via `wrangler d1 execute roguelike-ib-projection --file schema.sql` (for table creation) and batched INSERTs

**Files**:
- `scripts/export-to-d1.ts` (new)

**Completion criterion**: Script compiles. Can be run with `pnpm exec tsx scripts/export-to-d1.ts` (requires D1 database to exist).

#### S10: Create `RemoteSearchBackend`

`RemoteSearchBackend` calls the deployed search API via `fetch()`:

- `search(query: SearchQuery): Promise<SearchResult>` — calls `GET /api/search?q=...&type=...&kind=...&source=...&limit=...`
- Maps `SearchApiResponse` → `SearchResult` (convert `SearchApiHit[]` → `SearchHit[]` with `SearchRecord` and `ScoreComponents`)
- Cursor support: search API doesn't support cursor — `RemoteSearchBackend` returns `cursor: null` (all results returned in one page up to `limit`)

**Files**:
- `packages/search/src/search-backend.ts` (already created in S3 — `RemoteSearchBackend` implementation)

**Completion criterion**: `RemoteSearchBackend` compiles. `pnpm exec turbo run build:check` passes.

### Phase 4 — Workers entry point

#### S11: Create `apps/mcp/src/worker.ts`

Workers MCP entry point using Agents SDK:

```ts
import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { D1Database } from "@cloudflare/workers-types";
import { D1ProjectionStore } from "@roguelike-games-ib/projection-sdk";
import { RemoteSearchBackend } from "@roguelike-games-ib/search";
// import tool definitions and register them

export class RoguelikeIbMcp extends McpAgent<Env> {
  server = new McpServer({ name: "roguelike-ib", version: "1.0.0" });

  async init() {
    // Create D1-backed context
    // Register all 34 tools
  }
}

export default RoguelikeIbMcp.serve("/mcp");
```

**Schema conversion**: Use the lower-level `server.setRequestHandler()` API or convert JSON Schema to zod. The existing `ToolDefinition` has `inputSchema` as JSON Schema. The `McpServer.tool()` method from `@modelcontextprotocol/sdk` accepts zod. Use `jsonSchemaToZod` conversion or register via `server.server.setRequestHandler("tools/call", handler)` and `server.server.setRequestHandler("tools/list", handler)` for raw JSON Schema support.

**Recommended approach**: Use the low-level registration API that accepts raw JSON Schema, avoiding zod conversion entirely. This preserves the existing `inputSchema` objects as-is.

**Files**:
- `apps/mcp/src/worker.ts` (new)

**Completion criterion**: `worker.ts` compiles. All 34 tools registered. `pnpm exec turbo run build:check` passes.

#### S12: Create `apps/mcp/wrangler.jsonc`

```jsonc
{
  "name": "roguelike-ib-mcp",
  "main": "src/worker.ts",
  "compatibility_date": "2026-08-24",
  "d1_databases": [
    { "binding": "PROJECTION_DB", "database_name": "roguelike-ib-projection", "database_id": "<to-be-set>" }
  ],
  "vars": {
    "SEARCH_API_URL": "https://search-api.roguelike-ib.workers.dev"
  },
  "observability": { "enabled": true }
}
```

**Files**:
- `apps/mcp/wrangler.jsonc` (new)

**Completion criterion**: `wrangler.jsonc` exists with D1 binding and SEARCH_API_URL.

#### S13: Update `apps/mcp/package.json`

Add dependencies:
- `agents` (Cloudflare Agents SDK)
- `@modelcontextprotocol/sdk`
- `@cloudflare/workers-types` (devDep)

**Files**:
- `apps/mcp/package.json` (modified)

**Completion criterion**: `package.json` includes new deps. `pnpm install` succeeds.

### Phase 5 — Tests

#### S14: Add D1ProjectionStore unit tests

Test `D1ProjectionStore` against a mock D1 database (or use `wrangler d1 execute --local` with Miniflare).

**Test coverage**:
- `resolveRecordById` — returns record by ID
- `findRecords` with various filters
- `findClaimsByPredicate`
- `findRelations`
- `findAllRecords`, `findAllClaims`, `findAllRelations`

**Files**:
- `tests/mcp/d1-store.test.ts` (new)

**Completion criterion**: Tests pass. `pnpm exec vitest --run tests/mcp/d1-store.test.ts` passes.

#### S15: Add SearchBackend tests

Test `LocalSearchBackend` (wraps existing `SearchIndex`) and `RemoteSearchBackend` (mocks `fetch`).

**Files**:
- `tests/search/search-backend.test.ts` (new)

**Completion criterion**: Tests pass. `pnpm exec vitest --run tests/search/search-backend.test.ts` passes.

#### S16: Verify all existing MCP tests pass

Run the full MCP test suite to ensure the interface refactoring didn't break anything.

**Completion criterion**: `pnpm exec vitest --run tests/mcp/` passes (all 13 existing tests + new tests).

### Phase 6 — Documentation & CI

#### S17: Create `apps/mcp/AGENTS.md`

Document the dual-mode architecture, D1 setup, and deployment instructions.

**Files**:
- `apps/mcp/AGENTS.md` (new)

**Completion criterion**: `AGENTS.md` exists with deployment docs.

#### S18: Add MCP deploy step to CI

Add a step to `.github/workflows/deploy.yml` for MCP server deployment (after search API and embedding indexing):

```yaml
- name: Export projection data to D1
  run: pnpm exec tsx scripts/export-to-d1.ts
  env:
    CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
- name: Deploy MCP server
  run: pnpm --filter @roguelike-games-ib/mcp exec wrangler deploy
  env:
    CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

**Files**:
- `.github/workflows/deploy.yml` (modified)

**Completion criterion**: Deploy workflow includes MCP deploy step.

### Phase 7 — Validation

#### S19: Run full validation suite

```sh
pnpm materialize
pnpm exec turbo run build:check
pnpm exec vitest --run
pnpm exec turbo run verify
pnpm exec tsx scripts/kb-health-summary.ts
```

**Completion criterion**: All checks pass.

#### S20: Review and fix

Run `fo-review` on all session code changes. Apply `fo-fix` if findings.

**Completion criterion**: Review complete, all findings addressed.

#### S21: Stamp implemented

```sh
pnpm exec forge rfc.implement.stamp --id RFC-0020 --implementation-commit <sha>
```

**Completion criterion**: RFC-0020 status transitions to `implemented`.

## Risk mitigations

| Risk | Mitigation step |
|---|---|
| Interface extraction breaks tool handlers | S5 refactors all handlers; S7 updates tests; S16 verifies all tests pass |
| D1 schema doesn't match data | S9 export script reads actual JSONL/JSON structure; S14 tests D1ProjectionStore |
| Schema conversion errors (JSON Schema → zod) | S11 uses low-level registration API with raw JSON Schema — no conversion needed |
| Search API response format mismatch | S3/S10 `RemoteSearchBackend` maps `SearchApiResponse` → `SearchResult`; S15 tests the mapping |
| Workers Paid plan required | Documented in RFC and AGENTS.md — not a code issue |
| Concurrent D1 access | D1 supports concurrent reads natively; MCP server is stateless per request |

## Human review points

- **D1 table schema** (S8/S9) — review schema.sql before first D1 population
- **wrangler.jsonc D1 database_id** (S12) — must be set after `wrangler d1 create`
- **Deploy workflow secrets** (S18) — `CLOUDFLARE_API_TOKEN` must have D1 permissions
