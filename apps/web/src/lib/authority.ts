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
