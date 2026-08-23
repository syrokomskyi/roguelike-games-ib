/*
<MODULE_CONTRACT>
<purpose>Provides a sandboxed read-only source reader that prevents path traversal and symlink escapes while exposing file read, stat, walk, and parse utilities. Supports optional supplemental roots for evidence extraction outside payload root.</purpose>
<non-goals>
  <item>Does not write or modify source files — read-only access.</item>
  <item>Does not follow symlinks — skips them during walk.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: ReadonlySourceReader with path-safe resolution, read, stat, walk, and parse methods.</item>
  <item>RFC-0008: Added supplemental roots support — constructor accepts optional SupplementalRoot[], resolveSafe checks supplemental roots for prefixed paths.</item>
</CHANGE_SUMMARY>
*/
import { existsSync, realpathSync, readFileSync, statSync, readdirSync } from "node:fs";
import { resolve, relative, isAbsolute, join, sep, posix } from "node:path";
import { SourceRootError } from "@roguelike-games-ib/knowledge-core";
import { parse as parseYaml } from "yaml";

export interface SupplementalRoot {
  name: string;
  root: string;
  glob: string;
}

export class ReadonlySourceReader {
  private readonly supplementalRoots: SupplementalRoot[];

  constructor(
    private readonly root: string,
    supplementalRoots: SupplementalRoot[] = [],
  ) {
    this.root = realpathSync(root);
    this.supplementalRoots = supplementalRoots.map((sr) => ({
      ...sr,
      root: realpathSync(sr.root),
    }));
  }

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

    const supplemental = this.matchSupplemental(relativePath);
    if (supplemental) {
      return this.resolveInRoot(supplemental.root, supplemental.remaining, relativePath);
    }

    return this.resolveInRoot(this.root, relativePath, relativePath);
  }

  private matchSupplemental(relativePath: string): { root: string; remaining: string } | null {
    const slashIdx = relativePath.indexOf("/");
    if (slashIdx === -1) return null;
    const prefix = relativePath.slice(0, slashIdx);
    const remaining = relativePath.slice(slashIdx + 1);
    const sr = this.supplementalRoots.find((s) => s.name === prefix);
    if (!sr) return null;
    return { root: sr.root, remaining };
  }

  private resolveInRoot(root: string, relativePath: string, originalPath: string): string {
    const resolved = resolve(root, relativePath);

    if (existsSync(resolved)) {
      const real = realpathSync(resolved);
      const rel = relative(root, real);
      if (rel.startsWith("..") || isAbsolute(rel)) {
        throw new SourceRootError(
          `Symlink escapes source root: '${originalPath}' -> '${real}'`,
        );
      }
    }

    return resolved;
  }

  exists(relativePath: string): boolean {
    try {
      const resolved = this.resolveSafe(relativePath);
      return existsSync(resolved);
    } catch {
      return false;
    }
  }

  readBytes(relativePath: string): Buffer {
    const resolved = this.resolveSafe(relativePath);
    return readFileSync(resolved);
  }

  readText(relativePath: string, encoding?: BufferEncoding): string {
    const resolved = this.resolveSafe(relativePath);
    return readFileSync(resolved, encoding ?? "utf-8");
  }

  stat(relativePath: string): { size: number; isFile: boolean; isDirectory: boolean; mtimeMs: number } {
    const resolved = this.resolveSafe(relativePath);
    const s = statSync(resolved);
    return {
      size: s.size,
      isFile: s.isFile(),
      isDirectory: s.isDirectory(),
      mtimeMs: s.mtimeMs,
    };
  }

  walk(
    predicate?: (relativePath: string) => boolean,
  ): string[] {
    const results: string[] = [];
    const ignoreSet = new Set([".git", "node_modules"]);

    const walkDir = (dir: string, relPrefix: string) => {
      const items = readdirSync(dir, { withFileTypes: true });
      for (const item of items) {
        if (ignoreSet.has(item.name)) continue;

        const fullPath = join(dir, item.name);
        const relPath = relPrefix ? `${relPrefix}/${item.name}` : item.name;

        if (item.isSymbolicLink()) {
          continue;
        } else if (item.isDirectory()) {
          walkDir(fullPath, relPath);
        } else if (item.isFile()) {
          if (!predicate || predicate(relPath)) {
            results.push(relPath);
          }
        }
      }
    };

    walkDir(this.root, "");
    results.sort();
    return results;
  }

  parseJson(relativePath: string): unknown {
    const text = this.readText(relativePath);
    return JSON.parse(text);
  }

  parseYaml(relativePath: string): unknown {
    const text = this.readText(relativePath);
    return parseYaml(text);
  }

  getRoot(): string {
    return this.root;
  }

  getSupplementalRoots(): SupplementalRoot[] {
    return this.supplementalRoots;
  }
}
