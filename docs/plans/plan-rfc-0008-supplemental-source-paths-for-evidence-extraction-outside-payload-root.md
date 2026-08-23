# Plan: RFC-0008 — Supplemental source paths for evidence extraction outside payload root

- **rfcId**: RFC-0008
- **status**: accepted
- **createdAt**: 2026-08-23

## Objectives

1. Add `SupplementalPath` type and `computeSupplementalFingerprint` to knowledge-core
2. Extend `ReadonlySourceReader` with optional supplemental roots (backward compatible)
3. Extend `computeBindingDigest` with optional supplemental fingerprints (backward compatible)
4. Remove `.h` file copying from Crawl extractor, use supplemental paths instead
5. Update Crawl binding in `bindings.yaml` with `supplemental_paths` and separate fingerprints
6. Update stage scripts to read supplemental fingerprints from bindings
7. Update AGENTS.md with supplemental_paths semantics
8. All tests pass, fingerprint is stable across re-runs

## Steps

### Step 1: Add `SupplementalPath` type to knowledge-core

**Files**:
- `packages/knowledge-core/src/source/binding.ts` — add `SupplementalPath` interface, extend `SourceBinding` with optional `supplemental_paths` field, extend `createSourceBinding` to accept and validate supplemental paths (duplicate name check, collision with payload subdirectories check, path escape check)
- `packages/knowledge-core/src/index.ts` — export `SupplementalPath` type

**Changes**:
- `SupplementalPath` interface: `{ name, path, glob, fingerprint: { algorithm, value } }`
- `SourceBinding` gains optional `supplemental_paths?: SupplementalPath[]`
- `createSourceBinding` gains optional `supplementalPaths?: SupplementalPath[]` parameter (default `[]`). When provided, validates:
  - No duplicate `name` values
  - No `name` collisions with payload subdirectories (checked via `readdirSync(payloadPath)` for directory names)
  - `path` does not escape source unit root (no `../../` traversal beyond `source_unit_path`)
- When `supplementalPaths` is provided, `binding_digest` is computed with `computeBindingDigest(fingerprint, declaredVersion, sourceId, supplementalFingerprints.map(sp => sp.fingerprint.value))`

**Completion criterion**: `SupplementalPath` type exported from `@roguelike-games-ib/knowledge-core`, `createSourceBinding` accepts optional supplemental paths, TypeScript compiles.

### Step 2: Add `computeSupplementalFingerprint` to knowledge-core

**Files**:
- `packages/knowledge-core/src/hash.ts` — add `computeSupplementalFingerprint` function, extend `computeBindingDigest` with optional `supplementalFingerprints` parameter
- `packages/knowledge-core/src/index.ts` — export `computeSupplementalFingerprint`

**Changes**:
- `computeSupplementalFingerprint(supplementalPath: string, glob: string): string` — uses same `sha256-tree-v1` algorithm as `computeSourceFingerprint` (walk, sort entries, hash concatenation) but filters files by glob. For simple `*.ext` patterns, inline matcher using `readdirSync` + extension check. No new dependency.
- `computeBindingDigest(fingerprint, declaredVersion, sourceId, supplementalFingerprints?: string[])` — when `supplementalFingerprints` is omitted or empty, produces same digest as current implementation: `sha256(fingerprint + "\n" + declaredVersion + "\n" + sourceId)`. When provided, produces: `sha256(fingerprint + "\n" + supplementalFingerprints.join(",") + "\n" + declaredVersion + "\n" + sourceId)`.
- Unit test: verify `computeBindingDigest` with no supplemental fingerprints produces same result as current implementation (backward compatibility test)

**Completion criterion**: `computeSupplementalFingerprint` exported, `computeBindingDigest` backward compatible (existing tests pass), new unit test for supplemental fingerprint computation.

### Step 3: Extend `ReadonlySourceReader` with supplemental roots

**Files**:
- `packages/extractor-sdk/src/source-reader.ts` — extend constructor, add `SupplementalRoot` interface, add `getSupplementalRoots` method, add private `resolveMulti` method
- `packages/extractor-sdk/src/index.ts` — export `SupplementalRoot` type

**Changes**:
- `SupplementalRoot` interface: `{ name: string; root: string; glob: string }`
- Constructor gains optional `supplementalRoots: SupplementalRoot[] = []` parameter
- `resolveSafe(relativePath: string): string` — unchanged public API, still returns `string`. Internally: if path starts with `<name>/` prefix matching a supplemental root, resolve against that root. Otherwise try payload root first, then supplemental roots as fallback.
- Private `resolveMulti(relativePath: string): { rootName: string; absPath: string }` — new internal method for multi-root resolution
- `readBytes`, `readText`, `stat`, `exists` — use `resolveMulti` internally instead of `resolveSafe` directly. This allows them to read from supplemental roots.
- `walk` — unchanged, walks payload root only
- `getRoot` — unchanged, returns payload root
- New `getSupplementalRoots(): SupplementalRoot[]` — returns supplemental roots array
- Symlink escape check applied to each root independently

**Completion criterion**: `ReadonlySourceReader` with no supplemental roots behaves identically to current implementation (all existing tests pass). With supplemental roots, `readText("headers/god-type.h")` resolves to the supplemental root. `SupplementalRoot` type exported.

### Step 4: Unit tests for supplemental paths

**Files**:
- `tests/extract/extract-017-supplemental-paths.test.ts` — new test file

**Tests**:
- `ReadonlySourceReader` with supplemental root reads file via `<name>/<filename>` path
- `ReadonlySourceReader` with supplemental root falls back to payload root for non-prefixed paths
- `ReadonlySourceReader` with no supplemental roots behaves as before (backward compat)
- `resolveSafe` still rejects absolute paths and `..` traversal with supplemental roots
- `computeSupplementalFingerprint` hashes only files matching glob
- `computeBindingDigest` with empty supplemental fingerprints produces same digest as without parameter
- `createSourceBinding` throws on duplicate supplemental names
- `createSourceBinding` throws on supplemental name colliding with payload subdirectory

**Completion criterion**: All new tests pass, existing tests still pass.

### Step 5: Remove `.h` file copying from Crawl extractor

**Files**:
- `packages/extractors/crawl-extractor/src/extractor.ts` — remove all `writeFileSync` calls for `.h` files, remove `readFileSync` imports for header files, change `filePath` in C header entries to use `headers/` prefix

**Changes**:
- Remove `import { readFileSync, writeFileSync } from "node:fs"` (keep only what's still needed)
- For each C header type (spells, branches, abilities, gods, brands, item types, clouds):
  - Remove `resolve(sourceRoot, "../<file>.h")` + `writeFileSync` copy pattern
  - Instead, read via `ctx.source.readText("headers/<file>.h")` 
  - Change `filePath` in entries from `"<file>.h"` to `"headers/<file>.h"`
- Remove the comment about copied headers being left in `dat/`
- The `getSourcePath` adapter methods already return `e.filePath`, so evidence anchors will automatically use the `headers/` prefix

**Completion criterion**: No `writeFileSync` calls in `extractor.ts`. No `readFileSync` calls for `.h` files outside the reader. TypeScript compiles. Crawl extractor produces same record counts.

### Step 5b: Clean up copied `.h` files from source tree

**Files**:
- External: `/home/syrokomskyi/projects/roguelike-games-ib-source/crawl/crawl-ref/source/dat/` — remove `.h` files that were copied by previous extraction runs

**Changes**:
- The following `.h` files were copied into `dat/` by the old extractor and must be removed:
  - `spl-data.h`, `branch-data.h`, `ability-type.h`, `god-type.h`, `item-prop-enum.h`, `object-class-type.h`, `cloud-type.h`
- These files belong in `source/` (the parent of `dat/`), not in `dat/` itself
- Removing them ensures the payload fingerprint no longer includes copied artifacts
- After removal, recompute the payload fingerprint — it will be different from the current value in `bindings.yaml` (which included the copied files)

**Completion criterion**: No copied `.h` files remain in `dat/` directory. Payload fingerprint is recomputed and updated in `bindings.yaml`.

### Step 6: Update Crawl binding in `bindings.yaml`

**Files**:
- `knowledge/sources/bindings.yaml` — add `supplemental_paths` to crawl binding
- `scripts/compute-crawl-fingerprint.ts` — compute both payload and supplemental fingerprints

**Changes**:
- Add `supplemental_paths` to crawl binding in `bindings.yaml`:
  ```yaml
  supplemental_paths:
    - name: headers
      path: "../"
      glob: "*.h"
      fingerprint:
        algorithm: sha256-tree-v1
        value: <computed_headers_fingerprint>
  ```
- Update `binding_digest` to use combined digest
- `compute-crawl-fingerprint.ts` — compute payload fingerprint (unchanged), compute supplemental fingerprint for `../` with `*.h` glob, compute combined binding digest, print all three values

**Completion criterion**: `bindings.yaml` crawl entry has `supplemental_paths` with computed fingerprint. `compute-crawl-fingerprint.ts` outputs all three values.

### Step 7: Update stage scripts

**Files**:
- `scripts/run-stage13-crawl.ts` — construct `ReadonlySourceReader` with supplemental roots, pass supplemental fingerprints to `createSourceBinding`

**Changes**:
- Read `supplemental_paths` from bindings.yaml crawl entry
- Construct `SupplementalRoot[]` from binding data: resolve each supplemental `path` relative to `SOURCE_ROOT` (payload root)
- Pass `new ReadonlySourceReader(SOURCE_ROOT, supplementalRoots)` instead of `new ReadonlySourceReader(SOURCE_ROOT)`
- Pass supplemental paths to `createSourceBinding` so `binding_digest` includes supplemental fingerprints

**Completion criterion**: `run-stage13-crawl.ts` constructs reader with supplemental roots, extraction runs successfully, evidence anchors use `headers/` prefix for C header files.

### Step 8: Update AGENTS.md

**Files**:
- `AGENTS.md` — add section on supplemental_paths semantics

**Changes**:
- Add a new section after "Extraction Methodology" explaining:
  - `supplemental_paths` in `SourceBinding` allows reading files outside `payload_path`
  - Only declared paths with declared glob patterns are accessible — not arbitrary file access
  - The sandbox model is extended, not removed
  - Evidence anchors for supplemental files use `<name>/<filename>` as `artifactPath`

**Completion criterion**: AGENTS.md has supplemental_paths section.

### Step 9: Run extraction and verify fingerprint stability

**Commands**:
- `pnpm exec tsx scripts/compute-crawl-fingerprint.ts` — compute new fingerprints
- Update `bindings.yaml` with computed values
- `pnpm exec tsx scripts/run-stage13-crawl.ts` — run Crawl extraction
- Re-run `pnpm exec tsx scripts/run-stage13-crawl.ts` — verify fingerprint unchanged
- Verify no `.h` files are written to `dat/` directory

**Completion criterion**: Fingerprint is identical across two consecutive extraction runs. No `.h` files appear in `dat/` after extraction.

### Step 9b: Update conformance test c13-crawl.test.ts

**Files**:
- `tests/conformance/c13-crawl.test.ts` — update to use supplemental roots and verify supplemental fingerprints

**Changes**:
- The test "fingerprint matches actual source tree" currently computes `computeSourceFingerprint(SOURCE_ROOT)` and compares to binding fingerprint. After cleanup (Step 5b), the payload fingerprint will change (no more copied `.h` files). Update the test to:
  - Still verify payload fingerprint matches `bindings.yaml` value
  - Add verification that supplemental fingerprint matches `bindings.yaml` supplemental_paths[0].fingerprint.value
  - Add verification that `binding_digest` matches the combined digest
- All `new ReadonlySourceReader(SOURCE_ROOT)` calls in the test need to be updated to `new ReadonlySourceReader(SOURCE_ROOT, supplementalRoots)` where `supplementalRoots` is constructed from the binding's `supplemental_paths`
- All `createSourceBinding(...)` calls need to pass supplemental paths so `binding_digest` includes supplemental fingerprints
- The `computeSourceFingerprint(SOURCE_ROOT)` calls need to also compute supplemental fingerprint and pass both to `createSourceBinding`

**Completion criterion**: `c13-crawl.test.ts` passes with supplemental paths. All fingerprint assertions match updated `bindings.yaml` values.

### Step 10: Run full test suite and validate

**Commands**:
- `pnpm exec forge rfc.validate --id RFC-0008 --json` — RFC validation
- `pnpm exec turbo run build:check` — TypeScript compilation
- `pnpm exec vitest --run` — full test suite (including updated c13-crawl.test.ts)
- `pnpm exec turbo run verify` — workspace verification

**Completion criterion**: `rfc.validate` passes, `build:check` passes, all tests pass (0 failures), `verify` passes.

### Step 11: Review and fix

- Run `fo-review` on all session code changes
- Run `fo-fix` if review has findings

**Completion criterion**: Review report exists, all findings addressed.

### Step 12: Stamp implemented

- Run `pnpm exec forge rfc.implement.stamp --id RFC-0008 --implementation-commit <sha>`
- Update RFC-0008 status to `implemented`

**Completion criterion**: RFC-0008 status is `implemented`, `implementedAt` set.

## Acceptance criteria mapping

| RFC criterion | Plan step |
|---|---|
| `SupplementalPath` interface defined | Step 1 |
| `computeSupplementalFingerprint` implemented | Step 2 |
| `ReadonlySourceReader` supports supplemental roots | Step 3 |
| `computeBindingDigest` extended | Step 2 |
| Crawl extractor no longer copies `.h` files | Step 5 |
| Crawl binding declares `supplemental_paths` | Step 6 |
| Re-running extraction produces stable fingerprint | Step 9 |
| All conformance tests pass (0 failures) | Step 10 |
| `rfc.validate` passes | Step 10 |

## Risks and mitigations

- **Glob matching**: inline `*.h` matcher sufficient for Crawl. No new dependency. If recursive globs needed later, add `picomatch`.
- **Evidence path change**: changing `filePath` from `god-type.h` to `headers/god-type.h` changes evidence anchor paths. Existing evidence records in `knowledge/evidence/crawl/` will have old paths. This is acceptable — re-running extraction regenerates all evidence with new paths.
- **Fingerprint change**: adding supplemental paths changes the `binding_digest`. This is expected — the old digest was wrong (included copied `.h` files in payload fingerprint). The new digest correctly separates payload and supplemental fingerprints.
- **Conformance test fingerprint mismatch**: `c13-crawl.test.ts` has hardcoded fingerprint assertions that will fail after cleanup. Step 9b updates these assertions.
- **`computeBindingDigest` backward compatibility**: when `supplementalFingerprints` is omitted or empty, the function must produce exactly `sha256(fingerprint + "\n" + declaredVersion + "\n" + sourceId)` — identical to the current implementation. When non-empty, the formula becomes `sha256(fingerprint + "\n" + supplementalFingerprints.join(",") + "\n" + declaredVersion + "\n" + sourceId)`. The function branches on the parameter to ensure exact backward compatibility.
