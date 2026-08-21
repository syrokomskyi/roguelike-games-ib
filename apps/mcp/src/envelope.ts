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
