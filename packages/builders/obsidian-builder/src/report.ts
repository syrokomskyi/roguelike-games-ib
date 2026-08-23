/*
<MODULE_CONTRACT>
<purpose>Generates comparison report notes for the Obsidian vault — one note per game pair with wiki-links to concept and record notes.</purpose>
<non-goals>
  <item>Does not create canonical records — report notes are generated artifacts.</item>
  <item>Does not validate links — relies on build.ts link validation pass.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-0012: Initial creation — generateComparisonNotes for pairwise game comparison report notes.</item>
</CHANGE_SUMMARY>
*/
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ProjectionStore } from "@roguelike-games-ib/projection-sdk";
import type { PathResolver } from "./paths.ts";
import { makeWikiLink } from "./links.ts";

const GENERATED_WARNING = "**GENERATED PROJECTION — DO NOT EDIT AS CANONICAL KNOWLEDGE**";

export function generateComparisonNotes(
  store: ProjectionStore,
  resolver: PathResolver,
  vaultRoot: string,
): string[] {
  const sourceIds = store.sources.map((s) => s.source_id).sort();
  const notePaths: string[] = [];

  for (let i = 0; i < sourceIds.length; i++) {
    for (let j = i + 1; j < sourceIds.length; j++) {
      const [sidA, sidB] = [sourceIds[i], sourceIds[j]];
      const notePath = `reports/comparisons/${sidA}-vs-${sidB}.md`;
      const fullPath = join(vaultRoot, notePath);
      mkdirSync(join(fullPath, ".."), { recursive: true });
      const content = renderComparisonNote(store, resolver, sidA, sidB);
      writeFileSync(fullPath, content, "utf-8");
      notePaths.push(notePath);
    }
  }

  return notePaths;
}

function renderComparisonNote(
  store: ProjectionStore,
  resolver: PathResolver,
  sidA: string,
  sidB: string,
): string {
  const lines: string[] = [
    "---",
    "generated: true",
    `title: "Comparison: ${sidA} vs ${sidB}"`,
    "---",
    "",
    `# Comparison: ${sidA} vs ${sidB}`,
    "",
    `> ${GENERATED_WARNING}`,
    "",
  ];

  lines.push(...renderOverview(store, sidA, sidB));
  lines.push(...renderCoverage(store, resolver, sidA, sidB));
  lines.push(...renderGaps(store, resolver, sidA, sidB));

  return lines.join("\n");
}

function renderOverview(store: ProjectionStore, sidA: string, sidB: string): string[] {
  const recordsA = store.records.filter((r) => {
    const si = (r as unknown as Record<string, unknown>)["source_identity"] as Record<string, unknown> | undefined;
    return si?.["source_id"] === sidA;
  });
  const recordsB = store.records.filter((r) => {
    const si = (r as unknown as Record<string, unknown>)["source_identity"] as Record<string, unknown> | undefined;
    return si?.["source_id"] === sidB;
  });

  const typesA = new Set(recordsA.map((r) => r.record_type));
  const typesB = new Set(recordsB.map((r) => r.record_type));

  return [
    "## Overview",
    "",
    `- **${sidA}**: ${recordsA.length} records, ${typesA.size} record types`,
    `- **${sidB}**: ${recordsB.length} records, ${typesB.size} record types`,
    "",
  ];
}

function renderCoverage(
  store: ProjectionStore,
  resolver: PathResolver,
  sidA: string,
  sidB: string,
): string[] {
  const concepts = store.records.filter((r) => r.record_type === "concept");
  const typeCounts: Record<string, { a: number; b: number }> = {};

  for (const concept of concepts) {
    const ct = (concept as unknown as Record<string, unknown>)["concept_type"] as string ?? "unknown";
    if (!typeCounts[ct]) typeCounts[ct] = { a: 0, b: 0 };

    const ancestry = (concept as unknown as Record<string, unknown>)["ancestry"] as Record<string, unknown> | undefined;
    const sourceGames = (ancestry?.["source_games"] as string[]) ?? [];
    if (sourceGames.includes(sidA)) typeCounts[ct].a++;
    if (sourceGames.includes(sidB)) typeCounts[ct].b++;
  }

  const lines = ["## Concept coverage", "", `| Concept type | ${sidA} | ${sidB} |`, "|---|---|---|"];
  for (const ct of Object.keys(typeCounts).sort()) {
    lines.push(`| ${ct} | ${typeCounts[ct].a} | ${typeCounts[ct].b} |`);
  }
  lines.push("");

  const conceptsA = concepts.filter((c) => {
    const ancestry = (c as unknown as Record<string, unknown>)["ancestry"] as Record<string, unknown> | undefined;
    return ((ancestry?.["source_games"] as string[]) ?? []).includes(sidA);
  });
  const conceptsB = concepts.filter((c) => {
    const ancestry = (c as unknown as Record<string, unknown>)["ancestry"] as Record<string, unknown> | undefined;
    return ((ancestry?.["source_games"] as string[]) ?? []).includes(sidB);
  });

  lines.push(`### Concepts in ${sidA}`, "");
  for (const c of conceptsA.sort((a, b) => a.key.localeCompare(b.key))) {
    const link = makeWikiLink(resolver, store.aliasMap, c.id);
    if (link) lines.push(`- ${link}`);
  }
  lines.push("");

  lines.push(`### Concepts in ${sidB}`, "");
  for (const c of conceptsB.sort((a, b) => a.key.localeCompare(b.key))) {
    const link = makeWikiLink(resolver, store.aliasMap, c.id);
    if (link) lines.push(`- ${link}`);
  }
  lines.push("");

  return lines;
}

function renderGaps(
  store: ProjectionStore,
  resolver: PathResolver,
  sidA: string,
  sidB: string,
): string[] {
  const concepts = store.records.filter((r) => r.record_type === "concept");
  const missingFromA: string[] = [];
  const missingFromB: string[] = [];

  for (const concept of concepts) {
    const ancestry = (concept as unknown as Record<string, unknown>)["ancestry"] as Record<string, unknown> | undefined;
    const sourceGames = (ancestry?.["source_games"] as string[]) ?? [];
    const inA = sourceGames.includes(sidA);
    const inB = sourceGames.includes(sidB);
    if (inB && !inA) missingFromA.push(concept.key);
    if (inA && !inB) missingFromB.push(concept.key);
  }

  const lines = ["## Concept gaps", ""];

  lines.push(`- **Missing from ${sidA}** (${missingFromA.length}): ${missingFromA.join(", ") || "none"}`);
  lines.push(`- **Missing from ${sidB}** (${missingFromB.length}): ${missingFromB.join(", ") || "none"}`);
  lines.push("");

  return lines;
}
