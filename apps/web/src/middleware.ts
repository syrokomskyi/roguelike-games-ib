/*
<MODULE_CONTRACT>
<purpose>Astro middleware that injects the projection dist directory path into request locals for downstream handlers.</purpose>
<non-goals>
  <item>Does not perform authentication or authorization — distDir injection only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: onRequest middleware setting locals.distDir from env or default path.</item>
</CHANGE_SUMMARY>
*/
import { resolve } from "node:path";
import type { MiddlewareHandler } from "astro";

const DEFAULT_DIST = resolve(process.cwd(), "../../.generated/knowledge/dist");

export const onRequest: MiddlewareHandler = (context, next) => {
  context.locals.distDir = process.env.PROJECTION_DIST_DIR ?? DEFAULT_DIST;
  return next();
};
