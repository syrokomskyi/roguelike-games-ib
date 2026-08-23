/*
<MODULE_CONTRACT>
<purpose>Curated mapping of game design sensations to relevant concept keys (pressures, primitives, patterns) for the AI design seed generator (RFC-0013).</purpose>
<non-goals>
  <item>Does not perform concept lookup — only stores the mapping.</item>
  <item>Does not handle fallback for unknown sensations — that is the tool's responsibility.</item>
</non-goals>
</MODULE_CONTRACT>
<CHANGE_SUMMARY>
  <item>RFC-0013: Initial creation with 15 verified sensation entries.</item>
</CHANGE_SUMMARY>
*/

export interface SensationEntry {
  pressures: string[];
  primitives: string[];
  patterns: string[];
}

const P = "cross-game/concept/";

export const SENSATION_MAP: Record<string, SensationEntry> = {
  dread: {
    pressures: [`${P}pressure-risk_of_loss`, `${P}pressure-risk_aversion`, `${P}pressure-unfairness_risk`],
    primitives: [`${P}design-permadeath`, `${P}design-identification_system`, `${P}design-procedural_generation`],
    patterns: [`${P}pattern-knowledge_through_risk`],
  },
  tension: {
    pressures: [`${P}pressure-time_pressure`, `${P}pressure-resource_scarcity`, `${P}pressure-risk_vs_reward`],
    primitives: [`${P}design-permadeath`, `${P}design-inventory_management`, `${P}design-skill_training`],
    patterns: [`${P}pattern-escalating_threat`, `${P}pattern-build_diversity`],
  },
  discovery: {
    pressures: [`${P}pressure-information_asymmetry`, `${P}pressure-exploration_tension`],
    primitives: [`${P}design-procedural_generation`, `${P}design-identification_system`, `${P}design-turn_based_combat`],
    patterns: [`${P}pattern-knowledge_through_risk`, `${P}pattern-branch_choice`],
  },
  power_fantasy: {
    pressures: [`${P}pressure-power_curve_tension`, `${P}pressure-tactical_diversity`],
    primitives: [`${P}design-skill_training`, `${P}design-level_progression`, `${P}design-crafting_system`],
    patterns: [`${P}pattern-build_diversity`, `${P}pattern-escalating_threat`],
  },
  urgency: {
    pressures: [`${P}pressure-time_pressure`, `${P}pressure-resource_scarcity`, `${P}pressure-exploration_urgency`],
    primitives: [`${P}design-hunger_clock`, `${P}design-procedural_generation`, `${P}design-turn_based_combat`],
    patterns: [`${P}pattern-escalating_threat`],
  },
  strategic_depth: {
    pressures: [`${P}pressure-tactical_depth`, `${P}pressure-specialization_tradeoff`, `${P}pressure-opportunity_cost`],
    primitives: [`${P}design-skill_training`, `${P}design-inventory_management`, `${P}design-turn_based_combat`],
    patterns: [`${P}pattern-build_diversity`, `${P}pattern-asymmetric_combat`],
  },
  mystery: {
    pressures: [`${P}pressure-information_asymmetry`, `${P}pressure-cautious_exploration`, `${P}pressure-risk_assessment`],
    primitives: [`${P}design-identification_system`, `${P}design-procedural_generation`, `${P}design-magic_and_spellcasting`],
    patterns: [`${P}pattern-knowledge_through_risk`, `${P}pattern-stealth_alternative`],
  },
  greed: {
    pressures: [`${P}pressure-resource_hoarding`, `${P}pressure-economic_decision_making`, `${P}pressure-risk_vs_reward`],
    primitives: [`${P}design-shop_and_economy`, `${P}design-inventory_management`, `${P}design-crafting_system`],
    patterns: [`${P}pattern-shop_economy`],
  },
  devotion: {
    pressures: [`${P}pressure-piety_management`, `${P}pressure-emotional_attachment`],
    primitives: [`${P}design-religion_and_god`, `${P}design-pet_and_companion`],
    patterns: [`${P}pattern-god_relationship`],
  },
  vulnerability: {
    pressures: [`${P}pressure-risk_aversion`, `${P}pressure-risk_of_loss`, `${P}pressure-cautious_exploration`],
    primitives: [`${P}design-permadeath`, `${P}design-stealth_and_awareness`, `${P}design-hunger_clock`],
    patterns: [`${P}pattern-save_scum_prevention`],
  },
  creativity: {
    pressures: [`${P}pressure-specialization_tradeoff`, `${P}pressure-tactical_diversity`],
    primitives: [`${P}design-crafting_system`, `${P}design-magic_and_spellcasting`, `${P}design-skill_training`],
    patterns: [`${P}pattern-build_diversity`],
  },
  exploration: {
    pressures: [`${P}pressure-exploration_tension`, `${P}pressure-exploration_urgency`, `${P}pressure-opportunity_cost`],
    primitives: [`${P}design-procedural_generation`, `${P}design-stealth_and_awareness`, `${P}design-turn_based_combat`],
    patterns: [`${P}pattern-branch_choice`, `${P}pattern-stealth_alternative`],
  },
  survival: {
    pressures: [`${P}pressure-resource_scarcity`, `${P}pressure-resource_management`, `${P}pressure-risk_of_loss`],
    primitives: [`${P}design-hunger_clock`, `${P}design-crafting_system`, `${P}design-inventory_management`],
    patterns: [`${P}pattern-escalating_threat`, `${P}pattern-corpse_economy`],
  },
  mastery: {
    pressures: [`${P}pressure-tactical_depth`, `${P}pressure-analysis_paralysis`, `${P}pressure-specialization_tradeoff`],
    primitives: [`${P}design-skill_training`, `${P}design-turn_based_combat`, `${P}design-stealth_and_awareness`],
    patterns: [`${P}pattern-asymmetric_combat`],
  },
  tradeoff: {
    pressures: [`${P}pressure-opportunity_cost`, `${P}pressure-economic_decision_making`, `${P}pressure-specialization_tradeoff`],
    primitives: [`${P}design-shop_and_economy`, `${P}design-inventory_management`, `${P}design-skill_training`],
    patterns: [`${P}pattern-shop_economy`, `${P}pattern-build_diversity`],
  },
};
