---
rfcId: RFC-0010
auditId: AUDIT-RFC-0010-01
date: 2026-08-23
auditor:
  skill: fo-idea-audit
  model: claude-sonnet-4-20250514
verdict: needs-revision
---

# Audit: RFC-0010

## Verdict: Needs revision

The RFC contains multiple factual errors about the existing search API code, proposes functionality that partially already exists, and has a V-24 error (architecture RFC without DNA invariant). The core idea is sound, but the RFC needs correction before implementation.

## Mechanical validation (rfc.validate)

**Fail** — 1 error, 5 warnings:

- **V-24 (error)**: Architecture RFC created 2026-08-23 (>= 2026-07-07) must declare at least one DNA invariant in `satisfies`. The project has `invariantsFile: null` in `forge.yaml`, but V-24 still requires at least one entry. RFC-0009 (same project) resolved this by being `kind: policy` instead of `kind: architecture`. Consider changing `kind` to `policy` or adding a DNA invariant.
- **V-13 (warning)**: Missing required sections: "Architectural fit", "Design", "Rollout", "Alternatives considered", "Implementation notes for agents".

## Axis A — Structural completeness

1. **Missing required sections**: "Architectural fit", "Design", "Rollout", "Alternatives considered", "Implementation notes for agents" are all absent. See V-13 warnings above.

2. **Decision format**: D1–D5 are individual decisions, which is fine. But they lack the "Design" wrapper that provides architectural context for how the decisions fit together.

3. **No Rollout section**: The RFC doesn't describe default behavior, adoption path for existing data, or migration window. The reindexing step is mentioned in the implementation plan but not in a dedicated Rollout section.

4. **No Alternatives considered**: The RFC doesn't explore alternatives. For example: extending the existing `/api/design-search` endpoint instead of adding filters to `/api/search`, or extending the existing `query_design_space` MCP tool instead of creating `search_design_space`.

5. **No Implementation notes for agents**: Missing behavioral rules for implementing agents — e.g., MODULE_CONTRACT requirements for `apps/web/` per `apps/web/AGENTS.md`, CI gates policy, status gate enforcement.

## Axis B — DNA alignment

1. **V-24 error**: `satisfies: []` on an architecture RFC created after 2026-07-07. The project has `invariantsFile: null`, so there are no DNA invariants to satisfy. RFC-0009 resolved this by using `kind: policy` with an explicit note: "the project has no invariants file configured (`invariantsFile: null` in `forge.yaml`)". RFC-0010 should either change `kind` to `policy` or address the V-24 requirement.

2. **`related[]` references**: RFC-0003, RFC-0004, RFC-0009 are all implemented and relevant. No issues.

## Axis C — Ecosystem fit

1. **Factual error — `SearchApiRequest` type**: The RFC says "Extend `SearchApiRequest` in `apps/search-api/src/types.ts`" (D1, D2, Step 1). There is no `SearchApiRequest` type in `@/apps/search-api/src/types.ts:1-105`. The search API uses URL query parameters, not a typed request body. The relevant types are `SearchApiResponse`, `SearchApiHit`, and `VectorMetadata`.

2. **Factual error — `record_type` filter already exists**: D2 proposes adding a `record_type` query parameter. But `handleSearch()` in `@/apps/search-api/src/index.ts:75` already reads `url.searchParams.get("type")` and applies it as a `record_type` filter in the Vectorize query (line 86). The parameter name is `type`, not `record_type`. The RFC should acknowledge this existing functionality and either: (a) extend the existing `type` parameter, or (b) explain why a separate `record_type` parameter is needed.

3. **Factual error — search "modes"**: The RFC states the search API supports "two modes: `semantic` and `design`" (Context section, line 56). In reality, `mode` is a hardcoded field in `SearchApiResponse` — it is always `"semantic"` for `/api/search` (line 95) and is not accepted as input. The "design" mode is a separate endpoint (`/api/design-search`) with a different response shape (`DesignSearchApiResponse`). The RFC should describe these as two endpoints, not two modes.

4. **Existing `handleDesignSearch` not acknowledged**: `handleDesignSearch()` in `@/apps/search-api/src/index.ts:98-130` already filters by `record_type: "concept"` and returns concept-specific fields. D2's `record_type=concept` filter is partially redundant with this existing endpoint. The RFC should explain why filtering at `/api/search` is needed in addition to the dedicated `/api/design-search` endpoint.

5. **MCP architectural mismatch**: D4 proposes `search_design_space` calling the search API via HTTP. But existing MCP tools in `derived.ts` use `ctx.store` (local SQLite/better-sqlite3), not HTTP calls to the Cloudflare Worker. The `searchRecords` tool in `search.ts` uses `ctx.searchIndex` (local search package). The RFC should clarify whether `search_design_space` will make HTTP calls (new pattern) or use the local store (existing pattern). If HTTP, the MCP tool needs a search API URL and token at runtime — the RFC doesn't address this.

6. **`appsImpacted` missing `web`**: D5 proposes changes to `apps/web/src/pages/search.astro` and `apps/web/src/components/SearchBox.astro`, but `appsImpacted` only lists `search-api` and `mcp`. The `web` app is impacted and should be listed.

7. **Existing `query_design_space` tool not acknowledged**: The MCP server already registers `query_design_space` in `@/apps/mcp/src/server.ts:339-354`. D4 proposes a new `search_design_space` tool. The RFC should acknowledge the existing tool and explain why a new tool is needed instead of extending it.

## Axis D — Forward-only compliance

No issues. The RFC proposes additive changes (new optional query parameters, new MCP tool). No backward compatibility layers or dual-path proposals.

## Axis E — Agent-facing policy

1. **`quality_score` in MCP response**: D4 states the `search_design_space` tool returns `quality_score` (from RFC-0009). But if the tool calls the search API, `SearchApiHit` in `@/apps/search-api/src/types.ts:35-47` does not include `quality_score`. The search API would need to be extended to return `quality_score` in hits, or the MCP tool would need to look up scores from the local store after getting search results. The RFC doesn't address this gap.

2. **No self-authorizing language**: Status is `draft`. No issues.

3. **No `NEEDS CLARIFICATION` markers**: None found.

## Axis F — Pragmatism

1. **D2 duplicates existing functionality**: The `record_type` filter already exists as the `type` parameter. See Axis C finding #2.

2. **D3 doesn't check existing `buildEmbeddingText`**: The RFC proposes enhancing `toIndexRecord()` in `scripts/index-embeddings.ts` to build a richer summary. But `buildEmbeddingText()` in `@/apps/search-api/src/index.ts:282-294` already includes `concept_type`, `source_games`, and `mutation_dimensions` in the embedding text. The RFC's proposed embedding text adds `inclusion_criteria` and `mutation_dimensions` — but `mutation_dimensions` is already present. The RFC should review `buildEmbeddingText()` and clarify whether the change targets `toIndexRecord()` (client-side `summary` field) or `buildEmbeddingText()` (server-side embedding text construction).

3. **D4 new tool vs. extending existing**: `query_design_space` already exists for structured design-space queries. The RFC should justify why a new tool is better than extending the existing one with a `semantic_query` mode.

## Axis G — Blind spots

1. **Selective reindexing not addressed**: D3/Step 2 says "Re-run `pnpm index:embeddings` to reindex concepts with enhanced text." But `index-embeddings.ts` indexes ALL records — there's no mechanism to selectively reindex only concepts. The `INDEX_START_BATCH` and `INDEX_BATCH_COUNT` env vars control batch ranges, not record types. The RFC should address whether a full reindex is required or propose a filtering mechanism.

2. **Edge cases for concept embedding text**: D3 proposes including `inclusion_criteria` and `mutation_dimensions` in the embedding text. But not all concepts have these fields. The RFC should specify behavior for concepts with empty or missing `inclusion_criteria` / `mutation_dimensions`.

3. **`concept_type` filter in Vectorize**: D1 proposes filtering by `concept_type`. The `concept_type` field is already stored in `VectorMetadata` (line 20 of types.ts) and serialized in `toVectorMetadata()` (line 274 of index.ts). Adding it to the filter object in `handleSearch()` is technically straightforward. No issue, but the RFC should confirm Vectorize supports string equality filtering on this field.

4. **No security/privacy concerns**: The RFC doesn't touch user data or PII. No issues.

## Questions for the author

1. The search API already has a `type` parameter that filters by `record_type` (line 75-86 of `index.ts`). Why propose a separate `record_type` parameter instead of extending the existing one? And why is the existing `/api/design-search` endpoint (which already filters by `record_type: "concept"`) insufficient?

2. The existing MCP tools use `ctx.store` (local SQLite) for data access. Will `search_design_space` make HTTP calls to the search API (new pattern requiring URL/token at runtime), or will it use the local search index (`ctx.searchIndex`)? If HTTP, how does it obtain the search API URL and authentication token?

3. `buildEmbeddingText()` in the Worker already includes `concept_type`, `source_games`, and `mutation_dimensions` in the embedding text. Should D3's enhancement target `toIndexRecord()` (the `summary` field sent to the Worker) or `buildEmbeddingText()` (the actual text the Worker embeds)? These are two different layers.
