/*
<MODULE_CONTRACT>
<purpose>Builds record envelopes with schema, scope, origin, epistemic, and aliases — shared by all extractors.</purpose>
<non-goals>
  <item>Does not populate kind, native_kind, attributes, or evidence — callers spread the envelope into their own record shape.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: createRecordEnvelope extracted from duplicated per-extractor implementations.</item>
</CHANGE_SUMMARY>
*/
export interface RecordEnvelope {
  schema: string;
  id: string;
  key: string;
  record_type: string;
  language: string;
  scope: { source_id: string; scope_kind: "source" };
  origin: { kind: "extractor"; actor_id: string; run_id: null };
  epistemic: { status: "observed"; confidence: "verified" };
  aliases: string[];
}

export function createRecordEnvelope(
  sourceId: string,
  key: string,
  id: string,
  originActorId: string,
  recordType: string = "definition",
): RecordEnvelope {
  return {
    schema: "rgkb/game-definition@2",
    id,
    key,
    record_type: recordType,
    language: "en",
    scope: { source_id: sourceId, scope_kind: "source" },
    origin: { kind: "extractor", actor_id: originActorId, run_id: null },
    epistemic: { status: "observed", confidence: "verified" },
    aliases: [],
  };
}
