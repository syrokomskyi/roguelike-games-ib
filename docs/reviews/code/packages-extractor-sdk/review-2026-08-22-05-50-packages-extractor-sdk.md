---
reviewId: REVIEW-CODE-2026-08-22-01
date: 2026-08-22
reviewer:
  skill: fo-review
  model: unknown
verdict: needs-revision
diffRange: b5e6c8916...HEAD
filesReviewed:
  - packages/extractor-sdk/src/sprite.ts
  - packages/extractor-sdk/src/index.ts
  - packages/extractor-sdk/package.json
  - packages/extractors/broguece-extractor/src/extractor.ts
  - apps/web/src/lib/sprite.ts
  - apps/web/src/lib/page-data.ts
  - apps/web/src/components/SpriteIcon.astro
  - apps/web/src/components/CompareTable.astro
  - apps/web/src/components/RecordHeader.astro
  - apps/web/src/components/RelationGraph.astro
  - apps/web/src/components/DesignAncestry.astro
  - apps/web/src/pages/games/[sourceId]/[...filter].astro
  - apps/web/src/pages/games/[sourceId]/definitions/[kind].astro
  - apps/web/src/pages/games/[sourceId]/mechanics.astro
  - apps/web/src/pages/games/[sourceId]/systems.astro
  - apps/web/src/pages/records/[...key].astro
  - apps/web/src/pages/search.astro
  - pnpm-workspace.yaml
---

# Code Review: b5e6c8916...HEAD (sprite architecture refactor)

### Verdict: Needs revision

Рефакторинг успешно убирает BrogueCE-специфичную логику из веб-слоя и переносит generic-утилиту извлечения тайлов в SDK. Однако в diff остались мёртвые импорты, неиспользуемая экспортируемая функция (YAGNI), и дублирование паттерна извлечения `attributes`/`source_identity` по всем страницам.

### Mechanical floor

Pass — `tsc --noEmit` и `astro check` проходят без ошибок для всех затронутых пакетов.

### Axis A — Structural correctness

1. **Dead imports в `broguece-extractor/src/extractor.ts`**: `mkdirSync`, `writeFileSync`, и `dirname` импортированы, но не используются после рефакторинга. `mkdirSync` был нужен для старого `extractSprite`, теперь `extractTileSprite` из SDK делает это сам. `writeFileSync` и `dirname` также не вызываются.
   - `@/packages/extractors/broguece-extractor/src/extractor.ts:46` — `import { writeFileSync, mkdirSync } from "node:fs";`
   - `@/packages/extractors/broguece-extractor/src/extractor.ts:47` — `import { join, dirname } from "node:path";` (`dirname` не используется, `join` используется)

2. **Duplicated Code (Fowler)**: Паттерн `const ra = r as Record<string, unknown>; const attrs = ra["attributes"] as ...; const si = ra["source_identity"] as ...;` повторяется в `page-data.ts` (6 раз), `RecordHeader.astro`, `records/[...key].astro` (2 раза), и каждом вызове `SpriteIcon`. Это кандидат на extraction в helper-функцию типа `getSpritePath(record)` и `getSourceId(record)`.

3. **Primitive Obsession (Fowler)**: `sprite_path: string | null` и `source_id: string` всегда путешествуют вместе как пара. Это естественный кандидат на тип `SpriteRef { spritePath: string | null; sourceId: string }`.

### Axis B — DNA alignment

No invariants file — invariant alignment skipped.

### Axis C — Ecosystem fit

1. **Package boundaries**: Корректны. `extractor-sdk` → `knowledge-core` (через `sharp` dependency). `broguece-extractor` → `extractor-sdk`. `apps/web` → `lib/sprite.ts` (локальный). Нарушений нет.

2. **AGENTS.md compliance**: Все extractor-пакеты остаются под `packages/extractors/`. Новая утилита `sprite.ts` добавлена в `extractor-sdk` (не в extractor), что соответствует правилу "общий код в SDK".

3. **Compass sync**: Не применимо — diff не меняет repository-wide requirements или shared package contracts.

### Axis D — Forward-only compliance

1. **Forward-only**: `keyToSpriteUrl` полностью удалена и заменена на `spritePathToUrl`. Нет shim-слоя или dual-path. Client-side `keyToSpriteUrl` в `search.astro` также удалена. Соответствует forward-only discipline.

### Axis E — Agent-facing clarity

1. **Compass scaffolding**: `packages/extractor-sdk/src/sprite.ts` содержит `MODULE_CONTRACT` и `CHANGE_SUMMARY`. `apps/web/src/lib/sprite.ts` обновлён с записью в `CHANGE_SUMMARY`. Соответствует требованиям.

2. **No ungrounded assertions**: Комментарии и docstrings корректны. JSDoc в `spritePathToUrl` описывает формат `sprite_path` и URL. Нет выдуманных API.

3. **Readable by another agent**: Имена функций и переменных понятны. `spritePathToUrl`, `extractTileSprite`, `spriteExists` — self-documenting.

### Axis F — Pragmatism

1. **Speculative Generality (YAGNI)**: `extractTileSpriteToBuffer` экспортируется из SDK, но не используется ни в одном экстракторе. Это спекулятивная генеральность — функция добавлена "на будущее". Следует удалить до появления реального потребителя.
   - `@/packages/extractor-sdk/src/sprite.ts:48-57` — `extractTileSpriteToBuffer`
   - `@/packages/extractor-sdk/src/index.ts:60` — export

2. **Existing patterns**: Дифф следует существующему паттерну `page-data.ts` (cast to `Record<string, unknown>`, extract `source_identity`). Это консистентно, но сам паттерн — code smell (см. Axis A.2).

3. **Scope discipline**: Дифф затрагивает только sprite-related файлы. Нет scope creep.

### Axis G — Blind spots

1. **Edge cases**: `spritePathToUrl` вызывает `spritePath.split("/").pop()` — если `spritePath` пустая строка, `pop()` вернёт `""`, и функция вернёт `""`. Это безопасно. Если `spritePath` не содержит `/`, `pop()` вернёт всю строку — тоже безопасно.

2. **Performance**: `spriteExists` делает `existsSync` на каждый вызов `SpriteIcon` при build-time. Для страниц с 50+ записями это 50+ sync I/O вызовов. Приемлемо для static build, но стоит отметить.

3. **Migration path**: Существующие спрайты в `apps/web/public/sprites/broguece/` продолжают работать, потому что `spritePathToUrl` строит тот же URL (`/sprites/broguece/bog_monster.png`). Миграция прозрачна.

### Spec compliance

No spec available — spec compliance skipped.

### Questions for the author

1. `extractTileSpriteToBuffer` экспортируется, но не имеет потребителей. Удалить или оставить до появления реального use case?
2. `mkdirSync`, `writeFileSync`, `dirname` в `broguece-extractor/src/extractor.ts` — мёртвые импорты после рефакторинга. Удалить?
3. Паттерн извлечения `attributes.sprite_path` и `source_identity.source_id` дублируется в 10+ местах. Вынести в helper `getSpriteRef(record)` в `page-data.ts`?
