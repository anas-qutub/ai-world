import { Doc, Id } from "../_generated/dataModel";
import { MutationCtx } from "../_generated/server";
import { recordMemory } from "./memory";

// Season types
export type Season = "spring" | "summer" | "autumn" | "winter";

// Calculate season from month (1-12)
export function getSeason(month: number): Season {
  // Winter: December (12), January (1), February (2)
  // Spring: March (3), April (4), May (5)
  // Summer: June (6), July (7), August (8)
  // Autumn: September (9), October (10), November (11)
  if (month === 12 || month === 1 || month === 2) return "winter";
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  return "autumn";
}

// Seasonal modifiers
export const SEASONAL_EFFECTS = {
  winter: {
    foodConsumptionModifier: 1.5, // +50% food consumption
    exposureDeathRate: 0.05, // 5% of unsheltered die per tick
    fuelConsumptionPerPerson: 0.1, // Wood needed per sheltered person
    farmProductionModifier: 0.2, // -80% farm output
    gatheringModifier: 0.5, // -50% foraging
  },
  summer: {
    foodConsumptionModifier: 0.9, // -10% food consumption (warmer)
    exposureDeathRate: 0, // No exposure deaths
    fuelConsumptionPerPerson: 0, // No heating needed
    farmProductionModifier: 1.2, // +20% farm output
    gatheringModifier: 1.2, // +20% foraging
  },
  spring: {
    foodConsumptionModifier: 1.0, // Normal
    exposureDeathRate: 0.01, // 1% exposure death for unsheltered (cold nights)
    fuelConsumptionPerPerson: 0.03, // Light heating needed
    farmProductionModifier: 0.8, // Planting season - less immediate output
    gatheringModifier: 1.0, // Normal
  },
  autumn: {
    foodConsumptionModifier: 1.0, // Normal
    exposureDeathRate: 0.02, // 2% exposure death for unsheltered
    fuelConsumptionPerPerson: 0.05, // Some heating needed
    farmProductionModifier: 1.3, // Harvest season - best output
    gatheringModifier: 1.1, // Good foraging (berries, nuts)
  },
};

// Wood gathering constants
export const WOOD_CONSTANTS = {
  baseGatheringPerAction: 10, // Wood gained per gather_wood action
  forestRegeneration: 2, // Wood that naturally regrows per tick
  maxNaturalWood: 100, // Cap for natural wood regeneration
  buildHouseCost: 15, // Wood cost to build houses
  shelterPerBuild: 20, // Shelter capacity added per build action
  preserveFoodCost: 5, // Wood cost to preserve food
  preservedFoodAmount: 15, // Amount of food preserved per action
};

// Survival event types
interface SurvivalEvent {
  type: "exposure_deaths" | "fuel_shortage" | "shelter_warning" | "wood_depleted";
  title: string;
  description: string;
}

// Process survival mechanics for a territory
export async function processSurvival(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  tick: number,
  season: Season
): Promise<{
  exposureDeaths: number;
  fuelUsed: number;
  events: SurvivalEvent[];
}> {
  const events: SurvivalEvent[] = [];
  const territory = await ctx.db.get(territoryId);

  if (!territory) {
    return { exposureDeaths: 0, fuelUsed: 0, events: [] };
  }

  const seasonEffects = SEASONAL_EFFECTS[season];
  const population = territory.population;
  const shelterCapacity = territory.shelterCapacity || 0;
  const woodStockpile = territory.woodStockpile || 0;

  // Calculate sheltered vs unsheltered population
  const shelteredPopulation = Math.min(population, shelterCapacity);
  const unshelteredPopulation = Math.max(0, population - shelterCapacity);

  // Calculate fuel needs for heating
  const fuelNeeded = shelteredPopulation * seasonEffects.fuelConsumptionPerPerson;
  const fuelAvailable = woodStockpile;
  const fuelUsed = Math.min(fuelNeeded, fuelAvailable);
  const fuelShortage = Math.max(0, fuelNeeded - fuelAvailable);

  let exposureDeaths = 0;
  let coldDeaths = 0;

  // Process exposure deaths for unsheltered population
  if (unshelteredPopulation > 0 && seasonEffects.exposureDeathRate > 0) {
    exposureDeaths = Math.floor(unshelteredPopulation * seasonEffects.exposureDeathRate);

    if (exposureDeaths > 0) {
      const tribeName = (territory as any).tribeName || "the tribe";
      events.push({
        type: "exposure_deaths",
        title: "Deaths from Exposure",
        description: `${exposureDeaths} people of ${tribeName} died from exposure to the cold. ${unshelteredPopulation} remain without shelter.`,
      });

      // =============================================
      // ORGANIC AI GROWTH - Record crisis memory
      // =============================================
      const agent = await ctx.db
        .query("agents")
        .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
        .first();

      if (agent) {
        await recordMemory(ctx, agent._id, {
          type: "crisis",
          description: `${exposureDeaths} of our people died from exposure to the cold. We lacked sufficient shelter.`,
          emotionalWeight: -40 - Math.min(exposureDeaths, 30), // More deaths = worse memory
        });
      }
    }
  }

  // Process deaths from fuel shortage (even sheltered people can freeze)
  if (fuelShortage > 0 && season === "winter") {
    // Calculate how many people are affected by lack of heating
    const unheatedPopulation = Math.ceil(fuelShortage / seasonEffects.fuelConsumptionPerPerson);
    coldDeaths = Math.floor(unheatedPopulation * 0.02); // 2% of unheated people die

    if (coldDeaths > 0) {
      const tribeName = (territory as any).tribeName || "the tribe";
      events.push({
        type: "fuel_shortage",
        title: "Deaths from Cold",
        description: `${coldDeaths} people of ${tribeName} froze to death. Not enough wood to heat all shelters.`,
      });

      // =============================================
      // ORGANIC AI GROWTH - Record crisis memory
      // =============================================
      const agent = await ctx.db
        .query("agents")
        .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
        .first();

      if (agent) {
        await recordMemory(ctx, agent._id, {
          type: "crisis",
          description: `${coldDeaths} of our people froze to death. We did not gather enough wood for the winter.`,
          emotionalWeight: -50 - Math.min(coldDeaths, 30), // Harsh lesson about preparation
        });
      }
    }
  }

  const totalDeaths = exposureDeaths + coldDeaths;

  // Update territory with survival effects
  const updates: Partial<Doc<"territories">> = {};

  // Deduct fuel used
  if (fuelUsed > 0) {
    updates.woodStockpile = Math.max(0, woodStockpile - fuelUsed);
  }

  // Deduct population from deaths
  if (totalDeaths > 0) {
    updates.population = Math.max(1, population - totalDeaths);
    // Also reduce happiness due to deaths
    updates.happiness = Math.max(0, territory.happiness - totalDeaths * 2);
  }

  // Apply updates
  if (Object.keys(updates).length > 0) {
    await ctx.db.patch(territoryId, updates);
  }

  // Generate warnings for next season preparation
  if (season === "autumn" && unshelteredPopulation > 0) {
    events.push({
      type: "shelter_warning",
      title: "Winter Approaches",
      description: `Warning: ${unshelteredPopulation} people lack shelter. Build houses before winter or they may die from exposure!`,
    });
  }

  if (season === "autumn" && woodStockpile < population * 0.3) {
    const neededWood = Math.ceil(population * SEASONAL_EFFECTS.winter.fuelConsumptionPerPerson * 3); // 3 months of winter
    events.push({
      type: "wood_depleted",
      title: "Low Wood Supplies",
      description: `Warning: Only ${woodStockpile.toFixed(0)} wood in stockpile. Need ~${neededWood} to survive winter. Gather more wood!`,
    });
  }

  return { exposureDeaths: totalDeaths, fuelUsed, events };
}

// Apply seasonal modifiers to food consumption (called from demographics)
export function getSeasonalFoodModifier(season: Season): number {
  return SEASONAL_EFFECTS[season].foodConsumptionModifier;
}

// Apply seasonal modifiers to farm/gathering production
export function getSeasonalProductionModifier(season: Season, type: "farm" | "gathering"): number {
  const effects = SEASONAL_EFFECTS[season];
  return type === "farm" ? effects.farmProductionModifier : effects.gatheringModifier;
}

// Calculate winter fuel requirements for a population
export function calculateWinterFuelRequirement(population: number): number {
  const winterMonths = 3; // December, January, February
  return population * SEASONAL_EFFECTS.winter.fuelConsumptionPerPerson * winterMonths;
}

// Calculate shelter deficit
export function calculateShelterDeficit(population: number, shelterCapacity: number): number {
  return Math.max(0, population - shelterCapacity);
}

// Natural wood regeneration (happens in resources processing)
export async function processWoodRegeneration(
  ctx: MutationCtx,
  territoryId: Id<"territories">
): Promise<void> {
  const territory = await ctx.db.get(territoryId);
  if (!territory) return;

  const currentWood = territory.woodStockpile || 0;

  // Only regenerate if below natural cap (forests can regrow)
  if (currentWood < WOOD_CONSTANTS.maxNaturalWood) {
    const newWood = Math.min(
      WOOD_CONSTANTS.maxNaturalWood,
      currentWood + WOOD_CONSTANTS.forestRegeneration
    );
    await ctx.db.patch(territoryId, { woodStockpile: newWood });
  }
}

// Get survival status for AI prompts
export function getSurvivalStatus(
  territory: Doc<"territories">,
  season: Season
): {
  shelterStatus: string;
  fuelStatus: string;
  winterReadiness: string;
  urgentNeeds: string[];
} {
  const population = territory.population;
  const shelterCapacity = territory.shelterCapacity || 0;
  const woodStockpile = territory.woodStockpile || 0;
  const shelterDeficit = calculateShelterDeficit(population, shelterCapacity);
  const winterFuelNeeded = calculateWinterFuelRequirement(population);

  const urgentNeeds: string[] = [];

  // Shelter status
  let shelterStatus: string;
  if (shelterCapacity === 0) {
    shelterStatus = "NO SHELTER - All people are exposed to the elements!";
    urgentNeeds.push("BUILD HOUSES IMMEDIATELY");
  } else if (shelterDeficit > 0) {
    shelterStatus = `INSUFFICIENT - Only ${shelterCapacity} beds for ${population} people (${shelterDeficit} without shelter)`;
    urgentNeeds.push("Build more houses");
  } else {
    shelterStatus = `Adequate - ${shelterCapacity} beds for ${population} people`;
  }

  // Fuel status
  let fuelStatus: string;
  const fuelRatio = woodStockpile / Math.max(1, winterFuelNeeded);
  if (woodStockpile === 0) {
    fuelStatus = "NO WOOD - Cannot heat shelters!";
    urgentNeeds.push("GATHER WOOD IMMEDIATELY");
  } else if (fuelRatio < 0.3) {
    fuelStatus = `CRITICAL - Only ${woodStockpile.toFixed(0)} wood (need ${winterFuelNeeded.toFixed(0)} for winter)`;
    urgentNeeds.push("Gather more wood for winter");
  } else if (fuelRatio < 0.7) {
    fuelStatus = `Low - ${woodStockpile.toFixed(0)} wood (need ${winterFuelNeeded.toFixed(0)} for winter)`;
  } else {
    fuelStatus = `Good - ${woodStockpile.toFixed(0)} wood (${(fuelRatio * 100).toFixed(0)}% of winter needs)`;
  }

  // Winter readiness (combine shelter + fuel)
  let winterReadiness: string;
  if (season === "winter") {
    if (shelterDeficit > 0 || woodStockpile < winterFuelNeeded * 0.3) {
      winterReadiness = "CRITICAL - People are dying from cold!";
    } else {
      winterReadiness = "Surviving the winter";
    }
  } else if (season === "autumn") {
    if (shelterDeficit > 0 && woodStockpile < winterFuelNeeded * 0.5) {
      winterReadiness = "UNPREPARED - Winter will be deadly without action!";
    } else if (shelterDeficit > 0 || woodStockpile < winterFuelNeeded * 0.7) {
      winterReadiness = "At risk - Prepare for winter now!";
    } else {
      winterReadiness = "Ready for winter";
    }
  } else {
    winterReadiness = "Winter is distant";
  }

  return { shelterStatus, fuelStatus, winterReadiness, urgentNeeds };
}

// =============================================
// INSTINCTIVE SURVIVAL BEHAVIOR
// =============================================
// People naturally try to survive even without explicit AI commands.
// This represents basic survival instincts - gathering food when hungry,
// building makeshift shelters when exposed, collecting firewood when cold.
//
// IMPORTANT: These instincts provide ~30-50% of what's needed to survive.
// The AI MUST still make good decisions to fully protect the population.
// Instincts alone will result in deaths - just fewer than doing nothing.

interface InstinctEvent {
  type: "instinct_forage" | "instinct_shelter" | "instinct_wood";
  description: string;
  amount: number;
}

/**
 * Process instinctive survival behavior - happens automatically each tick
 * Returns resources gathered/built by the population's survival instincts
 */
export async function processInstinctiveSurvival(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  tick: number,
  season: Season
): Promise<{
  foodGathered: number;
  woodGathered: number;
  shelterBuilt: number;
  events: InstinctEvent[];
}> {
  const territory = await ctx.db.get(territoryId);
  if (!territory) {
    return { foodGathered: 0, woodGathered: 0, shelterBuilt: 0, events: [] };
  }

  const events: InstinctEvent[] = [];
  const population = territory.population;
  const adults = Math.floor(population * 0.6); // ~60% are working adults
  const shelterCapacity = territory.shelterCapacity || 0;
  const woodStockpile = territory.woodStockpile || 0;
  const food = territory.food;

  const seasonEffects = SEASONAL_EFFECTS[season];
  const winterFuelNeeded = calculateWinterFuelRequirement(population);
  const shelterDeficit = calculateShelterDeficit(population, shelterCapacity);

  let foodGathered = 0;
  let woodGathered = 0;
  let shelterBuilt = 0;

  // =============================================
  // INSTINCT 1: FORAGE WHEN HUNGRY
  // =============================================
  // When food is low, people naturally forage/hunt
  // Effectiveness: ~20-40% of a full gather_food action
  if (food < 40) {
    const urgency = food < 20 ? 0.4 : 0.25; // More urgent when critically low
    const baseGather = adults * 0.1 * urgency; // 0.1 food per working adult
    foodGathered = Math.floor(baseGather * seasonEffects.gatheringModifier);

    if (foodGathered > 0) {
      events.push({
        type: "instinct_forage",
        description: `Driven by hunger, your people foraged for ${foodGathered} food.`,
        amount: foodGathered,
      });
    }
  }

  // =============================================
  // INSTINCT 2: BUILD SHELTER WHEN EXPOSED
  // =============================================
  // When people lack shelter, they build makeshift protection
  // Effectiveness: ~10-20% of a full build_houses action
  // Only works if there's some wood available
  if (shelterDeficit > 0 && woodStockpile >= 5) {
    // More urgent in cold seasons
    const urgency = season === "winter" ? 0.3 :
                    season === "autumn" ? 0.2 :
                    season === "spring" ? 0.15 : 0.1;

    // Build makeshift shelters - costs less wood but shelters fewer people
    const makeshiftShelterCost = 5; // Less than normal 15 wood
    const makeshiftShelterCapacity = 5; // Less than normal 20

    const canBuild = Math.floor(woodStockpile / makeshiftShelterCost);
    const needToBuild = Math.ceil(shelterDeficit / makeshiftShelterCapacity);
    const willBuild = Math.min(canBuild, needToBuild, Math.ceil(adults * urgency / 10));

    if (willBuild > 0) {
      shelterBuilt = willBuild * makeshiftShelterCapacity;
      const woodUsed = willBuild * makeshiftShelterCost;

      // Deduct wood for makeshift shelters
      await ctx.db.patch(territoryId, {
        woodStockpile: woodStockpile - woodUsed,
      });

      events.push({
        type: "instinct_shelter",
        description: `Fearing the cold, your people built makeshift shelters for ${shelterBuilt} more people.`,
        amount: shelterBuilt,
      });
    }
  }

  // =============================================
  // INSTINCT 3: GATHER WOOD WHEN COLD
  // =============================================
  // When wood is low and winter approaches, people gather firewood
  // Effectiveness: ~25-35% of a full gather_wood action
  const woodNeeded = season === "winter" ? winterFuelNeeded / 3 : // Need immediate fuel
                     season === "autumn" ? winterFuelNeeded * 0.7 : // Preparing
                     winterFuelNeeded * 0.3; // Some buffer

  if (woodStockpile < woodNeeded) {
    const urgency = season === "winter" ? 0.35 :
                    season === "autumn" ? 0.25 : 0.15;

    const baseGather = adults * 0.15 * urgency; // 0.15 wood per working adult
    woodGathered = Math.floor(baseGather);

    if (woodGathered > 0) {
      events.push({
        type: "instinct_wood",
        description: `Preparing for the cold, your people gathered ${woodGathered} wood.`,
        amount: woodGathered,
      });
    }
  }

  // Apply the instinctive resource changes
  if (foodGathered > 0 || woodGathered > 0 || shelterBuilt > 0) {
    const currentTerritory = await ctx.db.get(territoryId);
    if (currentTerritory) {
      await ctx.db.patch(territoryId, {
        food: Math.min(100, currentTerritory.food + foodGathered),
        woodStockpile: (currentTerritory.woodStockpile || 0) + woodGathered,
        shelterCapacity: (currentTerritory.shelterCapacity || 0) + shelterBuilt,
      });
    }
  }

  return { foodGathered, woodGathered, shelterBuilt, events };
}
