import type { McpContext } from "./context.ts";
import { getDatasetInfo } from "./tools/dataset.ts";
import { listSources, getSourceStatus } from "./tools/sources.ts";
import { getRecord, resolveKey } from "./tools/records.ts";
import { searchRecords } from "./tools/search.ts";
import { listDefinitions } from "./tools/definitions.ts";
import { findMechanics, findSystems } from "./tools/mechanics.ts";
import { traverseRelations } from "./tools/graph.ts";
import { getClaims } from "./tools/claims.ts";
import { getEvidence } from "./tools/evidence.ts";
import { compareRecords, compareGames } from "./tools/compare.ts";
import { findCrossGameConcepts, findDesignPrimitives, queryDesignSpace } from "./tools/design.ts";
import { getCoverage } from "./tools/coverage.ts";

export type ToolHandler<I = unknown, O = unknown> = (ctx: McpContext, input: I) => O | Promise<O>;

export interface ToolDefinition<I = unknown, O = unknown> {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: ToolHandler<I, O>;
  readOnly: boolean;
}

export interface ToolRegistry {
  tools: Map<string, ToolDefinition>;
  register<I, O>(def: ToolDefinition<I, O>): void;
  list(): Array<{ name: string; description: string; inputSchema: Record<string, unknown> }>;
  call(name: string, ctx: McpContext, input: unknown): Promise<unknown>;
  has(name: string): boolean;
}

export function createToolRegistry(): ToolRegistry {
  const tools = new Map<string, ToolDefinition>();

  return {
    tools,

    register(def) {
      tools.set(def.name, def as ToolDefinition);
    },

    list() {
      return Array.from(tools.values()).map((t) => ({
        ...t,
        description: t.description,
        inputSchema: t.inputSchema,
      }));
    },

    async call(name: string, ctx: McpContext, input: unknown): Promise<unknown> {
      const def = tools.get(name);
      if (!def) {
        throw new Error(`Unknown tool: ${name}`);
      }
      const result = def.handler(ctx, input);
      return result instanceof Promise ? result : Promise.resolve(result);
    },

    has(name) {
      return tools.has(name);
    },
  };
}

export function createMcpToolRegistry(): ToolRegistry {
  const registry = createToolRegistry();

  registry.register({
    name: "get_dataset_info",
    description: "Returns dataset/model version, canonical hash, license, source count, record counts.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    handler: getDatasetInfo,
    readOnly: true,
  });

  registry.register({
    name: "list_sources",
    description: "List all registered sources with pagination.",
    inputSchema: {
      type: "object",
      properties: {
        cursor: { type: "string" },
        limit: { type: "integer", minimum: 1, maximum: 100 },
      },
      additionalProperties: false,
    },
    handler: listSources,
    readOnly: true,
  });

  registry.register({
    name: "get_source_status",
    description: "Get status and coverage for a specific source.",
    inputSchema: {
      type: "object",
      properties: { source_id: { type: "string" } },
      required: ["source_id"],
      additionalProperties: false,
    },
    handler: getSourceStatus,
    readOnly: true,
  });

  registry.register({
    name: "get_record",
    description: "Get a record by id or key. Exactly one of id or key is required.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        key: { type: "string" },
      },
      additionalProperties: false,
    },
    handler: getRecord,
    readOnly: true,
  });

  registry.register({
    name: "resolve_key",
    description: "Resolve a key or alias to the current record.",
    inputSchema: {
      type: "object",
      properties: { key_or_alias: { type: "string" } },
      required: ["key_or_alias"],
      additionalProperties: false,
    },
    handler: resolveKey,
    readOnly: true,
  });

  registry.register({
    name: "search_records",
    description: "Search records using hybrid/lexical/vector retrieval. Scores are relevance signals, not confidence.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        filters: {
          type: "object",
          properties: {
            source_id: { type: "string" },
            record_type: { type: "string" },
            kind: { type: "string" },
            epistemic_status: { type: "string" },
          },
        },
        mode: { type: "string", enum: ["hybrid", "lexical", "vector"] },
        cursor: { type: "string" },
        limit: { type: "integer", minimum: 1, maximum: 100 },
      },
      required: ["query"],
      additionalProperties: false,
    },
    handler: searchRecords,
    readOnly: true,
  });

  registry.register({
    name: "list_definitions",
    description: "List definitions (records) for a specific source, optionally filtered by kind.",
    inputSchema: {
      type: "object",
      properties: {
        source_id: { type: "string" },
        kind: { type: "string" },
        cursor: { type: "string" },
        limit: { type: "integer", minimum: 1, maximum: 100 },
      },
      required: ["source_id"],
      additionalProperties: false,
    },
    handler: listDefinitions,
    readOnly: true,
  });

  registry.register({
    name: "find_mechanics",
    description: "Find canonical mechanic records with optional filters.",
    inputSchema: {
      type: "object",
      properties: {
        source_id: { type: "string" },
        kind: { type: "string" },
        cursor: { type: "string" },
        limit: { type: "integer", minimum: 1, maximum: 100 },
      },
      additionalProperties: false,
    },
    handler: findMechanics,
    readOnly: true,
  });

  registry.register({
    name: "find_systems",
    description: "Find canonical system records with optional filters.",
    inputSchema: {
      type: "object",
      properties: {
        source_id: { type: "string" },
        kind: { type: "string" },
        cursor: { type: "string" },
        limit: { type: "integer", minimum: 1, maximum: 100 },
      },
      additionalProperties: false,
    },
    handler: findSystems,
    readOnly: true,
  });

  registry.register({
    name: "traverse_relations",
    description: "Traverse typed canonical relations from a record. Depth hard max 3.",
    inputSchema: {
      type: "object",
      properties: {
        record_id: { type: "string" },
        relation_types: { type: "array", items: { type: "string" } },
        direction: { type: "string", enum: ["out", "in", "both"] },
        depth: { type: "integer", minimum: 1, maximum: 3 },
        limit: { type: "integer" },
      },
      required: ["record_id"],
      additionalProperties: false,
    },
    handler: traverseRelations,
    readOnly: true,
  });

  registry.register({
    name: "get_claims",
    description: "Get claims for a record, optionally filtered by predicate.",
    inputSchema: {
      type: "object",
      properties: {
        record_id: { type: "string" },
        predicate: { type: "string" },
        cursor: { type: "string" },
        limit: { type: "integer", minimum: 1, maximum: 100 },
      },
      required: ["record_id"],
      additionalProperties: false,
    },
    handler: getClaims,
    readOnly: true,
  });

  registry.register({
    name: "get_evidence",
    description: "Get evidence by id. Enforces publication policy — restricted evidence is redacted.",
    inputSchema: {
      type: "object",
      properties: { evidence_id: { type: "string" } },
      required: ["evidence_id"],
      additionalProperties: false,
    },
    handler: getEvidence,
    readOnly: true,
  });

  registry.register({
    name: "compare_records",
    description: "Compare 2..10 records side by side.",
    inputSchema: {
      type: "object",
      properties: {
        record_ids: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 10 },
      },
      required: ["record_ids"],
      additionalProperties: false,
    },
    handler: compareRecords,
    readOnly: true,
  });

  registry.register({
    name: "compare_games",
    description: "Compare 2..8 games (sources), optionally filtered by concept key.",
    inputSchema: {
      type: "object",
      properties: {
        source_ids: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 8 },
        concept_key: { type: "string" },
      },
      required: ["source_ids"],
      additionalProperties: false,
    },
    handler: compareGames,
    readOnly: true,
  });

  registry.register({
    name: "find_cross_game_concepts",
    description: "Search/list canonical cross-game concepts.",
    inputSchema: {
      type: "object",
      properties: {
        cursor: { type: "string" },
        limit: { type: "integer", minimum: 1, maximum: 100 },
      },
      additionalProperties: false,
    },
    handler: findCrossGameConcepts,
    readOnly: true,
  });

  registry.register({
    name: "find_design_primitives",
    description: "Search/list canonical design primitives.",
    inputSchema: {
      type: "object",
      properties: {
        cursor: { type: "string" },
        limit: { type: "integer", minimum: 1, maximum: 100 },
      },
      additionalProperties: false,
    },
    handler: findDesignPrimitives,
    readOnly: true,
  });

  registry.register({
    name: "query_design_space",
    description: "Structured query over design-space relations (primitive/pressure/tension/knob/mutation). Returns canonical design knowledge.",
    inputSchema: {
      type: "object",
      properties: {
        primitive_key: { type: "string" },
        relation_types: { type: "array", items: { type: "string" } },
        cursor: { type: "string" },
        limit: { type: "integer", minimum: 1, maximum: 100 },
      },
      additionalProperties: false,
    },
    handler: queryDesignSpace,
    readOnly: true,
  });

  registry.register({
    name: "get_coverage",
    description: "Get coverage dimensions for a specific source.",
    inputSchema: {
      type: "object",
      properties: { source_id: { type: "string" } },
      required: ["source_id"],
      additionalProperties: false,
    },
    handler: getCoverage,
    readOnly: true,
  });

  return registry;
}

const WRITE_TOOL_PATTERNS = [
  "write", "create", "update", "delete", "mutate", "insert", "promote",
  "apply", "commit", "lab_generate", "lab_write",
];

export function assertNoWriteTools(registry: ToolRegistry): string[] {
  const violations: string[] = [];
  for (const [name, def] of registry.tools) {
    if (!def.readOnly) {
      violations.push(name);
    }
    const lowerName = name.toLowerCase();
    if (WRITE_TOOL_PATTERNS.some((p) => lowerName.includes(p))) {
      violations.push(name);
    }
  }
  return violations;
}

export const REQUIRED_TOOLS = [
  "get_dataset_info",
  "list_sources",
  "get_source_status",
  "get_record",
  "resolve_key",
  "search_records",
  "list_definitions",
  "find_mechanics",
  "find_systems",
  "traverse_relations",
  "get_claims",
  "get_evidence",
  "compare_records",
  "compare_games",
  "find_cross_game_concepts",
  "find_design_primitives",
  "query_design_space",
  "get_coverage",
];
