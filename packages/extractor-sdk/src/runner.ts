/*
<MODULE_CONTRACT>
<purpose>Owns the full extractor run lifecycle — context assembly, single-run execution, and optional determinism verification.</purpose>
<non-goals>
  <item>Does not implement extractors — orchestrates extractor execution.</item>
  <item>Does not validate record content — delegates to the extractor and schema facade.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: ExtractorRunner with createContext, run, and runDeterministic methods.</item>
</CHANGE_SUMMARY>
*/
import type { Extractor, ExtractorContext, ExtractorRunResult } from "./types.ts";
import type { ReadonlySourceReader } from "./source-reader.ts";
import type { SourceBinding } from "@roguelike-games-ib/knowledge-core";
import type { SchemaFacade } from "./context.ts";
import type { EvidenceFactory } from "./evidence-builder.ts";
import type { CandidateWriter } from "./output-writer.ts";
import type { RefreshIdentityResolver } from "./identity.ts";
import { hashRunResult, type DeterministicRunResult } from "./deterministic.ts";

export function createExtractorContext(
  source: ReadonlySourceReader,
  binding: SourceBinding,
  schemas: SchemaFacade,
  evidence: EvidenceFactory,
  ids: RefreshIdentityResolver,
  output: CandidateWriter,
): ExtractorContext {
  return {
    source,
    binding,
    schemas,
    evidence,
    ids,
    output,
  };
}

export interface ExtractorRunnerOptions {
  source: ReadonlySourceReader;
  binding: SourceBinding;
  schemas: SchemaFacade;
  evidence: EvidenceFactory;
  ids: RefreshIdentityResolver;
  output: CandidateWriter;
}

export class ExtractorRunner {
  constructor(private readonly extractor: Extractor) {}

  createContext(opts: ExtractorRunnerOptions): ExtractorContext {
    return createExtractorContext(
      opts.source,
      opts.binding,
      opts.schemas,
      opts.evidence,
      opts.ids,
      opts.output,
    );
  }

  async run(ctx: ExtractorContext): Promise<ExtractorRunResult> {
    return this.extractor.run(ctx);
  }

  async runDeterministic(
    createOpts: () => ExtractorRunnerOptions,
  ): Promise<DeterministicRunResult> {
    const ctx1 = this.createContext(createOpts());
    const run1 = await this.extractor.run(ctx1);
    const hash1 = hashRunResult(run1);

    const ctx2 = this.createContext(createOpts());
    const run2 = await this.extractor.run(ctx2);
    const hash2 = hashRunResult(run2);

    return {
      run1,
      run2,
      hash1,
      hash2,
      deterministic: hash1 === hash2,
    };
  }
}
