---
rfcId: RFC-0003
auditId: AUDIT-RFC-0003-01
date: 2026-08-23
auditor:
  skill: fo-idea-audit
  model: claude-sonnet-4-20250514
verdict: needs-revision
---

# Audit: RFC-0003

## Verdict: Needs revision

RFC содержит одну механическую ошибку (V-24: отсутствуют DNA-инварианты), 5 отсутствующих обязательных секций (V-13) и несколько серьёзных находок: дублирование relation types с существующей онтологией, отсутствие `inclusion_criteria`/`exclusion_criteria` в提议аемых concept типах (кроме failure_mode), и неуказание `decision_refs` как required поля. Решения D1–D7 технически обоснованы и хорошо структурированы, но требуют приведения RFC к структурному стандарту и разрешения коллизий с онтологией.

## Mechanical validation (rfc.validate)

**Fail** — 1 error, 5 warnings:

- **V-24 (error)**: architecture RFC создан 2026-08-23 (≥ 2026-07-07), должен объявить хотя бы один DNA-инвариант в `satisfies[]`. Массив пуст.
- **V-13 (warning)**: отсутствуют секции `## Architectural fit`, `## Design`, `## Rollout`, `## Alternatives considered`, `## Implementation notes for agents`.

## Axis A — Structural completeness

- **Отсутствуют 5 обязательных секций** (V-13): `## Architectural fit`, `## Design`, `## Rollout`, `## Alternatives considered`, `## Implementation notes for agents`. RFC использует нестандартную структуру: `## Context`, `## Problem`, `## Decision` (подразделы D1–D7), `## Implementation plan`, `## Acceptance criteria`, `## Risks`. Решения D1–D7 нужно переупаковать в стандартные секции.
- **Decision** не является единым решением в настоящем времени — это список из 7 подрешений (D1–D7) без общего формулирования.
- **File system responsibilities** — нет таблицы; пути указаны инлайн в каждом шаге плана (`scripts/run-stage-design.ts`, `knowledge/ontology/relation-types.yaml`, `apps/mcp/src/tools/design.ts`).
- **Alternatives considered** — секция отсутствует. Для D5 (новые relation types) следует рассмотреть альтернативу (использование существующих `HAS_COUNTERPLAY` и `COUNTERS`) и объяснить, почему нужны новые.
- **Risks** не включает риск agent misinterpretation и false-positive rate.
- **Implementation notes for agents** — секция отсутствует. Нужно указать, что агенты могут реализовывать код только при статусе `accepted` и должны следовать существующим паттернам в `run-stage-design.ts`.
- **Acceptance criteria** — пункты проверяемые, но критерий "Obsidian vault renders new concept types with appropriate sections" не уточняет, что именно проверять (builder уже рендерит `concept_type` — `@/home/syrokomskyi/projects/roguelike-games-ib/packages/builders/obsidian-builder/src/render-record.ts:58`).

## Axis B — DNA alignment

- **`satisfies[]` пуст** — V-24 error. RFC является architecture-scoped и создан после 2026-07-07, поэтому должен объявить хотя бы один DNA-инвариант. Поскольку `invariantsFile` в `forge.yaml` равен `null`, DNA-инварианты могут отсутствовать в проекте. В этом случае следует либо создать файл DNA-инвариантов, либо явно указать в RFC, что проект не использует DNA-инварианты (если это допустимо).
- **`related[]`** содержит `RFC-0001` и `PLAN-003`. RFC-0001 — implemented policy RFC про extraction methodology; связь с design layer expansion косвенная (оба расширяют knowledge base, но разные слои). PLAN-003 — план enrichment, непосредственно предшествующий этот RFC. Обоснование связи достаточно.
- RFC не устанавливает новых DNA-инвариантов и не конфликтует с существующими.

## Axis C — Ecosystem fit

- **Package boundaries**: RFC импактирует `knowledge-core`, `builders/obsidian-builder`, `mcp`. Все три существуют. Однако `knowledge-core` в `packagesImpacted` не обоснован — RFC не предлагает изменений в `knowledge-core` (концепты создаются в `scripts/run-stage-design.ts`, а не в пакете). Если `knowledge-core` нужен для поддержки новых concept_type в schema, это следует явно указать. Но `concept.schema.yaml` уже включает все提议аемые concept_types (`mutation_vector`, `design_knob`, `counterplay_pattern`, `failure_mode` — `@/home/syrokomskyi/projects/roguelike-games-ib/knowledge/ontology/concept.schema.yaml:21-33`), и `design-space.yaml` уже описывает их (`@/home/syrokomskyi/projects/roguelike-games-ib/knowledge/ontology/design-space.yaml:3-36`). Schema changes не нужны.
- **Compass sync**: RFC не упоминает необходимость обновления `AGENTS.md` или других governance файлов. Поскольку RFC добавляет новые relation types в онтологию, следует проверить, нужно ли обновить `AGENTS.md` с правилами о design-space relation types.
- **AGENTS.md updates**: не идентифицированы. Текущий `AGENTS.md` (`@/home/syrokomskyi/projects/roguelike-games-ib/AGENTS.md:1-30`) покрывает только extractor rules. Если design-space concepts должны следовать governance правилам, это нужно указать.
- **Cosmic naming**: не применимо — RFC не затрагивает manifests или component contracts.
- **Command lifecycle**: `commands.proposed/added/changed/removed` все пустые — корректно, RFC не вводит новых CLI команд.
- **Ontology change policy**: `knowledge/manifest.yaml` указывает `ontology_change: rfc` (`@/home/syrokomskyi/projects/roguelike-games-ib/knowledge/manifest.yaml:18`). RFC правильно следует этой политике, предлагая новые relation types через RFC.

## Axis D — Forward-only compliance

- **Совместимости нет**: RFC не предлагает backward compatibility layers или dual-path. Новые concept types и relation types добавляются к существующей онтологии, не заменяя существующие.
- **Отсутствует конфликт**: RFC не амендирует и не суперседит существующие RFC. Он расширяет design layer, сохраняя существующие primitives и pressures.

## Axis E — Agent-facing policy

- **Status gate**: RFC имеет статус `draft` и не содержит self-authorizing language ("may proceed while draft"). Корректно.
- **Implementation notes**: секция отсутствует (V-13). Нужно добавить правила: агенты могут реализовывать только при статусе `accepted`; агенты должны следовать существующим паттернам в `run-stage-design.ts`; агенты не должны создавать concept records вне `run-stage-design.ts`.
- **Anti-fabrication**: acceptance criteria включают "Obsidian vault renders new concept types" — это кодовое изменение, которое агент может проверить. Однако "Each of 31 design pressures has ≥1 counterplay pattern" требует куративного контента — агент может создать концепты, но качество counterplay patterns требует domain expertise. RFC упоминает в Risks "curated data volume", но не различает code changes и content authoring в acceptance criteria.
- **Storage policy**: не применимо — RFC не затрагивает persistence.
- **NEEDS CLARIFICATION markers**: не найдены.

## Axis F — Pragmatism

- **Дублирование relation types**: RFC предлагает `COUNTERED_BY` (pressure → counterplay_pattern), но онтология уже содержит:
  - `HAS_COUNTERPLAY` (line 269) — "Source mechanic/effect has target counterplay pattern/implementation" — domain: definition/semantic_record/concept → range: definition/semantic_record/concept
  - `COUNTERS` (line 155) — "Source provides meaningful counterplay against target behavior/effect" — domain: definition/semantic_record/concept → range: definition/semantic_record/concept

  `COUNTERED_BY` функционально пересекается с `HAS_COUNTERPLAY`. Нужно либо использовать `HAS_COUNTERPLAY` вместо `COUNTERED_BY`, либо объяснить, почему нужна отдельная relation type с другим direction (pressure → counterplay vs mechanic → counterplay).

- **`IMPLEMENTED_AS` vs `VARIANT_OF`**: `VARIANT_OF` (line 218) существует — "Source is a semantically recognized variant of target". `IMPLEMENTED_AS` (mutation_vector → design_knob) имеет другую семантику (axis → concrete value), поэтому не является дубликатом. Обосновано.

- **`HAS_MUTATION_VECTOR` и `CAN_FAIL_AS`**: не имеют существующих аналогов. Обоснованы.

- **`packagesImpacted`**: `knowledge-core` включён, но RFC не предлагает изменений в пакете. Schema уже поддерживает все concept_types. Если изменение не нужно, следует убрать `knowledge-core` из списка.

- **Scope discipline**: `nonGoals` корректны и осмысленны — "Does not redefine the concept record schema", "Does not add new relation types beyond those defined in relation-types.yaml", "Does not automate design layer generation".

- **Curated data volume**: Risks упоминают ~180 knob concepts + ~31 counterplay + ~15-30 failure modes. Это значительный объём куративного контента. Mitigation "start with 5 most important primitives" разумная, но не отражена в acceptance criteria — критерии требуют покрытия всех 15 primitives и 31 pressures.

## Axis G — Blind spots

- **Performance**: `run-stage-design.ts` уже создаёт ~46 concepts + ~59 relations за один запуск. Добавление ~180 knobs + ~31 counterplay + ~15-30 failure modes = ~250 новых concepts и ~250 новых relations. Скрипт выполняется последовательно, без streaming. Это приемлемо для batch генерации, но может быть медленным. RFC не оценивает время выполнения.
- **False positives**: не применимо — RFC не вводит валидаторы.
- **Edge cases**: RFC не рассматривает пустые состояния (primitive без mutation_dimensions — все 15 primitives имеют dimensions, но что если новый primitive будет добавлен без них?). Не рассматривает случай, когда pressure не имеет counterplay (некоторые pressures могут не иметь осмысленного counterplay).
- **Migration path**: существующие concepts и relations не затрагиваются — `cleanDesignData()` в `run-stage-design.ts` (`@/home/syrokomskyi/projects/roguelike-games-ib/scripts/run-stage-design.ts:87-142`) уже удаляет предыдущие records от `ACTOR_ID = "design-primitives"` перед записью. Новые concepts будут добавлены в тот же canonical root. Migration path не нужен, но RFC не упоминает этот механизм.
- **Security/privacy**: не применимо.

## Questions for the author

1. Почему `COUNTERED_BY` вместо существующего `HAS_COUNTERPLAY`? Онтология уже содержит `HAS_COUNTERPLAY` (concept → concept) с той же семантикой. Если direction отличается (pressure → counterplay vs mechanic → counterplay), объясните, почему недостаточно использовать `HAS_COUNTERPLAY` с pressure как source.
2. Почему `knowledge-core` в `packagesImpacted`? Schema (`concept.schema.yaml`) уже поддерживает все提议аемые concept_types, и `design-space.yaml` уже их описывает. Какие конкретные изменения в `knowledge-core` нужны?
3. Как `mutation_dimensions` из `design-space.yaml` (sensory_modality, visibility, persistence, ...) соотносятся с `mutation_dimensions` в `DESIGN_PRIMITIVES` (death_finality, progression_retention, ...)? Это разные таксономии — RFC использует game-specific dimensions, а ontology определяет абстрактные. Нужно ли выравнивание?
