# Extractor Quality Test Contour

Universal quality checks for game-specific extractors. Governed by ADR-0003.

## Purpose

This directory contains a reusable test harness (`harness.ts`) that validates any extractor against six quality dimensions. Agents creating new extractors import the harness and create a `<game>-quality.test.ts` file that plugs in their extractor.

## Quality dimensions

| ID | Dimension | What it checks |
| --- | --- | --- |
| Q-001 | Determinism | Two runs produce identical normalized hashes |
| Q-002 | Population completeness | `extracted == expected` for every declared population dimension |
| Q-003 | Evidence coverage | Every staged record has at least one evidence anchor |
| Q-004 | Schema validation | All records pass schema facade validation (or diagnostics emitted) |
| Q-005 | Record loss | No unexpected record loss vs previous run (threshold-based) |
| Q-006 | Performance | Extractor completes within a configurable time budget |

## Usage

Create `<game>-quality.test.ts` in this directory:

```typescript
import { describe } from "vitest";
import { runQualityChecks } from "./harness.ts";
import { createGameExtractor } from "@roguelike-games-ib/<game>-extractor";
import {
  ReadonlySourceReader,
  EvidenceFactory,
  CandidateWriter,
  createNullSchemaFacade,
  createExtractorContext,
  RefreshIdentityResolver,
} from "@roguelike-games-ib/extractor-sdk";
import { createSourceBinding } from "@roguelike-games-ib/knowledge-core";
import { resolve } from "node:path";

const SOURCE_ROOT = resolve(__dirname, "../../<game-source-path>");

function createContext() {
  const binding = createSourceBinding(/* ... */);
  const source = new ReadonlySourceReader(SOURCE_ROOT);
  const evidence = new EvidenceFactory(/* ... */);
  const ids = new RefreshIdentityResolver([], [], "<game>");
  const schemas = createNullSchemaFacade();
  const output = new CandidateWriter(/* ... */);
  return createExtractorContext(source, binding, schemas, evidence, ids, output);
}

describe("<game> extractor quality", () => {
  runQualityChecks(createGameExtractor(), createContext, {
    sourceId: "<game>",
    sourceRoot: SOURCE_ROOT,
    timeBudgetMs: 10000,
  });
});
```

## Relationship to other test directories

- `tests/extract/` — tests the extractor SDK itself (EXT-001..010)
- `tests/conformance/` — game-specific conformance trials against real source (C10..C12)
- `tests/extractor-quality/` — **this directory** — reusable quality contour for any extractor
