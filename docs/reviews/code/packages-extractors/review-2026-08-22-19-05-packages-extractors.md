---
reviewId: REVIEW-CODE-2026-08-22-01
date: 2026-08-22
reviewer:
  skill: fo-review
  model: unknown
verdict: needs-revision
diffRange: ff2ae07d6...HEAD
filesReviewed:
  - packages/extractors/broguece-extractor/src/extractor.ts
  - packages/extractors/cataclysm-bn-extractor/src/extractor.ts
  - packages/extractors/crawl-extractor/src/extractor.ts
  - packages/extractors/crawl-extractor/src/index.ts
  - packages/extractors/crawl-extractor/src/sprite-pipeline.ts
  - packages/extractors/crawl-extractor/src/yaml-parser.ts
  - packages/extractors/nethack-extractor/src/extractor.ts
  - tests/extractor-quality/broguece-quality.test.ts
  - tests/extractor-quality/crawl-quality.test.ts
  - tests/extractor-quality/guard.test.ts
  - tests/extractor-quality/harness.ts
  - scripts/pre-commit-quality.sh
  - turbo.json
  - package.json
  - tests/conformance/c13-crawl.test.ts
  - scripts/run-stage13-crawl.ts
---

# Code Review: ff2ae07d6...HEAD — native_id namespacing + sprite extraction for crawl

### Verdict: Needs revision

Дифф вносит kind-prefixed native_ids во всех четырёх экстракторах, добавляет sprite extraction для Crawl и помечает deprecated species. Изменения функционально корректны (222 теста проходят), но содержат hardcoded абсолютный путь, dead code, отсутствующие MODULE_CONTRACT и magic numbers — всё это требует исправления.

### Mechanical floor

Pass — все четыре пакета (`crawl-extractor`, `broguece-extractor`, `cataclysm-bn-extractor`, `nethack-extractor`) проходят `tsc --noEmit` без ошибок.

### Axis A — Structural correctness

1. **Hardcoded абсолютный путь** — `sprite-pipeline.ts:10` содержит `resolve("/home/syrokomskyi/projects/roguelike-games-ib-source/crawl/crawl-ref/source/rltiles")`. Это нарушает портативность и не будет работать на другой машине. Источник данных должен передаваться через `ExtractorContext` (как `ctx.source.readBytes` в BrogueCE), а не захардкожен. **Fail.**

2. **Dead code: `getSpritePath`** — метод `getSpritePath` в `CrawlSpritePipeline` (строка 6, 37–41) объявлен в интерфейсе и реализован, но нигде не вызывается. **Fail.**

3. **Unused import: `statSync`** — `sprite-pipeline.ts:1` импортирует `statSync` из `node:fs`, но нигде не использует. **Fail.**

4. **Magic numbers: `tile_coords`** — `extractor.ts:90` содержит `tile_coords: { x: 0, y: 0, w: 32, h: 32 }`. Числа 32 не объяснены и не вынесены в именованную константу. Для Crawl спрайтов это не tilemap-координаты, а фиктивные значения — это стоит задокументировать или использовать `null`. **Fail.**

5. **Bare `catch` blocks** — `extractor.ts:64` и `sprite-pipeline.ts:56` содержат `catch` без перехвата ошибки и без логирования. Ошибки парсинга YAML и копирования PNG тихо проглатываются. **Fail.**

6. **`EntitySpec<any>[]`** — `extractor.ts:201` использует `any` для массива specs. Это существующий паттерн (BrogueCE делает так же), но технически нарушает strict typing. **Pass** (соответствует существующему паттерну в кодовой базе).

7. **`any` в conformance test** — `c13-crawl.test.ts:29,31,53,63,76` использует `any[]` и `any` для записей и registry. Это тестовый код, но всё же нарушение strict typing. **Fail.**

### Axis B — DNA alignment

No invariants file — invariant alignment skipped.

### Axis C — Ecosystem fit

1. **Package boundaries** — импорты следуют правилу `tests/* → packages/*` и `packages/extractors/* → packages/extractor-sdk`. **Pass.**

2. **AGENTS.md compliance** — все extractor packages находятся под `packages/extractors/`. **Pass.**

3. **Compass sync** — дифф не обновляет `docs/*.xml` файлы, но добавляет новый extractor (`crawl-extractor`). Если Compass требует синхронизации при добавлении новых пакетов, это может быть упущением. **Pass** (неясно, требуется ли обновление).

### Axis D — Forward-only compliance

1. **Native_id namespacing** — изменение `getNativeId` с `m.id` на `monster:${m.id}` является breaking change для существующих canonical records. Дифф правильно re-promote'ит все canonical records, чтобы обновить ключи. Старые ключи не сохраняются как shim. **Pass.**

2. **Harness Q-008 threshold** — добавление `spriteCoverageThreshold` меняет контракт Q-008 со строгого 100% на настраиваемый. Это прямое изменение контракта, не dual-path. **Pass.**

### Axis E — Agent-facing clarity

1. **Отсутствует `MODULE_CONTRACT`** — новые файлы `sprite-pipeline.ts` и `crawl-quality.test.ts` не содержат `MODULE_CONTRACT` и `CHANGE_SUMMARY` заголовков. Все существующие модули в BrogueCE extractor имеют эти заголовки. **Fail.**

2. **Отсутствует `MODULE_CONTRACT` в `guard.test.ts`** — новый тестовый файл без contract. **Fail.**

3. **Отсутствует `MODULE_CONTRACT` в `c13-crawl.test.ts`** — новый тестовый файл без contract. **Fail.**

4. **Mysterious Name: `findPngByName`** — функция ищет PNG по имени, но делает это рекурсивно по всем поддиапазонам. Имя не отражает рекурсивный характер. → `findPngRecursive` было бы точнее. **Fail** (minor).

### Axis F — Pragmatism

1. **Duplicated code: `findPngByName` вызывается дважды** — в `extractSprite` (строки 47–48) `findPngByName` вызывается сначала для `mon/`, потом для корня `rltiles/`. `getSpritePath` делает то же самое (строки 39–41). Логика дублируется между двумя методами. **Fail.**

2. **No caching for PNG lookup** — `findPngByName` выполняет полный рекурсивный обход директории для каждого из 680 монстров. Можно построить индекс `Map<string, string>` один раз при создании pipeline. **Fail.**

3. **`process.cwd()` для выходной директории** — `sprite-pipeline.ts:13` использует `process.cwd()` для определения пути вывода спрайтов. Это хрупко — зависит от того, откуда запускается процесс. BrogueCE делает так же, но это стоит исправить в обоих. **Pass** (соответствует существующему паттерну).

4. **Scope discipline** — дифф затрагивает только экстракторы и тесты. Нет scope creep. **Pass.**

### Axis G — Blind spots

1. **Performance: recursive PNG lookup** — `findPngByName` обходит ~1533 файла в `rltiles/mon/` для каждого из 680 монстров. В худшем случае это 680 × 1533 = ~1M file system calls. Тест Q-006 проходит (под 30s), но это неэффективно. **Fail.**

2. **Edge cases: `program_bug` и `tile_unseen`** — спрайты с tile=`program_bug` пропускаются, но монстры с такими tile всё равно получают `tile_coords: { x: 0, y: 0, w: 32, h: 32 }` и `sprite_path: null`. Q-008 проверяет `tile_coords != null`, поэтому они проходят. Но логически `tile_coords` для записи без спрайта не имеет смысла. **Pass** (тесты проходят, но семантика спорна).

3. **Migration path** — re-promotion canonical records выполнен для всех четырёх экстракторов. **Pass.**

### Spec compliance

| Требование | Статус | Evidence |
|---|---|---|
| Namespace native_ids во всех экстракторах | Done | `monster:`, `creature:`, `mons:`, `species:`, `job:` prefixes в extractor.ts |
| Помечать deprecated species boolean field | Done | `deprecated: path.startsWith("species/deprecated-")` в `yaml-parser.ts:133` |
| Sprite extraction для Crawl (tile field) | Done | `sprite-pipeline.ts` + `extractSprite` в `extractor.ts:89` |
| Sprite extraction для других экстракторов | Partial | BrogueCE уже имеет sprite extraction. Cataclysm-BN и NetHack не имеют (нет readily available PNG data) |
| Quality tests на все экстракторы | Done | 222 теста проходят |
| Re-promote canonical records | Done | Все 4 stage scripts выполнены |

### Questions for the author

1. Почему `RLTILES_ROOT` захардкожен как абсолютный путь вместо использования `ctx.source`? BrogueCE читает `tiles.png` через `ctx.source.readBytes()` — почему Crawl не может делать так же для `rltiles/`?
2. `getSpritePath` объявлен в интерфейсе, но нигде не вызывается — это dead code или планируется использовать в будущем?
3. `tile_coords: { x: 0, y: 0, w: 32, h: 32 }` — это фиктивные значения для записей без tilemap. Почему не `null`? Q-008 проверяет `tile_coords != null`, но семантически coords для отдельного PNG не имеют смысла.
