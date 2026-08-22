---
rfcId: RFC-0001
auditId: AUDIT-RFC-0001-01
date: 2026-08-22
auditor:
  skill: fo-idea-audit
  model: claude-sonnet-4-20250514
verdict: needs-revision
---

# Audit: RFC-0001

## Вердикт: Needs revision

RFC-0001 содержит хорошо структурированную методологию экстракции, но имеет два серьёзных несоответствия между заявленной полнотой таксономии и фактическим содержимым `game-content-taxonomy.yaml`, а также фактическую ошибку в критериях приёмки (10 vs 11 принципов). Эти находки требуют исправления до перехода к реализации.

## Механическая валидация (rfc.validate)

Pass — нарушений нет.

## Ось A — Структурная полнота

**Находка A1: Acceptance criteria упоминает 10 принципов вместо 11.**

Строка 398: "Existing extractors reviewed for compliance with all 10 principles". RFC определяет 11 принципов (Principle 1 через Principle 11). Принцип 11 (Extraction–derivation contract) — один из ключевых, определяющий контракт между экстракцией и деривацией. Агенты, проверяющие соответствие по этому критерию, пропустят Principle 11.

**Остальные пункты:** Decision в настоящем времени ✓. TypeScript contracts минимальны ✓. File system responsibilities с конкретными путями ✓. Rollout описан ✓. Alternatives considered — 4 альтернативы с причинами отклонения ✓. Risks включает agent misinterpretation ✓. Implementation notes — явные поведенческие правила ✓.

## Ось B — DNA alignment

No issues. `satisfies: []` — пусто, инварианты не заявлены. `invariantsFile` в `forge.yaml` равен `null` — DNA-инвариантов в проекте нет. `related: [ADR-0003, ADR-0004]` — оба существуют и релевантны.

## Ось C — Ecosystem fit

**Находка C1: Канонический вид `profession` отсутствует в таксономии.**

RFC использует `profession` в таблице маппинга (Principle 3, строки 202, 216) для:
- Crawl job YAML → `profession`
- Cataclysm-BN profession JSON → `profession`

Однако в `knowledge/ontology/game-content-taxonomy.yaml` (категория `abilities_character`) вид `profession` отсутствует. Категория содержит: `spell, ability, skill, feat, trait, mutation, class, species, background`.

Существующие экстракторы уже используют `profession`:
- `crawl-extractor/src/extractor.ts:26` — `recordKinds: ["creature", "species", "profession"]`
- `cataclysm-bn-extractor/src/extractor.ts:38` — `recordKinds: ["creature", "item", "mutation", "profession"]`

RFC заявляет: "No taxonomy changes are proposed" (Principle 9, строка 314) и "this RFC confirms the existing taxonomy as the canonical kind vocabulary" (Architectural fit, строка 154). Это противоречит использованию `profession`, которого нет в таксономии.

**Рекомендация:** либо добавить `profession` в таксономию (категория `abilities_character`), либо заменить маппинг на существующий вид (`class` или `background`) с `native_kind: PROFESSION` для дифференциации. Первый вариант предпочтительнее — `profession` уже используется в продакшн-данных и устранён из таксономии быть не может без миграции.

**Находка C2: Существующие recordKinds broguece-extractor отсутствуют в таксономии.**

`broguece-extractor/src/extractor.ts:68` объявляет: `recordKinds: ["creature", "terrain", "item", "image_asset", "dungeon_feature", "light", "mutation", "monster_class", "status_effect", "monster_behavior", "monster_ability"]`.

Из них в таксономии отсутствуют: `image_asset`, `dungeon_feature`, `light`, `monster_class`, `monster_behavior`, `monster_ability`. RFC не упоминает эти виды в таблице маппинга и не обсуждает их статус. RFC заявляет полноту таксономии, но 6 из 11 видов broguece не канонические.

**Рекомендация:** RFC должен либо явно признать эти виды как технический долг с планом ретаксономизации, либо включить их в таксономию. Игнорирование undermines заявление "the existing taxonomy covers all identified data types."

**Остальные пункты:** Package boundaries корректны ✓. Compass sync — acceptance criteria включает обновление AGENTS.md ✓. Command lifecycle — пустые buckets, команд нет ✓.

## Ось D — Forward-only compliance

No issues. Совместимых слоёв не предлагается. Депрекаций нет. Legacy путей нет.

## Ось E — Agent-facing policy

**Находка E1: Acceptance criteria "10 principles" — agent-facing ошибка.**

(Дублирует A1.) Критерий приёмки "Existing extractors reviewed for compliance with all 10 principles" направит агентов на проверку 10 принципов вместо 11. Principle 11 (Extraction–derivation contract) — обязательный контракт между экстракцией и деривацией. Его пропуск при ревью оставит пробел в обеспечении сохранения атрибутов.

**Остальные пункты:** Status gate корректен — "Agents MAY implement extraction code changes ONLY when this RFC has status: accepted (or implemented)" ✓. NEEDS CLARIFICATION маркеров нет ✓. Storage policy — N/A (нет persistence) ✓.

## Ось F — Pragmatism

**Находка F1: `packagesImpacted` включает `extractors/nethack-extractor`, но RFC не описывает конкретные изменения для NetHack.**

RFC перечисляет unextracted NetHack data types (artifacts, traps, levels, roles, races, dungeon branches, attack types, skills) в survey, но Rollout упоминает только "Crawl vaults or Cataclysm-BN bionics" как первое новое извлечение. Включение nethack-extractor в `packagesImpacted` корректно (экстрактор будет расширен), но неоднозначно — агент может не понять, какие именно изменения ожидаются.

**Рекомендация:** Уточнить в Rollout, что NetHack extraction work (artifacts, traps, levels, roles, races, etc.) также следует методологии, или добавить ссылку на ADR-0006 coverage analysis.

**Остальные пункты:** Lean contracts ✓. Existing patterns — RFC строит на существующем SDK ✓. nonGoals конкретны и осмыслены ✓.

## Ось G — Blind spots

No issues. Performance рассмотрена (Risks, строка 391) ✓. Population count drift описан ✓. Composite data ambiguity обсуждён ✓. Migration path — "No migration needed for existing records" ✓. Security/privacy — N/A ✓.

## Вопросы автору

1. **`profession` в таксономии:** Почему `profession` отсутствует в `game-content-taxonomy.yaml`, хотя используется в RFC mapping table и в существующих экстракторах? Это упущение в таксономии или маппинг должен использовать `class`/`background`?

2. **BrogueCE нестандартные виды:** 6 из 11 recordKinds broguece-extractor отсутствуют в таксономии (`image_asset`, `dungeon_feature`, `light`, `monster_class`, `monster_behavior`, `monster_ability`). RFC заявляет полноту таксономии — должен ли RFC признать их как технический долг или добавить в таксономию?

3. **ADR-0005 и ADR-0006 созданы до принятия RFC:** Оба companion ADR имеют `status: accepted` и ссылаются на RFC-0001, который ещё в `draft`. Это намеренно (ADR может ссылаться на draft RFC) или ADR должны быть переведены в `draft` до принятия RFC?
