---
id: RFC-0008
title: "Supplemental source paths for evidence extraction outside payload root"
status: draft
# kind options: architecture | contract | command | policy | deprecation
kind: policy
# scope options: app | workspace
scope: workspace
owners:
  - architecture
# Set by the deciding human together with the status change (RFC-0335).
# Draft scaffolds must keep this empty; do not prefill a default identity.
# Format: human:<handle> (agent:<id> reserved — see RFC-0335).
# Default reviewer when none is specified by the operator: human:andrii-syrokomskyi
reviewers: []
createdAt: 2026-08-23
updatedAt: 2026-08-23
enhancedAt: 2026-08-23
implementedAt:
closedAt:
supersedes: []
supersededBy:
amends: []
amendedBy: []
related:
  - RFC-0001
  - RFC-0006
# RFC-0331: DNA invariants this RFC implements, protects, or extends.
# Required for architecture/contract RFCs created on or after 2026-07-07.
# Entries must match ^DNA-\d+$ and exist in docs/architecture-dna.md.
satisfies: []
# RFC-0396: Traceability to a vendored spec node: "<spec-id>/<node-id>", e.g. "pbp/RFC-PBP-020".
# Set by spec.materialize; leave commented for non-spec RFCs.
# specRef:
# RFC-0478: Platform versioning enforcement. Declares the SemVer delta this RFC
# produces when implemented. Required for post-cutoff implemented RFCs (V-29).
# Values: minor (Breaks-B, requires migrator), patch (safe), none (prose-only),
# major (architectural, manually reserved). Default: patch.
versionBump: patch
# RFC-0711: Declares that this RFC contributes to a living feature spec
# under docs/specs/live/<domain>.md. When true, domain is auto-derived from
# packagesImpacted[0]. When a string, used as explicit domain override.
# Absent or false means no living spec merge occurs.
# liveSpec: true
commands:
  proposed: []
  added: []
  changed: []
  removed: []
appsImpacted: []
# List only packages actually impacted. Leave empty if unknown.
packagesImpacted:
  - extractor-sdk
  - knowledge-core
  - extractors/crawl-extractor
successSignals: []
nonGoals:
  - Does not change fingerprint algorithm (sha256-tree-v1)
  - Does not modify payload_path semantics for bindings without supplemental_paths
  - Does not add glob support to payload_path fingerprint computation
# RFC-0268: OPTIONAL machine-checkable acceptance probes, executed on-demand
# via `pnpm exec werkstatt run rfc.acceptance.run --id <this-rfc-id>` (never
# automatically inside build pipelines). Closed probe vocabulary — see
# docs/rfcs/rfc-0268-make-rfc-acceptance-criteria-machine-checkable.md.
# acceptance:
#   - probe: run
#     command: "site-kernel run some.command.validate --app warpgogol-com"
#     expect:
#       exitCode: 0
#   - probe: file-exists
#     path: "packages/share/src/some-new-module.ts"
#   - probe: command-registered
#     name: "some.new.command"
#   - probe: file-contains
#     path: "AGENTS.md"
#     pattern: "Some new governance paragraph"
---

# RFC-0008: Supplemental source paths for evidence extraction outside payload root

## Context

The extractor SDK (`packages/extractor-sdk`) provides a `ReadonlySourceReader` that sandboxes file access to a single root directory (the `payload_path` declared in `SourceBinding`). The `resolveSafe` method blocks absolute paths and `..` traversal, preventing extractors from reading files outside the payload root.

The Crawl extractor needs to parse C header files (`god-type.h`, `brand.h`, `cloud-type.h`, `ability-type.h`, etc.) that live in `source/` — the parent of the payload root `source/dat/`. Because `ReadonlySourceReader` cannot access files outside `dat/`, the extractor copies `.h` files into `dat/` before parsing:

```typescript
// packages/extractors/crawl-extractor/src/extractor.ts
const godSourcePath = resolve(sourceRoot, "../god-type.h");
const godCopyPath = resolve(sourceRoot, "god-type.h");
writeFileSync(godCopyPath, readFileSync(godSourcePath, "utf-8"));
```

This workaround mutates the source tree, causing the `computeSourceFingerprint` hash to change every time a new `.h` file is copied. RFC-0006 extraction required updating the fingerprint and binding_digest three times across three files (`bindings.yaml`, `run-stage13-crawl.ts`, `run-stage-coverage.ts`) — a fragile, error-prone process.

## Problem

1. **Source tree mutation**: The Crawl extractor writes files into the payload directory (`dat/`) to work around the sandbox restriction. This is a side effect that violates the read-only contract implied by `ReadonlySourceReader`.

2. **Fingerprint instability**: Every copied `.h` file changes the `sha256-tree-v1` fingerprint of `dat/`, requiring manual updates to `bindings.yaml`, `run-stage13-crawl.ts`, and `run-stage-coverage.ts`. Missing one update causes conformance test failures (c13-crawl.test.ts fingerprint mismatch).

3. **No cleanup**: Copied `.h` files remain in `dat/` after extraction — there is no cleanup mechanism. Subsequent fingerprint computations include these artifacts, making the fingerprint dependent on extraction execution order.

4. **Scaling problem**: Each new Crawl data type from a C header (e.g., future terrain types, monster spells) requires another `.h` copy, another fingerprint update, and another binding_digest update across multiple files.

## Decision

`SourceBinding` gains an optional `supplemental_paths` field declaring named directories outside `payload_path` with a glob filter. `ReadonlySourceReader` gains multi-root support to read files from supplemental paths. `computeSourceFingerprint` computes separate fingerprints for payload and each supplemental path, combined into the binding_digest. Extractors reference supplemental files in evidence anchors using a named prefix (`<name>/<filename>`).

## Architectural fit

- **RFC-0001 (Extraction methodology)**: Principle 4 (evidence anchors for every record) requires evidence to reference source files. Supplemental paths allow evidence anchors to reference C header files without copying them into the payload directory, preserving source tree integrity.
- **RFC-0006 (Extractor expansion)**: Directly addresses the fingerprint instability that complicated Crawl extractor expansion. Future extractor expansions adding C header parsing will benefit from stable fingerprints.
- `ReadonlySourceReader` sandbox model: supplemental paths are explicitly declared in the binding, not ad-hoc. The sandbox extends to cover declared paths — it does not open arbitrary file access.

## Design

### Binding schema extension

`SourceBinding` gains an optional `supplemental_paths` array. Each entry declares a named directory with a glob filter:

```yaml
# knowledge/sources/bindings.yaml
- source_id: crawl
  source_unit_path: crawl/crawl-ref/source
  declared_version: "0.32.0"
  version_scheme: semver
  metadata_origin: manual
  payload_path: dat
  fingerprint:
    algorithm: sha256-tree-v1
    value: <payload_fingerprint>
  supplemental_paths:
    - name: headers
      path: "../"          # relative to payload_path
      glob: "*.h"
      fingerprint:
        algorithm: sha256-tree-v1
        value: <headers_fingerprint>
  binding_digest: <combined_digest>
```

Bindings without `supplemental_paths` (or empty array) behave exactly as before — no schema break, no fingerprint change.

### TypeScript contracts

```ts
// packages/knowledge-core/src/source/binding.ts

export interface SupplementalPath {
  name: string;              // unique within binding, used as evidence path prefix
  path: string;              // relative to payload_path (e.g. "../" goes up one level from payload_path)
  glob: string;              // glob pattern for fingerprint filtering
  fingerprint: {
    algorithm: string;
    value: string;
  };
}

export interface SourceBinding {
  source_id: string;
  source_unit_path: string;
  declared_version: string;
  version_scheme: string;
  metadata_origin: string;
  payload_path: string;
  fingerprint: { algorithm: string; value: string };
  supplemental_paths?: SupplementalPath[];  // NEW
  vcs: { repository: string | null; commit: string | null; clean: boolean | null; default_branch: string | null } | null;
  binding_digest: string;
}
```

```ts
// packages/extractor-sdk/src/source-reader.ts

export interface SupplementalRoot {
  name: string;
  root: string;   // resolved absolute path
  glob: string;
}

export class ReadonlySourceReader {
  constructor(
    private readonly root: string,
    private readonly supplementalRoots: SupplementalRoot[] = [],
  ) {}

  // resolveSafe — unchanged public API, returns string (resolved absolute path)
  // Tries payload root first, then supplemental roots. Throws SourceRootError
  // if path not found in any root.
  resolveSafe(relativePath: string): string;

  // resolveMulti — NEW internal method for multi-root resolution
  // Returns { rootName: 'payload' | supplemental name, absPath: string }
  // Used internally by readBytes, readText, stat, exists
  private resolveMulti(relativePath: string): { rootName: string; absPath: string };

  // readBytes, readText, stat, exists — try payload root first, then supplemental
  // walk — walks payload root (unchanged); supplemental roots walked separately
  // getRoot — returns payload root (unchanged)
  // getSupplementalRoots — NEW, returns supplemental roots array
}
```

```ts
// packages/knowledge-core/src/hash.ts

export function computeSourceFingerprint(
  payloadPath: string,
  options?: { ignore?: string[] },
): string;  // unchanged — payload only

export function computeSupplementalFingerprint(
  supplementalPath: string,
  glob: string,
): string;  // NEW — hashes only files matching glob

export function computeBindingDigest(
  fingerprint: string,
  declaredVersion: string,
  sourceId: string,
  supplementalFingerprints?: string[],  // NEW optional parameter, default []
): string;  // extended — backward compatible (same digest when supplementalFingerprints omitted or empty)
```

### Evidence path convention

Evidence anchors for supplemental files use `<name>/<filename>` as `artifactPath`. For example, `god-type.h` from the `headers` supplemental path becomes `headers/god-type.h`. This:

- Distinguishes supplemental files from payload files (no collision)
- Is human-readable (clear which supplemental path the file came from)
- Works with existing evidence anchor schema (no schema change)

### Fingerprint computation

Separate fingerprints for payload and each supplemental path:

1. `computeSourceFingerprint(payloadPath)` — unchanged, hashes all files in payload
2. `computeSupplementalFingerprint(path, glob)` — NEW, uses the same `sha256-tree-v1` algorithm as `computeSourceFingerprint` (walk, sort entries, hash concatenation) but filters files by glob before hashing. For simple glob patterns (`*.h`), an inline matcher using `readdirSync` + extension check is sufficient — no new dependency required. If recursive globs (`**/*.h`) are needed in the future, a glob library (e.g. `picomatch`) can be added at that time.
3. `computeBindingDigest` combines: `sha256(fingerprint + supplementalFingerprints.join(',') + declaredVersion + sourceId)`. When `supplementalFingerprints` is omitted or empty, the digest is identical to the current implementation — backward compatible.

This allows identifying which component changed by comparing individual fingerprints.

### File system responsibilities

| Path | Role |
|---|---|
| `packages/knowledge-core/src/source/binding.ts` | SourceBinding interface, createSourceBinding, SupplementalPath type |
| `packages/knowledge-core/src/hash.ts` | computeSupplementalFingerprint, extended computeBindingDigest |
| `packages/extractor-sdk/src/source-reader.ts` | Multi-root ReadonlySourceReader |
| `packages/extractors/crawl-extractor/src/extractor.ts` | Remove .h file copying, use supplemental paths |
| `knowledge/sources/bindings.yaml` | Add supplemental_paths to crawl binding |
| `scripts/run-stage13-crawl.ts` | Read supplemental fingerprints from bindings.yaml |
| `scripts/compute-crawl-fingerprint.ts` | Compute both payload and supplemental fingerprints |

### Failure modes

- **Missing supplemental file**: If a file declared in supplemental_paths does not exist, `resolveSafe` throws `SourceRootError` (same as current behavior for missing payload files).
- **Glob matches no files**: `computeSupplementalFingerprint` returns a hash of empty string list. Warning logged, but not an error — the binding is still valid (supplemental path may be empty for some game versions).
- **Duplicate supplemental name**: `createSourceBinding` throws if two supplemental paths have the same `name` — names must be unique within a binding.
- **Supplemental name collision with payload subdirectory**: `createSourceBinding` throws if a supplemental path `name` matches an existing subdirectory name in `payload_path` — this prevents evidence path ambiguity (e.g., `headers/god-type.h` could refer to either a supplemental path or a payload subdirectory).
- **Supplemental path escapes source unit root**: `createSourceBinding` validates that the resolved supplemental path does not traverse beyond the source unit root (e.g., `../../` is rejected). Supplemental paths must stay within the source tree declared by `source_unit_path`.

## Rollout

1. **Add `SupplementalPath` type and `computeSupplementalFingerprint` to knowledge-core** — additive, no breaking changes.
2. **Extend `ReadonlySourceReader` with optional `supplementalRoots`** — backward compatible (default empty array).
3. **Extend `computeBindingDigest` with optional `supplementalFingerprints` parameter** — backward compatible (default empty array, produces same digest as before when empty).
4. **Update Crawl extractor** — remove `.h` file copying, declare supplemental_paths in binding, use `headers/god-type.h` style evidence paths.
5. **Update Crawl binding in bindings.yaml** — add `supplemental_paths` entry, compute and store separate fingerprints.
6. **Update stage scripts** — `run-stage13-crawl.ts` reads supplemental fingerprints from bindings.yaml (already refactored to read from bindings.yaml).
7. **Re-run Crawl extraction** — regenerate evidence with supplemental paths, verify fingerprint stability (no change when re-running).
8. **Update AGENTS.md** — add a rule clarifying supplemental_paths semantics: supplemental paths are a controlled sandbox extension, not arbitrary file access. Only declared paths with declared glob patterns are accessible.
9. **Run full test suite** — verify no regressions.

Existing bindings (BrogueCE, NetHack, Cataclysm-BN) are unaffected — they have no `supplemental_paths` and behave exactly as before.

## Alternatives considered

1. **Change payload_path to `source/` instead of `source/dat/`**: Rejected because the fingerprint would cover the entire Crawl source tree (thousands of C++ files), making it extremely sensitive to unrelated changes. The fingerprint should cover only the data being extracted.

2. **Allow `..` in `resolveSafe`**: Rejected because it breaks the sandbox security model. `ReadonlySourceReader` is explicitly designed to prevent path traversal. Supplemental paths are a controlled, declared extension — not unrestricted access.

3. **Copy files and compute fingerprint before extraction**: Rejected because it requires running fingerprint computation in a specific order (before any extraction) and is fragile if extraction is re-run. The fingerprint should be deterministic regardless of extraction state.

4. **Individual file declarations (`supplemental_files`)**: Rejected in favor of `supplemental_paths` with glob. File-level declarations require listing every `.h` file explicitly, which is more maintenance burden. Glob filtering (`*.h`) captures all header files automatically while keeping the fingerprint scoped to relevant files.

## Risks

- **Glob pattern complexity**: Simple glob (`*.h`) is sufficient for Crawl. If future extractors need recursive globs (`**/*.h`), the glob matching implementation must support it. Mitigation: start with simple glob, extend if needed.

- **Supplemental fingerprint drift**: If the source tree changes (e.g., new `.h` file added matching the glob), the supplemental fingerprint changes. This is correct behavior — the binding should be updated. But it means the fingerprint is not fully stable across source tree updates. Mitigation: this is the same behavior as the payload fingerprint — it should change when source data changes.

- **Agent misinterpretation**: Agents may think supplemental_paths opens arbitrary file access. It does not — only declared paths with declared glob patterns are accessible. The sandbox model is extended, not removed. Mitigation: AGENTS.md update clarifying supplemental_paths semantics.

- **Evidence path confusion**: Evidence anchors with `headers/god-type.h` may be confused with payload files in a `headers/` subdirectory. Mitigation: supplemental names should not collide with payload subdirectories. `createSourceBinding` should validate this.

## Acceptance criteria

- [ ] `SupplementalPath` interface defined in `packages/knowledge-core/src/source/binding.ts` (evidence: type export)
- [ ] `computeSupplementalFingerprint` function implemented in `packages/knowledge-core/src/hash.ts` (evidence: function export, unit test)
- [ ] `ReadonlySourceReader` supports supplemental roots in `packages/extractor-sdk/src/source-reader.ts` (evidence: constructor accepts SupplementalRoot[], resolveSafe works across roots)
- [ ] `computeBindingDigest` extended to accept supplemental fingerprints (evidence: function signature, backward compatible)
- [ ] Crawl extractor no longer copies `.h` files into `dat/` (evidence: no writeFileSync calls for .h files in extractor.ts)
- [ ] Crawl binding in `bindings.yaml` declares `supplemental_paths` with separate fingerprints (evidence: bindings.yaml crawl entry)
- [ ] Re-running Crawl extraction produces stable fingerprint (evidence: fingerprint before and after extraction is identical)
- [ ] All conformance tests pass (0 failures) (evidence: vitest --run output)
- [ ] `rfc.validate` passes on this file before merging (evidence: validation output)

## Implementation notes for agents

- Agents MAY implement code changes ONLY when this RFC has status: accepted (or implemented).
- Agents MAY transition this RFC from `accepted` to `implemented` per RFC-0224 preconditions; reference this RFC ID in commits.
- Agents MUST NOT weaken or remove enforcement rules established by this RFC without a new RFC that supersedes it.
- Agents MUST NOT use supplemental_paths to bypass the sandbox model — only declared paths in the binding are accessible.
- Agents MUST remove all `.h` file copying from the Crawl extractor when implementing this RFC. The extractor must not write to the source tree.
- Agents MUST validate that supplemental path names do not collide with payload subdirectories.
- If implementation reveals an invariant conflict, run `pnpm exec forge rfc.supersede.propose --id rfc-0008 --reason "..." --invariant "DNA-N"` instead of working around it (RFC-0334).
