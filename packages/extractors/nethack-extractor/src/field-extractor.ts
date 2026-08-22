/*
<MODULE_CONTRACT>
<purpose>Field Extractor — declarative regex-based field extraction engine. Accepts a field map (array of specs) and a source text, returns extracted values with fallback defaults.</purpose>
<non-goals>
  <item>Does not handle positional or computed fields — callers handle complex extraction logic inline.</item>
  <item>Does not validate semantic correctness — returns raw extracted values with defaults.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: extracted from finalizeMonsterEntry and finalizeObjectEntry to replace regex chains with declarative field maps.</item>
</CHANGE_SUMMARY>
*/
export interface FieldSpec {
  name: string;
  regex: RegExp;
  group: number;
  transform?: (value: string) => string | number;
  default: string | number;
}

export function extractFields(
  fullText: string,
  specs: FieldSpec[],
): Record<string, string | number> {
  const result: Record<string, string | number> = {};
  for (const spec of specs) {
    const match = fullText.match(spec.regex);
    const raw = match?.[spec.group];
    result[spec.name] =
      raw != null
        ? spec.transform
          ? spec.transform(raw)
          : raw
        : spec.default;
  }
  return result;
}
