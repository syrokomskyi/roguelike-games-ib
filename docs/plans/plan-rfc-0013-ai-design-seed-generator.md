---
id: PLAN-RFC-0013
title: "AI design seed generator (Laboratory) — sensation to structure dossier"
status: accepted
scope: project-wide
decider: architecture
reviewers:
  - human:andrii-syrokomskyi
related:
  - RFC-0013
  - RFC-0003
  - RFC-0009
  - RFC-0010
  - RFC-0011
created: 2026-08-23
accepted: 2026-08-23
implementedAt:
closedAt: null
---

# PLAN-RFC-0013: AI design seed generator (Laboratory) — sensation to structure dossier

## Context

RFC-0013 is accepted. The laboratory page (`/inspiration`) is a static mockup that redirects to `/ask`. This plan implements the RFC's 5 decisions (D1–D5) across 8 steps: sensation map, MCP tool, web page, tests, validation, review, and stamp.

## Objectives

1. Define `SENSATION_MAP` with 15 verified sensation entries mapping to actual concept keys
2. Add `generate_design_seed` MCP tool with optional LLM enhancement
3. Build `/laboratory` web page with client-side dossier generation from build-time concept data
4. Rename `/inspiration` → `/laboratory` and update all references (Base.astro, ask.astro, index.astro)
5. Add conformance test validating SENSATION_MAP keys resolve to existing concept records
6. All tests pass, `rfc.validate` passes

## Steps

### Step 1: Create sensation map (D1)

Create the `SENSATION_MAP` constant in two locations (MCP and web app).

**Actions**:
1. Create `apps/mcp/src/tools/sensation-map.ts`:
   - Export `SENSATION_MAP` constant with 15 entries from RFC D1
   - Export `SensationEntry` interface
   - All keys verified against `knowledge/concept/cross-game/concept/`
2. Create `apps/web/src/lib/sensation-map.ts`:
   - Same `SENSATION_MAP` constant and `SensationEntry` interface
   - Intentional duplication (no shared package between apps/mcp and apps/web)

**Files**: `apps/mcp/src/tools/sensation-map.ts` (new), `apps/web/src/lib/sensation-map.ts` (new)

**Completion criterion**: Both files exist, export `SENSATION_MAP` with 15 entries, all keys match actual concept files in `knowledge/concept/cross-game/concept/`.

### Step 2: Implement MCP `generate_design_seed` tool (D3, D4)

Add the dossier generation tool to the MCP server.

**Actions**:
1. Add `generateDesignSeed()` to `apps/mcp/src/tools/derived.ts`:
   - Import `SENSATION_MAP` from `./sensation-map.ts`
   - Look up sensation in `SENSATION_MAP` — fallback to `searchDesignSpace()` for unknown sensations
   - Retrieve relevant primitives, pressures, patterns by key from `ctx.store`
   - Filter out concepts matching excluded terms (keyword match on title/definition)
   - For each primitive, retrieve mutation vectors via `HAS_MUTATION_VECTOR` relations
   - For each mutation vector, retrieve knobs (concept_type `design_knob`)
   - Retrieve `concrete_examples` from primitive records (RFC-0011)
   - Build ancestry trail: primitive → mutation vector → knob
   - Retrieve design tensions via `tensions_with` relations involving relevant pressures
   - Return `DossierOutput` structure per RFC D2
   - Template `why_relevant`: `"{concept.title} contributes to {sensation} because it {concept.definition}"`
2. Add optional LLM enhancement:
   - When `OPENAI_API_KEY` is set in env, generate `why_relevant` via LLM
   - Cache in `systems-cache/llm-dossier-cache.json` keyed by `sensation+context`
   - Use `llmJson()` pattern from `scripts/run-stage-design.ts`
3. Register tool in `apps/mcp/src/server.ts`:
   - Import `generateDesignSeed` from `derived.ts`
   - Register with `readOnly: true`, JSON schema for input
   - Add `"generate_design_seed"` to `REQUIRED_TOOLS` array
4. Update `MODULE_CONTRACT` and `CHANGE_SUMMARY` comments in `derived.ts`
5. Export `generateDesignSeed` from `apps/mcp/src/index.ts`

**Files**: `apps/mcp/src/tools/derived.ts`, `apps/mcp/src/server.ts`, `apps/mcp/src/index.ts`

**Completion criterion**: `generate_design_seed` is registered in `REQUIRED_TOOLS`, has valid JSON schema, returns structured dossier for known sensations, falls back to embedding search for unknown sensations.

### Step 3: Build laboratory web page (D5)

Create the client-side dossier generation and rename the page.

**Actions**:
1. Create `apps/web/src/lib/laboratory.ts`:
   - Import `SENSATION_MAP` from `./sensation-map.ts`
   - Export `generateDossier()` function that takes sensation, context, excluded, and concept data
   - Returns `DossierOutput` structure (same as MCP tool, without LLM enhancement)
   - Filter concepts by excluded terms (keyword match on title/definition)
   - Build ancestry trail from concept data (primitive → mutation → knob)
   - Handle empty dossier edge case (all concepts filtered)
   - Include `MODULE_CONTRACT` and `CHANGE_SUMMARY` comments
2. Prepare concept data for client-side use:
   - In `laboratory.astro` frontmatter, use `createWebContext()` (same as other pages) to access `ProjectionStore`
   - Filter `store.records` for `record_type === "concept"` and extract needed fields
   - Serialize as inline JSON in a `<script type="application/json">` tag
   - Client-side JS reads this JSON and passes to `generateDossier()`
   - No separate build step or `concepts.json` file needed — follows existing pattern
3. Rename `apps/web/src/pages/inspiration.astro` → `apps/web/src/pages/laboratory.astro`:
   - Rewrite to accept form input (sensation + context + excluded)
   - Embed concept data as inline JSON (from ProjectionStore at build time)
   - Client-side JS generates dossier via `generateDossier()`
   - Render: primitives as cards with quality badges, mutation vectors as expandable sections, concrete examples as game-tagged quotes, ancestry trail as numbered steps, design tensions as paired statements
   - Progressive enhancement: form degrades to message without JS
   - Include `MODULE_CONTRACT` and `CHANGE_SUMMARY` comments per `apps/web/AGENTS.md`
4. Update nav link in `apps/web/src/layouts/Base.astro`:
   - Change `{ href: "/inspiration", ... }` to `{ href: "/laboratory", ... }`
5. Update `apps/web/src/pages/ask.astro`:
   - Change `href="/inspiration"` to `href="/laboratory"` (line 33)
   - Change `/inspiration?q=` to `/laboratory?q=` in JS (line 108)
6. Update `apps/web/src/pages/index.astro`:
   - Change `href: "/inspiration"` to `href: "/laboratory"` (line 21)
   - Change `href="/inspiration"` to `href="/laboratory"` (line 118)

**Files**: `apps/web/src/lib/laboratory.ts` (new), `apps/web/src/pages/laboratory.astro` (renamed from `inspiration.astro`), `apps/web/src/layouts/Base.astro`, `apps/web/src/pages/ask.astro`, `apps/web/src/pages/index.astro`

**Completion criterion**: `/laboratory` page generates and renders dossier client-side. All `/inspiration` references updated to `/laboratory`. No remaining `/inspiration` references in `apps/web/src/`.

### Step 4: Add conformance test (D1 verification)

Add test validating that all SENSATION_MAP keys resolve to existing concept records.

**Actions**:
1. Create `tests/conformance/c14-design-seed-generator.test.ts`:
   - Test that all keys in `SENSATION_MAP` (from `apps/mcp/src/tools/sensation-map.ts`) resolve to existing concept records in the materialized projection store
   - Test that `generateDesignSeed()` returns a dossier for known sensation "dread"
   - Test that `generateDesignSeed()` returns a dossier for unknown sensation (fallback)
   - Test that excluded mechanics are filtered (exclude "hunger" → no `design-hunger_clock` in results)
   - Test that empty dossier edge case is handled (exclude all relevant mechanics)

**Files**: `tests/conformance/c14-design-seed-generator.test.ts` (new)

**Completion criterion**: Test file exists, all tests pass, validates SENSATION_MAP key integrity.

### Step 5: Validation

Run full validation suite.

**Actions**:
1. Run `pnpm materialize` — regenerate knowledge base dist
2. Run `pnpm exec turbo run build:check` — TypeScript compilation
3. Run `pnpm exec vitest --run` — full test suite including new conformance test
4. Run `pnpm exec forge rfc.validate --id RFC-0013 --json` — RFC validation

**Completion criterion**: All commands pass with zero errors.

### Step 6: Evidence

Emit verification evidence.

**Actions**:
1. Run `pnpm exec forge rfc.verification.emit --id RFC-0013` (if available)
2. Capture output as evidence file

**Completion criterion**: Evidence file committed or verification output recorded.

### Step 7: Review and fix

Run `fo-review` on all session code changes. Apply `fo-fix` if findings.

**Completion criterion**: Review complete, all findings addressed.

### Step 8: Stamp implemented

Run `pnpm exec forge rfc.implement.stamp --id RFC-0013 --implementation-commit <sha>` to transition `accepted → implemented`.

**Completion criterion**: RFC-0013 status is `implemented`.

## Validation suite

| Check | Command | When |
|---|---|---|
| RFC validation | `pnpm exec forge rfc.validate --id RFC-0013 --json` | After all changes |
| TypeScript | `pnpm exec turbo run build:check` | After code changes |
| Tests | `pnpm exec vitest --run` | After all changes |
| Materialize | `pnpm materialize` | Before tests (if concept data changed) |

## Risk mitigations

| Risk | Mitigation step |
|---|---|
| SENSATION_MAP key drift | Step 4 conformance test validates keys at build time |
| Client-side data loading | Step 3 embeds concept data as inline JSON at build time via ProjectionStore (~50KB), no runtime fetch |
| LLM cost | D4 limited to MCP server only; web app uses template fallback |
| Sensation map subjectivity | Human review point: SENSATION_MAP is curated content, agent writes code structure only |
| Route rename breakage | Step 3 updates all 5 `/inspiration` references (Base.astro, ask.astro ×2, index.astro ×2) |
| Empty dossier edge case | Step 3 handles in `laboratory.ts` with user-facing message |

## Human review points

- **Step 1**: SENSATION_MAP content — sensation-to-concept associations are curated content requiring human review before final acceptance.
- **Step 3**: Laboratory page UX — dossier rendering and form interaction should be reviewed for usability.
