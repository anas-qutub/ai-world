/**
 * Exploration System
 *
 * Handles expeditions, discoveries, fog of war, and colonial ventures.
 */

import { MutationCtx, QueryCtx } from "../_generated/server";
import { Id, Doc } from "../_generated/dataModel";

// Expedition directions
export type ExpeditionDirection = "north" | "south" | "east" | "west" | "overseas";

// Expedition status
export type ExpeditionStatus =
  | "preparing"
  | "traveling"
  | "exploring"
  | "returning"
  | "completed"
  | "lost";

// Discovery types
export type DiscoveryType =
  | "fertile_land"
  | "gold_deposit"
  | "ancient_ruins"
  | "new_people"
  | "rare_resources"
  | "natural_wonder"
  | "danger"
  | "nothing";

// Discovery probabilities by direction
const DISCOVERY_CHANCES: Record<ExpeditionDirection, Record<DiscoveryType, number>> = {
  north: {
    fertile_land: 15,
    gold_deposit: 5,
    ancient_ruins: 10,
    new_people: 10,
    rare_resources: 10,
    natural_wonder: 5,
    danger: 20,
    nothing: 25,
  },
  south: {
    fertile_land: 20,
    gold_deposit: 10,
    ancient_ruins: 15,
    new_people: 15,
    rare_resources: 10,
    natural_wonder: 10,
    danger: 10,
    nothing: 10,
  },
  east: {
    fertile_land: 15,
    gold_deposit: 8,
    ancient_ruins: 12,
    new_people: 20,
    rare_resources: 15,
    natural_wonder: 5,
    danger: 15,
    nothing: 10,
  },
  west: {
    fertile_land: 18,
    gold_deposit: 12,
    ancient_ruins: 8,
    new_people: 12,
    rare_resources: 20,
    natural_wonder: 10,
    danger: 10,
    nothing: 10,
  },
  overseas: {
    fertile_land: 25,
    gold_deposit: 15,
    ancient_ruins: 10,
    new_people: 20,
    rare_resources: 10,
    natural_wonder: 5,
    danger: 10,
    nothing: 5,
  },
};

// Base expedition duration by direction
const BASE_DURATION: Record<ExpeditionDirection, number> = {
  north: 15,
  south: 12,
  east: 10,
  west: 10,
  overseas: 25,
};

/**
 * Launch an expedition
 */
export async function launchExpedition(
  ctx: MutationCtx,
  originTerritoryId: Id<"territories">,
  direction: ExpeditionDirection,
  explorerCount: number,
  soldierCount: number,
  supplies: number,
  leaderId: Id<"characters"> | undefined,
  tick: number
): Promise<{ expeditionId: Id<"expeditions">; message: string }> {
  const territory = await ctx.db.get(originTerritoryId);
  if (!territory) throw new Error("Territory not found");

  // Validate resources
  const totalPeople = explorerCount + soldierCount;
  if (territory.population < totalPeople + 100) {
    throw new Error("Not enough population to spare for expedition");
  }

  if (territory.food < supplies) {
    throw new Error("Not enough food for supplies");
  }

  // Check for harbor if overseas
  if (direction === "overseas") {
    const harbor = await ctx.db
      .query("infrastructure")
      .withIndex("by_territory", (q) => q.eq("territoryId", originTerritoryId))
      .filter((q) => q.eq(q.field("type"), "harbor"))
      .first();

    if (!harbor) {
      throw new Error("Need a harbor for overseas expeditions");
    }
  }

  // Deduct resources
  await ctx.db.patch(originTerritoryId, {
    population: territory.population - totalPeople,
    food: territory.food - supplies,
  });

  // Calculate expected duration
  const baseDuration = BASE_DURATION[direction];
  const durationVariance = Math.floor(Math.random() * 10) - 5;
  const expectedDuration = baseDuration + durationVariance;

  // Create expedition
  const expeditionId = await ctx.db.insert("expeditions", {
    originTerritoryId,
    targetDirection: direction,
    leaderId,
    explorerCount,
    soldierCount,
    supplies,
    departureTick: tick,
    expectedReturnTick: tick + expectedDuration,
    status: "traveling",
    discoveries: [],
    casualtyCount: 0,
  });

  // Record memory
  const agent = await ctx.db
    .query("agents")
    .withIndex("by_territory", (q) => q.eq("territoryId", originTerritoryId))
    .first();

  if (agent) {
    const leader = leaderId ? await ctx.db.get(leaderId) : null;
    await ctx.db.insert("agentMemories", {
      agentId: agent._id,
      territoryId: originTerritoryId,
      memoryType: "victory",
      tick,
      description: `Launched expedition to the ${direction}${leader ? ` led by ${leader.name}` : ""}. ${totalPeople} brave souls set out into the unknown.`,
      emotionalWeight: 5,
      salience: 70,
      timesReferenced: 0,
    });
  }

  return {
    expeditionId,
    message: `Expedition of ${totalPeople} has departed toward the ${direction}. Expected return in ${expectedDuration} ticks.`,
  };
}

/**
 * Process a single expedition
 */
async function processExpedition(
  ctx: MutationCtx,
  expedition: Doc<"expeditions">,
  tick: number
): Promise<{ events: Array<{ type: string; description: string }> }> {
  const events: Array<{ type: string; description: string }> = [];

  const origin = await ctx.db.get(expedition.originTerritoryId);
  if (!origin) return { events };

  switch (expedition.status) {
    case "traveling":
      // Check if arrived at exploration site
      const travelTime = Math.floor(
        (expedition.expectedReturnTick - expedition.departureTick) / 3
      );
      if (tick >= expedition.departureTick + travelTime) {
        await ctx.db.patch(expedition._id, { status: "exploring" });
        events.push({
          type: "expedition_arrived",
          description: `Our expedition to the ${expedition.targetDirection} has reached unexplored territory and begun exploration.`,
        });
      }

      // Random travel events
      if (Math.random() < 0.1) {
        const travelEvent = await handleTravelEvent(ctx, expedition, tick);
        if (travelEvent) events.push(travelEvent);
      }
      break;

    case "exploring":
      // Make discoveries
      const discovery = await makeDiscovery(ctx, expedition, tick);
      if (discovery) events.push(discovery);

      // Check if exploration phase is over
      const exploreEndTick =
        expedition.departureTick +
        Math.floor((expedition.expectedReturnTick - expedition.departureTick) * 0.7);
      if (tick >= exploreEndTick) {
        await ctx.db.patch(expedition._id, { status: "returning" });
        events.push({
          type: "expedition_returning",
          description: `Our expedition to the ${expedition.targetDirection} has begun the journey home.`,
        });
      }
      break;

    case "returning":
      // Check if returned
      if (tick >= expedition.expectedReturnTick) {
        await completeExpedition(ctx, expedition, tick);
        events.push({
          type: "expedition_returned",
          description: await getReturnMessage(ctx, expedition),
        });
      }

      // Random return events
      if (Math.random() < 0.05) {
        const returnEvent = await handleReturnEvent(ctx, expedition, tick);
        if (returnEvent) events.push(returnEvent);
      }
      break;

    case "preparing":
      // Check if ready to depart
      if (expedition.supplies >= 50) {
        await ctx.db.patch(expedition._id, { status: "traveling" });
      }
      break;
  }

  // Consume supplies
  if (expedition.status === "traveling" || expedition.status === "exploring") {
    const consumption = Math.ceil(
      (expedition.explorerCount + expedition.soldierCount) / 10
    );
    const newSupplies = expedition.supplies - consumption;

    if (newSupplies <= 0) {
      // Expedition runs out of supplies - disaster!
      await handleSupplyExhaustion(ctx, expedition, tick);
      events.push({
        type: "expedition_crisis",
        description: `Our expedition to the ${expedition.targetDirection} has run out of supplies! They face starvation.`,
      });
    } else {
      await ctx.db.patch(expedition._id, { supplies: newSupplies });
    }
  }

  return { events };
}

/**
 * Handle travel events
 */
async function handleTravelEvent(
  ctx: MutationCtx,
  expedition: Doc<"expeditions">,
  tick: number
): Promise<{ type: string; description: string } | null> {
  const roll = Math.random();

  if (roll < 0.3) {
    // Disease outbreak
    const casualties = Math.floor(
      Math.random() * Math.ceil((expedition.explorerCount + expedition.soldierCount) / 5)
    );
    if (casualties > 0) {
      await ctx.db.patch(expedition._id, {
        casualtyCount: expedition.casualtyCount + casualties,
        explorerCount: Math.max(0, expedition.explorerCount - Math.ceil(casualties / 2)),
        soldierCount: Math.max(0, expedition.soldierCount - Math.floor(casualties / 2)),
      });
      return {
        type: "expedition_disease",
        description: `Disease struck our expedition. ${casualties} have perished.`,
      };
    }
  } else if (roll < 0.5) {
    // Harsh terrain
    const supplyLoss = Math.floor(expedition.supplies * 0.1);
    await ctx.db.patch(expedition._id, {
      supplies: expedition.supplies - supplyLoss,
    });
    return {
      type: "expedition_terrain",
      description: `Difficult terrain forced our expedition to abandon some supplies.`,
    };
  } else if (roll < 0.6) {
    // Found water source
    return {
      type: "expedition_water",
      description: `Our expedition found a fresh water source - morale is high.`,
    };
  }

  return null;
}

/**
 * Make a discovery during exploration
 */
async function makeDiscovery(
  ctx: MutationCtx,
  expedition: Doc<"expeditions">,
  tick: number
): Promise<{ type: string; description: string } | null> {
  // Only discover things occasionally
  if (Math.random() > 0.2) return null;

  const direction = expedition.targetDirection || "east";
  const chances = DISCOVERY_CHANCES[direction];

  // Roll for discovery type
  const roll = Math.random() * 100;
  let cumulative = 0;
  let discoveryType: DiscoveryType = "nothing";

  for (const [type, chance] of Object.entries(chances)) {
    cumulative += chance;
    if (roll <= cumulative) {
      discoveryType = type as DiscoveryType;
      break;
    }
  }

  // Calculate discovery value based on type and exploration skill
  const baseValue = {
    fertile_land: 500,
    gold_deposit: 1000,
    ancient_ruins: 300,
    new_people: 200,
    rare_resources: 600,
    natural_wonder: 100,
    danger: -200,
    nothing: 0,
  };

  const value = baseValue[discoveryType] * (0.5 + Math.random());

  // Generate description
  const descriptions: Record<DiscoveryType, string[]> = {
    fertile_land: [
      "vast fertile plains perfect for farming",
      "a lush river valley with rich soil",
      "green hills suitable for settlement",
    ],
    gold_deposit: [
      "glittering gold deposits in the mountains",
      "a river rich with gold dust",
      "ancient mines with remaining gold veins",
    ],
    ancient_ruins: [
      "crumbling ruins of an ancient civilization",
      "mysterious stone monuments",
      "a forgotten temple filled with artifacts",
    ],
    new_people: [
      "a tribe of friendly natives willing to trade",
      "isolated villages with unique customs",
      "nomadic peoples with valuable knowledge",
    ],
    rare_resources: [
      "rare medicinal herbs",
      "deposits of precious gems",
      "exotic spices growing wild",
    ],
    natural_wonder: [
      "a breathtaking waterfall",
      "hot springs with healing properties",
      "a cave system of immense beauty",
    ],
    danger: [
      "hostile warriors who attacked the expedition",
      "a dangerous predator that killed several members",
      "treacherous terrain that claimed lives",
    ],
    nothing: [
      "barren wasteland",
      "nothing of interest",
      "impenetrable jungle with no path forward",
    ],
  };

  const description =
    descriptions[discoveryType][
      Math.floor(Math.random() * descriptions[discoveryType].length)
    ];

  // Handle danger casualties
  if (discoveryType === "danger") {
    const casualties = Math.floor(
      Math.random() * Math.ceil((expedition.explorerCount + expedition.soldierCount) / 4)
    );
    await ctx.db.patch(expedition._id, {
      casualtyCount: expedition.casualtyCount + casualties,
      soldierCount: Math.max(0, expedition.soldierCount - casualties),
    });
  }

  // Add to discoveries
  const currentDiscoveries = expedition.discoveries || [];
  await ctx.db.patch(expedition._id, {
    discoveries: [
      ...currentDiscoveries,
      {
        type: discoveryType,
        description,
        value: Math.floor(value),
        tick,
      },
    ],
  });

  return {
    type: `expedition_discovery_${discoveryType}`,
    description: `Our expedition discovered ${description}!`,
  };
}

/**
 * Handle return events
 */
async function handleReturnEvent(
  ctx: MutationCtx,
  expedition: Doc<"expeditions">,
  tick: number
): Promise<{ type: string; description: string } | null> {
  // Most return events are positive
  const roll = Math.random();

  if (roll < 0.3) {
    // Met friendly travelers
    return {
      type: "expedition_friendly",
      description: `Our returning expedition met friendly travelers who shared food and news.`,
    };
  } else if (roll < 0.5) {
    // Bandits
    const goldLost = Math.floor(
      expedition.discoveries.reduce((sum, d) => sum + (d.value > 0 ? d.value : 0), 0) *
        0.1
    );
    return {
      type: "expedition_bandits",
      description: `Bandits attacked our returning expedition, stealing some of their findings.`,
    };
  }

  return null;
}

/**
 * Handle supply exhaustion
 */
async function handleSupplyExhaustion(
  ctx: MutationCtx,
  expedition: Doc<"expeditions">,
  tick: number
): Promise<void> {
  // Severe casualties from starvation
  const casualties = Math.ceil(
    (expedition.explorerCount + expedition.soldierCount) * 0.3
  );

  const remainingExplorers = Math.max(0, expedition.explorerCount - Math.ceil(casualties / 2));
  const remainingSoldiers = Math.max(0, expedition.soldierCount - Math.floor(casualties / 2));

  if (remainingExplorers + remainingSoldiers <= 0) {
    // Expedition lost
    await ctx.db.patch(expedition._id, {
      status: "lost",
      casualtyCount: expedition.explorerCount + expedition.soldierCount,
      explorerCount: 0,
      soldierCount: 0,
    });
  } else {
    // Force return with reduced numbers
    await ctx.db.patch(expedition._id, {
      status: "returning",
      casualtyCount: expedition.casualtyCount + casualties,
      explorerCount: remainingExplorers,
      soldierCount: remainingSoldiers,
      supplies: 0,
    });
  }
}

/**
 * Complete expedition - return home
 */
async function completeExpedition(
  ctx: MutationCtx,
  expedition: Doc<"expeditions">,
  tick: number
): Promise<void> {
  await ctx.db.patch(expedition._id, { status: "completed" });

  const origin = await ctx.db.get(expedition.originTerritoryId);
  if (!origin) return;

  // Return surviving members to population
  const survivors = expedition.explorerCount + expedition.soldierCount;
  let goldGained = 0;
  let knowledgeGained = 0;

  // Process discoveries
  for (const discovery of expedition.discoveries) {
    if (discovery.value > 0) {
      if (discovery.type === "gold_deposit") {
        goldGained += discovery.value;
      } else if (discovery.type === "ancient_ruins") {
        knowledgeGained += discovery.value / 10;
      } else if (discovery.type === "rare_resources") {
        goldGained += discovery.value * 0.7;
      } else {
        goldGained += discovery.value * 0.3;
      }
    }
  }

  // Apply gains
  await ctx.db.patch(expedition.originTerritoryId, {
    population: origin.population + survivors,
    wealth: origin.wealth + Math.floor(goldGained),
    technology: Math.min(100, origin.technology + Math.floor(knowledgeGained)),
  });

  // Record memory
  const agent = await ctx.db
    .query("agents")
    .withIndex("by_territory", (q) => q.eq("territoryId", expedition.originTerritoryId))
    .first();

  if (agent) {
    await ctx.db.insert("agentMemories", {
      agentId: agent._id,
      territoryId: expedition.originTerritoryId,
      memoryType: "victory",
      tick,
      description: `Expedition to the ${expedition.targetDirection} returned! ${survivors} survivors, ${expedition.casualtyCount} lost. Brought back ${Math.floor(goldGained)} gold worth of findings.`,
      emotionalWeight: survivors > 0 ? 10 : -20,
      salience: 80,
      timesReferenced: 0,
    });
  }
}

/**
 * Get return message
 */
async function getReturnMessage(
  ctx: QueryCtx,
  expedition: Doc<"expeditions">
): Promise<string> {
  const survivors = expedition.explorerCount + expedition.soldierCount;
  const discoveries = expedition.discoveries.filter((d) => d.value > 0).length;
  const totalValue = expedition.discoveries.reduce(
    (sum, d) => sum + Math.max(0, d.value),
    0
  );

  if (survivors === 0) {
    return `Our expedition to the ${expedition.targetDirection} has been lost. None returned.`;
  }

  let message = `Our expedition to the ${expedition.targetDirection} has returned! `;
  message += `${survivors} survivors (${expedition.casualtyCount} lost). `;

  if (discoveries > 0) {
    message += `Made ${discoveries} significant discoveries worth ~${Math.floor(totalValue)} gold.`;
  } else {
    message += "Found nothing of value.";
  }

  return message;
}

/**
 * Process all expeditions
 */
export async function processExpeditions(
  ctx: MutationCtx,
  tick: number
): Promise<{ events: Array<{ type: string; description: string }> }> {
  const allEvents: Array<{ type: string; description: string }> = [];

  const expeditions = await ctx.db
    .query("expeditions")
    .filter((q) =>
      q.and(
        q.neq(q.field("status"), "completed"),
        q.neq(q.field("status"), "lost")
      )
    )
    .collect();

  for (const expedition of expeditions) {
    const { events } = await processExpedition(ctx, expedition, tick);
    allEvents.push(...events);
  }

  return { events: allEvents };
}

/**
 * Get exploration summary for AI
 */
export async function getExplorationSummary(
  ctx: QueryCtx,
  territoryId: Id<"territories">
): Promise<string> {
  const expeditions = await ctx.db
    .query("expeditions")
    .withIndex("by_origin", (q) => q.eq("originTerritoryId", territoryId))
    .collect();

  const active = expeditions.filter(
    (e) =>
      e.status === "traveling" || e.status === "exploring" || e.status === "returning"
  );
  const completed = expeditions.filter((e) => e.status === "completed");
  const lost = expeditions.filter((e) => e.status === "lost");

  if (expeditions.length === 0) {
    return "No expeditions have been launched.";
  }

  let summary = "";

  if (active.length > 0) {
    summary += `Active expeditions: ${active.length} (`;
    summary += active.map((e) => `${e.targetDirection}: ${e.status}`).join(", ");
    summary += "). ";
  }

  summary += `History: ${completed.length} successful, ${lost.length} lost. `;

  // Total discoveries
  const allDiscoveries = completed.flatMap((e) => e.discoveries).filter((d) => d.value > 0);
  if (allDiscoveries.length > 0) {
    summary += `Notable discoveries: ${allDiscoveries.length}.`;
  }

  return summary;
}
