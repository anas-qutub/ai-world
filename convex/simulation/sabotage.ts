import { MutationCtx, QueryCtx } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";
import { recordMemory } from "./memory";

// =============================================
// COMPREHENSIVE SABOTAGE SYSTEM
// =============================================
// All forms of covert disruption a civilization can use against rivals

// =============================================
// SABOTAGE CATEGORIES
// =============================================

export type SabotageCategory =
  | "economic"
  | "military"
  | "political"
  | "religious"
  | "infrastructure"
  | "demographic"
  | "psychological"
  | "social";

export type SabotageType =
  // Economic
  | "poison_crops"
  | "contaminate_water"
  | "counterfeit_currency"
  | "burn_granaries"
  | "sabotage_mines"
  | "burn_market"
  | "introduce_pests"
  | "bribe_merchants"
  | "steal_trade_secrets"
  | "disrupt_caravans"
  // Military
  | "poison_army_supplies"
  | "sabotage_weapons"
  | "steal_battle_plans"
  | "assassinate_general"
  | "incite_desertion"
  | "spread_camp_disease"
  | "sabotage_fortifications"
  | "burn_armory"
  | "disable_siege_equipment"
  | "bribe_soldiers_defect"
  // Political
  | "assassinate_heir"
  | "spread_propaganda"
  | "incite_rebellion"
  | "bribe_advisors"
  | "forge_documents"
  | "frame_noble_treason"
  | "support_rival_faction"
  | "spread_ruler_rumors"
  | "create_succession_crisis"
  | "blackmail_officials"
  // Religious
  | "desecrate_temple"
  | "assassinate_priests"
  | "spread_heresy"
  | "steal_holy_relics"
  | "corrupt_religious_texts"
  | "support_rival_cult"
  | "poison_holy_water"
  | "fake_divine_omens"
  // Infrastructure
  | "destroy_bridges"
  | "block_mountain_passes"
  | "burn_harbor"
  | "collapse_mines"
  | "destroy_aqueducts"
  | "set_city_fires"
  | "dam_rivers"
  | "destroy_roads"
  // Demographic
  | "spread_plague"
  | "poison_food_supply"
  | "kidnap_craftsmen"
  | "encourage_emigration"
  | "assassinate_healers"
  // Psychological
  | "spread_terror"
  | "display_enemy_heads"
  | "create_bad_omens"
  | "night_raids"
  | "demoralize_with_losses"
  // Social
  | "incite_class_warfare"
  | "spread_ethnic_hatred"
  | "corrupt_youth"
  | "undermine_marriages"
  | "spread_addiction"
  | "destroy_cultural_artifacts";

// =============================================
// SABOTAGE CONFIGURATION
// =============================================

export interface SabotageConfig {
  category: SabotageCategory;
  baseDifficulty: number;      // 0-100, higher = harder
  detectChance: number;        // Base chance of being caught
  warRisk: number;             // Chance this causes war if detected
  requiresSpy: boolean;        // Must have spy in place
  description: string;
  effects: {
    food?: number;
    wealth?: number;
    happiness?: number;
    military?: number;
    knowledge?: number;
    influence?: number;
    population?: number;
    technology?: number;
    piety?: number;
  };
  specialEffect?: string;      // Code for special handling
}

export const SABOTAGE_CONFIG: Record<SabotageType, SabotageConfig> = {
  // =============================================
  // ECONOMIC SABOTAGE
  // =============================================
  poison_crops: {
    category: "economic",
    baseDifficulty: 50,
    detectChance: 30,
    warRisk: 25,
    requiresSpy: false,
    description: "Introduce crop disease or salt their fields to ruin harvests",
    effects: { food: -25, happiness: -10 },
    specialEffect: "crop_disease",
  },
  contaminate_water: {
    category: "economic",
    baseDifficulty: 55,
    detectChance: 40,
    warRisk: 40,
    requiresSpy: false,
    description: "Poison wells and water sources causing sickness",
    effects: { happiness: -20, population: -5 },
    specialEffect: "disease_outbreak",
  },
  counterfeit_currency: {
    category: "economic",
    baseDifficulty: 65,
    detectChance: 35,
    warRisk: 20,
    requiresSpy: true,
    description: "Flood their markets with fake coins causing inflation",
    effects: { wealth: -20, happiness: -10 },
    specialEffect: "inflation",
  },
  burn_granaries: {
    category: "economic",
    baseDifficulty: 45,
    detectChance: 50,
    warRisk: 35,
    requiresSpy: false,
    description: "Set fire to food storage facilities",
    effects: { food: -30, happiness: -15 },
  },
  sabotage_mines: {
    category: "economic",
    baseDifficulty: 55,
    detectChance: 40,
    warRisk: 30,
    requiresSpy: false,
    description: "Collapse or flood mining operations",
    effects: { wealth: -15, population: -3 },
    specialEffect: "mine_collapse",
  },
  burn_market: {
    category: "economic",
    baseDifficulty: 50,
    detectChance: 45,
    warRisk: 30,
    requiresSpy: false,
    description: "Burn down marketplaces and trade infrastructure",
    effects: { wealth: -20, happiness: -10 },
  },
  introduce_pests: {
    category: "economic",
    baseDifficulty: 40,
    detectChance: 20,
    warRisk: 15,
    requiresSpy: false,
    description: "Release locusts, rats, or other pests to destroy crops",
    effects: { food: -20 },
    specialEffect: "pest_infestation",
  },
  bribe_merchants: {
    category: "economic",
    baseDifficulty: 45,
    detectChance: 25,
    warRisk: 10,
    requiresSpy: true,
    description: "Pay merchants to overcharge and exploit their people",
    effects: { wealth: -10, happiness: -15 },
  },
  steal_trade_secrets: {
    category: "economic",
    baseDifficulty: 60,
    detectChance: 35,
    warRisk: 25,
    requiresSpy: true,
    description: "Copy their production methods and trade knowledge",
    effects: { technology: -5 },
    specialEffect: "tech_stolen",
  },
  disrupt_caravans: {
    category: "economic",
    baseDifficulty: 35,
    detectChance: 40,
    warRisk: 20,
    requiresSpy: false,
    description: "Attack or misdirect trade caravans",
    effects: { wealth: -15 },
  },

  // =============================================
  // MILITARY SABOTAGE
  // =============================================
  poison_army_supplies: {
    category: "military",
    baseDifficulty: 60,
    detectChance: 45,
    warRisk: 50,
    requiresSpy: true,
    description: "Contaminate military food and water supplies",
    effects: { military: -20 },
    specialEffect: "army_sickness",
  },
  sabotage_weapons: {
    category: "military",
    baseDifficulty: 55,
    detectChance: 35,
    warRisk: 40,
    requiresSpy: true,
    description: "Weaken swords, dull blades, damage bows",
    effects: { military: -15 },
    specialEffect: "weapon_quality_drop",
  },
  steal_battle_plans: {
    category: "military",
    baseDifficulty: 70,
    detectChance: 40,
    warRisk: 35,
    requiresSpy: true,
    description: "Copy their military strategies and troop positions",
    effects: {},
    specialEffect: "battle_plans_stolen",
  },
  assassinate_general: {
    category: "military",
    baseDifficulty: 75,
    detectChance: 55,
    warRisk: 60,
    requiresSpy: true,
    description: "Kill their top military commander",
    effects: { military: -25 },
    specialEffect: "general_killed",
  },
  incite_desertion: {
    category: "military",
    baseDifficulty: 50,
    detectChance: 30,
    warRisk: 25,
    requiresSpy: true,
    description: "Spread fear and encourage soldiers to flee",
    effects: { military: -15 },
    specialEffect: "mass_desertion",
  },
  spread_camp_disease: {
    category: "military",
    baseDifficulty: 55,
    detectChance: 35,
    warRisk: 45,
    requiresSpy: true,
    description: "Introduce plague into military camps",
    effects: { military: -30, population: -5 },
    specialEffect: "army_plague",
  },
  sabotage_fortifications: {
    category: "military",
    baseDifficulty: 60,
    detectChance: 40,
    warRisk: 35,
    requiresSpy: true,
    description: "Secretly weaken walls and defenses",
    effects: { military: -10 },
    specialEffect: "walls_weakened",
  },
  burn_armory: {
    category: "military",
    baseDifficulty: 50,
    detectChance: 50,
    warRisk: 40,
    requiresSpy: false,
    description: "Destroy weapon and armor storage",
    effects: { military: -20 },
  },
  disable_siege_equipment: {
    category: "military",
    baseDifficulty: 55,
    detectChance: 45,
    warRisk: 35,
    requiresSpy: true,
    description: "Break catapults, battering rams, siege towers",
    effects: { military: -10 },
    specialEffect: "siege_disabled",
  },
  bribe_soldiers_defect: {
    category: "military",
    baseDifficulty: 60,
    detectChance: 40,
    warRisk: 45,
    requiresSpy: true,
    description: "Pay soldiers to switch sides",
    effects: { military: -15 },
    specialEffect: "soldiers_defect",
  },

  // =============================================
  // POLITICAL SABOTAGE
  // =============================================
  assassinate_heir: {
    category: "political",
    baseDifficulty: 80,
    detectChance: 60,
    warRisk: 70,
    requiresSpy: true,
    description: "Kill the next in line for the throne",
    effects: { happiness: -20, influence: -10 },
    specialEffect: "heir_killed",
  },
  spread_propaganda: {
    category: "political",
    baseDifficulty: 40,
    detectChance: 25,
    warRisk: 15,
    requiresSpy: false,
    description: "Spread lies and rumors about their ruler",
    effects: { happiness: -15, influence: -10 },
    specialEffect: "legitimacy_drop",
  },
  incite_rebellion: {
    category: "political",
    baseDifficulty: 65,
    detectChance: 45,
    warRisk: 50,
    requiresSpy: true,
    description: "Arm and fund rebel groups",
    effects: { happiness: -25, military: -10 },
    specialEffect: "rebellion_started",
  },
  bribe_advisors: {
    category: "political",
    baseDifficulty: 55,
    detectChance: 35,
    warRisk: 30,
    requiresSpy: true,
    description: "Corrupt their council to give bad advice",
    effects: { wealth: -10 },
    specialEffect: "bad_decisions",
  },
  forge_documents: {
    category: "political",
    baseDifficulty: 50,
    detectChance: 40,
    warRisk: 35,
    requiresSpy: true,
    description: "Create fake treaties, orders, or letters",
    effects: { influence: -15 },
    specialEffect: "diplomatic_chaos",
  },
  frame_noble_treason: {
    category: "political",
    baseDifficulty: 60,
    detectChance: 45,
    warRisk: 40,
    requiresSpy: true,
    description: "Plant evidence to frame a noble for treason",
    effects: { happiness: -10 },
    specialEffect: "internal_purge",
  },
  support_rival_faction: {
    category: "political",
    baseDifficulty: 50,
    detectChance: 35,
    warRisk: 30,
    requiresSpy: true,
    description: "Fund and arm opposition political groups",
    effects: { happiness: -15 },
    specialEffect: "faction_strengthened",
  },
  spread_ruler_rumors: {
    category: "political",
    baseDifficulty: 35,
    detectChance: 20,
    warRisk: 10,
    requiresSpy: false,
    description: "Spread rumors of ruler's madness or illegitimacy",
    effects: { happiness: -10, influence: -15 },
    specialEffect: "ruler_discredited",
  },
  create_succession_crisis: {
    category: "political",
    baseDifficulty: 75,
    detectChance: 50,
    warRisk: 55,
    requiresSpy: true,
    description: "Kill or discredit all viable heirs",
    effects: { happiness: -30, influence: -20 },
    specialEffect: "succession_crisis",
  },
  blackmail_officials: {
    category: "political",
    baseDifficulty: 55,
    detectChance: 30,
    warRisk: 25,
    requiresSpy: true,
    description: "Gather compromising information on officials",
    effects: {},
    specialEffect: "officials_controlled",
  },

  // =============================================
  // RELIGIOUS SABOTAGE
  // =============================================
  desecrate_temple: {
    category: "religious",
    baseDifficulty: 50,
    detectChance: 60,
    warRisk: 50,
    requiresSpy: false,
    description: "Defile and damage holy sites",
    effects: { happiness: -25, influence: -15 },
    specialEffect: "temple_defiled",
  },
  assassinate_priests: {
    category: "religious",
    baseDifficulty: 60,
    detectChance: 50,
    warRisk: 45,
    requiresSpy: true,
    description: "Kill religious leaders and holy men",
    effects: { happiness: -20 },
    specialEffect: "priests_killed",
  },
  spread_heresy: {
    category: "religious",
    baseDifficulty: 45,
    detectChance: 25,
    warRisk: 30,
    requiresSpy: true,
    description: "Introduce false religious teachings",
    effects: { happiness: -15 },
    specialEffect: "religious_schism",
  },
  steal_holy_relics: {
    category: "religious",
    baseDifficulty: 65,
    detectChance: 55,
    warRisk: 55,
    requiresSpy: true,
    description: "Take sacred objects from temples",
    effects: { happiness: -20, influence: -10 },
    specialEffect: "relics_stolen",
  },
  corrupt_religious_texts: {
    category: "religious",
    baseDifficulty: 55,
    detectChance: 20,
    warRisk: 25,
    requiresSpy: true,
    description: "Subtly alter their holy scriptures",
    effects: { knowledge: -5 },
    specialEffect: "texts_corrupted",
  },
  support_rival_cult: {
    category: "religious",
    baseDifficulty: 50,
    detectChance: 35,
    warRisk: 35,
    requiresSpy: true,
    description: "Fund a competing religious movement",
    effects: { happiness: -15 },
    specialEffect: "cult_formed",
  },
  poison_holy_water: {
    category: "religious",
    baseDifficulty: 45,
    detectChance: 40,
    warRisk: 45,
    requiresSpy: false,
    description: "Contaminate sacred water supplies",
    effects: { happiness: -15, population: -3 },
    specialEffect: "holy_water_poisoned",
  },
  fake_divine_omens: {
    category: "religious",
    baseDifficulty: 40,
    detectChance: 30,
    warRisk: 20,
    requiresSpy: false,
    description: "Create fake bad omens and prophecies",
    effects: { happiness: -20 },
    specialEffect: "false_omens",
  },

  // =============================================
  // INFRASTRUCTURE SABOTAGE
  // =============================================
  destroy_bridges: {
    category: "infrastructure",
    baseDifficulty: 45,
    detectChance: 50,
    warRisk: 30,
    requiresSpy: false,
    description: "Destroy bridges to cut off movement and trade",
    effects: { wealth: -15 },
    specialEffect: "bridges_destroyed",
  },
  block_mountain_passes: {
    category: "infrastructure",
    baseDifficulty: 50,
    detectChance: 35,
    warRisk: 25,
    requiresSpy: false,
    description: "Cause rockslides to block trade routes",
    effects: { wealth: -20 },
    specialEffect: "passes_blocked",
  },
  burn_harbor: {
    category: "infrastructure",
    baseDifficulty: 55,
    detectChance: 55,
    warRisk: 40,
    requiresSpy: false,
    description: "Burn docks, ships, and port facilities",
    effects: { wealth: -25, military: -10 },
    specialEffect: "harbor_destroyed",
  },
  collapse_mines: {
    category: "infrastructure",
    baseDifficulty: 50,
    detectChance: 40,
    warRisk: 35,
    requiresSpy: false,
    description: "Cause cave-ins in mining operations",
    effects: { wealth: -15, population: -5 },
    specialEffect: "mines_collapsed",
  },
  destroy_aqueducts: {
    category: "infrastructure",
    baseDifficulty: 55,
    detectChance: 45,
    warRisk: 40,
    requiresSpy: false,
    description: "Destroy water supply infrastructure",
    effects: { happiness: -20, food: -10 },
    specialEffect: "water_crisis",
  },
  set_city_fires: {
    category: "infrastructure",
    baseDifficulty: 40,
    detectChance: 45,
    warRisk: 45,
    requiresSpy: false,
    description: "Start fires in populated areas",
    effects: { happiness: -25, wealth: -20, population: -5 },
    specialEffect: "city_burning",
  },
  dam_rivers: {
    category: "infrastructure",
    baseDifficulty: 60,
    detectChance: 50,
    warRisk: 35,
    requiresSpy: false,
    description: "Block rivers to cause flood or drought downstream",
    effects: { food: -25, happiness: -15 },
    specialEffect: "river_diverted",
  },
  destroy_roads: {
    category: "infrastructure",
    baseDifficulty: 40,
    detectChance: 40,
    warRisk: 25,
    requiresSpy: false,
    description: "Dig trenches, destroy paving, remove bridges",
    effects: { wealth: -10 },
    specialEffect: "roads_destroyed",
  },

  // =============================================
  // DEMOGRAPHIC SABOTAGE
  // =============================================
  spread_plague: {
    category: "demographic",
    baseDifficulty: 55,
    detectChance: 35,
    warRisk: 60,
    requiresSpy: false,
    description: "Intentionally introduce deadly disease",
    effects: { population: -15, happiness: -30 },
    specialEffect: "plague_started",
  },
  poison_food_supply: {
    category: "demographic",
    baseDifficulty: 50,
    detectChance: 45,
    warRisk: 50,
    requiresSpy: false,
    description: "Contaminate stored food with poison",
    effects: { population: -10, happiness: -20, food: -20 },
    specialEffect: "mass_poisoning",
  },
  kidnap_craftsmen: {
    category: "demographic",
    baseDifficulty: 55,
    detectChance: 50,
    warRisk: 35,
    requiresSpy: false,
    description: "Abduct skilled workers for your own use",
    effects: { technology: -5 },
    specialEffect: "craftsmen_kidnapped",
  },
  encourage_emigration: {
    category: "demographic",
    baseDifficulty: 45,
    detectChance: 25,
    warRisk: 15,
    requiresSpy: true,
    description: "Lure their population to leave for your lands",
    effects: { population: -5, happiness: -10 },
    specialEffect: "population_drain",
  },
  assassinate_healers: {
    category: "demographic",
    baseDifficulty: 55,
    detectChance: 45,
    warRisk: 40,
    requiresSpy: true,
    description: "Kill doctors and healers during plague",
    effects: { happiness: -15 },
    specialEffect: "healers_killed",
  },

  // =============================================
  // PSYCHOLOGICAL SABOTAGE
  // =============================================
  spread_terror: {
    category: "psychological",
    baseDifficulty: 45,
    detectChance: 40,
    warRisk: 35,
    requiresSpy: false,
    description: "Random murders and night attacks to terrorize",
    effects: { happiness: -25 },
    specialEffect: "terror_campaign",
  },
  display_enemy_heads: {
    category: "psychological",
    baseDifficulty: 35,
    detectChance: 80,
    warRisk: 50,
    requiresSpy: false,
    description: "Gruesome display of killed enemies for intimidation",
    effects: { happiness: -20, military: -5 },
    specialEffect: "intimidation",
  },
  create_bad_omens: {
    category: "psychological",
    baseDifficulty: 40,
    detectChance: 25,
    warRisk: 15,
    requiresSpy: false,
    description: "Stage fake supernatural events and bad signs",
    effects: { happiness: -15 },
    specialEffect: "superstition_fear",
  },
  night_raids: {
    category: "psychological",
    baseDifficulty: 45,
    detectChance: 50,
    warRisk: 40,
    requiresSpy: false,
    description: "Attack civilians at night to cause sleep deprivation",
    effects: { happiness: -20, population: -2 },
    specialEffect: "sleep_deprivation",
  },
  demoralize_with_losses: {
    category: "psychological",
    baseDifficulty: 35,
    detectChance: 20,
    warRisk: 10,
    requiresSpy: false,
    description: "Exaggerate enemy casualties to spread defeatism",
    effects: { happiness: -10, military: -5 },
    specialEffect: "defeatism",
  },

  // =============================================
  // SOCIAL SABOTAGE
  // =============================================
  incite_class_warfare: {
    category: "social",
    baseDifficulty: 50,
    detectChance: 35,
    warRisk: 30,
    requiresSpy: true,
    description: "Turn the poor against the rich",
    effects: { happiness: -20, wealth: -10 },
    specialEffect: "class_conflict",
  },
  spread_ethnic_hatred: {
    category: "social",
    baseDifficulty: 45,
    detectChance: 30,
    warRisk: 25,
    requiresSpy: true,
    description: "Inflame tensions between ethnic groups",
    effects: { happiness: -25 },
    specialEffect: "ethnic_tension",
  },
  corrupt_youth: {
    category: "social",
    baseDifficulty: 40,
    detectChance: 20,
    warRisk: 10,
    requiresSpy: true,
    description: "Spread vice and laziness among young people",
    effects: { happiness: -10, technology: -5 },
    specialEffect: "youth_corrupted",
  },
  undermine_marriages: {
    category: "social",
    baseDifficulty: 50,
    detectChance: 35,
    warRisk: 25,
    requiresSpy: true,
    description: "Break political marriages and alliances",
    effects: { influence: -15 },
    specialEffect: "marriages_broken",
  },
  spread_addiction: {
    category: "social",
    baseDifficulty: 45,
    detectChance: 25,
    warRisk: 15,
    requiresSpy: true,
    description: "Introduce addictive substances to weaken population",
    effects: { happiness: -15, wealth: -10 },
    specialEffect: "addiction_epidemic",
  },
  destroy_cultural_artifacts: {
    category: "social",
    baseDifficulty: 50,
    detectChance: 55,
    warRisk: 40,
    requiresSpy: false,
    description: "Burn art, destroy statues, erase cultural identity",
    effects: { happiness: -20, influence: -20 },
    specialEffect: "culture_destroyed",
  },
};

// =============================================
// SABOTAGE RESULT
// =============================================

export interface SabotageResult {
  success: boolean;
  detected: boolean;
  message: string;
  effectsApplied: Record<string, number>;
  specialEffectTriggered?: string;
  warDeclared?: boolean;
  spyCaptured?: boolean;
  attackerGains?: Record<string, number>;
}

// =============================================
// EXECUTE SABOTAGE
// =============================================

export async function executeSabotage(
  ctx: MutationCtx,
  attackerTerritoryId: Id<"territories">,
  targetTerritoryId: Id<"territories">,
  sabotageType: SabotageType,
  tick: number
): Promise<SabotageResult> {
  const attacker = await ctx.db.get(attackerTerritoryId);
  const target = await ctx.db.get(targetTerritoryId);

  if (!attacker || !target) {
    return { success: false, detected: false, message: "Territory not found", effectsApplied: {} };
  }

  const config = SABOTAGE_CONFIG[sabotageType];
  if (!config) {
    return { success: false, detected: false, message: "Unknown sabotage type", effectsApplied: {} };
  }

  // Check if spy is required and available
  let spy: Doc<"spies"> | null = null;
  if (config.requiresSpy) {
    const spies = await ctx.db
      .query("spies")
      .withIndex("by_owner", (q: any) => q.eq("ownerTerritoryId", attackerTerritoryId))
      .filter((q: any) => q.and(
        q.eq(q.field("targetTerritoryId"), targetTerritoryId),
        q.eq(q.field("status"), "active")
      ))
      .collect();

    if (spies.length === 0) {
      return {
        success: false,
        detected: false,
        message: `${sabotageType.replace(/_/g, " ")} requires a spy in the target territory.`,
        effectsApplied: {},
      };
    }
    spy = spies[0];
  }

  // Calculate success chance
  const spySkill = spy?.skill || 50;
  const skillModifier = (spySkill - 50) / 2;
  const counterIntel = target.spyNetwork?.counterIntelligence || 10;
  const successChance = Math.max(10, Math.min(90,
    (100 - config.baseDifficulty) + skillModifier - (counterIntel / 4)
  ));

  // Calculate detection chance
  const detectionChance = Math.max(5, Math.min(95,
    config.detectChance + (counterIntel / 2) - (spySkill / 4)
  ));

  // Roll for success and detection
  const success = Math.random() * 100 < successChance;
  const detected = Math.random() * 100 < detectionChance;

  const result: SabotageResult = {
    success,
    detected,
    message: "",
    effectsApplied: {},
  };

  if (success) {
    // Apply effects to target
    const updates: any = {};
    const effectsApplied: Record<string, number> = {};

    for (const [key, value] of Object.entries(config.effects)) {
      if (value !== 0 && value !== undefined) {
        const currentValue = (target as any)[key] || 0;
        const newValue = Math.max(0, Math.min(100, currentValue + value));
        updates[key] = newValue;
        effectsApplied[key] = value;
      }
    }

    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(targetTerritoryId, updates);
    }

    result.effectsApplied = effectsApplied;
    result.message = `SUCCESS: ${config.description}`;

    // Handle special effects
    if (config.specialEffect) {
      result.specialEffectTriggered = config.specialEffect;
      const specialResult = await handleSpecialEffect(
        ctx, attackerTerritoryId, targetTerritoryId, config.specialEffect, tick
      );
      if (specialResult.attackerGains) {
        result.attackerGains = specialResult.attackerGains;
      }
      if (specialResult.additionalMessage) {
        result.message += ` ${specialResult.additionalMessage}`;
      }
    }

    // Record memory for attacker
    const attackerAgent = await ctx.db
      .query("agents")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", attackerTerritoryId))
      .first();
    if (attackerAgent) {
      await recordMemory(ctx, attackerAgent._id, {
        type: "victory",
        description: `Our agents successfully executed ${sabotageType.replace(/_/g, " ")} against ${target.name}!`,
        emotionalWeight: 25,
        targetTerritoryId,
      });
    }
  } else {
    result.message = `FAILED: ${sabotageType.replace(/_/g, " ")} mission was unsuccessful.`;

    // Chance spy gets captured on failure
    if (spy && Math.random() < 0.35) {
      await ctx.db.patch(spy._id, {
        status: "captured",
        discoveryRisk: 100,
      });
      result.spyCaptured = true;
      result.message += " Your spy was captured!";
    }
  }

  // Handle detection
  if (detected) {
    result.message += ` WARNING: ${target.name} detected your involvement!`;

    // Damage relations
    const relationship = await ctx.db
      .query("relationships")
      .filter((q: any) => q.or(
        q.and(
          q.eq(q.field("territory1Id"), attackerTerritoryId),
          q.eq(q.field("territory2Id"), targetTerritoryId)
        ),
        q.and(
          q.eq(q.field("territory1Id"), targetTerritoryId),
          q.eq(q.field("territory2Id"), attackerTerritoryId)
        )
      ))
      .first();

    if (relationship) {
      const trustDamage = 20 + Math.floor(config.warRisk / 2);
      await ctx.db.patch(relationship._id, {
        trust: Math.max(-100, relationship.trust - trustDamage),
      });
    }

    // Check for war
    if (Math.random() * 100 < config.warRisk) {
      result.warDeclared = true;
      result.message += ` ${target.name} has declared WAR!`;

      if (relationship) {
        await ctx.db.patch(relationship._id, {
          status: "at_war",
          warStartTick: tick,
          warCasusBelli: `Sabotage: ${sabotageType.replace(/_/g, " ")}`,
        });
      }

      await ctx.db.insert("events", {
        tick,
        type: "war",
        territoryId: targetTerritoryId,
        targetTerritoryId: attackerTerritoryId,
        title: "War Declared - Sabotage Retaliation!",
        description: `${target.name} declares war on ${attacker.name} after discovering ${sabotageType.replace(/_/g, " ")}!`,
        severity: "critical",
        createdAt: Date.now(),
      });
    }

    // Record memory for target
    const targetAgent = await ctx.db
      .query("agents")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", targetTerritoryId))
      .first();
    if (targetAgent) {
      await recordMemory(ctx, targetAgent._id, {
        type: "betrayal",
        description: `${attacker.name} attempted ${sabotageType.replace(/_/g, " ")} against us! This treachery will not be forgotten.`,
        emotionalWeight: -50,
        targetTerritoryId: attackerTerritoryId,
      });
    }
  }

  return result;
}

// =============================================
// SPECIAL EFFECT HANDLERS
// =============================================

async function handleSpecialEffect(
  ctx: MutationCtx,
  attackerId: Id<"territories">,
  targetId: Id<"territories">,
  effect: string,
  tick: number
): Promise<{ attackerGains?: Record<string, number>; additionalMessage?: string }> {
  const attacker = await ctx.db.get(attackerId);
  const target = await ctx.db.get(targetId);
  if (!attacker || !target) return {};

  switch (effect) {
    case "tech_stolen": {
      // Attacker gains knowledge
      await ctx.db.patch(attackerId, {
        knowledge: Math.min(100, attacker.knowledge + 5),
        technology: Math.min(100, attacker.technology + 3),
      });
      return {
        attackerGains: { knowledge: 5, technology: 3 },
        additionalMessage: "You gained +5 knowledge and +3 technology!",
      };
    }

    case "soldiers_defect": {
      // Some soldiers join attacker
      await ctx.db.patch(attackerId, {
        military: Math.min(100, attacker.military + 8),
      });
      return {
        attackerGains: { military: 8 },
        additionalMessage: "Defecting soldiers joined your army! +8 military.",
      };
    }

    case "craftsmen_kidnapped": {
      // Move skilled workers to attacker
      const craftsmen = await ctx.db
        .query("characters")
        .withIndex("by_territory", (q: any) => q.eq("territoryId", targetId))
        .filter((q: any) => q.and(
          q.eq(q.field("isAlive"), true),
          q.or(
            q.eq(q.field("profession"), "blacksmith"),
            q.eq(q.field("profession"), "carpenter"),
            q.eq(q.field("profession"), "mason")
          )
        ))
        .collect();

      const kidnapped = craftsmen.slice(0, Math.min(3, craftsmen.length));
      for (const worker of kidnapped) {
        await ctx.db.patch(worker._id, {
          territoryId: attackerId,
        });
      }
      return {
        attackerGains: { craftsmen: kidnapped.length },
        additionalMessage: `Kidnapped ${kidnapped.length} skilled craftsmen!`,
      };
    }

    case "relics_stolen": {
      await ctx.db.patch(attackerId, {
        influence: Math.min(100, attacker.influence + 10),
      });
      return {
        attackerGains: { influence: 10 },
        additionalMessage: "Holy relics now adorn your temples! +10 influence.",
      };
    }

    case "battle_plans_stolen": {
      // Significant military advantage in next battle
      await ctx.db.patch(attackerId, {
        military: Math.min(100, attacker.military + 5),
      });
      return {
        attackerGains: { military: 5 },
        additionalMessage: "You know their battle plans! +5 military advantage.",
      };
    }

    case "general_killed": {
      // Kill the military leader
      const generals = await ctx.db
        .query("characters")
        .withIndex("by_territory", (q: any) => q.eq("territoryId", targetId))
        .filter((q: any) => q.and(
          q.eq(q.field("isAlive"), true),
          q.eq(q.field("role"), "general")
        ))
        .collect();

      if (generals.length > 0) {
        await ctx.db.patch(generals[0]._id, {
          isAlive: false,
          causeOfDeath: "assassination",
          deathTick: tick,
        });
        return { additionalMessage: `General ${generals[0].name} was assassinated!` };
      }
      break;
    }

    case "heir_killed": {
      // Kill the heir
      const heirs = await ctx.db
        .query("characters")
        .withIndex("by_territory", (q: any) => q.eq("territoryId", targetId))
        .filter((q: any) => q.and(
          q.eq(q.field("isAlive"), true),
          q.eq(q.field("role"), "heir")
        ))
        .collect();

      if (heirs.length > 0) {
        await ctx.db.patch(heirs[0]._id, {
          isAlive: false,
          causeOfDeath: "assassination",
          deathTick: tick,
        });
        return { additionalMessage: `Heir ${heirs[0].name} was assassinated! Succession crisis looms.` };
      }
      break;
    }

    case "priests_killed": {
      const priests = await ctx.db
        .query("characters")
        .withIndex("by_territory", (q: any) => q.eq("territoryId", targetId))
        .filter((q: any) => q.and(
          q.eq(q.field("isAlive"), true),
          q.eq(q.field("profession"), "priest")
        ))
        .collect();

      const killed = priests.slice(0, Math.min(3, priests.length));
      for (const priest of killed) {
        await ctx.db.patch(priest._id, {
          isAlive: false,
          causeOfDeath: "assassination",
          deathTick: tick,
        });
      }
      return { additionalMessage: `${killed.length} priests were killed!` };
    }

    case "healers_killed": {
      const healers = await ctx.db
        .query("characters")
        .withIndex("by_territory", (q: any) => q.eq("territoryId", targetId))
        .filter((q: any) => q.and(
          q.eq(q.field("isAlive"), true),
          q.eq(q.field("profession"), "physician")
        ))
        .collect();

      for (const healer of healers) {
        await ctx.db.patch(healer._id, {
          isAlive: false,
          causeOfDeath: "assassination",
          deathTick: tick,
        });
      }
      return { additionalMessage: `All healers eliminated! Disease will spread unchecked.` };
    }

    case "plague_started":
    case "disease_outbreak": {
      // Mark territory as having active disease
      await ctx.db.patch(targetId, {
        sickPopulation: Math.min(target.population, (target.sickPopulation || 0) + 20),
      });
      return { additionalMessage: "Disease spreads through their population!" };
    }

    case "rebellion_started": {
      // Create a rebel faction
      await ctx.db.insert("factions", {
        territoryId: targetId,
        name: "Rebel Movement",
        type: "rebel",
        power: 30,
        loyalty: 0,
        grievances: ["Foreign-backed uprising"],
        isRebelling: true,
        rebellionRisk: 80,
        createdAt: Date.now(),
      });
      return { additionalMessage: "A rebel faction has formed!" };
    }

    case "population_drain": {
      // Some people move to attacker
      const populationGain = Math.min(5, Math.floor(target.population * 0.05));
      await ctx.db.patch(attackerId, {
        population: attacker.population + populationGain,
      });
      return {
        attackerGains: { population: populationGain },
        additionalMessage: `${populationGain} people emigrated to your lands!`,
      };
    }
  }

  return {};
}

// =============================================
// GET SABOTAGE OPPORTUNITIES
// =============================================

export async function getSabotageOpportunities(
  ctx: QueryCtx,
  territoryId: Id<"territories">
): Promise<Array<{
  targetName: string;
  targetId: Id<"territories">;
  hasSpy: boolean;
  counterIntel: number;
  vulnerabilities: Array<{ type: SabotageType; successChance: number }>;
}>> {
  const territory = await ctx.db.get(territoryId);
  if (!territory) return [];

  // Get our spies
  const ourSpies = await ctx.db
    .query("spies")
    .withIndex("by_owner", (q: any) => q.eq("ownerTerritoryId", territoryId))
    .filter((q: any) => q.eq(q.field("status"), "active"))
    .collect();

  const spyTargets = new Set(ourSpies.map(s => s.targetTerritoryId.toString()));

  // Get all other territories
  const allTerritories = await ctx.db.query("territories").collect();
  const opportunities = [];

  for (const target of allTerritories) {
    if (target._id === territoryId) continue;
    if ((target as any).isEliminated) continue;

    const hasSpy = spyTargets.has(target._id.toString());
    const counterIntel = target.spyNetwork?.counterIntelligence || 10;

    // Calculate vulnerabilities
    const vulnerabilities: Array<{ type: SabotageType; successChance: number }> = [];

    // Check a few key sabotage types
    const keyTypes: SabotageType[] = [
      "burn_granaries", "poison_crops", "incite_rebellion",
      "spread_propaganda", "sabotage_weapons", "spread_plague"
    ];

    for (const sabType of keyTypes) {
      const config = SABOTAGE_CONFIG[sabType];
      if (config.requiresSpy && !hasSpy) continue;

      const spySkill = hasSpy ? 60 : 50;
      const successChance = Math.max(10, Math.min(90,
        (100 - config.baseDifficulty) + ((spySkill - 50) / 2) - (counterIntel / 4)
      ));

      if (successChance > 30) {
        vulnerabilities.push({ type: sabType, successChance: Math.round(successChance) });
      }
    }

    if (vulnerabilities.length > 0 || hasSpy) {
      opportunities.push({
        targetName: target.name,
        targetId: target._id,
        hasSpy,
        counterIntel,
        vulnerabilities: vulnerabilities.sort((a, b) => b.successChance - a.successChance).slice(0, 5),
      });
    }
  }

  return opportunities;
}
