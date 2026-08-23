import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { setupMcpWorkspace, testId, type TestSetup } from "./helpers";
import {
  createMcpToolRegistry,
  assertNoWriteTools,
  REQUIRED_TOOLS,
  getClaimsByPredicate,
  getConceptMembers,
  getDesignTensions,
  findByAttribute,
} from "@roguelike-games-ib/mcp";

const id1 = testId(1);
const id2 = testId(2);
const id3 = testId(3);
const id4 = testId(4);
const id5 = testId(5);
const id6 = testId(6);

const records = [
  {
    id: id1, key: "goblin", record_type: "creature", title: "Goblin",
    source_identity: { source_id: "src-a", native_id: "goblin", path: "data.json" },
    attributes: { flags: ["FIREPROOF", "COLDPROOF"], hp: 10 },
  },
  {
    id: id2, key: "dragon", record_type: "creature", title: "Dragon",
    source_identity: { source_id: "src-b", native_id: "dragon", path: "data.json" },
    attributes: { flags: ["FIREPROOF"], hp: 50 },
  },
  {
    id: id3, key: "ice-troll", record_type: "creature", title: "Ice Troll",
    source_identity: { source_id: "src-b", native_id: "ice_troll", path: "data.json" },
    attributes: { flags: ["COLDPROOF"], hp: 30 },
  },
  {
    id: id4, key: "fire-resistance", record_type: "concept", title: "Fire Resistance",
    concept_type: "cross_game_mechanic",
    ancestry: { derived_from: [id1, id2], source_games: ["src-a", "src-b"] },
  },
  {
    id: id5, key: "shop-and-economy", record_type: "concept", title: "Shop and Economy",
    concept_type: "design_primitive",
    ancestry: { derived_from: [], source_games: [] },
  },
  {
    id: id6, key: "permadeath", record_type: "concept", title: "Permadeath",
    concept_type: "design_primitive",
    ancestry: { derived_from: [], source_games: [] },
  },
];

const keys = records.map((r) => ({ id: r.id, key: r.key, record_type: r.record_type }));

const claims = [
  { id: "claim-001", key: "claim-001", subject_id: id1, predicate: "has_resistance", value: "fire", assertion_state: "supported", evidence_refs: [] },
  { id: "claim-002", key: "claim-002", subject_id: id2, predicate: "has_resistance", value: "fire", assertion_state: "supported", evidence_refs: [] },
  { id: "claim-003", key: "claim-003", subject_id: id3, predicate: "has_resistance", value: "cold", assertion_state: "supported", evidence_refs: [] },
  { id: "claim-004", key: "claim-004", subject_id: id1, predicate: "has_alignment", value: "chaotic", assertion_state: "supported", evidence_refs: [] },
];

const relations = [
  { id: "rel-001", key: "rel-001", source_record_id: id5, target_record_id: id6, relation_type: "tensions_with", relation_scope: "design", evidence_refs: [] },
  { id: "rel-002", key: "rel-002", source_record_id: id5, target_record_id: id4, relation_type: "tensions_with", relation_scope: "design", evidence_refs: [] },
];

const bindings = [
  {
    source_id: "src-a", source_unit_path: "src-a", declared_version: "1.0.0",
    version_scheme: "semver", metadata_origin: "package.json",
    fingerprint: { algorithm: "sha256-tree-v1", value: "abc123" },
    vcs: null, binding_digest: "abc123",
  },
  {
    source_id: "src-b", source_unit_path: "src-b", declared_version: "1.0.0",
    version_scheme: "semver", metadata_origin: "package.json",
    fingerprint: { algorithm: "sha256-tree-v1", value: "def456" },
    vcs: null, binding_digest: "def456",
  },
];

describe("MCP-011: new query tools", () => {
  let setup: TestSetup;

  beforeEach(async () => {
    setup = await setupMcpWorkspace({
      kbId: "mcp011-test",
      records,
      claims,
      relations,
      keys,
      bindings,
    });
  });

  afterEach(() => setup.cleanup());

  // --- Tool registration ---

  it("registers all 4 new tools", () => {
    const registry = createMcpToolRegistry();
    expect(registry.has("get_claims_by_predicate")).toBe(true);
    expect(registry.has("get_concept_members")).toBe(true);
    expect(registry.has("get_design_tensions")).toBe(true);
    expect(registry.has("find_by_attribute")).toBe(true);
  });

  it("new tools are in REQUIRED_TOOLS", () => {
    expect(REQUIRED_TOOLS).toContain("get_claims_by_predicate");
    expect(REQUIRED_TOOLS).toContain("get_concept_members");
    expect(REQUIRED_TOOLS).toContain("get_design_tensions");
    expect(REQUIRED_TOOLS).toContain("find_by_attribute");
  });

  it("new tools are read-only", () => {
    const registry = createMcpToolRegistry();
    const violations = assertNoWriteTools(registry);
    expect(violations).toEqual([]);
  });

  it("new tool names do not contain write patterns", () => {
    const writePatterns = ["write", "mutate", "delete", "create", "update", "insert", "promote", "apply", "commit"];
    const newTools = ["get_claims_by_predicate", "get_concept_members", "get_design_tensions", "find_by_attribute"];
    for (const name of newTools) {
      for (const pattern of writePatterns) {
        expect(name.toLowerCase()).not.toContain(pattern);
      }
    }
  });

  it("each new tool has description and input schema", () => {
    const registry = createMcpToolRegistry();
    for (const name of ["get_claims_by_predicate", "get_concept_members", "get_design_tensions", "find_by_attribute"]) {
      const tool = registry.tools.get(name);
      expect(tool).toBeDefined();
      expect(tool!.description).toBeTruthy();
      expect(tool!.inputSchema.type).toBe("object");
    }
  });

  // --- get_claims_by_predicate ---

  it("get_claims_by_predicate returns all claims for a predicate", () => {
    const result = getClaimsByPredicate(setup.ctx, { predicate: "has_resistance" });
    expect(result.data.predicate).toBe("has_resistance");
    expect(result.data.claims).toHaveLength(3);
    expect(result.data.total).toBe(3);
  });

  it("get_claims_by_predicate filters by source_id", () => {
    const result = getClaimsByPredicate(setup.ctx, { predicate: "has_resistance", source_id: "src-a" });
    expect(result.data.claims).toHaveLength(1);
    expect(result.data.claims[0].subject_record_key).toBe("goblin");
  });

  it("get_claims_by_predicate returns empty for unknown predicate", () => {
    const result = getClaimsByPredicate(setup.ctx, { predicate: "nonexistent" });
    expect(result.data.claims).toHaveLength(0);
    expect(result.data.total).toBe(0);
  });

  it("get_claims_by_predicate includes subject record info", () => {
    const result = getClaimsByPredicate(setup.ctx, { predicate: "has_resistance" });
    for (const claim of result.data.claims) {
      expect(claim.subject_record_id).toBeTruthy();
      expect(claim.subject_record_key).toBeTruthy();
      expect(claim.subject_record_type).toBe("creature");
    }
  });

  // --- get_concept_members ---

  it("get_concept_members resolves derived_from records", () => {
    const result = getConceptMembers(setup.ctx, { key: "fire-resistance" });
    expect(result.data.concept_key).toBe("fire-resistance");
    expect(result.data.total_members).toBe(2);
    expect(result.data.members).toHaveLength(2);
  });

  it("get_concept_members groups by source", () => {
    const result = getConceptMembers(setup.ctx, { key: "fire-resistance" });
    expect(result.data.members_by_source["src-a"]).toBeDefined();
    expect(result.data.members_by_source["src-a"].count).toBe(1);
    expect(result.data.members_by_source["src-b"]).toBeDefined();
    expect(result.data.members_by_source["src-b"].count).toBe(1);
  });

  it("get_concept_members returns empty for concept with no members", () => {
    const result = getConceptMembers(setup.ctx, { key: "shop-and-economy" });
    expect(result.data.total_members).toBe(0);
    expect(result.data.members).toHaveLength(0);
  });

  it("get_concept_members rejects non-concept record", () => {
    expect(() => getConceptMembers(setup.ctx, { key: "goblin" })).toThrow();
  });

  it("get_concept_members works with record_id", () => {
    const result = getConceptMembers(setup.ctx, { record_id: id4 });
    expect(result.data.concept_key).toBe("fire-resistance");
    expect(result.data.total_members).toBe(2);
  });

  // --- get_design_tensions ---

  it("get_design_tensions returns all tensions without filter", () => {
    const result = getDesignTensions(setup.ctx, {});
    expect(result.data.total).toBe(2);
    expect(result.data.tensions).toHaveLength(2);
  });

  it("get_design_tensions filters by record_key", () => {
    const result = getDesignTensions(setup.ctx, { record_key: "shop-and-economy" });
    expect(result.data.total).toBe(2);
    expect(result.data.tensions).toHaveLength(2);
  });

  it("get_design_tensions filters by record_id", () => {
    const result = getDesignTensions(setup.ctx, { record_id: id6 });
    expect(result.data.total).toBe(1);
    expect(result.data.tensions[0].source!.record_key).toBe("shop-and-economy");
    expect(result.data.tensions[0].target!.record_key).toBe("permadeath");
  });

  it("get_design_tensions returns tensions involving concept records", () => {
    const result = getDesignTensions(setup.ctx, { record_key: "fire-resistance" });
    expect(result.data.total).toBe(1);
    expect(result.data.tensions[0].source!.record_key).toBe("shop-and-economy");
    expect(result.data.tensions[0].target!.record_key).toBe("fire-resistance");
  });

  // --- find_by_attribute ---

  it("find_by_attribute finds records with exact match in array", () => {
    const result = findByAttribute(setup.ctx, { attribute: "flags", value: "FIREPROOF" });
    expect(result.data.total).toBe(2);
    expect(result.data.records).toHaveLength(2);
    const keys = result.data.records.map((r) => r.record_key);
    expect(keys).toContain("goblin");
    expect(keys).toContain("dragon");
  });

  it("find_by_attribute filters by source_id", () => {
    const result = findByAttribute(setup.ctx, { attribute: "flags", value: "FIREPROOF", source_id: "src-b" });
    expect(result.data.total).toBe(1);
    expect(result.data.records[0].record_key).toBe("dragon");
  });

  it("find_by_attribute filters by record_type", () => {
    const result = findByAttribute(setup.ctx, { attribute: "flags", value: "FIREPROOF", record_type: "creature" });
    expect(result.data.total).toBe(2);
  });

  it("find_by_attribute supports contains mode", () => {
    const result = findByAttribute(setup.ctx, { attribute: "flags", value: "fire", match_mode: "contains" });
    expect(result.data.total).toBe(2);
  });

  it("find_by_attribute matches scalar attributes", () => {
    const result = findByAttribute(setup.ctx, { attribute: "hp", value: "50" });
    expect(result.data.total).toBe(1);
    expect(result.data.records[0].record_key).toBe("dragon");
  });

  it("find_by_attribute returns empty for nonexistent attribute", () => {
    const result = findByAttribute(setup.ctx, { attribute: "nonexistent", value: "test" });
    expect(result.data.total).toBe(0);
  });

  it("find_by_attribute includes matched_value in results", () => {
    const result = findByAttribute(setup.ctx, { attribute: "flags", value: "FIREPROOF" });
    for (const r of result.data.records) {
      expect(r.matched_value).toBeTruthy();
    }
  });
});
