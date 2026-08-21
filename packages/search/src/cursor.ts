import { sha256 } from "@roguelike-games-ib/knowledge-core";

/**
 * A search cursor encodes the canonical hash and offset for pagination.
 * Format: base64(JSON({ h: canonicalHash, o: offset }))
 * The canonical hash is checked on every request to reject stale cursors.
 */

interface CursorPayload {
  h: string;
  o: number;
}

/**
 * Encode a cursor from canonical hash and offset.
 */
export function encodeCursor(canonicalHash: string, offset: number): string {
  const payload: CursorPayload = { h: canonicalHash, o: offset };
  return Buffer.from(JSON.stringify(payload), "utf-8").toString("base64url");
}

/**
 * Decode and validate a cursor against the current canonical hash.
 * Returns { valid, offset } — if the hash doesn't match, valid is false.
 */
export function validateCursor(
  cursor: string,
  expectedCanonicalHash: string,
): { valid: boolean; offset: number } {
  try {
    const json = Buffer.from(cursor, "base64url").toString("utf-8");
    const payload = JSON.parse(json) as CursorPayload;

    if (payload.h !== expectedCanonicalHash) {
      return { valid: false, offset: 0 };
    }

    if (typeof payload.o !== "number" || payload.o < 0) {
      return { valid: false, offset: 0 };
    }

    return { valid: true, offset: payload.o };
  } catch {
    return { valid: false, offset: 0 };
  }
}

/**
 * Create a cursor for the first page (offset 0).
 */
export function createCursor(canonicalHash: string): string {
  return encodeCursor(canonicalHash, 0);
}

/**
 * Compute a canonical hash fingerprint for cursor validation.
 * This is the same as the materializer's canonical hash.
 */
export function computeCursorHash(data: string): string {
  return sha256(data);
}
