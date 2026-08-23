import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { setupWebWorkspace, testId, type TestSetup } from "./helpers";
import { buildReportData, formatReportAsMarkdown } from "@roguelike-games-ib/web";

const id1 = testId(1);
const id2 = testId(2);
const id3 = testId(3);
const id4 = testId(4);
const id5 = testId(5);

const records = [
  {
    id: id1, key: "goblin", record_type: "creature", title: "Goblin",
    source_identity: { source_id: "src-a", native_id: "goblin", path: "data.json" },
  },
  {
    id: id2, key: "dragon", record_type: "creature", title: "Dragon",
    source_identity: { source_id: "src-b", native_id: "dragon", path: "data.json" },
  },
  {
    id: id3, key: "fire-resistance", record_type: "concept", title: "Fire Resistance",
    concept_type: "cross_game_mechanic",
    ancestry: { derived_from: [id1, id2], source_games: ["src-a", "src-b"] },
  },
  {
    id: id4, key: "shop-and-economy", record_type: "concept", title: "Shop and Economy",
    concept_type: "design_primitive",
    ancestry: { derived_from: [], source_games: ["src-a"] },
  },
  {
    id: id5, key: "permadeath", record_type: "concept", title: "Permadeath",
    concept_type: "design_primitive",
    ancestry: { derived_from: [], source_games: ["src-a", "src-b"] },
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

describe("WEB-008: report generation (RFC-0012)", () => {
  let setup: TestSetup;

  beforeEach(async () => {
    setup = await setupWebWorkspace({
      kbId: "web008-test",
      records,
      keys,
      bindings,
    });
  });

  afterEach(() => setup.cleanup());

  it("buildReportData returns data for 2 sources", () => {
    const data = buildReportData(setup.ctx.store, ["src-a", "src-b"]);
    expect(data.sourceIds).toEqual(["src-a", "src-b"]);
    expect(data.overview).toHaveLength(2);
    expect(data.overview[0].sourceId).toBe("src-a");
    expect(data.overview[1].sourceId).toBe("src-b");
  });

  it("buildReportData overview has record counts", () => {
    const data = buildReportData(setup.ctx.store, ["src-a", "src-b"]);
    expect(data.overview[0].recordCount).toBeGreaterThan(0);
    expect(data.overview[1].recordCount).toBeGreaterThan(0);
  });

  it("buildReportData coverage matrix has concept types", () => {
    const data = buildReportData(setup.ctx.store, ["src-a", "src-b"]);
    expect(data.coverage.conceptTypes).toContain("cross_game_mechanic");
    expect(data.coverage.conceptTypes).toContain("design_primitive");
  });

  it("buildReportData gaps identifies missing concepts", () => {
    const data = buildReportData(setup.ctx.store, ["src-a", "src-b"]);
    const shopGap = data.gaps.find((g) => g.conceptKey === "shop-and-economy");
    expect(shopGap).toBeDefined();
    expect(shopGap!.missingFrom).toContain("src-b");
    expect(shopGap!.presentIn).toContain("src-a");
  });

  it("formatReportAsMarkdown returns non-empty markdown", () => {
    const data = buildReportData(setup.ctx.store, ["src-a", "src-b"]);
    const markdown = formatReportAsMarkdown(data);
    expect(markdown).toBeTruthy();
    expect(markdown.length).toBeGreaterThan(0);
  });

  it("formatReportAsMarkdown contains expected section headers", () => {
    const data = buildReportData(setup.ctx.store, ["src-a", "src-b"]);
    const markdown = formatReportAsMarkdown(data);
    expect(markdown).toContain("# Cross-game comparison: src-a vs src-b");
    expect(markdown).toContain("## Overview");
    expect(markdown).toContain("## Concept coverage");
    expect(markdown).toContain("## Concept gaps");
  });

  it("formatReportAsMarkdown contains coverage table", () => {
    const data = buildReportData(setup.ctx.store, ["src-a", "src-b"]);
    const markdown = formatReportAsMarkdown(data);
    expect(markdown).toContain("| Concept type |");
    expect(markdown).toContain("cross_game_mechanic");
    expect(markdown).toContain("design_primitive");
  });
});
