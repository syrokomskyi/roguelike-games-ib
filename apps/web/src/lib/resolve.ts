import {
  resolveRecord,
  resolveRecordById,
  resolveRecordByKey,
  resolveRecordByAlias,
  type ProjectionStore,
} from "@roguelike-games-ib/projection-sdk";
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
  const byId = resolveRecordById(store, identifier);
  if (byId) {
    return { record: byId, resolvedFrom: "id", currentKey: byId.key };
  }

  const byKey = resolveRecordByKey(store, identifier);
  if (byKey) {
    return { record: byKey, resolvedFrom: "key", currentKey: byKey.key };
  }

  const byAlias = resolveRecordByAlias(store, identifier);
  if (byAlias) {
    return { record: byAlias, resolvedFrom: "alias", currentKey: byAlias.key };
  }

  return undefined;
}
