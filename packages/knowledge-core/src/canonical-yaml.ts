/*
<MODULE_CONTRACT>
<purpose>Canonical YAML serialization using YAML 1.2 with 2-space indent and core schema.</purpose>
<non-goals>
  <item>Does not support anchors, aliases, or merge keys in canonical data.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: canonical YAML stringify and parse with core schema.</item>
</CHANGE_SUMMARY>
*/
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

/**
 * Canonical YAML serialization per spec:
 * - YAML 1.2
 * - UTF-8
 * - LF
 * - 2-space indentation
 * - No anchors/aliases/merge keys in canonical data
 */

export function canonicalYamlStringify(value: unknown): string {
  return stringifyYaml(value, {
    indent: 2,
    lineWidth: 0,
    sortMapEntries: false,
  });
}

export function canonicalYamlParse(text: string): unknown {
  return parseYaml(text, {
    schema: "core",
    uniqueKeys: true,
  });
}
