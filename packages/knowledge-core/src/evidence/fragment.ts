/*
<MODULE_CONTRACT>
<purpose>Re-exports computeFragmentHash from the hash module for evidence fragment hashing.</purpose>
<non-goals>
  <item>Does not implement hashing — delegates to hash.ts.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: fragment barrel re-exporting computeFragmentHash.</item>
</CHANGE_SUMMARY>
*/
export { computeFragmentHash } from "../hash.ts";
