import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildObsidianVault } from "@roguelike-games-ib/obsidian-builder";
import { readFileSync, existsSync, readdirSync } from "node:fs";
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
    key: "brogue-ce/creature/kobold",
    record_type: "creature",
    name: "Kobold",
    source_identity: { source_id: "brogue-ce", native_id: "kobold", path: "data.json" },
  },
];

const relations = [
  {
    id: testId(10),
    relation_type: "similar_to",
    source_record_id: testId(1),
    target_record_id: testId(2),
    relation_scope: "game",
    evidence_refs: [],
  },
];

const keys = [
  { id: testId(1), key: "brogue-ce/creature/goblin", record_type: "creature" },
  { id: testId(2), key: "brogue-ce/creature/kobold", record_type: "creature" },
];

describe("OBS-002: every wiki-link resolves uniquely", () => {
  let setup: ReturnType<typeof setupCanonicalWorkspace>;

  beforeEach(() => {
    setup = setupCanonicalWorkspace({ kbId: "obs002-test", records, relations, keys });
  });

  afterEach(() => setup.cleanup());

  it("all wiki-links in generated notes resolve to exactly one note file", async () => {
    const result = await await buildObsidianVault({
      workspaceRoot: setup.workspace,
      distDir: setup.distDir,
      vaultDir: setup.vaultDir,
    });

    const allNotes = new Set<string>();
    function collectNotes(dir: string) {
      const items = readdirSync(dir, { withFileTypes: true });
      for (const item of items) {
        const full = join(dir, item.name);
        if (item.isDirectory()) {
          collectNotes(full);
        } else if (item.name.endsWith(".md")) {
          allNotes.add(full);
        }
      }
    }
    collectNotes(result.vaultRoot);

    const wikiLinkRegex = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
    const noteFiles = [...allNotes];

    for (const noteFile of noteFiles) {
      const content = readFileSync(noteFile, "utf-8");
      let match: RegExpExecArray | null;
      while ((match = wikiLinkRegex.exec(content)) !== null) {
        const linkTarget = match[1].trim();
        const targetPath = join(result.vaultRoot, linkTarget + ".md");
        expect(existsSync(targetPath)).toBe(true);
      }
    }
  });
});
