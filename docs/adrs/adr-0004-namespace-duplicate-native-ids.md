---
id: ADR-0004
title: Namespace duplicate native_ids with file suffix instead of skipping
status: implemented
scope: package
decider: architecture
reviewers:
  - human:andrii-syrokomskyi
related:
  - ADR-0003
created: 2026-08-21
accepted: 2026-08-21
implementedAt: 2026-08-21
closedAt: null
---

# ADR-0004: Namespace duplicate native_ids with file suffix instead of skipping

## Context

The Cataclysm-BN extractor parses JSON data files from multiple directories. Some items and mutations are defined in more than one JSON file with the same `id` field (e.g., `battery` appears in both `items/tools.json` and `items/items.json`). The quality contour Q-007 (record uniqueness) detected 52 duplicate item keys and 4 duplicate mutation keys.

Two strategies were considered:
1. **Skip duplicates** — keep only the first occurrence, discard subsequent ones.
2. **Namespace with file suffix** — keep all occurrences, append the source file path as a suffix to `native_id` (e.g., `battery__tools` vs `battery__items`).

## Decision

Use file-suffix namespacing for duplicate `native_id` values instead of skipping duplicate records.

## Justification

Skipping duplicates loses source coverage — the evidence anchor for the skipped file is never created, and the knowledge base has no trace of the duplicate definition. This is unacceptable for a factual extraction system whose goal is exhaustive source coverage.

Namespacing preserves all records and their evidence anchors while maintaining uniqueness. The `native_id` becomes `"<original_id>__<file_suffix>"` for duplicates (e.g., `battery__tools`, `battery__items`), where `file_suffix` is the source file path with `items/` prefix stripped, `.json` extension removed, and `/` replaced with `_`. The first occurrence keeps the original `native_id` unchanged.

The trade-off is that `native_id` no longer matches the source JSON `id` field exactly for duplicates. This is acceptable because:
- The `source_identity.path` field still records the original source file.
- The `source_identity.native_id` field contains the namespaced value, preserving traceability.
- Population counts remain unchanged (all entries are counted).

## Consequences

**Positive:**
- Full source coverage — no evidence anchors are lost.
- Q-007 (record uniqueness) passes — all `native_id` values are unique.
- Q-003 (evidence coverage) is complete — every record has evidence.

**Negative:**
- `native_id` for duplicates does not match the source JSON `id` field exactly.
- Downstream consumers must be aware that `native_id` may contain a `__<suffix>` component.

**Postponed:**
- A future enhancement could merge fields from duplicate definitions into a single record with multiple evidence anchors, but this requires a merge strategy and is out of scope for this ADR.

## Evolution

Revisit this decision if:
- A merge strategy for duplicate definitions is designed and implemented.
- The source data schema changes to guarantee unique `id` fields across files.
- Downstream consumers require `native_id` to exactly match the source JSON `id` field.
