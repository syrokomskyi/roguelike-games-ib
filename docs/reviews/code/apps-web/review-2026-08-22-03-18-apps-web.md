---
reviewId: REVIEW-CODE-2026-08-22-01
date: 2026-08-22
reviewer:
  skill: fo-review
  model: gpt-5
verdict: needs-revision
diffRange: uncommitted session changes
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
---

# Обзор кода: незакоммиченные изменения `apps/web`

## Вердикт: требуется доработка

Механическая проверка проходит, а визуальная система последовательно выражает новую картографическую метафору. Однако Laboratory обещает генерацию мутаций, хотя её форма отправляет пользователя в canonical search, а мобильная навигация скрывает все разделы, кроме поиска. Эти расхождения с заявленной моделью продукта должны быть устранены до коммита.

## Механическая база

Пройдено: `pnpm --filter @roguelike-games-ib/web exec astro check` — 0 ошибок, 0 предупреждений, 0 подсказок.

## Ось A — Структурная корректность

1. `apps/web/src/pages/inspiration.astro`: кнопка `Find mutations →` отправляет форму в `/search`, а параметр `authority=laboratory` нигде не обрабатывается в `search.astro`. Это создаёт функционально неверное обещание: пользователь получает canonical search, а не mutation output.

## Ось B — Соответствие DNA

Файл инвариантов не задан в `forge.yaml`; проверка инвариантов пропущена.

## Ось C — Соответствие экосистеме

Нарушений границ пакетов не обнаружено. Новых команд, зависимостей или package-contracts нет.

## Ось D — Forward-only

Нарушений не обнаружено.

## Ось E — Ясность для агентов

1. Laboratory не маркирует текущую реализацию как preview/исследовательский маршрут, хотя фактическая операция — поиск по известной базе. Это смешивает creative intent с фактической возможностью приложения.

## Ось F — Прагматизм

1. `apps/web/src/layouts/Base.astro` добавляет обязательную загрузку шрифтов с Google Fonts для каждой страницы. В проекте уже есть корректные fallback stacks в CSS; внешняя зависимость не нужна для работы интерфейса и добавляет сетевую стоимость.

## Ось G — Слепые зоны

1. В `apps/web/src/layouts/Base.astro` primary navigation целиком скрыта при ширине меньше `md`; остаётся только Search. Это блокирует доступ к Games, Design Space, Compare и Laboratory на телефоне.

## Соответствие исходному запросу

| Требование | Статус | Доказательство |
| --- | --- | --- |
| Светлая canonical-картография с семантическими цветами | Выполнено | `global.css`, `index.astro` |
| Отдельная среда Laboratory | Частично | `world="laboratory"` есть, но форма не ведёт к лабораторной операции |
| Короткая навигация | Частично | desktop-навигация есть; mobile доступ отсутствует |
| Не смешивать generated ideas и facts | Частично | визуальное разделение есть; действие формы ведёт в canonical search |

## Вопросы автору

1. Какой runtime будет реально производить `mutation` output, прежде чем Laboratory снова сможет обещать этот результат?
2. Должна ли Laboratory пока вести в research dossier, явно называя его источниками для будущих мутаций?
3. Нужен ли self-hosted IBM Plex в следующем изменении, или системный fallback — достаточная базовая типографика?
