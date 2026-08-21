/*
<MODULE_CONTRACT>
<purpose>Computes SHA-256 checksums for output files to verify materialization integrity.</purpose>
<non-goals>
  <item>Does not verify checksums against expected values — computation only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: fileSha256 and computeChecksums functions.</item>
</CHANGE_SUMMARY>
*/
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

/**
 * Compute SHA-256 of a file's raw bytes.
 */
export function fileSha256(filePath: string): string {
  const buf = readFileSync(filePath);
  return createHash("sha256").update(buf).digest("hex");
}

/**
 * Compute a checksum map for all output files.
 */
export function computeChecksums(files: string[]): Record<string, string> {
  const checksums: Record<string, string> = {};
  for (const file of files) {
    const name = file.split("/").pop() ?? file;
    checksums[name] = fileSha256(file);
  }
  return checksums;
}
