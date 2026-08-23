/*
<MODULE_CONTRACT>
<purpose>Renders the Map of Content (MOC) note grouping records by type with wiki links.</purpose>
<non-goals>
  <item>Does not render individual record notes — MOC index only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: renderMoc, MOC_TITLE, MOC_FILENAME.</item>
  <item>RFC-0012: Added optional reportPaths parameter to renderMoc for comparison report links.</item>
</CHANGE_SUMMARY>
*/
import type { CanonicalRecord } from "@roguelike-games-ib/materializer";
import type { PathResolver } from "./paths.ts";

export const MOC_TITLE = "MOC - Roguelike Games KB";

export function renderMoc(
  records: CanonicalRecord[],
  resolver: PathResolver,
  reportPaths?: string[],
): string {
  const sections: string[] = [
    "---",
    `generated: true`,
    `title: "${MOC_TITLE}"`,
    "---",
    "",
    `# ${MOC_TITLE}`,
    "",
    "> This is a generated Map of Content. All links are resolved from canonical record IDs.",
    "",
  ];

  const byType = new Map<string, CanonicalRecord[]>();
  for (const record of records) {
    const list = byType.get(record.record_type) ?? [];
    list.push(record);
    byType.set(record.record_type, list);
  }

  const sortedTypes = [...byType.keys()].sort();
  for (const type of sortedTypes) {
    sections.push(`## ${type}`);
    const recs = byType.get(type)!;
    const sorted = [...recs].sort((a, b) => a.key.localeCompare(b.key));
    for (const rec of sorted) {
      const path = resolver.idToPath.get(rec.id);
      if (path) {
        const stem = path.replace(/\.md$/, "");
        sections.push(`- [[${stem}]]`);
      }
    }
    sections.push("");
  }

  if (reportPaths && reportPaths.length > 0) {
    sections.push("## Comparison Reports");
    for (const reportPath of reportPaths) {
      const stem = reportPath.replace(/\.md$/, "");
      sections.push(`- [[${stem}]]`);
    }
    sections.push("");
  }

  return sections.join("\n");
}

export const MOC_FILENAME = "MOC - Roguelike Games KB.md";

export const CONCEPTS_MOC_FILENAME = "MOC - Concepts.md";

export function renderConceptsMoc(
  records: CanonicalRecord[],
  resolver: PathResolver,
): string {
  const concepts = records.filter((r) => r.record_type === "concept");
  if (concepts.length === 0) return "";

  const sections: string[] = [
    "---",
    `generated: true`,
    `title: "MOC - Concepts"`,
    "---",
    "",
    "# MOC - Concepts",
    "",
    "> Generated Map of Content for all concept records (cross-game mechanics, design primitives, design pressures).",
    "",
  ];

  const byConceptType = new Map<string, CanonicalRecord[]>();
  for (const concept of concepts) {
    const ct = (concept as Record<string, unknown>).concept_type as string | undefined ?? "unknown";
    const list = byConceptType.get(ct) ?? [];
    list.push(concept);
    byConceptType.set(ct, list);
  }

  const sortedTypes = [...byConceptType.keys()].sort();
  for (const type of sortedTypes) {
    sections.push(`## ${type}`);
    const recs = byConceptType.get(type)!;
    const sorted = [...recs].sort((a, b) => {
      const titleA = (a as Record<string, unknown>).title as string | undefined ?? a.key;
      const titleB = (b as Record<string, unknown>).title as string | undefined ?? b.key;
      return titleA.localeCompare(titleB);
    });
    for (const rec of sorted) {
      const path = resolver.idToPath.get(rec.id);
      const title = (rec as Record<string, unknown>).title as string | undefined ?? rec.key;
      if (path) {
        const stem = path.replace(/\.md$/, "");
        sections.push(`- [[${stem}|${title}]]`);
      }
    }
    sections.push("");
  }

  return sections.join("\n");
}
