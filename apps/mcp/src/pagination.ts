/*
<MODULE_CONTRACT>
<purpose>Encodes and decodes base64url list cursors with canonical-hash and filter-digest integrity checks for paginated MCP tool responses.</purpose>
<non-goals>
  <item>Does not implement search cursors — those use a separate format in the search package.</item>
  <item>Does not persist cursor state across server restarts.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: list cursor encoding/decoding with hash and filter digest validation, plus paginate helper.</item>
</CHANGE_SUMMARY>
*/
import { sha256 } from "@roguelike-games-ib/knowledge-core";
import { InvalidCursorError, StaleCursorError } from "./errors.ts";

interface ListCursorPayload {
  h: string;
  d: string;
  k: string | null;
  i: string | null;
  v: number;
}

const CURSOR_VERSION = 1;

function computeFilterDigest(filters: Record<string, unknown>): string {
  return sha256(JSON.stringify(filters));
}

export function encodeListCursor(
  canonicalHash: string,
  filters: Record<string, unknown>,
  lastKey: string | null,
  lastId: string | null,
): string {
  const payload: ListCursorPayload = {
    h: canonicalHash,
    d: computeFilterDigest(filters),
    k: lastKey,
    i: lastId,
    v: CURSOR_VERSION,
  };
  return Buffer.from(JSON.stringify(payload), "utf-8").toString("base64url");
}

export function decodeListCursor(
  cursor: string,
  canonicalHash: string,
  filters: Record<string, unknown>,
): { lastKey: string | null; lastId: string | null } {
  let payload: ListCursorPayload;
  try {
    const json = Buffer.from(cursor, "base64url").toString("utf-8");
    payload = JSON.parse(json) as ListCursorPayload;
  } catch {
    throw new InvalidCursorError("Cursor is not valid base64url JSON");
  }

  if (payload.v !== CURSOR_VERSION) {
    throw new InvalidCursorError(`Unsupported cursor version: ${payload.v}`);
  }

  if (payload.h !== canonicalHash) {
    throw new StaleCursorError();
  }

  const expectedDigest = computeFilterDigest(filters);
  if (payload.d !== expectedDigest) {
    throw new InvalidCursorError("Cursor filter digest mismatch");
  }

  return { lastKey: payload.k, lastId: payload.i };
}

export function paginate<T extends { key: string; id: string }>(
  items: T[],
  canonicalHash: string,
  filters: Record<string, unknown>,
  cursor: string | undefined,
  limit: number,
): { items: T[]; nextCursor: string | null } {
  const sorted = [...items].sort((a, b) => {
    if (a.key < b.key) return -1;
    if (a.key > b.key) return 1;
    if (a.id < b.id) return -1;
    if (a.id > b.id) return 1;
    return 0;
  });

  let startIdx = 0;
  if (cursor) {
    const { lastKey, lastId } = decodeListCursor(cursor, canonicalHash, filters);
    if (lastKey !== null && lastId !== null) {
      startIdx = sorted.findIndex((item) => item.key === lastKey && item.id === lastId);
      if (startIdx === -1) {
        throw new InvalidCursorError("Cursor position not found in current dataset");
      }
      startIdx += 1;
    }
  }

  const page = sorted.slice(startIdx, startIdx + limit);
  const hasMore = startIdx + limit < sorted.length;

  const nextCursor = hasMore && page.length > 0
    ? encodeListCursor(canonicalHash, filters, page[page.length - 1].key, page[page.length - 1].id)
    : null;

  return { items: page, nextCursor };
}
