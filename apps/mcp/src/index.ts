export { createMcpContext, datasetEnvelope } from "./context.ts";
export type { McpContext } from "./context.ts";
export { envelope } from "./envelope.ts";
export type { McpResponse } from "./envelope.ts";
export {
  McpError,
  InvalidCursorError,
  StaleCursorError,
  NotFoundError,
  ValidationError,
} from "./errors.ts";
export {
  createToolRegistry,
  createMcpToolRegistry,
  assertNoWriteTools,
  REQUIRED_TOOLS,
} from "./server.ts";
export type { ToolHandler, ToolDefinition, ToolRegistry } from "./server.ts";
export { encodeListCursor, decodeListCursor, paginate } from "./pagination.ts";

// Tool handlers (for direct testing)
export { getDatasetInfo } from "./tools/dataset.ts";
export { listSources, getSourceStatus } from "./tools/sources.ts";
export { getRecord, resolveKey } from "./tools/records.ts";
export { searchRecords } from "./tools/search.ts";
export { listDefinitions } from "./tools/definitions.ts";
export { findMechanics, findSystems } from "./tools/mechanics.ts";
export { traverseRelations } from "./tools/graph.ts";
export { getClaims } from "./tools/claims.ts";
export { getEvidence } from "./tools/evidence.ts";
export { compareRecords, compareGames } from "./tools/compare.ts";
export { findCrossGameConcepts, findDesignPrimitives, queryDesignSpace } from "./tools/design.ts";
export { getCoverage } from "./tools/coverage.ts";
