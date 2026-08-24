---
rfcId: RFC-0016
auditId: AUDIT-RFC-0016-01
date: 2026-08-24
auditor:
  skill: fo-idea-audit
  model: claude-sonnet-4-20250514
verdict: needs-revision
---

# Audit: RFC-0016

## Вердикт: Needs revision

RFC содержит 4 предупреждения V-13 (отсутствуют обязательные разделы: `## Design`, `## Alternatives considered`, `## Risks`, `## Implementation notes for agents`). Семантический аудит выявил: отсутствие agent-facing behavioral rules (status gate, MODULE_CONTRACT, CI gates), неопределённую логику генерации rationale, необоснованное отклонение от паттерна размещения tool-функций в `derived.ts`, и неадресованные edge cases (отсутствие `quality_score`, игры без pattern coverage).

### Механическая валидация (rfc.validate)

**Pass** — 0 errors, 4 warnings:

- **V-13 (warning)**: Отсутствует раздел `## Design`.
- **V-13 (warning)**: Отсутствует раздел `## Alternatives considered` (раздел `## Alternatives` на line 124 не соответствует требуемому имени).
- **V-13 (warning)**: Отсутствует раздел `## Risks`.
- **V-13 (warning)**: Отсутствует раздел `## Implementation notes for agents`.

### Ось A — Структурная полнота

1. **Отсутствует `## Design`**: RFC embeds TypeScript-like contracts в D1 (score formula) и D2 (tool input/output), но нет отдельного раздела `## Design` с TypeScript type signatures и edge cases. Сравните с RFC-0013, RFC-0011, RFC-0009 — все имеют полноценный `## Design`.

2. **`## Alternatives` vs `## Alternatives considered`**: Раздел на line 124 назван `## Alternatives`, но требуемое имя — `## Alternatives considered`. Содержание есть (3 альтернативы с причинами rejection), но имя не соответствует валидатору.

3. **Отсутствует `## Risks`**: Нет раздела рисков вообще. Не рассмотрены: false positives в рекомендациях, субъективность sensation-to-concept mapping, drift при изменении concept keys, performance client-side computation.

4. **Отсутствует `## Implementation notes for agents`**: Нет agent-facing behavioral rules. Все реализованные RFC (RFC-0009, RFC-0011, RFC-0013) содержат этот раздел с правилами: status gate, MODULE_CONTRACT, CI gates, content vs code distinction.

5. **`## Rollout` минимальный**: Содержит только нумерованный список файлов (6 пунктов). Не описано: default behavior, adoption path, что произойдёт при первом `pnpm materialize` после внедрения.

6. **Acceptance criteria частично проверяемые**: "Unknown sensations fall back to semantic search" — как это проверить? Нужен конкретный тест-кейс (например: "sensation 'boredom' not in SENSATION_MAP → tool uses search_design_space → returns results").

### Ось B — DNA alignment

`invariantsFile: null` в `forge.yaml` — DNA-инвариантов нет в проекте. `satisfies: []` консистентно с предыдущими RFC. No issues.

### Ось C — Ecosystem fit

1. **Отклонение от паттерна размещения MCP tools**: RFC предлагает `apps/mcp/src/tools/recommend.ts` — новый файл. Все существующие tool-функции (29 tools) находятся в `derived.ts`, `design.ts`, `records.ts`, `search.ts` и т.д. `derived.ts` уже содержит `generateDesignSeed`, `findDesignPatterns`, `searchDesignSpace` — близкие по domain функции. RFC должен обосновать отдельный файл или использовать `derived.ts`.

2. **Web app conventions**: RFC не упоминает `MODULE_CONTRACT` и `CHANGE_SUMMARY` требования для новых `.astro` файлов (`apps/web/AGENTS.md` требует этого). `apps/web/src/lib/recommend.ts` и `apps/web/src/pages/recommend.astro` — оба требуют compass scaffolding.

3. **MCP tool registration pattern**: RFC правильно указывает регистрацию в `server.ts` и добавление в `REQUIRED_TOOLS`. Паттерн соответствует существующим tools. OK.

4. **Дублирование SENSATION_MAP**: RFC использует `SENSATION_MAP` из RFC-0013. В кодовой базе SENSATION_MAP уже дублирована между `apps/mcp/src/tools/sensation-map.ts` и `apps/web/src/lib/sensation-map.ts`. RFC не упоминает, что recommend feature будет использовать существующие copies. OK, но стоит явно указать.

5. **`searchDesignSpace` reference в D5**: RFC ссылается на `searchDesignSpace` (RFC-0010) для fallback. Функция существует в `derived.ts` и зарегистрирована как `search_design_space` в `server.ts`. OK.

### Ось D — Forward-only compliance

RFC purely additive — новый tool, новая страница. No backward compatibility layers, no shims, no dual paths. No issues.

### Ось E — Agent-facing policy

1. **Нет status gate**: RFC не содержит правила "must be in `accepted` status before implementation begins". Все реализованные RFC содержат это правило.

2. **Нет MODULE_CONTRACT упоминания**: Новые файлы в `apps/web/` требуют `MODULE_CONTRACT` и `CHANGE_SUMMARY` comments per `apps/web/AGENTS.md`. RFC не упоминает это требование.

3. **Нет CI gates упоминания**: RFC не указывает, что all CI checks must pass (`pnpm materialize`, `pnpm exec turbo run build:check`, `pnpm exec vitest --run`).

4. **Нет content vs code distinction**: `SENSATION_MAP` — curated content. RFC не уточняет, что agent пишет code structure, но sensation-to-concept associations требуют human review.

5. **No `NEEDS CLARIFICATION` markers**: None found. OK.

6. **Storage policy**: No persistence concerns — RFC read-only. OK.

### Ось F — Pragmatism

1. **Новый файл `recommend.ts` вместо `derived.ts`**: Все 29 существующих MCP tool-функций распределены по domain-specific файлам. `derived.ts` содержит `generateDesignSeed`, `findDesignPatterns`, `searchDesignSpace` — функции того же domain (design space / sensations). Отдельный файл `recommend.ts` не обоснован.

2. **Lean contracts**: Output shape `{ source_id, score, matched_patterns, matched_primitives, rationale }` — минимальный и достаточный. OK.

3. **Scope discipline**: `appsImpacted: [mcp, web]` — корректно. `packagesImpacted: []` — корректно. `nonGoals` meaningful (no user accounts, no collaborative filtering, no external games). OK.

4. **Rollout шаги**: 6 шагов конкретны и выполнимы. Но шаг 6 ("Add conformance test") не указывает конкретный test file name или test cases.

### Ось G — Blind spots

1. **Отсутствие `quality_score` fallback**: Score formula (D1) использует `concept.quality_score.overall`. Что если concept не имеет `quality_score` (e.g., materialized before RFC-0009)? RFC-0009 определяет fallback: `quality_score: null`. RFC-0016 должен указать fallback weight (e.g., weight = 1.0 если score missing).

2. **Игры без pattern coverage**: Если game не присутствует ни в одном `games_where_present` для relevant patterns, score = 0. Должна ли такая игра включаться в результаты? `min_score` default = 0.1 — это отфильтрует, но RFC не объясняет выбор порога.

3. **Rationale generation logic**: D4 показывает пример rationale, но не определяет логику генерации. Это template? LLM? Структура примера сложная (pattern names + primitive lists + counts). Нужна спецификация: template-based generation с конкретными placeholder'ами.

4. **Client-side data size**: RFC говорит "serialize sensation map and game presence data" для web. Не указан размер данных. С 4 играми, 10 patterns, 15 primitives, 31 pressures — данные минимальны (<10KB). Стоит явно указать.

5. **Multiple sensations aggregation**: D1 шаг 5 говорит "Rank games by aggregate score across all requested sensations". Но не указано, как агрегировать — average? sum? weighted? Это влияет на ranking.

### Вопросы автору

1. Почему предлагается отдельный файл `apps/mcp/src/tools/recommend.ts` вместо добавления `recommendGames()` в существующий `derived.ts`, где находятся все 29 tool-функций включая `generateDesignSeed` и `findDesignPatterns` из того же domain?

2. Как генерируется rationale (D4)? Пример показывает сложный текст с pattern names, primitive lists и counts. Это template-based? Если да — приведите template. Если LLM — укажите caching strategy и fallback.

3. Что произойдёт если `quality_score` отсутствует у concept? Score formula зависит от `concept.quality_score.overall`. Какой fallback weight использовать?

4. Как агрегируются scores для multiple sensations (D1 шаг 5)? Average, sum, weighted average? Это влияет на ranking и не specified.
