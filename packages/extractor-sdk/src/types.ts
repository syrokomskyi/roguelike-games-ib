import type { SourceBinding } from "@roguelike-games-ib/knowledge-core";
import type { ReadonlySourceReader } from "./source-reader.ts";
import type { EvidenceFactory } from "./evidence-builder.ts";
import type { CandidateWriter } from "./output-writer.ts";
import type { PopulationContract } from "./population.ts";
import type { SchemaFacade } from "./context.ts";
import type { RefreshIdentityResolver } from "./identity.ts";

export interface ExtractorManifest {
  schema: "werkstatt/knowledge-extractor@1";
  extractorId: string;
  extractorVersion: string;
  sourceKinds: string[];
  recordKinds: string[];
  deterministic: true;
  parserMode: "static";
  exhaustivePopulations?: PopulationContract[];
}

export interface ExtractorContext {
  source: ReadonlySourceReader;
  binding: SourceBinding;
  schemas: SchemaFacade;
  evidence: EvidenceFactory;
  ids: RefreshIdentityResolver;
  output: CandidateWriter;
}

export interface ExtractorRunResult {
  extractorId: string;
  extractorVersion: string;
  runId: string;
  recordCount: number;
  populationCounts: Array<{ dimension: string; expected: number; extracted: number }>;
  diagnostics: ExtractorDiagnostic[];
}

export interface ExtractorDiagnostic {
  id: string;
  severity: "ERROR" | "WARN" | "INFO";
  message: string;
  record_key?: string;
}

export interface Extractor {
  manifest: ExtractorManifest;
  run(ctx: ExtractorContext): Promise<ExtractorRunResult>;
}

export interface StagedOutput {
  runId: string;
  sourceId: string;
  extractorId: string;
  extractorVersion: string;
  records: StagedRecord[];
  evidence: StagedEvidence[];
  population: StagedPopulation[];
  diagnostics: ExtractorDiagnostic[];
  outputDir: string;
}

export interface StagedRecord {
  id: string;
  key: string;
  record_type: string;
  source_identity?: {
    source_id: string;
    native_id: string;
    path: string;
  };
  [key: string]: unknown;
}

export interface StagedEvidence {
  record_id: string;
  anchor: unknown;
}

export interface StagedPopulation {
  dimension: string;
  expected: number;
  extracted: number;
}
