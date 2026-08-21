/*
<MODULE_CONTRACT>
<purpose>Barrel export for laboratory-runtime — schema, boundary, constraints, mutation, ancestry, seeds, sessions, and generator modules.</purpose>
<non-goals>
  <item>Does not implement business logic — re-exports from submodules.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: laboratory-runtime barrel exporting all public types and functions.</item>
</CHANGE_SUMMARY>
*/
// Schema
export {
  LABORATORY_AUTHORITY,
  LABORATORY_SCHEMA,
  createLaboratoryRecordId,
  isLaboratoryRecordId,
  isCanonicalRecordId,
  validateSeedRecord,
} from "./schema.ts";
export type {
  Authority,
  SeedRecord,
  SeedScore,
  GeneratorMetadata,
  SystemScale,
  InformationVisibility,
  NoveltyTarget,
  SeedValidationResult,
} from "./schema.ts";

// Boundary
export {
  assertNoLabRefInCanonical,
  assertNoCanonicalMutation,
  assertCanonicalIdsOnly,
  assertNoSeedSelfReference,
} from "./boundary.ts";
export type { BoundaryCheckResult } from "./boundary.ts";

// Constraints
export {
  defaultConstraints,
  normalizeConstraints,
  checkConstraints,
} from "./constraints.ts";
export type { DesignConstraints, ConstraintCheckResult } from "./constraints.ts";

// Mutation
export {
  MUTATION_DIMENSIONS,
  createMutationVector,
  createCosmeticMutationVector,
  applyMutation,
  isCosmeticMutation,
  countCosmeticMutations,
  countStructuralMutations,
} from "./mutation.ts";
export type { MutationVector, MutationResult, MutationDimension } from "./mutation.ts";

// Ancestry
export {
  createAncestry,
  validateAncestry,
  explainAncestry,
} from "./ancestry.ts";
export type { AncestryRecord, AncestryValidationResult, AncestryExplanation } from "./ancestry.ts";

// Seeds
export {
  createSeed,
  persistSeed,
  readSeeds,
  computeAntiCopyPenalty,
  computeScores,
  rankSeeds,
  promoteSeed,
  evaluateSeed,
} from "./seeds.ts";
export type { PromotionResult } from "./seeds.ts";

// Sessions
export {
  createSession,
  persistSession,
  readSession,
  addSeedToSession,
} from "./sessions.ts";
export type { InspirationSession } from "./sessions.ts";

// Generator
export {
  runInspirationPipeline,
  NullGenerator,
  FailingGenerator,
} from "./generator.ts";
export type {
  IdeaGenerator,
  IdeaGeneratorInput,
  IdeaGeneratorOutput,
  InspirationPipelineOptions,
  InspirationPipelineResult,
  CanonicalIngredient,
} from "./generator.ts";
