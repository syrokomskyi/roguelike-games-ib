import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { setupMcpWorkspace, testId, type TestSetup } from "./helpers";
import { listSources } from "@roguelike-games-ib/mcp";

const bindings = Array.from({ length: 25 }, (_, i) => ({
  source_id: `src-${String(i).padStart(2, "0")}`,
  source_unit_path: `src-${String(i).padStart(2, "0")}`,
  declared_version: "1.0.0",
  version_scheme: "semver",
  metadata_origin: "package.json",
  fingerprint: { algorithm: "sha256-tree-v1", value: `hash-${i}` },
  vcs: null,
  binding_digest: `hash-${i}`,
}));

describe("MCP-003: pagination stable for equal sort values", () => {
  let setup: TestSetup;

  beforeEach(async () => {
    setup = await setupMcpWorkspace({
      kbId: "mcp003-test",
      records: [],
      bindings,
    });
  });

  afterEach(() => setup.cleanup());

  it("paginates sources with stable key ASC ordering", async () => {
    const page1 = await listSources(setup.ctx, { limit: 10 });
    expect(page1.data.sources).toHaveLength(10);
    expect(page1.data.sources[0].source_id).toBe("src-00");
    expect(page1.data.sources[9].source_id).toBe("src-09");
    expect(page1.data.cursor).not.toBeNull();

    const page2 = await listSources(setup.ctx, { limit: 10, cursor: page1.data.cursor! });
    expect(page2.data.sources).toHaveLength(10);
    expect(page2.data.sources[0].source_id).toBe("src-10");
    expect(page2.data.sources[9].source_id).toBe("src-19");

    const page3 = await listSources(setup.ctx, { limit: 10, cursor: page2.data.cursor! });
    expect(page3.data.sources).toHaveLength(5);
    expect(page3.data.cursor).toBeNull();
  });

  it("same cursor produces same results deterministically", async () => {
    const page1 = await listSources(setup.ctx, { limit: 10 });
    const page2a = await listSources(setup.ctx, { limit: 10, cursor: page1.data.cursor! });
    const page2b = await listSources(setup.ctx, { limit: 10, cursor: page1.data.cursor! });
    expect(page2a.data.sources).toEqual(page2b.data.sources);
  });

  it("all sources are returned across pages without gaps or duplicates", async () => {
    const allSources: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await listSources(setup.ctx, { limit: 10, cursor });
      allSources.push(...page.data.sources.map((s) => s.source_id));
      cursor = page.data.cursor ?? undefined;
    } while (cursor);

    expect(allSources).toHaveLength(25);
    const unique = new Set(allSources);
    expect(unique.size).toBe(25);
  });
});
