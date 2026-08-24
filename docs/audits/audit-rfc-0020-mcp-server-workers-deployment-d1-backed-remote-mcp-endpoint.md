---
rfcId: RFC-0020
auditId: AUDIT-RFC-0020-01
date: 2026-08-24
auditor:
  skill: fo-idea-audit
  model: claude-sonnet-4-20250514
verdict: needs-revision
---

# Audit: RFC-0020

## Verdict: Needs revision

RFC-0020 содержит критические фактические ошибки об архитектуре `projection-sdk`. RFC утверждает, что `projection-sdk` использует SQLite, но на самом деле он читает JSONL/JSON файлы через `node:fs`. Кроме того, `ProjectionStore` — это конкретный класс с приватным конструктором и in-memory массивами, а не интерфейс, что делает `D1ProjectionStore extends ProjectionStore` невозможным без предварительной рефакторинга. Инструмент-хендлеры напрямую обращаются к `ctx.store.records` (массивам), что требует изменения всех хендлеров при переходе на D1 — это противоречит заявлению "No tool changes". Также неверный импорт `@cloudflare/agents` (правильно: `agents/mcp`).

## Mechanical validation (rfc.validate)

**Pass** — 0 violations.

## Axis A — Structural completeness

- **Decision** — D1–D6 описывают решения в настоящем времени, но D1 содержит фактическую ошибку: "The D1 schema matches the existing SQLite schema used by projection-sdk" — `projection-sdk` не использует SQLite. Схема D1 должна соответствовать JSONL/JSON структуре материализованных файлов, не SQLite-схеме.
- **TypeScript contracts** — контракт `D1ProjectionStore extends ProjectionStore` (@docs/rfcs/rfc-0020-mcp-server-workers-deployment-d1-backed-remote-mcp-endpoint.md:139) некорректен: `ProjectionStore` — класс с приватным конструктором (@packages/projection-sdk/src/open.ts:38), его нельзя расширить. Нужно сначала извлечь интерфейс `IProjectionStore`.
- **File system responsibilities** — таблица не упоминает `packages/search` (используется `better-sqlite3` через `buildSearchIndex`), хотя поиск также несовместим с Workers.
- **Failure modes** — не указаны HTTP status codes для MCP error responses (только "500 status" для D1 query failure, но не для search API unreachable).
- **Rollout** — шаг 5 говорит "Each tool handler that currently uses `ctx.store` (SqliteProjectionStore)" — нет такого класса `SqliteProjectionStore`. Текущий класс называется `ProjectionStore` (@packages/projection-sdk/src/open.ts:25).
- **Acceptance criteria** — критерий "All 30+ existing MCP tools work against D1-backed data" (@docs/rfcs/rfc-0020-mcp-server-workers-deployment-d1-backed-remote-mcp-endpoint.md:37) не уточняет, как проверять работу инструментов в Workers режиме (MCP inspector? integration test?).
- **Implementation notes** — утверждают "No tool changes: Do not modify tool names, descriptions, or input schemas" (@docs/rfcs/rfc-0020-mcp-server-workers-deployment-d1-backed-remote-mcp-endpoint.md:210), но хендлеры инструментов напрямую обращаются к `ctx.store.records` (массив), `ctx.store.claims` (массив) и т.д. (@apps/mcp/src/tools/definitions.ts:24, @apps/mcp/src/tools/search.ts:41). D1-backed store не может предоставлять in-memory массивы — хендлеры должны быть изменены.

## Axis B — DNA alignment

- `satisfies: []` — RFC не декларирует DNA-инварианты. `invariantsFile: null` в `forge.yaml`, что согласуется с предыдущими RFC (`kind: policy`, `satisfies: []`). Нет проблем.
- `related: [RFC-0018, RFC-0010]` — оба корректны: RFC-0018 упоминает RFC-0020 как отдельный RFC для MCP deployment (@docs/rfcs/rfc-0018-public-api-deployment.md:46), RFC-0010 описывает search API и MCP search tools.

## Axis C — Ecosystem fit

- **Package boundaries** — RFC предлагает `D1ProjectionStore` в `packages/projection-sdk/src/d1-store.ts`. Это корректно — пакет `projection-sdk` уже экспортирует `ProjectionStore`. Однако `packagesImpacted` указывает только `projection-sdk`, но не `search`. Пакет `@roguelike-games-ib/search` (@packages/search/src/build.ts:13) использует `better-sqlite3` для `buildSearchIndex`, и `McpContext.searchIndex` (@apps/mcp/src/context.ts:22) не может быть построен в Workers. RFC должен либо включить `search` в `packagesImpacted`, либо явно объяснить, как `McpContext` адаптируется для Workers (замена `searchIndex` на HTTP-клиент к search API).
- **AGENTS.md updates** — RFC упоминает `apps/mcp/AGENTS.md` в acceptance criteria (@docs/rfcs/rfc-0020-mcp-server-workers-deployment-d1-backed-remote-mcp-endpoint.md:204), но не упоминает обновление `packages/projection-sdk/AGENTS.md` (если существует) или root `AGENTS.md` для документирования dual-mode архитектуры.
- **Command lifecycle** — `commands.proposed/added/changed/removed` все пустые. RFC не вводит новые CLI-команды (использует `wrangler` напрямую). Это корректно.

## Axis D — Forward-only compliance

- **Dual-mode architecture** — RFC явно сохраняет локальный stdio режим (@docs/rfcs/rfc-0020-mcp-server-workers-deployment-d1-backed-remote-mcp-endpoint.md:87-89). Это не backward compatibility layer — это два независимых режима для разных сред. Forward-only compliance не нарушена.
- **No legacy paths** — RFC не предлагает флаги для переключения между режимами. Каждый режим имеет свой entry point (`index.ts` vs `worker.ts`). Корректно.

## Axis E — Agent-facing policy

- **Status gate** — RFC содержит "Status gate" в implementation notes (@docs/rfcs/rfc-0020-mcp-server-workers-deployment-d1-backed-remote-mcp-endpoint.md:208). Нет self-authorizing language. Корректно.
- **Anti-fabrication** — acceptance criteria не требуют content authoring. Все критерии — кодовые изменения, проверяемые агентом.
- **Storage policy** — RFC не вводит cookies или client-side persistence. D1 — server-side storage. Корректно.
- **NEEDS CLARIFICATION markers** — не найдены.

## Axis F — Pragmatism

- **Import path** — RFC использует `import { McpAgent } from "@cloudflare/agents"` (@docs/rfcs/rfc-0020-mcp-server-workers-deployment-d1-backed-remote-mcp-endpoint.md:122). Согласно Cloudflare docs, правильный импорт: `import { McpAgent } from "agents/mcp"`. Пакет на npm называется `agents`, не `@cloudflare/agents`.
- **MCP SDK integration** — RFC упоминает `@modelcontextprotocol/sdk` как зависимость (@docs/rfcs/rfc-0020-mcp-server-workers-deployment-d1-backed-remote-mcp-endpoint.md:151), но не адресует конвертацию существующих JSON Schema input schemas в zod schemas, которые требуются `McpServer.tool()` из Agents SDK. Существующие tool definitions используют `inputSchema: { type: "object", properties: {...} }` (@apps/mcp/src/server.ts:87), а Agents SDK ожидает zod-схемы. Это значительный объём работы, не упомянутый в RFC.
- **`McpAgent.serve()` vs `createMcpHandler`** — RFC упоминает `createMcpHandler` (@docs/rfcs/rfc-0020-mcp-server-workers-deployment-d1-backed-remote-mcp-endpoint.md:214), но Cloudflare docs рекомендуют `McpAgent.serve("/mcp")` как простой подход. RFC должен использовать `serve()`.
- **`packagesImpacted`** — указан только `projection-sdk`, но `search` также затронут (search index несовместим с Workers). Нужно добавить `search` или объяснить, почему `McpContext.searchIndex` не нужен в Workers режиме.
- **Scope discipline** — `nonGoals` корректны и осмысленны. `appsImpacted: [mcp]` — корректно.

## Axis G — Blind spots

- **ProjectionStore architecture** — `ProjectionStore` загружает ВСЕ данные в память при конструировании (@packages/projection-sdk/src/open.ts:70-82): records, claims, relations, evidence, coverage, sources, keyMap, aliasMap. `D1ProjectionStore` не может предоставить in-memory массивы без предварительной загрузки всех данных из D1 (что лишает смысла D1). Инструмент-хендлеры используют `ctx.store.records.filter(...)` (@apps/mcp/src/tools/definitions.ts:24), `ctx.store.claims.filter(...)` и т.д. — это in-memory array operations. При D1 каждый доступ должен быть SQL-запросом. RFC не рассматривает этот архитектурный разрыв.
- **McpContext interface** — `McpContext` (@apps/mcp/src/context.ts:18-28) включает `searchIndex: SearchIndex` и `store: ProjectionStore`. В Workers режиме `searchIndex` не может быть построен (требует `better-sqlite3`), а `store` не может быть `ProjectionStore` (требует `node:fs`). RFC не предлагает модифицированный `McpContext` для Workers.
- **D1 row limits** — RFC упоминает ~22K records, ~113K claims, ~36K relations (@docs/rfcs/rfc-0020-mcp-server-workers-deployment-d1-backed-remote-mcp-endpoint.md:187). Claims table (113K) превышает free tier limit (100K). Mitigation — Workers Paid ($5/month). Это правильно, но RFC должен указать, что Workers Paid обязателен, не опционален.
- **D1 schema** — RFC говорит "The D1 schema matches the existing SQLite schema used by projection-sdk" (@docs/rfcs/rfc-0020-mcp-server-workers-deployment-d1-backed-remote-mcp-endpoint.md:65), но `projection-sdk` не имеет SQLite-схемы. Материализатор (`packages/materializer`) создаёт `knowledge.sqlite` для search index (@packages/search/src/build.ts:49), но projection-sdk читает JSONL/JSON файлы. D1-схема должна быть создана с нуля на основе JSONL структуры.
- **Export script** — `scripts/export-to-d1.ts` (@docs/rfcs/rfc-0020-mcp-server-workers-deployment-d1-backed-remote-mcp-endpoint.md:153) должен читать JSONL/JSON из `.generated/knowledge/dist/` и загружать в D1. RFC не описывает D1 table schema (CREATE TABLE statements).
- **Concurrency** — RFC не рассматривает concurrent D1 queries от множественных MCP-клиентов. D1 поддерживает concurrent reads, но RFC должен подтвердить это.

## Questions for the author

1. Как `D1ProjectionStore` будет реализовать `records: CanonicalRecord[]` (public readonly array на `ProjectionStore`)? Инструмент-хендлеры обращаются к `ctx.store.records.filter(...)` напрямую — D1 не может предоставить in-memory массив без загрузки всех данных. Нужно ли извлекать интерфейс `IProjectionStore` и переписывать все хендлеры на методы интерфейса вместо прямого доступа к массивам?

2. Как `McpContext` будет модифицирован для Workers? Текущий интерфейс требует `searchIndex: SearchIndex` (строится через `better-sqlite3`) и `store: ProjectionStore` (строится через `node:fs`). RFC не описывает альтернативный `WorkersMcpContext` или модификацию существующего.

3. Как существующие JSON Schema input schemas будут конвертированы в zod schemas для `McpServer.tool()` из Agents SDK? RFC добавляет `@modelcontextprotocol/sdk` как зависимость, но не описывает конвертацию 34 tool schemas.
