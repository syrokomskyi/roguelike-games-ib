---
name: fo-create-extractor
description: Guides an agent through creating a game-specific knowledge extractor — source analysis, parser implementation, population denominators, quality testing, and self-verification.
invocation: user
category: wg
concerns: code-mutation
dependsOn: ['my-preferences']
languagePolicy: ref(PREFERENCES.md)
knowledge:
  - qa-log.md
  - fix-patterns.md
  - learned-principles.md
triggers: ["create extractor", "write a new extractor", "add extractor for game", "create game extractor"]
---

# fo-create-extractor

Guides an agent through the full workflow of creating a game-specific knowledge extractor under `packages/extractors/`. The skill codifies the patterns learned from writing the nethack, broguece, and cataclysm-bn extractors.

Read declared knowledge files at the start of each run, in declaration order. Apply only entries with `status: active`. Skip entries with `status: stale`, `superseded`, or `archived`.

## When to invoke

- The operator asks to create a new extractor for a roguelike game
- A new game source is registered in the knowledge base and needs an extractor
- The operator says "create extractor", "write extractor for X", or similar

## Prerequisites

- The game source must be registered in `knowledge/sources/registry.yaml`
- A source binding must exist in `knowledge/sources/bindings.yaml`
- The `extractor-sdk` package must be up to date

## Process

### 1. Read preferences and knowledge

Read `PREFERENCES.md` at the repository root. Use `aiLanguage` for all communication.

Read declared knowledge files (`qa-log.md`, `fix-patterns.md`, `learned-principles.md`). Apply active entries.

### 2. Analyze the game source

Examine the game's source repository to understand its data format:

- **C/C++ games** (e.g., NetHack, BrogueCE): look for header files with struct/array definitions (`monsters.h`, `objects.h`, `Globals.c`). Data is embedded in C source as struct initializers.
- **JSON-based games** (e.g., Cataclysm-BN): look for JSON data directories (`data/json/monsters/`, `data/json/items/`). Data is in structured JSON files.
- **Other formats**: Lua tables, CSV, custom DSLs — adapt the parser accordingly.

Identify the record kinds the game exposes. Common kinds from existing extractors:
- `creature` — monsters, NPCs, enemies
- `item` — weapons, armor, consumables, tools
- `terrain` — tile types, floor/wall definitions
- `mutation` — character mutations/abilities
- `profession` — character classes/backgrounds

For each record kind, identify:
1. Which source files contain the data
2. What format the data is in
3. How many entries exist (the population denominator)

### 3. Estimate population denominators

For each record kind, count the exact number of entries in the source. This becomes the `expected` value in `exhaustivePopulations`.

Methods:
- **C arrays**: count struct initializer entries (e.g., `MON(...)` calls in `monsters.h`), excluding sentinel/terminator entries (e.g., `NUMMONS`, `MK_YOU`, `NUMBER_MONSTER_KINDS`)
- **JSON files**: count objects with unique `id` fields across all files in the relevant directories
- **Manual count**: if automated counting is unreliable, count manually and document the method in the population description

**Critical**: always exclude sentinel/terminator entries. This is the most common source of off-by-one errors in population denominators.

### 4. Create the extractor package

Create a new package under `packages/extractors/<game-name>-extractor/` with this structure:

```
packages/extractors/<game-name>-extractor/
  package.json
  tsconfig.json
  src/
    index.ts        — public exports
    extractor.ts    — Extractor interface implementation
    <format>-parser.ts  — game-specific parser (e.g., c-parser.ts, json-parser.ts)
```

**package.json**: copy from an existing extractor, change the name to `@roguelike-games-ib/<game-name>-extractor`.

**tsconfig.json**: copy from an existing extractor.

**src/index.ts**: export the factory function, manifest, and parser functions (for conformance testing).

**src/extractor.ts**: implement the `Extractor` interface:

1. Define the manifest with `schema: "werkstatt/knowledge-extractor@1"`, unique `extractorId`, `recordKinds`, and `exhaustivePopulations`
2. Implement `run(ctx)`:
   - Read source files via `ctx.source.readText()` or `ctx.source.parseJson()`
   - Parse entries using the parser module
   - For each entry: resolve identity via `ctx.ids.resolveOrCreate()`, build a record envelope, write via `ctx.output.writeRecord()`
   - Create evidence anchors via `ctx.evidence.create()` and write via `ctx.output.writeEvidence()`
   - Write population counts via `ctx.output.writePopulation()`
   - Return `ExtractorRunResult` with counts and diagnostics

**src/<format>-parser.ts**: implement the parser. This is the most game-specific part. See existing parsers for patterns:
- `c-parser.ts` (nethack, broguece): regex-based extraction from C source
- `json-parser.ts` (cataclysm-bn): JSON parsing with type narrowing

### 5. Record envelope pattern

Every record must include the standard envelope fields. Use this pattern:

```typescript
function makeRecordEnvelope(sourceId, key, id, originActorId) {
  return {
    schema: "rgkb/game-definition@2",
    id,
    key,
    record_type: "definition",
    language: "en",
    scope: { source_id: sourceId, scope_kind: "source" as const },
    origin: { kind: "extractor" as const, actor_id: originActorId, run_id: null },
    epistemic: { status: "observed" as const, confidence: "verified" as const },
    aliases: [] as string[],
  };
}
```

### 6. Evidence pattern

Every record must have at least one evidence anchor. For C source, include line numbers:

```typescript
const evidence = ctx.evidence.create({
  artifactPath: SOURCE_FILE,
  locator: {
    symbol: ARRAY_NAME,
    line_start: entry.lineStart,
    line_end: entry.lineEnd,
    byte_start: null,
    byte_end: null,
    data_key: entry.nativeId,
  },
  fragmentLines: { lineStart: entry.lineStart, lineEnd: entry.lineEnd },
});
ctx.output.writeEvidence(resolved.id, evidence);
```

For JSON source, line numbers may be null if the parser doesn't track them.

### 7. Create quality tests

Create `tests/extractor-quality/<game-name>-quality.test.ts` using the quality harness:

```typescript
import { describe } from "vitest";
import { runQualityChecks } from "./harness.ts";
import { createGameExtractor } from "@roguelike-games-ib/<game-name>-extractor";
// ... set up source binding, context factory ...

describe(`<game>-quality`, () => {
  runQualityChecks(extractor, createContext, {
    sourceId: "<game>",
    sourceRoot: SOURCE_ROOT,
    timeBudgetMs: 10000,
  });
});
```

The harness runs all six quality dimensions. See `tests/extractor-quality/harness.ts` for the full API.

### 8. Run quality tests

Run the quality tests and fix any failures:

```bash
pnpm exec vitest run tests/extractor-quality/<game-name>-quality.test.ts
```

Common failures and fixes — consult `fix-patterns.md` for known patterns.

### 9. Update knowledge

After completing the extractor, update knowledge files:

- **qa-log.md**: append any questions asked and answers given during this session
- **fix-patterns.md**: append any new recurring error patterns discovered
- **learned-principles.md**: append or confirm principles distilled from this session

### 10. Commit

```txt
extractor: add <game-name> extractor

Create <game-name> extractor with <N> record kinds and <M> population dimensions.
Quality tests pass all six dimensions.
```

## Constraints

- **Extractors are read-only.** Never use `exec`, `spawn`, `writeFile`, or any side-effecting API. Only use `ReadonlySourceReader` methods.
- **Deterministic.** The extractor must produce identical output on repeated runs. No timestamps, random values, or external state in records.
- **Static parsing only.** `parserMode: "static"` — no dynamic code execution.
- **All records need evidence.** Every staged record must have at least one evidence anchor pointing to the source artifact it was derived from.
- **Population denominators must be exact.** Off-by-one errors in `expected` counts cause quality test failures.
- **Exclude sentinel entries.** Terminator/sentinel entries in source arrays (e.g., `NUMMONS`, `NUMBER_MONSTER_KINDS`, `MK_YOU`) must not be counted as records.
- **Package location.** All extractors live under `packages/extractors/`. Never create extractors directly in `packages/`.
