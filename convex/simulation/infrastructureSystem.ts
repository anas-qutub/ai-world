/**
 * Infrastructure System
 *
 * Manages construction and maintenance of roads, bridges, aqueducts,
 * walls, harbors, and other infrastructure projects.
 */

import { MutationCtx, QueryCtx } from "../_generated/server";
import { Id, Doc } from "../_generated/dataModel";

// Infrastructure types
export type InfrastructureType =
  | "road"
  | "bridge"
  | "aqueduct"
  | "wall"
  | "harbor"
  | "lighthouse"
  | "sewers";

// Construction costs by type and level
const CONSTRUCTION_COSTS: Record<InfrastructureType, {
  wealth: number;
  ticksToComplete: number;
  maintenanceCost: number;
}> = {
  road: { wealth: 10, ticksToComplete: 3, maintenanceCost: 1 },
  bridge: { wealth: 20, ticksToComplete: 4, maintenanceCost: 2 },
  aqueduct: { wealth: 40, ticksToComplete: 6, maintenanceCost: 3 },
  wall: { wealth: 30, ticksToComplete: 5, maintenanceCost: 2 },
  harbor: { wealth: 50, ticksToComplete: 8, maintenanceCost: 4 },
  lighthouse: { wealth: 25, ticksToComplete: 4, maintenanceCost: 2 },
  sewers: { wealth: 35, ticksToComplete: 6, maintenanceCost: 3 },
};

// Infrastructure effects
const INFRASTRUCTURE_EFFECTS: Record<InfrastructureType, {
  tradeBonus: number;
  defenseBonus: number;
  healthBonus: number;
  happinessBonus: number;
  description: string;
}> = {
  road: {
    tradeBonus: 15,
    defenseBonus: 0,
    healthBonus: 0,
    happinessBonus: 5,
    description: "Improves trade and travel speed",
  },
  bridge: {
    tradeBonus: 20,
    defenseBonus: 5,
    healthBonus: 0,
    happinessBonus: 3,
    description: "Connects territories across rivers",
  },
  aqueduct: {
    tradeBonus: 0,
    defenseBonus: 0,
    healthBonus: 25,
    happinessBonus: 15,
    description: "Provides clean water, reduces disease",
  },
  wall: {
    tradeBonus: 0,
    defenseBonus: 30,
    healthBonus: 0,
    happinessBonus: 10,
    description: "Fortifies the territory against attack",
  },
  harbor: {
    tradeBonus: 30,
    defenseBonus: 5,
    healthBonus: 0,
    happinessBonus: 10,
    description: "Enables maritime trade and naval power",
  },
  lighthouse: {
    tradeBonus: 15,
    defenseBonus: 5,
    healthBonus: 0,
    happinessBonus: 5,
    description: "Improves maritime safety and trade",
  },
  sewers: {
    tradeBonus: 0,
    defenseBonus: 0,
    healthBonus: 30,
    happinessBonus: 10,
    description: "Greatly reduces disease and improves sanitation",
  },
};

/**
 * Start construction of infrastructure
 */
export async function startConstruction(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  type: InfrastructureType,
  tick: number,
  connectsTo?: Id<"territories">,
  name?: string
): Promise<{ success: boolean; message: string; infrastructureId?: Id<"infrastructure"> }> {
  const territory = await ctx.db.get(territoryId);
  if (!territory) {
    return { success: false, message: "Territory not found" };
  }

  const costs = CONSTRUCTION_COSTS[type];

  // Check if we can afford it
  if (territory.wealth < costs.wealth) {
    return {
      success: false,
      message: `Not enough wealth. Need ${costs.wealth}, have ${territory.wealth}`,
    };
  }

  // Check if already building this type
  const existingConstruction = await ctx.db
    .query("infrastructure")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .filter((q) => q.and(
      q.eq(q.field("type"), type),
      q.eq(q.field("isUnderConstruction"), true)
    ))
    .first();

  if (existingConstruction) {
    return {
      success: false,
      message: `Already constructing a ${type}`,
    };
  }

  // Check for existing infrastructure of same type (can upgrade later)
  const existing = await ctx.db
    .query("infrastructure")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .filter((q) => q.and(
      q.eq(q.field("type"), type),
      q.eq(q.field("isUnderConstruction"), false)
    ))
    .first();

  // Deduct wealth
  await ctx.db.patch(territoryId, {
    wealth: territory.wealth - costs.wealth,
  });

  const effects = INFRASTRUCTURE_EFFECTS[type];

  // Create infrastructure record
  const infrastructureId = await ctx.db.insert("infrastructure", {
    territoryId,
    type,
    name: name || generateInfrastructureName(type, territory.name),
    level: existing ? existing.level + 1 : 1,
    connectsTo,
    condition: 100,
    constructedAtTick: tick,
    maintenanceCost: costs.maintenanceCost,
    isUnderConstruction: true,
    constructionProgress: 0,
    constructionStartTick: tick,
    tradeBonus: effects.tradeBonus,
    defenseBonus: effects.defenseBonus,
    healthBonus: effects.healthBonus,
    happinessBonus: effects.happinessBonus,
  });

  return {
    success: true,
    message: `Started construction of ${type}. Will complete in ${costs.ticksToComplete} months.`,
    infrastructureId,
  };
}

/**
 * Generate a name for infrastructure
 */
function generateInfrastructureName(type: InfrastructureType, territoryName: string): string {
  const prefixes: Record<InfrastructureType, string[]> = {
    road: ["Great", "King's", "Trade", "Imperial", "Ancient"],
    bridge: ["Grand", "Stone", "Iron", "Royal", "Old"],
    aqueduct: ["Imperial", "Great", "Sacred", "Ancient", "Royal"],
    wall: ["Great", "Mighty", "Defensive", "Northern", "Southern"],
    harbor: ["Grand", "Royal", "Merchant", "Great", "Naval"],
    lighthouse: ["Beacon", "Guiding", "Maritime", "Coastal", "Tower"],
    sewers: ["Great", "Underground", "City", "Grand", "Ancient"],
  };

  const prefix = prefixes[type][Math.floor(Math.random() * prefixes[type].length)];

  const typeNames: Record<InfrastructureType, string> = {
    road: "Road",
    bridge: "Bridge",
    aqueduct: "Aqueduct",
    wall: "Wall",
    harbor: "Harbor",
    lighthouse: "Lighthouse",
    sewers: "Sewers",
  };

  return `${prefix} ${typeNames[type]} of ${territoryName}`;
}

/**
 * Process infrastructure construction and maintenance
 */
export async function processInfrastructure(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  tick: number
): Promise<{ events: Array<{ type: string; description: string }> }> {
  const events: Array<{ type: string; description: string }> = [];

  const territory = await ctx.db.get(territoryId);
  if (!territory) return { events };

  const infrastructure = await ctx.db
    .query("infrastructure")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .collect();

  let totalMaintenanceCost = 0;

  for (const infra of infrastructure) {
    // Process construction
    if (infra.isUnderConstruction) {
      const costs = CONSTRUCTION_COSTS[infra.type as InfrastructureType];
      const ticksElapsed = tick - (infra.constructionStartTick || tick);
      const progress = Math.min(100, (ticksElapsed / costs.ticksToComplete) * 100);

      if (progress >= 100) {
        // Construction complete!
        await ctx.db.patch(infra._id, {
          isUnderConstruction: false,
          constructionProgress: 100,
          constructedAtTick: tick,
        });

        events.push({
          type: "construction_complete",
          description: `${infra.name || infra.type} construction completed!`,
        });
      } else {
        await ctx.db.patch(infra._id, {
          constructionProgress: progress,
        });
      }
      continue;
    }

    // Process maintenance
    totalMaintenanceCost += infra.maintenanceCost;

    // Degrade condition over time
    const newCondition = Math.max(0, infra.condition - 2);
    await ctx.db.patch(infra._id, { condition: newCondition });

    if (newCondition < 30 && infra.condition >= 30) {
      events.push({
        type: "deterioration",
        description: `${infra.name || infra.type} is deteriorating and needs repairs.`,
      });
    }

    if (newCondition === 0) {
      events.push({
        type: "collapse",
        description: `${infra.name || infra.type} has collapsed from neglect!`,
      });
      // Remove the infrastructure
      await ctx.db.delete(infra._id);
    }
  }

  // Deduct maintenance costs
  if (totalMaintenanceCost > 0 && territory.wealth >= totalMaintenanceCost) {
    await ctx.db.patch(territoryId, {
      wealth: territory.wealth - totalMaintenanceCost,
    });
  } else if (totalMaintenanceCost > 0) {
    // Can't afford maintenance - faster degradation
    for (const infra of infrastructure) {
      if (!infra.isUnderConstruction) {
        const newCondition = Math.max(0, infra.condition - 5);
        await ctx.db.patch(infra._id, { condition: newCondition });
      }
    }
    events.push({
      type: "maintenance_crisis",
      description: "Cannot afford infrastructure maintenance. Structures are degrading faster.",
    });
  }

  return { events };
}

/**
 * Repair infrastructure
 */
export async function repairInfrastructure(
  ctx: MutationCtx,
  infrastructureId: Id<"infrastructure">,
  tick: number
): Promise<{ success: boolean; message: string }> {
  const infra = await ctx.db.get(infrastructureId);
  if (!infra) {
    return { success: false, message: "Infrastructure not found" };
  }

  const territory = await ctx.db.get(infra.territoryId);
  if (!territory) {
    return { success: false, message: "Territory not found" };
  }

  // Repair cost is based on damage
  const damagePercent = 100 - infra.condition;
  const repairCost = Math.ceil(
    CONSTRUCTION_COSTS[infra.type as InfrastructureType].wealth * (damagePercent / 100) * 0.5
  );

  if (territory.wealth < repairCost) {
    return {
      success: false,
      message: `Not enough wealth for repairs. Need ${repairCost}, have ${territory.wealth}`,
    };
  }

  await ctx.db.patch(infra.territoryId, {
    wealth: territory.wealth - repairCost,
  });

  await ctx.db.patch(infrastructureId, {
    condition: 100,
  });

  return {
    success: true,
    message: `Repaired ${infra.name || infra.type} for ${repairCost} wealth.`,
  };
}

/**
 * Upgrade infrastructure to next level
 */
export async function upgradeInfrastructure(
  ctx: MutationCtx,
  infrastructureId: Id<"infrastructure">,
  tick: number
): Promise<{ success: boolean; message: string }> {
  const infra = await ctx.db.get(infrastructureId);
  if (!infra) {
    return { success: false, message: "Infrastructure not found" };
  }

  if (infra.level >= 5) {
    return { success: false, message: "Already at maximum level" };
  }

  if (infra.isUnderConstruction) {
    return { success: false, message: "Cannot upgrade while under construction" };
  }

  const territory = await ctx.db.get(infra.territoryId);
  if (!territory) {
    return { success: false, message: "Territory not found" };
  }

  const baseCost = CONSTRUCTION_COSTS[infra.type as InfrastructureType];
  const upgradeCost = Math.ceil(baseCost.wealth * (infra.level + 1) * 0.7);

  if (territory.wealth < upgradeCost) {
    return {
      success: false,
      message: `Not enough wealth. Need ${upgradeCost}, have ${territory.wealth}`,
    };
  }

  await ctx.db.patch(infra.territoryId, {
    wealth: territory.wealth - upgradeCost,
  });

  // Increase level and effects
  const effects = INFRASTRUCTURE_EFFECTS[infra.type as InfrastructureType];
  const multiplier = 1 + (infra.level * 0.2);

  await ctx.db.patch(infrastructureId, {
    level: infra.level + 1,
    isUnderConstruction: true,
    constructionProgress: 0,
    constructionStartTick: tick,
    tradeBonus: Math.floor((infra.tradeBonus || effects.tradeBonus) * 1.2),
    defenseBonus: Math.floor((infra.defenseBonus || effects.defenseBonus) * 1.2),
    healthBonus: Math.floor((infra.healthBonus || effects.healthBonus) * 1.2),
    happinessBonus: Math.floor((infra.happinessBonus || effects.happinessBonus) * 1.2),
    maintenanceCost: Math.ceil(baseCost.maintenanceCost * multiplier),
  });

  return {
    success: true,
    message: `Upgrading ${infra.name || infra.type} to level ${infra.level + 1}.`,
  };
}

/**
 * Get infrastructure bonuses for a territory
 */
export async function getInfrastructureBonuses(
  ctx: QueryCtx,
  territoryId: Id<"territories">
): Promise<{
  tradeBonus: number;
  defenseBonus: number;
  healthBonus: number;
  happinessBonus: number;
}> {
  const infrastructure = await ctx.db
    .query("infrastructure")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .filter((q) => q.eq(q.field("isUnderConstruction"), false))
    .collect();

  let tradeBonus = 0;
  let defenseBonus = 0;
  let healthBonus = 0;
  let happinessBonus = 0;

  for (const infra of infrastructure) {
    // Scale bonus by condition
    const conditionMultiplier = infra.condition / 100;

    tradeBonus += Math.floor((infra.tradeBonus || 0) * conditionMultiplier);
    defenseBonus += Math.floor((infra.defenseBonus || 0) * conditionMultiplier);
    healthBonus += Math.floor((infra.healthBonus || 0) * conditionMultiplier);
    happinessBonus += Math.floor((infra.happinessBonus || 0) * conditionMultiplier);
  }

  return { tradeBonus, defenseBonus, healthBonus, happinessBonus };
}

/**
 * Get infrastructure summary for AI
 */
export async function getInfrastructureSummary(
  ctx: QueryCtx,
  territoryId: Id<"territories">
): Promise<string> {
  const infrastructure = await ctx.db
    .query("infrastructure")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .collect();

  if (infrastructure.length === 0) {
    return "No infrastructure built.";
  }

  const completed = infrastructure.filter((i) => !i.isUnderConstruction);
  const underConstruction = infrastructure.filter((i) => i.isUnderConstruction);

  let summary = "";

  if (completed.length > 0) {
    const types = completed.map((i) => `${i.type} (L${i.level}, ${i.condition}% condition)`);
    summary += `Infrastructure: ${types.join(", ")}. `;
  }

  if (underConstruction.length > 0) {
    const building = underConstruction.map((i) =>
      `${i.type} (${Math.floor(i.constructionProgress)}% complete)`
    );
    summary += `Under construction: ${building.join(", ")}.`;
  }

  const bonuses = await getInfrastructureBonuses(ctx, territoryId);
  if (bonuses.tradeBonus > 0 || bonuses.defenseBonus > 0) {
    summary += ` Bonuses: Trade +${bonuses.tradeBonus}%, Defense +${bonuses.defenseBonus}%.`;
  }

  return summary;
}

/**
 * INTERCONNECTION: Calculate trade bonuses between TWO territories
 * Called by trade.ts to modify trade route efficiency based on infrastructure
 */
export async function getInfrastructureTradeBonus(
  ctx: QueryCtx | MutationCtx,
  territory1Id: Id<"territories">,
  territory2Id: Id<"territories">
): Promise<{
  travelTimeReduction: number;  // Percentage reduction in travel time
  riskReduction: number;        // Flat reduction in trade route risk
  wealthBonus: number;          // Percentage bonus to trade wealth
}> {
  // Get bonuses from both territories
  const [bonuses1, bonuses2] = await Promise.all([
    getInfrastructureBonuses(ctx as QueryCtx, territory1Id),
    getInfrastructureBonuses(ctx as QueryCtx, territory2Id),
  ]);

  // Check for direct road connection between territories
  const roads1 = await ctx.db
    .query("infrastructure")
    .withIndex("by_territory", (q) => q.eq("territoryId", territory1Id))
    .filter((q) => q.and(
      q.eq(q.field("type"), "road"),
      q.eq(q.field("isUnderConstruction"), false)
    ))
    .collect();

  const roads2 = await ctx.db
    .query("infrastructure")
    .withIndex("by_territory", (q) => q.eq("territoryId", territory2Id))
    .filter((q) => q.and(
      q.eq(q.field("type"), "road"),
      q.eq(q.field("isUnderConstruction"), false)
    ))
    .collect();

  // Check for direct road connection
  const directRoad = roads1.find((r) => r.connectsTo === territory2Id) ||
                     roads2.find((r) => r.connectsTo === territory1Id);

  let travelTimeReduction = 0;
  let riskReduction = 0;
  let wealthBonus = 0;

  // Direct road connection provides major bonus
  if (directRoad) {
    const conditionMult = directRoad.condition / 100;
    travelTimeReduction += 25 * conditionMult;  // Up to 25% faster
    riskReduction += 15 * conditionMult;        // 15 flat risk reduction
    wealthBonus += 20 * conditionMult;          // 20% wealth bonus
  }

  // Combined trade infrastructure from both territories
  const avgTradeBonus = (bonuses1.tradeBonus + bonuses2.tradeBonus) / 2;
  wealthBonus += avgTradeBonus;  // Add average trade bonus

  // Harbor bonus (for sea routes)
  const harbors1 = await ctx.db
    .query("infrastructure")
    .withIndex("by_territory", (q) => q.eq("territoryId", territory1Id))
    .filter((q) => q.and(
      q.eq(q.field("type"), "harbor"),
      q.eq(q.field("isUnderConstruction"), false)
    ))
    .first();

  const harbors2 = await ctx.db
    .query("infrastructure")
    .withIndex("by_territory", (q) => q.eq("territoryId", territory2Id))
    .filter((q) => q.and(
      q.eq(q.field("type"), "harbor"),
      q.eq(q.field("isUnderConstruction"), false)
    ))
    .first();

  // Both territories have harbors = sea trade route possible
  if (harbors1 && harbors2) {
    const avgCondition = ((harbors1.condition + harbors2.condition) / 2) / 100;
    travelTimeReduction += 30 * avgCondition;  // Sea routes are faster
    wealthBonus += 25 * avgCondition;          // Sea trade is profitable
    riskReduction += 10 * avgCondition;        // Established sea routes are safer
  }

  // Lighthouse bonus (reduces sea trade risk)
  const lighthouse1 = await ctx.db
    .query("infrastructure")
    .withIndex("by_territory", (q) => q.eq("territoryId", territory1Id))
    .filter((q) => q.and(
      q.eq(q.field("type"), "lighthouse"),
      q.eq(q.field("isUnderConstruction"), false)
    ))
    .first();

  const lighthouse2 = await ctx.db
    .query("infrastructure")
    .withIndex("by_territory", (q) => q.eq("territoryId", territory2Id))
    .filter((q) => q.and(
      q.eq(q.field("type"), "lighthouse"),
      q.eq(q.field("isUnderConstruction"), false)
    ))
    .first();

  if (lighthouse1 || lighthouse2) {
    const lighthouseBonus = (lighthouse1 ? lighthouse1.condition / 100 * 10 : 0) +
                           (lighthouse2 ? lighthouse2.condition / 100 * 10 : 0);
    riskReduction += lighthouseBonus;
  }

  return {
    travelTimeReduction: Math.min(60, travelTimeReduction),  // Cap at 60%
    riskReduction: Math.min(40, riskReduction),              // Cap at 40
    wealthBonus: Math.min(100, wealthBonus),                 // Cap at 100%
  };
}

/**
 * INTERCONNECTION: Get defense bonus from infrastructure
 * Called by combat.ts to modify defense strength
 */
export async function getInfrastructureDefenseBonus(
  ctx: QueryCtx | MutationCtx,
  territoryId: Id<"territories">
): Promise<number> {
  const bonuses = await getInfrastructureBonuses(ctx as QueryCtx, territoryId);
  return bonuses.defenseBonus;
}

/**
 * Destroy infrastructure (from disasters or war)
 */
export async function damageInfrastructure(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  damagePercent: number
): Promise<{ damagedCount: number; destroyedCount: number }> {
  const infrastructure = await ctx.db
    .query("infrastructure")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .filter((q) => q.eq(q.field("isUnderConstruction"), false))
    .collect();

  let damagedCount = 0;
  let destroyedCount = 0;
  let totalHappinessLoss = 0;

  for (const infra of infrastructure) {
    const newCondition = Math.max(0, infra.condition - damagePercent);

    if (newCondition === 0) {
      await ctx.db.delete(infra._id);
      destroyedCount++;
      // INTERCONNECTION: Infrastructure destruction affects happiness
      // Lost infrastructure = lost happiness bonus + penalty for destruction
      const effects = INFRASTRUCTURE_EFFECTS[infra.type as InfrastructureType];
      if (effects) {
        totalHappinessLoss += effects.happinessBonus + 3; // Bonus lost + destruction shock
      }
    } else {
      await ctx.db.patch(infra._id, { condition: newCondition });
      damagedCount++;
      // Damaged infrastructure = partial happiness penalty
      totalHappinessLoss += Math.ceil(damagePercent / 20); // 1 happiness per 20% damage
    }
  }

  // Apply happiness penalty to territory
  if (totalHappinessLoss > 0) {
    const territory = await ctx.db.get(territoryId);
    if (territory) {
      await ctx.db.patch(territoryId, {
        happiness: Math.max(0, territory.happiness - totalHappinessLoss),
      });
    }
  }

  return { damagedCount, destroyedCount };
}
