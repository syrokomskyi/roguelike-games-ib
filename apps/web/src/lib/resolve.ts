/*
<MODULE_CONTRACT>
<purpose>Resolves canonical record routes by ID, key, or alias with fallback resolution order for the web application URL routing.</purpose>
<non-goals>
  <item>Does not render pages — record resolution and route mapping only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: ResolvedRecord type, resolveRecordRoute with id/key/alias fallback.</item>
</CHANGE_SUMMARY>
*/
import type { ProjectionStore } from "@roguelike-games-ib/projection-sdk";
import type { CanonicalRecord } from "@roguelike-games-ib/materializer";

export interface ResolvedRecord {
  record: CanonicalRecord;
  resolvedFrom: "id" | "key" | "alias";
  currentKey: string;
}

export function resolveRecordRoute(
  store: ProjectionStore,
  identifier: string,
): ResolvedRecord | undefined {
  const byId = store.resolveRecordById(identifier);
  if (byId) {
    return { record: byId, resolvedFrom: "id", currentKey: byId.key };
  }

  const byKey = store.resolveRecordByKey(identifier);
  if (byKey) {
    return { record: byKey, resolvedFrom: "key", currentKey: byKey.key };
  }

  const byAlias = store.resolveRecordByAlias(identifier);
  if (byAlias) {
    return { record: byAlias, resolvedFrom: "alias", currentKey: byAlias.key };
  }

  return undefined;
}
