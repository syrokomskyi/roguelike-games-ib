/*
<MODULE_CONTRACT>
<purpose>Computes SHA-256 hashes for strings, files, records, canonical trees, source fingerprints, binding digests, and text fragments.</purpose>
<non-goals>
  <item>Does not verify hash integrity — hashing functions only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: sha256, sha256File, computeRecordHash, computeCanonicalHash, computeSourceFingerprint, computeBindingDigest, computeFragmentHash.</item>
</CHANGE_SUMMARY>
*/
import { createHash } from "node:crypto";
import { readFileSync, statSync, readdirSync, realpathSync } from "node:fs";
import { join, relative, sep, posix } from "node:path";
import { canonicalJsonStringify } from "./canonical-json.ts";

/**
 * Compute SHA-256 hash of a string.
 */
export function sha256(data: string): string {
  return createHash("sha256").update(data, "utf-8").digest("hex");
}

/**
 * Compute SHA-256 hash of a file's raw bytes.
 */
export function sha256File(filePath: string): string {
  const buf = readFileSync(filePath);
  return createHash("sha256").update(buf).digest("hex");
}

/**
 * Compute the canonical hash of a record (rgkb-canonical-tree-sha256-v1 for a single object).
 * This is the hash of the canonical JSON representation.
 */
export function computeRecordHash(record: unknown): string {
  return sha256(canonicalJsonStringify(record));
}

/**
 * Compute the canonical tree hash (rgkb-canonical-tree-sha256-v1) for a set of records.
 * The tree hash is the SHA-256 of the concatenation of all record hashes,
 * sorted by key then id.
 */
export function computeCanonicalHash(records: unknown[]): string {
  const sorted = [...records].sort((a, b) => {
    const aKey = (a as Record<string, unknown>)?.key as string | undefined;
    const bKey = (b as Record<string, unknown>)?.key as string | undefined;
    const aId = (a as Record<string, unknown>)?.id as string | undefined;
    const bId = (b as Record<string, unknown>)?.id as string | undefined;

    const keyCmp = (aKey ?? "").localeCompare(bKey ?? "");
    if (keyCmp !== 0) return keyCmp;
    return (aId ?? "").localeCompare(bId ?? "");
  });

  const hashes = sorted.map((r) => computeRecordHash(r));
  return sha256(hashes.join("\n"));
}

/**
 * Compute the source fingerprint (sha256-tree-v1) for a directory.
 *
 * Algorithm:
 * 1. Walk the directory recursively
 * 2. For each regular file: entry = `F:<relative-posix-path>:<sha256-of-bytes>`
 * 3. For each symlink: entry = `S:<relative-posix-path>:<sha256-of-target-string>`
 *    - Symlinks are hashed but NOT followed if they escape the payload root
 * 4. Sort entries lexicographically
 * 5. Hash the concatenation of all entries
 *
 * Ignores: .git directories, node_modules
 */
export function computeSourceFingerprint(
  payloadPath: string,
  options?: { ignore?: string[] },
): string {
  const ignoreSet = new Set([".git", "node_modules", ...(options?.ignore ?? [])]);
  const entries: string[] = [];

  function walk(dir: string, relPrefix: string) {
    const items = readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      if (ignoreSet.has(item.name)) continue;

      const fullPath = join(dir, item.name);
      const relPath = relPrefix ? `${relPrefix}/${item.name}` : item.name;

      if (item.isSymbolicLink()) {
        const target = realpathSync(fullPath);
        const targetHash = sha256(target);
        entries.push(`S:${relPath}:${targetHash}`);
      } else if (item.isDirectory()) {
        walk(fullPath, relPath);
      } else if (item.isFile()) {
        const fileHash = sha256File(fullPath);
        entries.push(`F:${relPath}:${fileHash}`);
      }
    }
  }

  walk(payloadPath, "");
  entries.sort();

  return sha256(entries.join("\n"));
}

/**
 * Compute the binding digest from source fingerprint and metadata.
 * binding_digest = sha256(fingerprint + declared_version + source_id)
 */
export function computeBindingDigest(
  fingerprint: string,
  declaredVersion: string,
  sourceId: string,
): string {
  return sha256(`${fingerprint}\n${declaredVersion}\n${sourceId}`);
}

/**
 * Compute a text fragment hash for a line locator.
 * fragment_hash = sha256(text content of the located lines)
 */
export function computeFragmentHash(
  fileContent: string,
  lineStart: number,
  lineEnd: number,
): string {
  const lines = fileContent.split("\n");
  const start = Math.max(0, lineStart - 1);
  const end = Math.min(lines.length, lineEnd);
  const fragment = lines.slice(start, end).join("\n");
  return sha256(fragment);
}
