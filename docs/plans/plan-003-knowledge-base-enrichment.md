---
id: PLAN-003
title: Knowledge base enrichment — deriver, concepts, search, MCP, Obsidian
status: accepted
scope: project-wide
decider: architecture
reviewers:
  - human:andrii-syrokomskyi
related:
  - RFC-0001
  - PLAN-002
created: 2026-08-23
accepted: 2026-08-23
implementedAt:
closedAt: null
---

# PLAN-003: Knowledge base enrichment — deriver, concepts, search, MCP, Obsidian

## Context

PLAN-002 is closed. All 4 games are fully extracted (20,500 definitions, 111,129 claims, 28,875 relations, 951 semantic records). The knowledge base is clean and consistent. This plan covers enriching the derived layer, expanding cross-game concepts, improving search/MCP, and rebuilding the Obsidian vault.

## Current state

| Component | Status | Gaps |
|---|---|---|
| Deriver | Basic — flat claims from attributes, simple cross-ref relations, grouping semantic records | No cross-game relations; only 1 cross-ref type (`leads_to`); object-valued attributes skipped; no design-space relations |
| Concepts | 2 concepts, both brogueCE-only | No cross-game concepts despite 4 games extracted; no design primitives |
| Search API | Cloudflare Worker with vector search, design search, indexing | Not deployed; no embeddings indexed; materializer not run |
| MCP | 18 read-only tools registered | Not deployed; tools read from materialized dist (not generated yet) |
| Obsidian builder | Script exists, not run since re-extraction | Vault stale |
| Web | 16,195 pages built | Built but not deployed |

## Tasks

### D — Deriver improvements

#### D-1: Expand cross-reference relations

Current: only `leads_to` attribute → `TRANSFORMS_INTO` relation.

Add cross-ref detection for attributes that reference other records:
- `equivalent_mons` (Crawl forms) → `EQUIVALENT_TO` relation (form → creature)
- `quest_artifact` (NetHack roles) → `REQUIRES` relation (class → artifact)
- `talisman` (Crawl forms) → `USES_ITEM` relation (form → item)
- `monster_index` / `leader_index` / `nemesis_index` (NetHack roles) → `RELATED_TO` relation
- `default_faction` (Cataclysm-BN) → `BELONGS_TO` relation (creature → faction)
- `result` / `tools` / `components` (Cataclysm-BN recipes) → `PRODUCES` / `REQUIRES` relations

**Files**: `scripts/run-stage-deriver.ts`
**Effort**: Medium — extend `CROSS_REF_ATTRIBUTES` map, add relation types

#### D-2: Handle object-valued attributes in claims

Current: `deriveClaims()` skips object-valued attributes (`typeof attrValue === "object"` → `continue`).

Many records have rich object attributes:
- `unarmed` (Crawl forms) — damage dice, type, brand
- `skill` (Crawl forms) — min/max skill levels
- `ac` / `ev` / `resists` (Crawl forms) — stat modifiers by level
- `attacks` (NetHack creatures) — damage dice per attack type

Flatten object attributes into individual claims:
- `has_unarmed_damage_dice` = "2d4"
- `has_unarmed_brand` = "fire"
- `has_ac_at_level_1` = 3

**Files**: `scripts/run-stage-deriver.ts`
**Effort**: Medium — recursive flattening with depth limit (2 levels)

#### D-3: Expand grouping attributes

Current: 18 grouping attributes. Add new ones for newly extracted kinds:
- `schools` (Crawl spells) — group by spell school
- `flags` (Crawl spells) — group by spell flags
- `parent_branch` (Crawl/NetHack branches) — group by parent
- `artifact_type` (NetHack artifacts) — group by type
- `alignment` (NetHack artifacts/roles) — already present
- `holiness` (Crawl creatures) — already present
- `trap_value` (NetHack traps) — group by trap category
- `skill_value` (NetHack skills) — group by skill category

**Files**: `scripts/run-stage-deriver.ts`
**Effort**: Small — add to `GROUPING_ATTRIBUTES` array

#### D-4: Cross-game semantic records

Current: semantic records are per-game only (`sourceId|kind|attr|value`).

Add cross-game grouping: records from different games with the same `kind + attribute + value` get a cross-game semantic record. This enables questions like "all creatures with `alignment=chaotic` across games".

**Files**: `scripts/run-stage-deriver.ts`
**Effort**: Medium — second pass after per-game semantic records, new scope (`cross_game`)

### C — Cross-game concepts

#### C-1: Generate cross-game concepts automatically

Current: 2 hand-crafted brogueCE-only concepts.

Automatically detect cross-game concepts by finding shared mechanics:
- Same kind + same attribute + same value across 2+ games
- Example: "fire resistance" exists in brogueCE (creature.conveys), NetHack (creature.resistances), Crawl (creature.resists), Cataclysm-BN (creature.flags)
- Example: "weapon enchantment" — brogueCE runic, NetHack artifact properties, Crawl weapon brands

Generate concept records with:
- `concept_type`: `cross_game_mechanic`
- `source_games`: list of games where concept appears
- `mutation_dimensions`: axes along which the concept varies
- `inclusion_criteria` / `exclusion_criteria`
- `implementation_refs`: record IDs from each game

**Files**: New script `scripts/run-stage-concepts.ts`
**Effort**: Large — new derivation pipeline, pattern matching across games

#### C-2: Design primitives and design-space relations

Current: MCP has `find_design_primitives` and `query_design_space` tools but no data.

Create design primitive records (abstract patterns like "procedural generation", "permadeath", "inventory management") and design-space relations:
- `PRIMITIVE_EXEMPLIFIES` — game record → design primitive
- `PRESSURE_FROM` — design primitive → pressure (e.g., "resource scarcity")
- `TENSION_BETWEEN` — pressure ↔ pressure
- `KNOB_FOR` — knob → tension
- `MUTATION_OF` — primitive → variant

**Files**: New script `scripts/run-stage-design.ts`, `knowledge/concept/design/`
**Effort**: Large — requires domain analysis, manual + automated

### S — Search API

#### S-1: Run materializer to generate dist/records.jsonl

Current: `.generated/knowledge/dist/` may be stale or empty.

Run the materializer to produce a flat JSONL of all records for the indexing script.

**Files**: `packages/materializer/src/`, `scripts/index-embeddings.ts`
**Effort**: Small — run existing script

#### S-2: Index embeddings to Vectorize

Current: No embeddings indexed since re-extraction.

Run `scripts/index-embeddings.ts` to push all records to the Cloudflare Vectorize index via the search-api Worker.

**Files**: `scripts/index-embeddings.ts`
**Effort**: Small — run existing script (requires Worker deployed + token)

### M — MCP server

#### M-1: Verify MCP tools work with current data

Current: 18 tools registered, but not tested against re-extracted data.

Run the MCP server locally and verify each tool returns correct results:
- `get_dataset_info` — record counts match
- `list_sources` — 4 sources
- `get_coverage` — all dimensions exhaustive
- `search_records` — returns results
- `compare_games` — cross-game comparison works

**Files**: `apps/mcp/src/`
**Effort**: Small — run + verify

#### M-2: Add new MCP tools for derived data

Add tools for newly available data:
- `get_semantic_records` — list semantic records for a source
- `find_concepts` — search/list cross-game concepts (currently `find_cross_game_concepts` exists but returns empty)
- `get_claims_by_predicate` — filter claims across records by predicate (e.g., "all has_alignment claims")

**Files**: `apps/mcp/src/tools/`, `apps/mcp/src/server.ts`
**Effort**: Medium — new tool handlers + schemas

### O — Obsidian vault

#### O-1: Rebuild Obsidian vault

Current: Vault stale since re-extraction.

Run `scripts/run-build-obsidian.ts` to rebuild the vault with all new records.

**Files**: `scripts/run-build-obsidian.ts`, `packages/builders/obsidian-builder/`
**Effort**: Small — run existing script

#### O-2: Add concept notes to Obsidian vault

Current: Obsidian builder renders definitions, evidence, and sources but not concepts.

Add concept rendering to the builder:
- One note per concept with frontmatter (concept_type, source_games, mutation_dimensions)
- Backlinks to implementation_refs
- MOC (Map of Content) note for concepts

**Files**: `packages/builders/obsidian-builder/src/build.ts`, `render-record.ts`
**Effort**: Medium — new render path for concept records

## Execution order

1. **D-3**: Expand grouping attributes (quick win, immediate value)
2. **D-2**: Handle object-valued attributes (unlocks rich claims)
3. **D-1**: Expand cross-reference relations (unlocks graph traversal)
4. **D-4**: Cross-game semantic records (enables comparison)
5. **Re-run deriver** after D-1..D-4
6. **C-1**: Auto-generate cross-game concepts (requires derived data)
7. **C-2**: Design primitives (manual + automated, can be partial)
8. **S-1**: Run materializer
9. **O-1**: Rebuild Obsidian vault
10. **O-2**: Add concept notes to Obsidian
11. **S-2**: Index embeddings (requires Worker deployed — skip if not deploying)
12. **M-1**: Verify MCP tools
13. **M-2**: Add new MCP tools

## Acceptance criteria

- [ ] Deriver produces claims from object-valued attributes
- [ ] Deriver produces cross-reference relations for ≥5 attribute types
- [ ] Deriver produces cross-game semantic records
- [ ] Cross-game concepts auto-generated (≥10 concepts covering ≥2 games each)
- [ ] Design primitives defined (≥5 primitives)
- [ ] Materializer run, dist/records.jsonl up to date
- [ ] Obsidian vault rebuilt with all records + concepts
- [ ] MCP tools verified against current data
- [ ] All conformance tests still pass (no regressions)

## Risks

- **Deriver complexity**: Object flattening may produce too many claims (100K+). Need depth limit and value filtering.
- **Cross-game concept quality**: Auto-generated concepts may be too generic. Need inclusion/exclusion criteria to filter noise.
- **Design primitives subjectivity**: Requires domain expertise. Start with obvious ones (permadeath, procedural generation, inventory).
- **Materializer compatibility**: Materializer may not handle new record types (spell, branch, etc.). Verify schema compatibility.
