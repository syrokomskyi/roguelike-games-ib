/*
<MODULE_CONTRACT>
<purpose>Validates an extractor manifest against the werkstatt/knowledge-extractor@1 schema, enforcing required fields and static-parser determinism.</purpose>
<non-goals>
  <item>Does not validate extractor output — only the manifest declaration.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: validateManifest with schema, id, version, sourceKinds, recordKinds, deterministic, and parserMode checks.</item>
</CHANGE_SUMMARY>
*/
import type { ExtractorManifest } from "./types.ts";

export function validateManifest(manifest: unknown): ExtractorManifest {
  const m = manifest as Record<string, unknown>;

  if (m.schema !== "werkstatt/knowledge-extractor@1") {
    throw new Error(
      `Invalid extractor manifest schema: expected 'werkstatt/knowledge-extractor@1', got '${m.schema}'`,
    );
  }

  if (typeof m.extractorId !== "string" || !m.extractorId) {
    throw new Error("Extractor manifest missing extractorId");
  }

  if (typeof m.extractorVersion !== "string" || !m.extractorVersion) {
    throw new Error("Extractor manifest missing extractorVersion");
  }

  if (!Array.isArray(m.sourceKinds) || m.sourceKinds.length === 0) {
    throw new Error("Extractor manifest missing sourceKinds");
  }

  if (!Array.isArray(m.recordKinds) || m.recordKinds.length === 0) {
    throw new Error("Extractor manifest missing recordKinds");
  }

  if (m.deterministic !== true) {
    throw new Error("Extractor manifest must declare deterministic: true");
  }

  if (m.parserMode !== "static") {
    throw new Error("Extractor manifest must declare parserMode: 'static'");
  }

  return manifest as ExtractorManifest;
}
