/*
<MODULE_CONTRACT>
<purpose>Writes deterministic JSONL and JSON output files — records, claims, relations, evidence, sources, coverage, key map, and alias map.</purpose>
<non-goals>
  <item>Does not build SQLite — JSONL/JSON output only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: writeRecordsJsonl, writeClaimsJsonl, writeRelationsJsonl, writePublicEvidenceJsonl, writeSourcesJson, writeCoverageJson, writeKeyMapJson, writeAliasMapJson, readJsonlFile.</item>
</CHANGE_SUMMARY>
*/
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  canonicalJsonStringify,
  serializeJsonl,
  canonicalJsonParse,
} from "@roguelike-games-ib/knowledge-core";
import { CanonicalRecord } from "./types.ts";
import { PublicEvidence } from "./public-evidence.ts";
import { sortRecords } from "./normalize.ts";
import { ClaimRecord, RelationRecord, KeyEntry, AliasEntry, SourceBinding, CoverageRecord } from "@roguelike-games-ib/knowledge-core";

/**
 * Write records.jsonl — all canonical records sorted by key then id.
 */
export function writeRecordsJsonl(distDir: string, records: CanonicalRecord[]): string {
  const sorted = sortRecords(records);
  const content = serializeJsonl(sorted);
  const path = join(distDir, "records.jsonl");
  writeFileSync(path, content, "utf-8");
  return path;
}

/**
 * Write claims.jsonl — all claims sorted by id.
 */
export function writeClaimsJsonl(distDir: string, claims: ClaimRecord[]): string {
  const sorted = [...claims].sort((a, b) => a.id.localeCompare(b.id));
  const content = serializeJsonl(sorted);
  const path = join(distDir, "claims.jsonl");
  writeFileSync(path, content, "utf-8");
  return path;
}

/**
 * Write relations.jsonl — all relations sorted by id.
 */
export function writeRelationsJsonl(distDir: string, relations: RelationRecord[]): string {
  const sorted = [...relations].sort((a, b) => a.id.localeCompare(b.id));
  const content = serializeJsonl(sorted);
  const path = join(distDir, "relations.jsonl");
  writeFileSync(path, content, "utf-8");
  return path;
}

/**
 * Write evidence.public.jsonl — redacted public evidence sorted by id.
 */
export function writePublicEvidenceJsonl(distDir: string, evidence: PublicEvidence[]): string {
  const sorted = [...evidence].sort((a, b) => a.id.localeCompare(b.id));
  const content = serializeJsonl(sorted);
  const path = join(distDir, "evidence.public.jsonl");
  writeFileSync(path, content, "utf-8");
  return path;
}

/**
 * Write sources.json — source bindings as canonical JSON.
 */
export function writeSourcesJson(distDir: string, bindings: SourceBinding[]): string {
  const sorted = [...bindings].sort((a, b) => a.source_id.localeCompare(b.source_id));
  const content = canonicalJsonStringify({ schema: "rgkb/sources@2", sources: sorted }) + "\n";
  const path = join(distDir, "sources.json");
  writeFileSync(path, content, "utf-8");
  return path;
}

/**
 * Write coverage.json — coverage records as canonical JSON.
 */
export function writeCoverageJson(distDir: string, coverage: CoverageRecord[]): string {
  const sorted = [...coverage].sort((a, b) => a.source_id.localeCompare(b.source_id));
  const content = canonicalJsonStringify({ schema: "rgkb/coverage-bundle@2", records: sorted }) + "\n";
  const path = join(distDir, "coverage.json");
  writeFileSync(path, content, "utf-8");
  return path;
}

/**
 * Write key-map.json — mapping from key to record id.
 */
export function writeKeyMapJson(distDir: string, keys: KeyEntry[]): string {
  const map: Record<string, string> = {};
  const sorted = [...keys].sort((a, b) => a.key.localeCompare(b.key));
  for (const entry of sorted) {
    map[entry.key] = entry.id;
  }
  const content = canonicalJsonStringify({ schema: "rgkb/key-map@2", keys: map }) + "\n";
  const path = join(distDir, "key-map.json");
  writeFileSync(path, content, "utf-8");
  return path;
}

/**
 * Write alias-map.json — mapping from old key to current key.
 */
export function writeAliasMapJson(distDir: string, aliases: AliasEntry[]): string {
  const map: Record<string, string> = {};
  const sorted = [...aliases].sort((a, b) => a.key.localeCompare(b.key));
  for (const entry of sorted) {
    map[entry.key] = entry.retired_to;
  }
  const content = canonicalJsonStringify({ schema: "rgkb/alias-map@2", aliases: map }) + "\n";
  const path = join(distDir, "alias-map.json");
  writeFileSync(path, content, "utf-8");
  return path;
}

/**
 * Read back a JSONL file and return parsed records.
 */
export function readJsonlFile(filePath: string): unknown[] {
  if (!existsSync(filePath)) return [];
  const text = readFileSync(filePath, "utf-8");
  return text
    .split("\n")
    .filter((l) => l.trim() !== "")
    .map((l) => canonicalJsonParse(l));
}

