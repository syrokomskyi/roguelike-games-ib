---
rfcId: RFC-0002
auditId: AUDIT-RFC-0002-01
date: 2026-08-23
auditor:
  skill: fo-idea-audit
  model: claude-sonnet-4-20250514
verdict: needs-revision
---

# Audit: RFC-0002

## Verdict: Needs revision

RFC содержит три серьёзных находки: механическую ошибку V-24 (отсутствуют DNA-инварианты), 5 отсутствующих обязательных секций (V-13) и несколько фактических неточностей в описании текущего состояния. Решения D1–D5 технически обоснованы, но требуют уточнения деталей реализации и приведения RFC к структурному стандарту.

## Mechanical validation (rfc.validate)

**Fail** — 1 error, 5 warnings:

- **V-24 (error)**: architecture RFC создан 2026-08-23 (≥ 2026-07-07), должен объявить хотя бы один DNA-инвариант в `satisfies[]`. Массив пуст.
- **V-13 (warning)**: отсутствуют секции `## Architectural fit`, `## Design`, `## Rollout`, `## Alternatives considered`, `## Implementation notes for agents`.

## Axis A — Structural completeness

- **Отсутствуют 5 обязательных секций** (V-13): `## Architectural fit`, `## Design`, `## Rollout`, `## Alternatives considered`, `## Implementation notes for agents`. RFC использует нестандартную структуру с `## Context`, `## Problem`, `## Decision` (подразделы D1–D5), `## Implementation plan`, `## Acceptance criteria`, `## Risks`. Решения нужно переупаковать в стандартные секции.
- **Decision** не является единым решением в настоящем времени — это список из 5 подрешений (D1–D5) без общего формулирования.
- **File system responsibilities** — нет таблицы; пути указаны инлайн в каждом решении (`scripts/run-stage-concepts.ts`, `packages/builders/obsidian-builder/src/build.ts`).
- **Alternatives considered** — секция отсутствует. Для D2 (замена blocklist на allowlist) следует рассмотреть альтернативу (расширение blocklist) и объяснить, почему allowlist лучше.
- **Risks** не включает риск agent misinterpretation и false-positive rate для валидаторов.
- **Acceptance criteria** — пункт "All 639+ existing tests still pass" требует проверки. Точное число тестов нужно подтвердить.
- **Implementation notes for agents** — секция отсутствует. Нужно указать, что реализация может начаться только после перехода RFC в статус `accepted`.

## Axis B — DNA alignment

- **V-24 error**: `satisfies: []` — architecture RFC, созданный после 2026-07-07, должен объявить хотя бы один DNA-инвариант. В `forge.yaml` `invariantsFile` равен `null` (DNA-файл не существует в этом проекте), но правило V-24 всё равно срабатывает. Нужно либо объявить инвариант, либо изменить `kind` на `contract`/`policy` если архитектурные инварианты не применимы.
- `related: [RFC-0001, PLAN-003]` — RFC-0001 реализован и релевантен (определяет extraction methodology, которую RFC-0002 надстраивает концептуальным слоем). PLAN-003 — план, не RFC; допустимо как связанный документ.
- RFC не устанавливает новых DNA-инвариантов в теле документа.

## Axis C — Ecosystem fit

- **`packagesImpacted` неточен**: указан `knowledge-core`, но в RFC не описано ни одного изменения в `packages/knowledge-core/`. Основные изменения в `scripts/run-stage-concepts.ts` (не пакет) и `packages/builders/obsidian-builder/src/links.ts` (не `build.ts`). Нужно: удалить `knowledge-core`, добавить `scripts/run-stage-concepts.ts` в описание, исправить путь для D5.
- **D5: неверная атрибуция функции** — RFC говорит "extend `validateLinks` in `build.ts`", но функция называется `validateAllLinks` и определена в `@/packages/builders/obsidian-builder/src/links.ts:57`, а не в `build.ts`. `build.ts` только вызывает её (`build.ts:83`).
- **`appsImpacted: []`** — MCP-приложение (`apps/mcp`) имеет tool `get_concept_members`, который резолвит `ancestry.derived_from`. Если D4 удаляет dangling refs, это влияет на MCP-поведение. Нужно указать `apps/mcp`.
- **AGENTS.md updates** — не идентифицированы. Если концептогенерация меняёт фильтрацию (allowlist вместо blocklist), это может потребовать обновления правил в AGENTS.md или отсутствовать — RFC должен явно это решить.
- **Command lifecycle** — `commands.proposed/added/changed/removed` все пустые. Корректно (RFC не вводит новые команды).

## Axis D — Forward-only compliance

- Замена `NOISY_ATTRS` blocklist на `INFORMATIVE_ATTRS` allowlist — чистая замена, не dual-path. Соответствует.
- D4 (strip dangling refs) — деструктивная, но forward-only операция. Соответствует.
- Нет compatibility shims, нет expand-then-contract. Соответствует.

## Axis E — Agent-facing policy

- Нет self-authorizing language. RFC не даёт разрешения на реализацию в статусе `draft`. Соответствует.
- Нет `NEEDS CLARIFICATION` маркеров.
- **Отсутствует секция `## Implementation notes for agents`** (V-13) — нет явных поведенческих правил для агентов-реализаторов.

## Axis F — Pragmatism

- **`INFORMATIVE_ATTRS` включает `flags`**, но RFC сам отмечает `creature_flags_flies` и `creature_flags_stationary` как шумные/дублирующие (P2). Включение `flags` в allowlist противоречит цели D2 — фильтрация noise. D3 (дедупликация) частично решает это для `flies`, но `stationary` не покрывается ни одним semantic equivalence concept. Нужно: либо убрать `flags` из allowlist, либо объяснить, что D3 обрабатывает все дубликаты.
- **`validateConceptRefs` использует `any[]`** — в TypeScript-проекте со строгой типизацией следует использовать `CanonicalRecord[]` или `ConceptRecord[]` вместо `any[]`.
- **`packagesImpacted: [knowledge-core]`** — нет изменений в `knowledge-core`. Лишняя запись.
- **Порядок изменений не указан** — D1 (object handling) должен быть выполнен до ре-добавления Crawl/BrogueCE в `SEMANTIC_EQUIVALENCES`, но RFC не указывает эту зависимость явно в Step 1.

## Axis G — Blind spots

- **Фактическая неточность**: RFC перечисляет `creature_speed_25` как существующий шумный концепт, но файл `creature_speed_25.jsonl` не существует. Реальные speed-концепты: 12, 15, 20, 30, 40, 50 (6 штук, не 7).
- **Фактическая неточность**: RFC утверждает "28 `cross_game_mechanic` concepts" для exact-match, но фактически существует 27 cross_game_mechanic концептов (22 exact-match + 5 semantic equivalence).
- **Design concepts не упомянуты** — 14 `design-*` концептов существуют в `knowledge/concept/cross-game/`, но RFC их не рассматривает. Allowlist change не повлияет на них (они из другого скрипта), но RFC должен явно это указать.
- **D4: empty refs after stripping** — если все `implementation_refs` концепта dangling, концепт остаётся с пустым массивом refs. RFC не определяет, должен ли такой концепт быть удалён. Нужно решение: удалять концепт или оставлять с пустыми refs.
- **D4: test naming conflict** — RFC предлагает `c13-concept-ref-integrity.test.ts`, но `c13-crawl.test.ts` уже существует. Нужно использовать `c14` или выше.
- **Performance** — `validateConceptRefs()` тривиален (38 концептов × ~20 refs), но RFC не указывает стоимость. Minor.
- **Edge case**: RFC не рассматривает, что произойдёт с `ancestry.derived_from` при stripping refs — `derived_from` является subset of `implementation_refs`, но RFC не уточняет, нужно ли синхронизировать оба массива.

## Questions for the author

1. Почему `knowledge-core` указан в `packagesImpacted`? Какие конкретно изменения в `packages/knowledge-core/` планируются?
2. Должен ли концепт с полностью dangling `implementation_refs` быть удалён, или оставлен с пустым массивом? Как синхронизировать `ancestry.derived_from`?
3. Если `flags` остаётся в `INFORMATIVE_ATTRS`, как D3 обрабатывает `creature_flags_stationary` (не покрыт ни одним semantic equivalence concept)?
