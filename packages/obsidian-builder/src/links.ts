import type { PathResolver } from "./paths.ts";
import type { AliasMap } from "@roguelike-games-ib/projection-sdk";

export function wikiLinkToPath(linkPath: string): string {
  return linkPath.replace(/\.md$/, "");
}

export function resolveLink(
  resolver: PathResolver,
  aliasMap: AliasMap,
  target: string,
): string | null {
  if (resolver.idToPath.has(target)) {
    return resolver.idToPath.get(target)!;
  }
  if (resolver.keyToPath.has(target)) {
    return resolver.keyToPath.get(target)!;
  }
  const currentKey = aliasMap[target];
  if (currentKey && resolver.keyToPath.has(currentKey)) {
    return resolver.keyToPath.get(currentKey)!;
  }
  return null;
}

export function makeWikiLink(
  resolver: PathResolver,
  aliasMap: AliasMap,
  target: string,
  displayText?: string,
): string | null {
  const path = resolveLink(resolver, aliasMap, target);
  if (!path) return null;
  const stem = path.replace(/\.md$/, "");
  if (displayText) {
    return `[[${stem}|${displayText}]]`;
  }
  return `[[${stem}]]`;
}

export interface LinkValidationResult {
  valid: boolean;
  unresolved: string[];
}

export function validateAllLinks(
  resolver: PathResolver,
  aliasMap: AliasMap,
  links: string[],
): LinkValidationResult {
  const unresolved: string[] = [];
  for (const link of links) {
    if (resolveLink(resolver, aliasMap, link) === null) {
      unresolved.push(link);
    }
  }
  return { valid: unresolved.length === 0, unresolved };
}
