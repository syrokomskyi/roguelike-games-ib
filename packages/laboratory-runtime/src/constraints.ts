/*
<MODULE_CONTRACT>
<purpose>Defines design constraints and checks seeds against must-have, must-not-use, and complexity ceiling rules.</purpose>
<non-goals>
  <item>Does not score seeds — constraint satisfaction checking only.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>Initial creation: DesignConstraints type, defaultConstraints, normalizeConstraints, checkConstraints.</item>
</CHANGE_SUMMARY>
*/
import type { SystemScale, InformationVisibility, NoveltyTarget } from "./schema.ts";

export interface DesignConstraints {
  must_have: string[];
  must_not_use: string[];
  player_sensation: string[];
  system_scale: SystemScale | null;
  information_visibility: InformationVisibility | null;
  resource_model: string[];
  temporal: string[];
  implementation_complexity_ceiling: number | null;
  novelty_target: NoveltyTarget;
  reference_games: string[];
}

export function defaultConstraints(): DesignConstraints {
  return {
    must_have: [],
    must_not_use: [],
    player_sensation: [],
    system_scale: null,
    information_visibility: null,
    resource_model: [],
    temporal: [],
    implementation_complexity_ceiling: null,
    novelty_target: "recombinatorial",
    reference_games: [],
  };
}

export function normalizeConstraints(raw: Partial<DesignConstraints>): DesignConstraints {
  const defaults = defaultConstraints();
  return {
    must_have: raw.must_have ?? defaults.must_have,
    must_not_use: raw.must_not_use ?? defaults.must_not_use,
    player_sensation: raw.player_sensation ?? defaults.player_sensation,
    system_scale: raw.system_scale ?? defaults.system_scale,
    information_visibility: raw.information_visibility ?? defaults.information_visibility,
    resource_model: raw.resource_model ?? defaults.resource_model,
    temporal: raw.temporal ?? defaults.temporal,
    implementation_complexity_ceiling: raw.implementation_complexity_ceiling ?? defaults.implementation_complexity_ceiling,
    novelty_target: raw.novelty_target ?? defaults.novelty_target,
    reference_games: raw.reference_games ?? defaults.reference_games,
  };
}

export interface ConstraintCheckResult {
  satisfied: string[];
  violated: string[];
}

export function checkConstraints(
  seed: {
    description: string;
    title: string;
    ancestry: { transformations: string[] };
  },
  constraints: DesignConstraints,
): ConstraintCheckResult {
  const satisfied: string[] = [];
  const violated: string[] = [];

  for (const must of constraints.must_have) {
    const text = `${seed.title} ${seed.description} ${seed.ancestry.transformations.join(" ")}`.toLowerCase();
    if (text.includes(must.toLowerCase())) {
      satisfied.push(`must_have: ${must}`);
    } else {
      violated.push(`must_have: ${must}`);
    }
  }

  for (const mustNot of constraints.must_not_use) {
    const text = `${seed.title} ${seed.description} ${seed.ancestry.transformations.join(" ")}`.toLowerCase();
    if (text.includes(mustNot.toLowerCase())) {
      violated.push(`must_not_use: ${mustNot}`);
    } else {
      satisfied.push(`must_not_use: ${mustNot}`);
    }
  }

  if (constraints.implementation_complexity_ceiling !== null) {
    const transformationCount = seed.ancestry.transformations.length;
    if (transformationCount <= constraints.implementation_complexity_ceiling) {
      satisfied.push(`implementation_complexity_ceiling: ${constraints.implementation_complexity_ceiling}`);
    } else {
      violated.push(`implementation_complexity_ceiling: ${constraints.implementation_complexity_ceiling} (got ${transformationCount})`);
    }
  }

  return { satisfied, violated };
}
