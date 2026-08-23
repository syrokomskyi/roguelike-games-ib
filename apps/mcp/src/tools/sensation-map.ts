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

export const SENSATION_MAP: Record<string, SensationEntry> = {
  dread: {
    pressures: ["pressure-risk_of_loss", "pressure-risk_aversion", "pressure-unfairness_risk"],
    primitives: ["design-permadeath", "design-identification_system", "design-procedural_generation"],
    patterns: ["pattern-knowledge_through_risk"],
  },
  tension: {
    pressures: ["pressure-time_pressure", "pressure-resource_scarcity", "pressure-risk_vs_reward"],
    primitives: ["design-permadeath", "design-inventory_management", "design-skill_training"],
    patterns: ["pattern-escalating_threat", "pattern-build_diversity"],
  },
  discovery: {
    pressures: ["pressure-information_asymmetry", "pressure-exploration_tension"],
    primitives: ["design-procedural_generation", "design-identification_system", "design-turn_based_combat"],
    patterns: ["pattern-knowledge_through_risk", "pattern-branch_choice"],
  },
  power_fantasy: {
    pressures: ["pressure-power_curve_tension", "pressure-tactical_diversity"],
    primitives: ["design-skill_training", "design-level_progression", "design-crafting_system"],
    patterns: ["pattern-build_diversity", "pattern-escalating_threat"],
  },
  urgency: {
    pressures: ["pressure-time_pressure", "pressure-resource_scarcity", "pressure-exploration_urgency"],
    primitives: ["design-hunger_clock", "design-procedural_generation", "design-turn_based_combat"],
    patterns: ["pattern-escalating_threat"],
  },
  strategic_depth: {
    pressures: ["pressure-tactical_depth", "pressure-specialization_tradeoff", "pressure-opportunity_cost"],
    primitives: ["design-skill_training", "design-inventory_management", "design-turn_based_combat"],
    patterns: ["pattern-build_diversity", "pattern-asymmetric_combat"],
  },
  mystery: {
    pressures: ["pressure-information_asymmetry", "pressure-cautious_exploration", "pressure-risk_assessment"],
    primitives: ["design-identification_system", "design-procedural_generation", "design-magic_and_spellcasting"],
    patterns: ["pattern-knowledge_through_risk", "pattern-stealth_alternative"],
  },
  greed: {
    pressures: ["pressure-resource_hoarding", "pressure-economic_decision_making", "pressure-risk_vs_reward"],
    primitives: ["design-shop_and_economy", "design-inventory_management", "design-crafting_system"],
    patterns: ["pattern-shop_economy"],
  },
  devotion: {
    pressures: ["pressure-piety_management", "pressure-emotional_attachment"],
    primitives: ["design-religion_and_god", "design-pet_and_companion"],
    patterns: ["pattern-god_relationship"],
  },
  vulnerability: {
    pressures: ["pressure-risk_aversion", "pressure-risk_of_loss", "pressure-cautious_exploration"],
    primitives: ["design-permadeath", "design-stealth_and_awareness", "design-hunger_clock"],
    patterns: ["pattern-save_scum_prevention"],
  },
  creativity: {
    pressures: ["pressure-specialization_tradeoff", "pressure-tactical_diversity"],
    primitives: ["design-crafting_system", "design-magic_and_spellcasting", "design-skill_training"],
    patterns: ["pattern-build_diversity"],
  },
  exploration: {
    pressures: ["pressure-exploration_tension", "pressure-exploration_urgency", "pressure-opportunity_cost"],
    primitives: ["design-procedural_generation", "design-stealth_and_awareness", "design-turn_based_combat"],
    patterns: ["pattern-branch_choice", "pattern-stealth_alternative"],
  },
  survival: {
    pressures: ["pressure-resource_scarcity", "pressure-resource_management", "pressure-risk_of_loss"],
    primitives: ["design-hunger_clock", "design-crafting_system", "design-inventory_management"],
    patterns: ["pattern-escalating_threat", "pattern-corpse_economy"],
  },
  mastery: {
    pressures: ["pressure-tactical_depth", "pressure-analysis_paralysis", "pressure-specialization_tradeoff"],
    primitives: ["design-skill_training", "design-turn_based_combat", "design-stealth_and_awareness"],
    patterns: ["pattern-asymmetric_combat"],
  },
  tradeoff: {
    pressures: ["pressure-opportunity_cost", "pressure-economic_decision_making", "pressure-specialization_tradeoff"],
    primitives: ["design-shop_and_economy", "design-inventory_management", "design-skill_training"],
    patterns: ["pattern-shop_economy", "pattern-build_diversity"],
  },
};
