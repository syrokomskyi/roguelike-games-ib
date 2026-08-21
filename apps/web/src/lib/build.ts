import { assertMaterialization } from "./verify.ts";
import { createWebContext, type WebContext } from "./context.ts";

export interface WebBuildOptions {
  distDir: string;
}

export async function prepareWebBuild(options: WebBuildOptions): Promise<WebContext> {
  assertMaterialization(options.distDir);
  return createWebContext(options.distDir);
}
