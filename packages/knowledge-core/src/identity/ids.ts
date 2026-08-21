import { randomUUID } from "node:crypto";

/**
 * Create a new UUIDv7-based record ID.
 * Format: urn:roguelike-games-ib:record:<uuid-v7>
 *
 * UUIDv7 is time-ordered. Since Node.js randomUUID gives v4,
 * we implement a basic v7 generator.
 */
export function createRecordId(): string {
  const uuid = generateUuidV7();
  return `urn:roguelike-games-ib:record:${uuid}`;
}

/**
 * Validate a record ID format.
 */
export function isValidRecordId(id: string): boolean {
  return /^urn:roguelike-games-ib:record:[0-9a-fA-F-]{36}$/.test(id);
}

/**
 * Generate a UUIDv7 (time-ordered).
 * RFC 9562 compliant.
 */
function generateUuidV7(): string {
  const timestamp = Date.now();
  const timestampBytes = new Uint8Array(6);

  // Extract 48-bit timestamp (milliseconds since Unix epoch)
  const tsHigh = Math.floor(timestamp / 0x100000000); // upper 16 bits
  const tsLow = timestamp & 0xffffffff; // lower 32 bits

  timestampBytes[0] = (tsHigh >> 8) & 0xff;
  timestampBytes[1] = tsHigh & 0xff;
  timestampBytes[2] = (tsLow >> 24) & 0xff;
  timestampBytes[3] = (tsLow >> 16) & 0xff;
  timestampBytes[4] = (tsLow >> 8) & 0xff;
  timestampBytes[5] = tsLow & 0xff;

  // Version 7 nibble
  const version = 0x7;

  // Random bytes for the rest
  const randomBytes = new Uint8Array(10);
  crypto.getRandomValues(randomBytes);

  // Build the UUID string
  const hex = [
    // timestamp (6 bytes)
    ...Array.from(timestampBytes),
    // version + random (2 bytes: version nibble + 12 random bits)
    (version << 4) | (randomBytes[0] & 0x0f),
    randomBytes[1],
    // variant + random (2 bytes: variant 10xx + 12 random bits)
    0x80 | (randomBytes[2] & 0x3f),
    randomBytes[3],
    // remaining random (6 bytes)
    ...Array.from(randomBytes.slice(4, 10)),
  ]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Format as UUID: 8-4-4-4-12
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
