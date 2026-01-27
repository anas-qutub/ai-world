import { Doc, Id } from "../_generated/dataModel";
import { MutationCtx } from "../_generated/server";

// Clamp helper
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// Resource type definitions
export const RESOURCE_TYPES = {
  // Renewable resources
  timber: { renewable: true, baseRegen: 2, category: "raw" },
  wheat: { renewable: true, baseRegen: 5, category: "food" },
  fish: { renewable: true, baseRegen: 3, category: "food" },
  horses: { renewable: true, baseRegen: 0.5, category: "livestock" },
  cattle: { renewable: true, baseRegen: 0.3, category: "livestock" },

  // Non-renewable resources
  iron_ore: { renewable: false, baseRegen: 0, category: "mineral" },
  copper: { renewable: false, baseRegen: 0, category: "mineral" },
  gold: { renewable: false, baseRegen: 0, category: "precious" },
  silver: { renewable: false, baseRegen: 0, category: "precious" },
  coal: { renewable: false, baseRegen: 0, category: "mineral" },
  salt: { renewable: false, baseRegen: 0, category: "mineral" },

  // Processed goods
  tools: { renewable: false, baseRegen: 0, category: "manufactured" },
  weapons: { renewable: false, baseRegen: 0, category: "manufactured" },
  cloth: { renewable: false, baseRegen: 0, category: "manufactured" },
  pottery: { renewable: false, baseRegen: 0, category: "manufactured" },
} as const;

export type ResourceType = keyof typeof RESOURCE_TYPES;

// Building type definitions
export const BUILDING_TYPES = {
  farm: {
    maxWorkers: 10,
    baseOutput: 5,
    outputResource: "wheat",
    inputResource: null,
    maintenanceCost: 1,
    buildCost: { wealth: 10, timber: 5 },
    requiredTech: null,
  },
  mine: {
    maxWorkers: 8,
    baseOutput: 3,
    outputResource: "iron_ore",
    inputResource: null,
    maintenanceCost: 2,
    buildCost: { wealth: 20, timber: 10 },
    requiredTech: "mining",
  },
  workshop: {
    maxWorkers: 5,
    baseOutput: 2,
    outputResource: "tools",
    inputResource: "iron_ore",
    maintenanceCost: 3,
    buildCost: { wealth: 30, timber: 15 },
    requiredTech: "metalworking",
  },
  market: {
    maxWorkers: 4,
    baseOutput: 0,
    outputResource: null,
    inputResource: null,
    maintenanceCost: 2,
    buildCost: { wealth: 25 },
    requiredTech: "trade",
  },
  barracks: {
    maxWorkers: 6,
    baseOutput: 0,
    outputResource: null,
    inputResource: null,
    maintenanceCost: 5,
    buildCost: { wealth: 40, timber: 20 },
    requiredTech: "military_training",
  },
  academy: {
    maxWorkers: 3,
    baseOutput: 2,
    outputResource: null, // Produces knowledge
    inputResource: null,
    maintenanceCost: 4,
    buildCost: { wealth: 50 },
    requiredTech: "writing",
  },
  granary: {
    maxWorkers: 2,
    baseOutput: 0, // Reduces food spoilage
    outputResource: null,
    inputResource: null,
    maintenanceCost: 1,
    buildCost: { wealth: 15, timber: 10 },
    requiredTech: "agriculture",
  },
} as const;

export type BuildingType = keyof typeof BUILDING_TYPES;

// Process resource production for a territory
export async function processResourceProduction(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  tick: number
): Promise<{
  produced: Array<{ type: string; amount: number }>;
  depleted: Array<{ type: string; remaining: number }>;
}> {
  const produced: Array<{ type: string; amount: number }> = [];
  const depleted: Array<{ type: string; remaining: number }> = [];

  // Get all resources for this territory
  const resources = await ctx.db
    .query("resources")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .collect();

  // Get all buildings for this territory
  const buildings = await ctx.db
    .query("buildings")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .collect();

  // Process each building's production
  for (const building of buildings) {
    const buildingDef = BUILDING_TYPES[building.type as BuildingType];
    if (!buildingDef || !buildingDef.outputResource) continue;

    // Calculate production based on workers and building condition
    const workerEfficiency = building.workers / building.maxWorkers;
    const conditionEfficiency = building.condition / 100;
    const levelBonus = 1 + (building.level - 1) * 0.2;

    let production = building.outputPerTick * workerEfficiency * conditionEfficiency * levelBonus;

    // Check if building needs input resources
    if (buildingDef.inputResource) {
      const inputResource = resources.find(r => r.type === buildingDef.inputResource);
      if (!inputResource || inputResource.quantity < production) {
        // Not enough input, reduce production
        production = inputResource ? Math.min(production, inputResource.quantity) : 0;
      }
      if (inputResource && production > 0) {
        // Consume input resources
        await ctx.db.patch(inputResource._id, {
          quantity: Math.max(0, inputResource.quantity - production),
        });
      }
    }

    // Find or create output resource
    const outputResource = resources.find(r => r.type === buildingDef.outputResource);
    if (outputResource) {
      const newQuantity = Math.min(outputResource.maxQuantity, outputResource.quantity + production);
      await ctx.db.patch(outputResource._id, {
        quantity: newQuantity,
      });
      produced.push({ type: buildingDef.outputResource, amount: production });
    }

    // Degrade building condition
    await ctx.db.patch(building._id, {
      condition: Math.max(0, building.condition - 0.5),
    });
  }

  // Process natural resource regeneration
  for (const resource of resources) {
    const resourceDef = RESOURCE_TYPES[resource.type as ResourceType];
    if (!resourceDef) continue;

    if (resourceDef.renewable && resource.regenerationRate > 0) {
      // Regeneration is affected by depletion level
      const depletionPenalty = (100 - resource.depletionLevel) / 100;
      const regen = resource.regenerationRate * depletionPenalty;
      const newQuantity = Math.min(resource.maxQuantity, resource.quantity + regen);

      await ctx.db.patch(resource._id, {
        quantity: newQuantity,
        depletionLevel: Math.max(0, resource.depletionLevel - 0.1), // Slowly recover
      });
    }

    // Check for depletion warnings
    if (resource.quantity < resource.maxQuantity * 0.2) {
      depleted.push({ type: resource.type, remaining: resource.quantity });
    }
  }

  return { produced, depleted };
}

// Process market price updates based on supply/demand
export async function processMarketPrices(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  tick: number
): Promise<void> {
  const prices = await ctx.db
    .query("marketPrices")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .collect();

  for (const price of prices) {
    // Calculate price based on supply/demand ratio
    // High demand, low supply = high price
    // Low demand, high supply = low price
    const ratio = price.demand > 0 ? price.supply / price.demand : 1;

    let newPrice = price.currentPrice;
    if (ratio < 0.5) {
      // Shortage - prices rise
      newPrice = Math.min(3.0, price.currentPrice * 1.1);
    } else if (ratio > 2) {
      // Surplus - prices fall
      newPrice = Math.max(0.3, price.currentPrice * 0.9);
    } else {
      // Stable - prices drift toward 1.0
      newPrice = price.currentPrice + (1.0 - price.currentPrice) * 0.1;
    }

    await ctx.db.patch(price._id, {
      currentPrice: newPrice,
      lastUpdatedTick: tick,
    });
  }
}

// Calculate territory's total production capacity
export function calculateProductionCapacity(
  buildings: Doc<"buildings">[],
  resources: Doc<"resources">[]
): {
  foodProduction: number;
  wealthProduction: number;
  militaryCapacity: number;
  researchCapacity: number;
} {
  let foodProduction = 0;
  let wealthProduction = 0;
  let militaryCapacity = 0;
  let researchCapacity = 0;

  for (const building of buildings) {
    const efficiency = (building.workers / building.maxWorkers) * (building.condition / 100);

    switch (building.type) {
      case "farm":
        foodProduction += building.outputPerTick * efficiency * building.level;
        break;
      case "workshop":
      case "market":
        wealthProduction += building.outputPerTick * efficiency * building.level;
        break;
      case "barracks":
        militaryCapacity += 10 * building.level * efficiency;
        break;
      case "academy":
        researchCapacity += building.outputPerTick * efficiency * building.level;
        break;
    }
  }

  return {
    foodProduction,
    wealthProduction,
    militaryCapacity,
    researchCapacity,
  };
}

// Extract resources from a deposit
export async function extractResource(
  ctx: MutationCtx,
  resourceId: Id<"resources">,
  amount: number
): Promise<{ extracted: number; remaining: number }> {
  const resource = await ctx.db.get(resourceId);
  if (!resource) {
    return { extracted: 0, remaining: 0 };
  }

  const actualExtracted = Math.min(amount, resource.quantity);

  // Extraction increases depletion for non-renewable resources
  const resourceDef = RESOURCE_TYPES[resource.type as ResourceType];
  let newDepletion = resource.depletionLevel;
  if (resourceDef && !resourceDef.renewable) {
    newDepletion = Math.min(100, resource.depletionLevel + actualExtracted * 0.1);
  }

  await ctx.db.patch(resourceId, {
    quantity: resource.quantity - actualExtracted,
    depletionLevel: newDepletion,
  });

  return {
    extracted: actualExtracted,
    remaining: resource.quantity - actualExtracted,
  };
}

// Calculate tax revenue based on population and buildings
export function calculateTaxRevenue(
  territory: Doc<"territories">,
  buildings: Doc<"buildings">[],
  taxRate: number = 0.1
): number {
  // Base tax from population
  const populationTax = territory.population * taxRate * 0.1;

  // Additional tax from markets
  const marketTax = buildings
    .filter(b => b.type === "market")
    .reduce((sum, b) => sum + b.level * 2 * (b.condition / 100), 0);

  return populationTax + marketTax;
}

// Prospect for new resources (discovery chance)
export async function prospectResources(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  searchType?: string
): Promise<{ found: boolean; resourceType?: string; quantity?: number }> {
  const territory = await ctx.db.get(territoryId);
  if (!territory) return { found: false };

  // Get existing resources
  const existingResources = await ctx.db
    .query("resources")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .collect();

  const discoveredTypes = new Set(existingResources.filter(r => r.discovered).map(r => r.type));

  // Check for undiscovered resources
  const undiscovered = existingResources.find(r => !r.discovered && (!searchType || r.type === searchType));

  if (undiscovered) {
    // 30% base chance to discover, modified by territory knowledge
    const discoveryChance = 0.3 + (territory.knowledge / 100) * 0.3;

    if (Math.random() < discoveryChance) {
      await ctx.db.patch(undiscovered._id, { discovered: true });
      return {
        found: true,
        resourceType: undiscovered.type,
        quantity: undiscovered.quantity,
      };
    }
  }

  return { found: false };
}
