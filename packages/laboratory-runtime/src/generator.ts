/*
<MODULE_CONTRACT>
<purpose>Runs the inspiration pipeline — generates seeds via AI or deterministic fallback, evaluates constraints, creates ancestry, and persists results.</purpose>
<non-goals>
  <item>Does not promote seeds to canonical — use seeds module.</item>
  <item>Does not manage sessions — use sessions module.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: IdeaGenerator interface, runInspirationPipeline, deterministicGenerate, NullGenerator, FailingGenerator.</item>
</CHANGE_SUMMARY>
*/
import type { DesignConstraints } from "./constraints.ts";
import type { MutationVector, MutationResult } from "./mutation.ts";
import type { SeedRecord, SeedScore, GeneratorMetadata } from "./schema.ts";
import type { AncestryRecord } from "./ancestry.ts";
import { createAncestry, validateAncestry } from "./ancestry.ts";
import { checkConstraints } from "./constraints.ts";
import {
  createSeed,
  persistSeed,
  computeAntiCopyPenalty,
  computeScores,
  evaluateSeed,
} from "./seeds.ts";
import { assertNoCanonicalMutation } from "./boundary.ts";
import { join } from "node:path";

export interface CanonicalIngredient {
  id: string;
  key: string;
  record_type: string;
  title: string;
  description: string;
}

export interface IdeaGeneratorInput {
  constraints: DesignConstraints;
  canonical_ingredients: CanonicalIngredient[];
  mutation_vectors: MutationVector[];
}

export interface IdeaGeneratorOutput {
  title: string;
  description: string;
  selected_ingredient_ids: string[];
  applied_mutations: MutationResult[];
  base_scores: { novelty: number; fit: number; leverage: number; cost: number };
}

export interface IdeaGenerator {
  generate(input: IdeaGeneratorInput): Promise<IdeaGeneratorOutput[]>;
}

export interface InspirationPipelineOptions {
  sessionId: string;
  constraints: DesignConstraints;
  canonicalIngredients: CanonicalIngredient[];
  mutationVectors: MutationVector[];
  generator: IdeaGenerator | null;
  laboratoryRoot: string;
  canonicalRoot: string;
  persistResults: boolean;
}

export interface InspirationPipelineResult {
  seeds: SeedRecord[];
  errors: string[];
  canonical_state_mutated: boolean;
}

export async function runInspirationPipeline(
  options: InspirationPipelineOptions,
): Promise<InspirationPipelineResult> {
  const errors: string[] = [];
  const seeds: SeedRecord[] = [];
  let canonicalMutated = false;

  const generatorMetadata: GeneratorMetadata = options.generator
    ? {
        provider: "configured-provider",
        model: "configured-model",
        template_version: "1.0.0",
        prompt_version: "1.0.0",
        generated_at: new Date().toISOString(),
      }
    : {
        provider: null,
        model: null,
        template_version: null,
        prompt_version: null,
        generated_at: null,
      };

  let outputs: IdeaGeneratorOutput[];

  if (options.generator) {
    try {
      outputs = await options.generator.generate({
        constraints: options.constraints,
        canonical_ingredients: options.canonicalIngredients,
        mutation_vectors: options.mutationVectors,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      errors.push(`Generator failure: ${msg}`);
      return { seeds: [], errors, canonical_state_mutated: false };
    }
  } else {
    outputs = deterministicGenerate({
      constraints: options.constraints,
      canonical_ingredients: options.canonicalIngredients,
      mutation_vectors: options.mutationVectors,
    });
  }

  for (const output of outputs) {
    try {
      const selectedIngredients = options.canonicalIngredients.filter((ing) =>
        output.selected_ingredient_ids.includes(ing.id),
      );

      const { scores, constraintCheck } = evaluateSeed(
        {
          title: output.title,
          description: output.description,
          ancestry: { transformations: output.applied_mutations.map((m) => m.transformation) },
        },
        options.constraints,
        output.applied_mutations,
        selectedIngredients.length,
        output.base_scores,
      );

      const ancestry = createAncestry(
        output.selected_ingredient_ids,
        output.applied_mutations,
        constraintCheck,
        generatorMetadata,
      );

      const tempSeedId = "temp";
      const ancestryValidation = validateAncestry(ancestry, tempSeedId);
      if (!ancestryValidation.valid) {
        errors.push(`Ancestry validation failed: ${ancestryValidation.errors.join("; ")}`);
        continue;
      }

      const seedKey = `lab/seed/${output.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

      const seed = createSeed(
        seedKey,
        output.title,
        output.description,
        ancestry,
        scores,
        generatorMetadata,
        options.sessionId,
      );

      seeds.push(seed);

      if (options.persistResults) {
        assertNoCanonicalMutation(
          options.laboratoryRoot,
          options.canonicalRoot,
          join(options.laboratoryRoot, "seeds", `${seed.id}.json`),
        );
        persistSeed(seed, options.laboratoryRoot);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      errors.push(`Seed creation failed: ${msg}`);
    }
  }

  return {
    seeds,
    errors,
    canonical_state_mutated: canonicalMutated,
  };
}

function deterministicGenerate(input: IdeaGeneratorInput): IdeaGeneratorOutput[] {
  const outputs: IdeaGeneratorOutput[] = [];

  if (input.canonical_ingredients.length === 0) {
    return outputs;
  }

  for (const ingredient of input.canonical_ingredients) {
    const mutations: MutationResult[] = [];
    const selectedIds = [ingredient.id];

    for (const vector of input.mutation_vectors) {
      const result: MutationResult = {
        vector_id: vector.id,
        transformation: `${vector.dimension}: ${vector.from} → ${vector.to}`,
        is_cosmetic: !vector.structural,
      };
      mutations.push(result);
    }

    if (mutations.length === 0) {
      continue;
    }

    const transformationText = mutations.map((m) => m.transformation).join(", ");
    const title = `Recombination: ${ingredient.title}`;
    const description = `Structural recombination of ${ingredient.key} with mutations: ${transformationText}`;

    outputs.push({
      title,
      description,
      selected_ingredient_ids: selectedIds,
      applied_mutations: mutations,
      base_scores: {
        novelty: 0.5,
        fit: 0.6,
        leverage: 0.4,
        cost: 0.3,
      },
    });
  }

  return outputs;
}

export class NullGenerator implements IdeaGenerator {
  async generate(input: IdeaGeneratorInput): Promise<IdeaGeneratorOutput[]> {
    return deterministicGenerate(input);
  }
}

export class FailingGenerator implements IdeaGenerator {
  async generate(): Promise<IdeaGeneratorOutput[]> {
    throw new Error("Provider unavailable");
  }
}
