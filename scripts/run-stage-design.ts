import {
  createRecordId,
  preparePromotion,
  applyPromotionTransaction,
  type TransactionOperation,
} from "../packages/knowledge-core/src/index.ts";
import { readCanonicalState } from "../packages/materializer/src/index.ts";
import { join } from "node:path";
import { existsSync, rmSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

const WORKSPACE = "/home/syrokomskyi/projects/roguelike-games-ib";
const CANONICAL_ROOT = join(WORKSPACE, "knowledge");
const STAGING_ROOT = join(WORKSPACE, "staging");

const RUN_ID = "design-run-001";
const ACTOR_ID = "design-primitives";
const PATTERN_ACTOR_ID = "design-patterns";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 60);
}

function makeConceptEnvelope(key: string, id: string) {
  return {
    schema: "rgkb/concept@2",
    id,
    key,
    record_type: "concept",
    language: "en",
    scope: { source_id: "cross-game", scope_kind: "cross_game" as const },
    origin: { kind: "derived" as const, actor_id: ACTOR_ID, run_id: RUN_ID },
    epistemic: { status: "observed" as const, confidence: "inferred" as const },
    aliases: [] as string[],
  };
}

function makeRelationEnvelope(key: string, id: string, relationType: string, sourceId: string, targetId: string, scope: string, qualifiers: Record<string, unknown>, evidenceRefs: string[] = []) {
  return {
    schema: "rgkb/relation@2",
    id,
    key,
    record_type: "relation",
    language: "en",
    scope: { source_id: "cross-game", scope_kind: "cross_game" as const },
    origin: { kind: "derived" as const, actor_id: ACTOR_ID, run_id: RUN_ID },
    epistemic: { status: "observed" as const, confidence: "inferred" as const },
    aliases: [] as string[],
    relation_type: relationType,
    source_record_id: sourceId,
    target_record_id: targetId,
    relation_scope: scope,
    evidence_refs: evidenceRefs,
    qualifiers,
  };
}

function makePatternConceptEnvelope(key: string, id: string) {
  return {
    ...makeConceptEnvelope(key, id),
    origin: { kind: "derived" as const, actor_id: PATTERN_ACTOR_ID, run_id: RUN_ID },
  };
}

function makePatternRelationEnvelope(key: string, id: string, relationType: string, sourceId: string, targetId: string, scope: string, qualifiers: Record<string, unknown>, evidenceRefs: string[] = []) {
  return {
    ...makeRelationEnvelope(key, id, relationType, sourceId, targetId, scope, qualifiers, evidenceRefs),
    origin: { kind: "derived" as const, actor_id: PATTERN_ACTOR_ID, run_id: RUN_ID },
  };
}

function loadEnv() {
  const envPath = join(WORKSPACE, ".env");
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, "utf-8").split("\n")) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m && !process.env[m[1].trim()]) process.env[m[1].trim()] = m[2].trim();
    }
  }
}
loadEnv();

const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
const LLM_MODEL = "gpt-4o-mini";
let llmCallCount = 0;
let llmTotalCalls = 0;

const CACHE_DIR = join(WORKSPACE, "systems-cache");
const CACHE_PATH = join(CACHE_DIR, "llm-design-cache.json");
let llmCache: Record<string, string> = {};
function loadCache() {
  if (existsSync(CACHE_PATH)) {
    try { llmCache = JSON.parse(readFileSync(CACHE_PATH, "utf-8")); } catch { llmCache = {}; }
  }
}
function saveCache() {
  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(CACHE_PATH, JSON.stringify(llmCache, null, 2));
}
function hashKey(s: string) { return createHash("md5").update(s).digest("hex"); }

async function llm(prompt: string): Promise<string> {
  const k = hashKey(prompt);
  if (llmCache[k]) return llmCache[k];
  llmCallCount++;
  console.log(`  [LLM ${llmCallCount}/${llmTotalCalls}] calling ${LLM_MODEL} (cache: miss)...`);
  const result = await generateText({ model: openai(LLM_MODEL), prompt, temperature: 0.7 });
  llmCache[k] = result.text;
  saveCache();
  return result.text;
}

async function llmJson<T>(prompt: string): Promise<T> {
  const text = await llm(prompt + "\n\nRespond with valid JSON only, no markdown fences.");
  const cleaned = text.replace(/^```json?\n?/g, "").replace(/\n?```$/g, "").trim();
  return JSON.parse(cleaned) as T;
}

function findRecordsByKeywords(state: { records: any[] }, keywords: string[], limit = 5): string[] {
  const matches: { id: string; score: number }[] = [];
  for (const record of state.records) {
    if (record.record_type !== "definition") continue;
    const name = String((record as any).name?.canonical || (record as any).name || record.key || "").toLowerCase();
    let score = 0;
    for (const kw of keywords) {
      if (name.includes(kw.toLowerCase())) score++;
    }
    if (score > 0) matches.push({ id: record.id, score });
  }
  return matches.sort((a, b) => b.score - a.score).slice(0, limit).map(m => m.id);
}

function getGameKinds(state: { records: any[] }, game: string): { kind: string; count: number }[] {
  const kindCounts = new Map<string, number>();
  for (const record of state.records) {
    if (record.record_type !== "definition") continue;
    const sid = record.source_identity?.source_id ?? "";
    if (sid !== game) continue;
    const kind = record.kind ?? "unknown";
    kindCounts.set(kind, (kindCounts.get(kind) ?? 0) + 1);
  }
  return [...kindCounts.entries()]
    .map(([kind, count]) => ({ kind, count }))
    .sort((a, b) => b.count - a.count);
}

function getRecordsByKind(state: { records: any[] }, game: string, kind: string, limit = 50): { id: string; name: string }[] {
  const results: { id: string; name: string }[] = [];
  for (const record of state.records) {
    if (record.record_type !== "definition") continue;
    const sid = record.source_identity?.source_id ?? "";
    if (sid !== game) continue;
    if ((record.kind ?? "unknown") !== kind) continue;
    const name = String(record.name?.canonical || record.name || record.key || "");
    results.push({ id: record.id, name });
    if (results.length >= limit) break;
  }
  return results;
}

const PRIMITIVE_KIND_MAP: Record<string, string[]> = {
  permadeath: ["creature"],
  procedural_generation: ["vault", "branch"],
  inventory_management: ["item"],
  turn_based_combat: ["creature"],
  identification_system: ["item", "spell", "potion", "scroll"],
  hunger_clock: ["item", "food"],
  stealth_and_awareness: ["creature", "effect"],
  shop_and_economy: ["item"],
  pet_and_companion: ["creature"],
  religion_and_god: ["deity", "god"],
  level_progression: ["species", "profession", "role", "race"],
  magic_and_spellcasting: ["spell", "ability", "mutation"],
  crafting_system: ["recipe", "item", "bionic"],
  skill_training: ["skill", "ability"],
  // Aliases used by DESIGN_PATTERNS member_primitives
  character_progression: ["species", "profession", "role", "race"],
  skill_progression: ["skill", "ability"],
};

async function matchPrimitiveToGame(
  state: { records: any[] },
  primitive: { slug: string; title: string; definition: string },
  game: string,
): Promise<string[]> {
  const gameKinds = new Set(getGameKinds(state, game).map(k => k.kind));
  if (gameKinds.size === 0) return [];

  const targetKinds = (PRIMITIVE_KIND_MAP[primitive.slug] ?? []).filter(k => gameKinds.has(k));
  if (targetKinds.length === 0) return [];

  const allRefs: string[] = [];
  for (const kind of targetKinds) {
    const records = getRecordsByKind(state, game, kind, 10);
    allRefs.push(...records.map(r => r.id));
  }
  return allRefs;
}

async function matchPatternToGame(
  state: { records: any[] },
  pattern: { slug: string; title: string; definition: string; member_primitives: string[] },
  game: string,
  _primitiveTitles: Map<string, string>,
): Promise<string[]> {
  const gameKinds = new Set(getGameKinds(state, game).map(k => k.kind));
  if (gameKinds.size === 0) return [];

  // Collect relevant kinds from all member primitives
  const targetKinds = new Set<string>();
  for (const memberSlug of pattern.member_primitives) {
    for (const kind of PRIMITIVE_KIND_MAP[memberSlug] ?? []) {
      if (gameKinds.has(kind)) targetKinds.add(kind);
    }
  }
  if (targetKinds.size === 0) return [];

  const allRefs: string[] = [];
  for (const kind of targetKinds) {
    const records = getRecordsByKind(state, game, kind, 5);
    allRefs.push(...records.map(r => r.id));
  }
  return allRefs;
}

function makeEvidenceEnvelope(key: string, id: string) {
  return {
    schema: "rgkb/evidence@2",
    id,
    key,
    record_type: "evidence",
    language: "en",
    scope: { source_id: "cross-game", scope_kind: "cross_game" as const },
    origin: { kind: "curated" as const, actor_id: ACTOR_ID, run_id: RUN_ID },
    epistemic: { status: "observed" as const, confidence: "inferred" as const },
    aliases: [] as string[],
    record_id: null,
    anchor: {
      artifact_path: "docs/plans/plan-003-knowledge-base-enrichment.md",
      locator: {
        symbol: "PLAN-003",
        line_start: 1,
        line_end: 234,
        byte_start: null,
        byte_end: null,
        data_key: "design-primitives",
      },
    },
  };
}

function cleanDesignData() {
  const conceptDir = join(CANONICAL_ROOT, "concept");
  if (!existsSync(conceptDir)) return;
  let removed = 0;
  const actorsToClean = new Set([ACTOR_ID, PATTERN_ACTOR_ID]);
  function walkAndClean(dirPath: string) {
    const entries = readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const childPath = join(dirPath, entry.name);
      if (entry.isDirectory()) {
        walkAndClean(childPath);
        try {
          if (readdirSync(childPath).length === 0) rmSync(childPath, { recursive: true });
        } catch { /* not empty */ }
      } else if (entry.isFile() && entry.name.endsWith(".jsonl")) {
        try {
          const raw = readFileSync(childPath, "utf-8");
          const d = JSON.parse(raw);
          const actorId = d?.origin?.actor_id ?? "";
          if (actorsToClean.has(actorId)) {
            rmSync(childPath);
            removed++;
          }
        } catch { /* skip */ }
      }
    }
  }
  walkAndClean(conceptDir);
  // Also clean relations from these actors
  const relDir = join(CANONICAL_ROOT, "relation");
  if (existsSync(relDir)) {
    function walkAndCleanRels(dirPath: string) {
      const entries = readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const childPath = join(dirPath, entry.name);
        if (entry.isDirectory()) {
          walkAndCleanRels(childPath);
          try {
            if (readdirSync(childPath).length === 0) rmSync(childPath, { recursive: true });
          } catch { /* not empty */ }
        } else if (entry.isFile() && entry.name.endsWith(".jsonl")) {
          try {
            const raw = readFileSync(childPath, "utf-8");
            const d = JSON.parse(raw);
            const actorId = d?.origin?.actor_id ?? "";
            if (actorsToClean.has(actorId)) {
              rmSync(childPath);
              removed++;
            }
          } catch { /* skip */ }
        }
      }
    }
    walkAndCleanRels(relDir);
  }
  if (removed > 0) console.log(`Cleaned ${removed} previous design files from ${ACTOR_ID} and ${PATTERN_ACTOR_ID}`);
}

interface DesignPrimitive {
  slug: string;
  title: string;
  definition: string;
  concept_type: string;
  inclusion_criteria: string[];
  exclusion_criteria: string[];
  mutation_dimensions: string[];
  pressures: string[];
}

const DESIGN_PRIMITIVES: DesignPrimitive[] = [
  {
    slug: "permadeath",
    title: "Permadeath",
    definition: "A game mechanic where character death is permanent — the player loses all progress and must start a new game. This creates extreme stakes for every decision and fundamentally shapes the risk/reward calculus of gameplay.",
    concept_type: "design_primitive",
    inclusion_criteria: [
      "Character death results in permanent loss of the character",
      "No respawn or continue option after death",
      "Progress (items, levels, map knowledge) is lost on death",
      "Player must start a new game after death",
    ],
    exclusion_criteria: [
      "Games with respawn mechanics or extra lives",
      "Save-scumming as an intended mechanic",
      "Temporary death with resurrection",
    ],
    mutation_dimensions: ["death_finality", "progression_retention", "meta_progression", "death_frequency"],
    pressures: ["risk_aversion", "resource_hoarding", "cautious_exploration"],
  },
  {
    slug: "procedural_generation",
    title: "Procedural Generation",
    definition: "A game mechanic where game content (levels, items, monsters, maps) is generated algorithmically rather than hand-designed. This creates unique playthroughs and high replayability but reduces designer control over specific experiences.",
    concept_type: "design_primitive",
    inclusion_criteria: [
      "Game levels or maps are generated by algorithms",
      "Each playthrough produces different content layouts",
      "Content generation uses random seeds with deterministic algorithms",
      "Player cannot predict exact layout before exploration",
    ],
    exclusion_criteria: [
      "Fixed/pre-designed levels without randomization",
      "Cosmetic randomization that doesn't affect gameplay",
      "Player-created content (not procedural)",
    ],
    mutation_dimensions: ["generation_algorithm", "randomness_degree", "content_variety", "seed_control"],
    pressures: ["exploration_tension", "adaptation_requirement", "unfairness_risk"],
  },
  {
    slug: "inventory_management",
    title: "Inventory Management",
    definition: "A game system where players must manage limited inventory space, creating strategic decisions about what to carry, what to discard, and what to prioritize. Inventory constraints create tension between exploration preparedness and loot acquisition.",
    concept_type: "design_primitive",
    inclusion_criteria: [
      "Player has finite inventory capacity",
      "Items take up space in inventory",
      "Player must choose which items to carry vs discard",
      "Inventory limits create strategic trade-offs",
    ],
    exclusion_criteria: [
      "Unlimited inventory with no capacity constraints",
      "Inventory that is purely cosmetic without gameplay impact",
      "Crafting-only systems without carry limits",
    ],
    mutation_dimensions: ["capacity_limit", "stacking_rules", "weight_system", "container_nesting"],
    pressures: ["resource_scarcity", "decision_paralysis", "opportunity_cost"],
  },
  {
    slug: "turn_based_combat",
    title: "Turn-Based Combat",
    definition: "A combat system where actions are resolved in discrete turns, giving players unlimited time to consider each action. This creates a tactical puzzle-solving experience rather than a reflex-based one.",
    concept_type: "design_primitive",
    inclusion_criteria: [
      "Combat actions are resolved in discrete turns",
      "Player has unlimited time to decide each action",
      "Action order is deterministic or queue-based",
      "Positioning and timing within turn order matters",
    ],
    exclusion_criteria: [
      "Real-time combat with action clocks",
      "Combat where reflexes matter more than strategy",
      "Simultaneous resolution without turn structure",
    ],
    mutation_dimensions: ["action_points", "turn_order", "simultaneous_actions", "interrupt_mechanics"],
    pressures: ["tactical_depth", "analysis_paralysis", "pacing_tension"],
  },
  {
    slug: "identification_system",
    title: "Item Identification System",
    definition: "A game mechanic where items must be identified before their properties are known. This creates information asymmetry and risk — using an unknown item may be beneficial or harmful. Identification consumes resources or creates gameplay decisions.",
    concept_type: "design_primitive",
    inclusion_criteria: [
      "Items have unknown properties until identified",
      "Identification requires resources, spells, or actions",
      "Using unidentified items carries risk",
      "Identification creates strategic decisions (identify now vs later)",
    ],
    exclusion_criteria: [
      "Items with always-visible properties",
      "Identification that is free and instantaneous",
      "Items that are purely cosmetic without hidden properties",
    ],
    mutation_dimensions: ["identification_cost", "identification_methods", "risk_of_use", "curse_mechanics"],
    pressures: ["information_asymmetry", "resource_scarcity", "risk_assessment"],
  },
  {
    slug: "hunger_clock",
    title: "Hunger Clock",
    definition: "A game mechanic that imposes a time pressure on the player through a hunger, food, or deterioration system. The player must find sustenance or resources periodically, preventing indefinite stalling and forcing exploration.",
    concept_type: "design_primitive",
    inclusion_criteria: [
      "Player has a depleting resource (hunger, food, light, fuel)",
      "Resource must be replenished periodically",
      "Resource depletion causes negative effects or death",
      "Creates time pressure preventing indefinite stalling",
    ],
    exclusion_criteria: [
      "Games without any time pressure mechanic",
      "Optional food/healing that doesn't create pressure",
      "Purely cosmetic hunger without gameplay consequences",
    ],
    mutation_dimensions: ["depletion_rate", "replenishment_difficulty", "penalty_severity", "resource_abundance"],
    pressures: ["time_pressure", "resource_scarcity", "exploration_urgency"],
  },
  {
    slug: "stealth_and_awareness",
    title: "Stealth and Awareness System",
    definition: "A game mechanic where visibility and detection affect gameplay — creatures can be aware or unaware of the player, and stealth tactics can avoid or delay combat. Line-of-sight, lighting, and noise create tactical depth.",
    concept_type: "design_primitive",
    inclusion_criteria: [
      "Creatures have awareness states (asleep, awake, alerted)",
      "Player can avoid detection through stealth",
      "Line-of-sight or lighting affects visibility",
      "Stealth creates tactical options beyond direct combat",
    ],
    exclusion_criteria: [
      "Games where all creatures are always aware of the player",
      "Pure combat games without stealth options",
      "Visibility that is purely cosmetic",
    ],
    mutation_dimensions: ["detection_range", "alertness_persistence", "stealth_methods", "lighting_impact"],
    pressures: ["information_asymmetry", "positional_advantage", "risk_vs_reward"],
  },
  {
    slug: "shop_and_economy",
    title: "Shop and Economy System",
    definition: "A game mechanic where players can buy and sell items with NPCs or at shops using currency. This creates strategic decisions about resource allocation, price evaluation, and opportunity cost — items found in the dungeon can be sold for currency or used immediately.",
    concept_type: "design_primitive",
    inclusion_criteria: [
      "NPCs or locations where items can be purchased with currency",
      "Items can be sold for currency",
      "Currency has scarcity and must be managed",
      "Shop inventory is limited or randomized",
    ],
    exclusion_criteria: [
      "Free item distribution without currency",
      "Crafting-only economies without buy/sell mechanics",
      "Cosmetic shops without gameplay impact",
    ],
    mutation_dimensions: ["currency_scarcity", "price_variation", "shop_inventory_size", "restocking_mechanics"],
    pressures: ["economic_decision_making", "opportunity_cost", "resource_scarcity"],
  },
  {
    slug: "pet_and_companion",
    title: "Pet and Companion System",
    definition: "A game mechanic where players can tame, recruit, or start with companion creatures that assist in combat, exploration, or utility. Companions add strategic depth through management of another entity but also create emotional attachment and risk.",
    concept_type: "design_primitive",
    inclusion_criteria: [
      "Player can acquire companion creatures that follow and assist",
      "Companions participate in combat or exploration",
      "Companions can die or be lost, creating emotional stakes",
      "Companion management requires player attention or resources",
    ],
    exclusion_criteria: [
      "Summoned creatures that exist for a single turn only",
      "NPCs that fight alongside player as scripted events",
      "Mounts that are purely cosmetic",
    ],
    mutation_dimensions: ["companion_count", "companion_loyalty", "companion_growth", "companion_control_level"],
    pressures: ["emotional_attachment", "micro_management", "risk_of_loss"],
  },
  {
    slug: "religion_and_god",
    title: "Religion and God System",
    definition: "A game mechanic where players can worship deities or follow religious paths that grant favors, powers, or restrictions. The relationship with a god creates a strategic contract — piety is earned through specific actions and lost through prohibited ones.",
    concept_type: "design_primitive",
    inclusion_criteria: [
      "Player can worship or dedicate to a deity",
      "Piety or favor is tracked and changes based on player actions",
      "Gods grant powers, gifts, or penalties based on favor level",
      "Religious restrictions create behavioral constraints",
    ],
    exclusion_criteria: [
      "Static buffs not tied to a deity relationship",
      "Religion that is purely narrative without gameplay mechanics",
      "One-time divine intervention without ongoing relationship",
    ],
    mutation_dimensions: ["piety_mechanics", "god_diversity", "favor_rewards", "penalty_severity"],
    pressures: ["behavioral_constraint", "piety_management", "opportunity_cost"],
  },
  {
    slug: "level_progression",
    title: "Level Progression System",
    definition: "A game mechanic where character power increases through experience points and leveling. This creates a progression curve that rewards exploration and combat, while also gating content and creating power asymmetry between the player and dungeon threats.",
    concept_type: "design_primitive",
    inclusion_criteria: [
      "Character gains experience points from actions (combat, exploration)",
      "Experience accumulation leads to level increases",
      "Leveling grants tangible power increases (HP, stats, abilities)",
      "Progression curve creates risk/reward decisions about engaging threats",
    ],
    exclusion_criteria: [
      "Games without character progression",
      "Progression through item acquisition only (no XP/level system)",
      "Pure skill-based progression without level structure",
    ],
    mutation_dimensions: ["xp_curve", "level_cap", "stat_gains_per_level", "ability_unlock_schedule"],
    pressures: ["power_curve_tension", "grind_incentive", "risk_vs_reward"],
  },
  {
    slug: "magic_and_spellcasting",
    title: "Magic and Spellcasting System",
    definition: "A game mechanic where players can learn and cast spells that consume resources (mana, spell slots, hunger, etc.). Magic provides powerful tactical options but creates resource management decisions about when and what to cast.",
    concept_type: "design_primitive",
    inclusion_criteria: [
      "Player can learn or acquire spells",
      "Casting spells consumes a resource (mana, spell slots, hunger, etc.)",
      "Spells provide tactical options not available through melee/ranged combat",
      "Spell selection creates strategic loadout decisions",
    ],
    exclusion_criteria: [
      "Innate abilities that don't consume resources",
      "Consumable-only items without a spell system",
      "Magic that is purely cosmetic without gameplay impact",
    ],
    mutation_dimensions: ["resource_type", "spell_diversity", "learning_method", "failure_mechanics"],
    pressures: ["resource_management", "tactical_diversity", "specialization_tradeoff"],
  },
  {
    slug: "crafting_system",
    title: "Crafting System",
    definition: "A game mechanic where players combine raw materials and tools to create new items, equipment, or consumables. Crafting transforms found resources into useful items, creating strategic decisions about material gathering, recipe learning, and production prioritization.",
    concept_type: "design_primitive",
    inclusion_criteria: [
      "Players can combine materials to create new items",
      "Recipes or blueprints define valid combinations",
      "Crafting requires specific tools or workstations",
      "Material scarcity creates production prioritization decisions",
    ],
    exclusion_criteria: [
      "Item enhancement without combination mechanics",
      "Automatic item generation without player input",
      "Crafting that is purely cosmetic without gameplay impact",
    ],
    mutation_dimensions: ["recipe_complexity", "material_diversity", "tool_requirements", "skill_gating"],
    pressures: ["resource_scarcity", "production_planning", "specialization_tradeoff"],
  },
  {
    slug: "skill_training",
    title: "Skill Training System",
    definition: "A game mechanic where individual skills improve through use rather than automatic level-up gains. This creates an organic progression where the character becomes better at what the player actually does, encouraging specialized builds and repeated practice.",
    concept_type: "design_primitive",
    inclusion_criteria: [
      "Skills improve through repeated use (use-based progression)",
      "Skill levels affect effectiveness of related actions",
      "Skill training takes time, creating opportunity costs",
      "Skill caps or diminishing returns prevent maxing everything",
    ],
    exclusion_criteria: [
      "Skills that only improve via level-up allocation",
      "Binary skill system (have/don't have) without progression",
      "Skills that are purely cosmetic without gameplay impact",
    ],
    mutation_dimensions: ["training_speed", "skill_cap", "transfer_mechanics", "decay_mechanics"],
    pressures: ["specialization_tradeoff", "time_investment", "adaptation_requirement"],
  },
];

interface DesignPattern {
  slug: string;
  title: string;
  definition: string;
  member_primitives: string[];
  member_pressures: string[];
  games_where_present: string[];
  games_where_absent: string[];
  failure_mode_links: { primitive_slug: string; failure_mode_slug: string; trigger_conditions: string }[];
}

const DESIGN_PATTERNS: DesignPattern[] = [
  {
    slug: "knowledge_through_risk",
    title: "Knowledge Through Risk",
    definition: "A design pattern where procedural generation creates unknown items, and the player must risk using them to learn their properties. The tension between curiosity and survival drives engagement.",
    member_primitives: ["procedural_generation", "identification_system", "permadeath"],
    member_pressures: ["information_scarcity", "consequence_persistence"],
    games_where_present: ["nethack", "broguece", "crawl"],
    games_where_absent: ["cataclysm-bn"],
    failure_mode_links: [
      { primitive_slug: "identification_system", failure_mode_slug: "degenerate", trigger_conditions: "When identification is too expensive and permadeath is harsh, players avoid all unidentified items, reducing build diversity." },
    ],
  },
  {
    slug: "build_diversity",
    title: "Build Diversity",
    definition: "A design pattern where species, profession, and skill progression combine to create distinct character builds. Each build offers unique playstyles and strategic approaches.",
    member_primitives: ["character_progression", "skill_progression"],
    member_pressures: ["specialization_tradeoff", "adaptation_requirement"],
    games_where_present: ["nethack", "crawl", "cataclysm-bn"],
    games_where_absent: ["broguece"],
    failure_mode_links: [],
  },
  {
    slug: "escalating_threat",
    title: "Escalating Threat",
    definition: "A design pattern where depth scaling, resource scarcity, and permadeath combine to create increasing pressure as the player descends. Each level deeper raises the stakes.",
    member_primitives: ["permadeath", "procedural_generation"],
    member_pressures: ["risk_aversion", "resource_scarcity"],
    games_where_present: ["nethack", "broguece", "crawl", "cataclysm-bn"],
    games_where_absent: [],
    failure_mode_links: [
      { primitive_slug: "permadeath", failure_mode_slug: "degenerate", trigger_conditions: "When depth scaling is too steep and permadeath is harsh, players adopt overly conservative playstyles, reducing engagement." },
    ],
  },
  {
    slug: "shop_economy",
    title: "Shop Economy",
    definition: "A design pattern where currency, item durability, and procedural generation create a trading economy. Players must decide when to buy, sell, and invest in equipment.",
    member_primitives: ["inventory_management", "procedural_generation"],
    member_pressures: ["resource_scarcity", "opportunity_cost"],
    games_where_present: ["nethack", "crawl", "cataclysm-bn"],
    games_where_absent: ["broguece"],
    failure_mode_links: [],
  },
  {
    slug: "god_relationship",
    title: "God Relationship",
    definition: "A design pattern where religion, piety, and alignment systems create a relationship with divine entities. Players must balance worship costs against divine rewards.",
    member_primitives: ["character_progression", "religion_and_god"],
    member_pressures: ["consequence_persistence"],
    games_where_present: ["nethack", "crawl", "cataclysm-bn"],
    games_where_absent: ["broguece"],
    failure_mode_links: [],
  },
  {
    slug: "corpse_economy",
    title: "Corpse Economy",
    definition: "A design pattern where corpse mechanics, nutrition, and mutation systems create a resource loop from defeated enemies. Corpses become food, mutation sources, or sacrifice material.",
    member_primitives: ["inventory_management", "procedural_generation"],
    member_pressures: ["resource_scarcity"],
    games_where_present: ["nethack", "crawl", "cataclysm-bn"],
    games_where_absent: ["broguece"],
    failure_mode_links: [],
  },
  {
    slug: "stealth_alternative",
    title: "Stealth Alternative",
    definition: "A design pattern where stealth, evasion, and information gathering combine to offer a non-combat playstyle. Players can avoid direct confrontation through careful positioning and awareness.",
    member_primitives: ["turn_based_combat", "procedural_generation"],
    member_pressures: ["tactical_depth"],
    games_where_present: ["nethack", "crawl", "cataclysm-bn"],
    games_where_absent: ["broguece"],
    failure_mode_links: [],
  },
  {
    slug: "save_scum_prevention",
    title: "Save Scum Prevention",
    definition: "A design pattern where permadeath and save system restrictions prevent save-scumming. This creates genuine stakes and forces players to accept consequences of their decisions.",
    member_primitives: ["permadeath"],
    member_pressures: ["consequence_persistence", "risk_aversion"],
    games_where_present: ["nethack", "broguece", "crawl", "cataclysm-bn"],
    games_where_absent: [],
    failure_mode_links: [],
  },
  {
    slug: "branch_choice",
    title: "Branch Choice",
    definition: "A design pattern where dungeon branches, risk-reward trade-offs, and progression gating create strategic routing decisions. Players choose which areas to explore based on their build and risk tolerance.",
    member_primitives: ["procedural_generation", "permadeath"],
    member_pressures: ["risk_aversion", "opportunity_cost"],
    games_where_present: ["nethack", "crawl", "cataclysm-bn"],
    games_where_absent: ["broguece"],
    failure_mode_links: [],
  },
  {
    slug: "asymmetric_combat",
    title: "Asymmetric Combat",
    definition: "A design pattern where turn-based combat, action points, and tactical positioning create a puzzle-like combat experience. Each encounter is a spatial-temporal problem to solve.",
    member_primitives: ["turn_based_combat"],
    member_pressures: ["tactical_depth", "analysis_paralysis"],
    games_where_present: ["nethack", "broguece", "crawl", "cataclysm-bn"],
    games_where_absent: [],
    failure_mode_links: [
      { primitive_slug: "turn_based_combat", failure_mode_slug: "degenerate", trigger_conditions: "When combat is too complex and analysis paralysis sets in, players spend excessive time on trivial encounters, reducing pacing." },
    ],
  },
];

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.warn("WARNING: OPENAI_API_KEY not found in environment. LLM calls will fail and fall back to defaults.");
  }

  console.log("Cleaning previous design data...");
  cleanDesignData();
  loadCache();

  // Estimate total LLM calls for progress reporting
  const totalDims = DESIGN_PRIMITIVES.reduce((sum, dp) => sum + dp.mutation_dimensions.length, 0);
  const matchingCalls = DESIGN_PRIMITIVES.length * 4 * 3 + DESIGN_PATTERNS.length * 3 * 3; // Step A + Step B (avg 2-3 kinds) for primitives + patterns
  llmTotalCalls = totalDims * 2 + 34 + DESIGN_PRIMITIVES.length + DESIGN_PRIMITIVES.length * 4 + matchingCalls; // vectors + knobs + counterplay + failure modes + concrete examples + matching

  console.log("Reading canonical state...");
  const state = readCanonicalState(CANONICAL_ROOT);
  console.log(`Found ${state.records.length} records`);

  // Find existing concept records to link to
  const existingConcepts = state.records.filter((r) => r.record_type === "concept");
  console.log(`Found ${existingConcepts.length} existing concepts`);

  const concepts: any[] = [];
  const relations: any[] = [];
  const evidenceList: any[] = [];

  // Create one evidence record for the design analysis
  const designEvId = createRecordId();
  const designEvKey = `cross-game/evidence/design-analysis`;
  evidenceList.push({
    ...makeEvidenceEnvelope(designEvKey, designEvId),
  });

  // Track concept IDs by key for relation creation
  const pressureConceptIds = new Map<string, string>();
  const primitiveConceptIds = new Map<string, string>();
  const mutationVectorIds = new Map<string, string>();

  // Create design primitive concepts
  for (const dp of DESIGN_PRIMITIVES) {
    const conceptId = createRecordId();
    const key = `cross-game/concept/design-${dp.slug}`;

    primitiveConceptIds.set(dp.slug, conceptId);

    concepts.push({
      ...makeConceptEnvelope(key, conceptId),
      concept_type: dp.concept_type,
      title: dp.title,
      definition: dp.definition,
      inclusion_criteria: dp.inclusion_criteria,
      exclusion_criteria: dp.exclusion_criteria,
      implementation_refs: [],
      decision_refs: [],
      evidence_refs: [],
      ancestry: {
        source_games: ["broguece", "cataclysm-bn", "crawl", "nethack"],
        observed_in: ["cross-game design analysis"],
        derived_from: [],
        mutation_dimensions: dp.mutation_dimensions,
      },
    });

    // Create design pressure concepts and relations
    for (const pressureName of dp.pressures) {
      const pressureSlug = slugify(pressureName);
      const pressureKey = `cross-game/concept/pressure-${pressureSlug}`;

      // Dedup: reuse existing pressure concept if already created by another primitive
      let pressureId = pressureConceptIds.get(pressureKey);
      if (!pressureId) {
        pressureId = createRecordId();
        pressureConceptIds.set(pressureKey, pressureId);

        concepts.push({
          ...makeConceptEnvelope(pressureKey, pressureId),
          concept_type: "design_pressure",
          title: pressureName.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
          definition: `A design pressure created by ${dp.title.toLowerCase()} that forces players to make meaningful strategic decisions.`,
          inclusion_criteria: [`Pressure arises from ${dp.title} mechanic`],
          exclusion_criteria: ["Pressures from unrelated game systems"],
          implementation_refs: [conceptId],
          decision_refs: [],
          evidence_refs: [],
          ancestry: {
            source_games: ["broguece", "cataclysm-bn", "crawl", "nethack"],
            observed_in: [`${dp.title} design analysis`],
            derived_from: [conceptId],
            mutation_dimensions: [],
          },
        });
      }

      // CREATES_PRESSURE relation: primitive → pressure
      const relId = createRecordId();
      const relKey = `cross-game/relation/${dp.slug}-creates_pressure-${pressureSlug}`;
      relations.push({
        ...makeRelationEnvelope(relKey, relId, "CREATES_PRESSURE", conceptId, pressureId, "cross_game", {
          design_primitive: dp.slug,
          pressure: pressureSlug,
        }, [designEvId]),
      });
    }
  }

  // Create tensions between pressures from different primitives
  const tensionPairs: [string, string, string][] = [
    ["risk_aversion", "exploration_urgency", "Permadeath makes exploration risky, but hunger clock forces exploration"],
    ["resource_scarcity", "information_asymmetry", "Limited resources force choices, but unidentified items add uncertainty"],
    ["tactical_depth", "time_pressure", "Turn-based combat rewards thinking, but hunger clock punishes delays"],
    ["risk_aversion", "resource_hoarding", "Permadeath encourages caution, but inventory limits force discarding items"],
    ["economic_decision_making", "risk_vs_reward", "Shops offer power but spending currency on items risks losing it to permadeath"],
    ["emotional_attachment", "risk_aversion", "Pets create attachment, but permadeath makes every companion death permanent"],
    ["behavioral_constraint", "tactical_diversity", "Religion restricts actions, but magic system rewards diverse approaches"],
    ["power_curve_tension", "exploration_urgency", "Level progression rewards combat, but hunger clock pushes forward before ready"],
    ["resource_management", "time_pressure", "Magic requires resource management, but hunger clock limits stalling to regenerate"],
    ["specialization_tradeoff", "adaptation_requirement", "Skill training rewards specialization, but procedural generation demands adaptation"],
    ["production_planning", "resource_scarcity", "Crafting requires planning, but scarce materials limit what can be produced"],
    ["micro_management", "tactical_depth", "Pets require management attention, reducing bandwidth for tactical decisions"],
    ["grind_incentive", "time_pressure", "Level progression encourages grinding, but hunger clock prevents infinite stalling"],
    ["piety_management", "opportunity_cost", "Religion demands specific actions for piety, creating opportunity cost vs other goals"],
  ];

  for (const [pressure1, pressure2, description] of tensionPairs) {
    const p1Id = pressureConceptIds.get(`cross-game/concept/pressure-${slugify(pressure1)}`);
    const p2Id = pressureConceptIds.get(`cross-game/concept/pressure-${slugify(pressure2)}`);
    if (!p1Id || !p2Id) continue;

    const relId = createRecordId();
    const relKey = `cross-game/relation/tension-${slugify(pressure1)}-${slugify(pressure2)}`;
    relations.push({
      ...makeRelationEnvelope(relKey, relId, "tensions_with", p1Id, p2Id, "cross_game", {
        description,
      }, [designEvId]),
    });
  }

  // === Step 3: Generate mutation vectors ===
  console.log("\n=== Generating mutation vectors ===");
  for (const dp of DESIGN_PRIMITIVES) {
    const primId = primitiveConceptIds.get(dp.slug)!;
    for (const dim of dp.mutation_dimensions) {
      const dimSlug = slugify(dim);
      const mvId = createRecordId();
      const mvKey = `cross-game/concept/mutation-${dp.slug}-${dimSlug}`;
      mutationVectorIds.set(mvKey, mvId);

      let fields: { title: string; definition: string; inclusion_criteria: string[]; exclusion_criteria: string[] };
      try {
        fields = await llmJson(`You are a game design expert analyzing roguelike games (NetHack, BrogueCE, Cataclysm-BN, Dungeon Crawl Stone Soup).

Given the design primitive "${dp.title}" (definition: ${dp.definition}), generate a mutation vector concept for the dimension "${dim}".

This dimension describes an axis along which this primitive can vary across different game implementations.

Respond with JSON:
{"title": "Human-readable title", "definition": "What this dimension controls and how it varies (1-2 sentences)", "inclusion_criteria": ["criterion1", "criterion2"], "exclusion_criteria": ["what is NOT this dimension"]}`);
      } catch (e) {
        console.warn(`  [WARN] LLM failed for mutation vector ${dp.slug}/${dim}:`, e instanceof Error ? e.message : e);
        fields = {
          title: dim.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
          definition: `How ${dp.title.toLowerCase()} varies along the ${dim.replace(/_/g, " ")} axis across games.`,
          inclusion_criteria: [`Variation in ${dim.replace(/_/g, " ")} across implementations`],
          exclusion_criteria: ["Unrelated dimensions"],
        };
      }

      concepts.push({
        ...makeConceptEnvelope(mvKey, mvId),
        concept_type: "mutation_vector",
        title: fields.title,
        definition: fields.definition,
        inclusion_criteria: fields.inclusion_criteria,
        exclusion_criteria: fields.exclusion_criteria,
        implementation_refs: [],
        decision_refs: [],
        evidence_refs: [],
        ancestry: {
          source_games: ["broguece", "cataclysm-bn", "crawl", "nethack"],
          observed_in: [`${dp.title} design analysis`],
          derived_from: [primId],
          mutation_dimensions: [],
        },
      });

      const relId = createRecordId();
      const relKey = `cross-game/relation/${dp.slug}-has_mutation_vector-${dimSlug}`;
      relations.push({
        ...makeRelationEnvelope(relKey, relId, "HAS_MUTATION_VECTOR", primId, mvId, "cross_game", {
          design_primitive: dp.slug,
          dimension: dimSlug,
        }, [designEvId]),
      });
    }
  }
  console.log(`Generated ${mutationVectorIds.size} mutation vectors`);

  // === Step 4: Generate design knobs ===
  console.log("\n=== Generating design knobs ===");
  let knobCount = 0;
  for (const dp of DESIGN_PRIMITIVES) {
    for (const dim of dp.mutation_dimensions) {
      const dimSlug = slugify(dim);
      const mvKey = `cross-game/concept/mutation-${dp.slug}-${dimSlug}`;
      const mvId = mutationVectorIds.get(mvKey)!;

      let knobs: { slug: string; title: string; definition: string; source_games: string[]; search_keywords: string[] }[];
      try {
        knobs = await llmJson(`You are a game design expert analyzing roguelike games (NetHack, BrogueCE, Cataclysm-BN, Dungeon Crawl Stone Soup).

Given the design primitive "${dp.title}" and mutation dimension "${dim}", generate 2-4 design knob concepts representing different implementation choices along this axis.

Respond with JSON array:
[{"slug": "short_id", "title": "Implementation Choice Name", "definition": "How this works (1-2 sentences)", "source_games": ["nethack"|"broguece"|"cataclysm-bn"|"crawl"], "search_keywords": ["keyword1", "keyword2"]}]`);
      } catch (e) {
        console.warn(`  [WARN] LLM failed for knobs ${dp.slug}/${dim}:`, e instanceof Error ? e.message : e);
        knobs = [
          { slug: "low", title: `Low ${dim}`, definition: `Minimal ${dim.replace(/_/g, " ")} setting.`, source_games: ["broguece"], search_keywords: [dim] },
          { slug: "high", title: `High ${dim}`, definition: `Maximal ${dim.replace(/_/g, " ")} setting.`, source_games: ["nethack"], search_keywords: [dim] },
        ];
      }

      for (const knob of knobs) {
        const knobId = createRecordId();
        const knobKey = `cross-game/concept/knob-${dp.slug}-${dimSlug}-${slugify(knob.slug)}`;
        const implRefs = findRecordsByKeywords(state, knob.search_keywords || []);

        concepts.push({
          ...makeConceptEnvelope(knobKey, knobId),
          concept_type: "design_knob",
          title: knob.title,
          definition: knob.definition,
          inclusion_criteria: [],
          exclusion_criteria: [],
          implementation_refs: implRefs,
          decision_refs: [],
          evidence_refs: [],
          ancestry: {
            source_games: knob.source_games || [],
            observed_in: [`${dp.title} / ${dim} analysis`],
            derived_from: [mvId],
            mutation_dimensions: [],
          },
        });

        const relId = createRecordId();
        const relKey = `cross-game/relation/${dp.slug}-${dimSlug}-implemented_as-${slugify(knob.slug)}`;
        relations.push({
          ...makeRelationEnvelope(relKey, relId, "IMPLEMENTED_AS", mvId, knobId, "cross_game", {
            mutation_vector: dimSlug,
            knob: slugify(knob.slug),
          }, [designEvId]),
        });
        knobCount++;
      }
    }
  }
  console.log(`Generated ${knobCount} design knobs`);

  // === Step 5: Generate counterplay patterns ===
  console.log("\n=== Generating counterplay patterns ===");
  let counterplayCount = 0;
  const pressuresWithoutCounterplay: string[] = [];
  for (const [pressureKey, pressureId] of pressureConceptIds) {
    const pressureTitle = pressureKey.replace("cross-game/concept/pressure-", "").replace(/_/g, " ");

    let patterns: { slug: string; title: string; definition: string; source_games: string[]; search_keywords: string[] }[];
    try {
      patterns = await llmJson(`You are a game design expert analyzing roguelike games (NetHack, BrogueCE, Cataclysm-BN, Dungeon Crawl Stone Soup).

Given the design pressure "${pressureTitle}", generate 1-3 counterplay patterns — strategies, items, or mechanics that mitigate this pressure.

If the pressure is abstract and has no meaningful counterplay, return an empty array [].

Respond with JSON array:
[{"slug": "short_id", "title": "Counterplay Name", "definition": "How this counterplay works (1-2 sentences)", "source_games": ["nethack"|"broguece"|"cataclysm-bn"|"crawl"], "search_keywords": ["keyword1", "keyword2"]}]`);
    } catch (e) {
      console.warn(`  [WARN] LLM failed for counterplay ${pressureTitle}:`, e instanceof Error ? e.message : e);
      patterns = [];
    }

    if (patterns.length === 0) {
      pressuresWithoutCounterplay.push(pressureTitle);
      continue;
    }

    for (const pattern of patterns) {
      const cpId = createRecordId();
      const cpKey = `cross-game/concept/counterplay-${slugify(pressureTitle)}-${slugify(pattern.slug)}`;
      const implRefs = findRecordsByKeywords(state, pattern.search_keywords || []);

      concepts.push({
        ...makeConceptEnvelope(cpKey, cpId),
        concept_type: "counterplay_pattern",
        title: pattern.title,
        definition: pattern.definition,
        inclusion_criteria: [],
        exclusion_criteria: [],
        implementation_refs: implRefs,
        decision_refs: [],
        evidence_refs: [],
        ancestry: {
          source_games: pattern.source_games || [],
          observed_in: [`${pressureTitle} counterplay analysis`],
          derived_from: [pressureId],
          mutation_dimensions: [],
        },
      });

      const relId = createRecordId();
      const relKey = `cross-game/relation/${slugify(pressureTitle)}-has_counterplay-${slugify(pattern.slug)}`;
      relations.push({
        ...makeRelationEnvelope(relKey, relId, "HAS_COUNTERPLAY", pressureId, cpId, "cross_game", {
          pressure: slugify(pressureTitle),
          counterplay: slugify(pattern.slug),
        }, [designEvId]),
      });
      counterplayCount++;
    }
  }
  console.log(`Generated ${counterplayCount} counterplay patterns`);
  if (pressuresWithoutCounterplay.length > 0) {
    console.log(`  Pressures without counterplay: ${pressuresWithoutCounterplay.join(", ")}`);
  }

  // === Step 6: Generate failure modes ===
  console.log("\n=== Generating failure modes ===");
  let failureModeCount = 0;
  const failureModeIds = new Map<string, string>(); // key: `${primitiveSlug}/${failureModeSlug}`
  for (const dp of DESIGN_PRIMITIVES) {
    const primId = primitiveConceptIds.get(dp.slug)!;

    let modes: { slug: string; title: string; definition: string; inclusion_criteria: string[]; exclusion_criteria: string[] }[];
    try {
      modes = await llmJson(`You are a game design expert analyzing roguelike games (NetHack, BrogueCE, Cataclysm-BN, Dungeon Crawl Stone Soup).

Given the design primitive "${dp.title}" (definition: ${dp.definition}), generate 1-2 failure mode concepts — conditions under which this primitive becomes trivial, dominant, opaque, degenerate, or otherwise fails.

Respond with JSON array:
[{"slug": "short_id", "title": "Failure Mode Name", "definition": "What goes wrong and why (1-2 sentences)", "inclusion_criteria": ["symptom1", "symptom2"], "exclusion_criteria": ["what is NOT this failure"]}]`);
    } catch (e) {
      console.warn(`  [WARN] LLM failed for failure mode ${dp.slug}:`, e instanceof Error ? e.message : e);
      modes = [{ slug: "degenerate", title: `Degenerate ${dp.title}`, definition: `${dp.title} becomes trivial or dominant.`, inclusion_criteria: ["Game becomes trivial"], exclusion_criteria: ["Normal difficulty"] }];
    }

    for (const mode of modes) {
      const fmId = createRecordId();
      const fmKey = `cross-game/concept/failure-${dp.slug}-${slugify(mode.slug)}`;

      concepts.push({
        ...makeConceptEnvelope(fmKey, fmId),
        concept_type: "failure_mode",
        title: mode.title,
        definition: mode.definition,
        inclusion_criteria: mode.inclusion_criteria,
        exclusion_criteria: mode.exclusion_criteria,
        implementation_refs: [],
        decision_refs: [],
        evidence_refs: [],
        ancestry: {
          source_games: ["broguece", "cataclysm-bn", "crawl", "nethack"],
          observed_in: [`${dp.title} failure analysis`],
          derived_from: [primId],
          mutation_dimensions: [],
        },
      });

      const relId = createRecordId();
      const relKey = `cross-game/relation/${dp.slug}-can_fail_as-${slugify(mode.slug)}`;
      relations.push({
        ...makeRelationEnvelope(relKey, relId, "CAN_FAIL_AS", primId, fmId, "cross_game", {
          design_primitive: dp.slug,
          failure_mode: slugify(mode.slug),
        }, [designEvId]),
      });
      failureModeCount++;
      failureModeIds.set(`${dp.slug}/${slugify(mode.slug)}`, fmId);
    }
  }
  console.log(`Generated ${failureModeCount} failure modes`);

  // === Step 6.5: Match primitives and patterns to definition records ===
  console.log("\n=== Matching primitives to definition records ===");
  const GAMES = ["nethack", "broguece", "crawl", "cataclysm-bn"];
  const primitiveRefs = new Map<string, string[]>(); // slug -> record IDs
  for (const dp of DESIGN_PRIMITIVES) {
    const allRefs: string[] = [];
    for (const game of GAMES) {
      const refs = await matchPrimitiveToGame(state, dp, game);
      allRefs.push(...refs);
      console.log(`  ${dp.slug}/${game}: ${refs.length} refs`);
    }
    primitiveRefs.set(dp.slug, allRefs);
    const primConcept = concepts.find((c) => c.key === `cross-game/concept/design-${dp.slug}`);
    if (primConcept) primConcept.implementation_refs = allRefs;
  }
  console.log(`Matched implementation_refs for ${primitiveRefs.size} primitives`);

  // === Step 7: Generate concrete examples for design primitives ===
  console.log("\n=== Generating concrete examples for design primitives ===");
  let exampleCount = 0;
  for (const dp of DESIGN_PRIMITIVES) {
    const primId = primitiveConceptIds.get(dp.slug)!;
    const primConcept = concepts.find((c) => c.id === primId);
    if (!primConcept) continue;

    const examples: { game: string; description: string; record_refs: string[]; source_file: string }[] = [];
    for (const game of GAMES) {
      let example: { description: string; record_refs: string[]; source_file: string };
      try {
        example = await llmJson(`You are a game design expert analyzing roguelike games.

Given the design primitive "${dp.title}" (definition: ${dp.definition}), provide a concrete example of how this primitive is implemented in the game "${game}".

Respond with JSON:
{"description": "How this primitive works in ${game} (1-2 sentences)", "record_refs": [], "source_file": "relevant source file if known, or empty string"}`);
      } catch (e) {
        console.warn(`  [WARN] LLM failed for example ${dp.slug}/${game}:`, e instanceof Error ? e.message : e);
        example = { description: `${dp.title} in ${game}.`, record_refs: [], source_file: "" };
      }
      // Populate record_refs from matching results (Step 6.5)
      const allMatchedRefs = primitiveRefs.get(dp.slug) ?? [];
      const gameRefs = allMatchedRefs.filter(id => {
        const rec = state.records.find((r: any) => r.id === id) as any;
        return rec?.source_identity?.source_id === game;
      });
      examples.push({ game, ...example, record_refs: gameRefs });
      exampleCount++;
    }

    // Add concrete_examples field to the existing primitive concept
    primConcept.concrete_examples = examples;
  }
  console.log(`Generated ${exampleCount} concrete examples`);

  // === Step 8: Generate design pattern records ===
  console.log("\n=== Generating design pattern records ===");
  const patternConceptIds = new Map<string, string>();
  for (const pattern of DESIGN_PATTERNS) {
    const patternId = createRecordId();
    const patternKey = `cross-game/concept/pattern-${pattern.slug}`;
    patternConceptIds.set(pattern.slug, patternId);

    // Resolve member primitive IDs
    const memberPrimitiveIds = pattern.member_primitives
      .map((slug) => primitiveConceptIds.get(slug))
      .filter((id): id is string => !!id);

    concepts.push({
      ...makePatternConceptEnvelope(patternKey, patternId),
      concept_type: "design_pattern",
      title: pattern.title,
      definition: pattern.definition,
      member_primitives: pattern.member_primitives.map((slug) => `cross-game/concept/design-${slug}`),
      member_pressures: pattern.member_pressures.map((p) => `cross-game/concept/pressure-${slugify(p)}`),
      games_where_present: pattern.games_where_present,
      games_where_absent: pattern.games_where_absent,
      inclusion_criteria: [],
      exclusion_criteria: [],
      implementation_refs: [],
      decision_refs: [],
      evidence_refs: [],
      ancestry: {
        source_games: pattern.games_where_present,
        observed_in: ["cross-game design pattern analysis"],
        derived_from: memberPrimitiveIds,
        mutation_dimensions: [],
      },
    });
  }
  console.log(`Generated ${DESIGN_PATTERNS.length} design pattern records`);

  // === Step 8.5: Match design patterns to definition records ===
  console.log("\n=== Matching design patterns to definition records ===");
  const primitiveTitlesMap = new Map<string, string>();
  for (const dp of DESIGN_PRIMITIVES) {
    primitiveTitlesMap.set(dp.slug, dp.title);
  }
  for (const pattern of DESIGN_PATTERNS) {
    const allRefs: string[] = [];
    for (const game of pattern.games_where_present) {
      const refs = await matchPatternToGame(state, pattern, game, primitiveTitlesMap);
      allRefs.push(...refs);
      console.log(`  pattern ${pattern.slug}/${game}: ${refs.length} refs`);
    }
    const patConcept = concepts.find((c) => c.key === `cross-game/concept/pattern-${pattern.slug}`);
    if (patConcept) patConcept.implementation_refs = allRefs;
  }
  console.log(`Matched implementation_refs for design patterns`);

  // === Step 9: Generate anti-pattern relations ===
  console.log("\n=== Generating anti-pattern relations ===");
  let antiPatternCount = 0;
  for (const pattern of DESIGN_PATTERNS) {
    const patternId = patternConceptIds.get(pattern.slug)!;

    for (const link of pattern.failure_mode_links) {
      // Match all failure modes from the specified primitive (LLM-generated slugs are unpredictable)
      const primSlug = link.primitive_slug;
      for (const [fmKey, fmId] of failureModeIds) {
        if (!fmKey.startsWith(`${primSlug}/`)) continue;

        const relId = createRecordId();
        const fmSlug = fmKey.split("/")[1];
        const relKey = `cross-game/relation/${pattern.slug}-triggered_by_combination-${primSlug}-${fmSlug}`;
        relations.push({
          ...makePatternRelationEnvelope(relKey, relId, "TRIGGERED_BY_COMBINATION", fmId, patternId, "cross_game", {
            trigger_conditions: link.trigger_conditions,
          }, [designEvId]),
        });
        antiPatternCount++;
      }
    }
  }
  console.log(`Generated ${antiPatternCount} anti-pattern relations`);

  console.log(`\nCreated ${concepts.length} design concepts (${DESIGN_PRIMITIVES.length} primitives + pressure + mutation + knob + counterplay + failure + pattern concepts)`);
  console.log(`Created ${relations.length} design-space relations`);

  // Build transaction
  const ops: TransactionOperation[] = [];
  const seenKeys = new Set<string>();
  let dupCount = 0;

  for (const concept of concepts) {
    const opKey = `concept/${concept.key}`;
    if (seenKeys.has(opKey)) {
      dupCount++;
      continue;
    }
    seenKeys.add(opKey);
    ops.push({ type: "create", record_id: concept.id, record_type: "concept", key: concept.key, data: concept });
  }
  for (const rel of relations) {
    const opKey = `relation/${rel.key}`;
    if (seenKeys.has(opKey)) {
      dupCount++;
      continue;
    }
    seenKeys.add(opKey);
    ops.push({ type: "create", record_id: rel.id, record_type: "relation", key: rel.key, data: rel });
  }
  for (const ev of evidenceList) {
    const opKey = `evidence/${ev.key}`;
    if (seenKeys.has(opKey)) {
      dupCount++;
      continue;
    }
    seenKeys.add(opKey);
    ops.push({ type: "create", record_id: ev.id, record_type: "evidence", key: ev.key, data: ev });
  }

  if (dupCount > 0) console.log(`  Skipped ${dupCount} duplicate-key operations`);
  console.log(`Total operations: ${ops.length}`);

  if (ops.length === 0) {
    console.log("No operations to apply. Done.");
    return;
  }

  const txId = "design-tx-001";
  const plan = preparePromotion(txId, null, ops, {});
  const applyResult = applyPromotionTransaction(plan, CANONICAL_ROOT, STAGING_ROOT);

  console.log("Transaction status:", applyResult.status);
  if (applyResult.status !== "COMMITTED") {
    console.error("Transaction failed:", JSON.stringify(applyResult.plan.diagnostics, null, 2));
    process.exit(1);
  }

  console.log(`Promoted ${concepts.length} design concepts and ${relations.length} relations to canonical.`);
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
