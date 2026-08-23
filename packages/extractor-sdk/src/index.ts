/*
<MODULE_CONTRACT>
<purpose>Barrel export for the extractor SDK — types, source reader, manifest validation, evidence factory, population, output writer, identity, context, and deterministic runner.</purpose>
<non-goals>
  <item>Does not implement extractors — provides the SDK for extractor authors.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: extractor SDK barrel exporting all public types and functions.</item>
</CHANGE_SUMMARY>
*/
// Types
export type {
  ExtractorManifest,
  ExtractorContext,
  ExtractorRunResult,
  ExtractorDiagnostic,
  Extractor,
  StagedOutput,
  StagedRecord,
  StagedEvidence,
  StagedPopulation,
} from "./types.ts";

// Source reader
export { ReadonlySourceReader } from "./source-reader.ts";
export type { SupplementalRoot } from "./source-reader.ts";

// Manifest
export { validateManifest } from "./manifest.ts";

// Evidence builder
export { EvidenceFactory } from "./evidence-builder.ts";
export type { EvidenceBuildOptions } from "./evidence-builder.ts";

// Population
export type { PopulationContract, PopulationCount } from "./population.ts";
export { resolvePopulationCounts, checkRecordLoss, PopulationCollector } from "./population.ts";

// Output writer
export { CandidateWriter } from "./output-writer.ts";
export type { StagedOutputData } from "./output-writer.ts";

// Identity
export { RefreshIdentityResolver } from "./identity.ts";

// Context
export { createSchemaFacade, createNullSchemaFacade } from "./context.ts";
export type { SchemaFacade } from "./context.ts";

// Runner
export { ExtractorRunner, createExtractorContext } from "./runner.ts";
export type { ExtractorRunnerOptions } from "./runner.ts";

// Deterministic
export {
  normalizeRunResult,
  hashRunResult,
  runExtractorDeterministic,
} from "./deterministic.ts";
export type { DeterministicRunResult } from "./deterministic.ts";

// Sprite extraction
export { extractTileSprite } from "./sprite.ts";
export type { TileCoords } from "./sprite.ts";

// Record envelope
export { createRecordEnvelope } from "./envelope.ts";
export type { RecordEnvelope } from "./envelope.ts";

// Entity pipeline
export { runEntityPipeline } from "./entity-pipeline.ts";
export type { EntitySpec, EntityAdapter, PopulationEntry } from "./entity-pipeline.ts";
