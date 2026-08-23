# Handoff: PLAN-003 Complete — Next Steps for Enrichment

**Date**: 2026-08-23
**Session**: PLAN-003 implementation (deriver, concepts, design, MCP, Obsidian)
**Commit**: `d2070216b9d` — feat: PLAN-003 knowledge base enrichment

## What was accomplished

All PLAN-003 tasks completed except **S-2** (index embeddings, requires deployed Worker).

### Deriver improvements (D-1 to D-4)
- **D-1**: Expanded `CROSS_REF_ATTRIBUTES` in `scripts/run-stage-deriver.ts` with 10 new cross-reference mappings (`equivalent_mons`, `quest_artifact`, `talisman`, `monster_index`, `leader_index`, `nemesis_index`, `default_faction`, `result`, `tools`, `components`). Improved target lookup with broader native_id prefix fallbacks.
- **D-2**: Added `flattenObject()` helper to flatten nested object-valued attributes to depth 2, generating individual claims for sub-attributes.
- **D-3**: Added `schools`, `parent_branch`, `artifact_type`, `trap_value`, `skill_value` to `GROUPING_ATTRIBUTES`.
- **D-4**: Added cross-game semantic records — second pass in `deriveSemanticRecords()` grouping records by `kind + attribute + value` across all games, creating `cross_game` scope semantic records and `PART_OF` relations.

### Ontology fix
- Added `EQUIVALENT_TO`, `USES_ITEM`, `BELONGS_TO`, `RELATED_TO` relation types to `knowledge/ontology/relation-types.yaml`.

### Cross-game concepts (C-1)
- New script `scripts/run-stage-concepts.ts`: auto-generates cross-game concepts via exact attribute matching and semantic equivalence mappings.
- 24 concepts generated (23 exact-match + 1 semantic-equivalence for fire resistance).

### Design primitives (C-2)
- New script `scripts/run-stage-design.ts`: 7 design primitives (permadeath, procedural generation, inventory management, turn-based combat, identification system, hunger clock, stealth and awareness) + 18 design pressure concepts.
- 25 design-space relations (`CREATES_PRESSURE`, `tensions_with`) with evidence refs.

### Materializer (S-1)
- 21,584 records materialized to `.generated/knowledge/dist/records.jsonl`.
- Canonical hash: `ba5d8168ca919cf402f2b2e5cb64e529a9a479b9e80046c0267836d0ff37b85e`

### Obsidian vault (O-1, O-2)
- Vault rebuilt: 21,586 notes including 51 concept notes.
- Enhanced `packages/builders/obsidian-builder/src/render-record.ts` with concept-specific rendering (definition, inclusion/exclusion criteria, implementation refs as wiki links, ancestry).
- Added `renderConceptsMoc()` in `moc.ts` — dedicated Concepts MOC grouped by `concept_type`.
- Updated `build.ts` to write concepts MOC file.

### MCP tools (M-1, M-2)
- Fixed `findDesignPrimitives` to filter by `concept_type === "design_primitive"` (was filtering by non-existent `record_type`).
- Fixed `findCrossGameConcepts` to support `concept_type` filter parameter.
- Fixed `queryDesignSpace` to match `cross_game` scope and design relation types.
- Fixed `findMechanics`/`findSystems` to search `semantic_record` with `semantic_type` field (was filtering by non-existent `record_type` values).
- New tool `find_semantic_records` in `apps/mcp/src/tools/derived.ts` — list/search semantic records with filters.
- New tool `get_derived_summary` — aggregate counts of all derived data.
- Updated `REQUIRED_TOOLS` list (now 20 tools).

## Current knowledge base state

| Component | Count |
|---|---|
| Definitions | 20,500 |
| Claims | 112,772 |
| Relations | 35,407 |
| Semantic records | 1,033 |
| Concepts | 51 |
| Evidence | 20,520 |
| Sources | 4 (broguece, cataclysm-bn, crawl, nethack) |

### Concept breakdown
- 24 cross-game mechanic concepts (auto-generated, `run-stage-concepts.ts`)
- 7 design primitive concepts (hand-crafted, `run-stage-design.ts`)
- 18 design pressure concepts (hand-crafted, `run-stage-design.ts`)
- 2 pre-existing concepts from semantic layer scripts

### Test status
- All 590 tests pass across 87 test files.
- All 60 conformance tests pass.
- TypeScript compiles cleanly.

## What remains

### S-2: Index embeddings (low priority, requires deployment)
- Requires Cloudflare Worker to be deployed.
- Script exists: `scripts/index-embeddings.ts`.
- Needs `dist/records.jsonl` (already materialized).
- Worker config in `apps/search-api/`.

### Potential next steps beyond PLAN-003
1. **Deploy search API + MCP server** — both are ready but not deployed.
2. **Expand semantic equivalence mappings** — only fire resistance has mappings; cold, poison, electricity mappings are defined but didn't match enough data. Investigate attribute value formats in each game.
3. **Add more design primitives** — the 7 primitives cover core roguelike mechanics; could add more (e.g., shop system, pet system, religion/god system, level progression).
4. **Improve cross-game concept quality** — current exact-match concepts may be noisy. Consider adding minimum member thresholds or filtering by meaningful attribute values.
5. **Obsidian vault review** — open the vault in Obsidian and verify concept notes render correctly with wiki links.
6. **Web app rebuild** — `apps/web/` has 16,195 pages but hasn't been rebuilt since enrichment. Run `scripts/run-build-web.ts` if needed.

## Key files modified this session

| File | Change |
|---|---|
| `scripts/run-stage-deriver.ts` | D-1 to D-4: expanded cross-refs, flattenObject, grouping attrs, cross-game semantic records |
| `scripts/run-stage-concepts.ts` | New: auto-generates cross-game concepts |
| `scripts/run-stage-design.ts` | New: design primitives and design-space relations |
| `knowledge/ontology/relation-types.yaml` | Added 4 new relation types |
| `packages/builders/obsidian-builder/src/render-record.ts` | O-2: concept-specific rendering |
| `packages/builders/obsidian-builder/src/moc.ts` | O-2: concepts MOC |
| `packages/builders/obsidian-builder/src/build.ts` | O-2: write concepts MOC |
| `apps/mcp/src/tools/design.ts` | M-1: fix data model mismatches |
| `apps/mcp/src/tools/mechanics.ts` | M-1: fix data model mismatches |
| `apps/mcp/src/tools/derived.ts` | New: find_semantic_records + get_derived_summary |
| `apps/mcp/src/server.ts` | M-1/M-2: fix schemas, register new tools |

## How to re-run the pipeline

```bash
# 1. Re-run deriver (claims, relations, semantic records)
pnpm exec tsx scripts/run-stage-deriver.ts

# 2. Re-run concept generation
pnpm exec tsx scripts/run-stage-concepts.ts

# 3. Re-run design primitives
pnpm exec tsx scripts/run-stage-design.ts

# 4. Materialize to dist/
pnpm exec tsx scripts/run-materialize.ts

# 5. Rebuild Obsidian vault
pnpm exec tsx scripts/run-build-obsidian.ts

# 6. Run conformance tests
pnpm exec vitest tests/conformance/ --run

# 7. Run full test suite
pnpm exec vitest --run
```

## Acceptance criteria status

- [x] Deriver produces claims from object-valued attributes
- [x] Deriver produces cross-reference relations for ≥5 attribute types (10 added)
- [x] Deriver produces cross-game semantic records
- [x] Cross-game concepts auto-generated (≥10 concepts covering ≥2 games each) — 24 concepts
- [x] Design primitives defined (≥5 primitives) — 7 primitives
- [x] Materializer run, dist/records.jsonl up to date
- [x] Obsidian vault rebuilt with all records + concepts
- [x] MCP tools verified against current data
- [x] All conformance tests still pass (no regressions)
