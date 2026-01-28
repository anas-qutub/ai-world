/**
 * Rise and Fall System
 *
 * Creates dramatic cycles where powerful civilizations face internal decay
 * and smaller ones can rise to greatness. This prevents any single civ
 * from dominating forever and creates compelling narratives.
 *
 * Core mechanics:
 * - Prosperity leads to Decadence
 * - Decadence leads to Crisis
 * - Crisis leads to Collapse or Reform
 * - Small civs get "Underdog Bonuses"
 */

import { Doc, Id } from "../_generated/dataModel";
import { MutationCtx, QueryCtx } from "../_generated/server";

// =============================================
// PROSPERITY & DECADENCE THRESHOLDS
// =============================================

export const PROSPERITY_THRESHOLDS = {
  // Golden Age triggers
  GOLDEN_AGE_HAPPINESS: 80,
  GOLDEN_AGE_WEALTH: 150,
  GOLDEN_AGE_DURATION: 24, // ticks

  // Decadence triggers (prosperity dangers)
  DECADENCE_WEALTH_THRESHOLD: 200, // Above this = decadence risk
  DECADENCE_HAPPINESS_THRESHOLD: 85, // Above this = complacency
  DECADENCE_LEAD_THRESHOLD: 2.0, // 2x the average = too dominant
  DECADENCE_GROWTH_RATE: 0.5, // Per tick when conditions met

  // Crisis triggers
  CRISIS_DECADENCE_THRESHOLD: 50, // Decadence level that triggers crisis
  CRISIS_CORRUPTION_THRESHOLD: 40,

  // Collapse triggers
  COLLAPSE_DECADENCE_THRESHOLD: 80,
  COLLAPSE_HAPPINESS_THRESHOLD: 20,
  COLLAPSE_UNREST_THRESHOLD: 100,

  // Reform difficulty
  REFORM_COST_WEALTH: 50,
  REFORM_COST_HAPPINESS: 20,
  REFORM_DECADENCE_REDUCTION: 30,
};

// =============================================
// STATUS TYPES
// =============================================

export type CivilizationStatus =
  | "struggling" // Low resources, fighting to survive
  | "stable" // Normal state
  | "prospering" // Doing well
  | "golden_age" // Peak prosperity
  | "decadent" // Too prosperous, getting soft
  | "crisis" // Internal problems mounting
  | "collapsing" // On the verge of collapse
  | "reforming"; // Actively addressing problems

export interface RiseAndFallStatus {
  status: CivilizationStatus;
  decadenceLevel: number; // 0-100
  corruptionLevel: number; // 0-100
  goldenAgeTicks: number; // Ticks remaining in golden age
  crisisType?: string;
  collapseRisk: number; // 0-100 probability
  underdogBonus: number; // 0-50 bonus for small civs
  reforms: string[]; // Active reforms
}

// =============================================
// CRISIS TYPES
// =============================================

export interface CrisisDefinition {
  id: string;
  name: string;
  description: string;
  effects: {
    happinessPerTick?: number;
    wealthPerTick?: number;
    militaryPerTick?: number;
    populationMultiplier?: number;
    unrestPerTick?: number;
  };
  resolution: {
    type: "reform" | "time" | "war" | "revolution";
    description: string;
  };
}

export const CRISIS_TYPES: CrisisDefinition[] = [
  {
    id: "succession_crisis",
    name: "Succession Crisis",
    description: "Multiple claimants fight for power, paralyzing the government",
    effects: {
      happinessPerTick: -2,
      militaryPerTick: -1,
      unrestPerTick: 3,
    },
    resolution: {
      type: "time",
      description: "Wait for a clear successor to emerge (or civil war)",
    },
  },
  {
    id: "corruption_scandal",
    name: "Corruption Scandal",
    description: "Rampant corruption undermines trust in leadership",
    effects: {
      happinessPerTick: -3,
      wealthPerTick: -5,
      unrestPerTick: 2,
    },
    resolution: {
      type: "reform",
      description: "Launch anti-corruption reforms",
    },
  },
  {
    id: "religious_schism",
    name: "Religious Schism",
    description: "Religious divisions threaten to tear society apart",
    effects: {
      happinessPerTick: -2,
      unrestPerTick: 4,
    },
    resolution: {
      type: "time",
      description: "The schism must heal naturally or be enforced",
    },
  },
  {
    id: "economic_depression",
    name: "Economic Depression",
    description: "Markets crash, unemployment soars",
    effects: {
      wealthPerTick: -8,
      happinessPerTick: -3,
      unrestPerTick: 2,
    },
    resolution: {
      type: "reform",
      description: "Economic reforms or stimulus needed",
    },
  },
  {
    id: "military_revolt",
    name: "Military Revolt",
    description: "The army threatens to seize power",
    effects: {
      militaryPerTick: -3,
      unrestPerTick: 5,
    },
    resolution: {
      type: "war",
      description: "Defeat the rebels or negotiate",
    },
  },
  {
    id: "peasant_uprising",
    name: "Peasant Uprising",
    description: "The common people rise against their rulers",
    effects: {
      populationMultiplier: 0.99,
      happinessPerTick: -4,
      unrestPerTick: 6,
    },
    resolution: {
      type: "revolution",
      description: "Crush the uprising or concede to demands",
    },
  },
  {
    id: "elite_decadence",
    name: "Elite Decadence",
    description: "The ruling class has become corrupt and out of touch",
    effects: {
      wealthPerTick: -3,
      happinessPerTick: -2,
      militaryPerTick: -1,
    },
    resolution: {
      type: "reform",
      description: "Purge the corrupt elites",
    },
  },
  {
    id: "technological_stagnation",
    name: "Technological Stagnation",
    description: "Innovation has ground to a halt",
    effects: {
      happinessPerTick: -1,
    },
    resolution: {
      type: "reform",
      description: "Invest in education and research",
    },
  },
];

export const CRISIS_MAP = new Map<string, CrisisDefinition>(
  CRISIS_TYPES.map(c => [c.id, c])
);

// =============================================
// RISE AND FALL PROCESSING
// =============================================

/**
 * Process rise and fall mechanics for all territories
 */
export async function processRiseAndFall(
  ctx: MutationCtx,
  territories: Doc<"territories">[],
  tick: number
): Promise<{
  statusChanges: Array<{ territoryId: Id<"territories">; oldStatus: string; newStatus: string }>;
  crisisEvents: Array<{ territoryId: Id<"territories">; crisisType: string }>;
  collapseEvents: Array<{ territoryId: Id<"territories">; description: string }>;
  goldenAges: Array<{ territoryId: Id<"territories"> }>;
}> {
  const results = {
    statusChanges: [] as Array<{ territoryId: Id<"territories">; oldStatus: string; newStatus: string }>,
    crisisEvents: [] as Array<{ territoryId: Id<"territories">; crisisType: string }>,
    collapseEvents: [] as Array<{ territoryId: Id<"territories">; description: string }>,
    goldenAges: [] as Array<{ territoryId: Id<"territories"> }>,
  };

  const activeTerritories = territories.filter(t => !t.isEliminated);
  const avgWealth = activeTerritories.reduce((sum, t) => sum + t.wealth, 0) / activeTerritories.length;
  const avgPop = activeTerritories.reduce((sum, t) => sum + t.population, 0) / activeTerritories.length;

  for (const territory of activeTerritories) {
    // Get or create rise/fall state
    let riseAndFall = await ctx.db
      .query("riseAndFall")
      .withIndex("by_territory", (q) => q.eq("territoryId", territory._id))
      .first();

    if (!riseAndFall) {
      // Initialize rise and fall tracking
      const newId = await ctx.db.insert("riseAndFall", {
        territoryId: territory._id,
        status: "stable",
        decadenceLevel: 0,
        corruptionLevel: 0,
        goldenAgeTicks: 0,
        collapseRisk: 0,
        underdogBonus: 0,
        reforms: [],
        lastStatusChange: tick,
      });
      riseAndFall = await ctx.db.get(newId);
      if (!riseAndFall) continue;
    }

    const oldStatus = riseAndFall.status;
    let newStatus = oldStatus;
    let decadence = riseAndFall.decadenceLevel;
    let corruption = riseAndFall.corruptionLevel;
    let goldenAgeTicks = riseAndFall.goldenAgeTicks;
    let collapseRisk = riseAndFall.collapseRisk;

    // Calculate underdog bonus (small civs get bonuses)
    const underdogBonus = calculateUnderdogBonus(territory, avgPop, avgWealth);

    // =============================================
    // PROCESS GOLDEN AGE
    // =============================================
    if (goldenAgeTicks > 0) {
      goldenAgeTicks--;
      if (goldenAgeTicks === 0) {
        // Golden age ended
        newStatus = "prospering";
        await ctx.db.insert("events", {
          tick,
          type: "system",
          territoryId: territory._id,
          title: "Golden Age Ends",
          description: `The golden age of ${territory.tribeName || territory.name} has come to an end. The glory fades, but the memories remain.`,
          severity: "info",
          createdAt: Date.now(),
        });
      }
    } else if (
      territory.happiness >= PROSPERITY_THRESHOLDS.GOLDEN_AGE_HAPPINESS &&
      territory.wealth >= PROSPERITY_THRESHOLDS.GOLDEN_AGE_WEALTH &&
      oldStatus !== "golden_age" &&
      oldStatus !== "decadent" &&
      oldStatus !== "crisis" &&
      oldStatus !== "collapsing"
    ) {
      // Enter golden age!
      newStatus = "golden_age";
      goldenAgeTicks = PROSPERITY_THRESHOLDS.GOLDEN_AGE_DURATION;
      results.goldenAges.push({ territoryId: territory._id });

      await ctx.db.insert("events", {
        tick,
        type: "system",
        territoryId: territory._id,
        title: "✨ Golden Age Begins!",
        description: `${territory.tribeName || territory.name} has entered a Golden Age! Arts, science, and culture flourish. (+25% to all production for ${goldenAgeTicks} months)`,
        severity: "positive",
        createdAt: Date.now(),
      });
    }

    // =============================================
    // PROCESS DECADENCE GROWTH
    // =============================================
    const isOverlyProsperous =
      territory.wealth > PROSPERITY_THRESHOLDS.DECADENCE_WEALTH_THRESHOLD ||
      territory.happiness > PROSPERITY_THRESHOLDS.DECADENCE_HAPPINESS_THRESHOLD ||
      territory.wealth > avgWealth * PROSPERITY_THRESHOLDS.DECADENCE_LEAD_THRESHOLD;

    if (isOverlyProsperous && newStatus !== "collapsing") {
      // Decadence grows when too prosperous
      decadence += PROSPERITY_THRESHOLDS.DECADENCE_GROWTH_RATE;
      corruption += PROSPERITY_THRESHOLDS.DECADENCE_GROWTH_RATE * 0.5;
    } else if (decadence > 0) {
      // Decadence slowly decreases when not overly prosperous
      decadence -= 0.2;
    }

    decadence = Math.max(0, Math.min(100, decadence));
    corruption = Math.max(0, Math.min(100, corruption));

    // =============================================
    // CHECK FOR STATUS TRANSITIONS
    // =============================================

    // Decadent
    if (decadence >= PROSPERITY_THRESHOLDS.CRISIS_DECADENCE_THRESHOLD * 0.6 &&
        newStatus !== "crisis" && newStatus !== "collapsing" && newStatus !== "golden_age") {
      newStatus = "decadent";
    }

    // Crisis
    if ((decadence >= PROSPERITY_THRESHOLDS.CRISIS_DECADENCE_THRESHOLD ||
         corruption >= PROSPERITY_THRESHOLDS.CRISIS_CORRUPTION_THRESHOLD) &&
        newStatus !== "collapsing") {

      if (newStatus !== "crisis" && !riseAndFall.activeCrisis) {
        // Trigger a crisis!
        const crisis = selectCrisis(territory, decadence, corruption);
        newStatus = "crisis";

        await ctx.db.patch(riseAndFall._id, { activeCrisis: crisis.id });

        results.crisisEvents.push({ territoryId: territory._id, crisisType: crisis.id });

        await ctx.db.insert("events", {
          tick,
          type: "system",
          territoryId: territory._id,
          title: `⚠️ ${crisis.name}!`,
          description: `${territory.tribeName || territory.name} faces a ${crisis.name}! ${crisis.description}`,
          severity: "negative",
          createdAt: Date.now(),
        });
      }
    }

    // Apply crisis effects if in crisis
    if (riseAndFall.activeCrisis) {
      const crisis = CRISIS_MAP.get(riseAndFall.activeCrisis);
      if (crisis) {
        await applyCrisisEffects(ctx, territory, crisis);
      }
    }

    // Calculate collapse risk
    collapseRisk = calculateCollapseRisk(territory, decadence, corruption, riseAndFall.activeCrisis);

    // Check for collapse
    if (collapseRisk > 0 && Math.random() * 100 < collapseRisk) {
      // COLLAPSE!
      newStatus = "collapsing";
      results.collapseEvents.push({
        territoryId: territory._id,
        description: `${territory.tribeName || territory.name} is collapsing!`,
      });

      await triggerCollapse(ctx, territory, tick);
    }

    // Check for recovery from struggling
    if (oldStatus === "struggling" && territory.happiness >= 50 && territory.food >= 50) {
      newStatus = "stable";
    }

    // Check for falling into struggling
    if (territory.happiness < 30 || territory.food < 20) {
      if (newStatus !== "collapsing" && newStatus !== "crisis") {
        newStatus = "struggling";
      }
    }

    // Record status change
    if (newStatus !== oldStatus) {
      results.statusChanges.push({
        territoryId: territory._id,
        oldStatus,
        newStatus,
      });
    }

    // Update database
    await ctx.db.patch(riseAndFall._id, {
      status: newStatus,
      decadenceLevel: decadence,
      corruptionLevel: corruption,
      goldenAgeTicks,
      collapseRisk,
      underdogBonus,
      lastStatusChange: newStatus !== oldStatus ? tick : riseAndFall.lastStatusChange,
    });

    // Apply underdog bonus effects
    if (underdogBonus > 0) {
      await applyUnderdogBonus(ctx, territory, underdogBonus);
    }
  }

  return results;
}

/**
 * Calculate underdog bonus for smaller civilizations
 */
function calculateUnderdogBonus(
  territory: Doc<"territories">,
  avgPop: number,
  avgWealth: number
): number {
  let bonus = 0;

  // Population underdog
  if (territory.population < avgPop * 0.5) {
    bonus += 20; // 20% bonus for being half the average
  } else if (territory.population < avgPop * 0.75) {
    bonus += 10;
  }

  // Wealth underdog
  if (territory.wealth < avgWealth * 0.5) {
    bonus += 15;
  } else if (territory.wealth < avgWealth * 0.75) {
    bonus += 8;
  }

  return Math.min(50, bonus); // Cap at 50%
}

/**
 * Apply underdog bonus effects
 */
async function applyUnderdogBonus(
  ctx: MutationCtx,
  territory: Doc<"territories">,
  bonus: number
): Promise<void> {
  // Small boost to growth rates when underdog
  const foodBonus = territory.food * (bonus / 1000);
  const wealthBonus = territory.wealth * (bonus / 1000);

  if (foodBonus > 0 || wealthBonus > 0) {
    await ctx.db.patch(territory._id, {
      food: territory.food + foodBonus,
      wealth: territory.wealth + wealthBonus,
    });
  }
}

/**
 * Select an appropriate crisis based on conditions
 */
function selectCrisis(
  territory: Doc<"territories">,
  decadence: number,
  corruption: number
): CrisisDefinition {
  const candidates: CrisisDefinition[] = [];

  // Weight crisis types based on conditions
  if (corruption > 30) {
    candidates.push(CRISIS_TYPES.find(c => c.id === "corruption_scandal")!);
    candidates.push(CRISIS_TYPES.find(c => c.id === "elite_decadence")!);
  }
  if (decadence > 50) {
    candidates.push(CRISIS_TYPES.find(c => c.id === "elite_decadence")!);
    candidates.push(CRISIS_TYPES.find(c => c.id === "technological_stagnation")!);
  }
  if (territory.happiness < 40) {
    candidates.push(CRISIS_TYPES.find(c => c.id === "peasant_uprising")!);
  }
  if (territory.military > 60) {
    candidates.push(CRISIS_TYPES.find(c => c.id === "military_revolt")!);
  }

  // Default fallbacks
  candidates.push(CRISIS_TYPES.find(c => c.id === "succession_crisis")!);
  candidates.push(CRISIS_TYPES.find(c => c.id === "economic_depression")!);

  // Random selection from candidates
  const validCandidates = candidates.filter(c => c !== undefined);
  return validCandidates[Math.floor(Math.random() * validCandidates.length)];
}

/**
 * Apply crisis effects each tick
 */
async function applyCrisisEffects(
  ctx: MutationCtx,
  territory: Doc<"territories">,
  crisis: CrisisDefinition
): Promise<void> {
  const updates: Partial<Doc<"territories">> = {};

  if (crisis.effects.happinessPerTick) {
    updates.happiness = Math.max(0, Math.min(100,
      territory.happiness + crisis.effects.happinessPerTick
    ));
  }
  if (crisis.effects.wealthPerTick) {
    updates.wealth = Math.max(0, territory.wealth + crisis.effects.wealthPerTick);
  }
  if (crisis.effects.militaryPerTick) {
    updates.military = Math.max(0, Math.min(100,
      territory.military + crisis.effects.militaryPerTick
    ));
  }
  if (crisis.effects.populationMultiplier) {
    updates.population = Math.max(1, Math.floor(
      territory.population * crisis.effects.populationMultiplier
    ));
  }
  if (crisis.effects.unrestPerTick) {
    updates.unrest = (territory.unrest || 0) + crisis.effects.unrestPerTick;
  }

  if (Object.keys(updates).length > 0) {
    await ctx.db.patch(territory._id, updates);
  }
}

/**
 * Calculate probability of collapse
 */
function calculateCollapseRisk(
  territory: Doc<"territories">,
  decadence: number,
  corruption: number,
  activeCrisis?: string
): number {
  let risk = 0;

  // Base risk from decadence
  if (decadence >= PROSPERITY_THRESHOLDS.COLLAPSE_DECADENCE_THRESHOLD) {
    risk += (decadence - PROSPERITY_THRESHOLDS.COLLAPSE_DECADENCE_THRESHOLD) * 0.5;
  }

  // Risk from low happiness
  if (territory.happiness < PROSPERITY_THRESHOLDS.COLLAPSE_HAPPINESS_THRESHOLD) {
    risk += (PROSPERITY_THRESHOLDS.COLLAPSE_HAPPINESS_THRESHOLD - territory.happiness) * 0.3;
  }

  // Risk from high unrest
  const unrest = territory.unrest || 0;
  if (unrest >= PROSPERITY_THRESHOLDS.COLLAPSE_UNREST_THRESHOLD) {
    risk += (unrest - PROSPERITY_THRESHOLDS.COLLAPSE_UNREST_THRESHOLD) * 0.2;
  }

  // Active crisis increases risk
  if (activeCrisis) {
    risk += 5;
  }

  return Math.min(25, risk); // Cap at 25% per tick
}

/**
 * Trigger collapse effects
 */
async function triggerCollapse(
  ctx: MutationCtx,
  territory: Doc<"territories">,
  tick: number
): Promise<void> {
  // Severe penalties
  await ctx.db.patch(territory._id, {
    population: Math.max(10, Math.floor(territory.population * 0.5)),
    wealth: Math.max(0, territory.wealth - 50),
    military: Math.max(0, territory.military - 30),
    happiness: Math.max(10, territory.happiness - 30),
    influence: Math.max(0, territory.influence - 20),
    unrest: 0, // Reset unrest after collapse
  });

  // Clear any active crisis
  const riseAndFall = await ctx.db
    .query("riseAndFall")
    .withIndex("by_territory", (q) => q.eq("territoryId", territory._id))
    .first();

  if (riseAndFall) {
    await ctx.db.patch(riseAndFall._id, {
      activeCrisis: undefined,
      decadenceLevel: 10, // Reset decadence
      corruptionLevel: 10,
      status: "struggling",
    });
  }

  // Create dramatic event
  await ctx.db.insert("events", {
    tick,
    type: "system",
    territoryId: territory._id,
    title: `💀 ${territory.tribeName || territory.name} COLLAPSES!`,
    description: `The once-mighty ${territory.tribeName || territory.name} has collapsed! Internal strife, corruption, and decadence have torn the civilization apart. Half the population is lost. From the ashes, the survivors must rebuild.`,
    severity: "critical",
    createdAt: Date.now(),
  });
}

/**
 * Get rise and fall status for a territory
 */
export async function getRiseAndFallStatus(
  ctx: QueryCtx,
  territoryId: Id<"territories">
): Promise<RiseAndFallStatus | null> {
  const riseAndFall = await ctx.db
    .query("riseAndFall")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .first();

  if (!riseAndFall) return null;

  return {
    status: riseAndFall.status as CivilizationStatus,
    decadenceLevel: riseAndFall.decadenceLevel,
    corruptionLevel: riseAndFall.corruptionLevel,
    goldenAgeTicks: riseAndFall.goldenAgeTicks,
    crisisType: riseAndFall.activeCrisis,
    collapseRisk: riseAndFall.collapseRisk,
    underdogBonus: riseAndFall.underdogBonus,
    reforms: riseAndFall.reforms || [],
  };
}

/**
 * Attempt reform to address crisis
 */
export async function attemptReform(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  reformType: string,
  tick: number
): Promise<{ success: boolean; message: string }> {
  const territory = await ctx.db.get(territoryId);
  if (!territory) return { success: false, message: "Territory not found" };

  const riseAndFall = await ctx.db
    .query("riseAndFall")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .first();

  if (!riseAndFall) return { success: false, message: "No rise/fall data" };

  // Check if can afford reform
  if (territory.wealth < PROSPERITY_THRESHOLDS.REFORM_COST_WEALTH) {
    return { success: false, message: `Need ${PROSPERITY_THRESHOLDS.REFORM_COST_WEALTH} wealth to implement reforms` };
  }

  // Pay the cost
  await ctx.db.patch(territoryId, {
    wealth: territory.wealth - PROSPERITY_THRESHOLDS.REFORM_COST_WEALTH,
    happiness: Math.max(0, territory.happiness - PROSPERITY_THRESHOLDS.REFORM_COST_HAPPINESS),
  });

  // Apply reform effects
  const newDecadence = Math.max(0,
    riseAndFall.decadenceLevel - PROSPERITY_THRESHOLDS.REFORM_DECADENCE_REDUCTION
  );
  const newCorruption = Math.max(0,
    riseAndFall.corruptionLevel - PROSPERITY_THRESHOLDS.REFORM_DECADENCE_REDUCTION * 0.5
  );

  const reforms = riseAndFall.reforms || [];
  reforms.push(reformType);

  // Clear crisis if decadence drops enough
  let newStatus = riseAndFall.status;
  let activeCrisis = riseAndFall.activeCrisis;

  if (newDecadence < PROSPERITY_THRESHOLDS.CRISIS_DECADENCE_THRESHOLD &&
      newCorruption < PROSPERITY_THRESHOLDS.CRISIS_CORRUPTION_THRESHOLD) {
    newStatus = "reforming";
    activeCrisis = undefined;
  }

  await ctx.db.patch(riseAndFall._id, {
    decadenceLevel: newDecadence,
    corruptionLevel: newCorruption,
    status: newStatus,
    activeCrisis,
    reforms,
  });

  await ctx.db.insert("events", {
    tick,
    type: "system",
    territoryId,
    title: "Reform Implemented",
    description: `${territory.tribeName || territory.name} has implemented reforms! Decadence -${PROSPERITY_THRESHOLDS.REFORM_DECADENCE_REDUCTION}, Corruption -${PROSPERITY_THRESHOLDS.REFORM_DECADENCE_REDUCTION * 0.5}`,
    severity: "positive",
    createdAt: Date.now(),
  });

  return { success: true, message: "Reforms implemented successfully" };
}
