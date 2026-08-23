---
rfcId: RFC-0008
auditId: AUDIT-RFC-0008-01
date: 2026-08-23
auditor:
  skill: fo-idea-audit
  model: claude-sonnet-4-20250514
verdict: needs-revision
---

# Audit: RFC-0008

## Verdict: Needs revision

RFC-0008 решает реальную проблему (мутация исходного дерева Crawl-экстрактором) и предлагает архитектурно разумное решение через supplemental_paths. Однако в RFC есть несколько находок: `computeBindingDigest` сигнатура в RFC не соответствует существующей реализации (3 параметра vs 4 в RFC), `path` в supplemental_paths описан inconsistently (relative to payload_path vs relative to payload_path parent), отсутствует явная валидация collision между supplemental names и payload subdirectories в `createSourceBinding`, и `resolveSafe` return type меняется с `string` на объект — это breaking change для существующих callers.

## Mechanical validation (rfc.validate)

**Pass** — RFC-0008 не имеет нарушений в `rfc.validate`. Единственное нарушение в проекте — V-24 error для RFC-0005, не относится к RFC-0008.

## Axis A — Structural completeness

1. **Decision** — сформулирован как конкретное решение в настоящем времени ("SourceBinding gains... ReadonlySourceReader gains..."). Корректно.

2. **TypeScript contracts** — контракты минимальны и показывают форму типов. Однако `computeBindingDigest` в RFC (строка 209-214) объявляет 4 параметра (`payloadFingerprint`, `supplementalFingerprints`, `declaredVersion`, `sourceId`), тогда как существующая реализация в `@/packages/knowledge-core/src/hash.ts:112-117` принимает 3 параметра (`fingerprint`, `declaredVersion`, `sourceId`). RFC должен явно указать, что это расширение сигнатуры, и описать backward-compatible strategy (например, `supplementalFingerprints` как optional параметр со значением по умолчанию `[]`).

3. **File system responsibilities** — таблица (строки 237-246) перечисляет конкретные файлы. Однако `scripts/run-stage13-crawl.ts` в таблице указан, но `scripts/run-stage-coverage.ts` (упомянутый в Problem, строка 98) — нет. Если coverage script тоже нуждается в обновлении, он должен быть в таблице.

4. **Failure modes** — описаны три режима (строки 248-252). Корректно и достаточно.

5. **Rollout** — 8 шагов, описывает default behavior (bindings без supplemental_paths не меняются). Корректно.

6. **Alternatives considered** — 4 альтернативы с причинами rejection. Хорошо проработано.

7. **Risks** — 4 риска с mitigations. Включает agent misinterpretation risk. Корректно.

8. **Acceptance criteria** — 9 пунктов, все checkable. Однако критерий "All conformance tests pass (671+ tests, 0 failures)" (строка 295) — число 671 может устареть. Рекомендуется формулировать как "All existing conformance tests pass (0 failures)" без жёстко заданного числа.

9. **Implementation notes for agents** — 7 явных behavioral rules. Корректно и достаточно.

## Axis B — DNA alignment

1. **`satisfies: []`** — RFC-0008 имеет `kind: policy` и `scope: workspace`. Поскольку это policy RFC (не architecture/contract), V-24 не требует DNA invariants. Однако `invariantsFile` в `forge.yaml` установлен в `null` — DNA invariants формально не определены в проекте. Это не находка для RFC-0008, но стоит отметить: если DNA invariants будут добавлены позже, этому RFC может потребоваться `satisfies` entry.

2. **`related: [RFC-0001, RFC-0006]`** — оба RFC существуют и связаны. RFC-0001 (Principle 4, evidence anchors) и RFC-0006 (fingerprint instability при Crawl expansion) — релевантные ссылки. Корректно.

3. **Конфликт с существующими invariantами** — не обнаружено. RFC расширяет sandbox model, не нарушая её.

## Axis C — Ecosystem fit

1. **Package boundaries** — RFC затрагивает `extractor-sdk` и `knowledge-core`. Импорты flow `extractors/* → extractor-sdk → knowledge-core`. RFC не нарушает package boundaries. `SupplementalRoot` определён в `extractor-sdk`, `SupplementalPath` — в `knowledge-core`. Это корректное разделение: knowledge-core владеет binding schema, extractor-sdk владеет reader implementation.

2. **`packagesImpacted`** — указаны `extractor-sdk` и `knowledge-core`. Однако RFC также модифицирует `packages/extractors/crawl-extractor/src/extractor.ts` (удаление writeFileSync calls) и `knowledge/sources/bindings.yaml` и `scripts/compute-crawl-fingerprint.ts` и `scripts/run-stage13-crawl.ts`. Crawl-extractor не указан в `packagesImpacted` — это неполный список. Рекомендуется добавить `extractors/crawl-extractor`.

3. **AGENTS.md updates** — RFC упоминает в Risks (строка 282) что AGENTS.md должен быть обновлён с clarifying supplemental_paths semantics, но не указывает это явно в Rollout или File system responsibilities. Это должно быть явным шагом в Rollout.

4. **Compass sync** — не применимо (нет `docs/*.xml` файлов в проекте).

5. **Command lifecycle** — `commands.proposed/added/changed/removed` все пустые. Корректно — RFC не вводит новые команды.

## Axis D — Forward-only compliance

1. **`resolveSafe` return type change** — RFC (строка 189) меняет return type с `string` на `{ rootName: string; absPath: string }`. Это breaking change для всех существующих callers: `EvidenceFactory.create()` (строка 42-43 в evidence-builder.ts) вызывает `this.reader.readBytes(opts.artifactPath)`, который внутренне вызывает `resolveSafe`. Если `readBytes`/`readText`/`stat`/`exists` остаются внутренними потребителями `resolveSafe`, то return type change инкапсулирован. Но если любой внешний код вызывает `resolveSafe` напрямую, это breaking change. RFC должен явно указать, что `resolveSafe` — internal method, не часть публичного API, или предложить сохранение старой сигнатуры с новым методом `resolveSafeMulti`.

2. **No backward compatibility shim** — RFC не предлагает dual-path. Корректно для forward-only.

3. **Legacy code paths deleted** — `.h` file copying удаляется, не сохраняется за флагом. Корректно.

## Axis E — Agent-facing policy

1. **Status gate** — RFC имеет `status: draft`. Implementation notes (строка 300) корректно указывают "Agents MAY implement code changes ONLY when this RFC has status: accepted (or implemented)." Нет self-authorizing language. Корректно.

2. **Implementation notes** — ссылаются на RFC-0224 (accepted→implemented transition) и RFC-0334 (supersede escalation). Корректно.

3. **NEEDS CLARIFICATION markers** — не найдены. Корректно.

4. **Storage policy** — RFC не вводит cookies или client-side persistence. Не применимо.

5. **Anti-fabrication** — acceptance criteria не требуют content authoring. Все критерии — code changes, verifiable by agent. Корректно.

## Axis F — Pragmatism

1. **`path` field inconsistency** — в YAML примере (строка 133) `path: "../"` с комментарием "relative to payload_path". В TypeScript контракте (строка 151) `path: string` с комментарием "relative to payload_path parent". В YAML `../` relative to `payload_path` (dat) = parent of dat = source/. В TypeScript "relative to payload_path parent" = relative to source/ = `./` (current dir). Это противоречие должно быть разрешено: либо `path` relative to `payload_path` (тогда `../` = parent), либо relative to `payload_path` parent (тогда `./` = current dir of parent). Рекомендуется: `path` relative to `payload_path`, как в YAML примере — это интуитивнее.

2. **Lean contracts** — `SupplementalPath` и `SupplementalRoot` минимальны. `glob` field — единственный потенциально speculative field, но он нужен для fingerprint filtering. Корректно.

3. **Existing patterns** — RFC расширяет существующие `SourceBinding` и `ReadonlySourceReader` вместо создания новых абстракций. Корректно.

4. **Scope discipline** — `nonGoals` (строки 56-58) конкретны и meaningful. `appsImpacted: []` — корректно, RFC не затрагивает apps.

## Axis G — Blind spots

1. **Glob matching implementation** — RFC (строка 278) упоминает "Simple glob (`*.h`) is sufficient for Crawl" и "If future extractors need recursive globs (`**/*.h`), the glob matching implementation must support it." Но RFC не указывает, какую glob library использовать. Существующая codebase не имеет glob dependency в `knowledge-core` (только `yaml`). Добавление glob matching — новая dependency. RFC должен указать конкретную library (например, `minimatch` или `picomatch`) или предложить inline implementation для simple `*.ext` patterns.

2. **`computeSupplementalFingerprint` algorithm** — RFC (строка 227-230) описывает "hashes only files matching glob in the supplemental directory", но не указывает, использует ли тот же `sha256-tree-v1` algorithm (walk, sort, hash concatenation). Следует явно указать, что algorithm идентичен `computeSourceFingerprint`, но с glob filtering перед walk.

3. **Concurrent execution** — RFC не рассматривает случай, когда два экстрактора запущены concurrently. supplemental_paths — read-only, поэтому concurrent access безопасен. Но если два запуска одного экстрактора пытаются читать один supplemental path одновременно, это безопасно (read-only). Не находка, но стоит отметить.

4. **Edge case: supplemental path outside source tree** — RFC не рассматривает случай, когда supplemental `path` указывает за пределы source tree (например, `../../other-game/`). `createSourceBinding` должна валидировать, что supplemental path не выходит за пределы source unit root. RFC упоминает sandbox extension, но не указывает границы.

5. **Evidence path collision validation** — RFC (строка 284) упоминает "supplemental names should not collide with payload subdirectories" и "createSourceBinding should validate this", но в Failure modes (строка 252) описана только duplicate name validation. Collision validation должна быть явно в Failure modes.

## Questions for the author

1. Как именно `computeBindingDigest` будет расширена — новый optional параметр `supplementalFingerprints: string[] = []` добавляется к существующим 3 параметрам, или сигнатура полностью меняется? Как существующие callers (например, `createSourceBinding` в binding.ts:44-48) будут обновлены?

2. `path` в `SupplementalPath` — relative to `payload_path` (тогда `../` = parent) или relative to `payload_path` parent (тогда `./` = parent dir)? YAML пример и TypeScript комментарий противоречат друг другу.

3. Какая glob library будет использоваться для `computeSupplementalFingerprint`? `knowledge-core` не имеет glob dependency. Будет ли добавлена новая dependency (например, `picomatch`) или реализован inline matcher для простых `*.ext` patterns?

4. `resolveSafe` return type меняется с `string` на `{ rootName: string; absPath: string }`. Все ли существующие callers (`EvidenceFactory`, `readBytes`, `readText`, `stat`, `exists`) используют `resolveSafe` только внутренне? Есть ли внешний код, вызывающий `resolveSafe` напрямую?

5. Должна ли `createSourceBinding` валидировать, что supplemental `path` не выходит за пределы source unit root (например, `../../` traversal)?
