import { MutationCtx, QueryCtx } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";
import { recordMemory } from "./memory";

// =============================================
// ORGANIC EXPANSION SYSTEM
// =============================================
// Civilizations expand naturally when:
// - Population exceeds carrying capacity
// - Resources become scarce
// - Ambitious leaders seek glory
// - Better opportunities exist elsewhere

// =============================================
// EXPANSION PRESSURE CALCULATION
// =============================================

export interface ExpansionPressure {
  total: number;              // 0-100 overall pressure
  populationPressure: number; // Overpopulation
  resourcePressure: number;   // Food/resource scarcity
  ambitionPressure: number;   // Ruler's expansionist desires
  opportunityPressure: number; // Weak neighbors to exploit
  culturalPressure: number;   // Nomadic/expansionist culture
}

/**
 * Calculate expansion pressure for a territory
 */
export async function calculateExpansionPressure(
  ctx: QueryCtx,
  territoryId: Id<"territories">
): Promise<ExpansionPressure> {
  const territory = await ctx.db.get(territoryId);
  if (!territory) {
    return { total: 0, populationPressure: 0, resourcePressure: 0, ambitionPressure: 0, opportunityPressure: 0, culturalPressure: 0 };
  }

  // 1. Population Pressure - Are we overpopulated?
  const shelterCapacity = (territory as any).shelterCapacity || territory.population;
  const foodPerCapita = territory.food / Math.max(1, territory.population);

  let populationPressure = 0;

  // Overpopulation relative to shelter
  if (territory.population > shelterCapacity * 1.2) {
    populationPressure += 30;
  } else if (territory.population > shelterCapacity) {
    populationPressure += 15;
  }

  // High population density increases pressure
  if (territory.population > 1000) {
    populationPressure += 10;
  }
  if (territory.population > 2000) {
    populationPressure += 15;
  }

  // 2. Resource Pressure - Are we running out of food?
  let resourcePressure = 0;

  if (foodPerCapita < 0.3) {
    resourcePressure = 80; // Desperate
  } else if (foodPerCapita < 0.5) {
    resourcePressure = 50; // Serious
  } else if (foodPerCapita < 0.8) {
    resourcePressure = 25; // Moderate
  } else if (foodPerCapita < 1.0) {
    resourcePressure = 10; // Mild
  }

  // Low wealth also contributes
  if (territory.wealth < 20) {
    resourcePressure += 15;
  }

  // 3. Ambition Pressure - Does the ruler want expansion?
  const ruler = await ctx.db
    .query("characters")
    .withIndex("by_territory", (q: any) => q.eq("territoryId", territoryId))
    .filter((q: any) => q.and(
      q.eq(q.field("isAlive"), true),
      q.eq(q.field("role"), "ruler")
    ))
    .first();

  let ambitionPressure = 0;
  if (ruler) {
    // Ambitious rulers seek expansion
    if (ruler.traits.ambition > 70) {
      ambitionPressure += 25;
    } else if (ruler.traits.ambition > 50) {
      ambitionPressure += 10;
    }

    // Aggressive rulers also expand
    if ((ruler.traits as any).aggression > 70) {
      ambitionPressure += 15;
    }
  }

  // 4. Opportunity Pressure - Are neighbors weak?
  const relationships = await ctx.db
    .query("relationships")
    .filter((q: any) =>
      q.or(
        q.eq(q.field("territory1Id"), territoryId),
        q.eq(q.field("territory2Id"), territoryId)
      )
    )
    .collect();

  let opportunityPressure = 0;

  for (const rel of relationships) {
    const otherId = rel.territory1Id === territoryId ? rel.territory2Id : rel.territory1Id;
    const other = await ctx.db.get(otherId);

    if (other) {
      // Weak neighbor with good resources
      if (other.military < territory.military * 0.5 && other.food > territory.food) {
        opportunityPressure += 15;
      }
      // Very weak neighbor
      if (other.military < territory.military * 0.3) {
        opportunityPressure += 10;
      }
    }
  }
  opportunityPressure = Math.min(40, opportunityPressure);

  // 5. Cultural Pressure - Is the culture expansionist?
  let culturalPressure = 0;

  const traditions = (territory as any).traditions || [];
  const beliefs = (territory as any).beliefs || "";

  // Nomadic or warrior cultures expand more
  if (traditions.some((t: any) =>
    t.name?.toLowerCase().includes("nomad") ||
    t.name?.toLowerCase().includes("warrior") ||
    t.name?.toLowerCase().includes("conquest")
  )) {
    culturalPressure += 20;
  }

  // Beliefs about expansion
  if (beliefs.includes("destined") || beliefs.includes("chosen") || beliefs.includes("conquer")) {
    culturalPressure += 15;
  }

  // High military society
  if (territory.military > 70) {
    culturalPressure += 10;
  }

  const total = Math.min(100,
    populationPressure * 0.25 +
    resourcePressure * 0.35 +
    ambitionPressure * 0.15 +
    opportunityPressure * 0.15 +
    culturalPressure * 0.10
  );

  return {
    total,
    populationPressure,
    resourcePressure,
    ambitionPressure,
    opportunityPressure,
    culturalPressure,
  };
}

// =============================================
// EXPANSION ACTIONS
// =============================================

export type ExpansionAction =
  | "send_scouts"           // Send people to find new resources
  | "desperation_raid"      // Attack neighbor for food
  | "colonize"              // Send settlers to new land
  | "population_split"      // Group splits off to find new home
  | "demand_tribute"        // Demand resources from weak neighbor
  | "seek_trade"            // Desperately seek trade partners
  | "migration";            // Entire group moves

interface ExpansionResult {
  actionTaken: boolean;
  action?: ExpansionAction;
  description?: string;
  targetTerritoryId?: Id<"territories">;
  resourcesGained?: { food?: number; wealth?: number };
  populationLost?: number;
}

/**
 * Process organic expansion for a territory
 */
export async function processExpansion(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  tick: number
): Promise<ExpansionResult> {
  const territory = await ctx.db.get(territoryId);
  if (!territory) {
    return { actionTaken: false };
  }

  // Calculate expansion pressure
  const pressure = await calculateExpansionPressure(ctx, territoryId);

  // Need significant pressure to trigger action
  if (pressure.total < 25) {
    return { actionTaken: false };
  }

  // Determine what action to take based on circumstances
  const action = await determineExpansionAction(ctx, territory, pressure, tick);

  if (!action) {
    return { actionTaken: false };
  }

  // Execute the expansion action
  return await executeExpansionAction(ctx, territory, action, pressure, tick);
}

/**
 * Determine what expansion action to take
 */
async function determineExpansionAction(
  ctx: MutationCtx,
  territory: Doc<"territories">,
  pressure: ExpansionPressure,
  tick: number
): Promise<{ action: ExpansionAction; targetId?: Id<"territories"> } | null> {

  // Get relationships for potential targets
  const relationships = await ctx.db
    .query("relationships")
    .filter((q: any) =>
      q.or(
        q.eq(q.field("territory1Id"), territory._id),
        q.eq(q.field("territory2Id"), territory._id)
      )
    )
    .collect();

  // Check for existing expeditions
  const existingExpedition = await ctx.db
    .query("expeditions")
    .withIndex("by_origin", (q: any) => q.eq("originTerritoryId", territory._id))
    .filter((q: any) =>
      q.or(
        q.eq(q.field("status"), "preparing"),
        q.eq(q.field("status"), "traveling"),
        q.eq(q.field("status"), "exploring")
      )
    )
    .first();

  // Priority 1: Desperation raid if starving
  if (pressure.resourcePressure >= 60) {
    // Find weakest neighbor with food
    let bestTarget: { id: Id<"territories">; food: number; military: number } | null = null;

    for (const rel of relationships) {
      // Don't raid allies
      if (rel.hasAlliance) continue;

      const otherId = rel.territory1Id === territory._id ? rel.territory2Id : rel.territory1Id;
      const other = await ctx.db.get(otherId);

      if (other && other.food > 30 && other.military < territory.military) {
        if (!bestTarget || (other.food > bestTarget.food && other.military < bestTarget.military)) {
          bestTarget = { id: otherId, food: other.food, military: other.military };
        }
      }
    }

    if (bestTarget && Math.random() < 0.4) {
      return { action: "desperation_raid", targetId: bestTarget.id };
    }
  }

  // Priority 2: Demand tribute from weak neighbors
  if (pressure.opportunityPressure >= 30 && territory.military > 50) {
    for (const rel of relationships) {
      if (rel.status === "at_war" || rel.hasAlliance) continue;

      const otherId = rel.territory1Id === territory._id ? rel.territory2Id : rel.territory1Id;
      const other = await ctx.db.get(otherId);

      if (other && other.military < territory.military * 0.4) {
        if (Math.random() < 0.2) {
          return { action: "demand_tribute", targetId: otherId };
        }
      }
    }
  }

  // Priority 3: Send scouts if no active expedition
  if (!existingExpedition && pressure.resourcePressure >= 30) {
    if (Math.random() < 0.3) {
      return { action: "send_scouts" };
    }
  }

  // Priority 4: Seek trade if moderate pressure
  if (pressure.resourcePressure >= 20 && pressure.resourcePressure < 60) {
    // Find potential trade partner
    for (const rel of relationships) {
      if (rel.status === "hostile" || rel.status === "at_war") continue;
      if (rel.hasTradeAgreement) continue;

      const otherId = rel.territory1Id === territory._id ? rel.territory2Id : rel.territory1Id;
      const other = await ctx.db.get(otherId);

      if (other && other.food > territory.food && rel.trust > -20) {
        if (Math.random() < 0.25) {
          return { action: "seek_trade", targetId: otherId };
        }
      }
    }
  }

  // Priority 5: Population split if severely overpopulated
  if (pressure.populationPressure >= 50 && territory.population > 500) {
    if (Math.random() < 0.15) {
      return { action: "population_split" };
    }
  }

  // Priority 6: Migration for nomadic cultures or extreme pressure
  if (pressure.total >= 70 && pressure.culturalPressure >= 15) {
    if (Math.random() < 0.1) {
      return { action: "migration" };
    }
  }

  return null;
}

/**
 * Execute the chosen expansion action
 */
async function executeExpansionAction(
  ctx: MutationCtx,
  territory: Doc<"territories">,
  actionInfo: { action: ExpansionAction; targetId?: Id<"territories"> },
  pressure: ExpansionPressure,
  tick: number
): Promise<ExpansionResult> {
  const { action, targetId } = actionInfo;

  switch (action) {
    case "desperation_raid":
      return await executeDesperationRaid(ctx, territory, targetId!, tick);

    case "demand_tribute":
      return await executeDemandTribute(ctx, territory, targetId!, tick);

    case "send_scouts":
      return await executeSendScouts(ctx, territory, tick);

    case "seek_trade":
      return await executeSeekTrade(ctx, territory, targetId!, tick);

    case "population_split":
      return await executePopulationSplit(ctx, territory, tick);

    case "migration":
      return await executeMigration(ctx, territory, tick);

    default:
      return { actionTaken: false };
  }
}

/**
 * Desperation raid - attack neighbor for food
 */
async function executeDesperationRaid(
  ctx: MutationCtx,
  territory: Doc<"territories">,
  targetId: Id<"territories">,
  tick: number
): Promise<ExpansionResult> {
  const target = await ctx.db.get(targetId);
  if (!target) return { actionTaken: false };

  // Simple raid calculation
  const ourStrength = territory.military * (0.8 + Math.random() * 0.4);
  const theirStrength = target.military * (0.8 + Math.random() * 0.4);

  const success = ourStrength > theirStrength;

  let foodGained = 0;
  let ourCasualties = 0;
  let theirCasualties = 0;

  if (success) {
    // Successful raid - take food
    foodGained = Math.floor(target.food * (0.2 + Math.random() * 0.2));
    ourCasualties = Math.floor(territory.population * 0.01);
    theirCasualties = Math.floor(target.population * 0.03);

    await ctx.db.patch(territory._id, {
      food: territory.food + foodGained,
      population: Math.max(10, territory.population - ourCasualties),
    });

    await ctx.db.patch(targetId, {
      food: Math.max(0, target.food - foodGained),
      population: Math.max(10, target.population - theirCasualties),
      happiness: Math.max(0, target.happiness - 15),
    });
  } else {
    // Failed raid - casualties, no gain
    ourCasualties = Math.floor(territory.population * 0.03);
    theirCasualties = Math.floor(target.population * 0.01);

    await ctx.db.patch(territory._id, {
      population: Math.max(10, territory.population - ourCasualties),
      happiness: Math.max(0, territory.happiness - 10),
    });

    await ctx.db.patch(targetId, {
      population: Math.max(10, target.population - theirCasualties),
    });
  }

  // Update relationship
  const relationship = await ctx.db
    .query("relationships")
    .filter((q: any) =>
      q.or(
        q.and(
          q.eq(q.field("territory1Id"), territory._id),
          q.eq(q.field("territory2Id"), targetId)
        ),
        q.and(
          q.eq(q.field("territory1Id"), targetId),
          q.eq(q.field("territory2Id"), territory._id)
        )
      )
    )
    .first();

  if (relationship) {
    await ctx.db.patch(relationship._id, {
      trust: Math.max(-100, relationship.trust - 30),
      status: "hostile",
      hasTradeAgreement: false,
      hasAlliance: false,
      lastAttackedBy: territory._id,
      lastAttackedTick: tick,
    } as any);
  }

  // Record event
  await ctx.db.insert("events", {
    tick,
    type: success ? "decision" : "death",
    territoryId: territory._id,
    title: success ? "Desperation Raid Succeeds!" : "Desperation Raid Fails!",
    description: success
      ? `Driven by hunger, our warriors raided ${target.name} and seized ${foodGained} food. ${ourCasualties} of our people died, but many more will live.`
      : `Our desperate raid on ${target.name} was repelled. ${ourCasualties} of our people died in the failed attempt.`,
    severity: success ? "warning" : "critical",
    createdAt: Date.now(),
  });

  // Record memory
  const agent = await ctx.db
    .query("agents")
    .withIndex("by_territory", (q: any) => q.eq("territoryId", territory._id))
    .first();

  if (agent) {
    await recordMemory(ctx, agent._id, {
      type: success ? "victory" : "defeat",
      description: success
        ? `Hunger drove us to raid ${target.name}. We took what we needed to survive.`
        : `Our desperate raid on ${target.name} failed. Our people suffered.`,
      emotionalWeight: success ? -20 : -50, // Negative even in success - it's shameful
      targetTerritoryId: targetId,
    });
  }

  // Check for retaliation
  const { processRetaliation } = await import("./warEmergence");
  await processRetaliation(ctx, territory._id, targetId, tick);

  return {
    actionTaken: true,
    action: "desperation_raid",
    description: success
      ? `Desperation raid on ${target.name} succeeded - ${foodGained} food taken`
      : `Desperation raid on ${target.name} failed`,
    targetTerritoryId: targetId,
    resourcesGained: success ? { food: foodGained } : undefined,
    populationLost: ourCasualties,
  };
}

/**
 * Demand tribute from weak neighbor
 */
async function executeDemandTribute(
  ctx: MutationCtx,
  territory: Doc<"territories">,
  targetId: Id<"territories">,
  tick: number
): Promise<ExpansionResult> {
  const target = await ctx.db.get(targetId);
  if (!target) return { actionTaken: false };

  // Calculate if they comply (based on military difference and their personality)
  const militaryRatio = territory.military / Math.max(1, target.military);
  let complianceChance = 0.2 + (militaryRatio - 1) * 0.3;

  // Low happiness = more likely to resist
  if (target.happiness > 50) {
    complianceChance -= 0.2;
  }

  complianceChance = Math.max(0.1, Math.min(0.8, complianceChance));

  const theyComply = Math.random() < complianceChance;

  let tributeGained = 0;

  // Get relationship
  const relationship = await ctx.db
    .query("relationships")
    .filter((q: any) =>
      q.or(
        q.and(
          q.eq(q.field("territory1Id"), territory._id),
          q.eq(q.field("territory2Id"), targetId)
        ),
        q.and(
          q.eq(q.field("territory1Id"), targetId),
          q.eq(q.field("territory2Id"), territory._id)
        )
      )
    )
    .first();

  if (theyComply) {
    // They pay tribute
    tributeGained = Math.floor(target.food * 0.15) + Math.floor(target.wealth * 0.1);
    const foodTribute = Math.floor(target.food * 0.15);
    const wealthTribute = Math.floor(target.wealth * 0.1);

    await ctx.db.patch(territory._id, {
      food: territory.food + foodTribute,
      wealth: territory.wealth + wealthTribute,
    });

    await ctx.db.patch(targetId, {
      food: Math.max(0, target.food - foodTribute),
      wealth: Math.max(0, target.wealth - wealthTribute),
      happiness: Math.max(0, target.happiness - 10),
    });

    if (relationship) {
      await ctx.db.patch(relationship._id, {
        trust: Math.max(-100, relationship.trust - 15),
        status: relationship.status === "at_war" ? "at_war" : "tense",
      });
    }

    await ctx.db.insert("events", {
      tick,
      type: "decision",
      territoryId: territory._id,
      title: `${target.name} Pays Tribute`,
      description: `Faced with our demands, ${target.name} has agreed to pay tribute. We received ${foodTribute} food and ${wealthTribute} wealth.`,
      severity: "info",
      createdAt: Date.now(),
    });

    return {
      actionTaken: true,
      action: "demand_tribute",
      description: `${target.name} paid tribute of ${foodTribute} food and ${wealthTribute} wealth`,
      targetTerritoryId: targetId,
      resourcesGained: { food: foodTribute, wealth: wealthTribute },
    };
  } else {
    // They refuse - relationship damaged, might lead to war
    if (relationship) {
      await ctx.db.patch(relationship._id, {
        trust: Math.max(-100, relationship.trust - 25),
        status: "hostile",
      });
    }

    await ctx.db.insert("events", {
      tick,
      type: "decision",
      territoryId: territory._id,
      title: `${target.name} Refuses Tribute!`,
      description: `${target.name} has refused our demand for tribute! This insult will not be forgotten.`,
      severity: "warning",
      createdAt: Date.now(),
    });

    return {
      actionTaken: true,
      action: "demand_tribute",
      description: `${target.name} refused tribute demand - relations damaged`,
      targetTerritoryId: targetId,
    };
  }
}

/**
 * Send scouts to find new resources
 */
async function executeSendScouts(
  ctx: MutationCtx,
  territory: Doc<"territories">,
  tick: number
): Promise<ExpansionResult> {
  // Create an expedition
  const directions = ["north", "south", "east", "west", "overseas"] as const;
  const direction = directions[Math.floor(Math.random() * directions.length)];

  const scoutCount = Math.min(20, Math.floor(territory.population * 0.02));

  if (scoutCount < 5) {
    return { actionTaken: false }; // Not enough people to send scouts
  }

  await ctx.db.insert("expeditions", {
    originTerritoryId: territory._id,
    targetDirection: direction,
    leaderId: undefined,
    explorerCount: scoutCount,
    soldierCount: 0,
    supplies: Math.floor(territory.food * 0.05),
    departureTick: tick,
    expectedReturnTick: tick + 6 + Math.floor(Math.random() * 6), // 6-12 ticks
    status: "traveling",
    discoveries: [],
    casualtyCount: 0,
  });

  // Deduct scouts and supplies
  await ctx.db.patch(territory._id, {
    population: territory.population - scoutCount,
    food: Math.max(0, territory.food - Math.floor(territory.food * 0.05)),
  });

  await ctx.db.insert("events", {
    tick,
    type: "decision",
    territoryId: territory._id,
    title: "Scouts Sent to Find Resources",
    description: `${scoutCount} scouts have been sent ${direction} to search for new sources of food and resources. They are expected to return in several moons.`,
    severity: "info",
    createdAt: Date.now(),
  });

  return {
    actionTaken: true,
    action: "send_scouts",
    description: `${scoutCount} scouts sent ${direction} to find resources`,
    populationLost: scoutCount, // Temporarily gone
  };
}

/**
 * Seek trade with a neighbor
 */
async function executeSeekTrade(
  ctx: MutationCtx,
  territory: Doc<"territories">,
  targetId: Id<"territories">,
  tick: number
): Promise<ExpansionResult> {
  const target = await ctx.db.get(targetId);
  if (!target) return { actionTaken: false };

  const relationship = await ctx.db
    .query("relationships")
    .filter((q: any) =>
      q.or(
        q.and(
          q.eq(q.field("territory1Id"), territory._id),
          q.eq(q.field("territory2Id"), targetId)
        ),
        q.and(
          q.eq(q.field("territory1Id"), targetId),
          q.eq(q.field("territory2Id"), territory._id)
        )
      )
    )
    .first();

  if (!relationship) return { actionTaken: false };

  // Calculate acceptance chance based on trust and their resources
  let acceptChance = 0.3;
  acceptChance += (relationship.trust + 50) / 200; // -50 to +50 trust = 0 to 0.5

  if (target.food > 60) acceptChance += 0.1; // They have surplus
  if (territory.wealth > target.wealth) acceptChance += 0.1; // We can pay

  const theyAccept = Math.random() < Math.min(0.8, acceptChance);

  if (theyAccept) {
    await ctx.db.patch(relationship._id, {
      hasTradeAgreement: true,
      trust: Math.min(100, relationship.trust + 10),
    });

    await ctx.db.insert("events", {
      tick,
      type: "decision",
      territoryId: territory._id,
      title: `Trade Agreement with ${target.name}`,
      description: `In our time of need, ${target.name} has agreed to trade with us. This may ease our resource shortage.`,
      severity: "positive",
      createdAt: Date.now(),
    });

    return {
      actionTaken: true,
      action: "seek_trade",
      description: `Trade agreement established with ${target.name}`,
      targetTerritoryId: targetId,
    };
  } else {
    await ctx.db.insert("events", {
      tick,
      type: "decision",
      territoryId: territory._id,
      title: `${target.name} Refuses Trade`,
      description: `${target.name} has declined our trade proposal. We must find another way to address our resource shortage.`,
      severity: "info",
      createdAt: Date.now(),
    });

    return {
      actionTaken: true,
      action: "seek_trade",
      description: `${target.name} refused trade proposal`,
      targetTerritoryId: targetId,
    };
  }
}

/**
 * Population splits off to form new settlement
 */
async function executePopulationSplit(
  ctx: MutationCtx,
  territory: Doc<"territories">,
  tick: number
): Promise<ExpansionResult> {
  // Calculate how many people leave
  const leavingPop = Math.floor(territory.population * (0.1 + Math.random() * 0.1)); // 10-20%

  if (leavingPop < 50) {
    return { actionTaken: false }; // Not enough to form viable settlement
  }

  // They take some resources with them
  const foodTaken = Math.floor(territory.food * (leavingPop / territory.population) * 0.8);
  const wealthTaken = Math.floor(territory.wealth * (leavingPop / territory.population) * 0.5);

  await ctx.db.patch(territory._id, {
    population: territory.population - leavingPop,
    food: Math.max(0, territory.food - foodTaken),
    wealth: Math.max(0, territory.wealth - wealthTaken),
    happiness: Math.max(0, territory.happiness - 5), // Sad to see them go
  });

  // The split-off group becomes an expedition that might establish a colony
  await ctx.db.insert("expeditions", {
    originTerritoryId: territory._id,
    targetDirection: ["north", "south", "east", "west"][Math.floor(Math.random() * 4)] as any,
    leaderId: undefined,
    explorerCount: Math.floor(leavingPop * 0.1),
    soldierCount: Math.floor(leavingPop * 0.05),
    supplies: foodTaken,
    departureTick: tick,
    expectedReturnTick: tick + 24, // Long journey
    status: "traveling",
    discoveries: [],
    casualtyCount: 0,
  });

  const tribeName = (territory as any).tribeName || territory.name;

  await ctx.db.insert("events", {
    tick,
    type: "decision",
    territoryId: territory._id,
    title: "Population Exodus!",
    description: `${leavingPop} people have left ${tribeName} to find a new home. They say our land can no longer support everyone. They go with our blessing and hope to establish a new settlement.`,
    severity: "warning",
    createdAt: Date.now(),
  });

  // Record memory
  const agent = await ctx.db
    .query("agents")
    .withIndex("by_territory", (q: any) => q.eq("territoryId", territory._id))
    .first();

  if (agent) {
    await recordMemory(ctx, agent._id, {
      type: "trade", // Using trade as "significant change"
      description: `${leavingPop} of our people left to find new lands. Our home could not support us all.`,
      emotionalWeight: -30,
    });
  }

  return {
    actionTaken: true,
    action: "population_split",
    description: `${leavingPop} people split off to find new lands`,
    populationLost: leavingPop,
  };
}

/**
 * Migration - entire group moves to new location
 */
async function executeMigration(
  ctx: MutationCtx,
  territory: Doc<"territories">,
  tick: number
): Promise<ExpansionResult> {
  // This is a major event - the civilization is effectively relocating
  // In the current system, we'll model this as them becoming nomadic and seeking new territory

  const tribeName = (territory as any).tribeName || territory.name;

  // Significant losses during migration
  const migrationLosses = Math.floor(territory.population * 0.15);
  const foodLost = Math.floor(territory.food * 0.3);

  await ctx.db.patch(territory._id, {
    population: Math.max(50, territory.population - migrationLosses),
    food: Math.max(0, territory.food - foodLost),
    happiness: Math.max(0, territory.happiness - 20),
    // Mark as "migrating" somehow - could use a status field
  });

  // Create a long expedition representing the migration
  await ctx.db.insert("expeditions", {
    originTerritoryId: territory._id,
    targetDirection: ["north", "south", "east", "west"][Math.floor(Math.random() * 4)] as any,
    leaderId: undefined,
    explorerCount: Math.floor(territory.population * 0.3),
    soldierCount: Math.floor(territory.military * 0.3),
    supplies: territory.food - foodLost,
    departureTick: tick,
    expectedReturnTick: tick + 36, // Very long journey
    status: "traveling",
    discoveries: [],
    casualtyCount: 0,
  });

  await ctx.db.insert("events", {
    tick,
    type: "death",
    territoryId: territory._id,
    title: `${tribeName} Begins Great Migration!`,
    description: `The land can no longer sustain us. ${tribeName} has begun a great migration, seeking new territories where our people can thrive. ${migrationLosses} were lost in the journey's beginning.`,
    severity: "critical",
    createdAt: Date.now(),
  });

  // Record memory
  const agent = await ctx.db
    .query("agents")
    .withIndex("by_territory", (q: any) => q.eq("territoryId", territory._id))
    .first();

  if (agent) {
    await recordMemory(ctx, agent._id, {
      type: "betrayal", // Traumatic event
      description: `Our homeland could no longer sustain us. We began the great migration, leaving behind everything we knew.`,
      emotionalWeight: -80,
    });
  }

  return {
    actionTaken: true,
    action: "migration",
    description: `${tribeName} has begun a great migration - ${migrationLosses} lost`,
    populationLost: migrationLosses,
  };
}

/**
 * Check if returned expeditions found resources (call during tick)
 */
export async function processExpeditionReturns(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  tick: number
): Promise<void> {
  const territory = await ctx.db.get(territoryId);
  if (!territory) return;

  // Find expeditions that should return
  const returningExpeditions = await ctx.db
    .query("expeditions")
    .withIndex("by_origin", (q: any) => q.eq("originTerritoryId", territoryId))
    .filter((q: any) => q.and(
      q.lte(q.field("expectedReturnTick"), tick),
      q.or(
        q.eq(q.field("status"), "traveling"),
        q.eq(q.field("status"), "exploring"),
        q.eq(q.field("status"), "returning")
      )
    ))
    .collect();

  for (const expedition of returningExpeditions) {
    // Determine expedition outcome
    const successRoll = Math.random();
    const casualties = Math.floor(expedition.explorerCount * (0.05 + Math.random() * 0.15));
    const survivors = expedition.explorerCount - casualties;

    if (successRoll < 0.2) {
      // Expedition lost
      await ctx.db.patch(expedition._id, {
        status: "lost",
        casualtyCount: expedition.explorerCount,
      });

      await ctx.db.insert("events", {
        tick,
        type: "death",
        territoryId,
        title: "Expedition Lost!",
        description: `Our expedition to the ${expedition.targetDirection} has been lost. ${expedition.explorerCount} souls, gone.`,
        severity: "critical",
        createdAt: Date.now(),
      });
    } else {
      // Expedition returns
      const foundFood = Math.floor(Math.random() * 30);
      const foundWealth = Math.floor(Math.random() * 15);
      const discoveries: Array<{ type: string; description: string; value: number }> = [];

      if (Math.random() < 0.4) {
        discoveries.push({
          type: "resource",
          description: `Rich ${["hunting grounds", "fishing waters", "fertile soil", "mineral deposits"][Math.floor(Math.random() * 4)]}`,
          value: 20 + Math.floor(Math.random() * 30),
        });
      }

      if (Math.random() < 0.2) {
        discoveries.push({
          type: "settlement_site",
          description: "A suitable location for a new settlement",
          value: 50,
        });
      }

      await ctx.db.patch(expedition._id, {
        status: "completed",
        casualtyCount: casualties,
        discoveries,
      });

      // Return survivors and resources
      await ctx.db.patch(territoryId, {
        population: territory.population + survivors,
        food: territory.food + foundFood + Math.floor(expedition.supplies * 0.5),
        wealth: territory.wealth + foundWealth,
      });

      const discoveryText = discoveries.length > 0
        ? ` They discovered: ${discoveries.map(d => d.description).join(", ")}.`
        : "";

      await ctx.db.insert("events", {
        tick,
        type: "breakthrough",
        territoryId,
        title: "Expedition Returns!",
        description: `Our expedition to the ${expedition.targetDirection} has returned! ${survivors} of ${expedition.explorerCount} survived. They brought back ${foundFood} food and ${foundWealth} wealth.${discoveryText}`,
        severity: "positive",
        createdAt: Date.now(),
      });
    }
  }
}
