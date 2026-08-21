import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { setupWebWorkspace, testId, type TestSetup } from "./helpers";
import { authorityBadge, isNonAuthoritative } from "@roguelike-games-ib/web";

describe("WEB-005: Laboratory content has non-authoritative badge", () => {
  let setup: TestSetup;

  beforeEach(async () => {
    setup = await setupWebWorkspace({
      kbId: "web005-test",
      records: [
        { id: testId(1), key: "goblin", record_type: "creature", title: "Goblin" },
      ],
      keys: [{ id: testId(1), key: "goblin", record_type: "creature" }],
      bindings: [{ source_id: "src-a", source_unit_path: "src-a", declared_version: "1.0.0", version_scheme: "semver", metadata_origin: "package.json", fingerprint: { algorithm: "sha256-tree-v1", value: "abc123" }, vcs: null, binding_digest: "abc123" }],
    });
  });

  afterEach(() => setup.cleanup());

  it("canonical authority badge is not non-authoritative", () => {
    const badge = authorityBadge("canonical");
    expect(badge.authority).toBe("canonical");
    expect(badge.nonAuthoritative).toBe(false);
    expect(badge.label).toBe("Canonical");
  });

  it("laboratory authority badge is non-authoritative", () => {
    const badge = authorityBadge("laboratory");
    expect(badge.authority).toBe("laboratory");
    expect(badge.nonAuthoritative).toBe(true);
    expect(badge.label).toBe("Laboratory");
  });

  it("isNonAuthoritative returns true for laboratory", () => {
    expect(isNonAuthoritative("laboratory")).toBe(true);
  });

  it("isNonAuthoritative returns false for canonical", () => {
    expect(isNonAuthoritative("canonical")).toBe(false);
  });

  it("canonical and laboratory badges have different class names", () => {
    const canonical = authorityBadge("canonical");
    const laboratory = authorityBadge("laboratory");
    expect(canonical.className).not.toBe(laboratory.className);
  });
});
