/*
<MODULE_CONTRACT>
<purpose>Builds an Obsidian vault from materialized canonical state — renders record notes, source notes, MOC, validates links, and writes build manifest.</purpose>
<non-goals>
  <item>Does not materialize canonical state — uses materializer output.</item>
  <item>Does not serve the vault — build-time only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: buildObsidianVault with record/source/MOC rendering and link validation.</item>
  <item>RFC-0012: Added optional reports flag for comparison report note generation.</item>
</CHANGE_SUMMARY>
*/
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { resolveKnowledgePaths } from "@roguelike-games-ib/knowledge-core";
import { materialize } from "@roguelike-games-ib/materializer";
import { openProjection, type ProjectionStore } from "@roguelike-games-ib/projection-sdk";
import { buildPathResolver, type PathResolver } from "./paths.ts";
import { renderRecordNote } from "./render-record.ts";
import { renderSourceNote } from "./render-source.ts";
import { renderMoc, MOC_FILENAME, renderConceptsMoc, CONCEPTS_MOC_FILENAME } from "./moc.ts";
import { createBuildManifest, writeBuildManifest, type ObsidianBuildManifest } from "./build-manifest.ts";
import { validateAllLinks, resolveLink } from "./links.ts";
import { generateComparisonNotes } from "./report.ts";

const GENERATED_WARNING = "**GENERATED PROJECTION — DO NOT EDIT AS CANONICAL KNOWLEDGE**";

export interface ObsidianBuildOptions {
  workspaceRoot: string;
  distDir?: string;
  vaultDir?: string;
  reports?: boolean;
}

export interface ObsidianBuildResult {
  vaultRoot: string;
  manifest: ObsidianBuildManifest;
  noteCount: number;
  sourceNoteCount: number;
  notePaths: string[];
}

export function buildObsidianVault(options: ObsidianBuildOptions): ObsidianBuildResult {
  const paths = resolveKnowledgePaths(options.workspaceRoot);
  const distDir = options.distDir ?? join(paths.generatedRoot, "dist");
  const vaultRoot = resolve(options.vaultDir ?? join(paths.generatedRoot, "obsidian"));

  if (!existsSync(distDir)) {
    const matResult = materialize({ workspaceRoot: options.workspaceRoot, distDir });
    if (!matResult.manifest) {
      throw new Error("Materialization failed — no manifest produced");
    }
  }

  const store = openProjection(distDir);

  if (existsSync(vaultRoot)) {
    rmSync(vaultRoot, { recursive: true });
  }
  mkdirSync(vaultRoot, { recursive: true });

  const resolver = buildPathResolver(store.records);

  const notePaths: string[] = [];
  const allLinks: string[] = [];

  for (const record of store.records) {
    const notePath = resolver.idToPath.get(record.id)!;
    const fullPath = join(vaultRoot, notePath);
    const dir = join(fullPath, "..");
    mkdirSync(dir, { recursive: true });
    const content = renderRecordNote(store, resolver, record);
    writeFileSync(fullPath, content, "utf-8");
    notePaths.push(notePath);

    for (const rel of store.relations) {
      if (rel.source_record_id === record.id) allLinks.push(rel.target_record_id);
      if (rel.target_record_id === record.id) allLinks.push(rel.source_record_id);
    }
    for (const claim of store.claims) {
      if (claim.subject_id === record.id && claim.object_ref) allLinks.push(claim.object_ref);
    }
    if (record.record_type === "concept") {
      const refs = (record as Record<string, unknown>).implementation_refs;
      if (Array.isArray(refs)) {
        for (const ref of refs) if (typeof ref === "string") allLinks.push(ref);
      }
    }
  }

  const linkValidation = validateAllLinks(resolver, store.aliasMap, allLinks);
  if (!linkValidation.valid) {
    throw new Error(`Unresolved canonical links: ${linkValidation.unresolved.join(", ")}`);
  }

  const sourceNotePaths: string[] = [];
  for (const source of store.sources) {
    const notePath = `evidence/sources/${source.source_id}.md`;
    const fullPath = join(vaultRoot, notePath);
    mkdirSync(join(fullPath, ".."), { recursive: true });
    const content = renderSourceNote(source, store.coverage, store.canonicalHash);
    writeFileSync(fullPath, content, "utf-8");
    sourceNotePaths.push(notePath);
  }

  let reportNotePaths: string[] = [];
  if (options.reports) {
    reportNotePaths = generateComparisonNotes(store, resolver, vaultRoot);
    notePaths.push(...reportNotePaths);
  }

  const mocContent = renderMoc(store.records, resolver, reportNotePaths);
  writeFileSync(join(vaultRoot, MOC_FILENAME), mocContent, "utf-8");
  notePaths.push(MOC_FILENAME);

  const conceptsMocContent = renderConceptsMoc(store.records, resolver);
  if (conceptsMocContent) {
    writeFileSync(join(vaultRoot, CONCEPTS_MOC_FILENAME), conceptsMocContent, "utf-8");
    notePaths.push(CONCEPTS_MOC_FILENAME);
  }

  writeFileSync(join(vaultRoot, "README.md"), `# Roguelike Games IB — Obsidian Vault\n\n${GENERATED_WARNING}\n\nThis vault is generated from the materialized canonical knowledge base.\n\n- **Canonical hash**: \`${store.canonicalHash}\`\n- **Notes**: ${notePaths.length}\n\nSee [[${MOC_FILENAME.replace(/\.md$/, "")}]] for the Map of Content.\n`, "utf-8");

  mkdirSync(join(vaultRoot, "_meta"), { recursive: true });
  writeFileSync(join(vaultRoot, "_meta", "generated.txt"), GENERATED_WARNING, "utf-8");

  const recordCounts: Record<string, number> = {};
  for (const record of store.records) {
    recordCounts[record.record_type] = (recordCounts[record.record_type] ?? 0) + 1;
  }

  const manifest = createBuildManifest({
    canonicalHash: store.canonicalHash,
    noteCount: notePaths.length,
    sourceNoteCount: sourceNotePaths.length,
    recordCounts,
  });
  writeBuildManifest(vaultRoot, manifest);

  return {
    vaultRoot,
    manifest,
    noteCount: notePaths.length,
    sourceNoteCount: sourceNotePaths.length,
    notePaths,
  };
}
