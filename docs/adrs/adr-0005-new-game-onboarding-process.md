---
id: ADR-0005
title: New game onboarding process
status: accepted
scope: project-wide
decider: architecture
reviewers:
  - human:andrii-syrokomskyi
related:
  - RFC-0001
  - ADR-0003
created: 2026-08-22
accepted: 2026-08-22
implementedAt:
closedAt: null
---

# ADR-0005: New game onboarding process

## Context

RFC-0001 Principle 8 defines a 10-step onboarding process for new game sources. This ADR documents the concrete onboarding checklist as a local project convention, making it actionable for agents and contributors.

The four existing game extractors (broguece, cataclysm-bn, crawl, nethack) were created incrementally without a formal onboarding process. Each required manual discovery of data types, ad-hoc kind mapping, and retroactive conformance test creation. A standardized process eliminates this variance.

## Decision

Adopt the 10-step onboarding process defined in RFC-0001 Principle 8 as the binding checklist for all new game sources.

### Step 1: Register source

Add an entry to `knowledge/sources/registry.yaml`:

```yaml
- id: <game-id>
  kind: game_repository
  label: <Game Name>
```

### Step 2: Create binding

Add an entry to `knowledge/sources/bindings.yaml`:

```yaml
- source_id: <game-id>
  source_unit_path: <path-within-repo>
  repository: <vcs-url>
  payload_path: <relative-path-to-data>
  fingerprint:
    method: sha256
    digest: <hash>
```

### Step 3: Survey data

Walk the source payload directory and catalog:
- All data file formats (YAML, JSON, C headers, Lua, .des, .txt)
- All data directories and their contents
- Entity counts per data type (for population contracts)
- Attribute richness per data type (for prioritization per RFC-0001 Principle 11)

Document the survey as a comment block in the extractor's `extractor.ts` `MODULE_CONTRACT`.

### Step 4: Map kinds

For each data type identified in Step 3, map to a canonical kind from `knowledge/ontology/game-content-taxonomy.yaml`:

1. Check if an existing canonical kind matches the data type
2. If yes, use it and record the `native_kind` for differentiation
3. If no, follow RFC-0001 Principle 9 (taxonomy extension via RFC)

### Step 5: Create extractor

Create `packages/extractors/<game>-extractor/` with:
- `package.json` (name: `@roguelike-games-ib/<game>-extractor`)
- `tsconfig.json`
- `src/index.ts` (exports `create<Game>Extractor`)
- `src/extractor.ts` (manifest + run function)

### Step 6: Write parsers

One parser per data format:
- `yaml-parser.ts` for YAML files
- `json-parser.ts` for JSON files
- `c-parser.ts` for C header/source files
- `des-parser.ts` for Crawl `.des` files
- `lua-parser.ts` for Lua level files

Each parser returns typed entries with line ranges for evidence anchors.

### Step 7: Write spec builders

One `EntitySpec` builder per kind, using `EntityAdapter`:

```ts
function vaultSpec(entries: VaultEntry[]): EntitySpec<VaultEntry> {
  return {
    kind: "vault",
    entries,
    adapter: {
      nativeKind: "DES_VAULT",
      originActorId: "crawl-factual",
      getSourcePath: (e) => e.filePath,
      getSymbolName: (e) => e.name,
      getSlug: (e) => e.name.toLowerCase().replace(/[^a-z0-9]/g, "_"),
      getNativeId: (e) => `vault:${e.name}`,
      getCanonicalName: (e) => e.name,
      getOriginalName: (e) => e.name,
      getAttributes: (e) => ({ tags: e.tags, orient: e.orient, chance: e.chance, map: e.map, subst: e.subst }),
      getLineRange: (e) => ({ lineStart: e.lineStart, lineEnd: e.lineEnd }),
      getDataKey: (e) => e.name,
      populationDimension: "vaults",
    },
  };
}
```

### Step 8: Declare populations

Add `exhaustivePopulations` entries to the manifest for every data dimension:

```ts
const manifest: ExtractorManifest = {
  schema: "werkstatt/knowledge-extractor@1",
  extractorId: "crawl-factual",
  extractorVersion: "2.0.0",
  sourceKinds: ["game_repository"],
  recordKinds: ["creature", "species", "profession", "vault", "mutation", "spell", "ability", "branch", "lore_entry", "name_table"],
  deterministic: true,
  parserMode: "static",
  exhaustivePopulations: [
    { dimension: "monsters", denominatorKind: "extractor_population", expected: 680, description: "All YAML files in dat/mons/ excluding README and TEST" },
    { dimension: "species", denominatorKind: "extractor_population", expected: 48, description: "All YAML files in dat/species/ excluding README" },
    { dimension: "jobs", denominatorKind: "extractor_population", expected: 26, description: "All YAML files in dat/jobs/ excluding README" },
    { dimension: "vaults", denominatorKind: "extractor_population", expected: 350, description: "All NAME: blocks across all .des files in dat/des/" },
    // ... etc
  ],
};
```

### Step 9: Write conformance test

Create `tests/conformance/c<NN>-<game>.test.ts`:

- Use the next available conformance number
- Test population completeness (extracted == expected for all dimensions)
- Test determinism (two runs produce identical hashes)
- Test evidence coverage (every record has at least one evidence anchor)

### Step 10: Run and verify

```sh
pnpm exec vitest tests/conformance/c<NN>-<game>.test.ts
```

All tests must pass before the extractor is considered complete. Population mismatches indicate either parser bugs or source version drift.

## Justification

- Standardized process reduces variance between extractors written by different agents
- The 10-step checklist ensures no critical step is missed (survey, mapping, populations, tests)
- Aligns with RFC-0001 methodology and ADR-0003 extractor creation skill
- Makes onboarding repeatable for future games without re-deriving the process each time

## Consequences

**Positive:**
- New games follow a proven checklist with accumulated learnings
- Quality is measured consistently across all extractors
- Agents get fast, structured feedback during onboarding

**Negative:**
- The process must be maintained as the SDK and methodology evolve
- Agents must be instructed to use the process (not bypass it)

## Evolution

- If RFC-0001 is amended, this ADR must be updated to reflect changes
- If the SDK gains new capabilities (e.g., streaming, incremental extraction), the process must be updated
