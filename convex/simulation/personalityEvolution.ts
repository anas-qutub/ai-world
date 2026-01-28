import { Doc, Id } from "../_generated/dataModel";
import { MutationCtx } from "../_generated/server";

// =============================================
// PERSONALITY EVOLUTION SYSTEM
// =============================================
// Personalities are not fixed - they evolve based on:
// 1. Actions the AI chooses to take
// 2. Outcomes of those actions (success/failure)
// 3. Events that happen to the civilization
//
// This creates emergent, organic AI personalities!

// How much a single action affects personality (small incremental changes)
const ACTION_IMPACT = 2;
const OUTCOME_IMPACT = 3;
const EVENT_IMPACT = 4;

// Clamp personality values between 0 and 100
function clamp(value: number): number {
  return Math.max(0, Math.min(100, value));
}

// Define how each action type affects personality traits
const ACTION_PERSONALITY_EFFECTS: Record<string, Partial<Record<string, number>>> = {
  // === AGGRESSIVE ACTIONS ===
  "raid": {
    aggression: +ACTION_IMPACT,
    ruthlessness: +ACTION_IMPACT,
    cooperation: -ACTION_IMPACT,
    xenophobia: +ACTION_IMPACT / 2,
  },
  "declare_war": {
    aggression: +ACTION_IMPACT * 2,
    ruthlessness: +ACTION_IMPACT,
    cooperation: -ACTION_IMPACT * 2,
    patience: -ACTION_IMPACT,
    defensiveness: -ACTION_IMPACT,
  },
  "pillage": {
    aggression: +ACTION_IMPACT,
    ruthlessness: +ACTION_IMPACT * 2,
    cooperation: -ACTION_IMPACT,
  },
  "raid_caravan": {
    aggression: +ACTION_IMPACT,
    ruthlessness: +ACTION_IMPACT,
    opportunism: +ACTION_IMPACT,
  },

  // === DIPLOMATIC ACTIONS ===
  "propose_alliance": {
    cooperation: +ACTION_IMPACT * 2,
    aggression: -ACTION_IMPACT,
    xenophobia: -ACTION_IMPACT,
    patience: +ACTION_IMPACT / 2,
  },
  "propose_trade": {
    cooperation: +ACTION_IMPACT,
    mercantilism: -ACTION_IMPACT,
    xenophobia: -ACTION_IMPACT / 2,
  },
  "send_gift": {
    cooperation: +ACTION_IMPACT,
    ruthlessness: -ACTION_IMPACT,
    frugality: -ACTION_IMPACT / 2,
  },
  "offer_peace": {
    cooperation: +ACTION_IMPACT,
    aggression: -ACTION_IMPACT,
    patience: +ACTION_IMPACT,
  },
  "accept_peace": {
    cooperation: +ACTION_IMPACT,
    aggression: -ACTION_IMPACT,
    pragmatism: +ACTION_IMPACT,
  },

  // === ECONOMIC ACTIONS ===
  "send_caravan": {
    cooperation: +ACTION_IMPACT / 2,
    mercantilism: -ACTION_IMPACT,
    riskTolerance: +ACTION_IMPACT / 2,
  },
  "stockpile_food": {
    frugality: +ACTION_IMPACT,
    patience: +ACTION_IMPACT / 2,
  },
  "gather_wood": {
    frugality: +ACTION_IMPACT / 2,
    pragmatism: +ACTION_IMPACT / 2,
  },
  "build_shelter": {
    defensiveness: +ACTION_IMPACT / 2,
    patience: +ACTION_IMPACT / 2,
  },
  "increase_taxes": {
    taxation: +ACTION_IMPACT,
    authoritarianism: +ACTION_IMPACT / 2,
  },
  "reduce_taxes": {
    taxation: -ACTION_IMPACT,
    authoritarianism: -ACTION_IMPACT / 2,
  },

  // === MILITARY ACTIONS ===
  "recruit_soldiers": {
    militarism: +ACTION_IMPACT,
  },
  "build_fortifications": {
    defensiveness: +ACTION_IMPACT * 2,
    militarism: +ACTION_IMPACT,
    patience: +ACTION_IMPACT / 2,
  },
  "train_army": {
    militarism: +ACTION_IMPACT,
    patience: +ACTION_IMPACT / 2,
  },
  "raise_militia": {
    militarism: +ACTION_IMPACT / 2,
    centralization: +ACTION_IMPACT / 2,
  },
  "patrol_routes": {
    defensiveness: +ACTION_IMPACT,
    militarism: +ACTION_IMPACT / 2,
  },

  // === KNOWLEDGE/INNOVATION ===
  "research": {
    innovation: +ACTION_IMPACT,
    patience: +ACTION_IMPACT / 2,
    traditionalism: -ACTION_IMPACT / 2,
  },
  "research_technology": {
    innovation: +ACTION_IMPACT * 2,
    patience: +ACTION_IMPACT,
  },
  "establish_academy": {
    innovation: +ACTION_IMPACT * 2,
    patience: +ACTION_IMPACT,
    frugality: -ACTION_IMPACT / 2,
  },
  "share_technology": {
    cooperation: +ACTION_IMPACT,
    innovation: +ACTION_IMPACT / 2,
    mercantilism: -ACTION_IMPACT,
  },
  "steal_technology": {
    opportunism: +ACTION_IMPACT,
    ruthlessness: +ACTION_IMPACT / 2,
    cooperation: -ACTION_IMPACT,
  },

  // === EXPANSION ===
  "expand_territory": {
    expansionism: +ACTION_IMPACT * 2,
    riskTolerance: +ACTION_IMPACT / 2,
  },
  "promote_births": {
    expansionism: +ACTION_IMPACT,
    patience: +ACTION_IMPACT / 2,
  },

  // === GOVERNANCE ===
  "execute_character": {
    ruthlessness: +ACTION_IMPACT * 2,
    paranoia: +ACTION_IMPACT,
    authoritarianism: +ACTION_IMPACT,
  },
  "investigate_plot": {
    paranoia: +ACTION_IMPACT,
  },
  "suppress_faction": {
    authoritarianism: +ACTION_IMPACT * 2,
    ruthlessness: +ACTION_IMPACT,
    centralization: +ACTION_IMPACT,
  },
  "appease_faction": {
    ruthlessness: -ACTION_IMPACT,
    pragmatism: +ACTION_IMPACT,
    centralization: -ACTION_IMPACT / 2,
  },

  // === CULTURAL/RELIGIOUS ===
  "hold_feast": {
    frugality: -ACTION_IMPACT,
    cooperation: +ACTION_IMPACT / 2,
  },
  "hold_festival": {
    religiosity: +ACTION_IMPACT / 2,
    traditionalism: +ACTION_IMPACT / 2,
    frugality: -ACTION_IMPACT,
  },
  "build_temple": {
    religiosity: +ACTION_IMPACT * 2,
    traditionalism: +ACTION_IMPACT,
  },
  "spread_culture": {
    expansionism: +ACTION_IMPACT / 2,
    xenophobia: -ACTION_IMPACT,
  },

  // === DEFENSIVE/PASSIVE ===
  "rest": {
    patience: +ACTION_IMPACT / 2,
    riskTolerance: -ACTION_IMPACT / 2,
  },
  "do_nothing": {
    patience: +ACTION_IMPACT / 2,
    opportunism: -ACTION_IMPACT / 2,
  },
  "fortify": {
    defensiveness: +ACTION_IMPACT * 2,
    patience: +ACTION_IMPACT,
  },
};

/**
 * Evolve personality based on an action taken
 */
export async function evolvePersonalityFromAction(
  ctx: MutationCtx,
  agentId: Id<"agents">,
  action: string
): Promise<{ changes: Record<string, number> }> {
  const agent = await ctx.db.get(agentId);
  if (!agent || !agent.personalityParams) {
    return { changes: {} };
  }

  const effects = ACTION_PERSONALITY_EFFECTS[action];
  if (!effects) {
    return { changes: {} };
  }

  const params = { ...agent.personalityParams };
  const changes: Record<string, number> = {};

  for (const [trait, delta] of Object.entries(effects)) {
    if (delta && trait in params) {
      const oldValue = (params as any)[trait];
      const newValue = clamp(oldValue + delta);
      (params as any)[trait] = newValue;
      changes[trait] = newValue - oldValue;
    }
  }

  // Update the agent's personality
  await ctx.db.patch(agentId, { personalityParams: params });

  return { changes };
}

/**
 * Evolve personality based on outcomes (success/failure of actions)
 */
export async function evolvePersonalityFromOutcome(
  ctx: MutationCtx,
  agentId: Id<"agents">,
  outcomeType: string,
  success: boolean
): Promise<{ changes: Record<string, number> }> {
  const agent = await ctx.db.get(agentId);
  if (!agent || !agent.personalityParams) {
    return { changes: {} };
  }

  const params = { ...agent.personalityParams };
  const changes: Record<string, number> = {};

  // Define outcome effects
  const outcomeEffects: Record<string, { success: Record<string, number>; failure: Record<string, number> }> = {
    "war": {
      success: { aggression: +OUTCOME_IMPACT, riskTolerance: +OUTCOME_IMPACT, militarism: +OUTCOME_IMPACT },
      failure: { aggression: -OUTCOME_IMPACT, defensiveness: +OUTCOME_IMPACT * 2, patience: +OUTCOME_IMPACT },
    },
    "raid": {
      success: { aggression: +OUTCOME_IMPACT, ruthlessness: +OUTCOME_IMPACT, opportunism: +OUTCOME_IMPACT },
      failure: { aggression: -OUTCOME_IMPACT / 2, riskTolerance: -OUTCOME_IMPACT },
    },
    "trade": {
      success: { cooperation: +OUTCOME_IMPACT, mercantilism: -OUTCOME_IMPACT },
      failure: { cooperation: -OUTCOME_IMPACT / 2, mercantilism: +OUTCOME_IMPACT },
    },
    "alliance": {
      success: { cooperation: +OUTCOME_IMPACT * 2, xenophobia: -OUTCOME_IMPACT },
      failure: { cooperation: -OUTCOME_IMPACT, paranoia: +OUTCOME_IMPACT },
    },
    "research": {
      success: { innovation: +OUTCOME_IMPACT, patience: +OUTCOME_IMPACT / 2 },
      failure: { innovation: -OUTCOME_IMPACT / 2, pragmatism: +OUTCOME_IMPACT },
    },
    "expansion": {
      success: { expansionism: +OUTCOME_IMPACT, riskTolerance: +OUTCOME_IMPACT },
      failure: { expansionism: -OUTCOME_IMPACT, defensiveness: +OUTCOME_IMPACT },
    },
    "plot_discovered": {
      success: { paranoia: +OUTCOME_IMPACT },
      failure: { paranoia: +OUTCOME_IMPACT * 2, ruthlessness: +OUTCOME_IMPACT },
    },
    "betrayal": {
      success: {}, // Being the betrayer
      failure: { cooperation: -OUTCOME_IMPACT * 2, paranoia: +OUTCOME_IMPACT * 2, xenophobia: +OUTCOME_IMPACT },
    },
  };

  const effects = outcomeEffects[outcomeType];
  if (!effects) {
    return { changes: {} };
  }

  const deltaMap = success ? effects.success : effects.failure;

  for (const [trait, delta] of Object.entries(deltaMap)) {
    if (trait in params) {
      const oldValue = (params as any)[trait];
      const newValue = clamp(oldValue + delta);
      (params as any)[trait] = newValue;
      changes[trait] = newValue - oldValue;
    }
  }

  await ctx.db.patch(agentId, { personalityParams: params });

  return { changes };
}

/**
 * Evolve personality based on events (things that happen to the civilization)
 */
export async function evolvePersonalityFromEvent(
  ctx: MutationCtx,
  agentId: Id<"agents">,
  eventType: string
): Promise<{ changes: Record<string, number> }> {
  const agent = await ctx.db.get(agentId);
  if (!agent || !agent.personalityParams) {
    return { changes: {} };
  }

  const params = { ...agent.personalityParams };
  const changes: Record<string, number> = {};

  // Define event effects
  const eventEffects: Record<string, Record<string, number>> = {
    // Crises make civilizations more cautious/defensive
    "famine": {
      frugality: +EVENT_IMPACT * 2,
      riskTolerance: -EVENT_IMPACT,
      patience: +EVENT_IMPACT,
    },
    "plague": {
      xenophobia: +EVENT_IMPACT,
      paranoia: +EVENT_IMPACT,
      religiosity: +EVENT_IMPACT,
    },
    "invasion": {
      militarism: +EVENT_IMPACT * 2,
      defensiveness: +EVENT_IMPACT * 2,
      xenophobia: +EVENT_IMPACT,
    },
    "rebellion": {
      paranoia: +EVENT_IMPACT * 2,
      authoritarianism: +EVENT_IMPACT,
      ruthlessness: +EVENT_IMPACT,
    },

    // Prosperity can breed complacency or ambition
    "golden_age": {
      riskTolerance: +EVENT_IMPACT,
      frugality: -EVENT_IMPACT,
      patience: -EVENT_IMPACT / 2,
    },
    "trade_boom": {
      cooperation: +EVENT_IMPACT,
      mercantilism: -EVENT_IMPACT,
    },
    "tech_breakthrough": {
      innovation: +EVENT_IMPACT * 2,
      traditionalism: -EVENT_IMPACT,
    },
    "military_victory": {
      aggression: +EVENT_IMPACT,
      militarism: +EVENT_IMPACT,
      riskTolerance: +EVENT_IMPACT,
    },
    "military_defeat": {
      defensiveness: +EVENT_IMPACT * 2,
      aggression: -EVENT_IMPACT,
      patience: +EVENT_IMPACT,
    },

    // Leadership events
    "ruler_death": {
      centralization: -EVENT_IMPACT,
      paranoia: +EVENT_IMPACT,
    },
    "assassination_attempt": {
      paranoia: +EVENT_IMPACT * 3,
      ruthlessness: +EVENT_IMPACT,
    },
    "succession_crisis": {
      centralization: -EVENT_IMPACT * 2,
      authoritarianism: +EVENT_IMPACT,
    },

    // Diplomatic events
    "alliance_broken": {
      cooperation: -EVENT_IMPACT * 2,
      paranoia: +EVENT_IMPACT,
      xenophobia: +EVENT_IMPACT,
    },
    "new_ally": {
      cooperation: +EVENT_IMPACT,
      xenophobia: -EVENT_IMPACT,
    },
    "diplomatic_insult": {
      aggression: +EVENT_IMPACT,
      cooperation: -EVENT_IMPACT,
    },
  };

  const effects = eventEffects[eventType];
  if (!effects) {
    return { changes: {} };
  }

  for (const [trait, delta] of Object.entries(effects)) {
    if (trait in params) {
      const oldValue = (params as any)[trait];
      const newValue = clamp(oldValue + delta);
      (params as any)[trait] = newValue;
      changes[trait] = newValue - oldValue;
    }
  }

  await ctx.db.patch(agentId, { personalityParams: params });

  return { changes };
}

/**
 * Get the dominant personality archetype based on current traits
 * This is emergent - derived from the evolved traits, not predetermined
 */
export function deriveArchetype(params: Doc<"agents">["personalityParams"]): string {
  if (!params) return "Unknown";

  // Calculate archetype scores based on trait combinations
  const scores: Record<string, number> = {
    "Conqueror": params.aggression + params.militarism + params.ruthlessness - params.cooperation,
    "Diplomat": params.cooperation + params.patience - params.aggression - params.xenophobia,
    "Scholar": params.innovation + params.patience - params.militarism,
    "Trader": params.cooperation - params.mercantilism + params.opportunism - params.xenophobia,
    "Survivor": params.pragmatism + params.frugality + params.defensiveness,
    "Isolationist": params.xenophobia + params.defensiveness + params.mercantilism - params.cooperation,
    "Tyrant": params.authoritarianism + params.ruthlessness + params.paranoia,
    "Liberator": 100 - params.authoritarianism + params.cooperation - params.ruthlessness,
    "Zealot": params.religiosity + params.traditionalism + params.xenophobia,
    "Reformer": params.innovation - params.traditionalism + 100 - params.authoritarianism,
  };

  // Find the highest scoring archetype
  let maxScore = -Infinity;
  let archetype = "Balanced";

  for (const [name, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      archetype = name;
    }
  }

  // If no archetype scores highly, they're balanced
  if (maxScore < 100) {
    return "Emerging";
  }

  return archetype;
}

/**
 * Update the agent's displayed personality archetype
 */
export async function updateAgentArchetype(
  ctx: MutationCtx,
  agentId: Id<"agents">
): Promise<string> {
  const agent = await ctx.db.get(agentId);
  if (!agent || !agent.personalityParams) {
    return "Unknown";
  }

  const archetype = deriveArchetype(agent.personalityParams);

  await ctx.db.patch(agentId, { personality: archetype });

  return archetype;
}
