import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { parseFormYaml } from "@roguelike-games-ib/crawl-extractor";

const WORKSPACE = resolve(__dirname, "../..");
const FORMS_DIR = resolve(
  WORKSPACE,
  "../roguelike-games-ib-source/crawl/crawl-ref/source/dat/forms",
);

function loadAllForms() {
  const files = readdirSync(FORMS_DIR).filter((f) => f.endsWith(".yaml"));
  return files.map((f) => {
    const text = readFileSync(join(FORMS_DIR, f), "utf-8");
    return parseFormYaml(text, `forms/${f}`);
  });
}

describe("C-4: Crawl forms extraction", () => {
  it("extracts exactly 35 form entries from dat/forms/", () => {
    const forms = loadAllForms().filter((f) => f !== null);
    expect(forms.length).toBe(35);
  });

  it("all forms have non-null enum field", () => {
    const forms = loadAllForms();
    for (const form of forms) {
      expect(form).not.toBeNull();
      expect(form!.enum).toBeTruthy();
    }
  });

  it("all forms have line ranges", () => {
    const forms = loadAllForms();
    for (const form of forms) {
      expect(form!.lineStart).toBeGreaterThan(0);
      expect(form!.lineEnd).toBeGreaterThanOrEqual(form!.lineStart);
    }
  });

  it("all forms have unique native IDs", () => {
    const forms = loadAllForms();
    const ids = forms.map((f) => f!.enum);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it("none form has empty short_name and enum 'none'", () => {
    const text = readFileSync(join(FORMS_DIR, "none.yaml"), "utf-8");
    const form = parseFormYaml(text, "forms/none.yaml");
    expect(form).not.toBeNull();
    expect(form!.enum).toBe("none");
    expect(form!.shortName).toBeNull();
    expect(form!.name).toBe("none");
  });

  it("blade form has talisman and skill", () => {
    const text = readFileSync(join(FORMS_DIR, "blade.yaml"), "utf-8");
    const form = parseFormYaml(text, "forms/blade.yaml");
    expect(form).not.toBeNull();
    expect(form!.enum).toBe("blade");
    expect(form!.talisman).toBe("blade");
    expect(form!.skill).toEqual({ min: 17, max: 25 });
  });

  it("dragon form has hp_mod and fakemuts", () => {
    const text = readFileSync(join(FORMS_DIR, "dragon.yaml"), "utf-8");
    const form = parseFormYaml(text, "forms/dragon.yaml");
    expect(form).not.toBeNull();
    expect(form!.enum).toBe("dragon");
    expect(form!.hpMod).toBe(150);
    expect(form!.fakemuts).not.toBeNull();
    expect(form!.fakemuts!.length).toBeGreaterThan(0);
  });

  it("spider form has badmuts and resists", () => {
    const text = readFileSync(join(FORMS_DIR, "spider.yaml"), "utf-8");
    const form = parseFormYaml(text, "forms/spider.yaml");
    expect(form).not.toBeNull();
    expect(form!.enum).toBe("spider");
    expect(form!.badmuts).not.toBeNull();
    expect(form!.badmuts!.length).toBeGreaterThan(0);
    expect(form!.resists).toEqual({ poison: -1 });
  });

  it("deprecated-appendage form is still extracted", () => {
    const text = readFileSync(
      join(FORMS_DIR, "deprecated-appendage.yaml"),
      "utf-8",
    );
    const form = parseFormYaml(text, "forms/deprecated-appendage.yaml");
    expect(form).not.toBeNull();
    expect(form!.enum).toBe("appendage");
  });

  it("sun-scarab form has enum with underscore", () => {
    const text = readFileSync(join(FORMS_DIR, "sun-scarab.yaml"), "utf-8");
    const form = parseFormYaml(text, "forms/sun-scarab.yaml");
    expect(form).not.toBeNull();
    expect(form!.enum).toBe("sun_scarab");
    expect(form!.shortName).toBe("Scarab");
    expect(form!.name).toBe("Scarab");
  });
});
