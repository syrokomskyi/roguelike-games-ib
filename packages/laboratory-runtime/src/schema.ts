/*
<MODULE_CONTRACT>
<purpose>Defines laboratory seed schema types, record ID generation, and seed record validation against authority and ancestry rules.</purpose>
<non-goals>
  <item>Does not create or persist seeds — schema and validation only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: SeedRecord, SeedScore, GeneratorMetadata types, createLaboratoryRecordId, validateSeedRecord, UUIDv7 generator.</item>
</CHANGE_SUMMARY>
*/
import { randomUUID } from "node:crypto";

export const LABORATORY_AUTHORITY = "laboratory" as const;
export type Authority = typeof LABORATORY_AUTHORITY;

export const LABORATORY_SCHEMA = "rgkb/laboratory-seed@1";

export type SystemScale = "tile" | "room" | "region" | "world" | "meta";
export type InformationVisibility = "full" | "partial" | "fog" | "hidden" | "asymmetric";
export type NoveltyTarget = "incremental" | "recombinatorial" | "structural" | "paradigmatic";

export interface GeneratorMetadata {
  provider: string | null;
  model: string | null;
  template_version: string | null;
  prompt_version: string | null;
  generated_at: string | null;
}

export interface SeedScore {
  novelty: number;
  fit: number;
  leverage: number;
  cost: number;
  anti_copy_penalty: number;
  final_score: number;
}

export interface SeedRecord {
  id: string;
  key: string;
  schema: string;
  authority: Authority;
  title: string;
  description: string;
  ancestry: {
    canonical_input_ids: string[];
    mutation_vector_ids: string[];
    transformations: string[];
    constraints_satisfied: string[];
    constraints_violated: string[];
  };
  scores: SeedScore;
  generator: GeneratorMetadata;
  session_id: string;
  created_at: string;
}

export function createLaboratoryRecordId(): string {
  const uuid = generateUuidV7();
  return `urn:roguelike-games-ib:lab:${uuid}`;
}

export function isLaboratoryRecordId(id: string): boolean {
  return /^urn:roguelike-games-ib:lab:[0-9a-fA-F-]{36}$/.test(id);
}

export function isCanonicalRecordId(id: string): boolean {
  return /^urn:roguelike-games-ib:record:[0-9a-fA-F-]{36}$/.test(id);
}

export interface SeedValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateSeedRecord(seed: SeedRecord): SeedValidationResult {
  const errors: string[] = [];

  if (seed.authority !== LABORATORY_AUTHORITY) {
    errors.push(`Seed ${seed.id}: authority must be '${LABORATORY_AUTHORITY}', got '${seed.authority}'`);
  }

  if (!isLaboratoryRecordId(seed.id)) {
    errors.push(`Seed ${seed.id}: id must follow laboratory URN pattern (urn:roguelike-games-ib:lab:<uuid>)`);
  }

  if (seed.schema !== LABORATORY_SCHEMA) {
    errors.push(`Seed ${seed.id}: schema must be '${LABORATORY_SCHEMA}', got '${seed.schema}'`);
  }

  for (const ref of seed.ancestry.canonical_input_ids) {
    if (!isCanonicalRecordId(ref)) {
      errors.push(`Seed ${seed.id}: ancestry canonical_input_id '${ref}' is not a valid canonical record id`);
    }
    if (isLaboratoryRecordId(ref)) {
      errors.push(`Seed ${seed.id}: ancestry canonical_input_id '${ref}' is a laboratory id, not canonical`);
    }
  }

  for (const ref of seed.ancestry.canonical_input_ids) {
    if (ref === seed.id) {
      errors.push(`Seed ${seed.id}: cannot reference itself in ancestry`);
    }
  }

  return { valid: errors.length === 0, errors };
}

function generateUuidV7(): string {
  const timestamp = Date.now();
  const timestampBytes = new Uint8Array(6);
  const tsHigh = Math.floor(timestamp / 0x100000000);
  const tsLow = timestamp & 0xffffffff;
  timestampBytes[0] = (tsHigh >> 8) & 0xff;
  timestampBytes[1] = tsHigh & 0xff;
  timestampBytes[2] = (tsLow >> 24) & 0xff;
  timestampBytes[3] = (tsLow >> 16) & 0xff;
  timestampBytes[4] = (tsLow >> 8) & 0xff;
  timestampBytes[5] = tsLow & 0xff;
  const version = 0x7;
  const randomBytes = new Uint8Array(10);
  crypto.getRandomValues(randomBytes);
  const hex = [
    ...Array.from(timestampBytes),
    (version << 4) | (randomBytes[0] & 0x0f),
    randomBytes[1],
    0x80 | (randomBytes[2] & 0x3f),
    randomBytes[3],
    ...Array.from(randomBytes.slice(4, 10)),
  ]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
