export interface ReleaseEvidence {
  schema: string;
  datasetId: string;
  datasetVersion: string;
  modelVersion: string;
  canonicalHash: string;
  materializationHash: string;
  logicalDumpHash: string;
  bindingDigests: Record<string, string>;
  recordCount: number;
  sourceCount: number;
  license: string;
  acceptedRfcs: string[];
  acceptedAdrs: string[];
  status: "pass" | "fail";
  blockers: string[];
  generatedAt: string;
}

export interface DatasetManifest {
  title: string;
  id: string;
  version: string;
  license: string;
  licenseUrl: string;
  attribution: string;
  canonicalHash: string;
  modelVersion: string;
}

export interface ReleaseCheckResult {
  passed: boolean;
  blockers: string[];
  warnings: string[];
}

export interface ReleaseBundleResult {
  releaseDir: string;
  evidence: ReleaseEvidence;
  manifest: DatasetManifest;
  checksums: Record<string, string>;
  files: string[];
}

export interface ReleaseOptions {
  workspaceRoot: string;
  distDir?: string;
  datasetVersion?: string;
  acceptedRfcs?: string[];
  acceptedAdrs?: string[];
}
