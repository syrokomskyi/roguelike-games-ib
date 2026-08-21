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
