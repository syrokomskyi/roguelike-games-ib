/*
<MODULE_CONTRACT>
<purpose>Reads canonical records, key maps, and alias maps from materialized output.</purpose>
<non-goals>
  <item>Does not validate records — reading only.</item>
  <item>Does not provide query helpers — use ProjectionStore methods.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: readRecords, findRecordById, findRecordByKey, KeyMap, AliasMap, readKeyMap, readAliasMap, resolveKeyToId, resolveAliasToKey, resolveAliasToId.</item>
  <item>Removed dead resolution API: findRecordById, findRecordByKey, resolveKeyToId, resolveAliasToKey, resolveAliasToId — use ProjectionStore methods.</item>
</CHANGE_SUMMARY>
*/
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { canonicalJsonParse } from "@roguelike-games-ib/knowledge-core";
import type { CanonicalRecord } from "@roguelike-games-ib/materializer";
import { readJsonlFile } from "@roguelike-games-ib/materializer";

export function readRecords(distDir: string): CanonicalRecord[] {
  return readJsonlFile(join(distDir, "records.jsonl")) as CanonicalRecord[];
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

