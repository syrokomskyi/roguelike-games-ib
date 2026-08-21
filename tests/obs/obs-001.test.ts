import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildObsidianVault } from "@roguelike-games-ib/obsidian-builder";
import { parseFrontmatter } from "@roguelike-games-ib/obsidian-builder";
import { readFileSync, readdirSync, existsSync } from "node:fs";
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
  {
    id: testId(2),
    key: "brogue-ce/mechanic/scent-tracking",
    record_type: "mechanic",
    name: "Scent Tracking",
    source_identity: { source_id: "brogue-ce", native_id: "scent-tracking", path: "mechanics.json" },
  },
];

const keys = [
  { id: testId(1), key: "brogue-ce/creature/goblin", record_type: "creature" },
  { id: testId(2), key: "brogue-ce/mechanic/scent-tracking", record_type: "mechanic" },
];

describe("OBS-001: every note carries id/key/hash/generated frontmatter", () => {
  let setup: ReturnType<typeof setupCanonicalWorkspace>;

  beforeEach(() => {
    setup = setupCanonicalWorkspace({ kbId: "obs001-test", records, keys });
  });

  afterEach(() => setup.cleanup());

  it("every generated note has required frontmatter fields", () => {
    const result = buildObsidianVault({
      workspaceRoot: setup.workspace,
      distDir: setup.distDir,
      vaultDir: setup.vaultDir,
    });

    const noteFiles = collectNoteFiles(result.vaultRoot).filter(
      (f) => !f.endsWith("README.md") && !f.includes("MOC -"),
    );
    expect(noteFiles.length).toBeGreaterThan(1);

    for (const noteFile of noteFiles) {
      const content = readFileSync(noteFile, "utf-8");
      const fm = parseFrontmatter(content);
      expect(fm).not.toBeNull();
      expect(fm!["record_id"]).toBeTruthy();
      expect(fm!["record_key"]).toBeTruthy();
      expect(fm!["record_type"]).toBeTruthy();
      expect(fm!["canonical_hash"]).toBeTruthy();
      expect(fm!["generated"]).toBe(true);
    }
  });

  it("frontmatter canonical_hash matches current build hash", () => {
    const result = buildObsidianVault({
      workspaceRoot: setup.workspace,
      distDir: setup.distDir,
      vaultDir: setup.vaultDir,
    });

    const noteFiles = collectNoteFiles(result.vaultRoot).filter(
      (f) => !f.endsWith("README.md") && !f.includes("MOC -"),
    );
    for (const noteFile of noteFiles) {
      const content = readFileSync(noteFile, "utf-8");
      const fm = parseFrontmatter(content);
      expect(fm!["canonical_hash"]).toBe(result.manifest.canonicalHash);
    }
  });
});

function collectNoteFiles(dir: string): string[] {
  const files: string[] = [];
  function walk(d: string) {
    const items = readdirSync(d, { withFileTypes: true });
    for (const item of items) {
      const full = join(d, item.name);
      if (item.isDirectory()) {
        walk(full);
      } else if (item.name.endsWith(".md")) {
        files.push(full);
      }
    }
  }
  walk(dir);
  return files;
}
