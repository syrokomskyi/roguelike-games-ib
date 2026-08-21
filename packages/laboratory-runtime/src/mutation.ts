export const MUTATION_DIMENSIONS = [
  "sensory_modality",
  "visibility",
  "persistence",
  "reversibility",
  "topology",
  "propagation",
  "ownership",
  "timing",
  "spatial_scale",
  "agency",
  "information_precision",
  "cost_model",
  "activation",
  "target",
  "directionality",
  "decay",
  "observability",
  "coupling",
] as const;

export type MutationDimension = (typeof MUTATION_DIMENSIONS)[number];

export interface MutationVector {
  id: string;
  dimension: MutationDimension;
  description: string;
  from: string;
  to: string;
  structural: boolean;
}

export interface MutationResult {
  vector_id: string;
  transformation: string;
  is_cosmetic: boolean;
}

export function applyMutation(
  input: { title: string; description: string },
  vector: MutationVector,
): MutationResult {
  const transformation = `${vector.dimension}: ${vector.from} → ${vector.to}`;
  const is_cosmetic = !vector.structural;
  return {
    vector_id: vector.id,
    transformation,
    is_cosmetic,
  };
}

export function isCosmeticMutation(result: MutationResult): boolean {
  return result.is_cosmetic;
}

export function countCosmeticMutations(results: MutationResult[]): number {
  return results.filter((r) => r.is_cosmetic).length;
}

export function countStructuralMutations(results: MutationResult[]): number {
  return results.filter((r) => !r.is_cosmetic).length;
}

export function createMutationVector(
  id: string,
  dimension: MutationDimension,
  from: string,
  to: string,
  description: string,
  structural = true,
): MutationVector {
  return {
    id,
    dimension,
    description,
    from,
    to,
    structural,
  };
}

export function createCosmeticMutationVector(
  id: string,
  dimension: MutationDimension,
  from: string,
  to: string,
  description: string,
): MutationVector {
  return {
    id,
    dimension,
    description,
    from,
    to,
    structural: false,
  };
}
