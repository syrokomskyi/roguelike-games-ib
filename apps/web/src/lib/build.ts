/*
<MODULE_CONTRACT>
<purpose>Prepares the web build by asserting materialization integrity and creating the web context with projection store and search index.</purpose>
<non-goals>
  <item>Does not materialize — uses pre-materialized output only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: WebBuildOptions type, prepareWebBuild function.</item>
</CHANGE_SUMMARY>
*/
import { assertMaterialization } from "./verify.ts";
import { createWebContext, type WebContext } from "./context.ts";

export interface WebBuildOptions {
  distDir: string;
}

export async function prepareWebBuild(options: WebBuildOptions): Promise<WebContext> {
  assertMaterialization(options.distDir);
  return createWebContext(options.distDir);
}
