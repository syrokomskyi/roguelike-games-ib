---
rfcId: RFC-0013
auditId: AUDIT-RFC-0013-01
date: 2026-08-23
auditor:
  skill: fo-idea-audit
  model: claude-sonnet-4-20250514
verdict: needs-revision
---

# Audit: RFC-0013

## Verdict: Needs revision

RFC содержит интересную идею (sensation → dossier), но имеет критические проблемы: `SENSATION_MAP` ссылается на несуществующие ключи концепций, отсутствуют 5 обязательных секций (V-13), и `kind: architecture` с пустым `satisfies` нарушает V-24. Карта ощущений должна быть заземлена в реальные данные базы знаний.

## Mechanical validation (rfc.validate)

**Fail** — 1 error, 5 warnings.

- **V-24 (error)**: `kind: architecture` RFC создан 2026-08-23 (≥ 2026-07-07) должен объявить хотя бы один DNA-инвариант в `satisfies`. Предыдущие RFC (0009, 0010, 0011) используют `kind: policy` с пустым `satisfies` — RFC-0013 должен либо сменить `kind` на `policy`, либо объявить инвариант.
- **V-13 (warnings)**: Отсутствуют обязательные секции: `## Architectural fit`, `## Design`, `## Rollout`, `## Alternatives considered`, `## Implementation notes for agents`.

## Axis A — Structural completeness

- **Отсутствует `## Architectural fit`** — все предыдущие RFC (0003, 0009, 0010, 0011) содержат эту секцию с описанием совместимости с существующей инфраструктурой.
- **Отсутствует `## Design`** — предыдущие RFC разделяют `## Decision` (что) и `## Design` (как: TypeScript-контракты, edge cases). RFC-0013 не содержит TypeScript-интерфейсов.
- **Отсутствует `## Rollout`** — нет описания поведения по умолчанию, пути внедрения, миграции.
- **Отсутствует `## Alternatives considered`** — нет ни одной рассмотренной альтернативы.
- **Отсутствует `## Implementation notes for agents`** — нет поведенческих правил для агентов (status gate, MODULE_CONTRACT, CI gates).
- **Отсутствует `## File system responsibilities`** таблица — все предыдущие RFC содержат таблицу путей.
- **Acceptance criteria**: 7 пунктов, проверяемые ✓.
- **Risks**: 4 пункта ✓.

## Axis B — DNA alignment

- **V-24 error**: `kind: architecture` с `satisfies: []`. Проект не имеет файла инвариантов (`invariantsFile: null` в `forge.yaml`). Предыдущие RFC (0009, 0010, 0011) используют `kind: policy` — RFC-0013 должен сделать то же самое, либо обосновать `kind: architecture` и объявить инвариант.
- `related: [RFC-0003, RFC-0009, RFC-0010, RFC-0011]` — все реализованы, ссылки релевантны ✓.

## Axis C — Ecosystem fit

- **`appsImpacted` включает `search-api`** — но RFC не предлагает изменений в `apps/search-api/`. Embedding search fallback (D1) ссылается на существующую инфраструктуру RFC-0010, но не модифицирует её. Удалить `search-api` из `appsImpacted`.
- **Дублирование `sensation-map.ts`** — RFC предлагает хранить карту в двух местах: `apps/mcp/src/tools/sensation-map.ts` и `apps/web/src/lib/sensation-map.ts`. Это нарушает DRY. Нет shared-пакета. Предыдущие RFC не имеют такого паттерна дублирования.
- **MCP tool registration** — паттерн согласован с существующими инструментами (функция в `derived.ts`, регистрация в `server.ts`, `readOnly: true`, добавление в `REQUIRED_TOOLS`) ✓.
- **Переименование `inspiration.astro` → `laboratory.astro`** — навигация уже ссылается на `/inspiration` с label "Laboratory" (`apps/web/src/layouts/Base.astro:40`). RFC не уточняет, меняется ли маршрут (`/inspiration` → `/laboratory`) или только имя файла. Если маршрут меняется, нужны редиректы (forward-only: старый маршрут удаляется).
- **`apps/web/AGENTS.md`**: новые `.astro` файлы должны включать `MODULE_CONTRACT` и `CHANGE_SUMMARY` комментарии — RFC не упоминает это требование.

## Axis D — Forward-only compliance

- No compatibility shims ✓.
- No legacy code paths ✓.
- File rename is forward-only ✓.
- No dual-path proposals ✓.

## Axis E — Agent-facing policy

- **Status gate**: RFC в `draft` — self-authorizing language не найдено ✓.
- **No `NEEDS CLARIFICATION` markers** ✓.
- **Механизм загрузки данных client-side неясен**: RFC говорит "Load `dist/records.jsonl` concepts into memory" для статического Astro-сайта (`prerender = true`). Не указано: импорт на этапе сборки (`import data from '...'`) или runtime fetch статического JSON. Предыдущие страницы (`ask.astro`) используют `fetch()` к search API. RFC должен уточнить механизм.
- **LLM cache в web app**: `systems-cache/llm-dossier-cache.json` — filesystem-based кэш. MCP-сервер может использовать его, но client-side web app не может писать в filesystem. RFC должен разделить: LLM-enhancement только в MCP, web app использует template fallback.
- **Content vs code**: `SENSATION_MAP` (~15 записей) — это курируемый контент, требующий human review. RFC должен различать код (агент может написать) и контент (требует человеческой куриации), как это делает RFC-0011.

## Axis F — Pragmatism

- **КРИТИЧНО: `SENSATION_MAP` ссылается на несуществующие ключи концепций.** Проверка по фактическим данным в `knowledge/concept/cross-game/concept/`:

  **Несуществующие pressures:**
  - `pressure-consequence_persistence` — не существует. Ближайшие: `pressure-risk_of_loss`, `pressure-risk_aversion`.
  - `pressure-information_scarcity` — не существует. Актуальный: `pressure-information_asymmetry`.
  - `pressure-exploration_pressure` — не существует. Актуальные: `pressure-exploration_tension`, `pressure-exploration_urgency`.
  - `pressure-commitment_pressure` — не существует.
  - `pressure-power_curve` — не существует. Актуальный: `pressure-power_curve_tension`.
  - `pressure-scaling_threat` — не существует.

  **Несуществующие primitives:**
  - `design-identification` — актуальный: `design-identification_system`.
  - `design-skill_progression` — актуальный: `design-skill_training`.
  - `design-species_selection` — не существует.
  - `design-corpse_mechanics` — не существует.
  - `design-dungeon_branches` — не существует.

  **Несоответствие naming convention для patterns:**
  - RFC: `knowledge-through-risk` → актуальный: `pattern-knowledge_through_risk`.
  - RFC: `escalating-threat` → актуальный: `pattern-escalating_threat`.
  - RFC: `build-diversity` → актуальный: `pattern-build_diversity`.
  - RFC: `branch-choice` → актуальный: `pattern-branch_choice`.
  - RFC: `corpse-economy` → актуальный: `pattern-corpse_economy`.

  Фактические 14 design primitives: `crafting_system`, `hunger_clock`, `identification_system`, `inventory_management`, `level_progression`, `magic_and_spellcasting`, `permadeath`, `pet_and_companion`, `procedural_generation`, `religion_and_god`, `shop_and_economy`, `skill_training`, `stealth_and_awareness`, `turn_based_combat`.

  Фактические 31 pressures включают: `information_asymmetry`, `risk_of_loss`, `risk_aversion`, `time_pressure`, `resource_scarcity`, `unfairness_risk`, `exploration_tension`, `exploration_urgency`, `power_curve_tension` и др.

  **Рекомендация**: `SENSATION_MAP` должна быть заземлена в фактические ключи. Куратор должен проверить каждый ключ по `knowledge/concept/cross-game/concept/`.

- **`appsImpacted` включает `search-api` без необходимости** — удалить.
- **Нет TypeScript contracts** — предыдущие RFC включают интерфейсы (`ConcreteExample`, `DesignPatternConcept` и т.д.).
- **Нет file system responsibilities таблицы** — предыдущие RFC включают таблицу путей.

## Axis G — Blind spots

- **Empty dossier edge case**: что происходит, когда все релевантные концепции отфильтрованы excluded mechanics? RFC не обрабатывает этот случай. Нужен fallback (например, вернуть пустой dossier с сообщением).
- **Client-side data loading performance**: RFC утверждает "concepts are <50KB", но не уточняет механизм загрузки. Astro `prerender = true` — данные должны быть встроены на этапе сборки или загружены через `fetch()` к статическому JSON.
- **LLM cost для web app**: D4 предлагает LLM-enhanced dossier, но web app (static, client-side) не может безопасно использовать `OPENAI_API_KEY`. LLM-enhancement должен быть только в MCP-сервере. Web app использует template fallback.
- **Pattern key naming**: RFC использует `knowledge-through-risk` (hyphenated) в `SENSATION_MAP`, но фактические ключи используют `pattern-knowledge_through_risk` (underscored, с `pattern-` prefix). Это вызовет runtime errors при lookup.

## Questions for the author

1. **Почему `kind: architecture`, а не `kind: policy`?** Предыдущие RFC (0009, 0010, 0011) — все `kind: policy`. Если нет DNA-инварианта для объявления, смените на `kind: policy`.
2. **Как `SENSATION_MAP` будет заземлена в реальные ключи?** Будет ли куратор проверять каждый ключ по KB, или карта будет сгенерирована алгоритмически из существующих концепций?
3. **Как web app загружает данные концепций?** Build-time import в Astro, runtime `fetch()` к статическому JSON, или fetch к search API? Текущее описание ("Load `dist/records.jsonl` concepts into memory") недостаточно конкретно для статического сайта.
4. **Как web app делает LLM-enhancement?** Client-side не может безопасно хранить `OPENAI_API_KEY`. D4 должен быть ограничен MCP-сервером, а web app должен использовать только template fallback.
