import { describe, it, expect } from "vitest";
import { readdirSync, existsSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";

const WORKSPACE = resolve(__dirname, "../..");
const EXTRACTORS_DIR = join(WORKSPACE, "packages/extractors");
const QUALITY_DIR = join(WORKSPACE, "tests/extractor-quality");

function getExtractorPackages(): string[] {
  return readdirSync(EXTRACTORS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name.endsWith("-extractor"))
    .map((d) => d.name);
}

function extractGameName(pkgDir: string): string {
  return pkgDir.replace(/-extractor$/, "");
}

describe("extractor quality guard — every extractor must have a quality test", () => {
  const packages = getExtractorPackages();

  it("at least one extractor package exists (sanity)", () => {
    expect(packages.length).toBeGreaterThan(0);
  });

  for (const pkgDir of packages) {
    const game = extractGameName(pkgDir);
    const expectedTest = join(QUALITY_DIR, `${game}-quality.test.ts`);

    describe(`extractor: ${game}`, () => {
      it(`has a quality test file at tests/extractor-quality/${game}-quality.test.ts`, () => {
        if (!existsSync(expectedTest)) {
          expect.fail(
            `Missing quality test for extractor "${game}".\n` +
              `Expected: ${expectedTest}\n` +
              `Create it by following the fo-create-extractor skill, step 7.\n` +
              `See tests/extractor-quality/README.md for the template.`,
          );
        }
        expect(existsSync(expectedTest)).toBe(true);
      });

      it(`quality test imports runQualityChecks from harness`, () => {
        if (!existsSync(expectedTest)) {
          expect.fail(`Cannot check imports — quality test file is missing for "${game}"`);
        }
        const content = readFileSync(expectedTest, "utf-8");
        if (!content.includes("runQualityChecks")) {
          expect.fail(
            `Quality test for "${game}" does not import runQualityChecks from the harness.\n` +
              `The test must call runQualityChecks() to run the standard quality dimensions.\n` +
              `See tests/extractor-quality/README.md for the template.`,
          );
        }
        expect(content).toContain("runQualityChecks");
      });
    });
  }
});
