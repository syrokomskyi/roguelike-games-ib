---
rfcId: RFC-0004
auditId: AUDIT-RFC-0004-01
date: 2026-08-23
auditor:
  skill: fo-idea-audit
  model: claude-sonnet-4-20250514
verdict: needs-revision
---

# Audit: RFC-0004

## Аудит RFC-0004: Cross-game analysis tools — concept-aware comparison and coverage matrix

### Вердикт: Needs revision

RFC предлагает 4 новых MCP-инструмента и расширение `compare_games` — функционально обосновано, но есть 1 ошибка (V-24: отсутствие DNA-инварианта в `satisfies`), 5 отсутствующих обязательных разделов (V-13), некорректное указание `packagesImpacted`, и семантическое несоответствие между `matched_attributes` в D3 и реальной структурой `ancestry.observed_in`.

### Механическая валидация (rfc.validate)

**Fail** — 1 error, 5 warnings:

- **V-24 (error)**: architecture RFC создан 2026-08-23 (>= 2026-07-07), должен объявить хотя бы один DNA-инвариант в `satisfies`. Поле `satisfies: []` — пусто.
- **V-13 (warning)**: Отсутствуют обязательные разделы: `## Architectural fit`, `## Design`, `## Rollout`, `## Alternatives considered`, `## Implementation notes for agents`.

### Ось A — Структурная полнота

- **Отсутствуют 5 обязательных разделов** (V-13): `## Architectural fit`, `## Design`, `## Rollout`, `## Alternatives considered`, `## Implementation notes for agents`. Раздел `## Decision` присутствует и хорошо структурирован (D1–D5), но остальные обязательные разделы отсутствуют.
- **Раздел `## Risks`** присутствует и честно описывает риски, включая риск курации 60 суммарий и риск dangling refs.
- **Acceptance criteria** проверяемые и покрывают объём решения (8 пунктов, все чекабельные).
- **TypeScript contracts** отсутствуют — RFC показывает JSON-примеры вывода, но не приводит минимальных сигнатур типов для новых функций.
- **File system responsibilities** не оформлены как таблица, но пути к файлам указаны инлайн в каждом решении (D1–D5) и в плане реализации (Steps 1–7).
- **Failure modes** не описаны — RFC не указывает поведение при ошибке (exit codes, warn-vs-fail).
- **Rollout** отсутствует — не описано поведение по умолчанию, путь принятия для существующих приложений.

### Ось B — DNA-выравнивание

- **V-24 error**: `satisfies: []` — architecture RFC, созданный после 2026-07-07, должен объявить хотя бы один DNA-инвариант. В проекте `invariantsFile: null` (в `forge.yaml`), т.е. файл инвариантов не настроен. RFC должен либо объявить инвариант, либо обосновать отсутствие. Если инварианты ещё не определены в проекте, RFC должен указать это явно и предложить инвариант для создания.
- `related` ссылается на RFC-0001, RFC-0002, RFC-0003, PLAN-003 — все релевантны.
- RFC не конфликтует с существующими DNA-инвариантами.

### Ось C — Ecosystem fit

- **Package boundaries**: Все изменения внутри `apps/mcp/` — нет cross-app импортов. OK.
- **`packagesImpacted` некорректно содержит `mcp`**: `mcp` находится в `apps/`, не в `packages/`. Должно быть только в `appsImpacted`. Поле `packagesImpacted` должно быть пустым или содержать реальные пакеты (например, `knowledge-core`, если он затрагивается).
- **AGENTS.md updates**: RFC не упоминает обновления `AGENTS.md`. Поскольку добавляются новые MCP-инструменты, возможно потребуется обновление документации для агентов о новых инструментах.
- **Compass sync**: Не применимо — RFC не меняет requirements.xml или technology.xml.
- **Command lifecycle**: `commands.proposed/added/changed/removed` все пустые — корректно, RFC добавляет MCP-инструменты, не CLI-команды.

### Ось D — Forward-only compliance

- **Нет нарушений.** Расширение `compare_games` параметром `include_concepts` — аддитивное, не shim. Существующее поведение сохраняется при отсутствии параметра. Новые инструменты — чисто новые функции, не дублирующие существующие пути.
- Нет backward compatibility layers, нет dual-path, нет legacy code paths.

### Ось E — Agent-facing policy

- **Нет self-authorizing language** — RFC в статусе `draft` и не даёт разрешения на реализацию.
- **Отсутствует раздел `## Implementation notes for agents`** — V-13 violation и agent-facing policy gap. Раздел должен содержать явные поведенческие правила для агентов-реализаторов.
- **Anti-fabrication**: Acceptance criterion "compare_concept_implementations returns curated implementation summaries per game" требует human authoring (60 суммарий = 15 primitives × 4 games). Критерий не различает code changes (инструмент) и content authoring (суммарии). RFC должен уточнить, что код инструмента и кураторский контент — разные задачи.
- **NEEDS CLARIFICATION markers**: Не найдены.
- **Storage policy**: Не применимо — RFC не затрагивает persistence.

### Ось F — Прагматизм

- **Минимальная поверхность инструментов**: Каждый из 4 новых инструментов обоснован:
  - `get_coverage_matrix` — нельзя выразить как флаг существующего инструмента
  - `get_concept_coverage` — детализация, которую `get_concept_members` не предоставляет (gaps, matched_attributes)
  - `compare_concept_implementations` — уникальная кураторская функция
  - `find_concept_gaps` — работает на уровне отдельных концептов, не типов (как `get_coverage_matrix`)
- **D4: `CONCEPT_IMPLEMENTATION_NOTES` в исходном коде** — кураторский контент (60 суммарий) хранится в `apps/mcp/src/tools/derived.ts` как TypeScript-объект. Это хрупко и трудно поддерживать. Альтернатива — вынести в YAML/JSON data file. RFC не рассматривает эту альтернативу.
- **Scope discipline**: `packagesImpacted: [mcp]` — `mcp` это app, не package (см. Ось C).
- **`nonGoals`** явные и осмысленные — 3 пункта, все содержательные.

### Ось G — Слепые зоны

- **Производительность**: Все инструменты итерируют по records (≤~1000) и concepts (74). O(concepts × games × refs) тривиально. Нет проблем.
- **D3: Семантическое несоответствие `matched_attributes`**: RFC показывает `"matched_attributes": ["resistances", "conveys"]` — выглядит как имена атрибутов. Но логика (D3, шаг 4) говорит "matched attributes (from `ancestry.observed_in`)". Реальные значения `observed_in` — описательные строки (например, `"monsters.h resistance flags"`, `"weaponEnchants enum"`), а не имена атрибутов. Пример вывода не соответствует реальной структуре данных.
- **Edge cases**: RFC не рассматривает случай концепта без `ancestry.source_games` и без `implementation_refs` (пустой концепт). Что должны возвращать инструменты? `member_count: 0`? Error?
- **D4: Edge case** — что возвращает `compare_concept_implementations` для game, для которого нет кураторской суммарии? RFC не указывает fallback поведение.
- **Migration path**: Не применимо — новые инструменты, нет миграции.

### Вопросы автору

1. Какие DNA-инварианты этот RFC удовлетворяет? `satisfies` пуст, но V-24 требует хотя бы один для architecture RFC. Если в проекте нет файла инвариантов, следует ли создать первый?
2. В D3, `matched_attributes` заявлены как coming from `ancestry.observed_in`, но `observed_in` содержит описательные строки, не имена атрибутов. Откуда должны браться `matched_attributes` — из `observed_in` или из другой структуры?
3. В D4, `CONCEPT_IMPLEMENTATION_NOTES` — почему кураторский контент хранится в TypeScript-исходниках, а не в отдельном data file (YAML/JSON)? Как поддерживать актуальность суммарий при развитии KB?
