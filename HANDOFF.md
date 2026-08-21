# Handoff: Roguelike Inspiration Base — Stage 0–10 Complete

**Date**: 2026-08-21
**Session**: Stage 10 — Cataclysm-BN scale trial + COV/FORGE/REL/MIG tests (previous sessions: Stages 0–9)
**Status**: All 352 tests pass (66 test files)

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

### Stage 5 — Obsidian
- **`packages/projection-sdk`** — Shared projection reader SDK for Web/MCP/Obsidian:
  - `open.ts` — `openProjection()` reads materialized dist, refuses unsupported manifest schema, exposes `canonicalHash`
  - `manifest.ts` — `readManifest()`, `isManifestSupported()` for schema `rgkb/materialization-manifest@2`
  - `records.ts` — `readRecords()`, `readKeyMap()`, `readAliasMap()`, resolve by id/key/alias
  - `sources.ts` — `readSources()`, `findSourceById()`
  - `graph.ts` — `readRelations()`, `relationsForRecord()`, `groupRelationsByType()`
  - `claims.ts` — `readClaims()`, `claimsForRecord()`, `claimsReferencingRecord()`
  - `evidence.ts` — `readPublicEvidence()`, `evidenceForClaim()`, `isRestricted()`
  - `coverage.ts` — `readCoverage()`, `coverageForSource()`
  - `authority.ts` — `Authority` type (`canonical` | `laboratory`), context helpers
  - `index.ts` — Public exports
- **`packages/obsidian-builder`** — Deterministic Obsidian vault generator:
  - `paths.ts` — `buildPathResolver()` maps record id/key → note path (`games/<source>/<type>/<slug>.md`), fails on path collision
  - `frontmatter.ts` — `createFrontmatter()` + `serializeFrontmatter()` + `parseFrontmatter()` with `record_id`, `record_key`, `record_type`, `canonical_hash`, `generated: true`
  - `links.ts` — `resolveLink()` resolves id→key→alias to path, `makeWikiLink()`, `validateAllLinks()` fails on unresolved
  - `render-record.ts` — `renderRecordNote()` with summary, properties, relations (grouped by type), claims + evidence
  - `render-source.ts` — `renderSourceNote()` with binding digest, fingerprint, version, coverage dimensions
  - `moc.ts` — `renderMoc()` generates Map of Content with links grouped by record type
  - `build-manifest.ts` — `createBuildManifest()` with schema `rgkb/obsidian-build-manifest@1`, deterministic `builtAt`
  - `build.ts` — `buildObsidianVault()` orchestrates: materialize if needed → open projection → build path resolver → render all notes → validate links → render sources → render MOC → write README + _meta → write build manifest
  - `index.ts` — Public exports
- OBS-001..006 (10 tests across 6 files) — all pass
  - OBS-001: every note carries id/key/hash/generated frontmatter, hash matches current build
  - OBS-002: every wiki-link resolves uniquely to a generated note file
  - OBS-003: duplicate path collision fails build
  - OBS-004: vault build never changes canonical files, output under generated root
  - OBS-005: generated warning present in README.md and _meta/generated.txt
  - OBS-006: localized projection preserves canonical record_id and record_key

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

### Stage 6 — MCP
- **`apps/mcp`** — Public read-only MCP server over materialized dataset:
  - `context.ts` — `createMcpContext()` opens projection + builds search index, exposes dataset metadata
  - `errors.ts` — `McpError` hierarchy: `InvalidCursorError`, `StaleCursorError`, `NotFoundError`, `ValidationError`
  - `envelope.ts` — `envelope()` wraps every response with `{ dataset, authority: "canonical", data }`
  - `pagination.ts` — `encodeListCursor()` / `decodeListCursor()` with canonical hash + filter digest binding; `paginate()` with stable key ASC then id ASC sort
  - `tools/dataset.ts` — `get_dataset_info` returns dataset/model version, canonical hash, license, source count, record counts
  - `tools/sources.ts` — `list_sources` (paginated), `get_source_status` (coverage dimensions, record count)
  - `tools/records.ts` — `get_record` (by id or key), `resolve_key` (key/alias → current record)
  - `tools/search.ts` — `search_records` (hybrid/lexical/vector) with score disclaimer, cursor validation
  - `tools/definitions.ts` — `list_definitions` (by source_id, optional kind filter, paginated)
  - `tools/mechanics.ts` — `find_mechanics` / `find_systems` (canonical only, structured filters)
  - `tools/graph.ts` — `traverse_relations` (typed canonical edges, depth hard max 3, direction filter)
  - `tools/claims.ts` — `get_claims` (by record_id, optional predicate filter)
  - `tools/evidence.ts` — `get_evidence` (enforces publication policy, restricted evidence not in projection)
  - `tools/compare.ts` — `compare_records` (2..10), `compare_games` (2..8 sources, optional concept_key)
  - `tools/design.ts` — `find_cross_game_concepts`, `find_design_primitives`, `query_design_space` (design-scope relations)
  - `tools/coverage.ts` — `get_coverage` (coverage dimensions per source)
  - `server.ts` — `createMcpToolRegistry()` registers all 18 required tools; `assertNoWriteTools()` validates read-only; `REQUIRED_TOOLS` list
  - `index.ts` — Public exports
- MCP-001..010 (40 tests across 10 files) — all pass
  - MCP-001: all 18 required tools registered, all read-only, have description + input schema
  - MCP-002: get_record by id and key agree, response includes dataset/authority metadata
  - MCP-003: pagination stable for equal sort values (key ASC then id ASC), no gaps or duplicates
  - MCP-004: cursor bound to canonical hash, stale hash → StaleCursorError, tampered → error
  - MCP-005: no tool provides arbitrary source file access, no file/path parameters
  - MCP-006: restricted evidence redacted (filtered by materializer, not accessible via MCP)
  - MCP-007: traversal depth hard max 3 enforced, depth 0/negative rejected
  - MCP-008: search scores labeled as relevance signals not confidence, score_disclaimer present
  - MCP-009: CC-BY-4.0 license in dataset info and response envelope
  - MCP-010: no canonical write tool registered, no lab_write/lab_generate, all tools read-only

### Stage 7 — Web
- **`apps/web`** — Creator-facing Astro static site over materialized dataset:
  - `lib/context.ts` — `createWebContext()` opens projection + builds search index, exposes dataset metadata
  - `lib/verify.ts` — `verifyMaterialization()` checks manifest exists + schema supported + records present; `assertMaterialization()` throws on failure
  - `lib/resolve.ts` — `resolveRecordRoute()` resolves by id → key → alias, returns `ResolvedRecord` with `resolvedFrom` and `currentKey`
  - `lib/evidence.ts` — `renderEvidence()` maps `PublicEvidence` to `RenderedEvidence` with excerpt truncation; `evidenceForRecord()` filters by evidence refs
  - `lib/metadata.ts` — `getPageMetadata()` returns canonical hash, dataset info, license, authority; `metadataToHtmlMeta()` generates `<meta>` tags
  - `lib/authority.ts` — `authorityBadge()` returns badge data for canonical/laboratory; `isNonAuthoritative()` check
  - `lib/build.ts` — `prepareWebBuild()` asserts materialization then creates context
  - `index.ts` — Public exports
  - 10 Astro components: `AuthorityBadge`, `EpistemicBadge`, `EvidenceList`, `RelationGraph`, `CoveragePanel`, `RecordHeader`, `SourceBindingPanel`, `CompareTable`, `DesignAncestry`, `SearchBox`
  - 12 Astro pages: `/`, `/games/`, `/games/[sourceId]/`, `/games/[sourceId]/definitions/[kind]/`, `/games/[sourceId]/mechanics/`, `/games/[sourceId]/systems/`, `/records/[...key]/`, `/compare/`, `/design/`, `/inspiration/`, `/evidence/[recordId]/`, `/dataset/`, `/about/method/`, `/404`
  - `Base.astro` layout with nav + metadata injection
- WEB-001..006 (31 tests across 6 files) — all pass
  - WEB-001: web build refuses stale/missing materialization
  - WEB-002: record route resolves alias to current record, emits canonical current key
  - WEB-003: evidence short excerpt obeys limit (default 200, custom limit works)
  - WEB-004: restricted evidence text is not rendered (excluded from projection entirely)
  - WEB-005: Laboratory content has non-authoritative badge (canonical vs laboratory class/label)
  - WEB-006: page metadata reports canonical hash (in PageMetadata + HTML meta tags)

### Stage 8 — Laboratory runtime

Implemented `packages/laboratory-runtime` per spec `03-packages/LABORATORY-RUNTIME.md` and `05-laboratory/INSPIRATION-ENGINE.md`.

Required files: `src/index.ts`, `schema.ts`, `sessions.ts`, `seeds.ts`, `constraints.ts`, `mutation.ts`, `ancestry.ts`, `generator.ts`, `boundary.ts`.

Key rules:
- Laboratory records use `authority: laboratory`, own schema/id namespace (`urn:roguelike-games-ib:lab:<uuid-v7>`)
- May reference canonical record ids as ancestry/input
- May never be referenced by canonical `evidence_refs`
- Seed promotion = new canonical candidate via transaction, not direct canonical mutation
- `IdeaGenerator` interface is model-agnostic; deterministic pipeline works without provider
- Provider failure must never write/alter canonical knowledge
- Anti-copy ranking penalizes cosmetic-only mutation

Tests: LAB-001..007 (27 tests in 1 file) — all pass:
- LAB-001: seed may reference canonical ancestry
- LAB-002: canonical evidence cannot reference seed
- LAB-003: seed carries authority=laboratory
- LAB-004: promotion from seed creates new candidate, not direct canonical mutation
- LAB-005: anti-copy ranking penalizes cosmetic-only mutation
- LAB-006: generator/provider failure cannot mutate canonical state
- LAB-007: persisted generated seed records provider/model/template and ancestry

Gate: LAB-001..007 and C8 (authority boundary).

### Stage 9 — BrogueCE real vertical slice

Registered BrogueCE as a source unit. Built deterministic factual extractors parsing C source code. Reconstructed evidence-backed semantic slice. Promoted 692 records to canonical via transaction.

**Source registration**:
- Source bundle at `../roguelike-games-ib-source/BrogueCE/` with `package.json` (`werkstattSource` schema, id `broguece`, version `1.15.1`)
- Registered in `knowledge/sources/registry.yaml` and `bindings.yaml` with `sha256-tree-v1` fingerprint `42215a96...` and binding digest `5fb1793f...`

**Extractor (`packages/broguece-extractor`)**:
- `c-parser.ts` — Parses C source: `enum` definitions, `monsterCatalog` array, `tileCatalog` array, `itemTable` arrays (weapon/armor/food/key/staff/ring)
- `extractor.ts` — Deterministic extractor (`broguece-factual` v1.0.0) producing 327 `game_definition` records:
  - 67 creatures (maxHP, defense, accuracy, damage, regen, speed, flags, abilities)
  - 214 terrain tiles (draw priority, flags, mech flags, descriptions, flavor text)
  - 46 items (frequency, market value, strength, power, damage range, description)
- Verified deterministic: double-run hash `092e0e23...` matches

**Semantic records (12)** across mechanic/system/algorithm/invariant/emergence:
- Monster progression, terrain tile system, item identification, fire spread algorithm, stealth/sneak attack, gas propagation, monster ability flags, weapon runic enchantments, dungeon layering invariant, emergent trap interactions, staff magic bolts, ring buff/debuff curses

**Claims (3)**: rat max HP, lava insta-death flag, dagger sneak attack — all with evidence refs

**Relations (2)**: goblin warlord summons (has_ability), fire spreads to flammable (interacts_with)

**Concepts (2)**:
- Design primitive: "Layered Terrain Promotion" with ancestry (source_games, derived_from, mutation_dimensions)
- Cross-game concept: "Runic Weapon Enchantments" with inclusion/exclusion criteria

**Runner script**: `scripts/run-stage9.ts` — runs extractor → staging → creates semantic records → promotes all to canonical via `applyPromotionTransaction`

**Test**: `tests/mig/mig-003.test.ts` — 15 C9 conformance tests, all pass

Gate: C9 conformance (15 tests) — all pass. Zero release-blocking diagnostics.

### Stage 10 — Cataclysm-BN scale trial

Built data-driven JSON extractor for Cataclysm-BN. High-cardinality families extracted with exact denominator counts. 14,894 canonical records promoted.

**Source registration**:
- Source bundle at `../roguelike-games-ib-source/Cataclysm-BN/` with `package.json` (`werkstattSource` schema, id `cataclysm-bn`, version `0.7.1`)
- Registered in `knowledge/sources/registry.yaml` and `bindings.yaml` with `sha256-tree-v1` fingerprint `0747e1f4...` and binding digest `a8b27380...`
- Payload path: `data/json` (JSON data files, not C source)

**Extractor (`packages/cataclysm-bn-extractor`)**:
- `json-parser.ts` — Parses Cataclysm-BN JSON data: monsters (type=MONSTER), items (any id), mutations, professions
- `extractor.ts` — Deterministic extractor (`cataclysm-bn-factual` v1.0.0) producing 7,447 `game_definition` records:
  - 597 creatures (hp, speed, aggression, morale, melee, dodge, species, flags)
  - 5,886 items (symbol, color, price, volume, weight, material, flags)
  - 625 mutations (points, visibility, category, leads_to)
  - 339 professions
- Verified deterministic: double-run hash matches

**Runner script**: `scripts/run-stage10.ts` — runs extractor → staging → promotes all to canonical via `applyPromotionTransaction`

**Benchmarks**:
- Extraction runtime: ~1.7s
- Promotion runtime: ~0.6s
- Peak heap: ~68MB
- Peak RSS: ~208MB
- Total canonical records: 14,894 (7,447 game_definition + 7,447 evidence)

**Test**: `tests/conformance/c10-cataclysm-bn.test.ts` — 14 C10 conformance tests, all pass

Gate: C10 conformance (14 tests) and deterministic replay — all pass.

### Additional tests implemented (post-Stage 9)

- **COV-001..005**: 20 coverage engine tests (`tests/cover/cover-001-005.test.ts`)
- **FORGE-006**: 7 release evidence tests (`tests/forge/forge-006.test.ts`)
- **REL-001..009**: 23 release gate tests (`tests/release/release-001-009.test.ts`)
- **MIG-001,002,005**: 12 migration tests (`tests/mig/mig-{001,002,005}.test.ts`)
- **Release builder package**: `packages/release-builder` with `checkRelease`, `generateReleaseEvidence`, `createDatasetManifest`, `buildRelease`

**Total: 66 test files, 352 tests, 0 failures.**

## What the next agent should do

### Stage 9 — ✅ Complete

Stage 9 (BrogueCE vertical slice) is complete. All 15 C9 conformance tests pass. 692 canonical records promoted (327 game_definition + 12 semantic_record + 346 evidence + 3 claim + 2 relation + 2 concept). See Stage 9 section above for details.

**Note**: The runner script `scripts/run-stage9.ts` is re-runnable. It will replace existing canonical records via transaction.

### Stage 10 — ✅ Complete

Stage 10 (Cataclysm-BN scale trial) is complete. All 14 C10 conformance tests pass. 14,894 canonical records promoted (7,447 game_definition + 7,447 evidence). See Stage 10 section above for details.

**Note**: The runner script `scripts/run-stage10.ts` is re-runnable.

### Stage 11 — Freeze v1 implementation contract

Review ontology pressure points; accept RFC/ADR changes; freeze schema/plugin/project contract `1.0`; begin remaining-game migration.

**Context**: Now that two sources (BrogueCE + Cataclysm-BN) are extracted, review:
- Ontology relation types — `interacts_with` and `has_ability` are NOT in `relation-types.yaml` but appear in BrogueCE semantic records. Either add them or remap.
- Schema pressure points from 14K+ records (field coverage, missing optional fields)
- Extractor SDK patterns — JSON-based extractors (Cataclysm-BN) vs C-source parsers (BrogueCE) both work
- v1 human curation migration — MIG tests cover candidate staging; actual v1 notes migration still needed

### Stage 12 — Remaining sources

One source at a time: register → discover → extractor → factual promotion → semantic reconstruction → coverage → projections → release gate.

**Remaining games** (18 of 20): NetHack, Crawl, Angband, DRL, HyperRogue, KeeperRL, Shattered PD, Pixel Dungeon, End of Eden, Harmonist, Hauberk, Infra Arcana, Moonlit Myriad, RogueBot, Sleeping Beauty, SpaceHuggers, SteamSky, TRW.

**v1 human curation**: `notes/` directory in `/home/syrokomskyi/projects/roguelike-games` contains:
- 22 cross-game analysis files (`_cross_game/`)
- Per-game TAKEAWAYS, GAME_CARD.yaml, COVERAGE.md
- Mechanic matrix comparing 20 games
- These should be migrated as candidates/hints (not canonical facts) per MIG-001 pattern

## Important paths
- Spec source: `/home/syrokomskyi/projects/obsidian/GamesObsidian/Cave Traveller/research/2026-08-20 Roguelike Inspiration Base/output/Roguelike-Games-KB-Implementation-Spec-v1.0.0/`
- Test catalog: `07-tests/TEST-CATALOG.md`
- Build sequence: `10-delivery/BUILD-SEQUENCE.md`
- Package specs: `03-packages/`
- v1 source: `/home/syrokomskyi/projects/roguelike-games` (games/ + notes/)
- Source bundles: `/home/syrokomskyi/projects/roguelike-games-ib-source/`

## Verification commands
```bash
pnpm exec vitest run                    # all tests (352 tests, 66 files)
pnpm exec tsc --noEmit -p packages/knowledge-core/tsconfig.json   # typecheck core
pnpm exec tsc --noEmit -p packages/knowledge-schemas/tsconfig.json # typecheck schemas
pnpm exec tsc --noEmit -p packages/extractor-sdk/tsconfig.json     # typecheck extractor-sdk
pnpm exec tsc --noEmit -p packages/materializer/tsconfig.json      # typecheck materializer
pnpm exec tsc --noEmit -p packages/search/tsconfig.json            # typecheck search
pnpm exec tsc --noEmit -p packages/projection-sdk/tsconfig.json    # typecheck projection-sdk
pnpm exec tsc --noEmit -p packages/obsidian-builder/tsconfig.json  # typecheck obsidian-builder
pnpm exec tsc --noEmit -p apps/mcp/tsconfig.json                   # typecheck mcp
pnpm exec tsc --noEmit -p apps/web/tsconfig.json                   # typecheck web
pnpm exec tsc --noEmit -p packages/laboratory-runtime/tsconfig.json # typecheck laboratory-runtime
pnpm exec tsx scripts/run-stage9.ts    # re-run BrogueCE extraction + promotion
pnpm exec tsx scripts/run-stage10.ts   # re-run Cataclysm-BN extraction + promotion
```
