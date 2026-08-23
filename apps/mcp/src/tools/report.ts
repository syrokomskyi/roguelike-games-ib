/*
<MODULE_CONTRACT>
<purpose>Generates structured markdown cross-game comparison reports by synthesizing data from existing MCP tools.</purpose>
<non-goals>
  <item>Does not mutate or create records — read-only tool.</item>
  <item>Does not generate PDF or HTML — markdown or JSON only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-0012: Initial creation — generateComparisonReport tool that assembles 6 report sections from existing tool functions.</item>
</CHANGE_SUMMARY>
*/
import type { McpContext } from "../context.ts";
import { envelope } from "../envelope.ts";
import { ValidationError } from "../errors.ts";
import { compareGames } from "./compare.ts";
import { getCoverageMatrix, compareConceptImplementations, findConceptGaps } from "./derived.ts";
import { queryDesignSpace } from "./design.ts";

const VALID_SECTIONS = ["overview", "coverage", "primitives", "gaps", "tensions", "attributes"] as const;
type SectionName = (typeof VALID_SECTIONS)[number];

interface GenerateComparisonReportInput {
  source_ids: string[];
  concept_key?: string;
  format?: "markdown" | "json";
  sections?: string[];
}

export function generateComparisonReport(
  ctx: McpContext,
  input: GenerateComparisonReportInput,
) {
  if (input.source_ids.length < 2 || input.source_ids.length > 8) {
    throw new ValidationError("generate_comparison_report requires 2..8 source_ids");
  }

  const format = input.format ?? "markdown";
  const requestedSections = input.sections
    ? input.sections.filter((s) => VALID_SECTIONS.includes(s as SectionName)) as SectionName[]
    : [...VALID_SECTIONS];

  const sectionData: Record<string, unknown> = {};

  for (const section of requestedSections) {
    sectionData[section] = buildSection(ctx, section, input);
  }

  if (format === "json") {
    return envelope(ctx, { sections: sectionData });
  }

  const markdown = assembleMarkdown(ctx, input, requestedSections, sectionData);
  return envelope(ctx, { report: markdown });
}

function buildSection(
  ctx: McpContext,
  section: SectionName,
  input: GenerateComparisonReportInput,
): unknown {
  switch (section) {
    case "overview":
      return buildOverviewSection(ctx, input);
    case "coverage":
      return buildCoverageSection(ctx, input);
    case "primitives":
      return buildPrimitivesSection(ctx, input);
    case "gaps":
      return buildGapsSection(ctx, input);
    case "tensions":
      return buildTensionsSection(ctx, input);
    case "attributes":
      return buildAttributesSection(ctx, input);
  }
}

function buildOverviewSection(ctx: McpContext, input: GenerateComparisonReportInput): unknown {
  const result = compareGames(ctx, { source_ids: input.source_ids, include_concepts: true });
  return result.data;
}

function buildCoverageSection(ctx: McpContext, input: GenerateComparisonReportInput): unknown {
  const result = getCoverageMatrix(ctx, {});
  const data = result.data as {
    matrix: Record<string, Record<string, number>>;
    concept_types: string[];
    source_ids: string[];
  };
  const filteredMatrix: Record<string, Record<string, number>> = {};
  for (const sid of input.source_ids) {
    if (data.matrix[sid]) {
      filteredMatrix[sid] = data.matrix[sid];
    }
  }
  return {
    matrix: filteredMatrix,
    concept_types: data.concept_types,
    source_ids: input.source_ids,
  };
}

function buildPrimitivesSection(
  ctx: McpContext,
  input: GenerateComparisonReportInput,
): unknown {
  if (input.concept_key) {
    try {
      const result = compareConceptImplementations(ctx, {
        concept_key: input.concept_key,
        source_ids: input.source_ids,
      });
      return result.data;
    } catch {
      return { concept: null, comparisons: [], note: `No concept found for key: ${input.concept_key}` };
    }
  }

  const designPrimitives = ctx.store.records.filter(
    (r) =>
      r.record_type === "concept" &&
      (r as unknown as Record<string, unknown>)["concept_type"] === "design_primitive",
  );

  const comparisons: unknown[] = [];
  for (const primitive of designPrimitives) {
    try {
      const result = compareConceptImplementations(ctx, {
        concept_key: primitive.key,
        source_ids: input.source_ids,
      });
      comparisons.push(result.data);
    } catch {
      comparisons.push({
        concept: { record_key: primitive.key, title: null },
        comparisons: [],
        note: "No curated summary available",
      });
    }
  }

  return { primitives: comparisons };
}

function buildGapsSection(ctx: McpContext, input: GenerateComparisonReportInput): unknown {
  const result = findConceptGaps(ctx, {});
  const data = result.data as {
    gaps: Array<{
      concept_key: string;
      concept_title: string | null;
      concept_type: string | null;
      missing_from: string[];
      present_in: string[];
    }>;
    summary: Record<string, unknown>;
  };

  const requestedSet = new Set(input.source_ids);
  const filteredGaps = data.gaps
    .filter((g) => g.missing_from.some((sid) => requestedSet.has(sid)))
    .map((g) => ({
      ...g,
      missing_from: g.missing_from.filter((sid) => requestedSet.has(sid)),
      present_in: g.present_in.filter((sid) => requestedSet.has(sid)),
    }));

  return { gaps: filteredGaps, summary: data.summary };
}

function buildTensionsSection(ctx: McpContext, _input: GenerateComparisonReportInput): unknown {
  const result = queryDesignSpace(ctx, { limit: 100 });
  return result.data;
}

function buildAttributesSection(ctx: McpContext, input: GenerateComparisonReportInput): unknown {
  const sourceRecords = input.source_ids.map((sid) => {
    const records = ctx.store.records.filter((r) => {
      const si = (r as unknown as Record<string, unknown>)["source_identity"] as
        Record<string, unknown> | undefined;
      return si?.["source_id"] === sid;
    });
    return { source_id: sid, records };
  });

  const attributeValueCounts: Record<string, Record<string, Map<string, number>>> = {};
  for (const { source_id, records } of sourceRecords) {
    attributeValueCounts[source_id] = {};
    for (const record of records) {
      const attrs = (record as unknown as Record<string, unknown>)["attributes"] as
        Record<string, unknown> | undefined;
      if (!attrs) continue;
      for (const [key, value] of Object.entries(attrs)) {
        if (!attributeValueCounts[source_id][key]) {
          attributeValueCounts[source_id][key] = new Map();
        }
        const values = Array.isArray(value) ? value.map(String) : [String(value)];
        for (const v of values) {
          const counts = attributeValueCounts[source_id][key];
          counts.set(v, (counts.get(v) ?? 0) + 1);
        }
      }
    }
  }

  const sharedAttributes = Object.keys(
    attributeValueCounts[input.source_ids[0]] ?? {},
  ).filter((attr) =>
    input.source_ids.every((sid) => attributeValueCounts[sid]?.[attr]),
  );

  const top5 = sharedAttributes
    .map((attr) => {
      const valuesBySource: Record<string, string[]> = {};
      for (const sid of input.source_ids) {
        const counts = attributeValueCounts[sid][attr];
        valuesBySource[sid] = [...counts.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([v]) => v);
      }
      return { attribute: attr, values_by_source: valuesBySource };
    })
    .slice(0, 5);

  return { attributes: top5 };
}

function assembleMarkdown(
  ctx: McpContext,
  input: GenerateComparisonReportInput,
  sections: SectionName[],
  sectionData: Record<string, unknown>,
): string {
  const sourceLabels = input.source_ids.map((sid) => {
    const source = ctx.store.findSourceById(sid);
    return source?.source_id ?? sid;
  });

  const lines: string[] = [];
  const title = input.concept_key
    ? `Cross-game comparison: ${input.concept_key}`
    : `Cross-game comparison: ${sourceLabels.join(" vs ")}`;
  lines.push(`# ${title}`, "");

  for (const section of sections) {
    switch (section) {
      case "overview":
        lines.push(...renderOverview(sectionData[section]));
        break;
      case "coverage":
        lines.push(...renderCoverage(sectionData[section], input.source_ids));
        break;
      case "primitives":
        lines.push(...renderPrimitives(sectionData[section], input.source_ids));
        break;
      case "gaps":
        lines.push(...renderGaps(sectionData[section], input.source_ids));
        break;
      case "tensions":
        lines.push(...renderTensions(sectionData[section]));
        break;
      case "attributes":
        lines.push(...renderAttributes(sectionData[section], input.source_ids));
        break;
    }
  }

  return lines.join("\n");
}

function renderOverview(data: unknown): string[] {
  const overview = data as { games: Array<Record<string, unknown>> };
  const lines = ["## Overview", ""];
  for (const game of overview.games) {
    const sid = game["source_id"] as string;
    const count = game["record_count"] as number;
    const types = game["record_types"] as Record<string, number>;
    const typeCount = Object.keys(types ?? {}).length;
    lines.push(`- **${sid}**: ${count} records, ${typeCount} record types`);
  }
  lines.push("");
  return lines;
}

function renderCoverage(data: unknown, sourceIds: string[]): string[] {
  const coverage = data as {
    matrix: Record<string, Record<string, number>>;
    concept_types: string[];
  };
  const lines = ["## Concept coverage", ""];
  lines.push(`| Concept type | ${sourceIds.join(" | ")} |`);
  lines.push(`|---|${sourceIds.map(() => "---").join("|")}|`);
  for (const ct of coverage.concept_types) {
    const counts = sourceIds.map((sid) => String(coverage.matrix[sid]?.[ct] ?? 0));
    lines.push(`| ${ct} | ${counts.join(" | ")} |`);
  }
  lines.push("");
  return lines;
}

function renderPrimitives(data: unknown, sourceIds: string[]): string[] {
  const lines = ["## Design primitive comparison", ""];
  const primitivesSection = data as {
    primitives?: unknown[];
    concept?: unknown;
    comparisons?: unknown[];
    note?: string;
  };

  if (primitivesSection.note) {
    lines.push(primitivesSection.note, "");
    return lines;
  }

  const items = primitivesSection.primitives ?? [
    { concept: primitivesSection.concept, comparisons: primitivesSection.comparisons },
  ];

  for (const item of items) {
    const primitive = item as {
      concept: { record_key: string; title: string | null };
      comparisons: Array<{
        source_id: string;
        implementation_summary: string | null;
        exemplar_records: Array<{ record_key: string; title: string | null }>;
      }>;
    };
    const title = primitive.concept?.title ?? primitive.concept?.record_key ?? "Unknown";
    lines.push(`### ${title}`, "");
    for (const comp of primitive.comparisons ?? []) {
      const summary = comp.implementation_summary ?? "No curated summary available";
      lines.push(`- **${comp.source_id}**: ${summary}`);
    }
    lines.push("");
  }

  return lines;
}

function renderGaps(data: unknown, sourceIds: string[]): string[] {
  const gapsData = data as {
    gaps: Array<{
      concept_key: string;
      concept_title: string | null;
      missing_from: string[];
      present_in: string[];
    }>;
  };
  const lines = ["## Concept gaps", ""];
  for (const sid of sourceIds) {
    const missing = gapsData.gaps.filter((g) => g.missing_from.includes(sid));
    if (missing.length > 0) {
      lines.push(`- **Missing from ${sid}**: ${missing.map((g) => g.concept_key).join(", ")}`);
    }
  }
  if (gapsData.gaps.length === 0) {
    lines.push("No concept gaps found among the selected games.");
  }
  lines.push("");
  return lines;
}

function renderTensions(data: unknown): string[] {
  const tensions = data as {
    relations: Array<{
      relation_type: string;
      source: { record_key: string } | null;
      target: { record_key: string } | null;
    }>;
    count: number;
  };
  const lines = ["## Design tensions", ""];
  if (tensions.relations.length === 0) {
    lines.push("No design tensions found.");
    lines.push("");
    return lines;
  }
  for (const rel of tensions.relations) {
    const src = rel.source?.record_key ?? "unknown";
    const tgt = rel.target?.record_key ?? "unknown";
    lines.push(`- ${src} — *${rel.relation_type}* → ${tgt}`);
  }
  lines.push("");
  return lines;
}

function renderAttributes(data: unknown, sourceIds: string[]): string[] {
  const attrsData = data as {
    attributes: Array<{
      attribute: string;
      values_by_source: Record<string, string[]>;
    }>;
  };
  const lines = ["## Attribute comparison (top 5 shared attributes)", ""];
  if (attrsData.attributes.length === 0) {
    lines.push("No shared attributes found among the selected games.");
    lines.push("");
    return lines;
  }
  lines.push(`| Attribute | ${sourceIds.join(" values | ")} values |`);
  lines.push(`|---|${sourceIds.map(() => "---").join("|")}|`);
  for (const attr of attrsData.attributes) {
    const values = sourceIds.map((sid) => (attr.values_by_source[sid] ?? []).join(", "));
    lines.push(`| ${attr.attribute} | ${values.join(" | ")} |`);
  }
  lines.push("");
  return lines;
}
