/*
<MODULE_CONTRACT>
<purpose>Guard test — verifies every extractor package has a corresponding quality test file that imports runQualityChecks, and a README.md with a GitHub link to the game source.</purpose>
<non-goals>
  <item>Does not run the quality checks itself — only verifies file existence, import, and README content.</item>
</non-goals>
<CHANGE_SUMMARY>
  <item>Initial creation: guard test ensuring all extractors have quality test coverage.</item>
  <item>Added README.md presence and GitHub link check for every extractor package.</item>
</CHANGE_SUMMARY>
*/
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

      it(`has a README.md with a GitHub link to the game source`, () => {
        const readmePath = join(EXTRACTORS_DIR, pkgDir, "README.md");
        if (!existsSync(readmePath)) {
          expect.fail(
            `Missing README.md for extractor "${game}".\n` +
              `Expected: ${readmePath}\n` +
              `The README must contain at least a link to the game's GitHub repository.`,
          );
        }
        const readme = readFileSync(readmePath, "utf-8");
        const githubLink = readme.match(/https:\/\/github\.com\/[\w.-]+\/[\w.-]+/i);
        if (!githubLink) {
          expect.fail(
            `README.md for extractor "${game}" does not contain a GitHub link.\n` +
              `The README must include at least one https://github.com/... URL pointing to the game source repository.`,
          );
        }
        expect(githubLink).not.toBeNull();
      });
    });
  }
});
