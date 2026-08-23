---
rfcId: RFC-0005
auditId: AUDIT-RFC-0005-01
date: 2026-08-23
auditor:
  skill: fo-idea-audit
  model: claude-sonnet-4-20250514
verdict: needs-revision
---

# Audit: RFC-0005

## Аудит RFC-0005: Web app enrichment — concept pages, design-space graph, and cross-game comparison view

### Вердикт: Needs revision

RFC предлагает 6 решений (D1–D6) для обогащения веб-приложения — функционально обосновано, но есть 1 ошибка (V-24: отсутствие DNA-инварианта), 5 отсутствующих обязательных разделов (V-13), фактическая ошибка в D1 (`COUNTERED_BY` вместо `HAS_COUNTERPLAY`), необоснованное `packagesImpacted`, и отсутствие TypeScript-контрактов.

### Механическая валидация (rfc.validate)

**Fail** — 1 error, 5 warnings:

- **V-24 (error)**: architecture RFC создан 2026-08-23 (>= 2026-07-07), должен объявить хотя бы один DNA-инвариант в `satisfies`. Поле `satisfies: []` — пусто.
- **V-13 (warning)**: Отсутствуют обязательные разделы: `## Architectural fit`, `## Design`, `## Rollout`, `## Alternatives considered`, `## Implementation notes for agents`.

### Ось A — Структурная полнота

- **Отсутствуют 5 обязательных разделов** (V-13): `## Architectural fit`, `## Design`, `## Rollout`, `## Alternatives considered`, `## Implementation notes for agents`. Раздел `## Decision` присутствует и хорошо структурирован (D1–D6), раздел `## Implementation plan` содержит 7 шагов с верификацией.
- **Раздел `## Risks`** присутствует и честно описывает риски (SVG-сложность, рост страниц, время сборки, client-side JS).
- **Acceptance criteria** проверяемые и покрывают объём решения (8 пунктов, все чекабельные).
- **TypeScript contracts** отсутствуют — RFC не приводит минимальных сигнатур типов для новых функций (`buildCoverageMatrix()`, `buildGameConceptCoverage()`, `ConceptDetails.astro` props).
- **File system responsibilities** не оформлены как таблица, но пути к файлам указаны инлайн в каждом решении (D1–D6) и в плане реализации (Steps 1–7).
- **Failure modes** не описаны — RFC не указывает поведение при ошибке (пустые графы, концепты без отношений, dangling refs).
- **Rollout** отсутствует — не описано поведение по умолчанию и путь принятия для существующих страниц.

### Ось B — DNA-выравнивание

- **V-24 error**: `satisfies: []` — architecture RFC, созданный после 2026-07-07, должен объявить хотя бы один DNA-инвариант. В проекте `invariantsFile: null` (в `forge.yaml`), т.е. файл инвариантов не настроен. RFC-0004 решил ту же проблему, явно указав в `nonGoals`: "Does not define DNA invariants — the project has no invariants file configured (invariantsFile: null in forge.yaml)". RFC-0005 должен сделать то же.
- `related` ссылается на RFC-0003, RFC-0004, PLAN-003 — все релевантны. RFC-0003 (design layer expansion) создал концепты и отношения, которые RFC-0005 отображает. RFC-0004 (cross-game analysis tools) создал MCP-инструменты, чьи функции RFC-0005 переносит в веб-UI.
- RFC не конфликтует с существующими DNA-инвариантами.

### Ось C — Ecosystem fit

- **D1 — фактическая ошибка в `designRelationTypes`**: RFC предлагает:
  ```typescript
  const designRelationTypes = new Set(["CREATES_PRESSURE", "tensions_with", "HAS_MUTATION_VECTOR", "IMPLEMENTED_AS", "COUNTERED_BY", "CAN_FAIL_AS"]);
  ```
  Но реальный MCP-код в `apps/mcp/src/tools/design.ts:100-103` использует:
  ```typescript
  const designRelationTypes = new Set([
    "CREATES_PRESSURE", "tensions_with", "pressures", "synergizes_with",
    "HAS_MUTATION_VECTOR", "IMPLEMENTED_AS", "HAS_COUNTERPLAY", "CAN_FAIL_AS",
  ]);
  ```
  RFC-0003 явно выбрал `HAS_COUNTERPLAY` вместо `COUNTERED_BY` (см. Alternatives considered §C в RFC-0003). RFC-0005 должен использовать `HAS_COUNTERPLAY`, а не `COUNTERED_BY`. Также пропущены `pressures` и `synergizes_with`.

- **`packagesImpacted: [builders/obsidian-builder]`** — ни одно из 6 решений (D1–D6) не описывает изменения в obsidian-builder. Все изменения относятся к `apps/web/`. Это запись некорректна и должна быть удалена или обоснована.

- **Package boundaries**: все изменения в пределах `apps/web/` — нет cross-app импортов. Корректно.

- **`appsImpacted: [web]`** — корректно, все 6 решений затрагивают только веб-приложение.

### Ось D — Forward-only compliance

- Нет backward compatibility layers, шимов или dual-path.
- D1 — bug fix: заменяет некорректный фильтр `relation_scope === "design"` на включающий `cross_game`. Старый путь удаляется, не сохраняется.
- Остальные решения (D2–D6) — чистые добавления, не заменяют существующий функционал (кроме D4, который заменяет flat list на graph — это замена, не dual-path).

### Ось E — Agent-facing policy

- Нет self-authorizing language — статус `draft`, нет утверждений типа "may proceed while draft".
- Нет `NEEDS CLARIFICATION` маркеров.
- **Storage policy**: RFC не вводит cookies или server-side persistence. Client-side JS для фильтров и hover-эффектов не упоминает `localStorage` — корректно (не нужна persistence для UI-фильтров).
- **Anti-fabrication**: acceptance criteria полностью кодовые (build, page count, tests) — нет content authoring, требующего человеческого участия.

### Ось F — Pragmatism

- **D1 (bug fix)** — минимальное и точное исправление. Хорошо.
- **D2 (ConceptDetails)** — новый компонент для существующих страниц. Обосновано.
- **D3 (/concepts page)** — +1 страница. Обосновано.
- **D4 (DesignGraph)** — SVG-based graph без тяжёлого JS-фреймворка. Прагматичный подход.
- **D5 (compare enhancement)** — расширяет существующую страницу, не создаёт новую. Хорошо.
- **D6 (per-game concept section)** — расширяет существующие game pages. Хорошо.
- **`packagesImpacted`** содержит `builders/obsidian-builder` без обоснования — нарушение scope discipline.
- **`nonGoals`** осмыслены и конкретны (no SSR, no JS frameworks, no Obsidian replacement).

### Ось G — Blind spots

- **Пустые состояния**: RFC не описывает, что происходит если design relations пусты (текущий bug — D1 это исправляет, но что если после фикса отношений всё равно 0?). Graph component должен gracefully отображать empty state. Что если концепт не имеет `inclusion_criteria` или `exclusion_criteria`? ConceptDetails должен обрабатывать null/empty.
- **Dangling implementation_refs**: D2 предлагает ссылки на game records в implementation_refs. RFC-0002 отмечает проблему dangling refs. ConceptDetails должен обрабатывать неразрешённые refs.
- **Build time**: RFC упоминает 16,195 страниц и утверждает, что добавление concept sections "should not significantly increase build time". Но D2 добавляет секцию на каждую concept record page — это изменение контента существующих страниц, не новых страниц. D3 добавляет +1 страницу. D4 заменяет flat list на SVG graph — вычисление layout может быть нетривиальным для большого графа. Mitigation в Risks упоминает простой hierarchical layout, но не оценивает сложность.
- **Client-side JS и progressive enhancement**: RFC упоминает vanilla JS для фильтров и hover. Не указано, что страница должна работать без JS (progressive enhancement). Фильтры на /concepts должны fallback на отображение всех концептов.
- **Security/privacy**: не применимо — статический сайт без user data.

### Вопросы автору

1. Почему в D1 используется `COUNTERED_BY` вместо `HAS_COUNTERPLAY`? RFC-0003 явно выбрал `HAS_COUNTERPLAY` и отклонил `COUNTERED_BY`. Также пропущены `pressures` и `synergizes_with` из designRelationTypes — это намеренно?
2. Почему `packagesImpacted` включает `builders/obsidian-builder`? Ни одно решение не описывает изменения в obsidian-builder.
3. Как DesignGraph.astro обрабатывает пустой граф (0 design relations) и граф с большим количеством узлов (74 концепта + отношения)? Какой максимальный размер графа, при котором SVG остаётся читаемым?
