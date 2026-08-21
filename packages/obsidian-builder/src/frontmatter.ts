import type { CanonicalRecord } from "@roguelike-games-ib/materializer";

export interface NoteFrontmatter {
  record_id: string;
  record_key: string;
  record_type: string;
  source_id: string | null;
  canonical_hash: string;
  generated: true;
}

export function createFrontmatter(
  record: CanonicalRecord,
  canonicalHash: string,
): NoteFrontmatter {
  const si = record.source_identity as Record<string, unknown> | undefined;
  const sourceId = (si && typeof si.source_id === "string" ? si.source_id : null)
    ?? (typeof record.source_id === "string" ? record.source_id : null);

  return {
    record_id: record.id,
    record_key: record.key,
    record_type: record.record_type,
    source_id: sourceId,
    canonical_hash: canonicalHash,
    generated: true,
  };
}

export function serializeFrontmatter(fm: NoteFrontmatter): string {
  const lines: string[] = ["---"];
  lines.push(`record_id: "${fm.record_id}"`);
  lines.push(`record_key: "${fm.record_key}"`);
  lines.push(`record_type: "${fm.record_type}"`);
  lines.push(`source_id: ${fm.source_id ? `"${fm.source_id}"` : "null"}`);
  lines.push(`canonical_hash: "${fm.canonical_hash}"`);
  lines.push(`generated: true`);
  lines.push("---");
  return lines.join("\n");
}

export function parseFrontmatter(text: string): Record<string, unknown> | null {
  const match = text.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  const block = match[1];
  const result: Record<string, unknown> = {};
  for (const line of block.split("\n")) {
    const m = line.match(/^(\w+):\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    let value: unknown = m[2];
    if (value === "true") value = true;
    else if (value === "false") value = false;
    else if (value === "null") value = null;
    else if (typeof value === "string" && value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}
