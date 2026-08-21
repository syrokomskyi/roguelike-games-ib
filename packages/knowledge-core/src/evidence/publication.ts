export type ExcerptPolicy = "none" | "short" | "source_policy";
export type AccessLevel = "public" | "restricted" | "private";

export interface PublicationPolicy {
  access: AccessLevel;
  expose_locator: boolean;
  excerpt_policy: ExcerptPolicy;
  license_ref: string | null;
}

/**
 * Default publication policy for public sources.
 */
export function defaultPublicPolicy(): PublicationPolicy {
  return {
    access: "public",
    expose_locator: true,
    excerpt_policy: "short",
    license_ref: null,
  };
}

/**
 * Default publication policy for private/restricted sources.
 */
export function defaultPrivatePolicy(): PublicationPolicy {
  return {
    access: "private",
    expose_locator: false,
    excerpt_policy: "none",
    license_ref: null,
  };
}

/**
 * Validate that a publication policy is consistent.
 */
export function validatePublicationPolicy(policy: PublicationPolicy): string[] {
  const errors: string[] = [];

  if (policy.access === "private" && policy.excerpt_policy === "short") {
    errors.push("Private access sources cannot have 'short' excerpt policy");
  }

  if (policy.access === "private" && policy.expose_locator) {
    errors.push("Private access sources should not expose locators");
  }

  return errors;
}
