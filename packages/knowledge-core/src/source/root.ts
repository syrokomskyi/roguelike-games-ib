import { existsSync, realpathSync, statSync } from "node:fs";
import { resolve, relative, isAbsolute } from "node:path";
import { SourceRootError } from "../errors.ts";
import { resolveSourceRoot } from "../config.ts";

export interface ResolvedSourceRoot {
  path: string;
  kbId: string;
  exists: boolean;
}

/**
 * Resolve the source root from the workspace and manifest.
 * The source root must be a sibling directory: ../<kb-id>-source
 */
export function resolveSourceBundleRoot(
  workspaceRoot: string,
  kbId: string,
  suffix = "-source",
): ResolvedSourceRoot {
  const sourceRoot = resolveSourceRoot(workspaceRoot, kbId, suffix);
  const exists = existsSync(sourceRoot);

  return {
    path: sourceRoot,
    kbId,
    exists,
  };
}

/**
 * Validate that a source path is within the source root (no path traversal).
 */
export function validateSourcePath(
  sourceRoot: string,
  sourcePath: string,
): string {
  const resolved = resolve(sourceRoot, sourcePath);

  // Check for path traversal
  const rel = relative(sourceRoot, resolved);
  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new SourceRootError(
      `Source path '${sourcePath}' escapes source root`,
      { sourcePath, sourceRoot, relative: rel },
    );
  }

  // Check for symlink escape
  try {
    const real = realpathSync(resolved);
    const realRoot = realpathSync(sourceRoot);
    const realRel = relative(realRoot, real);
    if (realRel.startsWith("..") || isAbsolute(realRel)) {
      throw new SourceRootError(
        `Source path '${sourcePath}' resolves outside source root via symlink`,
        { sourcePath, sourceRoot, realPath: real },
      );
    }
  } catch (e) {
    if (e instanceof SourceRootError) throw e;
    // If realpath fails, the path doesn't exist — that's ok for validation
  }

  return resolved;
}

/**
 * Reject arbitrary source root overrides in certified mode.
 */
export function assertNoSourceOverride(
  sourceRoot: string,
  expectedRoot: string,
): void {
  const realExpected = realpathSync(expectedRoot);
  const realActual = realpathSync(sourceRoot);

  if (realActual !== realExpected) {
    throw new SourceRootError(
      `Source root override rejected: '${sourceRoot}' does not match expected '${expectedRoot}'`,
      { actual: realActual, expected: realExpected },
    );
  }
}
