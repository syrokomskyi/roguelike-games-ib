import { existsSync, realpathSync, statSync } from "node:fs";
import { resolve, relative, isAbsolute } from "node:path";
import { SourceRootError } from "../errors.ts";

/**
 * Read guard for source files. Ensures no path traversal or symlink escape.
 * This is the safety layer that all source reads must go through.
 */
export class ReadonlySource {
  constructor(private readonly root: string) {
    // Resolve to real path at construction
    this.root = realpathSync(root);
  }

  /**
   * Resolve a relative path within the source root, checking for traversal/escape.
   */
  resolveSafe(relativePath: string): string {
    if (isAbsolute(relativePath)) {
      throw new SourceRootError(
        `Absolute paths are not allowed: '${relativePath}'`,
      );
    }

    if (relativePath.includes("..")) {
      throw new SourceRootError(
        `Path traversal ('..') is not allowed: '${relativePath}'`,
      );
    }

    const resolved = resolve(this.root, relativePath);

    // Check symlink escape
    if (existsSync(resolved)) {
      const real = realpathSync(resolved);
      const rel = relative(this.root, real);
      if (rel.startsWith("..") || isAbsolute(rel)) {
        throw new SourceRootError(
          `Symlink escapes source root: '${relativePath}' -> '${real}'`,
        );
      }
    }

    return resolved;
  }

  /**
   * Check if a file exists within the source root.
   */
  exists(relativePath: string): boolean {
    try {
      const resolved = this.resolveSafe(relativePath);
      return existsSync(resolved);
    } catch {
      return false;
    }
  }

  /**
   * Read a file within the source root.
   */
  read(relativePath: string): string {
    const resolved = this.resolveSafe(relativePath);
    // Re-export from node:fs inline to keep the guard layer
    const { readFileSync } = require("node:fs");
    return readFileSync(resolved, "utf-8");
  }

  /**
   * Get the root path.
   */
  getRoot(): string {
    return this.root;
  }
}
