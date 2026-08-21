import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createTestWorkspace, cleanupTempWorkspace } from "@roguelike-games-ib/test-fixtures";
import { canonicalJsonStringify } from "@roguelike-games-ib/knowledge-core";
import { materialize } from "@roguelike-games-ib/materializer";
import { createWebContext, type WebContext } from "@roguelike-games-ib/web";

export function testId(n: number): string {
  const hex = n.toString(16).padStart(12, "0");
  return `00000000-0000-7000-8000-${hex}00000000`;
}

export interface TestRecord {
  id: string;
  key: string;
  record_type: string;
  [key: string]: unknown;
}

export interface TestSetup {
  workspace: string;
  canonicalRoot: string;
  distDir: string;
  canonicalHash: string;
  ctx: WebContext;
  cleanup: () => void;
}

export async function setupWebWorkspace(options: {
  kbId?: string;
  records?: TestRecord[];
  claims?: unknown[];
  relations?: unknown[];
  contradictions?: unknown[];
  evidence?: unknown[];
  keys?: { id: string; key: string; record_type: string }[];
  aliases?: { key: string; retired_to: string; retired_at: string }[];
  bindings?: unknown[];
  coverage?: unknown[];
}): Promise<TestSetup> {
  const workspace = createTestWorkspace({ kbId: options.kbId ?? "web-test" });
  const canonicalRoot = join(workspace, "knowledge");

  for (const record of options.records ?? []) {
    const dir = join(canonicalRoot, record.record_type);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${record.key}.jsonl`), canonicalJsonStringify(record) + "\n", "utf-8");
  }

  for (const claim of options.claims ?? []) {
    const dir = join(canonicalRoot, "claim");
    mkdirSync(dir, { recursive: true });
    const c = claim as { id: string };
    writeFileSync(join(dir, `${c.id}.jsonl`), canonicalJsonStringify(claim) + "\n", "utf-8");
  }

  for (const rel of options.relations ?? []) {
    const dir = join(canonicalRoot, "relation");
    mkdirSync(dir, { recursive: true });
    const r = rel as { id: string };
    writeFileSync(join(dir, `${r.id}.jsonl`), canonicalJsonStringify(rel) + "\n", "utf-8");
  }

  for (const con of options.contradictions ?? []) {
    const dir = join(canonicalRoot, "contradiction");
    mkdirSync(dir, { recursive: true });
    const c = con as { id: string };
    writeFileSync(join(dir, `${c.id}.jsonl`), canonicalJsonStringify(con) + "\n", "utf-8");
  }

  for (const ev of options.evidence ?? []) {
    const dir = join(canonicalRoot, "evidence");
    mkdirSync(dir, { recursive: true });
    const e = ev as { id: string };
    writeFileSync(join(dir, `${e.id}.jsonl`), canonicalJsonStringify(ev) + "\n", "utf-8");
  }

  if (options.keys && options.keys.length > 0) {
    const keysPath = join(canonicalRoot, "identity", "keys.jsonl");
    mkdirSync(join(canonicalRoot, "identity"), { recursive: true });
    const lines = options.keys.map((k) => canonicalJsonStringify(k));
    writeFileSync(keysPath, lines.join("\n") + "\n", "utf-8");
  }

  if (options.aliases && options.aliases.length > 0) {
    const aliasesPath = join(canonicalRoot, "identity", "aliases.jsonl");
    mkdirSync(join(canonicalRoot, "identity"), { recursive: true });
    const lines = options.aliases.map((a) => canonicalJsonStringify(a));
    writeFileSync(aliasesPath, lines.join("\n") + "\n", "utf-8");
  }

  if (options.bindings && options.bindings.length > 0) {
    const bindingsPath = join(canonicalRoot, "sources", "bindings.yaml");
    mkdirSync(join(canonicalRoot, "sources"), { recursive: true });
    writeFileSync(bindingsPath, `schema: rgkb/source-bindings@2\nbindings:\n` +
      options.bindings.map((b) => `  - ${JSON.stringify(b).replace(/"/g, "'").replace(/^'|'$/g, "")}`).join("\n") + "\n", "utf-8");
  }

  if (options.coverage && options.coverage.length > 0) {
    const coverageDir = join(canonicalRoot, "coverage");
    mkdirSync(coverageDir, { recursive: true });
    for (const cov of options.coverage) {
      const c = cov as { source_id: string };
      writeFileSync(join(coverageDir, `${c.source_id}.json`), canonicalJsonStringify(cov), "utf-8");
    }
  }

  const ontologyDir = join(canonicalRoot, "ontology");
  if (!existsSync(ontologyDir)) {
    mkdirSync(ontologyDir, { recursive: true });
  }
  writeFileSync(
    join(ontologyDir, "relation-types.yaml"),
    `schema: rgkb/relation-ontology@2\nmodel_version: 2.0.0\nrelations:\n- id: similar_to\n  semantics: Source record is similar to target record.\n  direction: symmetric\n  evidence_required: false\n  domain:\n  - creature\n  - mechanic\n  range:\n  - creature\n  - mechanic\n- id: related_to\n  semantics: Source record is related to target record.\n  direction: directed\n  evidence_required: false\n  domain:\n  - creature\n  - mechanic\n  range:\n  - creature\n  - mechanic\n- id: implements\n  semantics: Source record implements target record.\n  direction: directed\n  evidence_required: false\n  domain:\n  - creature\n  - mechanic\n  range:\n  - creature\n  - mechanic\n- id: pressures\n  semantics: Design pressure relation.\n  direction: directed\n  evidence_required: false\n  domain:\n  - design_primitive\n  range:\n  - design_primitive\n- id: tensions_with\n  semantics: Design tension relation.\n  direction: symmetric\n  evidence_required: false\n  domain:\n  - design_primitive\n  range:\n  - design_primitive\n`,
    "utf-8",
  );

  const matResult = materialize({ workspaceRoot: workspace });
  const ctx = await createWebContext(matResult.distDir);

  return {
    workspace,
    canonicalRoot,
    distDir: matResult.distDir,
    canonicalHash: matResult.canonicalHash,
    ctx,
    cleanup: () => {
      cleanupTempWorkspace(workspace);
    },
  };
}
