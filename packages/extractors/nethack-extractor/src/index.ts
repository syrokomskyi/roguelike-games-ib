/*
<MODULE_CONTRACT>
<purpose>Barrel export for the NetHack extractor — extractor factory, manifest, and C-parser functions with types.</purpose>
<non-goals>
  <item>Does not implement parsing logic — re-exports from extractor and c-parser modules.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: NetHack extractor barrel exporting factory, manifest, parsers, and types.</item>
</CHANGE_SUMMARY>
*/
export { createNetHackExtractor, nethackManifest } from "./extractor.ts";
export {
  parseMonsters,
  parseObjects,
  type MonsterEntry,
  type ObjectEntry,
} from "./c-parser.ts";
export {
  parseArtifacts,
  parseTraps,
  parseRoles,
  parseRaces,
  parseDungeonBranches,
  parseSkills,
  type ArtifactEntry,
  type TrapEntry,
  type RoleEntry,
  type RaceEntry,
  type DungeonBranchEntry,
  type SkillEntry,
} from "./extra-parsers.ts";
