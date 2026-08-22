export interface VaultEntry {
  nativeId: string;
  filePath: string;
  lineStart: number;
  lineEnd: number;
  depth: string | null;
  weight: string | null;
  tags: string[];
  orient: string | null;
  chance: string | null;
  mons: string[];
  items: string[];
  hasMap: boolean;
}

const NAME_RE = /^NAME:\s*(.+)$/;
const DEPTH_RE = /^DEPTH:\s*(.+)$/;
const WEIGHT_RE = /^WEIGHT:\s*(.+)$/;
const TAGS_RE = /^TAGS:\s*(.+)$/;
const ORIENT_RE = /^ORIENT:\s*(.+)$/;
const CHANCE_RE = /^CHANCE:\s*(.+)$/;
const MONS_RE = /^MONS:\s*(.+)$/;
const ITEM_RE = /^ITEM:\s*(.+)$/;
const MAP_RE = /^MAP\s*$/;
const ENDMAP_RE = /^ENDMAP\s*$/;

export function parseDesVaults(source: string, filePath: string): VaultEntry[] {
  const lines = source.split("\n");
  const entries: VaultEntry[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const nameMatch = line.match(NAME_RE);
    if (!nameMatch) {
      i++;
      continue;
    }

    const nativeId = nameMatch[1].trim();
    const lineStart = i + 1;

    const props: {
      depth: string | null;
      weight: string | null;
      tags: string[];
      orient: string | null;
      chance: string | null;
      mons: string[];
      items: string[];
      hasMap: boolean;
    } = {
      depth: null,
      weight: null,
      tags: [],
      orient: null,
      chance: null,
      mons: [],
      items: [],
      hasMap: false,
    };

    let inMap = false;
    let j = i + 1;
    for (; j < lines.length; j++) {
      const cur = lines[j];

      if (inMap) {
        if (ENDMAP_RE.test(cur)) {
          inMap = false;
          continue;
        }
        continue;
      }

      if (MAP_RE.test(cur)) {
        props.hasMap = true;
        inMap = true;
        continue;
      }

      if (NAME_RE.test(cur)) {
        break;
      }

      const depthMatch = cur.match(DEPTH_RE);
      if (depthMatch) {
        props.depth = depthMatch[1].trim();
        continue;
      }

      const weightMatch = cur.match(WEIGHT_RE);
      if (weightMatch) {
        props.weight = weightMatch[1].trim();
        continue;
      }

      const tagsMatch = cur.match(TAGS_RE);
      if (tagsMatch) {
        props.tags.push(
          ...tagsMatch[1].trim().split(/\s+/).filter((t) => t.length > 0),
        );
        continue;
      }

      const orientMatch = cur.match(ORIENT_RE);
      if (orientMatch) {
        props.orient = orientMatch[1].trim();
        continue;
      }

      const chanceMatch = cur.match(CHANCE_RE);
      if (chanceMatch) {
        props.chance = chanceMatch[1].trim();
        continue;
      }

      const monsMatch = cur.match(MONS_RE);
      if (monsMatch) {
        props.mons.push(monsMatch[1].trim());
        continue;
      }

      const itemMatch = cur.match(ITEM_RE);
      if (itemMatch) {
        props.items.push(itemMatch[1].trim());
        continue;
      }
    }

    const lineEnd = j;

    entries.push({
      nativeId,
      filePath,
      lineStart,
      lineEnd,
      depth: props.depth,
      weight: props.weight,
      tags: props.tags,
      orient: props.orient,
      chance: props.chance,
      mons: props.mons,
      items: props.items,
      hasMap: props.hasMap,
    });

    i = j;
  }

  return entries;
}
