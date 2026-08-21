import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readSourceMetadata } from "@roguelike-games-ib/knowledge-core";
import { createSourceBundle, createTempWorkspace, cleanupTempWorkspace } from "@roguelike-games-ib/test-fixtures";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

describe("CORE-004: README source metadata parses", () => {
  let workspace: string;

  beforeEach(() => {
    workspace = createTempWorkspace();
  });

  afterEach(() => {
    cleanupTempWorkspace(workspace);
  });

  it("parses README.md frontmatter for version and VCS info", () => {
    const sourceDir = createSourceBundle(workspace, "test-source", { version: "2.1.0" });
    const metadata = readSourceMetadata(sourceDir);
    expect(metadata.declared_version).toBe("2.1.0");
    expect(metadata.metadata_origin).toBe("readme");
    expect(metadata.vcs?.repository).toBe("https://example.invalid/test-source.git");
  });
});

describe("CORE-005: package.json source metadata parses", () => {
  let workspace: string;

  beforeEach(() => {
    workspace = createTempWorkspace();
  });

  afterEach(() => {
    cleanupTempWorkspace(workspace);
  });

  it("parses package.json for version", () => {
    const sourceDir = createSourceBundle(workspace, "test-source", { version: "1.5.0" });
    // Add package.json
    writeFileSync(
      join(sourceDir, "package.json"),
      JSON.stringify({ name: "test-source", version: "1.5.0" }),
      "utf-8",
    );
    const metadata = readSourceMetadata(sourceDir);
    expect(metadata.declared_version).toBe("1.5.0");
    expect(metadata.metadata_origin).toBe("both");
  });
});

describe("CORE-006: dual metadata mismatch is ERROR", () => {
  let workspace: string;

  beforeEach(() => {
    workspace = createTempWorkspace();
  });

  afterEach(() => {
    cleanupTempWorkspace(workspace);
  });

  it("throws on version mismatch between README and package.json", () => {
    const sourceDir = createSourceBundle(workspace, "test-source", { version: "1.0.0" });
    writeFileSync(
      join(sourceDir, "package.json"),
      JSON.stringify({ name: "test-source", version: "2.0.0" }),
      "utf-8",
    );
    expect(() => readSourceMetadata(sourceDir)).toThrow(/Version mismatch/);
  });
});
