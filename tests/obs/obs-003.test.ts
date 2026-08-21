import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildObsidianVault } from "@roguelike-games-ib/obsidian-builder";
import { setupCanonicalWorkspace, testId } from "./helpers";

const records = [
  {
    id: testId(1),
    key: "brogue-ce/creature/goblin",
    record_type: "creature",
    name: "Goblin",
    source_identity: { source_id: "brogue-ce", native_id: "goblin", path: "data.json" },
  },
  {
    id: testId(2),
    key: "brogue-ce/creature/Goblin",
    record_type: "creature",
    name: "Goblin Duplicate",
    source_identity: { source_id: "brogue-ce", native_id: "goblin-dupe", path: "data.json" },
  },
];

const keys = [
  { id: testId(1), key: "brogue-ce/creature/goblin", record_type: "creature" },
  { id: testId(2), key: "brogue-ce/creature/Goblin", record_type: "creature" },
];

describe("OBS-003: duplicate path collision fails build", () => {
  let setup: ReturnType<typeof setupCanonicalWorkspace>;

  beforeEach(() => {
    setup = setupCanonicalWorkspace({ kbId: "obs003-test", records, keys });
  });

  afterEach(() => setup.cleanup());

  it("throws when two records map to same note path", () => {
    expect(() =>
      buildObsidianVault({
        workspaceRoot: setup.workspace,
        distDir: setup.distDir,
        vaultDir: setup.vaultDir,
      }),
    ).toThrow(/Path collision/);
  });
});
