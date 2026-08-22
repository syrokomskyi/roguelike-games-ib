---
reviewId: REVIEW-CODE-2026-08-22-01
date: 2026-08-22
reviewer:
  skill: fo-review
  model: unknown
verdict: needs-revision
diffRange: 23a8a0ca3...HEAD + uncommitted web changes
filesReviewed:
  - packages/extractors/broguece-extractor/src/extractor.ts
  - packages/extractors/broguece-extractor/src/c-parser.ts
  - apps/web/src/lib/sprite.ts
  - apps/web/src/components/SpriteIcon.astro
  - apps/web/src/components/CompareTable.astro
  - apps/web/src/components/RecordHeader.astro
  - apps/web/src/components/RelationGraph.astro
  - apps/web/src/pages/games/[sourceId]/[...filter].astro
  - apps/web/src/pages/games/[sourceId]/definitions/[kind].astro
  - apps/web/src/pages/games/[sourceId]/mechanics.astro
  - apps/web/src/pages/games/[sourceId]/systems.astro
  - apps/web/src/pages/search.astro
---

# Code Review: 23a8a0ca3...HEAD + uncommitted web changes

### Verdict: Needs revision

Механический этаж падает с одной ошибкой (отсутствует импорт `keyToSpriteUrl` в `search.astro`). Среди семантических осей: дублирование кода `keyToSpriteUrl` между серверным и клиентским контекстом, неверный `path` в `source_identity` для variant item tables, устаревшие `MODULE_CONTRACT` и `CHANGE_SUMMARY` в обоих изменённых файлах, и массовое дублирование паттерна создания записей для новых типов сущностей.

### Mechanical floor

**Fail** — 1 ошибка:
- `apps/web/src/pages/search.astro:141` — `Cannot find name 'keyToSpriteUrl'`. Функция определена в inline `<script>` (строка 191), но вызывается на строке 141 в серверном frontmatter-коде, где она не видна. Нужно либо импортировать `keyToSpriteUrl` из `../lib/sprite` в frontmatter, либо перенести вызов в клиентский скрипт.

### Axis A — Structural correctness

1. **Duplicated Code (Fowler)** — `keyToSpriteUrl` полностью дублируется между `apps/web/src/lib/sprite.ts:21-27` (серверный) и `apps/web/src/pages/search.astro:191-197` (клиентский inline script). Обе копии идентичны: `parts = key.split("/"); ... return /sprites/${source}/${rest}.png`. Нужно вынести в общий модуль или использовать серверный импорт для генерации URL на этапе сборки, а в клиентский скрипт передавать уже сгенерированные URL.

2. **Duplicated Code (Fowler)** — Паттерн создания записей для 7 новых типов сущностей (dungeon features, lights, mutations, monster classes, status effects, monster behaviors, monster abilities) в `extractor.ts:460-665` практически идентичен: `parse → for-loop → resolveOrCreate → makeRecordEnvelope → record object → writeRecord → evidence.create → writeEvidence`. Разница только в полях `attributes` и `native_kind`. Это ~200 строк дублирования, которые можно свести к параметризованной функции.

3. **Magic numbers** — `extractor.ts:775` и `extractor.ts:822` — хардкод `[32]` в именах каталогов `monsterBehaviorCatalog[32]` и `monsterAbilityCatalog[32]` в `c-parser.ts`. Если размер массива изменится в исходниках, парсер молча пропустит записи. Нужно использовать `NUMBER_BEHAVIORS` / `NUMBER_ABILITIES` или хотя бы `]` без хардкода размера.

4. **MODULE_CONTRACT устарел** — `extractor.ts:3` описывает purpose как "parses C source files and emits creature, terrain, and item records", но теперь экстрактор также извлекает dungeon features, lights, mutations, monster classes, status effects, monster behaviors, monster abilities. `CHANGE_SUMMARY` (строка 10) содержит только "Initial creation", хотя добавлены 8 новых типов сущностей.

5. **MODULE_CONTRACT устарел** — `c-parser.ts:3` описывает purpose как "extracts enums, monster catalog, tile catalog, and item tables", но теперь парсер также обрабатывает dungeonFeatureCatalog, lightCatalog, mutationCatalog, monsterClassCatalog, statusEffectCatalog, monsterBehaviorCatalog, monsterAbilityCatalog. `CHANGE_SUMMARY` (строка 10) содержит только "Initial creation".

### Axis B — DNA alignment

No invariants file — invariant alignment skipped (`forge.yaml` → `invariantsFile: null`).

### Axis C — Ecosystem fit

1. **Package boundaries** — Импорты в веб-компонентах (`apps/web/src/components/*.astro`, `apps/web/src/pages/**/*.astro`) ссылаются на `../lib/sprite` и `../../../lib/sprite` — это внутри `apps/web`, не跨界. Корректно.

2. **AGENTS.md updates** — `AGENTS.md` упоминает только `packages/extractors/` как конвенцию расположения. Новые record kinds (`dungeon_feature`, `light`, `mutation`, etc.) не описаны ни в `AGENTS.md`, ни в `knowledge/manifest.yaml`. Если эти kinds используются в проекциях или вебе, они должны быть задокументированы.

### Axis D — Forward-only compliance

No issues. Новые типы добавлены напрямую, без compatibility shim или legacy path.

### Axis E — Agent-facing clarity

1. **Compass scaffolding** — `apps/web/src/lib/sprite.ts` и `apps/web/src/components/SpriteIcon.astro` имеют корректные `MODULE_CONTRACT` и `CHANGE_SUMMARY`. Однако `extractor.ts` и `c-parser.ts` не обновили свои `CHANGE_SUMMARY` (см. Axis A, finding 4-5).

2. **Ungrounded assertions** — `extractor.ts:3` purpose говорит "creature, terrain, and item records", но экстрактор теперь извлекает 11 типов. Другой агент, читающий MODULE_CONTRACT, получит неполную картину.

3. **Readable by another agent** — Имена переменных в новых парсерах понятны (`df`, `lt`, `mut`, `mc`, `se`, `mb`, `ma`). Однако `lt` для light entry может быть неочевидно — лучше `light` или `lEntry`.

### Axis F — Pragmatism

1. **Duplicated Code → extract** — 7 блоков создания записей в `extractor.ts:460-665` можно заменить одной функцией `writeEntityRecord(ctx, kind, nativeKind, entry, attributes, sourcePath, symbolName)`. Это сократит ~200 строк до ~30 + 7 вызовов.

2. **Existing patterns** — `SpriteIcon.astro` уже инкапсулирует логику `keyToSpriteUrl` + `<img>`. Однако в 7 других файлах (`CompareTable.astro`, `RecordHeader.astro`, `RelationGraph.astro`, `[...filter].astro`, `[kind].astro`, `mechanics.astro`, `systems.astro`) используется прямой `<img src={keyToSpriteUrl(...)} ... onerror="this.style.display='none'" />` вместо `<SpriteIcon recordKey={...} size={...} />`. Это дублирование — нужно использовать `SpriteIcon` везде.

3. **Scope discipline** — Дифф затрагивает только экстрактор и веб-представление. Нет scope creep.

### Axis G — Blind spots

1. **Performance** — `onerror="this.style.display='none'"` на каждом `<img>` — для записей без спрайтов (dungeon features, lights, mutations, etc.) браузер сделает HTTP-запрос, получит 404, и только потом скроет элемент. При отображении списка из 600+ записей это сотни 404-запросов. Лучше проверять наличие спрайта на этапе сборки (в frontmatter) и не рендерить `<img>` для записей без спрайта.

2. **Edge cases** — `keyToSpriteUrl` возвращает `/sprites/source/.png` для ключа с одним сегментом (т.к. `parts.length < 2` возвращает `""`). Но если ключ — пустая строка, `parts = [""]`, `parts.length = 1`, вернёт `""`. Корректно. Однако для ключей с пробелами или спецсимволами URL не кодируется — `encodeURIComponent` не применяется.

### Spec compliance

No spec available — spec compliance skipped.

### Questions for the author

1. Почему `source_identity.path` для variant item tables (potion, scroll, wand, charm) указывает на `GLOBALS_C` (`src/brogue/Globals.c`), а не на `GLOBALS_BROGUE_C` (`src/variants/GlobalsBrogue.c`), откуда они фактически парсятся? То же касается `artifactPath` в evidence — строка 444 хардкодит `GLOBALS_C`.
2. Почему `SpriteIcon.astro` не используется во всех компонентах, где нужен спрайт? Вместо этого 7 файлов дублируют `<img src={keyToSpriteUrl(...)} ... onerror=...>`.
3. Как планируется обрабатывать 404-запросы для записей без спрайтов (dungeon features, lights, mutations, etc.) при отображении больших списков?
