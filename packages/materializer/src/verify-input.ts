import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { parse as parseYaml } from "yaml";
import {
  parseJsonl,
  readKeyRegistry,
  readAliasRegistry,
  validateCanonicalGraph,
  type ClaimRecord,
  type RelationRecord,
  type ContradictionRecord,
  type EvidenceAnchor,
  type SourceBinding,
  type CoverageRecord,
  type RelationTypeDefinition,
} from "@roguelike-games-ib/knowledge-core";
import type { RelationTypeDefinition as RTD } from "@roguelike-games-ib/knowledge-core";
import { CanonicalRecord, CanonicalState, VerificationResult } from "./types.ts";

const METADATA_DIRS = new Set(["ontology", "sources", "identity"]);
const SPECIAL_DIRS = new Set(["claim", "relation", "contradiction", "evidence", "coverage"]);

function classifyAndStore(
  obj: unknown,
  dirName: string,
  records: CanonicalRecord[],
  claims: ClaimRecord[],
  relations: RelationRecord[],
  contradictions: ContradictionRecord[],
  evidence: EvidenceAnchor[],
) {
  const record = obj as Record<string, unknown>;
  switch (dirName) {
    case "claim":
      claims.push(record as unknown as ClaimRecord);
      break;
    case "relation":
      relations.push(record as unknown as RelationRecord);
      break;
    case "contradiction":
      contradictions.push(record as unknown as ContradictionRecord);
      break;
    case "evidence":
      evidence.push(record as unknown as EvidenceAnchor);
      break;
    default:
      records.push(record as unknown as CanonicalRecord);
      break;
  }
}

/**
 * Read all canonical records from the canonical root directory.
 * Walks subdirectories, skipping metadata dirs (ontology, sources, identity).
 * Uses the top-level directory name to classify records (claim, relation, etc).
 */
export function readCanonicalState(canonicalRoot: string): CanonicalState {
  const records: CanonicalRecord[] = [];
  const claims: ClaimRecord[] = [];
  const relations: RelationRecord[] = [];
  const contradictions: ContradictionRecord[] = [];
  const evidence: EvidenceAnchor[] = [];

  if (!existsSync(canonicalRoot)) {
    return { records, claims, relations, contradictions, evidence, keys: [], aliases: [], bindings: [], coverage: [], relationTypes: new Map() };
  }

  function walkDir(dir: string, topDirName: string) {
    const items = readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      const fullPath = join(dir, item.name);
      if (item.isDirectory()) {
        walkDir(fullPath, topDirName);
      } else if (item.isFile() && item.name.endsWith(".jsonl")) {
        const text = readFileSync(fullPath, "utf-8");
        const parsed = parseJsonl(text);
        for (const obj of parsed) {
          classifyAndStore(obj, topDirName, records, claims, relations, contradictions, evidence);
        }
      }
    }
  }

  const topEntries = readdirSync(canonicalRoot, { withFileTypes: true });
  for (const entry of topEntries) {
    if (entry.isDirectory() && !METADATA_DIRS.has(entry.name)) {
      walkDir(join(canonicalRoot, entry.name), entry.name);
    }
  }

  const keys = readKeyRegistry(join(canonicalRoot, "identity", "keys.jsonl"));
  const aliases = readAliasRegistry(join(canonicalRoot, "identity", "aliases.jsonl"));

  const bindings = readBindings(join(canonicalRoot, "sources", "bindings.yaml"));
  const coverage = readCoverageRecords(canonicalRoot);
  const relationTypes = readRelationTypes(join(canonicalRoot, "ontology", "relation-types.yaml"));

  return { records, claims, relations, contradictions, evidence, keys, aliases, bindings, coverage, relationTypes };
}

function readRelationTypes(relationTypesPath: string): Map<string, RelationTypeDefinition> {
  const map = new Map<string, RelationTypeDefinition>();
  if (!existsSync(relationTypesPath)) return map;
  const raw = readFileSync(relationTypesPath, "utf-8");
  const parsed = parseYaml(raw) as { relations?: RTD[] };
  for (const rt of parsed.relations ?? []) {
    map.set(rt.id, rt);
  }
  return map;
}

function readBindings(bindingsPath: string): SourceBinding[] {
  if (!existsSync(bindingsPath)) return [];
  const raw = readFileSync(bindingsPath, "utf-8");
  const parsed = parseYaml(raw) as { schema?: string; bindings?: SourceBinding[] };
  return parsed.bindings ?? [];
}

function readCoverageRecords(canonicalRoot: string): CoverageRecord[] {
  const coverage: CoverageRecord[] = [];
  const coverageDir = join(canonicalRoot, "coverage");
  if (!existsSync(coverageDir)) return coverage;

  const items = readdirSync(coverageDir, { withFileTypes: true });
  for (const item of items) {
    if (item.isFile() && item.name.endsWith(".jsonl")) {
      const text = readFileSync(join(coverageDir, item.name), "utf-8");
      const parsed = parseJsonl(text);
      for (const obj of parsed) {
        coverage.push(obj as unknown as CoverageRecord);
      }
    }
  }
  return coverage;
}

/**
 * Verify canonical state integrity before materialization.
 * Runs validateCanonicalGraph and additional checks.
 */
export function verifyCanonicalState(state: CanonicalState, relationTypes?: Map<string, RelationTypeDefinition>): VerificationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const recordMap = new Map<string, { record_type: string; data: Record<string, unknown> }>();
  for (const r of state.records) {
    recordMap.set(r.id, { record_type: r.record_type, data: r as Record<string, unknown> });
  }
  for (const c of state.claims) {
    recordMap.set(c.id, { record_type: "claim", data: c as unknown as Record<string, unknown> });
  }
  for (const rel of state.relations) {
    recordMap.set(rel.id, { record_type: "relation", data: rel as unknown as Record<string, unknown> });
  }
  for (const con of state.contradictions) {
    recordMap.set(con.id, { record_type: "contradiction", data: con as unknown as Record<string, unknown> });
  }
  for (const ev of state.evidence) {
    const evId = (ev as unknown as Record<string, unknown>)["id"] as string | undefined;
    if (evId) {
      recordMap.set(evId, { record_type: "evidence", data: ev as unknown as Record<string, unknown> });
    }
  }

  const graphResult = validateCanonicalGraph({
    records: recordMap,
    claims: state.claims,
    relations: state.relations,
    contradictions: state.contradictions,
    relationTypes: relationTypes ?? state.relationTypes ?? new Map(),
  });

  errors.push(...graphResult.errors);
  warnings.push(...graphResult.warnings);

  for (const r of state.records) {
    if (!r.id || !r.key || !r.record_type) {
      errors.push(`Record missing required field (id/key/record_type): ${JSON.stringify(r).slice(0, 200)}`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}
