import { existsSync, realpathSync, readFileSync, statSync, readdirSync } from "node:fs";
import { resolve, relative, isAbsolute, join, sep, posix } from "node:path";
import { SourceRootError } from "@roguelike-games-ib/knowledge-core";
import { parse as parseYaml } from "yaml";

export class ReadonlySourceReader {
  constructor(private readonly root: string) {
    this.root = realpathSync(root);
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

    const resolved = resolve(this.root, relativePath);

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
}
