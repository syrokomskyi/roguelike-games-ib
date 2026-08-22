/*
<MODULE_CONTRACT>
<purpose>Verifies that the materialized output is present and valid — checks manifest existence, schema compatibility, and records file before web build.</purpose>
<non-goals>
  <item>Does not materialize — verification of pre-materialized output only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: VerificationResult type, verifyMaterialization, assertMaterialization.</item>
</CHANGE_SUMMARY>
*/
import { existsSync } from "node:fs";
import { join } from "node:path";
import { openProjection } from "@roguelike-games-ib/projection-sdk";

export interface VerificationResult {
  ok: boolean;
  error?: string;
}

export function verifyMaterialization(distDir: string): VerificationResult {
  const manifestPath = join(distDir, "manifest.json");
  if (!existsSync(manifestPath)) {
    return {
      ok: false,
      error: `Materialization manifest not found at ${manifestPath}. Run materialize first.`,
    };
  }

  let store;
  try {
    store = openProjection(distDir);
  } catch (e) {
    return {
      ok: false,
      error: `Failed to read materialization manifest: ${(e as Error).message}`,
    };
  }

  const recordsPath = join(distDir, "records.jsonl");
  if (!existsSync(recordsPath)) {
    return {
      ok: false,
      error: `Materialized records not found at ${recordsPath}.`,
    };
  }

  return { ok: true };
}

export function assertMaterialization(distDir: string): void {
  const result = verifyMaterialization(distDir);
  if (!result.ok) {
    throw new Error(`Web build refused: ${result.error}`);
  }
}
