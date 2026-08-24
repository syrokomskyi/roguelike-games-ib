---
id: RFC-0016
title: "Game recommender by sensations — match player preferences to game design profiles"
status: accepted
kind: policy
scope: workspace
owners:
  - architecture
reviewers:
  - human:andrii-syrokomskyi
createdAt: 2026-08-24
updatedAt: 2026-08-24
enhancedAt: 2026-08-24
closedAt:
supersedes: []
supersededBy:
amends: []
amendedBy:
related:
  - RFC-0011
  - RFC-0013
  - RFC-0009
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
  - recommend_games MCP tool returns ranked game list for a set of sensations
  - /recommend page lets users select sensations and see ranked game recommendations
  - Recommendations are based on pattern presence, primitive coverage, and quality scores
  - Each recommendation includes a rationale explaining why the game matches
nonGoals:
  - Does not track user accounts or persist preferences
  - Does not use collaborative filtering — content-based recommendation only
  - Does not recommend games outside the knowledge base
---

# RFC-0016: Game recommender by sensations — match player preferences to game design profiles

## Context

The knowledge base contains design primitives, pressures, patterns, and their game presence/absence data. The `SENSATION_MAP` (RFC-0013) maps 15 sensations to relevant primitives, pressures, and patterns. Currently this data is used only for design seed generation (Laboratory). 

A game recommender would let a player say "I want dread and discovery" and get back a ranked list of games that best deliver those sensations, with a rationale for each recommendation.

## Problem

1. **No way to discover games by desired experience** — players cannot query "which game gives me the most dread?"
2. **Pattern presence data is underutilized** — `games_where_present` and `games_where_absent` on design patterns are not used for recommendation
3. **Quality scores are not applied to ranking** — RFC-0009 quality scores could weight recommendations toward well-evidenced patterns
4. **Sensation map is only used for seed generation** — the same mapping can drive recommendations

## Decision

### D1: Content-based recommendation algorithm

For each game, compute a **sensation match score** for the requested sensations:

1. For each requested sensation, look up `SENSATION_MAP` to get relevant primitives, pressures, and patterns
2. For each relevant concept, check if the game is in `games_where_present` (for patterns) or `ancestry.source_games` (for primitives/pressures)
3. Weight by concept quality score (RFC-0009) — higher quality concepts contribute more
4. Sum weighted matches, normalize by total possible matches for the sensation
5. Rank games by aggregate score across all requested sensations

Score formula per game per sensation:
```
score = Σ(weight × presence_weight) / Σ(weight)
```
Where:
- `presence_weight` = 1 if game is present, 0 if absent
- `weight` = `concept.quality_score.overall` if quality_score exists, else 1.0 (fallback per RFC-0009 graceful degradation)

**Aggregation across multiple sensations**: The final game score is the **arithmetic mean** of per-sensation scores. This is deterministic, explainable, and gives equal importance to each requested sensation. Example: for `[dread, discovery]`, final_score = (dread_score + discovery_score) / 2.

### D2: recommend_games MCP tool

New MCP tool `recommend_games`:
- **Input**: `sensations: string[]` (required), `limit?: number` (default 10), `min_score?: number` (default 0.1)
- **Output**: ranked list of `{ source_id, score, matched_patterns, matched_primitives, rationale }`
- **readOnly**: true

### D3: /recommend web page

New Astro page `apps/web/src/pages/recommend.astro`:
- Sensation selector (checkboxes for 15 sensations from `SENSATION_MAP`)
- Results section showing ranked game cards with:
  - Game name and score (as percentage)
  - Matched patterns (with links to `/records/{key}/`)
  - Matched primitives (with links)
  - Rationale text explaining the match
- All computation at build time — serialize sensation map and game presence data, compute scores client-side on sensation selection

### D4: Rationale generation

Rationale is **template-based** (same pattern as RFC-0013's `why_relevant` template fallback). No LLM required — the rationale is deterministic and explainable.

Template:
```
"{game} scores {score_percent}% for [{sensations}] because it implements {matched_pattern_titles} 
({matched_pattern_details}). {matched_count} of {total_count} relevant patterns are present."
```

Where:
- `game` — source_id (e.g., "nethack")
- `score_percent` — `Math.round(final_score * 100)`
- `sensations` — comma-joined requested sensations
- `matched_pattern_titles` — comma-joined titles of patterns where game is in `games_where_present`
- `matched_pattern_details` — for each matched pattern: `"pattern: {primitive1} + {primitive2} + ..."`
- `matched_count` — number of relevant concepts (patterns + primitives) present in the game
- `total_count` — total number of relevant concepts for the requested sensations

If no patterns match (only primitives), the template omits the pattern clause:
```
"{game} scores {score_percent}% for [{sensations}] based on {matched_count} of {total_count} relevant design primitives."
```

### D5: Fallback for unknown sensations

If a sensation is not in `SENSATION_MAP`, use `searchDesignSpace` (RFC-0010) to find relevant concepts by semantic search, then proceed with the same scoring algorithm.

## Architectural fit

- **Read-only**: No canonical mutations — recommendation is a pure projection
- **Reuses existing data**: `SENSATION_MAP`, quality scores, pattern game presence, `searchDesignSpace`
- **MCP + web parallel**: Same as RFC-0013 — MCP tool for programmatic access, web page for interactive use
- **No new dependencies**: All computation uses existing data and tools

## Design

### TypeScript contracts

```typescript
// D2: MCP tool input
interface RecommendGamesInput {
  sensations: string[];        // required — e.g. ["dread", "discovery"]
  limit?: number;              // default 10
  min_score?: number;          // default 0.1
}

// D2: MCP tool output item
interface RecommendationItem {
  source_id: string;           // e.g. "nethack"
  score: number;               // 0..1, arithmetic mean of per-sensation scores
  matched_patterns: Array<{ key: string; title: string }>;
  matched_primitives: Array<{ key: string; title: string }>;
  rationale: string;           // template-generated per D4
}

// D3: Web app build-time data
interface RecommendationData {
  sensations: Array<{ key: string; label: string }>;
  games: Array<{ source_id: string; display_name: string }>;
  concepts: Array<{
    key: string;
    concept_type: string;
    title: string;
    quality_score: { overall: number } | null;
    games_where_present: string[];  // for patterns
    ancestry: { source_games: string[] };  // for primitives/pressures
  }>;
  sensationMap: Record<string, { pressures: string[]; primitives: string[]; patterns: string[] }>;
}
```

### Edge cases

- **Missing `quality_score`**: Use weight = 1.0 (fallback per RFC-0009). The concept still contributes to the score — it just has no quality weighting.
- **Game with no matching concepts**: Score = 0. Filtered out by `min_score` (default 0.1). Not included in results.
- **Unknown sensation not in `SENSATION_MAP`**: Fallback to `searchDesignSpace` (D5). If semantic search returns no results, the sensation contributes 0 to all games.
- **Empty sensations array**: Return empty result with message "No sensations selected."
- **Concept key in `SENSATION_MAP` not found in store**: Skip the key, log a warning. The conformance test validates that all `SENSATION_MAP` keys resolve to existing concept records.
- **All sensations unknown**: All fall back to semantic search. If none return results, return empty list.

## Rollout

**Default behavior**: All new tools and pages are immediately available upon implementation. No feature flags, no gradual rollout.

**Adoption path**: No migration needed — `recommend_games` is additive (existing tools unchanged). The `/recommend` page is a new route. The next `pnpm materialize` run is not required — recommendation uses existing concept data already in the materialized store.

**Implementation steps**:

1. Add `recommendGames()` to `apps/mcp/src/tools/derived.ts` — follows the established pattern of domain-related tools in `derived.ts` (alongside `generateDesignSeed`, `findDesignPatterns`, `searchDesignSpace`)
2. Register `recommend_games` in `server.ts` and add to `REQUIRED_TOOLS`
3. Create `apps/web/src/lib/recommend.ts` — `buildRecommendationData(store)` and `computeRecommendations(data, sensations)`
4. Create `apps/web/src/pages/recommend.astro` — sensation selector + results (with `MODULE_CONTRACT` and `CHANGE_SUMMARY` comments per `apps/web/AGENTS.md`)
5. Add "Recommend" to navigation in `Base.astro`
6. Add conformance test `tests/conformance/c16-game-recommender.test.ts` verifying tool registration, output shape, and fallback for unknown sensations

## Risks

- **Sensation map completeness**: 15 sensations may not cover all user needs. Mitigation: semantic search fallback (D5) handles unknown sensations.
- **Sensation map drift**: If concept keys are renamed, `SENSATION_MAP` keys may become stale. Mitigation: conformance test validates that all `SENSATION_MAP` keys resolve to existing concept records (same as RFC-0013).
- **Subjectivity of mapping**: Which concepts create "dread" is subjective. Mitigation: `SENSATION_MAP` is curated content reviewed by a human; the scoring algorithm is deterministic given the map.
- **Small game count**: With only 4 games, recommendations may seem trivial. Mitigation: the rationale explains *why* each game matches, which is valuable even with few games. The algorithm scales as new games are added to the knowledge base.
- **Client-side data size**: With 4 games, 10 patterns, 15 primitives, 31 pressures — the serialized recommendation data is <10KB. Negligible for page load.
- **Agent misinterpretation**: Agents may treat recommendation scores as authoritative quality assessments. Mitigation: scores are relative to requested sensations, not absolute game quality. The rationale text makes this clear.

## Alternatives considered

- **Collaborative filtering** — requires user interaction data we don't have. Content-based is sufficient.
- **LLM-based recommendation** — unnecessary; the scoring algorithm is deterministic and explainable. LLM would add cost and latency without improving quality for 4 games.
- **External recommendation service** — over-engineered for 4 games; in-process computation is instant.
- **Separate `recommend.ts` file in MCP** — rejected: all 29 existing tool functions are in domain-specific files (`derived.ts`, `design.ts`, `records.ts`, etc.). `derived.ts` already contains `generateDesignSeed`, `findDesignPatterns`, `searchDesignSpace` — the same design-space domain. Adding `recommendGames` to `derived.ts` follows the established pattern.

## Implementation notes for agents

- **Status gate**: This RFC must be in `accepted` status before implementation begins. Use `fo-idea-plan` to create the implementation plan and transition to `accepted`.
- **MODULE_CONTRACT**: New files in `apps/web/` (`recommend.ts`, `recommend.astro`) must include `MODULE_CONTRACT` and `CHANGE_SUMMARY` comments per `apps/web/AGENTS.md`.
- **MCP tool convention**: `recommend_games` must be read-only (`readOnly: true`) and registered with a JSON schema in `server.ts`. Add to `REQUIRED_TOOLS` array.
- **Tool placement**: Add `recommendGames()` to `apps/mcp/src/tools/derived.ts` — do NOT create a separate `recommend.ts` file. All design-space tools are in `derived.ts`.
- **No canonical modifications**: This RFC does not create, modify, or delete any records in `knowledge/`. It is purely a consumer of existing concept data.
- **SENSATION_MAP reuse**: Use the existing `SENSATION_MAP` from `apps/mcp/src/tools/sensation-map.ts` (MCP) and `apps/web/src/lib/sensation-map.ts` (web). Do NOT create a new sensation map — the recommender reuses the same curated mapping from RFC-0013.
- **Quality score fallback**: When `quality_score` is `null` (concept materialized before RFC-0009), use weight = 1.0. Do not skip concepts without scores.
- **Rationale is template-based**: Do NOT use LLM for rationale generation. Use the template in D4. This is consistent with RFC-0013's template fallback pattern.
- **Progressive enhancement**: The `/recommend` page must degrade gracefully without JS — show a message asking the user to enable JS, or provide a fallback link to `/laboratory`.
- **CI gates**: All CI checks must pass — `pnpm materialize`, `pnpm exec turbo run build:check`, `pnpm exec vitest --run`.
- **Content vs code**: `SENSATION_MAP` is curated content from RFC-0013 — an agent writes the code structure, but the sensation-to-concept associations were reviewed by a human.
- **Validate**: Run `pnpm exec forge rfc.validate --id RFC-0016 --json` after changes to verify no mechanical violations.

## Acceptance criteria

- [ ] `recommend_games` MCP tool returns ranked games for given sensations (e.g., `recommend_games({ sensations: ["dread"] })` returns a non-empty array with `source_id`, `score`, `matched_patterns`, `matched_primitives`, `rationale`)
- [ ] Tool is in `REQUIRED_TOOLS` and read-only (`readOnly: true` in `server.ts`)
- [ ] `/recommend` page lets users select sensations via checkboxes and see ranked results client-side
- [ ] Each recommendation includes matched patterns (with titles), matched primitives (with titles), and template-generated rationale per D4
- [ ] Unknown sensations (e.g., "boredom") fall back to `search_design_space` — verified by conformance test with a sensation not in `SENSATION_MAP`
- [ ] Missing `quality_score` fallback works — concepts with `quality_score: null` use weight = 1.0
- [ ] Conformance test `tests/conformance/c16-game-recommender.test.ts` verifies tool registration, output shape, and unknown-sensation fallback
