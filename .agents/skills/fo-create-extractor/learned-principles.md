<!-- knowledge-layer: L2 -->
# Learned Principles

Concrete principles distilled from past extractor creation sessions.

### K-0001: Always verify population denominator by running the parser first

```knowledge-entry
id: K-0001
layer: L2
created: 2026-08-21
lastConfirmedAt: 2026-08-21
confirmations: 3
status: active
```

**Principle:** Before finalizing the `expected` count in `exhaustivePopulations`, run the parser independently and count the actual entries. Compare with the manually counted denominator. If they differ, investigate sentinel entries, parsing edge cases, or miscounted source files.

**Rationale:** Off-by-one errors in population denominators are the most common extractor bug. They cause quality test failures and undermine trust in the extraction coverage.

### K-0002: Sort all output by stable key for determinism

```knowledge-entry
id: K-0002
layer: L2
created: 2026-08-21
lastConfirmedAt: 2026-08-21
confirmations: 2
status: active
```

**Principle:** Sort parsed entries by `nativeId` (or another stable key) before writing records. Sort file lists before processing. Never rely on filesystem ordering or object key insertion order for determinism.

**Rationale:** The determinism quality check runs the extractor twice and compares normalized hashes. Any ordering variance causes a failure.

### K-0003: Export parser functions from index.ts for conformance testing

```knowledge-entry
id: K-0003
layer: L2
created: 2026-08-21
lastConfirmedAt: 2026-08-21
confirmations: 2
status: active
```

**Principle:** Export parser functions (e.g., `parseMonsters`, `parseObjects`) from the extractor's `index.ts` alongside the factory function. Conformance tests import these to validate parsing against real source files without going through the full extractor run.

**Rationale:** Conformance tests need direct access to parser functions to test edge cases and validate cardinality independently of the extractor harness.
