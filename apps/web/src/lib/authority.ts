/*
<MODULE_CONTRACT>
<purpose>Provides authority badge data and helper functions for distinguishing canonical vs laboratory records in the web UI.</purpose>
<non-goals>
  <item>Does not enforce authority — UI badge rendering data only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: Authority type, AuthorityBadgeData, authorityBadge, isNonAuthoritative.</item>
</CHANGE_SUMMARY>
*/
export type Authority = "canonical" | "laboratory";

export interface AuthorityBadgeData {
  authority: Authority;
  label: string;
  className: string;
  nonAuthoritative: boolean;
}

export function authorityBadge(authority: Authority): AuthorityBadgeData {
  if (authority === "laboratory") {
    return {
      authority,
      label: "Laboratory",
      className: "badge-laboratory",
      nonAuthoritative: true,
    };
  }
  return {
    authority,
    label: "Canonical",
    className: "badge-canonical",
    nonAuthoritative: false,
  };
}

export function isNonAuthoritative(authority: Authority): boolean {
  return authority === "laboratory";
}
