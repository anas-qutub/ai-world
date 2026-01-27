import { internalMutation, query, MutationCtx } from "../_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "../_generated/dataModel";

// =============================================
// CONTINUOUS PROSPERITY SYSTEM
// Score is calculated dynamically from territory conditions
// Tiers are derived from score ranges for narrative purposes
// =============================================

// Prosperity tier thresholds (derived from continuous score)
const TIER_THRESHOLDS = {
  struggling: 0,      // 0-24
  stable: 25,         // 25-49
  growing: 50,        // 50-74
  flourishing: 75,    // 75-99
  prosperous: 100,    // 100-149
  goldenAge: 150,     // 150+
};

// Tier names for narrative purposes
export const PROSPERITY_TIER_NAMES: Record<number, { name: string; description: string }> = {
  0: { name: "Struggling", description: "The people suffer. Basic needs are not being met." },
  1: { name: "Stable", description: "Basic needs are met. The people survive, if not thrive." },
  2: { name: "Growing", description: "The territory is developing. Hope stirs in the people." },
  3: { name: "Flourishing", description: "Trade flows, bellies are full, and arts begin to bloom." },
  4: { name: "Prosperous", description: "Wealth abounds. Great works are undertaken. But ambition stirs..." },
  5: { name: "Golden Age", description: "The pinnacle of civilization. But all golden ages must end..." },
};

// Calculate continuous prosperity score from territory conditions
export function calculateProsperityScore(territory: Doc<"territories">): number {
  // Economic factor: food security and wealth
  const foodPerCapita = territory.food / Math.max(1, territory.population);
  const foodSecurity = Math.min(1, foodPerCapita / 2) * 100; // 0-100 based on food/person
  const wealthFactor = territory.wealth; // Already 0-100+

  // Social factor: happiness and population health
  const socialFactor = territory.happiness; // 0-100+

  // Military factor: security feeling (moderate is best, too high or low is bad)
  const militaryFactor = territory.military > 60
    ? 60 - (territory.military - 60) * 0.3 // Diminishing returns above 60
    : territory.military;

  // Cultural factor: influence and knowledge
  const culturalFactor = (territory.influence + territory.knowledge) / 2;

  // Technology factor: advancement level
  const techFactor = territory.technology * 0.5;

  // Weight and combine factors
  // Economic: 30%, Social: 30%, Cultural: 20%, Military: 10%, Tech: 10%
  const score =
    (foodSecurity * 0.15 + wealthFactor * 0.15) + // Economic 30%
    (socialFactor * 0.30) + // Social 30%
    (culturalFactor * 0.20) + // Cultural 20%
    (militaryFactor * 0.10) + // Military 10%
    (techFactor * 0.10); // Tech 10%

  return Math.max(0, score);
}

// Derive tier from continuous score
export function getTierFromScore(score: number): number {
  if (score >= TIER_THRESHOLDS.goldenAge) return 5;
  if (score >= TIER_THRESHOLDS.prosperous) return 4;
  if (score >= TIER_THRESHOLDS.flourishing) return 3;
  if (score >= TIER_THRESHOLDS.growing) return 2;
  if (score >= TIER_THRESHOLDS.stable) return 1;
  return 0;
}

// Calculate complacency growth based on continuous score
function calculateComplacencyGrowth(score: number): number {
  // Complacency grows faster at higher prosperity levels
  // Smooth exponential curve
  if (score < 50) return 0;
  return Math.pow((score - 50) / 100, 1.5) * 5;
}

// Calculate decadence growth based on prosperity and complacency
function calculateDecadenceGrowth(score: number, complacencyLevel: number): number {
  // Decadence requires both high prosperity AND complacency
  if (score < 75 || complacencyLevel < 30) return 0;
  const prosperityExcess = (score - 75) / 75;
  const complacencyFactor = complacencyLevel / 100;
  return prosperityExcess * complacencyFactor * 3;
}

// Legacy tier config for backwards compatibility during transition
export const PROSPERITY_TIERS = {
  0: {
    name: "Struggling",
    description: "The people suffer. Basic needs are not being met.",
    requirements: { happiness: 0, food: 0, wealth: 0 },
    complacencyGrowth: 0,
    decadenceGrowth: 0,
    plotChanceModifier: 0,
    benefits: "None",
  },
  1: {
    name: "Stable",
    description: "Basic needs are met. The people survive, if not thrive.",
    requirements: { happiness: 40, food: 35, wealth: 25 },
    complacencyGrowth: 0.5,
    decadenceGrowth: 0,
    plotChanceModifier: 0,
    benefits: "+2% birth rate",
  },
  2: {
    name: "Growing",
    description: "The territory is developing. Hope stirs in the people.",
    requirements: { happiness: 50, food: 50, wealth: 40 },
    complacencyGrowth: 1,
    decadenceGrowth: 0.2,
    plotChanceModifier: 0.02,
    benefits: "+5% birth rate, +1 immigration",
  },
  3: {
    name: "Flourishing",
    description: "Trade flows, bellies are full, and arts begin to bloom.",
    requirements: { happiness: 60, food: 60, wealth: 55 },
    complacencyGrowth: 2,
    decadenceGrowth: 0.5,
    plotChanceModifier: 0.05,
    benefits: "+10% production, +2 influence per tick",
  },
  4: {
    name: "Prosperous",
    description: "Wealth abounds. Great works are undertaken. But ambition stirs...",
    requirements: { happiness: 70, food: 70, wealth: 70 },
    complacencyGrowth: 3,
    decadenceGrowth: 1,
    plotChanceModifier: 0.1,
    benefits: "+15% production, +3 influence, +2 knowledge per tick",
  },
  5: {
    name: "Golden Age",
    description: "The pinnacle of civilization. But all golden ages must end...",
    requirements: { happiness: 80, food: 75, wealth: 80, ticksAtTier4: 24 },
    complacencyGrowth: 5,
    decadenceGrowth: 2,
    plotChanceModifier: 0.15,
    benefits: "+25% production, +5 influence, +5 knowledge, unique buildings unlocked",
  },
};

// =============================================
// INITIALIZE PROSPERITY TIER
// =============================================

export async function initializeProsperityTier(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  tick: number
): Promise<{ success: boolean; error?: string }> {
  const existing = await ctx.db
    .query("prosperityTiers")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .first();

  if (existing) {
    return { success: false, error: "Already initialized" };
  }

  await ctx.db.insert("prosperityTiers", {
    territoryId,
    currentTier: 0,
    tierName: PROSPERITY_TIERS[0].name,
    progressToNextTier: 0,
    ticksAtCurrentTier: 0,
    tierHistory: [{
      tier: 0,
      tierName: PROSPERITY_TIERS[0].name,
      enteredTick: tick,
    }],
    complacencyLevel: 0,
    decadenceLevel: 0,
    stabilityFactors: {
      economicStability: 50,
      socialHarmony: 50,
      militaryReadiness: 50,
      politicalUnity: 50,
    },
  });

  return { success: true };
}

// =============================================
// UPDATE PROSPERITY TIER (CONTINUOUS SYSTEM)
// =============================================

export async function updateProsperityTier(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  tick: number
): Promise<{
  success: boolean;
  error?: string;
  currentTier?: number;
  tierName?: string;
  prosperityScore?: number;
  complacencyLevel?: number;
  decadenceLevel?: number;
  events?: string[];
}> {
  const territory = await ctx.db.get(territoryId);
  if (!territory) return { success: false, error: "Territory not found" };

  let prosperity = await ctx.db
    .query("prosperityTiers")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .first();

  if (!prosperity) {
    // Initialize if missing
    await initializeProsperityTier(ctx, territoryId, tick);
    prosperity = await ctx.db
      .query("prosperityTiers")
      .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
      .first();
    if (!prosperity) return { success: false, error: "Failed to initialize" };
  }

  const events: string[] = [];

  // =============================================
  // CALCULATE CONTINUOUS PROSPERITY SCORE
  // =============================================

  const prosperityScore = calculateProsperityScore(territory);
  const newTier = getTierFromScore(prosperityScore);
  const oldTier = prosperity.currentTier;

  // Generate events for tier changes
  if (newTier > oldTier) {
    const tierInfo = PROSPERITY_TIER_NAMES[newTier];
    events.push(`${territory.name} has risen to ${tierInfo.name}!`);
    if (newTier === 5) {
      events.push(`A GOLDEN AGE begins in ${territory.name}! But with glory comes complacency...`);
    }
  } else if (newTier < oldTier) {
    const oldTierInfo = PROSPERITY_TIER_NAMES[oldTier];
    const newTierInfo = PROSPERITY_TIER_NAMES[newTier];
    events.push(`${territory.name} has fallen from ${oldTierInfo.name} to ${newTierInfo.name}!`);
  }

  // =============================================
  // UPDATE COMPLACENCY AND DECADENCE (CONTINUOUS)
  // =============================================

  // Calculate growth based on continuous prosperity score
  const complacencyGrowth = calculateComplacencyGrowth(prosperityScore);
  const decadenceGrowth = calculateDecadenceGrowth(prosperityScore, prosperity.complacencyLevel);

  let newComplacency = prosperity.complacencyLevel + complacencyGrowth;
  let newDecadence = prosperity.decadenceLevel + decadenceGrowth;

  // Complacency and decadence decay when conditions worsen
  // Decay is proportional to how bad things are
  if (territory.happiness < 50) {
    const decayFactor = (50 - territory.happiness) / 50;
    newComplacency = Math.max(0, newComplacency - decayFactor * 3);
    newDecadence = Math.max(0, newDecadence - decayFactor * 1.5);
  }

  // Food shortage snaps people out of complacency
  const foodPerCapita = territory.food / Math.max(1, territory.population);
  if (foodPerCapita < 1.0) {
    const urgency = 1 - foodPerCapita;
    newComplacency = Math.max(0, newComplacency - urgency * 5);
  }

  // War reduces complacency - continuous scaling based on war intensity
  const relationships = await ctx.db.query("relationships").collect();
  const warRelations = relationships.filter(
    (r) =>
      (r.territory1Id === territoryId || r.territory2Id === territoryId) &&
      r.status === "at_war"
  );

  if (warRelations.length > 0) {
    // War intensity based on exhaustion and number of wars
    const avgExhaustion = warRelations.reduce((sum, r) => sum + (r.warExhaustion || 50), 0) / warRelations.length;
    const warImpact = (avgExhaustion / 100) * 5 * warRelations.length;
    newComplacency = Math.max(0, newComplacency - warImpact);
  }

  // No artificial caps on complacency/decadence - they can grow naturally
  // But apply soft diminishing returns at extreme values
  newComplacency = Math.max(0, newComplacency);
  newDecadence = Math.max(0, newDecadence);

  // =============================================
  // UPDATE STABILITY FACTORS
  // =============================================

  const isAtWar = warRelations.length > 0;
  const stabilityFactors = {
    economicStability: calculateEconomicStability(territory),
    socialHarmony: calculateSocialHarmony(territory),
    militaryReadiness: calculateMilitaryReadiness(territory, isAtWar),
    politicalUnity: await calculatePoliticalUnity(ctx, territoryId),
  };

  // =============================================
  // SAVE PROSPERITY STATE
  // =============================================

  const tierInfo = PROSPERITY_TIER_NAMES[newTier];

  if (newTier !== prosperity.currentTier) {
    // Update tier history
    const newHistory = [...prosperity.tierHistory];

    // End current tier
    if (newHistory.length > 0) {
      const lastEntry = newHistory[newHistory.length - 1];
      if (!lastEntry.exitedTick) {
        lastEntry.exitedTick = tick;
        lastEntry.exitReason = newTier < prosperity.currentTier ? "Conditions worsened" : "Prosperity grew";
      }
    }

    // Add new tier entry
    newHistory.push({
      tier: newTier,
      tierName: tierInfo.name,
      enteredTick: tick,
    });

    await ctx.db.patch(prosperity._id, {
      currentTier: newTier,
      tierName: tierInfo.name,
      progressToNextTier: prosperityScore, // Store actual score as progress
      ticksAtCurrentTier: 0,
      tierHistory: newHistory,
      complacencyLevel: newComplacency,
      decadenceLevel: newDecadence,
      stabilityFactors,
    });
  } else {
    // Just update values
    await ctx.db.patch(prosperity._id, {
      progressToNextTier: prosperityScore, // Store actual score
      complacencyLevel: newComplacency,
      decadenceLevel: newDecadence,
      stabilityFactors,
      ticksAtCurrentTier: prosperity.ticksAtCurrentTier + 1,
    });
  }

  // =============================================
  // CHECK FOR PROSPERITY-INDUCED PROBLEMS
  // Uses continuous thresholds instead of hard boundaries
  // =============================================

  // Complacency warnings - continuous scaling
  if (newComplacency > 50 && newComplacency <= 70) {
    events.push(`Complacency is growing in ${territory.name}.`);
  } else if (newComplacency > 70) {
    events.push(`Complacency has taken hold in ${territory.name}. The military grows soft.`);
  }

  // Decadence warnings - continuous scaling
  if (newDecadence > 50 && newDecadence <= 70) {
    events.push(`Signs of decadence appear in ${territory.name}'s court.`);
  } else if (newDecadence > 70) {
    events.push(`Decadence spreads through ${territory.name}'s court. Corruption flourishes.`);
  }

  return {
    success: true,
    currentTier: newTier,
    tierName: tierInfo.name,
    prosperityScore,
    complacencyLevel: newComplacency,
    decadenceLevel: newDecadence,
    events,
  };
}

// =============================================
// HELPER FUNCTIONS
// =============================================

function calculateProgressRate(territory: Doc<"territories">, prosperity: Doc<"prosperityTiers">): number {
  let baseRate = 5; // Base 5% per tick

  // Higher stats = faster progress
  if (territory.happiness > 70) baseRate += 2;
  if (territory.food > 70) baseRate += 2;
  if (territory.wealth > 70) baseRate += 2;
  if (territory.technology > 50) baseRate += 1;
  if (territory.knowledge > 50) baseRate += 1;

  // Stability helps
  const avgStability = (
    prosperity.stabilityFactors.economicStability +
    prosperity.stabilityFactors.socialHarmony +
    prosperity.stabilityFactors.militaryReadiness +
    prosperity.stabilityFactors.politicalUnity
  ) / 4;

  if (avgStability > 70) baseRate += 3;
  else if (avgStability > 50) baseRate += 1;

  return baseRate;
}

function calculateEconomicStability(territory: Doc<"territories">): number {
  // Continuous calculation based on food and wealth
  const foodPerCapita = territory.food / Math.max(1, territory.population);

  // Food security contributes 50% of economic stability
  // Full security at foodPerCapita >= 2
  const foodSecurity = Math.min(1, foodPerCapita / 2) * 50;

  // Wealth contributes 50% of economic stability
  // Using logarithmic scale to handle values above 100
  const wealthStability = Math.min(50, territory.wealth * 0.5);

  return Math.max(0, foodSecurity + wealthStability);
}

function calculateSocialHarmony(territory: Doc<"territories">): number {
  // Base harmony from happiness
  let harmony = territory.happiness;

  // Influence contributes to unity (continuous scaling)
  harmony += (territory.influence - 50) * 0.2;

  return Math.max(0, harmony);
}

function calculateMilitaryReadiness(territory: Doc<"territories">, isAtWar: boolean): number {
  let readiness = territory.military;

  // War keeps military sharp (bonus, but with exhaustion factor)
  if (isAtWar) {
    readiness += 15;
  }

  // No artificial cap - readiness can exceed 100
  return Math.max(0, readiness);
}

async function calculatePoliticalUnity(ctx: any, territoryId: Id<"territories">): Promise<number> {
  let unity = 50;

  // Get factions
  const factions = await ctx.db
    .query("factions")
    .withIndex("by_territory", (q: any) => q.eq("territoryId", territoryId))
    .collect();

  // Factions reduce unity - continuous scaling
  // Each faction beyond the first reduces unity
  if (factions.length > 1) {
    unity -= (factions.length - 1) * 8;
  }

  // Rebellious factions reduce unity based on their rebellion risk
  for (const faction of factions) {
    if (faction.rebellionRisk > 30) {
      unity -= (faction.rebellionRisk - 30) * 0.3;
    }
  }

  // Get characters and check for plots
  const characters = await ctx.db
    .query("characters")
    .withIndex("by_territory", (q: any) => q.eq("territoryId", territoryId))
    .filter((q: any) => q.eq(q.field("isAlive"), true))
    .collect();

  // Each active plot reduces unity
  const plotCount = characters.reduce((sum: number, c: any) => sum + c.activePlots.length, 0);
  unity -= plotCount * 12;

  // No artificial cap - can go negative in extreme cases
  return Math.max(0, unity);
}

// =============================================
// APPLY PROSPERITY EFFECTS (CONTINUOUS)
// =============================================

export async function applyProsperityEffects(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  tick: number
): Promise<void> {
  const territory = await ctx.db.get(territoryId);
  if (!territory) return;

  const prosperity = await ctx.db
    .query("prosperityTiers")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .first();

  if (!prosperity) return;

  const updates: Partial<Doc<"territories">> = {};

  // Calculate prosperity score
  const prosperityScore = calculateProsperityScore(territory);

  // Apply continuous prosperity benefits
  // Higher prosperity = more influence and knowledge generation
  // But with diminishing returns at extreme values
  if (prosperityScore > 50) {
    const bonusFactor = (prosperityScore - 50) / 100; // 0-0.5+ range

    // Influence gain scales with prosperity
    const influenceGain = bonusFactor * 4;
    updates.influence = territory.influence + influenceGain;

    // Knowledge gain at higher prosperity
    if (prosperityScore > 75) {
      const knowledgeFactor = (prosperityScore - 75) / 75;
      const knowledgeGain = knowledgeFactor * 3;
      updates.knowledge = territory.knowledge + knowledgeGain;
    }
  }

  // Apply complacency penalties - continuous scaling
  if (prosperity.complacencyLevel > 30) {
    // Complacency reduces productivity/efficiency
    // Handled in combat and production systems
    // Here we apply soft drain on military readiness
    const complacencyDrain = (prosperity.complacencyLevel - 30) / 100;
    // Small military decay from complacency
    updates.military = Math.max(0, territory.military - complacencyDrain * 0.5);
  }

  // Apply decadence penalties - continuous scaling
  if (prosperity.decadenceLevel > 40) {
    // Corruption drains wealth proportionally
    const corruptionDrain = (prosperity.decadenceLevel - 40) / 60; // 0-1 scale
    updates.wealth = Math.max(0, territory.wealth - corruptionDrain * 1.5);
  }

  if (Object.keys(updates).length > 0) {
    await ctx.db.patch(territoryId, updates);
  }
}

// =============================================
// QUERIES
// =============================================

export const getProsperityTier = query({
  args: { territoryId: v.id("territories") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("prosperityTiers")
      .withIndex("by_territory", (q) => q.eq("territoryId", args.territoryId))
      .first();
  },
});

export const getAllProsperityTiers = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("prosperityTiers").collect();
  },
});

export const getTierInfo = query({
  args: { tier: v.number() },
  handler: async (ctx, args) => {
    return PROSPERITY_TIERS[args.tier as keyof typeof PROSPERITY_TIERS] || null;
  },
});
