export interface CandidateRecord {
  id: string;
  key: string;
  record_type: string;
  [key: string]: unknown;
}

export interface CandidateBatch {
  source_id: string;
  run_id: string;
  extractor_id: string;
  extractor_version: string;
  records: CandidateRecord[];
  created_at: string;
}

/**
 * Create a candidate batch for staging.
 */
export function createCandidateBatch(
  sourceId: string,
  runId: string,
  extractorId: string,
  extractorVersion: string,
  records: CandidateRecord[],
): CandidateBatch {
  return {
    source_id: sourceId,
    run_id: runId,
    extractor_id: extractorId,
    extractor_version: extractorVersion,
    records,
    created_at: new Date().toISOString(),
  };
}
