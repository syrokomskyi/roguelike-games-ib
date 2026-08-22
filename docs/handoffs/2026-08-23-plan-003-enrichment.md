# Handoff: PLAN-003 Knowledge Base Enrichment

**Date**: 2026-08-23
**From**: Cascade session (extraction + re-extraction)
**To**: Next agent (enrichment work)
**Plan**: `docs/plans/plan-003-knowledge-base-enrichment.md` (status: accepted)

## What was completed this session

### Full re-extraction from clean state
- Wiped entire knowledge base (definitions, claims, relations, evidence, semantic records)
- Re-extracted all 4 games with updated extractors (including new kinds from PLAN-002)
- Re-ran deriver and coverage generation
- Rebuilt website (16,195 pages)
- Committed and pushed

### Final knowledge base state

| Game | Records | Kinds |
|---|---|---|
| brogueCE | 681 | creature, terrain, item, feature, mutation, spawn_table, status_effect, trait, ability, other_definition |
| Crawl | 7,710 | creature, species, profession, vault, spell, branch, mutation, ability |
| Cataclysm-BN | 11,157 | creature, item, mutation, profession, ability, trap, recipe, skill, effect, faction |
| NetHack | 952 | creature, item, artifact, trap, class, species, branch, skill |

**Totals**: 20,500 definitions + 20,519 evidence + 111,129 claims + 28,875 relations + 951 semantic records
**Conformance**: 60/60 tests pass
**Coverage**: all dimensions `exhaustive_for_binding`

### Documents status
- RFC-0001: implemented
- ADR-0001..0007: all implemented
- PLAN-001: implemented
- PLAN-002: closed
- PLAN-003: accepted (next agent's work)

## What the next agent should do

Follow `docs/plans/plan-003-knowledge-base-enrichment.md` in this order:

1. **D-3**: Expand grouping attributes in `scripts/run-stage-deriver.ts` — add `schools`, `parent_branch`, `artifact_type`, `trap_value`, `skill_value` to `GROUPING_ATTRIBUTES` array
2. **D-2**: Handle object-valued attributes in `deriveClaims()` — flatten nested objects to depth 2
3. **D-1**: Expand `CROSS_REF_ATTRIBUTES` map — add `equivalent_mons`, `quest_artifact`, `talisman`, `default_faction`, `result`/`tools`/`components`
4. **D-4**: Cross-game semantic records — second pass grouping across games
5. **Re-run deriver**: `pnpm exec tsx scripts/run-stage-deriver.ts`
6. **C-1**: Auto-generate cross-game concepts — new script `scripts/run-stage-concepts.ts`
7. **C-2**: Design primitives — new script `scripts/run-stage-design.ts`
8. **S-1**: Run materializer for `dist/records.jsonl`
9. **O-1**: Rebuild Obsidian vault: `pnpm exec tsx scripts/run-build-obsidian.ts`
10. **O-2**: Add concept notes to Obsidian builder
11. **S-2**: Index embeddings (requires Worker deployed)
12. **M-1**: Verify MCP tools against current data
13. **M-2**: Add new MCP tools

## Key files

| Purpose | Path |
|---|---|
| Deriver script | `scripts/run-stage-deriver.ts` |
| Coverage script | `scripts/run-stage-coverage.ts` |
| Extraction scripts | `scripts/run-stage9.ts` (brogueCE), `run-stage10.ts` (cataclysm-bn), `run-stage12-nethack.ts` (NetHack), `run-stage13-crawl.ts` (Crawl) |
| Obsidian builder | `packages/builders/obsidian-builder/src/build.ts` |
| Search API | `apps/search-api/src/index.ts` |
| MCP server | `apps/mcp/src/server.ts` |
| MCP tools | `apps/mcp/src/tools/` |
| Embeddings script | `scripts/index-embeddings.ts` |
| Materializer | `packages/materializer/src/` |
| Web app | `apps/web/` |
| Bindings | `knowledge/sources/bindings.yaml` |
| Ontology | `knowledge/ontology/game-content-taxonomy.yaml` |

## Important notes

- **No legacy**: Knowledge base was fully wiped and re-extracted. No stale data.
- **Fingerprints**: All staging scripts have correct fingerprints matching `bindings.yaml`. NetHack was fixed this session.
- **Deriver is basic**: Only flat scalar claims, 1 cross-ref type, 18 grouping attrs. D-1..D-4 will significantly enrich it.
- **Concepts are minimal**: Only 2 hand-crafted brogueCE concepts exist. C-1 will auto-generate cross-game concepts.
- **Search/MCP not deployed**: S-2 and M-1 require Cloudflare Worker deployment. S-1 (materializer) can run locally.
- **Conformance tests**: Must stay green. Run `pnpm exec vitest tests/conformance/ --run` after changes.
- **RTK**: Prefix shell commands with `rtk` to minimize token consumption.
