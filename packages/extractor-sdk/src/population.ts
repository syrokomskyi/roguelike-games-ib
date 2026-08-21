/*
<MODULE_CONTRACT>
<purpose>Defines population contracts and resolves expected vs extracted counts, with record-loss detection by threshold.</purpose>
<non-goals>
  <item>Does not compute population denominators — receives contracts from the extractor manifest.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: PopulationContract, PopulationCount, resolvePopulationCounts, and checkRecordLoss.</item>
</CHANGE_SUMMARY>
*/
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
