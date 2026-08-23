---
rfcId: RFC-0015
auditId: AUDIT-RFC-0015-01
date: 2026-08-24
auditor:
  skill: fo-idea-audit
  model: claude-sonnet-4-20250514
verdict: needs-revision
---

# Audit: RFC-0015

## Вердикт: Needs revision

RFC содержит 4 предупреждения V-13 (отсутствуют обязательные разделы с правильными именами). Семантический аудит выявил: отсутствие раздела `## Risks`, отсутствие agent-facing behavioral rules, неадресованную проблему сосуществования с существующим `DesignGraph.astro`, и отсутствие упоминания `MODULE_CONTRACT`/`CHANGE_SUMMARY` требований для новых компонентов.

### Механическая валидация (rfc.validate)

**Pass (с warnings)** — 4 warnings, 0 errors:

- **V-13 (warning)**: Отсутствует раздел `## Design`. RFC использует `## Decision` — содержание есть, но имя раздела не соответствует требуемому.
- **V-13 (warning)**: Отсутствует раздел `## Alternatives considered`. RFC использует `## Alternatives` — содержание есть, но имя раздела неправильное.
- **V-13 (warning)**: Отсутствует раздел `## Risks`. Раздел полностью отсутствует — нет анализа рисков.
- **V-13 (warning)**: Отсутствует раздел `## Implementation notes for agents`. RFC имеет `## Implementation notes`, но без суффикса "for agents" и без agent-facing behavioral rules.

### Ось A — Структурная полнота

1. **`## Design` vs `## Decision`**: RFC использует `## Decision` с подразделами D1–D6 вместо требуемого `## Design`. Содержание адекватно (конкретные решения с типами и примерами), но раздел должен быть переименован.

2. **`## Alternatives` vs `## Alternatives considered`**: Раздел существует с 4 реальными альтернативами (Cytoscape.js, WebGL/Sigma.js, vanilla JS, server-side rendering) и причинами отказа. Нужно только переименовать заголовок.

3. **`## Risks` отсутствует полностью**: Нет анализа рисков. Необходимо добавить: производительность force simulation на мобильных устройствах с ~469 узлами, размер D3 bundle, риск сосуществования двух граф-визуализаций (`DesignGraph.astro` и нового `/design-graph`).

4. **`## Implementation notes for agents` отсутствует**: Текущий `## Implementation notes` содержит технические параметры (charge=-300, linkDistance=80), но не содержит agent-facing behavioral rules. Должны быть добавлены правила вроде: "MUST follow existing patterns in `design-data.ts`", "MUST include `MODULE_CONTRACT` and `CHANGE_SUMMARY` comments in new `.astro` files per `apps/web/AGENTS.md`", "MUST run `pnpm exec tsx scripts/run-build-web.ts` after changes", "MUST handle empty states gracefully".

5. **Acceptance criteria** — проверяемые и покрывают scope решения. 6 пунктов, все конкретные.

6. **Rollout** — 5 конкретных шагов с путями файлов. Адекватно.

### Ось B — DNA alignment

1. **`satisfies: []`**: Пустой список. `invariantsFile` в `forge.yaml` равен `null` — формальная система DNA-инвариантов не настроена в проекте. Для `kind: policy` это допустимо.

2. **`related[]`**: RFC-0003 (design layer expansion), RFC-0005 (web app enrichment), RFC-0011 (design pattern library), RFC-0013 (AI design seed generator) — все релевантны. RFC-0005 создал существующий `DesignGraph.astro` и `/design` страницу. RFC-0003 создал концепты и отношения. RFC-0011 добавил `TRIGGERED_BY_COMBINATION` и `design_pattern` тип. Все корректно связаны.

### Ось C — Ecosystem fit

1. **Package boundaries**: Все изменения внутри `apps/web/` — нет cross-app imports. Корректно.

2. **`apps/web/AGENTS.md` compliance**: RFC не упоминает требование `MODULE_CONTRACT` и `CHANGE_SUMMARY` комментариев для новых `.astro` файлов (`apps/web/src/pages/design-graph.astro`, `apps/web/src/lib/graph-data.ts`). Это обязательное правило в `apps/web/AGENTS.md` (строка 11). Finding.

3. **`designRelationTypes` reuse**: RFC определяет `GraphEdge.type` с перечислением типов отношений, но не упоминает, что нужно переиспользовать экспортированный `designRelationTypes` set из `design-data.ts` (строка 18). Это правило в `apps/web/AGENTS.md` (строка 10). Finding.

4. **Navigation**: RFC предлагает добавить "Design Graph" в навигацию `Base.astro`. Существующая навигация (строка 37) уже содержит "Design Space" → `/design/`. Новая ссылка `/design-graph` может конфликтовать семантически. Стоит уточнить label (например, "Graph" или "Force Graph") и связь с существующей "Design Space" ссылкой.

5. **D3 dependency**: Добавление `d3` в `apps/web/package.json` — соответствует Package Usage Policy в root `AGENTS.md` и `apps/web/AGENTS.md`. Корректно.

### Ось D — Forward-only compliance

1. **Сосуществование с `DesignGraph.astro`**: RFC создаёт новый `/design-graph` page, но существующий `DesignGraph.astro` компонент на `/design` странице (`apps/web/src/components/DesignGraph.astro`) остаётся. RFC не уточняет: должен ли старый граф быть удалён, обновлён, или оставлен как есть. Forward-only принцип требует: если новый граф заменяет старый — старый должен быть удалён. Если они сосуществуют — RFC должен объяснить зачем нужны два разных graph visualization. Finding.

### Ось E — Agent-facing policy

1. **Status gate**: Нет self-authorizing language. RFC в статусе `draft` — корректно.

2. **NEEDS CLARIFICATION markers**: Не найдены. OK.

3. **Storage policy**: Нет cookies, нет persistence. OK.

4. **Agent behavioral rules отсутствуют**: `## Implementation notes` содержит только технические параметры D3, но не содержит обязательных agent-facing rules. Должно быть добавлено в `## Implementation notes for agents`:
   - MUST follow existing patterns in `design-data.ts` — pure projection functions over `ProjectionStore`
   - MUST include `MODULE_CONTRACT` and `CHANGE_SUMMARY` comments in new `.astro` files
   - MUST reuse `designRelationTypes` from `design-data.ts` — do not duplicate
   - MUST handle empty states gracefully
   - MUST use progressive enhancement — page works without JS, D3 enhances
   - MUST run build verification after changes

### Ось F — Pragmatism

1. **D3 vs modular imports**: RFC предлагает `import` D3 целиком (`"add d3 as a dependency"`). D3 v7 поддерживает tree-shakeable modular imports (`d3-force`, `d3-zoom`, `d3-selection`, `d3-scale`). Для ~469 узлов нужны только `d3-force`, `d3-zoom`, `d3-selection`, `d3-scale` — нет необходимости в полном пакете. RFC должен уточнить: полный `d3` или модульные импорты. Finding.

2. **GraphNode/GraphEdge interfaces**: Минимальные и достаточные. Никаких спекулятивных полей. OK.

3. **New page vs enhancing existing**: Создание отдельной страницы `/design-graph` обосновано — force-directed layout это принципиально другая визуализация чем существующий hierarchical SVG graph на `/design`. OK.

4. **Scope discipline**: `appsImpacted: [web]`, `packagesImpacted: []` — корректно. `nonGoals` конкретные и осмысленные. OK.

### Ось G — Blind spots

1. **Mobile performance**: ~469 узлов с D3 force simulation на мобильных устройствах может быть медленным. RFC упоминает touch support (pinch-to-zoom, tap-to-select), но не адресует производительность. Нужно указать: alpha decay rate, максимальное количество итераций simulation, или возможность отключения simulation на мобильных. Finding.

2. **Bundle size**: Полный пакет `d3` — ~270KB minified. При модульных импортах (`d3-force` + `d3-zoom` + `d3-selection` + `d3-scale`) — ~60-80KB. RFC должен указать ожидаемый размер и стратегию (modular imports). Finding.

3. **Empty state**: Что отображается когда нет концептов или отношений? RFC не адресует empty state для graph. Существующий `DesignGraph.astro` показывает "No design relations found." — новый page должен следовать тому же паттерну. Finding.

4. **Build-time cost**: `buildGraphData(store)` — извлечение узлов и рёбер из `ProjectionStore`. ~469 концептов + ~600 отношений — тривиальная операция. Не является bottleneck. OK.

5. **D3 force simulation stability**: С ~469 узлами и ~600 рёбрами force simulation может не сходиться за разумное время. RFC указывает `charge=-300, linkDistance=80`, но не указывает `alphaMin`, `alphaDecay`, или максимальное количество тиков. Finding.

### Вопросы автору

1. Должен ли существующий `DesignGraph.astro` на `/design` странице быть удалён, обновлён, или оставлен? Если новый `/design-graph` заменяет его — укажите это явно в Rollout. Если сосуществуют — объясните зачем нужны две разные визуализации.

2. Будет ли использоваться полный пакет `d3` или модульные импорты (`d3-force`, `d3-zoom`, `d3-selection`, `d3-scale`)? Укажите ожидаемый bundle size и стратегию tree-shaking.

3. Какие параметры D3 force simulation будут использоваться для обеспечения сходимости с ~469 узлами? Укажите `alphaMin`, `alphaDecay`, и максимальное количество итераций. Какова стратегия для мобильных устройств?
