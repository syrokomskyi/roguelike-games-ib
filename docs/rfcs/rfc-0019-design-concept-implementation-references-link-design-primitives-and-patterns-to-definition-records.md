---
id: RFC-0019
title: "Design concept implementation references — link design primitives and patterns to definition records"
status: accepted
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
reviewers:
  - human:andrii-syrokomskyi
createdAt: 2026-08-24
updatedAt: 2026-08-24
enhancedAt: 2026-08-24
implementedAt:
closedAt:
supersedes: []
supersededBy:
amends: []
amendedBy: []
related:
  - RFC-0002
  - RFC-0003
  - RFC-0011
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
packagesImpacted: []
successSignals:
  - All design primitives have non-empty implementation_refs linking to definition records
  - All design patterns have non-empty implementation_refs linking to definition records
  - concrete_examples record_refs populated for each (primitive, game) pair
  - Conformance test verifies all design primitive/pattern implementation_refs resolve to existing records
nonGoals:
  - Does not modify the concept record schema — uses existing rgkb/concept@2 implementation_refs field
  - Does not change mutation vectors or failure modes — these remain abstract with implementation_refs: []
  - Does not change exact-match or semantic-equivalence concepts — those already have implementation_refs via run-stage-concepts.ts
  - Does not modify the extractor SDK or extraction pipeline
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

# RFC-0019: Design concept implementation references — link design primitives and patterns to definition records

## Context

`scripts/run-stage-design.ts` generates design concepts (primitives, mutation vectors, design knobs, counterplay patterns, failure modes, design patterns) using LLM-assisted generation. The script creates these concepts as `rgkb/concept@2` records in the canonical knowledge base.

RFC-0002 (implemented) added `validateConceptRefs()` to `scripts/run-stage-concepts.ts` which strips dangling `implementation_refs` and deletes concepts where all refs are dangling. RFC-0003 (implemented) expanded the design layer with mutation vectors, knobs, counterplay, and failure modes. RFC-0011 (implemented) added design patterns and anti-pattern relations.

However, the design stage script (`run-stage-design.ts`) was never updated to populate `implementation_refs` for most concept types. The current state:

| Concept type | `implementation_refs` | How populated |
|---|---|---|
| Design primitives | `[]` | Never populated (line 675) |
| Pressures | `[conceptId]` | Parent concept ID, not game records (line 704) |
| Mutation vectors | `[]` | Never populated (line 797) |
| Design knobs | `implRefs` | `findRecordsByKeywords()` — crude substring match (line 857) |
| Counterplay patterns | `implRefs` | `findRecordsByKeywords()` — crude substring match (line 921) |
| Failure modes | `[]` | Never populated (line 979) |
| Design patterns | `[]` | Never populated (line 1060) |

Additionally, `concrete_examples` (lines 1013–1029) are generated with `record_refs: []` and `source_file: ""` — the LLM produces text descriptions but never links to actual records.

The `findRecordsByKeywords()` function (lines 126–138) does a simple substring match on record names. This misses most relevant records: `design-crafting_system` will not find `recipe` records because no recipe name contains "crafting".

## Problem

1. **Design primitives are disconnected from game data** — `design-crafting_system` has `implementation_refs: []` despite Cataclysm-BN having 3187 recipe records and NetHack having 37 skill records that implement crafting. Users browsing concepts in the MCP tool or Obsidian vault see no link between abstract design concepts and concrete game implementations.

2. **Design patterns are disconnected from game data** — `pattern-build_diversity` has `implementation_refs: []` despite NetHack having 13 roles + 5 races and Cataclysm-BN having 339 professions that implement build diversity.

3. **`concrete_examples` lack record references** — each primitive has 4 text descriptions (one per game) but `record_refs: []`. The examples are prose without traceable links to actual records.

4. **`findRecordsByKeywords()` is too crude** — substring matching on record names misses most relevant records. `design-hunger_clock` will not find NetHack's `item` records with `nutrition` attribute because no item name contains "hunger".

5. **No conformance test verifies design concept ref completeness** — RFC-0002 added `c14-concept-ref-integrity.test.ts` which checks that refs *resolve*, but does not check that refs are *populated* for design concepts.

## Decision

The design stage script (`scripts/run-stage-design.ts`) gains a two-step LLM-based matching step that populates `implementation_refs` on design primitives and design patterns, and `record_refs` on `concrete_examples`, by semantically matching each primitive/pattern against definition records from each game. A conformance test verifies that all design primitives and patterns have non-empty `implementation_refs` that resolve to existing definition records.

## Architectural fit

- **RFC-0002** (concept quality) — this RFC extends RFC-0002's implementation reference integrity work from the exact-match/semantic-equivalence concepts to the design concept layer. RFC-0002 added validation that refs *resolve*; this RFC ensures refs are *populated* in the first place.
- **RFC-0003** (design layer expansion) — this RFC retrofits `implementation_refs` onto the concept types introduced by RFC-0003 (mutation vectors, knobs, counterplay, failure modes). Only primitives and patterns get populated refs; mutation vectors and failure modes remain abstract.
- **RFC-0011** (design pattern library) — this RFC populates `implementation_refs` on the design patterns introduced by RFC-0011.
- **`scripts/run-stage-design.ts`** — the primary file modified. Already uses LLM calls via `llmJson()` for knob, counterplay, and example generation. The new matching step reuses the same LLM infrastructure (`llm()`, `llmJson()`, cache).
- **`packages/builders/obsidian-builder`** — the Obsidian builder renders `implementation_refs` as wiki-links. Populated refs will produce visible links in the vault, improving navigation.
- **`rgkb/concept@2` schema** — no schema changes. All changes operate within existing `implementation_refs` and `concrete_examples[].record_refs` fields.

## Design

### Matching algorithm

The new step (Step 6.5, after failure mode generation in Step 6, before concrete examples generation in Step 7) performs two-step LLM-based matching for each design primitive. Running the matching step before concrete examples allows the results to be reused for both `record_refs` in concrete examples (Step 7) and `implementation_refs` on design patterns (Step 8):

**Step A — Kind selection:** For each `(primitive, game)` pair, send the LLM a prompt containing:
- The primitive title and definition
- The list of record kinds available for that game (e.g. `creature`, `item`, `recipe`, `skill`, `trap`, `effect`, `faction` for Cataclysm-BN) with record counts per kind

The LLM returns a JSON array of relevant kinds (e.g. `["recipe", "item", "skill"]` for `crafting_system` + `cataclysm-bn`).

**Step B — Record selection:** For each `(primitive, game, kind)` triple, send the LLM a prompt containing:
- The primitive title and definition
- A sample of record names from that kind (up to 50 records, or all if fewer)

The LLM returns a JSON object: `{"select_all": boolean, "record_ids": string[]}`. If `select_all` is `true`, all record IDs of that kind are added to `implementation_refs` (the LLM determined the entire kind is relevant, e.g. all `recipe` records for `crafting_system`). If `select_all` is `false`, only the specified `record_ids` (from the sample) are added. The union across all selected kinds forms the `implementation_refs` for that `(primitive, game)` pair.

The final `implementation_refs` for a primitive is the union of record IDs across all 4 games.

For design patterns, the same two-step process is applied, using the pattern definition and its `member_primitives` as context.

### Concrete examples integration

Step 7 (concrete examples) is extended: after generating the text description for each `(primitive, game)` pair, the matching results from Step 6.5 are used to populate `record_refs` in the concrete example. This avoids a separate LLM call — the same matched record IDs are reused.

### LLM caching

The matching step uses the existing `llm()` / `llmJson()` functions which already cache results in `systems-cache/llm-design-cache.json`. Re-running the script with the same primitives and record sets will use cached results without additional LLM calls.

### Token budget

- Step A (primitives): ~200 tokens per prompt (kind list + primitive description). 14 primitives × 4 games = 56 calls.
- Step B (primitives): ~500-2000 tokens per prompt (up to 50 record names + primitive description). ~56 × 2-3 kinds average = ~140 calls.
- Step A (patterns): ~200 tokens per prompt. 10 patterns × 4 games = 40 calls.
- Step B (patterns): ~500-2000 tokens per prompt. ~40 × 2-3 kinds average = ~100 calls.
- Total: ~340 LLM calls, all cacheable. Using `gpt-4o-mini` at existing temperature 0.7.

### File system responsibilities

| Path | Role |
|---|---|
| `scripts/run-stage-design.ts` | Primary file — add matching step, populate implementation_refs and record_refs |
| `knowledge/concept/cross-game/concept/design-*.jsonl` | Output — design primitive concepts with populated implementation_refs |
| `knowledge/concept/cross-game/concept/pattern-*.jsonl` | Output — design pattern concepts with populated implementation_refs |
| `tests/conformance/c20-design-implementation-refs.test.ts` | New conformance test |
| `systems-cache/llm-design-cache.json` | LLM response cache (existing, extended with new prompts) |

### Failure modes

- **LLM returns no relevant kinds for a (primitive, game) pair**: The primitive gets empty refs for that game. The conformance test checks that the *total* refs across all games are non-empty, not per-game. A primitive with refs from at least 1 game passes.
- **LLM returns invalid record IDs**: The existing `validateConceptRefs()` from RFC-0002 (run in `run-stage-concepts.ts`) strips dangling refs. The design stage does not run this validation itself, but the materializer and conformance tests will catch dangling refs.
- **LLM call fails (network, rate limit)**: The existing `try/catch` pattern in `run-stage-design.ts` is used. On failure, `implementation_refs` stays `[]` for that pair. The script does not abort.
- **A primitive genuinely has no implementation in a game**: For example, `design-crafting_system` may have no implementation in BrogueCE. The LLM should return an empty array. This is correct behavior, not a failure.

## Rollout

- **Existing design concepts** are regenerated from scratch on the next run of `scripts/run-stage-design.ts`. The script's `cleanDesignData()` function removes all previous concepts from `ACTOR_ID` and `PATTERN_ACTOR_ID` before generating new ones. No migration needed.
- **Exact-match and semantic-equivalence concepts** (from `run-stage-concepts.ts`) are unaffected — they already have `implementation_refs` and are generated by a separate script with a different `actor_id`.
- **Conformance test** `c17-design-implementation-refs.test.ts` is additive — it does not modify existing tests.
- **CI gates** — the new conformance test runs as part of `pnpm exec vitest --run` in CI. If the design stage has not been re-run with the new matching step, the test will fail on primitives with empty `implementation_refs`.
- **Re-run required** — after implementation, run `scripts/run-stage-design.ts` to regenerate design concepts with populated refs, then `pnpm materialize` to update canonical state.

## Alternatives considered

**A. Improve `findRecordsByKeywords()` with attribute-based search** — instead of substring matching on record names, search record attributes (e.g. find records with `nutrition` attribute for `hunger_clock`). Rejected because attribute names are game-specific and would require maintaining a mapping from design primitives to attribute names for each game. LLM matching is more flexible and requires no per-game configuration.

**B. Separate post-processing script** — create `scripts/run-stage-design-refs.ts` that reads existing design concepts and populates refs. Rejected because it separates the ref-population logic from concept generation, creating a two-script pipeline that must be run in order. Keeping it in `run-stage-design.ts` ensures refs are populated during concept creation.

**C. Populate refs for all concept types (including mutation vectors and failure modes)** — rejected because mutation vectors are abstract axes of variation (e.g. "recipe_complexity") and failure modes are abstract failure conditions (e.g. "degenerate crafting"). Linking them to specific records would be forced and inaccurate. Primitives and patterns are concrete enough to have meaningful record links.

## Risks

- **LLM matching false positives** — the LLM may select records that are not actually relevant to a design primitive. Mitigation: the two-step process (kind selection → record selection) narrows the scope. The conformance test checks ref *existence*, not ref *correctness*. False positives are acceptable — a primitive with some irrelevant refs is better than a primitive with no refs.

- **LLM cost** — ~340 additional LLM calls per design stage run. Mitigation: all calls are cached in `systems-cache/llm-design-cache.json`. Subsequent runs use the cache. The cost is one-time.

- **Token budget for large record sets** — Cataclysm-BN has 5886 items and 3187 recipes. Step B samples up to 50 records per kind, which may miss relevant records. Mitigation: the `select_all` flag in the Step B response schema allows the LLM to indicate that all records of a kind are relevant, even if only 50 were sampled. When `select_all: true`, all record IDs of that kind are added to `implementation_refs`.

- **Agent misinterpretation** — agents may assume that `implementation_refs` on design primitives is an exhaustive list of all records implementing the primitive. It is not — it is an LLM-selected subset. Mitigation: the RFC explicitly states this in Implementation notes.

- **Conformance test brittleness** — the test requires all primitives to have non-empty refs. If a primitive genuinely has no implementation in any game (unlikely for the current 14 primitives), the test would fail. Mitigation: the test can be updated to exclude specific primitives if needed.

## Acceptance criteria

- [ ] All 14 design primitives have non-empty `implementation_refs` linking to definition records from at least 1 game
- [ ] All design patterns have non-empty `implementation_refs` linking to definition records from at least 1 game
- [ ] `concrete_examples` for all primitives have non-empty `record_refs` for at least 2 games
- [ ] Conformance test `c20-design-implementation-refs.test.ts` passes — verifies all primitive/pattern `implementation_refs` resolve to existing definition records
- [ ] `pnpm materialize` succeeds without errors after re-running design stage
- [ ] All existing tests still pass (`pnpm exec vitest --run`)
- [ ] `rfc.validate` passes on this file before merging

## Implementation notes for agents

- Agents MAY implement code changes ONLY when this RFC has status: accepted (or implemented).
- Agents MUST use the existing `llm()` / `llmJson()` functions in `scripts/run-stage-design.ts` for LLM calls — do not introduce a new LLM client.
- Agents MUST use the existing `systems-cache/llm-design-cache.json` cache — do not create a separate cache file.
- Agents MUST NOT populate `implementation_refs` on mutation vectors or failure modes — these remain `[]` by design.
- Agents MUST reuse the matching results to populate `concrete_examples[].record_refs` — do not make separate LLM calls for examples.
- Agents MUST use test naming `c20-design-implementation-refs.test.ts` (c16 through c19 are already taken by existing conformance tests).
- `implementation_refs` on design primitives is an LLM-selected subset, NOT an exhaustive list of all records implementing the primitive. Agents MUST NOT treat it as exhaustive.
- Agents MUST run `scripts/run-stage-design.ts` after implementation to regenerate concepts with populated refs.
- Agents MUST NOT weaken or remove enforcement rules established by this RFC without a new RFC that supersedes it.
