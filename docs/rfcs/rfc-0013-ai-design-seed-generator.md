---
id: RFC-0013
title: "AI design seed generator (Laboratory) — sensation to structure dossier"
status: accepted
kind: policy
scope: workspace
owners:
  - architecture
reviewers:
  - human:andrii-syrokomskyi
createdAt: 2026-08-23
updatedAt: 2026-08-23
enhancedAt: 2026-08-23
implementedAt:
closedAt:
supersedes: []
supersededBy:
amends: []
amendedBy:
related:
  - RFC-0003
  - RFC-0009
  - RFC-0010
  - RFC-0011
satisfies: []
versionBump: minor
commands:
  proposed: []
  added: []
  changed: []
  removed: []
appsImpacted:
  - mcp
  - web
packagesImpacted: []
successSignals:
  - /laboratory page accepts sensation + context + constraints and returns a dossier
  - Dossier includes relevant design primitives, pressures, mutation vectors, and concrete examples
  - Dossier shows ancestry trail from canonical structures to suggested design space
  - MCP generate_design_seed tool produces structured JSON dossier
  - System works without LLM by falling back to keyword + embedding search
nonGoals:
  - Does not generate game designs — generates structured dossiers for human interpretation
  - Does not replace human creativity — surfaces relevant structures as inspiration
  - Does not deploy as a separate service — integrates into existing MCP and web app
---

# RFC-0013: AI design seed generator (Laboratory) — sensation to structure dossier

## Context

The `/inspiration` page (now `/laboratory`) already describes the concept: a user provides a desired sensation (e.g., "dread"), a context (e.g., "cave exploration"), and excluded devices (e.g., "darkness, hunger, sanity"). The system finds relevant canonical structures and produces a "grounded dossier."

Currently the page is a static mockup — the form submits to `/ask` which is a general Q&A interface. There is no structured dossier generation.

### Available infrastructure

- **469 concepts** with definitions, criteria, ancestry, and quality scores (RFC-0009)
- **Embedding search** for semantic concept lookup (RFC-0010)
- **Design patterns** with concrete examples (RFC-0011)
- **28 MCP tools** for querying the knowledge base
- **LLM integration** in `run-stage-design.ts` using OpenAI API (`@ai-sdk/openai`)
- **Search API** with Workers AI embeddings

## Problem

1. **No structured dossier generation**: The laboratory page promises a dossier but delivers nothing — it redirects to general Q&A.
2. **No sensation-to-concept mapping**: There is no way to map "dread" → relevant design pressures (e.g., "consequence_persistence", "information_scarcity") and primitives (e.g., "permadeath", "identification").
3. **No constraint application**: The "excluded devices" feature (e.g., "no hunger, no sanity") is not wired to anything — the system cannot filter out concepts related to excluded mechanics.
4. **No ancestry trail**: The page promises "source structures → mutation operation → resulting possibility" but does not generate this trail.

## Decision

### D1: Sensation-to-concept mapping

Define a `SENSATION_MAP` that maps common game design sensations to relevant concept keys:

```typescript
const SENSATION_MAP: Record<string, { pressures: string[]; primitives: string[]; patterns: string[] }> = {
  "dread": {
    pressures: ["pressure-risk_of_loss", "pressure-risk_aversion", "pressure-unfairness_risk"],
    primitives: ["design-permadeath", "design-identification_system", "design-procedural_generation"],
    patterns: ["pattern-knowledge_through_risk"],
  },
  "tension": {
    pressures: ["pressure-time_pressure", "pressure-resource_scarcity", "pressure-risk_vs_reward"],
    primitives: ["design-permadeath", "design-inventory_management", "design-skill_training"],
    patterns: ["pattern-escalating_threat", "pattern-build_diversity"],
  },
  "discovery": {
    pressures: ["pressure-information_asymmetry", "pressure-exploration_tension"],
    primitives: ["design-procedural_generation", "design-identification_system", "design-turn_based_combat"],
    patterns: ["pattern-knowledge_through_risk", "pattern-branch_choice"],
  },
  "power_fantasy": {
    pressures: ["pressure-power_curve_tension", "pressure-tactical_diversity"],
    primitives: ["design-skill_training", "design-level_progression", "design-crafting_system"],
    patterns: ["pattern-build_diversity", "pattern-escalating_threat"],
  },
  "urgency": {
    pressures: ["pressure-time_pressure", "pressure-resource_scarcity", "pressure-exploration_urgency"],
    primitives: ["design-hunger_clock", "design-procedural_generation", "design-turn_based_combat"],
    patterns: ["pattern-escalating_threat"],
  },
  "strategic_depth": {
    pressures: ["pressure-tactical_depth", "pressure-specialization_tradeoff", "pressure-opportunity_cost"],
    primitives: ["design-skill_training", "design-inventory_management", "design-turn_based_combat"],
    patterns: ["pattern-build_diversity", "pattern-asymmetric_combat"],
  },
  "mystery": {
    pressures: ["pressure-information_asymmetry", "pressure-cautious_exploration", "pressure-risk_assessment"],
    primitives: ["design-identification_system", "design-procedural_generation", "design-magic_and_spellcasting"],
    patterns: ["pattern-knowledge_through_risk", "pattern-stealth_alternative"],
  },
  "greed": {
    pressures: ["pressure-resource_hoarding", "pressure-economic_decision_making", "pressure-risk_vs_reward"],
    primitives: ["design-shop_and_economy", "design-inventory_management", "design-crafting_system"],
    patterns: ["pattern-shop_economy"],
  },
  "devotion": {
    pressures: ["pressure-piety_management", "pressure-emotional_attachment"],
    primitives: ["design-religion_and_god", "design-pet_and_companion"],
    patterns: ["pattern-god_relationship"],
  },
  "vulnerability": {
    pressures: ["pressure-risk_aversion", "pressure-risk_of_loss", "pressure-cautious_exploration"],
    primitives: ["design-permadeath", "design-stealth_and_awareness", "design-hunger_clock"],
    patterns: ["pattern-save_scum_prevention"],
  },
  "creativity": {
    pressures: ["pressure-specialization_tradeoff", "pressure-tactical_diversity"],
    primitives: ["design-crafting_system", "design-magic_and_spellcasting", "design-skill_training"],
    patterns: ["pattern-build_diversity"],
  },
  "exploration": {
    pressures: ["pressure-exploration_tension", "pressure-exploration_urgency", "pressure-opportunity_cost"],
    primitives: ["design-procedural_generation", "design-stealth_and_awareness", "design-turn_based_combat"],
    patterns: ["pattern-branch_choice", "pattern-stealth_alternative"],
  },
  "survival": {
    pressures: ["pressure-resource_scarcity", "pressure-resource_management", "pressure-risk_of_loss"],
    primitives: ["design-hunger_clock", "design-crafting_system", "design-inventory_management"],
    patterns: ["pattern-escalating_threat", "pattern-corpse_economy"],
  },
  "mastery": {
    pressures: ["pressure-tactical_depth", "pressure-analysis_paralysis", "pressure-specialization_tradeoff"],
    primitives: ["design-skill_training", "design-turn_based_combat", "design-stealth_and_awareness"],
    patterns: ["pattern-asymmetric_combat"],
  },
  "tradeoff": {
    pressures: ["pressure-opportunity_cost", "pressure-economic_decision_making", "pressure-specialization_tradeoff"],
    primitives: ["design-shop_and_economy", "design-inventory_management", "design-skill_training"],
    patterns: ["pattern-shop_economy", "pattern-build_diversity"],
  },
};
```

All keys verified against actual concept files in `knowledge/concept/cross-game/concept/`:
- 14 design primitives: `crafting_system`, `hunger_clock`, `identification_system`, `inventory_management`, `level_progression`, `magic_and_spellcasting`, `permadeath`, `pet_and_companion`, `procedural_generation`, `religion_and_god`, `shop_and_economy`, `skill_training`, `stealth_and_awareness`, `turn_based_combat`
- 31 pressures: `risk_of_loss`, `risk_aversion`, `unfairness_risk`, `time_pressure`, `resource_scarcity`, `risk_vs_reward`, `information_asymmetry`, `exploration_tension`, `power_curve_tension`, `tactical_diversity`, `exploration_urgency`, `tactical_depth`, `specialization_tradeoff`, `opportunity_cost`, `cautious_exploration`, `risk_assessment`, `resource_hoarding`, `economic_decision_making`, `piety_management`, `emotional_attachment`, `analysis_paralysis`, `resource_management` and others
- 10 patterns: `knowledge_through_risk`, `escalating_threat`, `build_diversity`, `branch_choice`, `asymmetric_combat`, `stealth_alternative`, `shop_economy`, `god_relationship`, `save_scum_prevention`, `corpse_economy`

**Fallback**: If sensation not in map, use embedding search (RFC-0010) to find concepts semantically related to the sensation word.

### D2: Dossier structure

```json
{
  "sensation": "dread",
  "context": "cave exploration",
  "excluded": ["darkness", "hunger", "sanity", "durability"],
  "dossier": {
    "relevant_primitives": [
      {
        "key": "cross-game/concept/design-permadeath",
        "title": "Permadeath",
        "definition": "...",
        "quality_score": 0.66,
        "why_relevant": "Permanent consequences create dread by making every decision life-or-death."
      }
    ],
    "relevant_pressures": [
      {
        "key": "cross-game/concept/pressure-risk_of_loss",
        "title": "Risk of Loss",
        "definition": "...",
        "why_relevant": "Decisions cannot be undone, amplifying the weight of each choice."
      }
    ],
    "mutation_vectors": [
      {
        "key": "cross-game/concept/mutation-permadeath-death_finality",
        "title": "Death Finality",
        "definition": "...",
        "available_knobs": ["permanent_no_recovery", "meta_progression_retention", "extra_lives"]
      }
    ],
    "concrete_examples": [
      {
        "game": "nethack",
        "primitive": "permadeath",
        "example": "Death deletes the save file. No respawn. All progress lost."
      }
    ],
    "excluded_mechanics_filtered": [
      {"requested_exclusion": "hunger", "filtered_concepts": ["design-hunger_clock", "pressure-resource_scarcity"]}
    ],
    "ancestry_trail": [
      {"step": 1, "type": "source_structure", "ref": "design-permadeath", "description": "Canonical primitive: permanent death"},
      {"step": 2, "type": "mutation", "ref": "mutation-permadeath-death_finality", "description": "Mutation axis: how final is death?"},
      {"step": 3, "type": "possibility", "ref": "knob-permadeath-death_finality-meta_progression", "description": "Possibility: meta-progression retention"}
    ],
    "design_tensions": [
      {"tension": "risk_of_loss ↔ information_asymmetry", "description": "Permanent consequences + hidden information = every identification is a gamble"}
    ]
  }
}
```

### D3: MCP tool `generate_design_seed`

**Input**: `{ sensation: string; context?: string; excluded?: string[]; limit?: number }`

**Logic**:
1. Look up sensation in `SENSATION_MAP` — or use embedding search as fallback
2. Retrieve relevant primitives, pressures, patterns
3. Filter out concepts related to excluded terms (keyword match on concept title/definition)
4. For each relevant primitive, retrieve mutation vectors and knobs
5. Retrieve concrete examples (from RFC-0011)
6. Build ancestry trail: primitive → mutation vector → knob
7. Retrieve design tensions involving the relevant pressures
8. Return structured JSON dossier

**Files**: `apps/mcp/src/tools/derived.ts`, `apps/mcp/src/server.ts`

### D4: LLM-enhanced dossier (MCP-only, optional)

When `OPENAI_API_KEY` is available in the MCP server environment, enhance the dossier with LLM-generated `why_relevant` explanations:

1. For each relevant concept, prompt: "Why does {concept.title} ({concept.definition}) create the sensation of {sensation} in the context of {context}? Answer in 1-2 sentences."
2. Cache results in `systems-cache/llm-dossier-cache.json` (same pattern as `run-stage-design.ts`)

**Fallback**: Without LLM, `why_relevant` is a template: `"{concept.title} contributes to {sensation} because it {concept.definition}"`.

**Scope**: LLM enhancement is available only in the MCP server (`apps/mcp/`). The web app (`apps/web/`) is a static site and cannot safely store `OPENAI_API_KEY` client-side — it always uses the template fallback.

### D5: Web app `/laboratory` implementation

Wire the existing form to generate a dossier client-side from build-time data:

1. Form submits sensation + context + excluded via JS (no page reload)
2. Client-side JS generates dossier from concept data embedded at build time
3. Render dossier as formatted HTML:
   - Relevant primitives as cards with quality badges
   - Mutation vectors as expandable sections
   - Concrete examples as game-tagged quotes
   - Ancestry trail as a visual flow
   - Design tensions as paired statements

Since the web app is static (`prerender = true`), concept data is embedded at build time:
- Astro import: `import conceptData from '../data/concepts.json'` — generated during materialization
- The materializer already writes `dist/records.jsonl`; a build step filters concepts and writes `apps/web/src/data/concepts.json` (~50KB for 469 concept records)
- Implement sensation mapping in `apps/web/src/lib/laboratory.ts`
- No server roundtrip needed — all logic runs client-side

**Route**: Rename `inspiration.astro` to `laboratory.astro` and update the route from `/inspiration` to `/laboratory`. Update the nav link in `Base.astro` from `{ href: "/inspiration", label: "Laboratory", key: "laboratory" }` to `{ href: "/laboratory", label: "Laboratory", key: "laboratory" }`. The old `/inspiration` route is removed (forward-only — no redirect).

**Empty dossier edge case**: If all relevant concepts are filtered by excluded mechanics, return an empty dossier with message: "All matching structures were excluded. Try removing some constraints."

**Files**: `apps/web/src/pages/laboratory.astro` (renamed from `inspiration.astro`), `apps/web/src/lib/laboratory.ts` (new), `apps/web/src/data/concepts.json` (new, build-generated), `apps/web/src/layouts/Base.astro` (nav link update)

## Implementation plan

### Step 1: Define sensation map (D1)

1. Curate 15 sensation entries mapping to existing concept keys (verified against `knowledge/concept/cross-game/concept/`)
2. Store in `apps/mcp/src/tools/sensation-map.ts` (MCP server) and `apps/web/src/lib/sensation-map.ts` (web app). Both files contain the same `SENSATION_MAP` constant — duplication is intentional since there is no shared package between `apps/mcp` and `apps/web`, consistent with the existing project structure where `apps/*` do not share code via packages.

**Files**: `apps/mcp/src/tools/sensation-map.ts`, `apps/web/src/lib/sensation-map.ts`

### Step 2: Implement MCP generate_design_seed tool (D3, D4)

1. Add `generateDesignSeed()` to `apps/mcp/src/tools/derived.ts`
2. Implement sensation lookup → concept retrieval → filtering → dossier assembly
3. Add optional LLM enhancement with caching
4. Register in `server.ts`

**Files**: `apps/mcp/src/tools/derived.ts`, `apps/mcp/src/server.ts`

### Step 3: Implement web laboratory page (D5)

1. Create `apps/web/src/lib/laboratory.ts` — client-side dossier generation from build-time concept data
2. Create `apps/web/src/data/concepts.json` — build-generated filtered concepts (concept records only, ~50KB)
3. Rename `inspiration.astro` to `laboratory.astro` and rewrite to:
   - Accept form input (sensation + context + excluded)
   - Generate dossier client-side from embedded concept data
   - Render results in structured layout
4. Update nav link in `Base.astro` from `/inspiration` to `/laboratory`
5. Add ancestry trail visualization (simple numbered steps with connecting lines)

**Files**: `apps/web/src/lib/laboratory.ts`, `apps/web/src/data/concepts.json`, `apps/web/src/pages/laboratory.astro`, `apps/web/src/layouts/Base.astro`

### Step 4: Tests and verify

1. Test MCP tool with known sensations
2. Test fallback for unknown sensations (embedding search)
3. Test excluded mechanics filtering
4. `pnpm exec turbo run build:check && pnpm exec vitest --run`

## Acceptance criteria

- [ ] `generate_design_seed` MCP tool returns structured dossier for known sensations
- [ ] Unknown sensations fall back to embedding search
- [ ] Excluded mechanics are filtered from results
- [ ] Dossier includes: primitives, pressures, mutation vectors, examples, ancestry trail, tensions
- [ ] `/laboratory` web page generates and renders dossier client-side from build-time data
- [ ] LLM enhancement works in MCP server when `OPENAI_API_KEY` is set, falls back to template otherwise
- [ ] Web app uses template fallback only (no LLM client-side)
- [ ] All tests pass

## Risks

- **Sensation map completeness**: 15 sensations may not cover all user needs. Mitigation: embedding search fallback handles unknown sensations.
- **Client-side data loading**: Loading all concepts client-side (~469 records) is feasible but loading all definition records (~20K) is not. Mitigation: laboratory only needs concepts, not definitions — concepts are <50KB, embedded at build time as `concepts.json`.
- **LLM cost**: Each dossier generation with LLM = ~10-15 calls. Mitigation: cache by sensation+context key, reuse across requests. LLM is MCP-only — web app has no LLM cost.
- **Subjectivity**: "Why does permadeath create dread?" is subjective. Mitigation: LLM generates plausible explanations, marked as `epistemic.confidence: "inferred"`.
- **Sensation map drift**: If new concepts are added or renamed, `SENSATION_MAP` keys may become stale. Mitigation: keys are verified against `knowledge/concept/cross-game/concept/` at authoring time; a conformance test validates that all SENSATION_MAP keys resolve to existing concept records.

## Architectural fit

- **RFC-0003** (design layer expansion) — this RFC queries the 469 concepts created by RFC-0003 (14 primitives, 31 pressures, 56 mutation vectors, 224 knobs, 93 counterplay patterns, 28 failure modes, 10 design patterns, 22 cross-game mechanics). No new concepts or relations are created.
- **RFC-0009** (concept quality scoring) — the dossier includes `quality_score` from RFC-0009 for each relevant primitive. No scoring changes needed.
- **RFC-0010** (embedding search) — the fallback for unknown sensations uses `search_design_space` MCP tool or the search API. No search API changes needed — `search-api` is NOT in `appsImpacted`.
- **RFC-0011** (design pattern library) — the dossier includes concrete examples from RFC-0011's `concrete_examples` field on design primitives. No pattern changes needed.
- **MCP tools** — `generate_design_seed` follows the existing pattern: function in `derived.ts`, registration in `server.ts`, `readOnly: true`, added to `REQUIRED_TOOLS`. The tool is read-only — it queries existing data, does not mutate.
- **Web app** — `apps/web/AGENTS.md` conventions apply: new `.astro` files must include `MODULE_CONTRACT` and `CHANGE_SUMMARY` comments. Progressive enhancement: form works without JS (degrades to a message), client-side JS enhances with dossier generation.
- **Concept schema** (`rgkb/concept@2`) — no schema changes. The RFC reads existing concept fields (`concept_type`, `title`, `definition`, `quality_score`, `concrete_examples`, `ancestry`, `implementation_refs`).
- **No canonical modifications** — this RFC is purely a consumer of existing canonical data. No records are created, modified, or deleted.

## Design

### TypeScript contracts

```typescript
// D1: Sensation map entry
interface SensationEntry {
  pressures: string[];   // concept keys, e.g. "pressure-risk_of_loss"
  primitives: string[];  // concept keys, e.g. "design-permadeath"
  patterns: string[];    // concept keys, e.g. "pattern-knowledge_through_risk"
}

// D2: Dossier output
interface DossierOutput {
  sensation: string;
  context: string | null;
  excluded: string[];
  dossier: {
    relevant_primitives: DossierConcept[];
    relevant_pressures: DossierConcept[];
    mutation_vectors: DossierMutationVector[];
    concrete_examples: DossierExample[];
    excluded_mechanics_filtered: { requested_exclusion: string; filtered_concepts: string[] }[];
    ancestry_trail: { step: number; type: "source_structure" | "mutation" | "possibility"; ref: string; description: string }[];
    design_tensions: { tension: string; description: string }[];
  };
}

interface DossierConcept {
  key: string;
  title: string;
  definition: string;
  quality_score: number | null;
  why_relevant: string;
}

interface DossierMutationVector {
  key: string;
  title: string;
  definition: string;
  available_knobs: string[];
}

interface DossierExample {
  game: string;
  primitive: string;
  example: string;
}

// D3: MCP tool input
interface GenerateDesignSeedInput {
  sensation: string;
  context?: string;
  excluded?: string[];
  limit?: number;
}
```

### Edge cases

- **Unknown sensation**: `SENSATION_MAP` lookup returns undefined. Fallback: use `search_design_space` MCP tool (or embedding search) with the sensation word as query, retrieve top concepts, map them as primitives/pressures based on their `concept_type`.
- **All concepts filtered by exclusions**: Return empty dossier with message: "All matching structures were excluded. Try removing some constraints."
- **Sensation map key not found in store**: Skip the key, log a warning. The conformance test (Step 4) catches this at build time.
- **Concept without `concrete_examples`**: The `concrete_examples` array is empty — the dossier shows "No examples available" for that primitive.
- **Concept without `quality_score`**: `quality_score` is `null` — the dossier shows no quality badge (graceful fallback per RFC-0009).

## Rollout

**Default behavior**: All new tools and pages are immediately available upon implementation. No feature flags, no gradual rollout.

**Adoption path**: No migration needed — `generate_design_seed` MCP tool is additive (existing tools unchanged). The `/laboratory` page replaces `/inspiration` (old route removed, forward-only). The `concepts.json` data file is generated during the build step.

**MCP tool**: Additive — existing 28 tools continue to work. `generate_design_seed` is registered with `readOnly: true` and added to `REQUIRED_TOOLS`.

**Web app**: The `/inspiration` route is removed and replaced by `/laboratory`. The nav link in `Base.astro` is updated. No redirect (forward-only). The `ask.astro` page's "Continue to Creative Quest" link (`/inspiration?q=...`) is updated to `/laboratory?q=...`.

## File system responsibilities

| Path | Role |
|---|---|
| `apps/mcp/src/tools/sensation-map.ts` | `SENSATION_MAP` constant for MCP server |
| `apps/mcp/src/tools/derived.ts` | `generateDesignSeed()` function |
| `apps/mcp/src/server.ts` | Tool registration + `REQUIRED_TOOLS` |
| `apps/web/src/lib/sensation-map.ts` | `SENSATION_MAP` constant for web app (same content) |
| `apps/web/src/lib/laboratory.ts` | Client-side dossier generation logic |
| `apps/web/src/data/concepts.json` | Build-generated filtered concepts (~50KB) |
| `apps/web/src/pages/laboratory.astro` | Laboratory page (renamed from `inspiration.astro`) |
| `apps/web/src/layouts/Base.astro` | Nav link update (`/inspiration` → `/laboratory`) |
| `apps/web/src/pages/ask.astro` | Update "Continue" link (`/inspiration` → `/laboratory`) |
| `systems-cache/llm-dossier-cache.json` | LLM response cache (MCP server only) |

## Alternatives considered

**A1: Single shared sensation-map package** — create `packages/sensation-map/` shared between `apps/mcp` and `apps/web`. Rejected because the project has no existing pattern of `apps/*` sharing code via packages (imports flow `apps/* → packages/*`, but no existing package exists solely for app-to-app sharing). Duplicating a constant map in two files is simpler and consistent with the current project structure.

**A2: Server-side dossier generation for web app** — instead of client-side, call the MCP tool or a dedicated API endpoint from the web app. Rejected because the web app is static (`prerender = true`) with no server runtime. Adding a server endpoint would require deploying a Worker or using the search API — adding infrastructure for a feature that can run client-side with ~50KB of data.

**A3: Generate dossier at build time for predefined sensations** — pre-generate dossiers for all 15 sensations during the Astro build. Rejected because (a) the user provides custom context and excluded mechanics at runtime, (b) the combinatorial space of context × excluded is too large to pre-generate, (c) client-side generation from 50KB of concept data is fast enough.

**A4: Use `search_design_space` MCP tool instead of `SENSATION_MAP`** — skip the curated map entirely, always use embedding search. Rejected because curated mappings provide higher quality results for common sensations (dread, tension, discovery) than semantic search alone. The map provides deterministic, reviewed associations; embedding search is the fallback for unknown sensations.

## Implementation notes for agents

- **Status gate**: This RFC must be in `accepted` status before implementation begins. Use `fo-idea-plan` to create the implementation plan and transition to `accepted`.
- **MODULE_CONTRACT**: New files and modified non-trivial `.astro` components in `apps/web/` must include `MODULE_CONTRACT` and `CHANGE_SUMMARY` comments per `apps/web/AGENTS.md`.
- **MCP tool convention**: `generate_design_seed` must be read-only (`readOnly: true`) and registered with a JSON schema in `server.ts`. Add to `REQUIRED_TOOLS` array.
- **No canonical modifications**: This RFC does not create, modify, or delete any records in `knowledge/`. It is purely a consumer of existing concept data.
- **Sensation map verification**: All keys in `SENSATION_MAP` must resolve to existing concept records in `knowledge/concept/cross-game/concept/`. A conformance test validates this at build time.
- **LLM is MCP-only**: `OPENAI_API_KEY` is used only in the MCP server. The web app uses template fallback for `why_relevant`. Never expose API keys in client-side code.
- **Progressive enhancement**: The `/laboratory` form must degrade gracefully without JS — show a message asking the user to enable JS for dossier generation, or provide a fallback link to `/ask`.
- **CI gates**: All CI checks must pass — `pnpm materialize`, `pnpm exec turbo run build:check`, `pnpm exec vitest --run`.
- **Content vs code**: `SENSATION_MAP` is curated content — an agent can write the code structure, but the sensation-to-concept associations should be reviewed by a human before final acceptance.
- **Validate**: Run `pnpm exec forge rfc.validate --id RFC-0013 --json` after changes to verify no mechanical violations.
