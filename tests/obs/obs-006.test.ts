import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildObsidianVault } from "@roguelike-games-ib/obsidian-builder";
import { parseFrontmatter } from "@roguelike-games-ib/obsidian-builder";
import { readFileSync, readdirSync } from "node:fs";
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
    key: "cross-game/concept/hidden-decaying-field",
    record_type: "concept",
    name: "Hidden Decaying Field",
    scope: "cross_game",
  },
];

const keys = [
  { id: testId(1), key: "brogue-ce/creature/goblin", record_type: "creature" },
  { id: testId(2), key: "cross-game/concept/hidden-decaying-field", record_type: "concept" },
];

const aliases = [
  { key: "brogue-ce/creature/old-goblin-name", retired_to: "brogue-ce/creature/goblin", retired_at: "2026-01-01T00:00:00Z" },
];

describe("OBS-006: localized projection preserves canonical id", () => {
  let setup: ReturnType<typeof setupCanonicalWorkspace>;

  beforeEach(() => {
    setup = setupCanonicalWorkspace({ kbId: "obs006-test", records, keys, aliases });
  });

  afterEach(() => setup.cleanup());

  it("every note preserves record_id and record_key from canonical", () => {
    const result = buildObsidianVault({
      workspaceRoot: setup.workspace,
      distDir: setup.distDir,
      vaultDir: setup.vaultDir,
    });

    const noteFiles = collectNoteFiles(result.vaultRoot);
    const ids = new Set<string>();
    const canonicalKeys = new Set<string>();

    for (const noteFile of noteFiles) {
      const content = readFileSync(noteFile, "utf-8");
      const fm = parseFrontmatter(content);
      if (fm && fm["record_id"]) {
        ids.add(fm["record_id"] as string);
        canonicalKeys.add(fm["record_key"] as string);
      }
    }

    expect(ids.has(testId(1))).toBe(true);
    expect(ids.has(testId(2))).toBe(true);
    expect(canonicalKeys.has("brogue-ce/creature/goblin")).toBe(true);
    expect(canonicalKeys.has("cross-game/concept/hidden-decaying-field")).toBe(true);
  });

  it("alias-resolved record preserves original canonical id", () => {
    const result = buildObsidianVault({
      workspaceRoot: setup.workspace,
      distDir: setup.distDir,
      vaultDir: setup.vaultDir,
    });

    const goblinNote = findNoteById(result.vaultRoot, testId(1));
    expect(goblinNote).toBeTruthy();
    const content = readFileSync(goblinNote!, "utf-8");
    const fm = parseFrontmatter(content);
    expect(fm!["record_id"]).toBe(testId(1));
    expect(fm!["record_key"]).toBe("brogue-ce/creature/goblin");
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

function findNoteById(dir: string, id: string): string | undefined {
  for (const file of collectNoteFiles(dir)) {
    const content = readFileSync(file, "utf-8");
    const fm = parseFrontmatter(content);
    if (fm && fm["record_id"] === id) return file;
  }
  return undefined;
}
