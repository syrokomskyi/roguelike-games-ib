/*
<MODULE_CONTRACT>
<purpose>Builds markdown comparison report data for the web app compare page — runs at build time, serializes data for client-side download.</purpose>
<non-goals>
  <item>Does not call MCP tools — reads from ProjectionStore directly.</item>
  <item>Does not generate PDF or HTML — markdown only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-0012: Initial creation — buildReportData and formatReportAsMarkdown for web report download.</item>
</CHANGE_SUMMARY>
*/
import type { ProjectionStore } from "@roguelike-games-ib/projection-sdk";
import { getSourceId } from "./page-data";

export interface ReportData {
  sourceIds: string[];
  overview: Array<{ sourceId: string; recordCount: number; recordTypeCount: number }>;
  coverage: {
    matrix: Record<string, Record<string, number>>;
    conceptTypes: string[];
  };
  gaps: Array<{
    conceptKey: string;
    conceptTitle: string | null;
    missingFrom: string[];
    presentIn: string[];
  }>;
}

export function buildReportData(store: ProjectionStore, sourceIds: string[]): ReportData {
  const overview = sourceIds.map((sid) => {
    const records = store.records.filter((r) => getSourceId(r as unknown as Record<string, unknown>) === sid);
    const types = new Set(records.map((r) => r.record_type));
    return { sourceId: sid, recordCount: records.length, recordTypeCount: types.size };
  });

  const concepts = store.records.filter((r) => r.record_type === "concept");
  const conceptTypes = new Set<string>();
  const matrix: Record<string, Record<string, number>> = {};
  for (const sid of sourceIds) matrix[sid] = {};

  for (const concept of concepts) {
    const ct = (concept as unknown as Record<string, unknown>)["concept_type"] as string ?? "unknown";
    conceptTypes.add(ct);
    const ancestry = (concept as unknown as Record<string, unknown>)["ancestry"] as Record<string, unknown> | undefined;
    const sourceGames = (ancestry?.["source_games"] as string[]) ?? [];
    for (const sid of sourceIds) {
      if (sourceGames.includes(sid)) {
        matrix[sid][ct] = (matrix[sid][ct] ?? 0) + 1;
      }
    }
  }

  const requestedSet = new Set(sourceIds);
  const gaps: ReportData["gaps"] = [];
  for (const concept of concepts) {
    const ancestry = (concept as unknown as Record<string, unknown>)["ancestry"] as Record<string, unknown> | undefined;
    const sourceGames = (ancestry?.["source_games"] as string[]) ?? [];
    const missing = sourceIds.filter((sid) => !sourceGames.includes(sid));
    const present = sourceIds.filter((sid) => sourceGames.includes(sid));
    if (missing.length > 0) {
      gaps.push({
        conceptKey: concept.key,
        conceptTitle: (concept as unknown as Record<string, unknown>)["title"] as string | null,
        missingFrom: missing.filter((sid) => requestedSet.has(sid)),
        presentIn: present.filter((sid) => requestedSet.has(sid)),
      });
    }
  }

  return {
    sourceIds,
    overview,
    coverage: {
      matrix,
      conceptTypes: [...conceptTypes].sort(),
    },
    gaps,
  };
}

export function formatReportAsMarkdown(data: ReportData): string {
  const lines: string[] = [
    `# Cross-game comparison: ${data.sourceIds.join(" vs ")}`,
    "",
  ];

  lines.push("## Overview", "");
  for (const game of data.overview) {
    lines.push(`- **${game.sourceId}**: ${game.recordCount} records, ${game.recordTypeCount} record types`);
  }
  lines.push("");

  lines.push("## Concept coverage", "");
  lines.push(`| Concept type | ${data.sourceIds.join(" | ")} |`);
  lines.push(`|---|${data.sourceIds.map(() => "---").join("|")}|`);
  for (const ct of data.coverage.conceptTypes) {
    const counts = data.sourceIds.map((sid) => String(data.coverage.matrix[sid]?.[ct] ?? 0));
    lines.push(`| ${ct} | ${counts.join(" | ")} |`);
  }
  lines.push("");

  lines.push("## Concept gaps", "");
  for (const sid of data.sourceIds) {
    const missing = data.gaps.filter((g) => g.missingFrom.includes(sid));
    if (missing.length > 0) {
      lines.push(`- **Missing from ${sid}**: ${missing.map((g) => g.conceptKey).join(", ")}`);
    }
  }
  if (data.gaps.length === 0) {
    lines.push("No concept gaps found among the selected games.");
  }
  lines.push("");

  return lines.join("\n");
}
