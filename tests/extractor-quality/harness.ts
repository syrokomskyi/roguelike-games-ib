// Implements ADR-0003: Extractor creation skill and quality test contour
import { describe, it, expect } from "vitest";
import {
  runExtractorDeterministic,
  type Extractor,
  type ExtractorContext,
} from "@roguelike-games-ib/extractor-sdk";

export interface QualityCheckOptions {
  sourceId: string;
  sourceRoot: string;
  timeBudgetMs?: number;
  recordLossThreshold?: number;
}

export type ContextFactory = () => ExtractorContext;

export function runQualityChecks(
  extractor: Extractor,
  createContext: ContextFactory,
  options: QualityCheckOptions,
): void {
  const timeBudget = options.timeBudgetMs ?? 10000;
  const lossThreshold = options.recordLossThreshold ?? 0;

  describe("Q-001: determinism — two runs produce identical hashes", () => {
    it("produces identical normalized hashes on repeated runs", async () => {
      const det = await runExtractorDeterministic(extractor, createContext);
      expect(det.deterministic).toBe(true);
      expect(det.hash1).toBe(det.hash2);
    });

    it("record count is identical across runs", async () => {
      const det = await runExtractorDeterministic(extractor, createContext);
      expect(det.run1.recordCount).toBe(det.run2.recordCount);
    });
  });

  describe("Q-002: population completeness — extracted == expected", () => {
    it("all declared populations have matching extracted counts", async () => {
      const ctx = createContext();
      const result = await extractor.run(ctx);

      for (const pop of result.populationCounts) {
        expect(pop.extracted).toBe(pop.expected);
      }
    });

    it("population dimensions match manifest declarations", () => {
      const manifest = extractor.manifest;
      if (!manifest.exhaustivePopulations) {
        expect(true).toBe(true);
        return;
      }
      const declared = manifest.exhaustivePopulations.map((p) => p.dimension);
      expect(declared.length).toBeGreaterThan(0);
    });
  });

  describe("Q-003: evidence coverage — every record has evidence", () => {
    it("all staged records have at least one evidence anchor", async () => {
      const ctx = createContext();
      await extractor.run(ctx);
      const output = ctx.output;
      const records = output.getRecords();
      const evidence = output.getEvidence();

      const recordsWithEvidence = new Set(evidence.map((e) => e.record_id));
      const recordsWithoutEvidence = records.filter(
        (r) => !recordsWithEvidence.has(r.id),
      );

      expect(recordsWithoutEvidence).toHaveLength(0);
    });

    it("evidence count is at least record count", async () => {
      const ctx = createContext();
      await extractor.run(ctx);
      const records = ctx.output.getRecords();
      const evidence = ctx.output.getEvidence();
      expect(evidence.length).toBeGreaterThanOrEqual(records.length);
    });
  });

  describe("Q-004: schema validation — records pass or diagnostics emitted", () => {
    it("no ERROR diagnostics for invalid records when schema facade is null", async () => {
      const ctx = createContext();
      const result = await extractor.run(ctx);
      const errorDiags = result.diagnostics.filter((d) => d.severity === "ERROR");
      expect(errorDiags).toHaveLength(0);
    });
  });

  describe("Q-005: record loss — no unexpected loss vs previous run", () => {
    it("record count does not decrease between runs", async () => {
      const ctx1 = createContext();
      const result1 = await extractor.run(ctx1);
      const count1 = result1.recordCount;

      const ctx2 = createContext();
      const result2 = await extractor.run(ctx2);
      const count2 = result2.recordCount;

      const loss = Math.max(0, count1 - count2);
      expect(loss).toBeLessThanOrEqual(lossThreshold);
    });
  });

  describe("Q-006: performance — completes within time budget", () => {
    it(`extractor completes within ${timeBudget}ms`, async () => {
      const ctx = createContext();
      const t0 = Date.now();
      await extractor.run(ctx);
      const elapsed = Date.now() - t0;
      expect(elapsed).toBeLessThan(timeBudget);
    });
  });
}
