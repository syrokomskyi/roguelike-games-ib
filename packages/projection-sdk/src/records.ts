import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parseJsonl, canonicalJsonParse } from "@roguelike-games-ib/knowledge-core";
import type { CanonicalRecord } from "@roguelike-games-ib/materializer";
import { readJsonlFile } from "@roguelike-games-ib/materializer";

export function readRecords(distDir: string): CanonicalRecord[] {
  return readJsonlFile(join(distDir, "records.jsonl")) as CanonicalRecord[];
}

export function findRecordById(records: CanonicalRecord[], id: string): CanonicalRecord | undefined {
  return records.find((r) => r.id === id);
}

export function findRecordByKey(records: CanonicalRecord[], key: string): CanonicalRecord | undefined {
  return records.find((r) => r.key === key);
}

export interface KeyMap {
  [key: string]: string;
}

export interface AliasMap {
  [oldKey: string]: string;
}

export function readKeyMap(distDir: string): KeyMap {
  const path = join(distDir, "key-map.json");
  if (!existsSync(path)) return {};
  const raw = readFileSync(path, "utf-8");
  const parsed = canonicalJsonParse(raw) as { keys: KeyMap };
  return parsed.keys;
}

export function readAliasMap(distDir: string): AliasMap {
  const path = join(distDir, "alias-map.json");
  if (!existsSync(path)) return {};
  const raw = readFileSync(path, "utf-8");
  const parsed = canonicalJsonParse(raw) as { aliases: AliasMap };
  return parsed.aliases;
}

export function resolveKeyToId(keyMap: KeyMap, key: string): string | undefined {
  return keyMap[key];
}

export function resolveAliasToKey(aliasMap: AliasMap, oldKey: string): string | undefined {
  return aliasMap[oldKey];
}

export function resolveAliasToId(aliasMap: AliasMap, keyMap: KeyMap, oldKey: string): string | undefined {
  const currentKey = aliasMap[oldKey];
  if (!currentKey) return undefined;
  return keyMap[currentKey];
}
