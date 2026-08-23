---
reviewId: REVIEW-CODE-2026-08-23-01
date: 2026-08-23
reviewer:
  skill: fo-review
  model: unknown
verdict: needs-revision
diffRange: 36f3e3f2f71...HEAD
filesReviewed:
  - scripts/run-stage-coverage.ts
  - scripts/run-stage13-crawl.ts
  - knowledge/sources/bindings.yaml
  - knowledge/baselines/record-counts-baseline.json
  - knowledge/coverage/crawl.jsonl
  - knowledge/coverage/nethack.jsonl
  - knowledge/coverage/cataclysm-bn.jsonl
  - docs/rfcs/rfc-0006-extractor-expansion-next-tier.md
---

# Code Review: 36f3e3f2f71...HEAD (RFC-0006 implementation)

### Verdict: Needs revision

Дифф содержит данные и конфигурационные изменения для RFC-0006 — обновление coverage-скрипта с новыми измерениями, обновление fingerprint для Crawl, и обновление baseline. Изменения корректны, но есть одна находка по Axis E.

### Mechanical floor

Pass — `tsc --noEmit` показывает только предсуществующие ошибки в `apps/search-api` и `tests/mig`, не связанные с данным диффом. Все 671 conformance-тестов проходят.

### Axis A — Structural correctness

No issues. Изменения в `scripts/run-stage-coverage.ts` — простые вызовы `makeDimension()` с тем же паттерном, что и существующие измерения. Числа соответствуют manifest-данным экстракторов.

### Axis B — DNA alignment

No invariants file — invariant alignment skipped.

### Axis C — Ecosystem fit

No issues. Coverage-скрипт обновлён в соответствии с manifest-декларациями экстракторов. Fingerprint обновлён для отражения скопированных `.h` файлов в `dat/`.

### Axis D — Forward-only compliance

No issues. Нет обратной совместимости — старые fingerprint и binding_digest заменены новыми.

### Axis E — Agent-facing clarity

- **Finding E-1**: `scripts/run-stage13-crawl.ts` содержит хардкоженные `FINGERPRINT` и `BINDING_DIGEST` (строки 25-26). Эти же значения дублируются в `knowledge/sources/bindings.yaml` и `scripts/run-stage-coverage.ts`. Если source tree изменится, нужно обновить три места. Это не блокирующая находка для data-only диффа, но стоит отметить как технический долг.

### Axis F — Pragmatism

No issues. Изменения минимальны и точечны — только необходимые обновления для новых измерений coverage и fingerprint.

### Axis G — Blind spots

No issues. Изменения не затрагивают пользовательские данные, PII или внешние сервисы.

### Spec compliance

| Требование RFC-0006 | Статус | Evidence |
|---|---|---|
| Crawl gods (~30, deity) | Done | 27 records, god-type.h |
| Crawl piety rewards (~150, ability) | Missing | Нет `dat/gods/*.yaml` в source tree; piety в C++ коде |
| Crawl brands (~30, item) | Done | 37 records, item-prop-enum.h |
| Crawl item types (~200, item) | Done | 20 records, object-class-type.h |
| Crawl clouds (~15, effect) | Done | 40 records, cloud-type.h |
| NetHack attack types (~20, damage_type) | Done | 17 records, monattk.h |
| NetHack monster abilities (~40, ability) | Done | 72 records, monflag.h |
| CB martial arts (~30, ability) | Done | 31 records, martialarts.json |
| CB NPC classes (~50, npc) | Done | 30 records, npcs/classes.json |
| CB monster groups (~50, spawn_table) | Done | 200 records, monstergroups/*.json |
| Coverage contracts exhaustive | Done | All new dimensions exhaustive_for_binding |
| Deriver claims+relations | Done | 113,448 claims, 35,418 relations |
| Conformance tests pass | Done | 671 tests, 0 failures |
| KB grows ~600-700 records | Partial | +474 records (22,002 → 22,476) |

### Questions for the author

1. Crawl piety rewards пропущены — стоит ли создать отдельный RFC для парсинга C++ исходников (religion.cc, ability.cc), или это приемлемый gap?
2. Хардкоженный fingerprint в `run-stage13-crawl.ts` — стоит ли вынести в общую конфигурацию, чтобы избежать дублирования с `bindings.yaml`?
