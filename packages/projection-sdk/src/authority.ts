/*
<MODULE_CONTRACT>
<purpose>Defines authority context types and helpers for distinguishing canonical vs laboratory projections.</purpose>
<non-goals>
  <item>Does not enforce authority — context creation and checking only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: Authority type, AuthorityContext, canonicalAuthority, laboratoryAuthority, isCanonical, isLaboratory.</item>
</CHANGE_SUMMARY>
*/
export type Authority = "canonical" | "laboratory";

export interface AuthorityContext {
  authority: Authority;
  canonicalHash: string;
}

export function canonicalAuthority(canonicalHash: string): AuthorityContext {
  return { authority: "canonical", canonicalHash };
}

export function laboratoryAuthority(canonicalHash: string): AuthorityContext {
  return { authority: "laboratory", canonicalHash };
}

export function isCanonical(ctx: AuthorityContext): boolean {
  return ctx.authority === "canonical";
}

export function isLaboratory(ctx: AuthorityContext): boolean {
  return ctx.authority === "laboratory";
}
