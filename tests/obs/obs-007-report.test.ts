import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildObsidianVault } from "@roguelike-games-ib/obsidian-builder";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { setupCanonicalWorkspace, testId } from "./helpers";

const records = [
  {
    id: testId(1),
    key: "src-a/creature/goblin",
    record_type: "creature",
    name: "Goblin",
    source_identity: { source_id: "src-a", native_id: "goblin", path: "data.json" },
  },
  {
    id: testId(2),
    key: "src-b/creature/dragon",
    record_type: "creature",
    name: "Dragon",
    source_identity: { source_id: "src-b", native_id: "dragon", path: "data.json" },
  },
  {
    id: testId(3),
    key: "fire-resistance",
    record_type: "concept",
    title: "Fire Resistance",
    concept_type: "cross_game_mechanic",
    ancestry: { derived_from: [testId(1), testId(2)], source_games: ["src-a", "src-b"] },
  },
  {
    id: testId(4),
    key: "shop-and-economy",
    record_type: "concept",
    title: "Shop and Economy",
    concept_type: "design_primitive",
    ancestry: { derived_from: [], source_games: ["src-a"] },
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

describe("OBS-007: comparison report notes (RFC-0012)", () => {
  let setup: ReturnType<typeof setupCanonicalWorkspace>;

  beforeEach(() => {
    setup = setupCanonicalWorkspace({ kbId: "obs007-test", records, keys, bindings });
  });

  afterEach(() => setup.cleanup());

  it("generates report notes when reports: true", () => {
    const result = buildObsidianVault({
      workspaceRoot: setup.workspace,
      distDir: setup.distDir,
      vaultDir: setup.vaultDir,
      reports: true,
    });

    const reportPath = join(result.vaultRoot, "reports/comparisons/src-a-vs-src-b.md");
    expect(existsSync(reportPath)).toBe(true);
  });

  it("report note contains comparison title and sections", () => {
    const result = buildObsidianVault({
      workspaceRoot: setup.workspace,
      distDir: setup.distDir,
      vaultDir: setup.vaultDir,
      reports: true,
    });

    const reportPath = join(result.vaultRoot, "reports/comparisons/src-a-vs-src-b.md");
    const content = readFileSync(reportPath, "utf-8");
    expect(content).toContain("Comparison: src-a vs src-b");
    expect(content).toContain("## Overview");
    expect(content).toContain("## Concept coverage");
    expect(content).toContain("## Concept gaps");
  });

  it("report note contains wiki-links to concepts", () => {
    const result = buildObsidianVault({
      workspaceRoot: setup.workspace,
      distDir: setup.distDir,
      vaultDir: setup.vaultDir,
      reports: true,
    });

    const reportPath = join(result.vaultRoot, "reports/comparisons/src-a-vs-src-b.md");
    const content = readFileSync(reportPath, "utf-8");
    expect(content).toContain("[[");
  });

  it("does NOT generate report notes when reports is not set", () => {
    const result = buildObsidianVault({
      workspaceRoot: setup.workspace,
      distDir: setup.distDir,
      vaultDir: setup.vaultDir,
    });

    const reportDir = join(result.vaultRoot, "reports/comparisons");
    expect(existsSync(reportDir)).toBe(false);
  });

  it("MOC includes Comparison Reports section when reports are generated", () => {
    const result = buildObsidianVault({
      workspaceRoot: setup.workspace,
      distDir: setup.distDir,
      vaultDir: setup.vaultDir,
      reports: true,
    });

    const mocPath = join(result.vaultRoot, "MOC - Roguelike Games KB.md");
    const mocContent = readFileSync(mocPath, "utf-8");
    expect(mocContent).toContain("## Comparison Reports");
    expect(mocContent).toContain("reports/comparisons/src-a-vs-src-b");
  });

  it("MOC does NOT include Comparison Reports section when reports are not generated", () => {
    const result = buildObsidianVault({
      workspaceRoot: setup.workspace,
      distDir: setup.distDir,
      vaultDir: setup.vaultDir,
    });

    const mocPath = join(result.vaultRoot, "MOC - Roguelike Games KB.md");
    const mocContent = readFileSync(mocPath, "utf-8");
    expect(mocContent).not.toContain("## Comparison Reports");
  });
});
