import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { canonicalJsonStringify, canonicalJsonParse } from "@roguelike-games-ib/knowledge-core";
import type { DesignConstraints } from "./constraints.ts";
import type { SeedRecord } from "./schema.ts";

export interface InspirationSession {
  id: string;
  constraints: DesignConstraints;
  seed_ids: string[];
  created_at: string;
  updated_at: string;
}

export function createSession(id: string, constraints: DesignConstraints): InspirationSession {
  const now = new Date().toISOString();
  return {
    id,
    constraints,
    seed_ids: [],
    created_at: now,
    updated_at: now,
  };
}

export function persistSession(session: InspirationSession, laboratoryRoot: string): void {
  const sessionsDir = join(laboratoryRoot, "sessions");
  if (!existsSync(sessionsDir)) {
    mkdirSync(sessionsDir, { recursive: true });
  }
  const filePath = join(sessionsDir, `${session.id}.json`);
  writeFileSync(filePath, canonicalJsonStringify(session), "utf-8");
}

export function readSession(sessionId: string, laboratoryRoot: string): InspirationSession | null {
  const filePath = join(laboratoryRoot, "sessions", `${sessionId}.json`);
  if (!existsSync(filePath)) {
    return null;
  }
  const raw = readFileSync(filePath, "utf-8");
  return canonicalJsonParse(raw) as InspirationSession;
}

export function addSeedToSession(
  session: InspirationSession,
  seed: SeedRecord,
): InspirationSession {
  return {
    ...session,
    seed_ids: [...session.seed_ids, seed.id],
    updated_at: new Date().toISOString(),
  };
}
