/*
<MODULE_CONTRACT>
<purpose>Maps sprite_path attribute values to public sprite URLs, with build-time file existence checking.</purpose>
<non-goals>
  <item>Does not handle client-side sprite loading — use SpriteIcon.astro for rendering.</item>
  <item>Does not derive sprite filenames from record keys — uses sprite_path from record attributes.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: keyToSpriteUrl helper.</item>
  <item>Added spriteExists build-time check to avoid 404 storm for records without sprites.</item>
  <item>Added encodeURIComponent to URL components for special character safety.</item>
  <item>Replaced keyToSpriteUrl with spritePathToUrl — uses sprite_path from attributes, no game-specific logic.</item>
</CHANGE_SUMMARY>
*/

import { existsSync } from "node:fs";
import { resolve } from "node:path";

const PUBLIC_DIR = resolve(process.cwd(), "public");

/**
 * Derives a sprite URL from a sprite_path attribute value and source ID.
 *
 * sprite_path format: `knowledge/evidence/broguece/sprites/bog_monster.png`
 * URL: `/sprites/broguece/bog_monster.png`
 *
 * Extracts the filename from sprite_path and combines with source_id.
 */
export function spritePathToUrl(spritePath: string, sourceId: string): string {
  const fileName = spritePath.split("/").pop();
  if (!fileName) return "";
  return `/sprites/${encodeURIComponent(sourceId)}/${encodeURIComponent(fileName)}`;
}

/**
 * Checks whether a sprite file exists on disk at build time.
 * Use this in Astro frontmatter to avoid rendering <img> tags for records without sprites.
 */
export function spriteExists(spritePath: string, sourceId: string): boolean {
  const url = spritePathToUrl(spritePath, sourceId);
  if (!url) return false;
  const filePath = resolve(PUBLIC_DIR, url.slice(1));
  return existsSync(filePath);
}
