import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseAbilityTypes } from "@roguelike-games-ib/crawl-extractor";

const WORKSPACE = resolve(__dirname, "../..");
const ABILITY_TYPE_H = resolve(
  WORKSPACE,
  "../roguelike-games-ib-source/crawl/crawl-ref/source/ability-type.h",
);

function loadAbilities() {
  const source = readFileSync(ABILITY_TYPE_H, "utf-8");
  return parseAbilityTypes(source, "ability-type.h");
}

describe("C-2: Crawl abilities extraction", () => {
  it("extracts exactly 216 ability entries from ability-type.h", () => {
    const abilities = loadAbilities();
    expect(abilities.length).toBe(216);
  });

  it("all abilities have nativeId starting with ABIL_", () => {
    const abilities = loadAbilities();
    for (const ab of abilities) {
      expect(ab.nativeId.startsWith("ABIL_")).toBe(true);
    }
  });

  it("all abilities have line ranges", () => {
    const abilities = loadAbilities();
    for (const ab of abilities) {
      expect(ab.lineStart).toBeGreaterThan(0);
      expect(ab.lineEnd).toBeGreaterThanOrEqual(ab.lineStart);
    }
  });

  it("all abilities have unique nativeIds", () => {
    const abilities = loadAbilities();
    const ids = abilities.map((a) => a.nativeId);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it("ABIL_NON_ABILITY sentinel is excluded", () => {
    const abilities = loadAbilities();
    expect(abilities.find((a) => a.nativeId === "ABIL_NON_ABILITY")).toBeUndefined();
  });

  it("NUM_ABILITIES sentinel is excluded", () => {
    const abilities = loadAbilities();
    expect(abilities.find((a) => a.nativeId === "NUM_ABILITIES")).toBeUndefined();
  });

  it("alias entries are excluded", () => {
    const abilities = loadAbilities();
    expect(abilities.find((a) => a.nativeId === "ABIL_MIN_EVOKE")).toBeUndefined();
    expect(abilities.find((a) => a.nativeId === "ABIL_FIRST_RELIGIOUS_ABILITY")).toBeUndefined();
    expect(abilities.find((a) => a.nativeId === "ABIL_FIRST_SACRIFICE")).toBeUndefined();
    expect(abilities.find((a) => a.nativeId === "ABIL_LAST_RELIGIOUS_ABILITY")).toBeUndefined();
  });

  it("WIZARD-only entries are excluded", () => {
    const abilities = loadAbilities();
    expect(abilities.find((a) => a.nativeId === "ABIL_WIZ_BUILD_TERRAIN")).toBeUndefined();
    expect(abilities.find((a) => a.nativeId === "ABIL_WIZ_SET_TERRAIN")).toBeUndefined();
  });

  it("ABIL_SPIT_POISON is the first entry with value 1", () => {
    const abilities = loadAbilities();
    expect(abilities[0].nativeId).toBe("ABIL_SPIT_POISON");
    expect(abilities[0].value).toBe(1);
    expect(abilities[0].name).toBe("Spit Poison");
  });

  it("ABIL_EVOKE_BERSERK has value 40 (TAG_MAJOR_VERSION == 34)", () => {
    const abilities = loadAbilities();
    const berserk = abilities.find((a) => a.nativeId === "ABIL_EVOKE_BERSERK");
    expect(berserk).toBeDefined();
    expect(berserk!.value).toBe(40);
  });

  it("ABIL_ZIN_SUSTENANCE is present (TAG_MAJOR_VERSION == 34 only)", () => {
    const abilities = loadAbilities();
    const sustenance = abilities.find((a) => a.nativeId === "ABIL_ZIN_SUSTENANCE");
    expect(sustenance).toBeDefined();
    expect(sustenance!.value).toBe(1000);
  });

  it("ABIL_PAKELLAS_DEVICE_SURGE is present (TAG_MAJOR_VERSION == 34 only)", () => {
    const abilities = loadAbilities();
    const pakellas = abilities.find((a) => a.nativeId === "ABIL_PAKELLAS_DEVICE_SURGE");
    expect(pakellas).toBeDefined();
    expect(pakellas!.value).toBe(1230);
  });

  it("ABIL_BREATHE_RUST is the last entry", () => {
    const abilities = loadAbilities();
    expect(abilities[abilities.length - 1].nativeId).toBe("ABIL_BREATHE_RUST");
  });
});
