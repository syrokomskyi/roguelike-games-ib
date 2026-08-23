import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { setupMcpWorkspace, testId, type TestSetup } from "./helpers";
import {
  createMcpToolRegistry,
  assertNoWriteTools,
  REQUIRED_TOOLS,
  generateComparisonReport,
  ValidationError,
} from "@roguelike-games-ib/mcp";

const id1 = testId(1);
const id2 = testId(2);
const id3 = testId(3);
const id4 = testId(4);
const id5 = testId(5);
const id6 = testId(6);
const id7 = testId(7);

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
    implementation_refs: [id1, id2],
    ancestry: {
      derived_from: [id1, id2],
      source_games: ["src-a", "src-b"],
      observed_in: ["monsters.h resistance flags"],
    },
  },
  {
    id: id5, key: "shop-and-economy", record_type: "concept", title: "Shop and Economy",
    concept_type: "design_primitive",
    ancestry: { derived_from: [], source_games: ["src-a"] },
  },
  {
    id: id6, key: "permadeath", record_type: "concept", title: "Permadeath",
    concept_type: "design_primitive",
    ancestry: { derived_from: [], source_games: ["src-a", "src-b"] },
  },
  {
    id: id7, key: "cold-resistance", record_type: "concept", title: "Cold Resistance",
    concept_type: "cross_game_mechanic",
    implementation_refs: [id1, id3],
    ancestry: {
      derived_from: [id1, id3],
      source_games: ["src-a", "src-b"],
      observed_in: ["monsters.h resistance flags"],
    },
  },
];

const keys = records.map((r) => ({ id: r.id, key: r.key, record_type: r.record_type }));

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

describe("MCP-013: generate_comparison_report (RFC-0012)", () => {
  let setup: TestSetup;

  beforeEach(async () => {
    setup = await setupMcpWorkspace({
      kbId: "mcp013-test",
      records,
      keys,
      bindings,
    });
  });

  afterEach(() => setup.cleanup());

  // --- Tool registration ---

  it("registers generate_comparison_report tool", () => {
    const registry = createMcpToolRegistry();
    expect(registry.has("generate_comparison_report")).toBe(true);
  });

  it("tool is in REQUIRED_TOOLS", () => {
    expect(REQUIRED_TOOLS).toContain("generate_comparison_report");
  });

  it("tool is read-only", () => {
    const registry = createMcpToolRegistry();
    const violations = assertNoWriteTools(registry);
    expect(violations).not.toContain("generate_comparison_report");
  });

  // --- Markdown report ---

  it("generates markdown report for 2-game comparison", () => {
    const result = generateComparisonReport(setup.ctx, {
      source_ids: ["src-a", "src-b"],
    });

    expect(result.data).toHaveProperty("report");
    const report = (result.data as { report: string }).report;
    expect(report).toContain("# Cross-game comparison: src-a vs src-b");
    expect(report).toContain("## Overview");
    expect(report).toContain("## Concept coverage");
    expect(report).toContain("## Design primitive comparison");
    expect(report).toContain("## Concept gaps");
    expect(report).toContain("## Design tensions");
    expect(report).toContain("## Attribute comparison");
  });

  it("includes all 6 sections by default", () => {
    const result = generateComparisonReport(setup.ctx, {
      source_ids: ["src-a", "src-b"],
    });

    const report = (result.data as { report: string }).report;
    const sectionCount = (report.match(/^## /gm) ?? []).length;
    expect(sectionCount).toBe(6);
  });

  // --- Sections filter ---

  it("sections parameter filters to only requested sections", () => {
    const result = generateComparisonReport(setup.ctx, {
      source_ids: ["src-a", "src-b"],
      sections: ["overview", "coverage"],
    });

    const report = (result.data as { report: string }).report;
    expect(report).toContain("## Overview");
    expect(report).toContain("## Concept coverage");
    expect(report).not.toContain("## Design primitive comparison");
    expect(report).not.toContain("## Concept gaps");
    expect(report).not.toContain("## Design tensions");
    expect(report).not.toContain("## Attribute comparison");
  });

  it("invalid section names are silently ignored", () => {
    const result = generateComparisonReport(setup.ctx, {
      source_ids: ["src-a", "src-b"],
      sections: ["overview", "invalid_section", "coverage"],
    });

    const report = (result.data as { report: string }).report;
    expect(report).toContain("## Overview");
    expect(report).toContain("## Concept coverage");
    expect(report).not.toContain("## invalid_section");
  });

  // --- JSON format ---

  it("format: json returns structured JSON object", () => {
    const result = generateComparisonReport(setup.ctx, {
      source_ids: ["src-a", "src-b"],
      format: "json",
    });

    expect(result.data).toHaveProperty("sections");
    const sections = (result.data as { sections: Record<string, unknown> }).sections;
    expect(sections).toHaveProperty("overview");
    expect(sections).toHaveProperty("coverage");
    expect(sections).toHaveProperty("primitives");
    expect(sections).toHaveProperty("gaps");
    expect(sections).toHaveProperty("tensions");
    expect(sections).toHaveProperty("attributes");
  });

  // --- concept_key mode ---

  it("concept_key generates single-concept comparison", () => {
    const result = generateComparisonReport(setup.ctx, {
      source_ids: ["src-a", "src-b"],
      concept_key: "fire-resistance",
    });

    const report = (result.data as { report: string }).report;
    expect(report).toContain("Cross-game comparison: fire-resistance");
  });

  it("missing concept_key shows note in primitives section", () => {
    const result = generateComparisonReport(setup.ctx, {
      source_ids: ["src-a", "src-b"],
      concept_key: "nonexistent-concept",
      sections: ["primitives"],
    });

    const report = (result.data as { report: string }).report;
    expect(report).toContain("No concept found for key: nonexistent-concept");
  });

  // --- Edge cases ---

  it("throws ValidationError for fewer than 2 source_ids", () => {
    expect(() =>
      generateComparisonReport(setup.ctx, { source_ids: ["src-a"] }),
    ).toThrow(ValidationError);
  });

  it("throws ValidationError for more than 8 source_ids", () => {
    const many = Array.from({ length: 9 }, (_, i) => `src-${i}`);
    expect(() =>
      generateComparisonReport(setup.ctx, { source_ids: many }),
    ).toThrow(ValidationError);
  });

  it("missing curated summary shows fallback text", () => {
    const result = generateComparisonReport(setup.ctx, {
      source_ids: ["src-a", "src-b"],
      sections: ["primitives"],
    });

    const report = (result.data as { report: string }).report;
    expect(report).toContain("No curated summary available");
  });
});
