import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { canonicalJsonStringify, canonicalJsonParse } from "@roguelike-games-ib/knowledge-core";
import {
  createLaboratoryRecordId,
  validateSeedRecord,
  LABORATORY_SCHEMA,
  LABORATORY_AUTHORITY,
  type SeedRecord,
  type SeedScore,
  type GeneratorMetadata,
} from "./schema.ts";
import type { AncestryRecord } from "./ancestry.ts";
import type { MutationResult } from "./mutation.ts";
import { countCosmeticMutations, countStructuralMutations } from "./mutation.ts";
import type { DesignConstraints, ConstraintCheckResult } from "./constraints.ts";
import { checkConstraints } from "./constraints.ts";
import { createCandidateBatch, type CandidateRecord } from "@roguelike-games-ib/knowledge-core";

export function createSeed(
  key: string,
  title: string,
  description: string,
  ancestry: AncestryRecord,
  scores: SeedScore,
  generator: GeneratorMetadata,
  sessionId: string,
): SeedRecord {
  return {
    id: createLaboratoryRecordId(),
    key,
    schema: LABORATORY_SCHEMA,
    authority: LABORATORY_AUTHORITY,
    title,
    description,
    ancestry: {
      canonical_input_ids: ancestry.canonical_input_ids,
      mutation_vector_ids: ancestry.mutation_vector_ids,
      transformations: ancestry.transformations,
      constraints_satisfied: ancestry.constraints_satisfied,
      constraints_violated: ancestry.constraints_violated,
    },
    scores,
    generator,
    session_id: sessionId,
    created_at: new Date().toISOString(),
  };
}

export function persistSeed(seed: SeedRecord, laboratoryRoot: string): void {
  const seedsDir = join(laboratoryRoot, "seeds");
  if (!existsSync(seedsDir)) {
    mkdirSync(seedsDir, { recursive: true });
  }
  const filePath = join(seedsDir, `${seed.id.replace(/urn:roguelike-games-ib:lab:/, "")}.json`);
  writeFileSync(filePath, canonicalJsonStringify(seed), "utf-8");
}

export function readSeeds(laboratoryRoot: string): SeedRecord[] {
  const seedsDir = join(laboratoryRoot, "seeds");
  if (!existsSync(seedsDir)) {
    return [];
  }
  const files = readdirSync(seedsDir).filter((f) => f.endsWith(".json"));
  const seeds: SeedRecord[] = [];
  for (const file of files) {
    const raw = readFileSync(join(seedsDir, file), "utf-8");
    seeds.push(canonicalJsonParse(raw) as SeedRecord);
  }
  return seeds;
}

export function computeAntiCopyPenalty(
  mutationResults: MutationResult[],
  canonicalInputCount: number,
): number {
  const cosmeticCount = countCosmeticMutations(mutationResults);
  const structuralCount = countStructuralMutations(mutationResults);
  const totalMutations = cosmeticCount + structuralCount;

  if (totalMutations === 0) {
    return 0;
  }

  const cosmeticRatio = cosmeticCount / totalMutations;

  if (canonicalInputCount <= 1 && cosmeticRatio > 0.5) {
    return 0.5;
  }

  if (cosmeticRatio > 0.7) {
    return 0.3;
  }

  return 0;
}

export function computeScores(
  novelty: number,
  fit: number,
  leverage: number,
  cost: number,
  antiCopyPenalty: number,
): SeedScore {
  const finalScore = Math.max(0, (novelty + fit + leverage - cost) * (1 - antiCopyPenalty));
  return {
    novelty,
    fit,
    leverage,
    cost,
    anti_copy_penalty: antiCopyPenalty,
    final_score: finalScore,
  };
}

export function rankSeeds(seeds: SeedRecord[]): SeedRecord[] {
  return [...seeds].sort((a, b) => {
    const scoreDiff = b.scores.final_score - a.scores.final_score;
    if (scoreDiff !== 0) return scoreDiff;
    return a.key.localeCompare(b.key);
  });
}

export interface PromotionResult {
  candidate_batch: ReturnType<typeof createCandidateBatch>;
  seed_id: string;
  promoted: boolean;
  error: string | null;
}

export function promoteSeed(
  seed: SeedRecord,
  sourceId: string,
  runId: string,
  extractorId: string,
  extractorVersion: string,
  canonicalRecordType: string,
): PromotionResult {
  const validation = validateSeedRecord(seed);
  if (!validation.valid) {
    return {
      candidate_batch: createCandidateBatch(sourceId, runId, extractorId, extractorVersion, []),
      seed_id: seed.id,
      promoted: false,
      error: `Seed validation failed: ${validation.errors.join("; ")}`,
    };
  }

  const candidateRecord: CandidateRecord = {
    id: seed.id,
    key: seed.key,
    record_type: canonicalRecordType,
    title: seed.title,
    description: seed.description,
    promoted_from_seed: seed.id,
    ancestry: seed.ancestry,
  };

  const batch = createCandidateBatch(
    sourceId,
    runId,
    extractorId,
    extractorVersion,
    [candidateRecord],
  );

  return {
    candidate_batch: batch,
    seed_id: seed.id,
    promoted: true,
    error: null,
  };
}

export function evaluateSeed(
  seed: { title: string; description: string; ancestry: { transformations: string[] } },
  constraints: DesignConstraints,
  mutationResults: MutationResult[],
  canonicalInputCount: number,
  baseScores: { novelty: number; fit: number; leverage: number; cost: number },
): { scores: SeedScore; constraintCheck: ConstraintCheckResult } {
  const constraintCheck = checkConstraints(seed, constraints);
  const antiCopyPenalty = computeAntiCopyPenalty(mutationResults, canonicalInputCount);
  const scores = computeScores(
    baseScores.novelty,
    baseScores.fit,
    baseScores.leverage,
    baseScores.cost,
    antiCopyPenalty,
  );
  return { scores, constraintCheck };
}
