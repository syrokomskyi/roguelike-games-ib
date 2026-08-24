---
id: RFC-0017
title: "Additional extractors — complete PLAN-002 NetHack and Cataclysm-BN data types"
status: rejected
kind: policy
scope: workspace
owners:
  - architecture
reviewers:
  - human:andrii-syrokomskyi
createdAt: 2026-08-24
updatedAt: 2026-08-24
enhancedAt: 2026-08-24
closedAt: 2026-08-24
supersedes: []
supersededBy:
amends: []
amendedBy:
related:
  - RFC-0001
  - RFC-0006
  - RFC-0008
  - PLAN-002
satisfies: []
versionBump: minor
commands:
  proposed: []
  added: []
  changed: []
  removed: []
appsImpacted: []
packagesImpacted:
  - extractors/nethack-extractor
  - extractors/cataclysm-bn-extractor
successSignals:
  - NetHack extractor produces artifacts, traps, roles, races, dungeon branches, and skills
  - Cataclysm-BN extractor produces bionics, traps, recipes, skills, effects, and factions
  - All new records pass schema validation and have evidence anchors
  - Coverage files updated for all new data types
  - Population completeness contracts declared for all new dimensions
nonGoals:
  - Does not add new games — only extends existing extractors
  - Does not change extraction methodology — follows RFC-0001
  - Does not modify the extractor SDK
---

# RFC-0017: Additional extractors — complete PLAN-002 NetHack and Cataclysm-BN data types

> **Rejected.** Semantic audit (AUDIT-RFC-0017-01) found that all 12 proposed data types are already fully extracted and passing conformance tests. RFC-0006 (status: implemented) completed this work. The RFC's problem statement is factually incorrect — NetHack has 10 record kinds (not 4) and Cataclysm-BN has 12 record kinds (not 4). No new work is needed.

## Context

PLAN-002 defined 18 extraction tasks. 6 Crawl tasks are complete. 12 tasks remain: 6 for NetHack and 6 for Cataclysm-BN. Completing these will significantly enrich the knowledge base, improving concept coverage, pattern detection, and cross-game comparison quality.

## Problem

1. **NetHack has only 4 data types extracted** (monsters, items, objects, features) — missing artifacts, traps, roles, races, dungeon branches, and skills
2. **Cataclysm-BN has limited data types** — missing bionics, traps, recipes, skills, effects, and factions
3. **Concept coverage is incomplete** — design primitives like `skill_progression` and `crafting_system` have implementation refs from only 2-3 games instead of all 4
4. **Pattern detection is weakened** — patterns like "Build Diversity" show Cataclysm-BN as present but lack recipe/skill data to support the claim

## Decision

### D1: NetHack tasks (6 data types)

| Task | Source file | Parser | Est. records |
|---|---|---|---|
| N-1: artifacts | `include/artilist.h` | C macro array `A()` | ~36 |
| N-2: traps | `include/trap.h` | C enum | ~20 |
| N-3: roles | `include/you.h` + `src/role.c` | C struct | ~13 |
| N-4: races | `include/you.h` + `src/role.c` | C struct | ~5 |
| N-5: dungeon branches | `include/dungeon.h` + `dat/dungeon.dat` | C struct + dat | ~10 |
| N-6: skills | `include/skills.h` | C enum `P_*` | ~12 |

All use the existing `C-struct-parser.ts` and supplemental paths (RFC-0008) for header files outside `dat/`.

### D2: Cataclysm-BN tasks (6 data types)

| Task | Source files | Parser | Est. records |
|---|---|---|---|
| CB-1: bionics | `data/json/bionics/*.json` | JSON array | ~100+ |
| CB-2: traps | `data/json/traps.json` | JSON array | ~30+ |
| CB-3: recipes | `data/json/recipes/*.json` | JSON array | ~500+ |
| CB-4: skills | `data/json/skills/*.json` | JSON array | ~20+ |
| CB-5: effects | `data/json/effects/*.json` | JSON array | ~50+ |
| CB-6: factions | `data/json/factions/*.json` | JSON array | ~30+ |

All use the existing JSON extractor pattern from `cataclysm-bn-extractor`.

### D3: Population completeness contracts

Each new data type gets a population contract in the extractor manifest declaring:
- Expected record count (from source analysis)
- Source files and globs
- Kind mapping (RFC-0001 Principle 3)

### D4: Coverage update

Update `knowledge/coverage/cataclysm-bn.jsonl` and `knowledge/coverage/nethack.jsonl` with new dimensions after extraction.

### D5: Evidence anchors

All new records must have evidence anchors per RFC-0001 Principle 4. NetHack header files use supplemental paths (RFC-0008). Cataclysm-BN JSON files are in the payload root.

## Architectural fit

- **Follows RFC-0001**: One source object = one record, factual extraction, evidence anchors
- **Extends existing extractors**: No new packages — `nethack-extractor` and `cataclysm-bn-extractor` already exist
- **Uses supplemental paths**: NetHack C headers outside `dat/` use `supplemental_paths` in `bindings.yaml`
- **CI gates apply**: All new records must pass schema validation and conformance tests

## Rollout

1. **NetHack** (N-1 through N-6):
   - Add artifact parser to `nethack-extractor` using `C-struct-parser.ts`
   - Add trap parser (C enum)
   - Add role/race parser (C struct from `you.h` + `role.c`)
   - Add dungeon branch parser (C struct + dat file)
   - Add skill parser (C enum `P_*`)
   - Update `bindings.yaml` with supplemental paths for new header files
   - Update coverage file

2. **Cataclysm-BN** (CB-1 through CB-6):
   - Add bionics extractor (JSON)
   - Add traps extractor (JSON)
   - Add recipes extractor (JSON)
   - Add skills extractor (JSON)
   - Add effects extractor (JSON)
   - Add factions extractor (JSON)
   - Update coverage file

3. **Verification**:
   - Run extractors and verify record counts match population contracts
   - Run `pnpm materialize` and verify no schema errors
   - Run `pnpm exec vitest --run` and verify all conformance tests pass
   - Re-run design stage to update concept implementation_refs

## Alternatives

- **Skip recipes (CB-3)** — 500+ records is a large batch. However, recipes are essential for the `crafting_system` design primitive. Include them.
- **Use LLM for parsing** — unnecessary; C headers and JSON files have deterministic structure.
- **Create separate RFC per data type** — over-engineered; all 12 tasks follow the same methodology.

## Acceptance criteria

- [x] NetHack extractor produces artifacts, traps, roles, races, dungeon branches, and skills — **already done** (RFC-0006, 33+25+13+5+9+37 records)
- [x] Cataclysm-BN extractor produces bionics, traps, recipes, skills, effects, and factions — **already done** (RFC-0006, 137+50+3187+28+237+71 records)
- [x] All new records have evidence anchors — **already done** (all records use `runEntityPipeline` which creates evidence automatically)
- [x] Coverage files updated for both games — **already done** (`coverage/nethack.jsonl`, `coverage/cataclysm-bn.jsonl` show all dimensions `exhaustive_for_binding`)
- [x] `pnpm materialize` succeeds without errors — **already done** (RFC-0006 acceptance criteria confirmed)
- [x] All conformance tests pass — **already done** (RFC-0006 acceptance criteria confirmed, 671 tests passed)
- [x] Concept implementation_refs updated after re-running design stage — **already done** (RFC-0006 acceptance criteria confirmed)
