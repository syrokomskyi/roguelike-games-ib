---
id: PLAN-001
title: First methodology-compliant extraction — Crawl vaults
status: implemented
scope: project-wide
decider: architecture
reviewers:
  - human:andrii-syrokomskyi
related:
  - RFC-0001
  - ADR-0005
created: 2026-08-22
accepted: 2026-08-22
implementedAt: 2026-08-22
closedAt: null
---

# PLAN-001: First methodology-compliant extraction — Crawl vaults

## Context

RFC-0001 acceptance criterion #7 requires: "First new extraction (Crawl vaults or Cataclysm-BN bionics) follows the methodology and passes conformance." This was deferred during RFC-0001 implementation. This plan defines the concrete steps to satisfy that criterion by extracting Crawl vaults.

Crawl vaults are defined in `.des` files under `dat/des/` — 144 files containing ~6,264 `NAME:` blocks. Each `NAME:` block defines a vault with properties like depth, weight, tags, monster placements, and map layout. The canonical kind is `vault` (category `world`), already present in the taxonomy.

This extraction follows RFC-0001 methodology:
- Principle 1: one `NAME:` block = one vault record
- Principle 2: attributes preserved as-is (tags, depth, weight, orient, chance, etc.)
- Principle 3: canonical kind `vault` declared in manifest
- Principle 4: evidence anchors point to `.des` file + line range of `NAME:` block
- Principle 5: population contract — expected count of `NAME:` blocks
- Principle 6: map layout and monster placements stay in attributes
- Principle 7: added to existing crawl extractor (one extractor per game)
- Principle 11: attributes preserved for deriver (tags, depth, weight → claims)

## Steps

### Step 1: Write .des parser

Create `packages/extractors/crawl-extractor/src/des-parser.ts`.

The parser must:
- Walk all `.des` files under `dat/des/` (excluding `test/` directory)
- For each file, split into `NAME:` blocks
- For each block, extract:
  - `nativeId` — the NAME value (slugified)
  - `filePath` — relative path to the .des file
  - `lineStart` / `lineEnd` — line range of the NAME: block
  - `depth` — DEPTH: directive value
  - `weight` — WEIGHT: directive value
  - `tags` — TAGS: directive value (array)
  - `orient` — ORIENT: directive value
  - `chance` — CHANCE: directive value
  - `mons` — MONS: directive value (array, if present)
  - `items` — ITEM: directive value (array, if present)
  - `map` — raw map text between MAP and ENDMAP (if present)

Parser interface:

```ts
export interface VaultEntry {
  nativeId: string;
  filePath: string;
  lineStart: number;
  lineEnd: number;
  depth: string | null;
  weight: number | null;
  tags: string[];
  orient: string | null;
  chance: number | null;
  mons: string[];
  items: string[];
  hasMap: boolean;
}
```

**Completion criterion**: `des-parser.ts` exists, exports `parseDesVaults(source: string, filePath: string): VaultEntry[]`, and correctly parses a sample `.des` file.

### Step 2: Write vault spec builder

Add `vaultSpec` to `extractor.ts`:

```ts
function vaultSpec(entries: VaultEntry[], sourcePath: string): EntitySpec<VaultEntry> {
  return {
    kind: "vault",
    entries,
    adapter: {
      nativeKind: "DES_VAULT",
      originActorId: "crawl-factual",
      getSourcePath: (e) => e.filePath,
      getSymbolName: (e) => e.nativeId,
      getSlug: (e) => e.nativeId,
      getNativeId: (e) => `vault:${e.nativeId}`,
      getCanonicalName: (e) => e.nativeId,
      getOriginalName: (e) => e.nativeId,
      getAttributes: (e) => ({
        depth: e.depth,
        weight: e.weight,
        tags: e.tags,
        orient: e.orient,
        chance: e.chance,
        mons: e.mons,
        items: e.items,
        has_map: e.hasMap,
      }),
      getLineRange: (e) => ({ lineStart: e.lineStart, lineEnd: e.lineEnd }),
      getDataKey: (e) => e.nativeId,
      populationDimension: "vaults",
    },
  };
}
```

**Completion criterion**: `vaultSpec` function exists and returns a valid `EntitySpec<VaultEntry>`.

### Step 3: Update manifest

Update `manifest.recordKinds` to include `"vault"` and add population contract:

```ts
recordKinds: ["creature", "species", "profession", "vault"],
exhaustivePopulations: [
  // ... existing ...
  {
    dimension: "vaults",
    denominatorKind: "extractor_population",
    expected: <count>, // determined in Step 4
    description: "All NAME: blocks in .des files under dat/des/ (excluding test/)",
  },
],
```

**Completion criterion**: Manifest includes `vault` in `recordKinds` and has a `vaults` population dimension.

### Step 4: Count population denominator

Run an exact count of `NAME:` blocks in `.des` files under `dat/des/`, excluding the `test/` directory:

```sh
grep -rh "^NAME:" <source-root>/crawl/crawl-ref/source/dat/des/ --include="*.des" | grep -v "/test/" | wc -l
```

This count becomes the `expected` value in the population contract.

**Completion criterion**: Exact count determined and documented in the population contract description.

### Step 5: Integrate into extractor run

In `createCrawlExtractor().run()`, after existing YAML parsing, add:

```ts
// --- Parse .des vaults ---
const desFiles = ctx.source.walk().filter(
  (p) => p.startsWith("dat/des/") && p.endsWith(".des") && !p.includes("/test/")
);
const allVaults: VaultEntry[] = [];
for (const desFile of desFiles) {
  const text = ctx.source.readText(desFile);
  allVaults.push(...parseDesVaults(text, desFile));
}
```

Add `vaultSpec(allVaults)` to the specs array.

**Completion criterion**: `run()` parses .des files and includes vault specs in the pipeline.

### Step 6: Update conformance test

Update `tests/conformance/c13-crawl.test.ts` to verify:
- Population dimension `vaults` matches expected count
- Vault records have evidence anchors
- Extraction remains deterministic

**Completion criterion**: Conformance test includes vault population check and passes.

### Step 7: Run and verify

```sh
pnpm exec vitest tests/conformance/c13-crawl.test.ts --run
pnpm exec vitest tests/conformance/ --run
```

All tests must pass.

**Completion criterion**: All conformance tests pass with vault extraction included.

### Step 8: Re-extract and re-derive

```sh
pnpm exec extractor:run crawl
pnpm exec tsx scripts/run-stage-deriver.ts
```

Verify new vault records appear in `knowledge/definition/crawl/` and derived claims/relations in `knowledge/claim/crawl/` and `knowledge/relation/crawl/`.

**Completion criterion**: Vault records exist in canonical knowledge base with derived data.

## Acceptance criteria

- [ ] `des-parser.ts` exists and correctly parses `.des` files
- [ ] `vault` added to crawl extractor manifest `recordKinds`
- [ ] `vaults` population contract declared with exact expected count
- [ ] Conformance test `c13-crawl.test.ts` passes with vault extraction
- [ ] All 46+ conformance tests pass (no regressions)
- [ ] Vault records appear in `knowledge/definition/crawl/` after extraction
- [ ] Derived claims/relations created for vault records by Attribute Deriver
- [ ] RFC-0001 acceptance criterion #7 satisfied

## Risks

- **Vault count accuracy**: `.des` files may contain commented-out `NAME:` blocks or conditional blocks. The parser must skip comments (lines starting with `#`) and only count active `NAME:` directives.
- **Large record count**: ~6,264 vaults is a significant increase from the current 754 Crawl records. Extraction time should remain under 10 seconds (conformance test budget).
- **Map parsing complexity**: Some vaults have complex map layouts with Lua interpolation. The parser should capture `hasMap` as a boolean, not parse the map content — the map is composite data that stays in attributes per Principle 6.
