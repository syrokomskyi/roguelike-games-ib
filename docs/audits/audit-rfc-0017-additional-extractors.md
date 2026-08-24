---
rfcId: RFC-0017
auditId: AUDIT-RFC-0017-01
date: 2026-08-24
auditor:
  skill: fo-idea-audit
  model: claude-sonnet-4-20250514
verdict: rejected
---

# Audit: RFC-0017

## Verdict: Rejected

RFC-0017 proposes extracting 12 data types (6 NetHack, 6 Cataclysm-BN) that are **already fully extracted and passing conformance tests**. The RFC's core premise is factually incorrect — all proposed work was completed as part of RFC-0006 and earlier PLAN-002 work. The RFC is obsolete on arrival.

## Mechanical validation (rfc.validate)

**Fail** — 4 V-13 violations (warnings):
- Missing required section `## Design`
- Missing required section `## Alternatives considered`
- Missing required section `## Risks`
- Missing required section `## Implementation notes for agents`

## Axis A — Structural completeness

- **Missing sections**: `## Design`, `## Alternatives considered` (the RFC has `## Alternatives` instead of `## Alternatives considered`), `## Risks`, `## Implementation notes for agents` — all required by V-13.
- **Decision** is not a single decision in present tense — it is a task list (D1–D5) describing work to be done, not a policy or architectural decision.
- **Rollout** describes implementation steps, not a default behavior or adoption path.
- **Acceptance criteria** are checkable but moot — all items are already satisfied by existing code.

## Axis B — DNA alignment

- `satisfies: []` — no DNA invariants declared. Not necessarily required for a policy RFC, but the RFC does not explain how it relates to any existing invariants.
- No conflicts with existing DNA invariants — the RFC is additive in nature.

## Axis C — Ecosystem fit

- **Package boundaries**: `packagesImpacted` lists `extractors/nethack-extractor` and `extractors/cataclysm-bn-extractor` — both packages exist under `packages/extractors/` per AGENTS.md rules. Correct.
- **RFC-0001 alignment**: The RFC claims to follow RFC-0001 methodology. This is correct in principle but moot since the work is already done.
- **Related RFCs**: Lists `RFC-0001`, `RFC-0006`, `RFC-0008`, `PLAN-002`. RFC-0006 (status: implemented) already completed all 12 proposed data types. The RFC does not acknowledge this.

## Axis D — Forward-only compliance

- No backward compatibility layers proposed. No issues.

## Axis E — Agent-facing policy

- **Status gate**: The RFC is in `draft` status. It does not contain self-authorizing language. No issues.
- **Factual accuracy**: The RFC's problem statement is factually incorrect:
  - Line 54: "NetHack has only 4 data types extracted (monsters, items, objects, features)" — **false**. The nethack extractor has 10 record kinds: `creature`, `item`, `artifact`, `trap`, `class`, `species`, `branch`, `skill`, `damage_type`, `ability` (evidence: `packages/extractors/nethack-extractor/src/extractor.ts:61`).
  - Line 55: "Cataclysm-BN has limited data types — missing bionics, traps, recipes, skills, effects, and factions" — **false**. The cataclysm-bn extractor has 12 record kinds including all listed: `creature`, `item`, `mutation`, `profession`, `ability` (bionics), `trap`, `recipe`, `skill`, `effect`, `faction`, `npc`, `spawn_table` (evidence: `packages/extractors/cataclysm-bn-extractor/src/extractor.ts:60`).
  - Line 50: "12 tasks remain: 6 for NetHack and 6 for Cataclysm-BN" — **false**. All 12 tasks are complete per coverage files and RFC-0006 acceptance criteria.
- **NEEDS CLARIFICATION markers**: No unresolved markers found.

## Axis F — Pragmatism

- **Scope discipline**: The RFC proposes work that is already done. This is the ultimate pragmatism failure — zero value, zero effort should be spent.
- **Existing patterns**: The RFC references `C-struct-parser.ts` — the actual file is `c-parser.ts` and `extra-parsers.ts` in the nethack extractor. The RFC did not verify the actual file names.

## Axis G — Blind spots

- **Performance**: Not applicable — no new work proposed.
- **Edge cases**: The RFC does not consider that source files may have changed since the original extraction. If the RFC were somehow implemented, it would overwrite existing records with potentially stale or duplicate data.
- **Migration path**: Not applicable — no migration needed since work is done.

## Evidence of prior completion

### NetHack (all 6 tasks already done)

| Task | RFC-0017 claim | Actual state | Evidence |
|---|---|---|---|
| N-1: artifacts | Missing | 33 records, `exhaustive_for_binding` | `extractor.ts:78-82`, `extra-parsers.ts:76-123`, `coverage/nethack.jsonl` |
| N-2: traps | Missing | 25 records, `exhaustive_for_binding` | `extractor.ts:83-88`, `extra-parsers.ts:144-176`, `coverage/nethack.jsonl` |
| N-3: roles | Missing | 13 records, `exhaustive_for_binding` | `extractor.ts:89-94`, `extra-parsers.ts:193-265`, `coverage/nethack.jsonl` |
| N-4: races | Missing | 5 records, `exhaustive_for_binding` | `extractor.ts:95-100`, `extra-parsers.ts:280-342`, `coverage/nethack.jsonl` |
| N-5: dungeon branches | Missing | 9 records, `exhaustive_for_binding` | `extractor.ts:101-106`, `extra-parsers.ts:355-427`, `coverage/nethack.jsonl` |
| N-6: skills | Missing | 37 records, `exhaustive_for_binding` | `extractor.ts:107-112`, `coverage/nethack.jsonl` |

### Cataclysm-BN (all 6 tasks already done)

| Task | RFC-0017 claim | Actual state | Evidence |
|---|---|---|---|
| CB-1: bionics | Missing | 137 records, `exhaustive_for_binding` | `extractor.ts:88-93`, `extra-json-parsers.ts:32-53`, `coverage/cataclysm-bn.jsonl` |
| CB-2: traps | Missing | 50 records, `exhaustive_for_binding` | `extractor.ts:94-99`, `extra-json-parsers.ts:73-94`, `coverage/cataclysm-bn.jsonl` |
| CB-3: recipes | Missing | 3187 records, `exhaustive_for_binding` | `extractor.ts:100-105`, `extra-json-parsers.ts:114-135`, `coverage/cataclysm-bn.jsonl` |
| CB-4: skills | Missing | 28 records, `exhaustive_for_binding` | `extractor.ts:106-111`, `extra-json-parsers.ts:149-164`, `coverage/cataclysm-bn.jsonl` |
| CB-5: effects | Missing | 237 records, `exhaustive_for_binding` | `extractor.ts:112-117`, `extra-json-parsers.ts:179-195`, `coverage/cataclysm-bn.jsonl` |
| CB-6: factions | Missing | 71 records, `exhaustive_for_binding` | `extractor.ts:118-123`, `extra-json-parsers.ts:221-277`, `coverage/cataclysm-bn.jsonl` |

### RFC-0006 acceptance criteria (implemented)

RFC-0006 (status: `implemented`) explicitly lists all Cataclysm-BN data types (bionics, traps, recipes, skills, effects, factions, martial arts, NPC classes, monster groups) and NetHack data types (artifacts, traps, roles, races, branches, skills, attack types, monster abilities) as extracted with passing conformance tests.

## Questions for the author

1. Why does the RFC claim NetHack has "only 4 data types extracted" when the extractor has 10 record kinds? Did you inspect the actual extractor code before writing this RFC?
2. Why does the RFC not reference RFC-0006 (status: implemented) which already completed all 12 proposed tasks?
3. What new data types, if any, are actually missing from either extractor that would justify a new RFC?
