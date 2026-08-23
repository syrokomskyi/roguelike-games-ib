---
rfcId: RFC-0014
auditId: AUDIT-RFC-0014-01
date: 2026-08-23
auditor:
  skill: fo-idea-audit
  model: claude-sonnet-4-20250514
verdict: needs-revision
---

# Audit: RFC-0014

## Вердикт: Needs revision

RFC содержит 1 ошибку (V-24: отсутствие DNA-инварианта в `satisfies` для architecture RFC) и 5 предупреждений (V-13: отсутствуют обязательные разделы). Семантический аудит выявил конфликт с существующим полем `dataset_version` в `manifest.yaml`, отсутствие учёта существующей `/dataset` страницы, и недостаток операционных деталей в release script.

### Механическая валидация (rfc.validate)

**Fail** — 1 error, 5 warnings:

- **V-24 (error)**: architecture RFC, созданный 2026-08-23, должен объявить хотя бы один DNA-инвариант в `satisfies`.
- **V-13 (warning)**: Отсутствуют разделы `## Architectural fit`, `## Design`, `## Rollout`, `## Alternatives considered`, `## Implementation notes for agents`.

### Ось A — Структурная полнота

1. **Отсутствуют обязательные разделы**: RFC использует нестандартные имена разделов (`## Context`, `## Decision`, `## Implementation plan`) вместо требуемых `## Architectural fit`, `## Design`, `## Rollout`, `## Alternatives considered`, `## Implementation notes for agents`. Содержание частично есть, но разделы названы неправильно.

2. **`## Alternatives considered` отсутствует**: Нет ни одной рассмотренной альтернативы. Например: можно ли использовать git tags как единственный механизм версионирования вместо поля в manifest? Можно ли использовать существующие инструменты (semantic-release, release-please) вместо кастомного скрипта?

3. **`## Rollout` отсутствует**: Не описано поведение по умолчанию — что произойдёт при первом запуске после внедрения? `manifest.yaml` уже содержит `dataset_version: 0.1.0-dev` (строка 4) — будет ли это заменено на `version: "1.0.0"`? Что произойдёт с существующим полем?

4. **`## Implementation notes for agents` отсутствует**: Нет поведенческих правил для агентов — какой статус RFC нужен для начала реализации, какие governance-правила применять, как обновлять `version_history` при данных изменениях.

5. **`## Problem` существует как подраздел** `## Context` (строка 63), но не как отдельный раздел верхнего уровня.

6. **Acceptance criteria**: Пункт "All tests pass" (строка 243) — не уточнено, какие именно тесты. Нужно указать: `pnpm exec vitest --run` и `pnpm exec turbo run build:check`.

### Ось B — DNA-выравнивание

1. **`satisfies: []` — пусто (V-24 error)**: Для architecture RFC это блокирующая ошибка. `forge.yaml` показывает `invariantsFile: null` — в проекте нет файла инвариантов. Та же проблема, что и в RFC-0009. RFC-0014 должен либо: (a) объявить инвариант в теле RFC и добавить его в `satisfies`, либо (b) изменить `kind` на `policy` (как RFC-0002, RFC-0003, RFC-0004).

2. **`related: [RFC-0007]`** — корректно. RFC-0007 (implemented) явно указывает в nonGoals: "Does not define a release process for the dataset — that is a separate RFC". RFC-0014 — это тот самый отдельный RFC.

### Ось C — Экосистемное соответствие

1. **Конфликт с существующим полем `dataset_version`**: `knowledge/manifest.yaml` (строка 4) уже содержит `dataset_version: 0.1.0-dev`. RFC предлагает добавить `version: "1.0.0"` и `version_history` — но не упоминает существующее поле. Нужно: либо переименовать `dataset_version` → `version`, либо использовать `dataset_version` как каноническое имя. Существующая `/dataset` страница (строка 18 в `dataset.astro`) уже читает `manifest.datasetVersion`.

2. **`/dataset` страница уже существует**: RFC говорит "Rewrite `/dataset` page" (строка 157), но не описывает, что уже есть. Текущая страница (`apps/web/src/pages/dataset.astro`) показывает: dataset ID, version, model version, canonical hash, license, logical dump hash, record counts. RFC должен указать, какие именно элементы добавляются vs. изменяются.

3. **`packagesImpacted: []` — должно включать `materializer`**: Если `version` и `version_history` добавляются в `manifest.yaml`, materializer должен их читать и прокидывать в materialized manifest (`dist/manifest.json`). Пакет `packages/materializer` затронут.

4. **AGENTS.md updates не идентифицированы**: Если CI workflow изменяется (добавляется release check), root `AGENTS.md` → CI Gates Policy может потребовать обновления.

5. **Web app `AGENTS.md`**: Требует `MODULE_CONTRACT` и `CHANGE_SUMMARY` для новых `.astro` компонентов — RFC не упоминает этого.

### Ось D — Forward-only compliance

No issues. RFC чисто аддитивный: новые файлы (`DATASET_CARD.md`, `CITATION.bib`, `scripts/create-release.ts`), новые поля в manifest, расширенная страница. Никаких legacy-путей или совместимости. Единственный риск — замена `dataset_version` на `version` должна быть удалением старого поля, не сохранением обоих.

### Ось E — Agent-facing policy

1. **Статус `draft`** — нет self-authorizing language. Корректно.

2. **NEEDS CLARIFICATION markers**: Не найдены.

3. **Storage policy**: Не применимо — RFC не затрагивает persistence (cookies, localStorage).

4. **Отсутствует `## Implementation notes for agents`**: Нет правил для агентов — какой статус RFC нужен для начала реализации, как обновлять `version_history` при данных изменениях, нужно ли запускать `create-release.ts` автоматически или вручную.

### Ось F — Прагматизм

1. **`scripts/create-release.ts` — новый скрипт**: Обоснован. Существующие скрипты (`update-baseline.ts`, `kb-health-summary.ts`) не покрывают version bumping. Однако, стоит рассмотреть существующие инструменты (semantic-release, release-please) — RFC не упоминает их.

2. **Version detection в `kb-health-summary.ts`**: Расширение существующего скрипта — хороший выбор вместо создания нового.

3. **`DATASET_CARD.md` и `CITATION.bib`**: Обоснованные новые файлы. Дублирования нет.

4. **`appsImpacted` и `packagesImpacted`**: `appsImpacted: [web]` — корректно. `packagesImpacted: []` — должно включать `materializer` (см. Ось C).

5. **CI release check (D6)**: Добавляет шаг в существующий CI — разумно. Но проверка "version history is append-only" (строка 186) нетривиальна — как именно CI проверяет append-only? Через git diff? Через сравнение с предыдущим коммитом?

### Ось G — Слепые зоны

1. **Миграция `dataset_version` → `version`**: RFC не рассматривает, что произойдёт с существующим полем `dataset_version: 0.1.0-dev`. Нужно явное заявление: переименовать или использовать существующее имя.

2. **`gh` CLI prerequisite**: `scripts/create-release.ts` (строка 176) опционально создаёт GitHub release через `gh` CLI. Не документировано как prerequisite. Что если `gh` не установлен? Нужен graceful fallback.

3. **Git tag conflicts**: Скрипт создаёт git tag `v{version}` (строка 175) — что если тег уже существует? Что если рабочее дерево грязное? Нет обработки edge cases.

4. **Empty `version_history`**: Что если `version_history` пуст при первом запуске release script? Скрипт должен инициализировать историю.

5. **`DATASET_CARD.md` maintenance**: Risks упоминают (строка 248), что статистика должна auto-generate. Но в implementation plan нет шага для auto-generation — `DATASET_CARD.md` создаётся вручную (Step 2). Как поддерживать его в актуальном состоянии?

6. **Security**: `gh` CLI требует authentication token. Не документировано. Для CI release check — какие secrets нужны?

### Вопросы автору

1. **Как `kind: architecture` соответствует проекту без invariants file?** `forge.yaml` показывает `invariantsFile: null`. Либо измените `kind` на `policy` (как RFC-0002/0003/0004), либо объявите инвариант.

2. **Как `version` соотносится с существующим `dataset_version: 0.1.0-dev` в `manifest.yaml`?** Переименование? Замена? Использование существующего имени поля?

3. **Как CI проверяет "version history is append-only" (D6, строка 186)?** Через git diff предыдущего коммита? Через сравнение с последней записью в истории?

4. **Что произойдёт, если `gh` CLI не установлен или не аутентифицирован при запуске `create-release.ts`?** Нужен graceful fallback или явная ошибка?
