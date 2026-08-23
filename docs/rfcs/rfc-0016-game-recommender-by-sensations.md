---
id: RFC-0016
title: "Game recommender by sensations — match player preferences to game design profiles"
status: draft
kind: policy
scope: workspace
owners:
  - architecture
reviewers:
  - human:andrii-syrokomskyi
createdAt: 2026-08-24
updatedAt: 2026-08-24
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
score = Σ(concept.quality_score.overall × presence_weight) / Σ(concept.quality_score.overall)
```
Where `presence_weight` = 1 if game is present, 0 if absent.

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

For each recommendation, generate a human-readable rationale:
```
"NetHack scores 87% for [dread, discovery] because it implements Knowledge Through Risk 
(pattern: identification_system + permadeath + procedural_generation) and Escalating Threat 
(pattern: permadeath + procedural_generation). 3 of 3 relevant patterns are present."
```

### D5: Fallback for unknown sensations

If a sensation is not in `SENSATION_MAP`, use `searchDesignSpace` (RFC-0010) to find relevant concepts by semantic search, then proceed with the same scoring algorithm.

## Architectural fit

- **Read-only**: No canonical mutations — recommendation is a pure projection
- **Reuses existing data**: `SENSATION_MAP`, quality scores, pattern game presence, `searchDesignSpace`
- **MCP + web parallel**: Same as RFC-0013 — MCP tool for programmatic access, web page for interactive use
- **No new dependencies**: All computation uses existing data and tools

## Rollout

1. Create `apps/mcp/src/tools/recommend.ts` — `recommendGames` function
2. Register `recommend_games` in `server.ts` and add to `REQUIRED_TOOLS`
3. Create `apps/web/src/lib/recommend.ts` — `buildRecommendationData(store)` and `computeRecommendations(data, sensations)`
4. Create `apps/web/src/pages/recommend.astro` — sensation selector + results
5. Add "Recommend" to navigation in `Base.astro`
6. Add conformance test verifying tool registration and output shape

## Alternatives

- **Collaborative filtering** — requires user interaction data we don't have. Content-based is sufficient.
- **LLM-based recommendation** — unnecessary; the scoring algorithm is deterministic and explainable.
- **External recommendation service** — over-engineered for 4 games; in-process computation is instant.

## Acceptance criteria

- [ ] `recommend_games` MCP tool returns ranked games for given sensations
- [ ] Tool is in `REQUIRED_TOOLS` and read-only
- [ ] `/recommend` page lets users select sensations and see ranked results
- [ ] Each recommendation includes matched patterns, primitives, and rationale
- [ ] Unknown sensations fall back to semantic search
- [ ] Conformance test verifies tool registration and output shape
