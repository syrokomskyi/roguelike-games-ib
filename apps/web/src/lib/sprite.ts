/*
<MODULE_CONTRACT>
<purpose>Maps record keys to sprite image URLs by deriving a filename from the key structure, with build-time file existence checking to avoid 404 requests.</purpose>
<non-goals>
  <item>Does not handle client-side sprite loading — use SpriteIcon.astro for rendering.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: keyToSpriteUrl helper.</item>
  <item>Added spriteExists build-time check to avoid 404 storm for records without sprites.</item>
  <item>Added encodeURIComponent to URL components for special character safety.</item>
</CHANGE_SUMMARY>
*/

import { existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Derives a sprite URL from a record key.
 *
 * Key format: `broguece/creature/bog_monster` → `/sprites/broguece/bog_monster.png`
 * Key format: `broguece/item/armor/banded_mail` → `/sprites/broguece/item-armor-banded_mail.png`
 * Key format: `broguece/terrain/wall` → `/sprites/broguece/terrain-wall.png`
 *
 * The first segment is the source (kept as directory). For `creature` records,
 * the type is dropped and only the last segment is used as the filename.
 * For all other types, remaining segments are joined with `-`.
 */
export function keyToSpriteUrl(key: string): string {
  const parts = key.split("/");
  if (parts.length < 2) return "";
  const source = encodeURIComponent(parts[0]);
  const type = parts[1];
  const rest = type === "creature"
    ? encodeURIComponent(parts[parts.length - 1])
    : encodeURIComponent(parts.slice(1).join("-"));
  return `/sprites/${source}/${rest}.png`;
}

const PUBLIC_DIR = resolve(process.cwd(), "public");

/**
 * Checks whether a sprite file exists on disk at build time.
 * Use this in Astro frontmatter to avoid rendering <img> tags for records without sprites.
 */
export function spriteExists(key: string): boolean {
  const url = keyToSpriteUrl(key);
  if (!url) return false;
  const filePath = resolve(PUBLIC_DIR, url.slice(1));
  return existsSync(filePath);
}
