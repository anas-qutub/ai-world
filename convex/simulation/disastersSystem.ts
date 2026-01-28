/**
 * Natural Disasters System
 *
 * Handles earthquakes, floods, volcanic eruptions, tsunamis, wildfires,
 * and landslides - including triggers, damage, recovery.
 */

import { MutationCtx, QueryCtx } from "../_generated/server";
import { Id, Doc } from "../_generated/dataModel";
import { damageInfrastructure } from "./infrastructureSystem";

// Disaster types
export type DisasterType =
  | "earthquake"
  | "flood"
  | "volcanic_eruption"
  | "tsunami"
  | "wildfire"
  | "landslide";

export type DisasterSeverity = "minor" | "moderate" | "major" | "catastrophic";

// Base probabilities per tick (per 1000)
const DISASTER_BASE_PROBABILITY: Record<DisasterType, number> = {
  earthquake: 2,
  flood: 5,
  volcanic_eruption: 0.5,
  tsunami: 0.3,
  wildfire: 4,
  landslide: 2,
};

// Severity probabilities (given a disaster occurs)
const SEVERITY_PROBABILITY: Record<DisasterSeverity, number> = {
  minor: 50,
  moderate: 30,
  major: 15,
  catastrophic: 5,
};

// Disaster effects by severity
const DISASTER_EFFECTS: Record<DisasterSeverity, {
  populationLossPercent: { min: number; max: number };
  buildingDestructionPercent: { min: number; max: number };
  infrastructureDamagePercent: { min: number; max: number };
  durationTicks: { min: number; max: number };
  happinessPenalty: number;
}> = {
  minor: {
    populationLossPercent: { min: 0, max: 2 },
    buildingDestructionPercent: { min: 0, max: 5 },
    infrastructureDamagePercent: { min: 0, max: 10 },
    durationTicks: { min: 1, max: 2 },
    happinessPenalty: 5,
  },
  moderate: {
    populationLossPercent: { min: 2, max: 8 },
    buildingDestructionPercent: { min: 5, max: 15 },
    infrastructureDamagePercent: { min: 10, max: 25 },
    durationTicks: { min: 2, max: 4 },
    happinessPenalty: 15,
  },
  major: {
    populationLossPercent: { min: 8, max: 20 },
    buildingDestructionPercent: { min: 15, max: 35 },
    infrastructureDamagePercent: { min: 25, max: 50 },
    durationTicks: { min: 3, max: 6 },
    happinessPenalty: 30,
  },
  catastrophic: {
    populationLossPercent: { min: 20, max: 50 },
    buildingDestructionPercent: { min: 35, max: 70 },
    infrastructureDamagePercent: { min: 50, max: 90 },
    durationTicks: { min: 6, max: 12 },
    happinessPenalty: 50,
  },
};

// Disaster-specific modifiers
const DISASTER_MODIFIERS: Record<DisasterType, {
  weatherTriggers?: string[];
  seasonModifiers?: Record<string, number>;
  description: string;
}> = {
  earthquake: {
    description: "The ground shakes violently",
  },
  flood: {
    weatherTriggers: ["heavy_rain", "monsoon"],
    seasonModifiers: { spring: 1.5, summer: 0.5 },
    description: "Waters rise and overflow",
  },
  volcanic_eruption: {
    description: "The volcano erupts with devastating force",
  },
  tsunami: {
    description: "A massive wave crashes onto the shore",
  },
  wildfire: {
    weatherTriggers: ["drought", "heat_wave"],
    seasonModifiers: { summer: 2, autumn: 1.5, winter: 0.3 },
    description: "Fire spreads uncontrollably",
  },
  landslide: {
    weatherTriggers: ["heavy_rain", "monsoon"],
    seasonModifiers: { spring: 1.3 },
    description: "The hillside gives way",
  },
};

/**
 * Check for potential disaster occurrence
 */
export async function checkDisasterRisk(
  ctx: QueryCtx,
  territoryId: Id<"territories">,
  tick: number,
  currentWeather?: string,
  currentSeason?: string
): Promise<{ atRisk: boolean; mostLikely?: DisasterType; probability?: number }> {
  // Check for active disasters
  const activeDisaster = await ctx.db
    .query("disasters")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .filter((q) => q.eq(q.field("status"), "active"))
    .first();

  if (activeDisaster) {
    return { atRisk: false }; // Already dealing with a disaster
  }

  let highestRisk: { type: DisasterType; probability: number } | null = null;

  for (const [type, baseProbability] of Object.entries(DISASTER_BASE_PROBABILITY)) {
    const disasterType = type as DisasterType;
    let probability = baseProbability;

    const modifiers = DISASTER_MODIFIERS[disasterType];

    // Apply weather triggers
    if (currentWeather && modifiers.weatherTriggers?.includes(currentWeather)) {
      probability *= 3; // Triple probability during triggering weather
    }

    // Apply seasonal modifiers
    if (currentSeason && modifiers.seasonModifiers?.[currentSeason]) {
      probability *= modifiers.seasonModifiers[currentSeason];
    }

    if (!highestRisk || probability > highestRisk.probability) {
      highestRisk = { type: disasterType, probability };
    }
  }

  if (highestRisk && highestRisk.probability > 3) {
    return {
      atRisk: true,
      mostLikely: highestRisk.type,
      probability: highestRisk.probability,
    };
  }

  return { atRisk: false };
}

/**
 * Trigger a disaster
 */
export async function triggerDisaster(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  type: DisasterType,
  tick: number,
  forcedSeverity?: DisasterSeverity
): Promise<{
  disasterId: Id<"disasters">;
  casualties: number;
  buildingsDestroyed: number;
  message: string;
}> {
  const territory = await ctx.db.get(territoryId);
  if (!territory) throw new Error("Territory not found");

  // Determine severity
  let severity: DisasterSeverity;
  if (forcedSeverity) {
    severity = forcedSeverity;
  } else {
    const random = Math.random() * 100;
    let cumulative = 0;
    severity = "minor";
    for (const [sev, prob] of Object.entries(SEVERITY_PROBABILITY)) {
      cumulative += prob;
      if (random <= cumulative) {
        severity = sev as DisasterSeverity;
        break;
      }
    }
  }

  const effects = DISASTER_EFFECTS[severity];

  // Calculate casualties
  const casualtyPercent =
    Math.random() * (effects.populationLossPercent.max - effects.populationLossPercent.min) +
    effects.populationLossPercent.min;
  const casualties = Math.floor(territory.population * (casualtyPercent / 100));

  // Calculate building destruction
  const buildingDestroyPercent =
    Math.random() *
      (effects.buildingDestructionPercent.max - effects.buildingDestructionPercent.min) +
    effects.buildingDestructionPercent.min;

  // Get and damage buildings
  const buildings = await ctx.db
    .query("buildings")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .collect();

  const buildingsToDestroy = Math.floor(buildings.length * (buildingDestroyPercent / 100));
  const destroyedBuildings: Id<"buildings">[] = [];

  // Randomly select buildings to destroy
  const shuffled = [...buildings].sort(() => Math.random() - 0.5);
  for (let i = 0; i < Math.min(buildingsToDestroy, shuffled.length); i++) {
    await ctx.db.delete(shuffled[i]._id);
    destroyedBuildings.push(shuffled[i]._id);
  }

  // Damage infrastructure
  const infraDamagePercent =
    Math.random() *
      (effects.infrastructureDamagePercent.max - effects.infrastructureDamagePercent.min) +
    effects.infrastructureDamagePercent.min;

  const infraDamage = await damageInfrastructure(ctx, territoryId, infraDamagePercent);

  // Calculate duration
  const duration =
    Math.floor(
      Math.random() * (effects.durationTicks.max - effects.durationTicks.min + 1) +
        effects.durationTicks.min
    );

  // Apply immediate effects to territory
  await ctx.db.patch(territoryId, {
    population: Math.max(1, territory.population - casualties),
    happiness: Math.max(0, territory.happiness - effects.happinessPenalty),
  });

  // Create disaster record
  const disasterId = await ctx.db.insert("disasters", {
    territoryId,
    type,
    severity,
    startTick: tick,
    endTick: tick + duration,
    populationCasualties: casualties,
    buildingsDestroyed: buildingsToDestroy,
    infrastructureDamaged: [], // Could track specific infrastructure
    recoveryProgress: 0,
    status: "active",
    traumaticMemoryCreated: false,
  });

  const modifiers = DISASTER_MODIFIERS[type];
  const severityNames: Record<DisasterSeverity, string> = {
    minor: "minor",
    moderate: "significant",
    major: "devastating",
    catastrophic: "catastrophic",
  };

  const message = `A ${severityNames[severity]} ${type.replace("_", " ")} has struck! ${modifiers.description}. ${casualties} perished, ${buildingsToDestroy} buildings destroyed.`;

  return { disasterId, casualties, buildingsDestroyed: buildingsToDestroy, message };
}

/**
 * Process active disasters
 */
export async function processActiveDisasters(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  tick: number
): Promise<{ events: Array<{ type: string; description: string }> }> {
  const events: Array<{ type: string; description: string }> = [];

  const disasters = await ctx.db
    .query("disasters")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .filter((q) => q.neq(q.field("status"), "recovered"))
    .collect();

  for (const disaster of disasters) {
    if (disaster.status === "active") {
      // Check if disaster should end
      if (tick >= disaster.endTick) {
        await ctx.db.patch(disaster._id, { status: "recovering" });
        events.push({
          type: "disaster_end",
          description: `The ${disaster.type.replace("_", " ")} has ended. Recovery begins.`,
        });

        // Create traumatic memories for survivors
        if (!disaster.traumaticMemoryCreated) {
          await createDisasterTrauma(ctx, territoryId, disaster, tick);
          await ctx.db.patch(disaster._id, { traumaticMemoryCreated: true });
        }
      }
    } else if (disaster.status === "recovering") {
      // Progress recovery
      const recoveryRate = 10; // 10% per tick
      const newProgress = Math.min(100, disaster.recoveryProgress + recoveryRate);

      await ctx.db.patch(disaster._id, { recoveryProgress: newProgress });

      if (newProgress >= 100) {
        await ctx.db.patch(disaster._id, { status: "recovered" });
        events.push({
          type: "recovery_complete",
          description: `Recovery from the ${disaster.type.replace("_", " ")} is complete.`,
        });
      }
    }
  }

  return { events };
}

/**
 * Create traumatic memories from disaster
 */
async function createDisasterTrauma(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  disaster: Doc<"disasters">,
  tick: number
): Promise<void> {
  // Get characters in territory
  const characters = await ctx.db
    .query("characters")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .filter((q) => q.eq(q.field("isAlive"), true))
    .collect();

  const traumaLevel = {
    minor: 10,
    moderate: 25,
    major: 50,
    catastrophic: 75,
  }[disaster.severity];

  for (const character of characters) {
    // Not everyone is equally affected
    if (Math.random() > 0.7) continue; // 30% chance to be significantly affected

    const mentalHealth = character.mentalHealth || {
      sanity: 80,
      trauma: 0,
      depression: 0,
      anxiety: 0,
      ptsd: false,
      inTherapy: false,
    };

    const newTrauma = Math.min(100, mentalHealth.trauma + traumaLevel);
    const newAnxiety = Math.min(100, mentalHealth.anxiety + traumaLevel * 0.5);
    const newSanity = Math.max(0, mentalHealth.sanity - traumaLevel * 0.3);

    // High trauma can trigger PTSD
    const ptsd = newTrauma > 60 && Math.random() < 0.3;

    await ctx.db.patch(character._id, {
      mentalHealth: {
        ...mentalHealth,
        trauma: newTrauma,
        anxiety: newAnxiety,
        sanity: newSanity,
        ptsd: mentalHealth.ptsd || ptsd,
        lastTraumaticEvent: `${disaster.type.replace("_", " ")} disaster`,
        lastTraumaticEventTick: tick,
      },
    });
  }

  // Record memory for the AI agent
  const agent = await ctx.db
    .query("agents")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .first();

  if (agent) {
    await ctx.db.insert("agentMemories", {
      agentId: agent._id,
      territoryId,
      memoryType: "crisis",
      tick,
      description: `A ${disaster.severity} ${disaster.type.replace("_", " ")} devastated our lands. ${disaster.populationCasualties} of our people perished.`,
      emotionalWeight: -traumaLevel,
      salience: 90,
      timesReferenced: 0,
    });
  }
}

/**
 * Random disaster check (called each tick)
 */
export async function checkForRandomDisaster(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  tick: number,
  currentWeather?: string,
  currentSeason?: string
): Promise<{ occurred: boolean; message?: string }> {
  // Check if already has active disaster
  const activeDisaster = await ctx.db
    .query("disasters")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .filter((q) => q.eq(q.field("status"), "active"))
    .first();

  if (activeDisaster) {
    return { occurred: false };
  }

  // Roll for each disaster type
  for (const [type, baseProbability] of Object.entries(DISASTER_BASE_PROBABILITY)) {
    const disasterType = type as DisasterType;
    let probability = baseProbability;

    const modifiers = DISASTER_MODIFIERS[disasterType];

    // Apply weather triggers
    if (currentWeather && modifiers.weatherTriggers?.includes(currentWeather)) {
      probability *= 3;
    }

    // Apply seasonal modifiers
    if (currentSeason && modifiers.seasonModifiers?.[currentSeason]) {
      probability *= modifiers.seasonModifiers[currentSeason];
    }

    // Roll the dice
    if (Math.random() * 1000 < probability) {
      const result = await triggerDisaster(ctx, territoryId, disasterType, tick);
      return { occurred: true, message: result.message };
    }
  }

  return { occurred: false };
}

/**
 * Get disaster summary for AI
 */
export async function getDisasterSummary(
  ctx: QueryCtx,
  territoryId: Id<"territories">
): Promise<string> {
  const activeDisaster = await ctx.db
    .query("disasters")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .filter((q) => q.eq(q.field("status"), "active"))
    .first();

  if (activeDisaster) {
    return `Currently affected by a ${activeDisaster.severity} ${activeDisaster.type.replace("_", " ")}. ${activeDisaster.populationCasualties} casualties so far.`;
  }

  const recovering = await ctx.db
    .query("disasters")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .filter((q) => q.eq(q.field("status"), "recovering"))
    .first();

  if (recovering) {
    return `Recovering from ${recovering.type.replace("_", " ")} (${recovering.recoveryProgress}% recovered).`;
  }

  return "No active disasters.";
}

/**
 * Force end a disaster (for divine intervention, etc.)
 */
export async function endDisasterEarly(
  ctx: MutationCtx,
  disasterId: Id<"disasters">
): Promise<{ success: boolean; message: string }> {
  const disaster = await ctx.db.get(disasterId);
  if (!disaster) {
    return { success: false, message: "Disaster not found" };
  }

  if (disaster.status !== "active") {
    return { success: false, message: "Disaster is not active" };
  }

  await ctx.db.patch(disasterId, {
    status: "recovering",
  });

  return {
    success: true,
    message: `The ${disaster.type.replace("_", " ")} has been ended.`,
  };
}
