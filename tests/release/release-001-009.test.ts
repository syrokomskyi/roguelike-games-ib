import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync, existsSync, writeFileSync, mkdirSync, rmSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import {
  checkRelease,
  generateReleaseEvidence,
  createDatasetManifest,
  buildRelease,
} from "@roguelike-games-ib/release-builder";
import { setupReleaseWorkspace, testId } from "./helpers";

describe("REL-001: dataset manifest license is CC-BY-4.0", () => {
  let setup: ReturnType<typeof setupReleaseWorkspace>;

  beforeEach(() => {
    setup = setupReleaseWorkspace({
      kbId: "rel001-test",
      records: [
        {
          id: testId(1),
          key: "goblin",
          record_type: "creature",
          name: "Goblin",
          source_identity: { source_id: "test-src", native_id: "goblin", path: "data.json" },
        },
      ],
      keys: [{ id: testId(1), key: "goblin", record_type: "creature" }],
    });
  });

  afterEach(() => setup.cleanup());

  it("dataset manifest has license CC-BY-4.0", () => {
    const evidence = generateReleaseEvidence(setup.workspace);
    const manifest = createDatasetManifest(setup.workspace, evidence.canonicalHash);
    expect(manifest.license).toBe("CC-BY-4.0");
  });

  it("dataset manifest has license URL", () => {
    const evidence = generateReleaseEvidence(setup.workspace);
    const manifest = createDatasetManifest(setup.workspace, evidence.canonicalHash);
    expect(manifest.licenseUrl).toBe("https://creativecommons.org/licenses/by/4.0/");
  });

  it("release evidence has license CC-BY-4.0", () => {
    const evidence = generateReleaseEvidence(setup.workspace);
    expect(evidence.license).toBe("CC-BY-4.0");
  });
});

describe("REL-002: NOTICE attribution metadata generated", () => {
  let setup: ReturnType<typeof setupReleaseWorkspace>;

  beforeEach(() => {
    setup = setupReleaseWorkspace({
      kbId: "rel002-test",
      records: [
        {
          id: testId(1),
          key: "goblin",
          record_type: "creature",
          name: "Goblin",
          source_identity: { source_id: "test-src", native_id: "goblin", path: "data.json" },
        },
      ],
      keys: [{ id: testId(1), key: "goblin", record_type: "creature" }],
    });
  });

  afterEach(() => setup.cleanup());

  it("NOTICE.dataset.md exists in workspace", () => {
    expect(existsSync(join(setup.workspace, "NOTICE.dataset.md"))).toBe(true);
  });

  it("dataset manifest contains attribution string", () => {
    const evidence = generateReleaseEvidence(setup.workspace);
    const manifest = createDatasetManifest(setup.workspace, evidence.canonicalHash);
    expect(manifest.attribution).toBeTruthy();
    expect(manifest.attribution.length).toBeGreaterThan(0);
  });

  it("dataset manifest contains title", () => {
    const evidence = generateReleaseEvidence(setup.workspace);
    const manifest = createDatasetManifest(setup.workspace, evidence.canonicalHash);
    expect(manifest.title).toBeTruthy();
    expect(manifest.title.length).toBeGreaterThan(0);
  });
});

describe("REL-003: source payload absent from dataset release", () => {
  let setup: ReturnType<typeof setupReleaseWorkspace>;

  beforeEach(() => {
    setup = setupReleaseWorkspace({
      kbId: "rel003-test",
      records: [
        {
          id: testId(1),
          key: "goblin",
          record_type: "creature",
          name: "Goblin",
          source_identity: { source_id: "test-src", native_id: "goblin", path: "data.json" },
        },
      ],
      keys: [{ id: testId(1), key: "goblin", record_type: "creature" }],
    });
  });

  afterEach(() => setup.cleanup());

  it("canonical root does not contain source payload directories", () => {
    const entries = readdirSync(setup.canonicalRoot, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        expect(entry.name).not.toContain("-source");
        expect(entry.name).not.toBe("source");
      }
    }
  });

  it("release evidence does not include source payload paths", () => {
    const evidence = generateReleaseEvidence(setup.workspace);
    const evidenceJson = JSON.stringify(evidence);
    expect(evidenceJson).not.toContain("source_payload");
    expect(evidenceJson).not.toContain("-source/");
  });
});

describe("REL-004: source drift blocks release", () => {
  let setup: ReturnType<typeof setupReleaseWorkspace>;

  beforeEach(() => {
    setup = setupReleaseWorkspace({
      kbId: "rel004-test",
      records: [
        {
          id: testId(1),
          key: "goblin",
          record_type: "creature",
          name: "Goblin",
          source_identity: { source_id: "test-src", native_id: "goblin", path: "data.json" },
        },
      ],
      keys: [{ id: testId(1), key: "goblin", record_type: "creature" }],
      bindings: [
        {
          source_id: "test-src",
          source_unit_path: ".",
          declared_version: "1.0.0",
        },
      ],
    });
  });

  afterEach(() => setup.cleanup());

  it("release check passes when source matches binding", () => {
    const result = checkRelease(setup.workspace);
    expect(result.passed).toBe(true);
    expect(result.blockers.some((b) => b.includes("drift"))).toBe(false);
  });

  it("release check fails when source file is modified after binding", () => {
    const sourcePayload = resolve(setup.workspace, "..", "rel004-test-source", "source");
    writeFileSync(join(sourcePayload, "modified.txt"), "modified content\n", "utf-8");

    const result = checkRelease(setup.workspace);
    expect(result.blockers.some((b) => b.includes("drift"))).toBe(true);
  });
});

describe("REL-005: secret scan blocks release on credential fixture", () => {
  let setup: ReturnType<typeof setupReleaseWorkspace>;

  afterEach(() => {
    if (setup) setup.cleanup();
  });

  it("release check fails when secret pattern is in canonical data", () => {
    setup = setupReleaseWorkspace({
      kbId: "rel005-test",
      records: [
        {
          id: testId(1),
          key: "goblin",
          record_type: "creature",
          name: "Goblin",
          source_identity: { source_id: "test-src", native_id: "goblin", path: "data.json" },
        },
      ],
      keys: [{ id: testId(1), key: "goblin", record_type: "creature" }],
      extraFiles: [
        {
          path: "creature/secret.jsonl",
          content: JSON.stringify({
            id: testId(2),
            key: "secret-creature",
            record_type: "creature",
            name: "Secret",
            api_key: "sk-abcdefghijklmnopqrstuvwxyz1234567890",
          }) + "\n",
        },
      ],
      skipMaterialize: true,
    });

    const result = checkRelease(setup.workspace);
    expect(result.passed).toBe(false);
    expect(result.blockers.some((b) => b.includes("secret"))).toBe(true);
  });

  it("release check passes when no secrets present", () => {
    setup = setupReleaseWorkspace({
      kbId: "rel005b-test",
      records: [
        {
          id: testId(1),
          key: "goblin",
          record_type: "creature",
          name: "Goblin",
          source_identity: { source_id: "test-src", native_id: "goblin", path: "data.json" },
        },
      ],
      keys: [{ id: testId(1), key: "goblin", record_type: "creature" }],
    });

    const result = checkRelease(setup.workspace);
    expect(result.blockers.some((b) => b.includes("secret"))).toBe(false);
  });
});

describe("REL-006: stale projection blocks certified release", () => {
  let setup: ReturnType<typeof setupReleaseWorkspace>;

  beforeEach(() => {
    setup = setupReleaseWorkspace({
      kbId: "rel006-test",
      records: [
        {
          id: testId(1),
          key: "goblin",
          record_type: "creature",
          name: "Goblin",
          source_identity: { source_id: "test-src", native_id: "goblin", path: "data.json" },
        },
      ],
      keys: [{ id: testId(1), key: "goblin", record_type: "creature" }],
    });
  });

  afterEach(() => setup.cleanup());

  it("release check passes when materialization is current", () => {
    const result = checkRelease(setup.workspace);
    expect(result.blockers.some((b) => b.includes("Stale"))).toBe(false);
  });

  it("release check fails when canonical records changed after materialization", () => {
    const dir = join(setup.canonicalRoot, "creature");
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "new-monster.jsonl"),
      JSON.stringify({
        id: testId(10),
        key: "new-monster",
        record_type: "creature",
        name: "New Monster",
        source_identity: { source_id: "test-src", native_id: "new-monster", path: "data.json" },
      }) + "\n",
      "utf-8",
    );

    const result = checkRelease(setup.workspace);
    expect(result.passed).toBe(false);
    expect(result.blockers.some((b) => b.includes("Stale") || b.includes("mismatch"))).toBe(true);
  });

  it("release check fails when materialization manifest is missing", () => {
    const distDir = join(setup.workspace, ".generated", "knowledge", "dist");
    if (existsSync(distDir)) {
      rmSync(distDir, { recursive: true });
    }

    const result = checkRelease(setup.workspace);
    expect(result.passed).toBe(false);
    expect(result.blockers.some((b) => b.includes("manifest missing") || b.includes("Materialization"))).toBe(true);
  });
});

describe("REL-007: semantic incompleteness may release when accurately reported", () => {
  let setup: ReturnType<typeof setupReleaseWorkspace>;

  beforeEach(() => {
    setup = setupReleaseWorkspace({
      kbId: "rel007-test",
      records: [
        {
          id: testId(1),
          key: "goblin",
          record_type: "creature",
          name: "Goblin",
          source_identity: { source_id: "test-src", native_id: "goblin", path: "data.json" },
        },
      ],
      keys: [{ id: testId(1), key: "goblin", record_type: "creature" }],
    });
  });

  afterEach(() => setup.cleanup());

  it("release check does not block on incomplete semantic coverage", () => {
    const result = checkRelease(setup.workspace);
    const semanticBlockers = result.blockers.filter(
      (b: string) => b.includes("semantic") && b.includes("incomplete"),
    );
    expect(semanticBlockers.length).toBe(0);
  });

  it("release evidence can be generated even with partial coverage", () => {
    const evidence = generateReleaseEvidence(setup.workspace);
    expect(evidence.status).toBe("pass");
    expect(evidence.recordCount).toBeGreaterThan(0);
  });
});

describe("REL-008: release checksums verify", () => {
  let setup: ReturnType<typeof setupReleaseWorkspace>;

  beforeEach(() => {
    setup = setupReleaseWorkspace({
      kbId: "rel008-test",
      records: [
        {
          id: testId(1),
          key: "goblin",
          record_type: "creature",
          name: "Goblin",
          source_identity: { source_id: "test-src", native_id: "goblin", path: "data.json" },
        },
      ],
      keys: [{ id: testId(1), key: "goblin", record_type: "creature" }],
    });
  });

  afterEach(() => setup.cleanup());

  it("SHA256SUMS.txt entries match actual file hashes", () => {
    const result = buildRelease({ workspaceRoot: setup.workspace });
    const checksumsPath = join(result.releaseDir, "SHA256SUMS.txt");
    expect(existsSync(checksumsPath)).toBe(true);

    const checksumsText = readFileSync(checksumsPath, "utf-8");

    for (const line of checksumsText.split("\n").filter(Boolean)) {
      const [expectedHash, ...pathParts] = line.split(/\s+/);
      const filePath = join(result.releaseDir, pathParts.join(" "));
      const fileBuf = readFileSync(filePath);
      const actualHash = createHash("sha256").update(fileBuf).digest("hex");
      expect(actualHash).toBe(expectedHash);
    }
  });

  it("checksums cover all release files", () => {
    const result = buildRelease({ workspaceRoot: setup.workspace });
    const checksumsPath = join(result.releaseDir, "SHA256SUMS.txt");
    const checksumsText = readFileSync(checksumsPath, "utf-8");
    const checksummedFiles = new Set(
      checksumsText.split("\n").filter(Boolean).map((l) => l.split(/\s+/).slice(1).join(" ")),
    );

    for (const file of result.files) {
      const relPath = file.replace(result.releaseDir + "/", "");
      if (relPath !== "SHA256SUMS.txt") {
        expect(checksummedFiles.has(relPath)).toBe(true);
      }
    }
  });
});

describe("REL-009: release evidence captures accepted RFC/ADR refs", () => {
  let setup: ReturnType<typeof setupReleaseWorkspace>;

  beforeEach(() => {
    setup = setupReleaseWorkspace({
      kbId: "rel009-test",
      records: [
        {
          id: testId(1),
          key: "goblin",
          record_type: "creature",
          name: "Goblin",
          source_identity: { source_id: "test-src", native_id: "goblin", path: "data.json" },
        },
      ],
      keys: [{ id: testId(1), key: "goblin", record_type: "creature" }],
    });
  });

  afterEach(() => setup.cleanup());

  it("release evidence includes accepted RFCs", () => {
    const evidence = generateReleaseEvidence(
      setup.workspace,
      ["RFC-0001", "RFC-0002"],
      ["ADR-0001"],
    );
    expect(evidence.acceptedRfcs).toContain("RFC-0001");
    expect(evidence.acceptedRfcs).toContain("RFC-0002");
  });

  it("release evidence includes accepted ADRs", () => {
    const evidence = generateReleaseEvidence(
      setup.workspace,
      [],
      ["ADR-0001", "ADR-0002"],
    );
    expect(evidence.acceptedAdrs).toContain("ADR-0001");
    expect(evidence.acceptedAdrs).toContain("ADR-0002");
  });

  it("release evidence with no RFCs/ADRs has empty arrays", () => {
    const evidence = generateReleaseEvidence(setup.workspace);
    expect(evidence.acceptedRfcs).toEqual([]);
    expect(evidence.acceptedAdrs).toEqual([]);
  });

  it("buildRelease writes RELEASE-EVIDENCE.json with RFC/ADR refs", () => {
    const result = buildRelease({
      workspaceRoot: setup.workspace,
      acceptedRfcs: ["RFC-0001"],
      acceptedAdrs: ["ADR-0001"],
    });
    const evidencePath = join(result.releaseDir, "RELEASE-EVIDENCE.json");
    expect(existsSync(evidencePath)).toBe(true);
    const evidence = JSON.parse(readFileSync(evidencePath, "utf-8"));
    expect(evidence.acceptedRfcs).toContain("RFC-0001");
    expect(evidence.acceptedAdrs).toContain("ADR-0001");
  });
});
