import { resolve } from "node:path";
import type { MiddlewareHandler } from "astro";

const DEFAULT_DIST = resolve(process.cwd(), "../../.generated/knowledge/dist");

export const onRequest: MiddlewareHandler = (context, next) => {
  context.locals.distDir = process.env.PROJECTION_DIST_DIR ?? DEFAULT_DIST;
  return next();
};
