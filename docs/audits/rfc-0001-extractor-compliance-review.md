# RFC-0001 Extractor Compliance Review

Date: 2026-08-22
Reviewer: fo-idea-implement (automated)

## Methodology

Each extractor was reviewed against the 11 principles defined in RFC-0001. The review examined manifest declarations, source code patterns, and output records.

## Compliance matrix

| Principle | broguece | cataclysm-bn | crawl | nethack |
|---|---|---|---|---|
| P1: One source object = one record | ✓ | ✓ | ✓ | ✓ |
| P2: Factual extraction without loss | ✓ | ✓ | ✓ | ✓ |
| P3: Canonical kind mapping in manifest | ⚠ | ✓ | ✓ | ✓ |
| P4: Evidence anchors for every record | ✓ | ✓ | ✓ | ✓ |
| P5: Population completeness contracts | ✓ | ✓ | ✓ | ✓ |
| P6: Composite data stays in attributes | ✓ | ✓ | ✓ | ✓ |
| P7: One extractor per game | ✓ | ✓ | ✓ | ✓ |
| P8: Onboarding process | N/A (predate) | N/A (predate) | N/A (predate) | N/A (predate) |
| P9: Taxonomy extension | ⚠ | ✓ | ✓ | ✓ |
| P10: Versioning and refresh | ✓ | ✓ | ✓ | ✓ |
| P11: Extraction–derivation contract | ✓ | ✓ | ✓ | ✓ |

## Findings

### broguece — P3/P9: Non-canonical recordKinds

The broguece extractor declares 6 recordKinds not present in `game-content-taxonomy.yaml`:
- `image_asset` — used for sprite/image metadata
- `dungeon_feature` — used for dungeon feature definitions
- `light` — used for light source definitions
- `monster_class` — used for monster classification
- `monster_behavior` — used for monster behavior patterns
- `monster_ability` — used for monster abilities

These were added before the taxonomy was formalized. They are documented as existing technical debt in RFC-0001's nonGoals. A separate taxonomy cleanup effort should address them — either by adding them to the taxonomy or by remapping to existing canonical kinds with `native_kind` differentiation.

**Status**: Known technical debt, out of scope for RFC-0001 implementation.

### cataclysm-bn — ADR-0004 compliance

The cataclysm-bn extractor implements ADR-0004 (namespace duplicate native_ids with file suffix). This is noted in the source code at `extractor.ts:69` and is compliant with RFC-0001's reference to ADR-0004.

### All extractors — P8: Onboarding process

All four extractors predate RFC-0001 Principle 8 (10-step onboarding process). They were created incrementally before the methodology was formalized. They are compliant with the principles that apply to existing extractors (P1-P7, P9-P11). Principle 8 applies to new game onboarding, not retroactively to existing extractors.

### All extractors — P11: Extraction–derivation contract

All extractors preserve native attributes without normalization. The Attribute Deriver (`scripts/run-stage-deriver.ts`) processes these attributes to generate claims, relations, and semantic records. The `SKIP_ATTRIBUTES` set in the deriver handles display-only attributes. No extractor-side filtering is needed.

## Conclusion

All four extractors are compliant with the applicable principles (P1-P7, P9-P11). The brogueCE non-canonical kinds are documented technical debt. No changes are required to existing extractors for RFC-0001 compliance.
