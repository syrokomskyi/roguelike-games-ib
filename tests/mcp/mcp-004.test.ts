import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { setupMcpWorkspace, testId, type TestSetup } from "./helpers";
import { listSources } from "@roguelike-games-ib/mcp";
import { StaleCursorError, InvalidCursorError } from "@roguelike-games-ib/mcp";

const bindings = Array.from({ length: 5 }, (_, i) => ({
  source_id: `src-${i}`,
  source_unit_path: `src-${i}`,
  declared_version: "1.0.0",
  version_scheme: "semver",
  metadata_origin: "package.json",
  fingerprint: { algorithm: "sha256-tree-v1", value: `hash-${i}` },
  vcs: null,
  binding_digest: `hash-${i}`,
}));

describe("MCP-004: cursor bound to canonical hash", () => {
  let setup: TestSetup;

  beforeEach(async () => {
    setup = await setupMcpWorkspace({
      kbId: "mcp004-test",
      records: [],
      bindings,
    });
  });

  afterEach(() => setup.cleanup());

  it("valid cursor works within same canonical hash", () => {
    const page1 = listSources(setup.ctx, { limit: 2 });
    expect(page1.data.cursor).not.toBeNull();

    const page2 = listSources(setup.ctx, { limit: 2, cursor: page1.data.cursor! });
    expect(page2.data.sources).toHaveLength(2);
  });

  it("cursor with wrong canonical hash throws StaleCursorError", () => {
    const page1 = listSources(setup.ctx, { limit: 2 });
    expect(page1.data.cursor).not.toBeNull();

    const cursor = page1.data.cursor!;
    const payload = JSON.parse(Buffer.from(cursor, "base64url").toString("utf-8"));
    payload.h = "0000000000000000000000000000000000000000000000000000000000000000";
    const tamperedCursor = Buffer.from(JSON.stringify(payload), "utf-8").toString("base64url");

    expect(() => listSources(setup.ctx, { limit: 2, cursor: tamperedCursor })).toThrow(StaleCursorError);
  });

  it("tampered cursor throws InvalidCursorError", () => {
    expect(() => listSources(setup.ctx, { limit: 2, cursor: "invalid-base64url!!" })).toThrow();
  });

  it("garbage cursor throws", () => {
    expect(() => listSources(setup.ctx, { limit: 2, cursor: "not-a-real-cursor" })).toThrow();
  });
});
