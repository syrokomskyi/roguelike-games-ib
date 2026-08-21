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
