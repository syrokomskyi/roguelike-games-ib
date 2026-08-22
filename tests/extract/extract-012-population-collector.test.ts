import { describe, it, expect } from "vitest";
import {
  PopulationCollector,
  type PopulationContract,
  type PopulationCount,
  CandidateWriter,
} from "@roguelike-games-ib/extractor-sdk";
import { rmSync } from "node:fs";
import { join } from "node:path";

const TMP_DIR = join(import.meta.dirname, "..", "tmp", "extract-012");

function cleanup() {
  try {
    rmSync(TMP_DIR, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

function makeWriter(runId = "test-run"): CandidateWriter {
  return new CandidateWriter(TMP_DIR, runId, "test", "test-extractor", "1.0.0");
}

describe("PopulationCollector", () => {
  it("collects counts for matching contracts", () => {
    cleanup();
    const contracts: PopulationContract[] = [
      { dimension: "creatures", denominatorKind: "extractor_population", expected: 5, description: "test creatures" },
      { dimension: "items", denominatorKind: "extractor_population", expected: 10, description: "test items" },
    ];
    const writer = makeWriter();
    const collector = new PopulationCollector(contracts, writer);

    const dimensionCounts = new Map([
      ["creatures", 5],
      ["items", 10],
    ]);

    const { populationCounts, recordCount } = collector.collect(dimensionCounts);

    expect(populationCounts).toHaveLength(2);
    expect(populationCounts[0]).toEqual({ dimension: "creatures", expected: 5, extracted: 5 });
    expect(populationCounts[1]).toEqual({ dimension: "items", expected: 10, extracted: 10 });
    expect(recordCount).toBe(15);
    cleanup();
  });

  it("handles mismatched counts", () => {
    cleanup();
    const contracts: PopulationContract[] = [
      { dimension: "creatures", denominatorKind: "extractor_population", expected: 5, description: "test creatures" },
    ];
    const writer = makeWriter();
    const collector = new PopulationCollector(contracts, writer);

    const dimensionCounts = new Map([["creatures", 3]]);

    const { populationCounts, recordCount } = collector.collect(dimensionCounts);

    expect(populationCounts[0]).toEqual({ dimension: "creatures", expected: 5, extracted: 3 });
    expect(recordCount).toBe(3);
    cleanup();
  });

  it("handles empty contracts", () => {
    cleanup();
    const writer = makeWriter();
    const collector = new PopulationCollector([], writer);

    const { populationCounts, recordCount } = collector.collect(new Map());

    expect(populationCounts).toHaveLength(0);
    expect(recordCount).toBe(0);
    cleanup();
  });

  it("merges extra populations", () => {
    cleanup();
    const contracts: PopulationContract[] = [
      { dimension: "creatures", denominatorKind: "extractor_population", expected: 5, description: "test creatures" },
    ];
    const writer = makeWriter();
    const collector = new PopulationCollector(contracts, writer);

    const dimensionCounts = new Map([["creatures", 5]]);
    const extra: PopulationCount[] = [
      { dimension: "image_assets", expected: 3, extracted: 3 },
    ];

    const { populationCounts, recordCount } = collector.collect(dimensionCounts, extra);

    expect(populationCounts).toHaveLength(2);
    expect(populationCounts[1]).toEqual({ dimension: "image_assets", expected: 3, extracted: 3 });
    expect(recordCount).toBe(8);
    cleanup();
  });

  it("writes populations to output", () => {
    cleanup();
    const contracts: PopulationContract[] = [
      { dimension: "creatures", denominatorKind: "extractor_population", expected: 2, description: "test creatures" },
    ];
    const writer = makeWriter();
    const collector = new PopulationCollector(contracts, writer);

    collector.collect(new Map([["creatures", 2]]));

    const populations = writer.getPopulation();
    expect(populations).toHaveLength(1);
    expect(populations[0]).toEqual({ dimension: "creatures", expected: 2, extracted: 2 });
    cleanup();
  });
});
