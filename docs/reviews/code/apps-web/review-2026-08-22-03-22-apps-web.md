---
reviewId: REVIEW-CODE-2026-08-22-02
date: 2026-08-22
reviewer:
  skill: fo-review
  model: gpt-5
verdict: needs-revision
diffRange: 68e8c933...HEAD
filesReviewed:
  - apps/web/src/components/AuthorityBadge.astro
  - apps/web/src/components/EpistemicBadge.astro
  - apps/web/src/components/RecordAttributes.astro
  - apps/web/src/components/RecordHeader.astro
  - apps/web/src/components/RelationGraph.astro
  - apps/web/src/components/SearchBox.astro
  - apps/web/src/layouts/Base.astro
  - apps/web/src/pages/design.astro
  - apps/web/src/pages/games/index.astro
  - apps/web/src/pages/index.astro
  - apps/web/src/pages/inspiration.astro
  - apps/web/src/styles/global.css
  - tests/web/web-003.test.ts
  - tests/web/web-004.test.ts
---

# Обзор кода: `68e8c933...HEAD`

## Вердикт: требуется доработка

Картографическая дизайн-система последовательно применена, Laboratory честно перенаправляет к grounded dossier, а mobile navigation доступна. Остаются две ложные интерактивные/смысловые аффордансы: `⌘K` показан без обработчика и статичный пример выдаётся за пользовательские ограничения.

## Механическая база

Пройдено:

- `pnpm --filter @roguelike-games-ib/web exec astro check` — 0 ошибок, 0 предупреждений, 0 подсказок.
- `pnpm exec vitest run tests/web/` — 36/36 тестов.
- `git diff --check 68e8c933...HEAD` — без ошибок.

## Ось A — Структурная корректность

1. `apps/web/src/layouts/Base.astro:53` отображает keycap `⌘K`, но в `apps/web/src` нет обработчика `keydown`, `metaKey` или `ctrlKey`. Это ложная интерактивная аффорданса: либо реализовать shortcut, либо убрать keycap.

## Ось B — Соответствие DNA

Файл инвариантов не задан в `forge.yaml`; проверка инвариантов пропущена.

## Ось C — Соответствие экосистеме

Нарушений package boundaries, lifecycle команд или общих контрактов не обнаружено.

## Ось D — Forward-only

Нарушений не обнаружено.

## Ось E — Ясность для агентов

1. `apps/web/src/pages/inspiration.astro:20-25` показывает заранее заданные `Dread`, `Cave exploration` и excluded terms под заголовком `Your constraints`; textarea пуст, и эти значения не связаны с query. Подпись должна явно говорить, что это пример, либо данные должны заполняться фактическим запросом пользователя.

## Ось F — Прагматизм

Новых зависимостей и спекулятивных абстракций не обнаружено. Отказ от обязательного Google Fonts сохраняет работоспособность без сторонней сетевой зависимости.

## Ось G — Слепые зоны

Нарушений не обнаружено: mobile navigation доступна через native `details`, а Laboratory не маскирует canonical search под mutation output.

## Соответствие исходному запросу

| Требование | Статус | Доказательство |
| --- | --- | --- |
| Светлая Design Cartography для canonical knowledge | Выполнено | `apps/web/src/styles/global.css`, `pages/index.astro` |
| Отдельная среда Laboratory | Выполнено | `world="laboratory"` в `pages/inspiration.astro` |
| Не смешивать generated ideas и facts | Выполнено | Laboratory прямо сообщает, что создаёт grounded dossier, а не design seed |
| Короткая responsive navigation | Частично | mobile menu есть; `⌘K` пока не работает |
| Mechanic Anatomy как выразительный паттерн | Частично | record pages используют нумерованные секции, но Laboratory constraints остаются статичным примером |

## Вопросы автору

1. Должен ли `⌘K` открывать search page или фокусировать inline query surface?
2. Нужен ли на Laboratory постоянный пример constraints, или поля должны появляться только после ввода brief?
3. Какой runtime и API будут делать mutation seeds, прежде чем вернуть кнопку генерации?
