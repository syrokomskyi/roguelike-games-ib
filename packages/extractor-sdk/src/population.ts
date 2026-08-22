/*
<MODULE_CONTRACT>
<purpose>Defines population contracts, resolves expected vs extracted counts, detects record loss by threshold, and owns the resolve→write→count flow via PopulationCollector.</purpose>
<non-goals>
  <item>Does not compute population denominators — receives contracts from the extractor manifest.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: PopulationContract, PopulationCount, resolvePopulationCounts, and checkRecordLoss.</item>
  <item>Added PopulationCollector — owns the resolve→write→count flow for populations.</item>
</CHANGE_SUMMARY>
*/
import type { CandidateWriter } from "./output-writer.ts";

export interface PopulationContract {
  dimension: string;
  denominatorKind: "extractor_population" | "declared_target_set" | "qualitative";
  expected: number | null;
  description: string;
}

export interface PopulationCount {
  dimension: string;
  expected: number;
  extracted: number;
}

export function resolvePopulationCounts(
  contracts: PopulationContract[],
  extractedByDimension: Map<string, number>,
): PopulationCount[] {
  return contracts.map((c) => ({
    dimension: c.dimension,
    expected: c.expected ?? 0,
    extracted: extractedByDimension.get(c.dimension) ?? 0,
  }));
}

export function checkRecordLoss(
  previousCount: number,
  currentCount: number,
  threshold: number,
): { lossDetected: boolean; lostCount: number } {
  const lostCount = Math.max(0, previousCount - currentCount);
  return {
    lossDetected: lostCount > threshold,
    lostCount,
  };
}

export class PopulationCollector {
  constructor(
    private readonly contracts: PopulationContract[],
    private readonly output: CandidateWriter,
  ) {}

  collect(
    dimensionCounts: Map<string, number>,
    extraPopulations?: PopulationCount[],
  ): { populationCounts: PopulationCount[]; recordCount: number } {
    const populationCounts: PopulationCount[] = [
      ...this.contracts.map((c) => ({
        dimension: c.dimension,
        expected: c.expected ?? 0,
        extracted: dimensionCounts.get(c.dimension) ?? 0,
      })),
      ...(extraPopulations ?? []),
    ];

    for (const pop of populationCounts) {
      this.output.writePopulation(pop.dimension, pop.expected, pop.extracted);
    }

    const recordCount = populationCounts.reduce((sum, p) => sum + p.extracted, 0);
    return { populationCounts, recordCount };
  }
}
