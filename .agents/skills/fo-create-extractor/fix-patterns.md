<!-- knowledge-layer: L1 -->
# Fix Patterns

Recurring error patterns encountered when writing extractors, and their fixes.

### K-0001: Off-by-one in population denominator due to sentinel entries

```knowledge-entry
id: K-0001
layer: L1
created: 2026-08-21
status: active
```

**Situation:** The population `expected` count is one (or more) higher than the actual extracted count because sentinel/terminator entries were included in the count (e.g., `NUMMONS`, `NUMBER_MONSTER_KINDS`, `MK_YOU`).

**Action:** When counting entries in C arrays, explicitly identify and exclude sentinel entries. Document which entries are excluded in the population `description` field. Verify the count by running the parser and comparing `extracted` vs `expected` before finalizing.

### K-0002: Missing evidence for staged records

```knowledge-entry
id: K-0002
layer: L1
created: 2026-08-21
status: active
```

**Situation:** Records are staged via `ctx.output.writeRecord()` but no evidence anchor is created, causing the evidence coverage quality check to fail.

**Action:** After every `writeRecord()`, call `ctx.evidence.create()` with the source file path and locator, then `ctx.output.writeEvidence(resolved.id, evidence)`. Every record must have at least one evidence anchor.

### K-0003: Non-deterministic output from unsorted iteration

```knowledge-entry
id: K-0003
layer: L1
created: 2026-08-21
status: active
```

**Situation:** The extractor produces different record ordering on repeated runs because `ctx.source.walk()` returns files in filesystem order, which may vary.

**Action:** Sort file lists before processing. Sort parsed entries by a stable key (e.g., `nativeId`) before writing records. The `walk()` method already sorts results, but JSON parsing within files may need explicit sorting.

### K-0004: Wrong extractorId in run result

```knowledge-entry
id: K-0004
layer: L1
created: 2026-08-21
status: active
```

**Situation:** The `ExtractorRunResult.extractorId` is set to `ctx.binding.source_id` instead of the manifest's `extractorId`, causing hash mismatches in determinism checks.

**Action:** Use the manifest's `extractorId` in the run result, not the source binding's `source_id`. The source_id goes into record envelopes, not the run result.
