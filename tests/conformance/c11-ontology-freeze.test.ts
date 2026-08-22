import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse as parseYaml } from "yaml";

const WORKSPACE = resolve(__dirname, "../..");
const CANONICAL_ROOT = join(WORKSPACE, "knowledge");
const ONTOLOGY_PATH = join(CANONICAL_ROOT, "ontology", "relation-types.yaml");

function readJsonlDir(dir: string): any[] {
  if (!existsSync(dir)) return [];
  const records: any[] = [];
  function walk(d: string) {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        walk(join(d, entry.name));
      } else if (entry.name.endsWith(".jsonl")) {
        const text = readFileSync(join(d, entry.name), "utf-8");
        for (const line of text.split("\n").filter(Boolean)) {
          records.push(JSON.parse(line));
        }
      }
    }
  }
  walk(dir);
  return records;
}

function loadRelationTypes(): Map<string, { id: string; direction: string; domain: string[]; range: string[] }> {
  const raw = readFileSync(ONTOLOGY_PATH, "utf-8");
  const parsed = parseYaml(raw) as { relations?: any[] };
  const map = new Map<string, any>();
  for (const rt of parsed.relations ?? []) {
    map.set(rt.id, rt);
  }
  return map;
}

describe("C11: Ontology freeze — v1 implementation contract", () => {
  const relationTypes = loadRelationTypes();

  it("relation-types.yaml is present and parseable", () => {
    expect(existsSync(ONTOLOGY_PATH)).toBe(true);
    expect(relationTypes.size).toBeGreaterThanOrEqual(20);
  });

  it("HAS_ABILITY is registered in ontology", () => {
    const rt = relationTypes.get("HAS_ABILITY");
    expect(rt).toBeDefined();
    expect(rt!.direction).toBe("directed");
    expect(rt!.domain).toContain("definition");
    expect(rt!.range).toContain("semantic_record");
  });

  it("INTERACTS_WITH is registered in ontology", () => {
    const rt = relationTypes.get("INTERACTS_WITH");
    expect(rt).toBeDefined();
    expect(rt!.direction).toBe("symmetric");
    expect(rt!.domain).toContain("semantic_record");
    expect(rt!.range).toContain("semantic_record");
  });

  it("every canonical relation type is registered in ontology", () => {
    const relations = readJsonlDir(join(CANONICAL_ROOT, "relation"));
    expect(relations.length).toBeGreaterThan(0);

    const unregistered = new Set<string>();
    for (const rel of relations) {
      if (!relationTypes.has(rel.relation_type)) {
        unregistered.add(rel.relation_type);
      }
    }

    expect(unregistered.size).toBe(0);
  });

  it("every canonical relation satisfies domain constraint", () => {
    const relations = readJsonlDir(join(CANONICAL_ROOT, "relation"));
    const allRecords = readJsonlDir(join(CANONICAL_ROOT, "definition"))
      .concat(readJsonlDir(join(CANONICAL_ROOT, "semantic_record")))
      .concat(readJsonlDir(join(CANONICAL_ROOT, "concept")));

    const recordTypeMap = new Map<string, string>();
    for (const r of allRecords) {
      recordTypeMap.set(r.id, r.record_type);
    }

    const violations: string[] = [];
    for (const rel of relations) {
      const typeDef = relationTypes.get(rel.relation_type);
      if (!typeDef) continue;

      const sourceType = recordTypeMap.get(rel.source_record_id);
      if (sourceType && !typeDef.domain.includes(sourceType)) {
        violations.push(
          `Relation ${rel.id}: domain violation — source record_type '${sourceType}' not in [${typeDef.domain.join(", ")}]`,
        );
      }

      const targetType = recordTypeMap.get(rel.target_record_id);
      if (targetType && !typeDef.range.includes(targetType)) {
        violations.push(
          `Relation ${rel.id}: range violation — target record_type '${targetType}' not in [${typeDef.range.join(", ")}]`,
        );
      }
    }

    expect(violations).toEqual([]);
  });

  it("every canonical relation has at least one evidence ref", () => {
    const relations = readJsonlDir(join(CANONICAL_ROOT, "relation"));
    for (const rel of relations) {
      expect(rel.evidence_refs).toBeDefined();
      expect(rel.evidence_refs.length).toBeGreaterThan(0);
    }
  });

  it("ontology schema version is frozen at 2", () => {
    const raw = readFileSync(ONTOLOGY_PATH, "utf-8");
    const parsed = parseYaml(raw);
    expect(parsed.schema).toBe("rgkb/relation-ontology@2");
    expect(parsed.model_version).toBe("2.0.0");
  });

  it("schema-registry is frozen at v2 with all required schemas", () => {
    const raw = readFileSync(join(CANONICAL_ROOT, "ontology", "schema-registry.yaml"), "utf-8");
    const parsed = parseYaml(raw);
    expect(parsed.schema).toBe("rgkb/schema-registry@2");
    expect(parsed.model_version).toBe("2.0.0");

    const schemaIds = new Set(parsed.schemas.map((s: any) => s.id));
    const required = [
      "rgkb/record@2",
      "rgkb/game-definition@2",
      "rgkb/evidence@2",
      "rgkb/claim@2",
      "rgkb/relation@2",
      "rgkb/semantic-record@2",
      "rgkb/concept@2",
      "rgkb/contradiction@2",
      "rgkb/materialization-manifest@2",
      "werkstatt/knowledge-extractor@1",
    ];
    for (const id of required) {
      expect(schemaIds.has(id)).toBe(true);
    }
  });

  it("definition schema allows empty evidence_refs (data-driven extractor pressure point)", () => {
    const raw = readFileSync(join(CANONICAL_ROOT, "ontology", "game-definition.schema.yaml"), "utf-8");
    const parsed = parseYaml(raw);

    const evidenceRefsProp = parsed.allOf[1].properties.evidence_refs;
    expect(evidenceRefsProp.minItems).toBe(0);
  });

  it("all canonical definition records have required envelope fields", () => {
    const records = readJsonlDir(join(CANONICAL_ROOT, "definition"));
    expect(records.length).toBeGreaterThan(100);

    const requiredFields = ["schema", "id", "key", "record_type", "language", "origin", "aliases", "kind", "native_kind", "name", "source_identity", "attributes"];
    const missing: string[] = [];
    for (const r of records) {
      for (const f of requiredFields) {
        if (r[f] === undefined || r[f] === null) {
          missing.push(`${r.key ?? r.id}: missing '${f}'`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it("record-types taxonomy is frozen with all required types", () => {
    const raw = readFileSync(join(CANONICAL_ROOT, "ontology", "record-types.yaml"), "utf-8");
    const parsed = parseYaml(raw);

    const requiredTypes = ["definition", "evidence", "claim", "relation", "semantic_record", "concept", "contradiction"];
    const actualTypes = Object.keys(parsed.record_types);
    for (const t of requiredTypes) {
      expect(actualTypes).toContain(t);
    }
  });

  it("knowledge manifest is frozen at v2", () => {
    const raw = readFileSync(join(CANONICAL_ROOT, "manifest.yaml"), "utf-8");
    const parsed = parseYaml(raw);
    expect(parsed.schema).toBe("rgkb/knowledge-manifest@2");
    expect(parsed.model_version).toBe("2.0.0");
    expect(parsed.id).toBe("roguelike-games-ib");
    expect(parsed.publication.dataset_license).toBe("CC-BY-4.0");
  });

  it("knowledge config is frozen at v1", () => {
    const raw = readFileSync(join(WORKSPACE, "knowledge.config.yaml"), "utf-8");
    const parsed = parseYaml(raw);
    expect(parsed.schema).toBe("werkstatt/knowledge-config@1");
    expect(parsed.knowledge_base_id).toBe("roguelike-games-ib");
  });

  it("extractor manifest schema is frozen at v1", () => {
    const registryRaw = readFileSync(join(CANONICAL_ROOT, "ontology", "schema-registry.yaml"), "utf-8");
    const registry = parseYaml(registryRaw);
    const extractorSchema = registry.schemas.find((s: any) => s.id === "werkstatt/knowledge-extractor@1");
    expect(extractorSchema).toBeDefined();
  });
});
