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

### K-0005: Population denominator lower than extracted count (undercount)

```knowledge-entry
id: K-0005
layer: L1
created: 2026-08-21
status: active
```

**Situation:** The quality contour Q-002 reports `extracted > expected` — the extractor produces more records than the manifest declares. This was found in the nethack extractor (expected 430, extracted 458).

**Action:** Investigate whether the parser is extracting extra entries (e.g., sentinel entries not filtered, duplicate parsing across files, or entries from a different array being counted). Alternatively, the `expected` denominator may be outdated if the source repository was updated. Re-count the source entries manually and update `exhaustivePopulations` in the manifest. Run the quality test to confirm `extracted == expected`.

### K-0006: Duplicate records from multi-file source data

```knowledge-entry
id: K-0006
layer: L1
created: 2026-08-21
status: active
```

**Situation:** The quality contour Q-007 reports duplicate record keys and native_ids. This was found in the cataclysm-bn extractor: 52 items (battery, money, thread, soap, rock, etc.) appear in multiple JSON files with the same `id` field, causing duplicate records.

**Action:** When parsing JSON data from multiple files, items may be defined in more than one file (e.g., `items/tools.json` and `items/items.json` both define `battery`). Deduplicate by `native_id` before writing records — keep the first occurrence or merge fields. Alternatively, namespace the `native_id` with the source file path (e.g., `items/tools.json:battery`) if the duplicates are genuinely different items.

### K-0007: Category names used as native_ids for individual items

```knowledge-entry
id: K-0007
layer: L1
created: 2026-08-21
status: active
```

**Situation:** The quality contour Q-007 reports massive duplication (×71, ×86, ×28) of category-level keys like `weapon:`, `armor:`, `ring:`. This was found in the nethack extractor: the C parser uses enum category labels (e.g., `WEAPON`, `ARMOR`) as `native_id` for all items in that category, instead of using the individual item's identifier.

**Action:** Each record must have a unique `native_id` that identifies the specific item, not its category. For C enum-based parsers, use the enum member name (e.g., `elven_dagger`, `dwarvish_mithril_coat`) as the `native_id`, not the enum type name. If individual names are not available in the source, derive them from the description or display name field.

### K-0008: Double-escaped backslashes in JS regex literals

```knowledge-entry
id: K-0008
layer: L1
created: 2026-08-21
status: active
```

**Situation:** Preprocessor directive regex patterns in `parseObjects()` used `\\s` and `\\b` instead of `\s` and `\b`. In a JS regex literal (e.g., `/^#if\\s+0\\b/`), `\\s` matches a literal backslash + `s`, not whitespace. This caused `#if 0` blocks to never be skipped, leaking extra entries into the output (458 items instead of correct count) and producing massive duplicates with empty `nativeId` values.

**Action:** When writing regex literals in JS, use single backslash for escape sequences: `\s`, `\b`, `\d`, `\w`. Double backslashes (`\\s`) are only needed in string arguments passed to `new RegExp()`. Always test preprocessor directive handling with a known `#if 0` block to verify it is correctly skipped.
