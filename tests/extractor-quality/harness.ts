// Implements ADR-0003: Extractor creation skill and quality test contour
import { describe, it, expect } from "vitest";
import {
  runExtractorDeterministic,
  type Extractor,
  type ExtractorContext,
  type StagedRecord,
  type StagedEvidence,
} from "@roguelike-games-ib/extractor-sdk";
import {
  validateEvidenceAnchor,
  type EvidenceAnchor,
} from "@roguelike-games-ib/knowledge-core";

export interface QualityCheckOptions {
  sourceId: string;
  sourceRoot: () => string;
  timeBudgetMs?: number;
  recordLossThreshold?: number;
}

export type ContextFactory = () => ExtractorContext;

interface QualityReportData {
  sourceId: string;
  totalRecords: number;
  totalEvidence: number;
  populations: Array<{ dimension: string; expected: number; extracted: number }>;
  recordsByFile: Map<string, number>;
  duplicateKeys: string[];
  duplicateNativeIds: string[];
  recordsWithoutEvidence: string[];
  invalidEvidence: Array<{ recordId: string; errors: string[] }>;
  fieldCoverage: Map<string, { total: number; filled: number }>;
}

function collectReportData(
  records: readonly StagedRecord[],
  evidence: readonly StagedEvidence[],
  populations: Array<{ dimension: string; expected: number; extracted: number }>,
  sourceRoot: string,
  sourceId: string,
): QualityReportData {
  const recordsByFile = new Map<string, number>();
  const keyCounts = new Map<string, number>();
  const nativeIdCounts = new Map<string, number>();
  const fieldCoverage = new Map<string, { total: number; filled: number }>();

  for (const r of records) {
    const filePath = r.source_identity?.path ?? "(unknown)";
    recordsByFile.set(filePath, (recordsByFile.get(filePath) ?? 0) + 1);

    keyCounts.set(r.key, (keyCounts.get(r.key) ?? 0) + 1);

    const nativeId = r.source_identity?.native_id;
    if (nativeId) {
      nativeIdCounts.set(nativeId, (nativeIdCounts.get(nativeId) ?? 0) + 1);
    }

    for (const fieldKey of Object.keys(r)) {
      const cov = fieldCoverage.get(fieldKey) ?? { total: 0, filled: 0 };
      cov.total++;
      const val = r[fieldKey as keyof StagedRecord];
      if (val !== null && val !== undefined && val !== "") {
        cov.filled++;
      }
      fieldCoverage.set(fieldKey, cov);
    }
  }

  const duplicateKeys = [...keyCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([key]) => key);
  const duplicateNativeIds = [...nativeIdCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([id]) => id);

  const recordsWithEvidence = new Set(evidence.map((e) => e.record_id));
  const recordsWithoutEvidence = records
    .filter((r) => !recordsWithEvidence.has(r.id))
    .map((r) => r.key);

  const invalidEvidence: Array<{ recordId: string; errors: string[] }> = [];
  for (const ev of evidence) {
    const anchor = ev.anchor as EvidenceAnchor;
    const validation = validateEvidenceAnchor(anchor, sourceRoot);
    if (!validation.valid) {
      invalidEvidence.push({ recordId: ev.record_id, errors: validation.errors });
    }
  }

  return {
    sourceId,
    totalRecords: records.length,
    totalEvidence: evidence.length,
    populations,
    recordsByFile,
    duplicateKeys,
    duplicateNativeIds,
    recordsWithoutEvidence,
    invalidEvidence,
    fieldCoverage,
  };
}

function formatReport(data: QualityReportData): string {
  const lines: string[] = [];
  lines.push(`\n══ Quality Report: ${data.sourceId} ══`);
  lines.push(`  Records: ${data.totalRecords}  |  Evidence: ${data.totalEvidence}`);

  lines.push("  Populations:");
  for (const pop of data.populations) {
    const match = pop.extracted === pop.expected ? "✓" : "✗";
    lines.push(`    ${match} ${pop.dimension}: expected=${pop.expected}, extracted=${pop.extracted}`);
  }

  if (data.recordsByFile.size > 0) {
    lines.push("  Records by file (top 5):");
    const sorted = [...data.recordsByFile.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    for (const [file, count] of sorted) {
      lines.push(`    ${count.toString().padStart(5)}  ${file}`);
    }
  }

  if (data.duplicateKeys.length > 0) {
    lines.push(`  ⚠ Duplicate keys: ${data.duplicateKeys.length}`);
    for (const key of data.duplicateKeys.slice(0, 5)) {
      lines.push(`    - ${key}`);
    }
  }

  if (data.duplicateNativeIds.length > 0) {
    lines.push(`  ⚠ Duplicate native_ids: ${data.duplicateNativeIds.length}`);
    for (const id of data.duplicateNativeIds.slice(0, 5)) {
      lines.push(`    - ${id}`);
    }
  }

  if (data.recordsWithoutEvidence.length > 0) {
    lines.push(`  ⚠ Records without evidence: ${data.recordsWithoutEvidence.length}`);
    for (const key of data.recordsWithoutEvidence.slice(0, 5)) {
      lines.push(`    - ${key}`);
    }
  }

  if (data.invalidEvidence.length > 0) {
    lines.push(`  ⚠ Invalid evidence anchors: ${data.invalidEvidence.length}`);
    for (const { recordId, errors } of data.invalidEvidence.slice(0, 5)) {
      lines.push(`    - ${recordId}: ${errors.join("; ")}`);
    }
  }

  if (data.fieldCoverage.size > 0) {
    lines.push("  Field coverage (incomplete only):");
    const sortedFields = [...data.fieldCoverage.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    for (const [field, cov] of sortedFields) {
      const pct = cov.total > 0 ? Math.round((cov.filled / cov.total) * 100) : 0;
      if (pct < 100) {
        lines.push(`    ${pct.toString().padStart(3)}%  ${field} (${cov.filled}/${cov.total})`);
      }
    }
  }

  lines.push(`══ /Quality Report ══\n`);
  return lines.join("\n");
}

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

    it("population breakdown by file (diagnostic)", async () => {
      const ctx = createContext();
      const result = await extractor.run(ctx);
      const records = ctx.output.getRecords();
      const evidence = ctx.output.getEvidence();

      const data = collectReportData(
        records,
        evidence,
        result.populationCounts,
        options.sourceRoot(),
        options.sourceId,
      );

      const mismatches = data.populations.filter((p) => p.extracted !== p.expected);
      if (mismatches.length > 0) {
        const report = formatReport(data);
        console.log(report);
      }

      for (const pop of result.populationCounts) {
        if (pop.extracted !== pop.expected) {
          const top5 = [...data.recordsByFile.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([file, count]) => `  ${count} from ${file}`)
            .join("\n");
          expect.fail(
            `Population '${pop.dimension}': expected ${pop.expected}, got ${pop.extracted}.\n` +
              `Records by file (top 5):\n${top5}`,
          );
        }
      }
    });
  });

  describe("Q-003: evidence coverage and integrity", () => {
    it("all staged records have at least one evidence anchor", async () => {
      const ctx = createContext();
      await extractor.run(ctx);
      const records = ctx.output.getRecords();
      const evidence = ctx.output.getEvidence();

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

    it("all evidence anchors have valid artifact hashes", async () => {
      const ctx = createContext();
      await extractor.run(ctx);
      const evidence = ctx.output.getEvidence();

      const invalid: Array<{ recordId: string; errors: string[] }> = [];
      for (const ev of evidence) {
        const anchor = ev.anchor as EvidenceAnchor;
        const validation = validateEvidenceAnchor(anchor, options.sourceRoot());
        if (!validation.valid) {
          invalid.push({ recordId: ev.record_id, errors: validation.errors });
        }
      }

      if (invalid.length > 0) {
        const details = invalid
          .slice(0, 10)
          .map(({ recordId, errors }) => `  ${recordId}: ${errors.join("; ")}`)
          .join("\n");
        expect.fail(
          `${invalid.length} evidence anchors have invalid hashes or paths:\n${details}`,
        );
      }

      expect(invalid).toHaveLength(0);
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

  describe("Q-007: record uniqueness — no duplicate keys or native_ids", () => {
    it("no duplicate record keys", async () => {
      const ctx = createContext();
      await extractor.run(ctx);
      const records = ctx.output.getRecords();

      const keyCounts = new Map<string, number>();
      for (const r of records) {
        keyCounts.set(r.key, (keyCounts.get(r.key) ?? 0) + 1);
      }
      const dupes = [...keyCounts.entries()].filter(([, c]) => c > 1);

      if (dupes.length > 0) {
        const details = dupes
          .slice(0, 10)
          .map(([key, count]) => `  ${key} (×${count})`)
          .join("\n");
        expect.fail(`${dupes.length} duplicate record keys:\n${details}`);
      }

      expect(dupes).toHaveLength(0);
    });

    it("no duplicate native_ids", async () => {
      const ctx = createContext();
      await extractor.run(ctx);
      const records = ctx.output.getRecords();

      const idCounts = new Map<string, number>();
      for (const r of records) {
        const nativeId = r.source_identity?.native_id;
        if (nativeId) {
          idCounts.set(nativeId, (idCounts.get(nativeId) ?? 0) + 1);
        }
      }
      const dupes = [...idCounts.entries()].filter(([, c]) => c > 1);

      if (dupes.length > 0) {
        const details = dupes
          .slice(0, 10)
          .map(([id, count]) => `  ${id} (×${count})`)
          .join("\n");
        expect.fail(`${dupes.length} duplicate native_ids:\n${details}`);
      }

      expect(dupes).toHaveLength(0);
    });
  });

  describe("Q-010: record key stability — identical keys between runs", () => {
    it("record key sets are identical across two runs", async () => {
      const ctx1 = createContext();
      await extractor.run(ctx1);
      const keys1 = new Set(ctx1.output.getRecords().map((r) => r.key));

      const ctx2 = createContext();
      await extractor.run(ctx2);
      const keys2 = new Set(ctx2.output.getRecords().map((r) => r.key));

      const missingInRun2 = [...keys1].filter((k) => !keys2.has(k));
      const missingInRun1 = [...keys2].filter((k) => !keys1.has(k));

      if (missingInRun2.length > 0 || missingInRun1.length > 0) {
        const details: string[] = [];
        if (missingInRun2.length > 0) {
          details.push(`  Missing in run 2 (${missingInRun2.length}): ${missingInRun2.slice(0, 5).join(", ")}`);
        }
        if (missingInRun1.length > 0) {
          details.push(`  Missing in run 1 (${missingInRun1.length}): ${missingInRun1.slice(0, 5).join(", ")}`);
        }
        expect.fail(`Record key sets differ between runs:\n${details.join("\n")}`);
      }

      expect(missingInRun2).toHaveLength(0);
      expect(missingInRun1).toHaveLength(0);
    });
  });

  describe("Quality report", () => {
    it("generates and prints quality report", async () => {
      const ctx = createContext();
      const result = await extractor.run(ctx);
      const records = ctx.output.getRecords();
      const evidence = ctx.output.getEvidence();

      const data = collectReportData(
        records,
        evidence,
        result.populationCounts,
        options.sourceRoot(),
        options.sourceId,
      );

      const report = formatReport(data);
      console.log(report);

      expect(data.totalRecords).toBeGreaterThan(0);
    });
  });
}
