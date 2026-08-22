/*
<MODULE_CONTRACT>
<purpose>Maps record keys to sprite image URLs by deriving a filename from the key structure.</purpose>
<non-goals>
  <item>Does not verify file existence on disk — returns a URL that may 404 if no sprite exists.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: keyToSpriteUrl helper.</item>
</CHANGE_SUMMARY>
*/

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
