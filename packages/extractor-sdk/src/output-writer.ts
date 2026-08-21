/*
<MODULE_CONTRACT>
<purpose>Accumulates staged records, evidence, population counts, and diagnostics during an extractor run, then flushes to JSONL files in a staging directory.</purpose>
<non-goals>
  <item>Does not validate staged records — schema validation is the extractor's responsibility.</item>
  <item>Does not support multiple flush calls — single-use writer.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: CandidateWriter with record, evidence, population, diagnostic accumulation and JSONL flush.</item>
</CHANGE_SUMMARY>
*/
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  canonicalJsonStringify,
  type CandidateRecord,
  type CandidateBatch,
} from "@roguelike-games-ib/knowledge-core";
import type { StagedRecord, StagedEvidence, StagedPopulation, ExtractorDiagnostic } from "./types.ts";

export interface StagedOutputData {
  records: StagedRecord[];
  evidence: StagedEvidence[];
  population: StagedPopulation[];
  diagnostics: ExtractorDiagnostic[];
}

export class CandidateWriter {
  private readonly records: StagedRecord[] = [];
  private readonly evidence: StagedEvidence[] = [];
  private readonly population: StagedPopulation[] = [];
  private readonly diagnostics: ExtractorDiagnostic[] = [];
  private readonly stagingDir: string;
  private readonly runId: string;
  private readonly sourceId: string;
  private readonly extractorId: string;
  private readonly extractorVersion: string;
  private written = false;

  constructor(
    stagingDir: string,
    runId: string,
    sourceId: string,
    extractorId: string,
    extractorVersion: string,
  ) {
    this.stagingDir = stagingDir;
    this.runId = runId;
    this.sourceId = sourceId;
    this.extractorId = extractorId;
    this.extractorVersion = extractorVersion;
  }

  writeRecord(record: StagedRecord): void {
    this.records.push(record);
  }

  writeEvidence(recordId: string, anchor: unknown): void {
    this.evidence.push({ record_id: recordId, anchor });
  }

  writePopulation(dimension: string, expected: number, extracted: number): void {
    this.population.push({ dimension, expected, extracted });
  }

  writeDiagnostic(diagnostic: ExtractorDiagnostic): void {
    this.diagnostics.push(diagnostic);
  }

  flush(): string {
    if (this.written) {
      throw new Error("CandidateWriter already flushed");
    }
    this.written = true;

    const outputDir = join(this.stagingDir, this.runId);
    mkdirSync(outputDir, { recursive: true });

    const batch: CandidateBatch = {
      source_id: this.sourceId,
      run_id: this.runId,
      extractor_id: this.extractorId,
      extractor_version: this.extractorVersion,
      records: this.records as CandidateRecord[],
      created_at: new Date().toISOString(),
    };

    writeFileSync(
      join(outputDir, "batch.jsonl"),
      this.records.map((r) => canonicalJsonStringify(r)).join("\n") +
        (this.records.length > 0 ? "\n" : ""),
      "utf-8",
    );

    writeFileSync(
      join(outputDir, "evidence.jsonl"),
      this.evidence.map((e) => canonicalJsonStringify(e)).join("\n") +
        (this.evidence.length > 0 ? "\n" : ""),
      "utf-8",
    );

    writeFileSync(
      join(outputDir, "population.jsonl"),
      this.population.map((p) => canonicalJsonStringify(p)).join("\n") +
        (this.population.length > 0 ? "\n" : ""),
      "utf-8",
    );

    writeFileSync(
      join(outputDir, "batch-manifest.json"),
      canonicalJsonStringify(batch) + "\n",
      "utf-8",
    );

    if (this.diagnostics.length > 0) {
      writeFileSync(
        join(outputDir, "diagnostics.jsonl"),
        this.diagnostics.map((d) => canonicalJsonStringify(d)).join("\n") + "\n",
        "utf-8",
      );
    }

    return outputDir;
  }

  getRecords(): readonly StagedRecord[] {
    return this.records;
  }

  getEvidence(): readonly StagedEvidence[] {
    return this.evidence;
  }

  getPopulation(): readonly StagedPopulation[] {
    return this.population;
  }

  getDiagnostics(): readonly ExtractorDiagnostic[] {
    return this.diagnostics;
  }
}
