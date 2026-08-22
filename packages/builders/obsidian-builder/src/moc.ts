/*
<MODULE_CONTRACT>
<purpose>Renders the Map of Content (MOC) note grouping records by type with wiki links.</purpose>
<non-goals>
  <item>Does not render individual record notes — MOC index only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: renderMoc, MOC_TITLE, MOC_FILENAME.</item>
</CHANGE_SUMMARY>
*/
import type { CanonicalRecord } from "@roguelike-games-ib/materializer";
import type { PathResolver } from "./paths.ts";

export const MOC_TITLE = "MOC - Roguelike Games KB";

export function renderMoc(
  records: CanonicalRecord[],
  resolver: PathResolver,
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

  return sections.join("\n");
}

export const MOC_FILENAME = "MOC - Roguelike Games KB.md";
