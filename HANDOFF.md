# Handoff: Roguelike Inspiration Base — Stage 0, 1, 2, 3 & 4 Complete

**Date**: 2026-08-21
**Session**: Stage 0 + Stage 1 + Stage 2 + Stage 3 + Stage 4 implementation
**Status**: All 153 tests pass (35 test files)

## What was done

### Stage 0 — Freeze inputs, skeleton, vendor model, Forge spike
- Renamed all KB references to IB (ADR-0002)
- Root config: `knowledge.config.yaml`, `knowledge/manifest.yaml`, `package.json`, `turbo.json`, `tsconfig.base.json`, `.editorconfig`, `.gitattributes`, `.gitignore`
- Governance docs: `README.md`, `SECURITY.md`, `CONTRIBUTING.md`, `NOTICE.dataset.md`, `LICENSES/CC-BY-4.0.txt`, `knowledge/LICENSE.md`
- `tools/kernel.config.ts` — Forge/Werkstatt kernel config using `defineKernelConfig` + `werkstattKnowledgePlugin.moduleLoaders`
- Canonical knowledge tree skeleton: `knowledge/ontology/` with 15 JSON Schema files (IB naming in URN patterns), `knowledge/sources/registry.yaml` + `bindings.yaml`, `knowledge/identity/keys.jsonl` + `aliases.jsonl`, ontology files (`relation-types.yaml`, `game-content-taxonomy.yaml`, `design-space.yaml`, `record-types.yaml`, `schema-registry.yaml`)
- FORGE-001..005 tests pass (13 assertions)

### Stage 1 — Canonical core implementation
- **`packages/knowledge-core`** — Full domain-independent authority/persistence logic:
  - `config.ts` / `paths.ts` — workspace path resolution, source root derivation (`../<kb-id>-source`)
  - `canonical-json.ts` — RFC-8785-like sorted-key JSON serialization, JSONL helpers
  - `canonical-yaml.ts` — YAML 1.2 canonical serialization
  - `hash.ts` — SHA-256, source fingerprint (sha256-tree-v1), binding digest, fragment hash, canonical tree hash
  - `source/` — root resolution, metadata parsing (README + package.json), fingerprint, binding, drift detection, read guard
  - `identity/` — UUIDv7 record IDs, key/alias registries, refresh matching
  - `evidence/` — anchor creation/validation, fragment hashing, re-anchoring (unique + ambiguous), publication policy
  - `graph/` — claims, relations (domain/range), contradictions, references, full `validateCanonicalGraph`
  - `coverage/` — dimension states, no universal boolean, drift invalidation
  - `transaction/` — candidate batches, promotion plans, atomic apply with backup, crash recovery
- **`packages/knowledge-schemas`** — AJV 2020-12 schema registry compiler, offline-only, JSON pointer diagnostics
- **`packages/test-fixtures`** — Temp workspace/source bundle builders
- CORE-001..024 (36 tests), SCHEMA-001..005 (7 tests), GRAPH-001..008 (8 tests) — all pass

### Stage 2 — Extractor SDK + staging pipeline
- **`packages/extractor-sdk`** — Full extractor SDK for building source-specific static adapters:
  - `types.ts` — Core interfaces: `ExtractorManifest`, `ExtractorContext`, `Extractor`, `ExtractorRunResult`, `StagedRecord`, `StagedEvidence`, `StagedPopulation`
  - `source-reader.ts` — `ReadonlySourceReader` with `readBytes`, `readText`, `stat`, `walk`, `parseJson`, `parseYaml`; path traversal & symlink escape protection; no exec/write/network APIs
  - `manifest.ts` — `validateManifest()` enforcing schema version `werkstatt/knowledge-extractor@1`, `deterministic: true`, `parserMode: "static"`
  - `evidence-builder.ts` — `EvidenceFactory` with `create()` / `createPrivate()` wrapping `createEvidenceAnchor`
  - `population.ts` — `PopulationContract`, `resolvePopulationCounts()`, `checkRecordLoss()` for record-loss detection
  - `output-writer.ts` — `CandidateWriter` writing to staging only (batch.jsonl, evidence.jsonl, population.jsonl, batch-manifest.json, diagnostics.jsonl)
  - `identity.ts` — `RefreshIdentityResolver` wrapping `matchDefinitionOnRefresh` for key/alias-based identity retention
  - `context.ts` — `SchemaFacade` interface, `createSchemaFacade()`, `createNullSchemaFacade()`
  - `deterministic.ts` — `hashRunResult()`, `runExtractorDeterministic()` (double-run hash comparison), `createExtractorContext()`
  - `index.ts` — Public exports
- EXT-001..010 (25 tests across 8 files) — all pass
  - EXT-001: absolute path rejection
  - EXT-002: `..` traversal rejection
  - EXT-003: symlink escape rejection
  - EXT-004: no exec/write/network API surface
  - EXT-005: deterministic replay (identical hashes on double-run)
  - EXT-006: population denominator recording
  - EXT-007: output to staging only, not canonical
  - EXT-008: schema validation flags invalid records
  - EXT-009: record identity retention across runs
  - EXT-010: record loss detection with threshold

### Stage 3 — Materializer
- **`packages/materializer`** — Deterministic JSONL/SQLite read model builder:
  - `types.ts` — Core interfaces: `CanonicalRecord`, `CanonicalState`, `MaterializationManifest`, `MaterializationResult`, `VerificationResult`
  - `verify-input.ts` — `readCanonicalState()` walks canonical root, classifies by directory name (claim/relation/contradiction/evidence), loads relation types from ontology; `verifyCanonicalState()` runs `validateCanonicalGraph` + required field checks
  - `normalize.ts` — Record sorting (key then id), field extraction helpers, source identity extraction
  - `public-evidence.ts` — `redactPublicEvidence()` filters to public-only, redacts locators per policy, limits excerpts; `isPublicEvidence()`, `isRestrictedEvidence()`
  - `records-jsonl.ts` — Deterministic JSONL writers for records, claims, relations, evidence.public, sources, coverage, key-map, alias-map (all sorted, canonical JSON)
  - `sqlite.ts` — `buildSqlite()` creates 8 tables + FTS5 virtual table; `computeLogicalDumpHash()` for cross-version stability; `verifySqliteIntegrity()` with FK and integrity checks
  - `manifest.ts` — `createManifest()` with schema `rgkb/materialization-manifest@2`, canonical hash, license, record counts, binding digests, logical dump hash
  - `checksums.ts` — File SHA-256 checksum computation
  - `build.ts` — `materialize()` orchestrates: resolve paths → read state → verify → compute hash → write JSONL → build SQLite → verify integrity → write manifest
  - `index.ts` — Public exports
- MAT-001..007 (29 tests across 7 files) — all pass
  - MAT-001: refuses invalid canonical state (dangling refs, missing fields)
  - MAT-002: JSONL output deterministic (byte-identical across builds, sorted)
  - MAT-003: manifest contains canonical hash, license (CC-BY-4.0), schema, dataset info, record counts
  - MAT-004: SQLite logical integrity mirrors JSONL counts, FK integrity passes
  - MAT-005: public evidence redaction — private/restricted excluded, locators controlled by policy
  - MAT-006: alias map resolves old keys to current keys, key map resolves keys to IDs
  - MAT-007: two builds from same canonical hash produce identical JSONL, same logical dump hash

## Key technical decisions
- `tsconfig.base.json` uses `allowImportingTsExtensions: true` + `noEmit: true` (bundler mode)
- Root `package.json` lists workspace packages as `workspace:*` devDeps for test resolution
- `vitest.config.ts` at root, tests in `tests/` directory
- Claim schema `oneOf` for `object_ref` vs `value` includes inline `properties` for AJV strict mode
- Materializer classifies canonical records by top-level directory name (claim/, relation/, etc.) not `record_type` field
- SQLite uses `CREATE VIRTUAL TABLE ... USING fts5` for full-text search
- Aliases table stores `record_key` (not `record_id`) since `retired_to` is a key, not an ID
- Materialization manifest uses fixed `builtAt: "1970-01-01T00:00:00.000Z"` for determinism

### Stage 4 — Search
- **`packages/search`** — Search index built on materialized SQLite, 5 retrieval layers:
  - `types.ts` — Core interfaces: `SearchIndex`, `SearchRecord`, `SearchHit`, `ScoreComponents`, `SearchQuery`, `SearchFilters`, `SearchResult`, `SearchIndexManifest`, `VectorIndex`, `VectorMatch`, `GraphExpansionOptions`, `GraphEdge`, `GraphExpansionResult`, `ExactLookupQuery`, `FtsHit`
  - `exact.ts` — `exactLookup()` resolves by id → key → alias (deterministic, no scoring)
  - `filters.ts` — `buildFilterClause()` + `filterRecordIds()` for structured filtering (source_id, record_type, kind, epistemic_status)
  - `fts.ts` — `ftsSearch()` using SQLite FTS5 with `bm25()` scoring, stable tie-break by key ASC then id ASC
  - `graph.ts` — `graphExpand()` traverses typed canonical relations only (no inferred/vector edges), supports direction filtering and maxDepth
  - `vectors.ts` — `VectorIndex` interface, `NullVectorIndex` (no-op), `InMemoryVectorIndex` (cosine similarity), `createVectorMetadata()` for manifest
  - `ranking.ts` — `computeScores()` returns lexical_score + vector_score + graph_boost → final_score (all exposed separately), `rankHits()` with stable tie-breaker
  - `hybrid.ts` — `hybridSearch()` combines FTS + vector + graph boost, applies filters, paginates with cursor
  - `cursor.ts` — `encodeCursor()` / `validateCursor()` with canonical hash binding; stale cursors rejected
  - `build.ts` — `buildSearchIndex()` creates `SqliteSearchIndex` from materialized DB + optional vector index; `writeSearchManifest()` writes JSON manifest
  - `index.ts` — Public exports
- SEARCH-001..006 (35 tests across 6 files) — all pass
  - SEARCH-001: exact id/key/alias lookup deterministic
  - SEARCH-002: FTS stable tie break by key/id
  - SEARCH-003: hybrid scores expose components separately (lexical, vector, graph_boost, final)
  - SEARCH-004: vector index metadata contains canonical hash/model/provider/dimensionality
  - SEARCH-005: graph expansion uses typed canonical edges only (relation_type filter, direction, maxDepth)
  - SEARCH-006: stale search cursor rejected after canonical hash change

## What the next agent should do

### Then: Obsidian, MCP, Web, Laboratory, Release gates, Migration

## Important paths
- Spec source: `/home/syrokomskyi/projects/obsidian/GamesObsidian/Cave Traveller/research/2026-08-20 Roguelike Inspiration Base/output/Roguelike-Games-KB-Implementation-Spec-v1.0.0/`
- Test catalog: `07-tests/TEST-CATALOG.md`
- Build sequence: `10-delivery/BUILD-SEQUENCE.md`
- Package specs: `03-packages/`

## Verification commands
```bash
pnpm exec vitest run                    # all tests (153 tests, 35 files)
pnpm exec tsc --noEmit -p packages/knowledge-core/tsconfig.json   # typecheck core
pnpm exec tsc --noEmit -p packages/knowledge-schemas/tsconfig.json # typecheck schemas
pnpm exec tsc --noEmit -p packages/extractor-sdk/tsconfig.json     # typecheck extractor-sdk
pnpm exec tsc --noEmit -p packages/materializer/tsconfig.json      # typecheck materializer
pnpm exec tsc --noEmit -p packages/search/tsconfig.json            # typecheck search
```
