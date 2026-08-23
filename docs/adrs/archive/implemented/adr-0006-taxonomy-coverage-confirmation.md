---
id: ADR-0006
title: Taxonomy coverage confirmation for planned extraction work
status: implemented
scope: project-wide
decider: architecture
reviewers:
  - human:andrii-syrokomskyi
related:
  - RFC-0001
created: 2026-08-22
accepted: 2026-08-22
implementedAt: 2026-08-22
closedAt: null
---

# ADR-0006: Taxonomy coverage confirmation for planned extraction work

## Context

RFC-0001 Principle 9 requires that extractors map game-local data types to existing canonical kinds from `knowledge/ontology/game-content-taxonomy.yaml` before proposing taxonomy extensions. A survey of all four game sources identified the following unextracted data types. This ADR documents that the existing taxonomy covers all of them — no taxonomy extensions are needed.

## Decision

Confirm that the existing `game-content-taxonomy.yaml` covers all identified unextracted data types across the four game sources. No new canonical kinds are required for the planned extraction work.

**Note**: `profession` was already used by existing extractors (crawl, cataclysm-bn) but was missing from the taxonomy. RFC-0001 addresses this gap directly by adding `profession` to the `abilities_character` category. This is not a taxonomy extension for new data types — it is a fix for existing technical debt.

## Coverage analysis

### Crawl — unextracted data types

| Data type | Source location | Canonical kind | Taxonomy category | Covered? |
|---|---|---|---|---|
| Vaults / level parts | `dat/des/**/*.des` (144 files) | `vault` | world | Yes |
| Forms / transformations | `dat/forms/*.yaml` (28 files) | `mutation` | abilities_character | Yes |
| Spells | `source/spl-data.h` (C struct array) | `spell` | abilities_character | Yes |
| Abilities | `source/ability.h` (C enum) | `ability` | abilities_character | Yes |
| Branches | `source/branch-data.h` (C struct array) | `branch` | world | Yes |
| Descriptions | `dat/descript/*.txt` | `lore_entry` | narrative_naming | Yes |
| Name tables | `dat/database/*.txt` | `name_table` | narrative_naming | Yes |

### BrogueCE — unextracted data types

BrogueCE is nearly exhausted. The extractor already covers 10 kinds. No additional data types identified.

### Cataclysm-BN — unextracted data types

| Data type | Source location | Canonical kind | Taxonomy category | Covered? |
|---|---|---|---|---|
| Bionics | `data/json/bionics.json` | `ability` | abilities_character | Yes |
| Traps | `data/json/traps.json` | `trap` | world | Yes |
| Skills | `data/json/skills.json` | `skill` | abilities_character | Yes |
| Effects | `data/json/effects.json` | `effect` | simulation | Yes |
| Monster factions | `data/json/monster_factions.json` | `faction` | society | Yes |
| Recipes | `data/json/recipes/**/*.json` | `recipe` | economy | Yes |
| Construction | `data/json/construction/**/*.json` | `recipe` | economy | Yes |
| Mapgen templates | `data/json/mapgen/**/*.json` | `map_template` | world | Yes |
| Scenarios | `data/json/scenarios.json` | `background` | abilities_character | Yes |
| Monster groups | `data/json/monstergroups/**/*.json` | `spawn_table` | economy | Yes |
| Monster drops | `data/json/monsterdrops/**/*.json` | `loot_table` | economy | Yes |
| NPCs | `data/json/npcs/**/*.json` | `npc` | actors | Yes |
| Materials | `data/json/materials.json` | `material` | economy | Yes |
| Martial arts | `data/json/martialarts.json` | `ability` | abilities_character | Yes |
| Anatomy | `data/json/anatomy.json` | `tag_definition` | simulation | Yes |
| Enchantments | `data/json/enchantments.json` | `effect` | simulation | Yes |
| Vehicles | `data/json/vehicles/**/*.json` | `item` | objects | Yes (composite) |
| Vehicle parts | `data/json/vehicleparts/**/*.json` | `item` | objects | Yes |

### NetHack — unextracted data types

| Data type | Source location | Canonical kind | Taxonomy category | Covered? |
|---|---|---|---|---|
| Artifacts | `include/artilist.h` (C macros) | `artifact` | objects | Yes |
| Traps | `include/trap.h` (C enum) | `trap` | world | Yes |
| Level definitions | `dat/*.lua` (131 files) | `map_template` | world | Yes |
| Roles | `include/you.h` (struct Role) | `class` | abilities_character | Yes |
| Races | `include/you.h` (struct Race) | `species` | abilities_character | Yes |
| Dungeon branches | `include/dungeon.h` (C struct) | `branch` | world | Yes |
| Attack types | `include/monattk.h` (C defines) | `damage_type` | simulation | Yes |
| Skills | `include/skills.h` (C enum) | `skill` | abilities_character | Yes |

## Edge cases

### Cataclysm-BN vehicles → `item`

Vehicles and vehicle parts are technically composite objects, not simple items. They map to `item` because the taxonomy's `objects` category includes `container` and `tool` — vehicles are containers with properties. The `native_kind` (`vehicle`, `vehicle_part`) differentiates them from regular items.

### Cataclysm-BN anatomy → `tag_definition`

Anatomy definitions define body part structure and damage modifiers. They are not creatures, items, or world features — they are simulation tags that modify how damage affects creatures. `tag_definition` in the `simulation` category is the closest match.

### Crawl forms → `mutation`

Crawl forms (bat, dragon, spider, etc.) are temporary transformations that modify the player's stats and abilities. They are mechanically similar to mutations — both modify character properties. The `mutation` kind in `abilities_character` covers this. `native_kind: FORM` differentiates from permanent mutations.

### NetHack roles → `class` vs `profession`

NetHack roles (Barbarian, Caveman, Knight, etc.) are character classes, not professions. The taxonomy has both `class` and `background` in `abilities_character`. `class` is the better fit because NetHack roles define starting equipment, stats, and quest lines — they are gameplay classes, not narrative backgrounds.

## Justification

- All 30+ identified data types map to existing canonical kinds without forcing a fit
- The `native_kind` field provides differentiation when multiple game-local types map to the same canonical kind
- No taxonomy bloat — the existing 50+ kinds across 9 categories are sufficient
- This confirms RFC-0001 Principle 9's assertion that no taxonomy extensions are needed

## Consequences

**Positive:**
- No RFC needed for taxonomy changes — extraction can proceed immediately
- Cross-game queries work naturally (e.g., "all traps across all games" queries `kind: trap`)
- The taxonomy remains stable, avoiding migration costs

**Negative:**
- Some mappings are approximate (vehicles → item, anatomy → tag_definition). The `native_kind` field mitigates this, but downstream consumers must be aware of the nuance.

## Evolution

- If a future game source introduces a data type that genuinely does not fit any existing kind, RFC-0001 Principle 9 governs the taxonomy extension process
- If edge case mappings prove problematic for downstream analysis, a new ADR can refine the mapping without changing the taxonomy
