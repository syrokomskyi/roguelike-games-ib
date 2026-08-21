import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildObsidianVault } from "@roguelike-games-ib/obsidian-builder";
import { materialize } from "@roguelike-games-ib/materializer";
import { readFileSync, existsSync, statSync } from "node:fs";
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

describe("OBS-004: vault build never changes canonical files", () => {
  let setup: ReturnType<typeof setupCanonicalWorkspace>;

  beforeEach(() => {
    setup = setupCanonicalWorkspace({ kbId: "obs004-test", records, keys });
  });

  afterEach(() => setup.cleanup());

  it("canonical files are unchanged after vault build", () => {
    const canonicalFile = join(setup.canonicalRoot, "creature", "brogue-ce/creature/goblin.jsonl");
    const beforeContent = readFileSync(canonicalFile, "utf-8");
    const beforeMtime = statSync(canonicalFile).mtimeMs;

    buildObsidianVault({
      workspaceRoot: setup.workspace,
      distDir: setup.distDir,
      vaultDir: setup.vaultDir,
    });

    const afterContent = readFileSync(canonicalFile, "utf-8");
    const afterMtime = statSync(canonicalFile).mtimeMs;

    expect(afterContent).toBe(beforeContent);
    expect(afterMtime).toBe(beforeMtime);
  });

  it("vault output is under generated root, not canonical root", () => {
    const result = buildObsidianVault({
      workspaceRoot: setup.workspace,
      distDir: setup.distDir,
      vaultDir: setup.vaultDir,
    });

    expect(result.vaultRoot).toContain(".generated");
    expect(result.vaultRoot.startsWith(setup.canonicalRoot)).toBe(false);
    expect(existsSync(join(result.vaultRoot, "games", "brogue-ce", "creature", "goblin.md"))).toBe(true);
  });
});
