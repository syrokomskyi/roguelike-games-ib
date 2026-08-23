import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const WORKSPACE = resolve(__dirname, "../..");
const MANIFEST_FILE = join(WORKSPACE, ".generated", "knowledge", "dist", "manifest.json");
const BASELINE_FILE = join(WORKSPACE, "knowledge", "baselines", "record-counts-baseline.json");

const TOLERANCE = 0.01;

describe("C17: Record count regression detection", () => {
  it("baseline file exists", () => {
    expect(existsSync(BASELINE_FILE), "Baseline file missing — run `pnpm exec tsx scripts/update-baseline.ts` first").toBe(true);
  });

  it.skipIf(!existsSync(MANIFEST_FILE) || !existsSync(BASELINE_FILE))(
    "no record count dimension decreased by more than 1% from baseline",
    () => {
      const manifest = JSON.parse(readFileSync(MANIFEST_FILE, "utf-8"));
      const baseline = JSON.parse(readFileSync(BASELINE_FILE, "utf-8"));

      const current = manifest.recordCounts;
      const regressions: string[] = [];

      for (const key of Object.keys(baseline)) {
        const baseVal = baseline[key];
        const currVal = current[key] ?? 0;
        const threshold = baseVal * (1 - TOLERANCE);

        if (currVal < threshold) {
          const delta = currVal - baseVal;
          const pctChange = baseVal === 0 ? "N/A" : ((delta / baseVal) * 100).toFixed(1);
          regressions.push(
            `  ${key}: ${currVal} (baseline: ${baseVal}, delta: ${delta}, change: ${pctChange}%)`,
          );
        }
      }

      expect(
        regressions,
        `Record count regressions detected (>1% decrease):\n${regressions.join("\n")}`,
      ).toEqual([]);
    },
  );

});
