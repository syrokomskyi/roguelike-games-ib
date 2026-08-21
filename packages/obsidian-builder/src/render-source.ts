import type { SourceBinding, CoverageRecord } from "@roguelike-games-ib/knowledge-core";
import { createFrontmatter, serializeFrontmatter } from "./frontmatter.ts";

export function renderSourceNote(
  source: SourceBinding,
  coverage: CoverageRecord[],
  canonicalHash: string,
): string {
  const fakeRecord = {
    id: source.source_id,
    key: `sources/${source.source_id}`,
    record_type: "source",
    source_id: source.source_id,
  };
  const fm = createFrontmatter(fakeRecord, canonicalHash);
  const fmText = serializeFrontmatter(fm);

  const sections: string[] = [fmText, "", `# Source: ${source.source_id}`, ""];
  sections.push(`- **Binding digest**: \`${source.binding_digest}\``);
  sections.push(`- **Fingerprint**: \`${source.fingerprint.value}\``);
  sections.push(`- **Version**: \`${source.declared_version}\``, "");

  const sourceCoverage = coverage.filter((c) => c.source_id === source.source_id);
  if (sourceCoverage.length > 0) {
    sections.push("## Coverage");
    for (const cov of sourceCoverage) {
      for (const dim of cov.dimensions) {
        sections.push(`- **${dim.id}**: ${dim.state}`);
      }
    }
    sections.push("");
  }

  return sections.join("\n");
}
