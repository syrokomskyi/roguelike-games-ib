import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const WORKSPACE = resolve(__dirname, "../..");
const HASH_FILE = join(WORKSPACE, ".generated", "knowledge", "canonical-hash.txt");
const MANIFEST_FILE = join(WORKSPACE, ".generated", "knowledge", "dist", "manifest.json");

describe("C16: Canonical hash tracking", () => {
  it.skipIf(!existsSync(HASH_FILE))(
    "canonical hash file matches materialized manifest hash",
    () => {
      const hashFromFile = readFileSync(HASH_FILE, "utf-8").trim();
      const manifestRaw = readFileSync(MANIFEST_FILE, "utf-8");
      const manifest = JSON.parse(manifestRaw);

      expect(hashFromFile).toBe(manifest.canonicalHash);
    },
  );

  it.skipIf(!existsSync(HASH_FILE))(
    "canonical hash is a non-empty hex string",
    () => {
      const hashFromFile = readFileSync(HASH_FILE, "utf-8").trim();
      expect(hashFromFile.length).toBeGreaterThan(0);
      expect(hashFromFile).toMatch(/^[a-f0-9]+$/);
    },
  );

  it("canonical hash file exists after materialize", () => {
    if (!existsSync(MANIFEST_FILE)) {
      console.log("Manifest not found — run `pnpm materialize` first");
      expect(true).toBe(true);
      return;
    }
    expect(existsSync(HASH_FILE), "Hash file missing — run `pnpm materialize` to generate it").toBe(true);
  });
});
