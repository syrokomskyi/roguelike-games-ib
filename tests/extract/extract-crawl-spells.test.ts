import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  parseSpellData,
  parseBranchData,
} from "@roguelike-games-ib/crawl-extractor";

const WORKSPACE = resolve(__dirname, "../..");
const SOURCE_DIR = resolve(WORKSPACE, "../roguelike-games-ib-source/crawl/crawl-ref/source");

describe("C-1: Crawl spells extraction", () => {
  it("extracts exactly 418 spell entries from spl-data.h", () => {
    const source = readFileSync(resolve(SOURCE_DIR, "spl-data.h"), "utf-8");
    const spells = parseSpellData(source, "spl-data.h");
    expect(spells.length).toBe(418);
  });

  it("first spell is SPELL_CAUSE_FEAR with correct attributes", () => {
    const source = readFileSync(resolve(SOURCE_DIR, "spl-data.h"), "utf-8");
    const spells = parseSpellData(source, "spl-data.h");
    expect(spells[0].nativeId).toBe("SPELL_CAUSE_FEAR");
    expect(spells[0].name).toBe("Cause Fear");
    expect(spells[0].schools).toBe("spschool::hexes");
    expect(spells[0].level).toBe(4);
    expect(spells[0].powerCap).toBe(200);
  });

  it("all spells have SPELL_ prefix in nativeId", () => {
    const source = readFileSync(resolve(SOURCE_DIR, "spl-data.h"), "utf-8");
    const spells = parseSpellData(source, "spl-data.h");
    for (const spell of spells) {
      expect(spell.nativeId.startsWith("SPELL_")).toBe(true);
    }
  });

  it("all spells have line ranges", () => {
    const source = readFileSync(resolve(SOURCE_DIR, "spl-data.h"), "utf-8");
    const spells = parseSpellData(source, "spl-data.h");
    for (const spell of spells) {
      expect(spell.lineStart).toBeGreaterThan(0);
      expect(spell.lineEnd).toBeGreaterThan(spell.lineStart);
    }
  });
});

describe("C-3: Crawl branches extraction", () => {
  it("extracts exactly 41 branch entries from branch-data.h", () => {
    const source = readFileSync(resolve(SOURCE_DIR, "branch-data.h"), "utf-8");
    const branches = parseBranchData(source, "branch-data.h");
    expect(branches.length).toBe(41);
  });

  it("first branch is BRANCH_DUNGEON", () => {
    const source = readFileSync(resolve(SOURCE_DIR, "branch-data.h"), "utf-8");
    const branches = parseBranchData(source, "branch-data.h");
    expect(branches[0].nativeId).toBe("BRANCH_DUNGEON");
  });

  it("all branches have BRANCH_ prefix in nativeId", () => {
    const source = readFileSync(resolve(SOURCE_DIR, "branch-data.h"), "utf-8");
    const branches = parseBranchData(source, "branch-data.h");
    for (const branch of branches) {
      expect(branch.nativeId.startsWith("BRANCH_")).toBe(true);
    }
  });
});
