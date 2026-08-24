import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildObsidianVault } from "@roguelike-games-ib/obsidian-builder";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { setupCanonicalWorkspace, testId } from "./helpers";

const records = [
  {
    id: testId(1),
    key: "brogue-ce/creature/goblin",
    record_type: "creature",
    name: "Goblin",
    source_identity: { source_id: "brogue-ce", native_id: "goblin", path: "data.json" },
  },
];

const keys = [
  { id: testId(1), key: "brogue-ce/creature/goblin", record_type: "creature" },
];

describe("OBS-005: generated warning is present", () => {
  let setup: ReturnType<typeof setupCanonicalWorkspace>;

  beforeEach(() => {
    setup = setupCanonicalWorkspace({ kbId: "obs005-test", records, keys });
  });

  afterEach(() => setup.cleanup());

  it("README.md contains the generated warning", async () => {
    const result = await await buildObsidianVault({
      workspaceRoot: setup.workspace,
      distDir: setup.distDir,
      vaultDir: setup.vaultDir,
    });

    const readme = readFileSync(join(result.vaultRoot, "README.md"), "utf-8");
    expect(readme).toContain("GENERATED PROJECTION");
    expect(readme).toContain("DO NOT EDIT AS CANONICAL KNOWLEDGE");
  });

  it("_meta/generated.txt contains the warning", async () => {
    const result = await await buildObsidianVault({
      workspaceRoot: setup.workspace,
      distDir: setup.distDir,
      vaultDir: setup.vaultDir,
    });

    const warning = readFileSync(join(result.vaultRoot, "_meta", "generated.txt"), "utf-8");
    expect(warning).toContain("GENERATED PROJECTION");
  });
});
