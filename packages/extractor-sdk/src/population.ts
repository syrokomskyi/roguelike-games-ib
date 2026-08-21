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
