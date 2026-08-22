---
id: RFC-0001
title: "Extraction methodology for multi-game knowledge base"
status: draft
# kind options: architecture | contract | command | policy | deprecation
kind: policy
# scope options: app | workspace
scope: workspace
owners:
  - architecture
# Set by the deciding human together with the status change (RFC-0335).
# Draft scaffolds must keep this empty; do not prefill a default identity.
# Format: human:<handle> (agent:<id> reserved — see RFC-0335).
# Default reviewer when none is specified by the operator: human:andrii-syrokomskyi
reviewers: []
createdAt: 2026-08-22
updatedAt: 2026-08-22
enhancedAt: 2026-08-22
implementedAt:
closedAt:
supersedes: []
supersededBy:
amends: []
amendedBy: []
related:
  - ADR-0003
  - ADR-0004
# RFC-0331: DNA invariants this RFC implements, protects, or extends.
# Required for architecture/contract RFCs created on or after 2026-07-07.
# Entries must match ^DNA-\d+$ and exist in docs/architecture-dna.md.
satisfies: []
# RFC-0396: Traceability to a vendored spec node: "<spec-id>/<node-id>", e.g. "pbp/RFC-PBP-020".
# Set by spec.materialize; leave commented for non-spec RFCs.
# specRef:
# RFC-0478: Platform versioning enforcement. Declares the SemVer delta this RFC
# produces when implemented. Required for post-cutoff implemented RFCs (V-29).
# Values: minor (Breaks-B, requires migrator), patch (safe), none (prose-only),
# major (architectural, manually reserved). Default: patch.
versionBump: patch
# RFC-0711: Declares that this RFC contributes to a living feature spec
# under docs/specs/live/<domain>.md. When true, domain is auto-derived from
# packagesImpacted[0]. When a string, used as explicit domain override.
# Absent or false means no living spec merge occurs.
# liveSpec: true
commands:
  proposed: []
  added: []
  changed: []
  removed: []
appsImpacted: []
# List only packages actually impacted. Leave empty if unknown.
packagesImpacted:
  - extractor-sdk
  - extractors/broguece-extractor
  - extractors/cataclysm-bn-extractor
  - extractors/crawl-extractor
  - extractors/nethack-extractor
successSignals:
  - New extractors follow the documented methodology without ad-hoc decisions
  - All game data types map to existing canonical kinds without taxonomy extensions
  - Population contracts catch source version drift automatically
  - Cross-game analysis layer operates on consistent record shapes
nonGoals:
  - Does not define cross-game concept mapping or semantic record generation — that is a separate concern handled by the concept/relation layer
  - Does not define extractor quality test contours — covered by ADR-0003
  - Does not define duplicate native_id handling — covered by ADR-0004
  - Does not modify the extractor SDK TypeScript interfaces — the SDK already supports the methodology
  - Does not define projection or search indexing — downstream concerns
  - Does not address attribute name changes across source versions — this is a deriver/concept layer concern, not an extraction methodology issue
  - Does not retroactively taxonomy-align existing brogueCE recordKinds (image_asset, dungeon_feature, light, monster_class, monster_behavior, monster_ability) — these are existing technical debt requiring a separate taxonomy cleanup effort
# RFC-0268: OPTIONAL machine-checkable acceptance probes, executed on-demand
# via `pnpm exec werkstatt run rfc.acceptance.run --id <this-rfc-id>` (never
# automatically inside build pipelines). Closed probe vocabulary — see
# docs/rfcs/rfc-0268-make-rfc-acceptance-criteria-machine-checkable.md.
# acceptance:
#   - probe: run
#     command: "site-kernel run some.command.validate --app warpgogol-com"
#     expect:
#       exitCode: 0
#   - probe: file-exists
#     path: "packages/share/src/some-new-module.ts"
#   - probe: command-registered
#     name: "some.new.command"
#   - probe: file-contains
#     path: "AGENTS.md"
#     pattern: "Some new governance paragraph"
---

# RFC-0001: Extraction methodology for multi-game knowledge base

## Context

The project has four game-specific extractors (broguece, cataclysm-bn, crawl, nethack) under `packages/extractors/`. Each was written incrementally, adding entity kinds as needed. The extractors share a common SDK (`@roguelike-games-ib/extractor-sdk`) with an `EntitySpec`/`EntityAdapter` pipeline, but the methodology for deciding **what to extract**, **how to map game-local data types to canonical kinds**, and **how to ensure completeness** is undocumented.

### Current extraction state

| Game | Definition records | Kinds extracted | Derived claims | Derived relations | Derived semantic records |
|---|---|---|---|---|---|
| broguece | 748 | terrain, dungeon_feature, item, creature, light, monster_behavior, status_effect, monster_ability, mutation, monster_class | ~6,000 | ~3,000 | ~200 |
| cataclysm-bn | 7,447 | item (5,886), mutation (625), creature (597), profession (339) | ~36,600 | ~17,260 | ~1,500 |
| crawl | 754 | creature (680), species (48), profession (26) | ~10,000 | ~2,000 | ~150 |
| nethack | 830 | item (454), creature (376) | ~8,000 | ~1,500 | ~120 |

After extraction, the **Attribute Deriver** (`scripts/run-stage-deriver.ts`) automatically derives:
- **Claims** — one per attribute per record (e.g., `has_hp: 80`, `has_material: iron`), skipping display metadata (`symbol`, `color`, `glyph`, `sprite_path`, `description`, etc.)
- **Relations** — `PART_OF` for grouping attributes (`species`, `default_faction`, `categories`, `material`, `flags`, `resistances`, `alignment`, `holiness`, `size`, `shape`, `blood_type`, `ability_flags`, etc.); `TRANSFORMS_INTO` for cross-reference attributes (`leads_to` in Cataclysm-BN mutations)
- **Semantic records** — groups of definitions sharing a common attribute value (e.g., "all creatures with `flags=acidproof"), with `PART_OF` relations from each member to the group

This means **more records with more attributes = exponentially more derived data**. Cataclysm-BN dominates derived data (36,603 claims, 17,264 relations) because it has the most records (7,447) with the most attributes per record (items have `color`, `flags`, `symbol`, `volume`, `weight`, `material`, `price`). Extracting more data types from all games will significantly increase the derived knowledge base.

### Unextracted data survey

A survey of the four game sources revealed significant unextracted data:

| Game | Extracted kinds | Available but unextracted |
|---|---|---|
| Crawl | creature, species, profession | vaults (144 .des files), forms (28 YAML), spells (`spl-data.h` C struct array), abilities (`ability.h`), branches (`branch-data.h`), descriptions (`descript/*.txt`), name tables (`database/*.txt`) |
| BrogueCE | creature, terrain, item, dungeon_feature, light, mutation, monster_class, status_effect, monster_behavior, monster_ability, image_asset | nearly exhausted |
| Cataclysm-BN | creature, item, mutation, profession | bionics, traps, skills, effects, factions, recipes, mapgen, scenarios, monster groups, monster drops, construction, NPCs, materials, vehicles, martial arts, anatomy, enchantments |
| NetHack | creature, item | artifacts (`artilist.h`), traps (`trap.h`), levels (131 .lua files), roles (`you.h` struct `Role`), races (`you.h` struct `Race`), dungeon branches (`dungeon.h`), attack types (`monattk.h`), skills (`skills.h`) |

The existing `game-content-taxonomy.yaml` already contains canonical kinds for most of these data types (vault, map_template, trap, recipe, faction, skill, effect, artifact, etc.), but there is no documented process for:
1. Surveying a game source to identify all extractable data types
2. Mapping game-local types to canonical kinds
3. Deciding when a new canonical kind is needed vs. using an existing one
4. Declaring population contracts for new data dimensions
5. Onboarding a new game source end-to-end

ADR-0003 codified the extractor creation workflow and quality test contour. ADR-0004 resolved duplicate native_id handling. Neither addresses the methodology for data-type-to-kind mapping or the onboarding process for new games.

## Problem

Without a documented extraction methodology:

1. **Inconsistent kind mapping** — different agents may map the same game-local data type to different canonical kinds (e.g., Crawl forms could be `mutation` or `ability` or `trait`). This creates downstream inconsistency in the knowledge base.

2. **No completeness guarantee** — there is no documented requirement that extractors declare population contracts for every data dimension they touch. An extractor could silently omit entire data categories.

3. **No onboarding process** — when a new game is added to `knowledge/sources/registry.yaml`, there is no checklist or process that ensures the source is surveyed, data types are mapped, populations are counted, and a conformance test is written.

4. **Ad-hoc taxonomy extensions** — agents may propose new canonical kinds without checking whether existing kinds already cover the data type, leading to taxonomy bloat.

5. **Ambiguous granularity** — for composite data (e.g., a vault file containing multiple named maps, or a JSON file with hundreds of entries), there is no documented rule for what constitutes a single record.

6. **Extractor–deriver coupling** — the Attribute Deriver automatically generates claims, relations, and semantic records from definition attributes. Extractors that omit attributes or normalize them break the derivation pipeline. There is no documented contract between extraction and derivation.

7. **Uneven coverage** — Cataclysm-BN dominates the knowledge base with 7,447 records and ~36,600 derived claims, while Crawl (754 records) and NetHack (830 records) contribute far less. This imbalance is not due to game complexity but to incomplete extraction — Crawl and NetHack have significant unextracted data (spells, abilities, branches, artifacts, roles, races, dungeon branches) that would substantially increase their contribution.

## Decision

This RFC establishes a formal extraction methodology consisting of eleven principles that govern how all extractors map game source data into the knowledge base. The methodology is binding for all existing and future extractors and serves as the reference for agent-created extractors (per ADR-0003).

## Architectural fit

- **ADR-0003** (extractor creation skill) — this RFC provides the methodology that the skill teaches. The skill guides agents through the workflow; this RFC defines the rules the workflow follows.
- **ADR-0004** (duplicate native_id namespacing) — this RFC references ADR-0004 as the specific resolution for a common extraction issue within the methodology.
- game-content-taxonomy.yaml — this RFC confirms the existing taxonomy as the canonical kind vocabulary and defines the process for mapping game-local types to it. One taxonomy addition is proposed: `profession` must be added to the `abilities_character` category (see Principle 9).
- **extractor-sdk EntitySpec/EntityAdapter** — the SDK already supports the methodology. `EntitySpec.kind` maps to canonical kinds, `EntityAdapter.nativeKind` carries the game-local type name, and `EntityAdapter.getAttributes` preserves game-local attributes without normalization.
- **record-envelope.schema.yaml** — all extracted records are `definition` type with `kind` from the taxonomy. This RFC does not change the schema.
- **evidence.schema.yaml** — every record has an evidence anchor. This RFC formalizes that as a principle.
- **Population contracts** (`extractor-sdk/src/population.ts`) — the SDK already supports population contracts. This RFC makes them mandatory for all extractors.
- **Attribute Deriver** (`scripts/run-stage-deriver.ts`) — the derivation layer automatically generates claims, relations, and semantic records from definition attributes. This RFC formalizes the contract between extraction and derivation: extractors must preserve native attributes faithfully (Principle 2) so the deriver can generate consistent derived data.

## Design

### Principle 1: One source object = one record

Each logical object in the game source data becomes exactly one knowledge base record.

- One YAML monster file → one `creature` record
- One `NAME:` block in a `.des` vault file → one `vault` record (a single `.des` file may contain multiple `NAME:` blocks, each producing a separate record)
- One JSON object in `bionics.json` → one `ability` record
- One Lua level file → one `map_template` record

**Granularity rule**: the natural unit of definition in the source data is the record boundary. If the source defines it as a discrete, named entity with its own properties, it is one record.

**Exception**: if a single source file contains multiple independent definitions (e.g., Crawl `.des` files with multiple `NAME:` blocks, or Cataclysm-BN JSON arrays with multiple objects), each definition is a separate record with its own evidence anchor pointing to the same source file at different line ranges.

### Principle 2: Factual extraction without loss

Attributes are preserved as-is from the source data — no cross-game normalization during extraction.

- Crawl creature attributes (`hd`, `hp_10x`, `ev`, `ac`) remain in their native form
- Cataclysm-BN monster attributes (`melee_dice`, `melee_dice_sides`, `dodge`) remain in their native form
- NetHack monster attributes (`armor_class`, `magic_resistance`, `geno_flags`) remain in their native form

Cross-game mapping happens **later** in the `concept` and `relation` layers, not during extraction. This preserves factual fidelity and allows cross-game analysis as a separate concern.

**Consequence**: `attributes` is a free-form object (`additionalProperties: true` in the schema). Each extractor populates it with the native fields from the source data. No two games need to share attribute names.

### Principle 3: Canonical kind mapping declared in manifest

Each extractor declares its `recordKinds` in its `ExtractorManifest`. The mapping from game-local data type to canonical kind must be:

- **Explicit** — documented in the manifest's `recordKinds` array and in the extractor's `MODULE_CONTRACT` comment
- **Stable** — once records are published, the kind mapping cannot change without a migration
- **Hierarchical** — if a game-local type does not match a canonical kind exactly, use the nearest canonical kind and differentiate via `native_kind`

**Mapping table** (for currently identified data types):

| Game-local type | Canonical kind | Taxonomy category | native_kind example |
|---|---|---|---|
| Crawl monster YAML | `creature` | actors | `MONSTER` |
| Crawl species YAML | `species` | abilities_character | `SPECIES` |
| Crawl job YAML | `profession` | abilities_character | `JOB` |
| Crawl .des vault | `vault` | world | `DES_VAULT` |
| Crawl form YAML | `mutation` | abilities_character | `FORM` |
| Crawl description txt | `lore_entry` | narrative_naming | `DESCRIPTION` |
| Crawl spell (spl-data.h) | `spell` | abilities_character | `SPELL` |
| Crawl ability (ability.h) | `ability` | abilities_character | `ABILITY` |
| Crawl branch (branch-data.h) | `branch` | world | `BRANCH` |
| Crawl name table (database/*.txt) | `name_table` | narrative_naming | `NAME_TABLE` |
| BrogueCE monster catalog | `creature` | actors | `monster` |
| BrogueCE tile catalog | `terrain` | world | `tileType` |
| BrogueCE item table | `item` | objects | `weapon`/`armor`/etc. |
| Cataclysm-BN monster JSON | `creature` | actors | `MONSTER` |
| Cataclysm-BN item JSON | `item` | objects | per `type` field |
| Cataclysm-BN mutation JSON | `mutation` | abilities_character | per `type` field |
| Cataclysm-BN profession JSON | `profession` | abilities_character | per `type` field |
| Cataclysm-BN bionic JSON | `ability` | abilities_character | `bionic` |
| Cataclysm-BN trap JSON | `trap` | world | `trap` |
| Cataclysm-BN recipe JSON | `recipe` | economy | `recipe` |
| Cataclysm-BN skill JSON | `skill` | abilities_character | `skill` |
| Cataclysm-BN effect JSON | `effect` | simulation | `effect_type` |
| Cataclysm-BN faction JSON | `faction` | society | `MONSTER_FACTION` |
| Cataclysm-BN scenario JSON | `background` | abilities_character | `scenario` |
| Cataclysm-BN mapgen JSON | `map_template` | world | `mapgen` |
| Cataclysm-BN monster group JSON | `spawn_table` | economy | `monstergroup` |
| Cataclysm-BN monster drop JSON | `loot_table` | economy | `monsterdrop` |
| Cataclysm-BN construction JSON | `recipe` | economy | `construction` |
| Cataclysm-BN NPC JSON | `npc` | actors | `npc_class` |
| Cataclysm-BN material JSON | `material` | economy | `material` |
| NetHack monster header | `creature` | actors | `mon` |
| NetHack object header | `item` | objects | per obj class |
| NetHack artifact header | `artifact` | objects | `artifact` |
| NetHack trap header | `trap` | world | `trap` |
| NetHack level Lua | `map_template` | world | `level_def` |
| NetHack attack type header | `damage_type` | simulation | `attack_type` |
| NetHack role (you.h struct Role) | `class` | abilities_character | `ROLE` |
| NetHack race (you.h struct Race) | `species` | abilities_character | `RACE` |
| NetHack dungeon branch (dungeon.h) | `branch` | world | `DUNGEON_BRANCH` |
| NetHack skill (skills.h) | `skill` | abilities_character | `SKILL` |

### Principle 4: Evidence anchors for every record

Every record must have at least one evidence anchor pointing to its source location:

- `artifact.path` — relative path within the source payload
- `locator.line_start` / `locator.line_end` — line range in the source file
- `locator.symbol` — symbol/table/section name in the source
- `locator.data_key` — key for lookup within data structures

The `EvidenceFactory` in the SDK creates these anchors. The `runEntityPipeline` function automatically creates evidence for each entity. Extractors using the pipeline get this for free.

### Principle 5: Population completeness contracts

Every data dimension an extractor touches must have a population contract in the manifest's `exhaustivePopulations` array:

```yaml
exhaustivePopulations:
  - dimension: vaults
    denominatorKind: extractor_population
    expected: 350
    description: All NAME: blocks across all .des files in dat/des/
```

- `expected` — total count of entities in the source (counted manually or by tooling)
- `extracted` — count of records successfully parsed and emitted
- Mismatches signal parser bugs or source version drift

**Mandatory**: an extractor without population contracts for all its dimensions is incomplete. The quality test contour (ADR-0003) checks `extracted == expected` for every dimension.

### Principle 6: Composite data stays in attributes

For nested or composite data (e.g., a vault with embedded monster spawn rules, or a recipe with ingredient lists):

- The vault is one record. Spawn rules are captured in `attributes` (e.g., `monster_spawns`, `item_placements`)
- We do **not** create separate `spawn_table` records for each spawn inside a vault
- Relations (e.g., `SPAWNS`, `INHABITS`) are established in a later relation-extraction phase, not during factual extraction

**Rationale**: extracting sub-entities as separate records would create a massive number of records with complex parent-child relationships. The factual extraction layer should capture what the source defines; the relation layer should derive connections.

### Principle 7: Extractor modularity — one extractor per game

Each game extractor is self-contained:
- Own parsers for game-specific formats (C headers, YAML, JSON, Lua, .des)
- Declares its own record kinds and population contracts
- Uses the shared SDK (`EntitySpec`, `EntityAdapter`, `runEntityPipeline`)
- No cross-extractor runtime dependencies

One extractor per game, not per data type. A game's extractor handles all data types for that game. This keeps game-specific parsing logic in one place and simplifies the source binding.

### Principle 8: New game onboarding process

When a new game source is added, the following steps are performed in order:

1. **Register source** — add entry to `knowledge/sources/registry.yaml`
2. **Create binding** — add entry to `knowledge/sources/bindings.yaml` with `payload_path`, `fingerprint`, VCS info
3. **Survey data** — identify all data types, formats, and file locations in the source payload
4. **Map kinds** — match each data type to a canonical kind from `game-content-taxonomy.yaml`
5. **Create extractor** — create `packages/extractors/<game>-extractor/` with package.json, tsconfig.json
6. **Write parsers** — one parser per data format (e.g., `yaml-parser.ts`, `json-parser.ts`, `c-parser.ts`, `des-parser.ts`)
7. **Write spec builders** — one `EntitySpec` builder per kind, using `EntityAdapter`
8. **Declare populations** — add `exhaustivePopulations` entries for every data dimension with expected counts
9. **Write conformance test** — create `tests/conformance/c<NN>-<game>.test.ts`
10. **Run and verify** — population counts match, no data loss, determinism check passes

### Principle 9: Taxonomy extension (when existing kinds are insufficient)

If a game data type genuinely does not fit any existing canonical kind:

1. Propose a new kind in `game-content-taxonomy.yaml` (requires RFC per `decision_policy.ontology_change`)
2. Assign it to a category (actors, objects, world, simulation, society, economy, narrative_naming, generation_inputs)
3. Document the mapping rationale
4. Update `record-types.yaml` if a new `record_type` is needed (unlikely — `definition` covers all extracted data)

**Current status**: the existing taxonomy covers all identified **unextracted** data types across the four current game sources. No taxonomy extensions are needed for the planned **new** extraction work.

**Known gap**: `profession` is used by existing extractors (crawl, cataclysm-bn) and in this RFC's mapping table, but is missing from `game-content-taxonomy.yaml`. This RFC proposes adding `profession` to the `abilities_character` category as part of its implementation. This is the only taxonomy addition required by this RFC.

**Existing technical debt**: several brogueCE recordKinds (`image_asset`, `dungeon_feature`, `light`, `monster_class`, `monster_behavior`, `monster_ability`) are not in the taxonomy. These were added before the taxonomy was formalized. A separate taxonomy cleanup effort should address them — this RFC does not propose changes to those kinds.

### Principle 10: Versioning and refresh

- When a game source is updated (new version), re-run the extractor against the new source binding
- Record IDs are stable (slug-based resolution via `RefreshIdentityResolver`), so records are updated in-place, not duplicated
- `extractorVersion` in the manifest tracks extractor logic changes
- `binding_digest` in the source binding tracks source data changes
- Population contracts catch version drift: if a new version adds or removes entities, the `expected` count must be updated and the mismatch logged

### Principle 11: Extraction–derivation contract

The Attribute Deriver (`scripts/run-stage-deriver.ts`) automatically generates claims, relations, and semantic records from definition record attributes. This creates a binding contract between extraction and derivation:

- **Extractors MUST preserve all gameplay-relevant attributes** in their native form (Principle 2). The deriver iterates over every attribute in `record.attributes` and creates a claim per scalar value.
- **Extractors MUST NOT rename or normalize attribute names**. The deriver uses attribute names as claim predicates (`has_<attr_name>`). Renaming attributes breaks claim continuity across versions.
- **Display-only attributes are skipped by the deriver** via a `SKIP_ATTRIBUTES` set (`symbol`, `color`, `glyph`, `sprite_path`, `description`, `flavor_text`, etc.). Extractors need not filter these out — the deriver handles it.
- **Cross-reference attributes** (e.g., `leads_to` in Cataclysm-BN mutations) are mapped to relation types via `CROSS_REF_ATTRIBUTES` in the deriver. New cross-reference attributes require a deriver config update, not an extractor change.
- **Grouping attributes** (e.g., `species`, `default_faction`, `material`, `flags`, `alignment`) are used to create semantic records. Extractors should preserve these as arrays or scalars — the deriver handles grouping.
- **More records with more attributes = exponentially more derived data**. Adding a new data type with N entities and M attributes each produces N×M claims, plus grouping relations and semantic records. This is the primary mechanism by which the knowledge base grows.

**Implication for prioritization**: data types with many attributes per entity (e.g., Cataclysm-BN bionics with `occupied_bodyparts`, `flags`, `act_cost`, `react_cost`, `time`, `points`) produce more derived knowledge per extraction effort than data types with few attributes (e.g., NetHack trap enum with just a type name). Prioritization should consider both entity count and attribute richness.

### TypeScript contracts

The existing SDK types already support the methodology. No new types are needed:

```ts
// EntitySpec.kind → canonical kind from taxonomy (Principle 3)
// EntityAdapter.nativeKind → game-local type name (Principle 3)
// EntityAdapter.getAttributes → game-local attributes, no normalization (Principle 2)
// EntityAdapter.getLineRange → evidence anchor line range (Principle 4)
// ExtractorManifest.recordKinds → declared canonical kinds (Principle 3)
// ExtractorManifest.exhaustivePopulations → population contracts (Principle 5)
```

### File system responsibilities

| Path | Role |
|---|---|
| `packages/extractors/<game>-extractor/src/extractor.ts` | Extractor entry point with manifest and run() |
| `packages/extractors/<game>-extractor/src/*-parser.ts` | Format-specific parsers |
| `knowledge/sources/registry.yaml` | Source registration (Principle 8, step 1) |
| `knowledge/sources/bindings.yaml` | Source binding with payload_path and fingerprint (Principle 8, step 2) |
| `knowledge/ontology/game-content-taxonomy.yaml` | Canonical kind vocabulary (Principle 3, 9) |
| `knowledge/definition/<source_id>/<kind>/*.jsonl` | Output records |
| `tests/conformance/c<NN>-<game>.test.ts` | Conformance test (Principle 8, step 9) |

## Rollout

- **Existing extractors** are already compliant with most principles. They use `EntitySpec`/`EntityAdapter`, declare `recordKinds` and `exhaustivePopulations`, and produce evidence anchors via `runEntityPipeline`. No migration is needed for existing records.
- **New extraction work** (Crawl vaults/spells/abilities/branches, Cataclysm-BN bionics/traps/recipes/skills/effects/factions, NetHack artifacts/traps/levels/roles/races/branches/skills) follows the methodology from the start. Each new data type is mapped per Principle 3, gets a population contract per Principle 5, and is added to the existing extractor for that game.
- **New games** follow the onboarding process (Principle 8) from registration through conformance testing.
- **ADR-0005** (companion) documents the onboarding process as a local decision and references this RFC.
- **ADR-0006** (companion) documents the taxonomy coverage analysis for unextracted data types confirming no taxonomy extensions are needed for planned new extraction work. The `profession` gap (already-extracted kind missing from taxonomy) is addressed by this RFC directly.
- The `fo-create-extractor` skill (ADR-0003) should be updated to reference this RFC as the methodology source.

## Alternatives considered

**A. Normalized attributes during extraction** — map game-local attributes to a canonical attribute schema during extraction (e.g., all games use `hp`, `speed`, `armor`). Rejected because it couples extraction to cross-game analysis, loses native fidelity, and requires schema changes every time a new game is added. Cross-game normalization belongs in the concept/relation layer.

**B. Multiple extractors per game** — one extractor per data type (e.g., `crawl-monsters-extractor`, `crawl-vaults-extractor`). Rejected because it fragments game-specific parsing logic, complicates source bindings, and increases the number of manifests and conformance tests without benefit.

**C. Sub-entity extraction** — extract embedded definitions (e.g., monster spawns inside vaults) as separate records with parent-child relations. Rejected for the factual layer because it creates a massive record count with complex relationships. The relation layer can derive these connections from the composite attributes.

**D. Dynamic taxonomy extension** — allow extractors to define new canonical kinds without an RFC. Rejected because the taxonomy is a governed artifact (`decision_policy.ontology_change: rfc`). Uncontrolled kind proliferation would fragment the knowledge base and break cross-game queries.

## Risks

- **Agent misinterpretation**: agents may treat the mapping table in Principle 3 as exhaustive and fail to map new data types not listed. The table is illustrative; the process (check taxonomy, map to nearest kind, use native_kind for differentiation) is binding.

- **Population count drift**: as game sources update, population `expected` values become stale. Without periodic re-survey, mismatches may be attributed to parser bugs rather than source changes. Mitigation: population contracts include a `description` field documenting how to count, enabling re-verification.

- **Composite data ambiguity**: Principle 6 says composite data stays in attributes, but the boundary between "composite attribute" and "separate record" is judgment-based. Example: a Cataclysm-BN recipe has ingredients — are those separate `item` records or attributes of the recipe? Answer: ingredients are attributes (they reference items by id, they are not item definitions). The rule is: if the source defines it as a discrete entity with its own properties, it is a record; if it is a reference or embedded rule, it is an attribute.

- **Maintenance burden**: the mapping table must be updated as new data types are identified. This is a documentation cost, not a code cost.

- **Performance**: extracting all data types from large sources (Cataclysm-BN has ~6000 items, ~600 mutations, plus potentially hundreds of recipes, mapgen templates, etc.) may produce tens of thousands of records. The current pipeline processes records sequentially. This is acceptable for batch extraction but may need optimization for interactive re-extraction.

## Acceptance criteria

- [ ] RFC-0001 validated with `rfc.validate` and passes
- [ ] ADR-0005 (new game onboarding process) created and references this RFC
- [ ] ADR-0006 (taxonomy coverage confirmation) created and references this RFC
- [ ] `profession` added to `game-content-taxonomy.yaml` in the `abilities_character` category
- [ ] Existing extractors reviewed for compliance with all 11 principles
- [ ] `fo-create-extractor` skill updated to reference this RFC as methodology source
- [ ] First new extraction (Crawl vaults or Cataclysm-BN bionics) follows the methodology and passes conformance
- [ ] `AGENTS.md` updated with a reference to this RFC for extractor creation

## Implementation notes for agents

- Agents MAY implement extraction code changes ONLY when this RFC has status: accepted (or implemented).
- Agents creating new extractors MUST follow the onboarding process (Principle 8) and the `fo-create-extractor` skill workflow.
- Agents MUST map game-local data types to existing canonical kinds before proposing taxonomy extensions (Principle 9).
- Agents MUST declare population contracts for every data dimension in the extractor manifest (Principle 5).
- Agents MUST NOT normalize attributes across games during extraction (Principle 2).
- Agents MUST NOT create sub-entity records for embedded references or spawn rules (Principle 6).
- Agents MUST NOT weaken or remove enforcement rules established by this RFC without a new RFC that supersedes it.
- If implementation reveals a data type that genuinely does not fit any existing canonical kind, the agent MUST propose a taxonomy extension via RFC (Principle 9) rather than using `other_definition` as a fallback.
