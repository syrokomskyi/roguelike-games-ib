---
rfcId: RFC-0009
auditId: AUDIT-RFC-0009-01
date: 2026-08-23
auditor:
  skill: fo-idea-audit
  model: claude-sonnet-4-20250514
verdict: needs-revision
---

# Audit: RFC-0009

## Вердикт: Needs revision

RFC содержит 1 ошибку (V-24: отсутствие DNA-инварианта в `satisfies` для architecture RFC) и 6 предупреждений (V-13: отсутствуют обязательные разделы). Дополнительно, семантический аудит выявил расхождения между заявленными путями файлов и реальной архитектурой кода, а также недостаточную детализацию формул.

### Механическая валидация (rfc.validate)

**Fail** — 1 error, 6 warnings:

- **V-24 (error)**: architecture RFC, созданный 2026-08-23, должен объявить хотя бы один DNA-инвариант в `satisfies`.
- **V-13 (warning)**: Отсутствуют разделы `## Problem`, `## Architectural fit`, `## Design`, `## Rollout`, `## Alternatives considered`, `## Implementation notes for agents`.

### Ось A — Структурная полнота

1. **Отсутствуют обязательные разделы**: RFC использует нестандартные имена разделов (`## Context`, `## Decision`, `## Implementation plan`) вместо требуемых `## Problem`, `## Architectural fit`, `## Design`, `## Rollout`, `## Alternatives considered`, `## Implementation notes for agents`. Содержание есть, но разделы названы неправильно.

2. **`## Alternatives considered` отсутствует**: Нет ни одной рассмотренной альтернативы. Например: можно ли расширить существующий `get_concept_coverage` вместо создания нового `get_concept_quality`? Можно ли вычислять scores на лету в MCP вместо materialization?

3. **`## Rollout` отсутствует**: Не описано поведение по умолчанию, путь принятия для существующих данных (что произойдёт при первом `pnpm materialize` после внедрения — все концепты получат scores автоматически?).

4. **`## Implementation notes for agents` отсутствует**: Нет поведенческих правил для агентов, реализующих этот RFC.

5. **`## Problem` существует как подраздел** `## Context` (строка 62), но не как отдельный раздел верхнего уровня.

### Ось B — DNA-выравнивание

1. **`satisfies: []` — пусто (V-24 error)**: Для architecture RFC это блокирующая ошибка. Однако, `forge.yaml` показывает `invariantsFile: null` — в проекте нет файла инвариантов. RFC-0004 явно отмечает: "Does not define DNA invariants — the project has no invariants file configured". RFC-0009 должен либо: (a) объявить инвариант в теле RFC и добавить его в `satisfies`, либо (b) изменить `kind` на `policy` (как RFC-0002, RFC-0003, RFC-0004), если архитектурных инвариантов нет.

2. **`related: [RFC-0002, RFC-0003, RFC-0004]`** — корректно, все три RFC реализованы и связаны с концептами.

### Ось C — Экосистемное соответствие

1. **Неверные пути файлов для materializer**: RFC указывает `scripts/run-materialize.ts` как место вычисления scores, но реальная запись `records.jsonl` происходит в `packages/materializer/src/records-jsonl.ts` (`writeRecordsJsonl`). `run-materialize.ts` только вызывает `materialize()` из `packages/materializer/src/build.ts`. Вычисление scores должно происходить в materializer package, а не в скрипте.

2. **`packagesImpacted: []` — должно включать `materializer`**: RFC модифицирует materialization pipeline (добавляет поле к записям в `dist/records.jsonl`). Пакет `packages/materializer` напрямую затронут.

3. **`MaterializedRecord` в `scripts/index-embeddings.ts`**: Это локальный интерфейс скрипта индексации, не общий тип. Тип `CanonicalRecord` в `packages/materializer/src/types.ts` — правильное место для добавления `quality_score`, если scores вычисляются во время materialization.

4. **`apps/web/src/components/ConceptDetails.astro` не существует**: RFC указывает этот файл, но реальные карточки концептов находятся в `apps/web/src/pages/design.astro` и `apps/web/src/pages/concepts.astro`. `ConceptCard` интерфейс определён в `apps/web/src/lib/design-data.ts`.

5. **AGENTS.md updates не идентифицированы**: Web app `AGENTS.md` требует `MODULE_CONTRACT` и `CHANGE_SUMMARY` для новых компонентов — RFC не упоминает этого.

### Ось D — Forward-only compliance

No issues. RFC чисто аддитивный: новое поле, новый tool, новый UI-элемент. Никаких legacy-путей или совместимости.

### Ось E — Agent-facing policy

1. **Статус `draft`** — нет self-authorizing language. Корректно.

2. **NEEDS CLARIFICATION markers**: Не найдены.

3. **Storage policy**: Не применимо — RFC не затрагивает persistence (cookies, localStorage).

4. **Отсутствует `## Implementation notes for agents`**: Нет правил для агентов — какой статус RFC нужен для начала реализации, какие governance-правила применять.

### Ось F — Прагматизм

1. **`get_concept_quality` — новый tool**: Обоснован. Существующие tools (`get_concept_coverage`, `find_concept_gaps`) возвращают покрытие, но не scores. Не дублирует.

2. **Формула richness для design primitives**: `(mutation_vectors + knobs + counterplay + failure_modes) / 20` — но не указано, как эти числа вычисляются. Из design-space relations (`HAS_MUTATION_VECTOR`, `IMPLEMENTED_AS`, `HAS_COUNTERPLAY`, `CAN_FAIL_AS`)? Из полей концепта? Из `ancestry`? Нужно уточнить.

3. **"valid_implementation_refs" не определено**: Формула evidence использует `|valid_implementation_refs|`, но не определяет "valid" — это refs, которые разрешаются к существующим записям? Все refs? RFC-0002 занимался integrity implementation_refs — стоит сослаться.

4. **`all_source_ids` не уточнено**: Из `ctx.store.sources`? Из `bindings.yaml`? В materializer нет `ctx.store` — это MCP context.

5. **`appsImpacted` и `packagesImpacted`**: `appsImpacted: [mcp, web]` — корректно. `packagesImpacted: []` — должен включать `materializer`.

### Ось G — Слепые зоны

1. **Отсутствие `quality_score` в старых данных**: RFC не рассматривает, что произойдёт, если MCP tool или web app получат записи без `quality_score` (например, до первого re-materialize). Нужно graceful fallback.

2. **SQLite read model**: RFC упоминает только `dist/records.jsonl`, но materializer также строит SQLite (`buildSqlite`). Должен ли `quality_score` попасть в SQLite? MCP `ctx.store` может загружать данные из SQLite.

3. **Edge cases**: Концепты без `ancestry`, без `implementation_refs`, без relations — формулы дают 0, но RFC не утверждает это явно.

4. **Конфигурируемость порогов**: Risks упоминают "make thresholds configurable", но в implementation plan нет шага для этого. Где будут храниться пороги (10 refs, 20 related)? Hardcoded? В `knowledge.config.yaml`?

### Вопросы автору

1. **Где вычисляются scores — в `packages/materializer` или в `scripts/run-materialize.ts`?** Текущая архитектура: `run-materialize.ts` вызывает `materialize()` из materializer package, который пишет `records.jsonl`. Вычисление должно быть в materializer, а не в скрипте.

2. **Как `kind: architecture` соответствует проекту без invariants file?** `forge.yaml` показывает `invariantsFile: null`. Либо измените `kind` на `policy` (как RFC-0002/0003/0004), либо объявите инвариант.

3. **Как `richness` считает mutation_vectors, knobs, counterplay, failure_modes?** Через design-space relations? Через поля концепта? Нужна точная спецификация.

4. **Должен ли `quality_score` попасть в SQLite read model?** MCP загружает данные через `ctx.store` — если scores только в JSONL, MCP tools не увидят их без изменения загрузчика.
