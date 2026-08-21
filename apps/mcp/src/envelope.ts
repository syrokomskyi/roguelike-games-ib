/*
<MODULE_CONTRACT>
<purpose>Wraps tool response data in a canonical MCP envelope with dataset metadata and authority tag.</purpose>
<non-goals>
  <item>Does not transform or filter response data — passes it through unchanged.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: MCP response envelope with dataset metadata and authority field.</item>
</CHANGE_SUMMARY>
*/
import type { McpContext } from "./context.ts";
import { datasetEnvelope } from "./context.ts";

export interface McpResponse<T = unknown> {
  dataset: ReturnType<typeof datasetEnvelope>;
  authority: "canonical";
  data: T;
}

export function envelope<T>(ctx: McpContext, data: T): McpResponse<T> {
  return {
    dataset: datasetEnvelope(ctx),
    authority: "canonical",
    data,
  };
}
