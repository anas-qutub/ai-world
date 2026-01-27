import { Doc, Id } from "../_generated/dataModel";
import { MutationCtx } from "../_generated/server";
import { BUILDING_TYPES, BuildingType } from "./economy";

// Building upgrade costs per level
const UPGRADE_COSTS: Record<number, { wealth: number; timber?: number }> = {
  2: { wealth: 20, timber: 10 },
  3: { wealth: 40, timber: 20 },
  4: { wealth: 80, timber: 40 },
  5: { wealth: 160, timber: 80 },
};

// Create a new building
export async function createBuilding(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  type: BuildingType,
  tick: number,
  name?: string
): Promise<{ success: boolean; buildingId?: Id<"buildings">; error?: string }> {
  const territory = await ctx.db.get(territoryId);
  if (!territory) {
    return { success: false, error: "Territory not found" };
  }

  const buildingDef = BUILDING_TYPES[type];
  if (!buildingDef) {
    return { success: false, error: "Invalid building type" };
  }

  // Check build costs
  const buildCost = buildingDef.buildCost;
  if (territory.wealth < (buildCost.wealth || 0)) {
    return { success: false, error: "Not enough wealth" };
  }

  // Deduct costs
  await ctx.db.patch(territoryId, {
    wealth: territory.wealth - (buildCost.wealth || 0),
  });

  // Create the building
  const buildingId = await ctx.db.insert("buildings", {
    territoryId,
    type,
    name: name || `${type.charAt(0).toUpperCase() + type.slice(1)}`,
    level: 1,
    workers: 0,
    maxWorkers: buildingDef.maxWorkers,
    outputPerTick: buildingDef.baseOutput,
    maintenanceCost: buildingDef.maintenanceCost,
    condition: 100,
    constructedAtTick: tick,
  });

  return { success: true, buildingId };
}

// Upgrade an existing building
export async function upgradeBuilding(
  ctx: MutationCtx,
  buildingId: Id<"buildings">,
  territoryId: Id<"territories">
): Promise<{ success: boolean; newLevel?: number; error?: string }> {
  const building = await ctx.db.get(buildingId);
  if (!building) {
    return { success: false, error: "Building not found" };
  }

  if (building.territoryId !== territoryId) {
    return { success: false, error: "Building does not belong to territory" };
  }

  if (building.level >= 5) {
    return { success: false, error: "Building already at max level" };
  }

  const territory = await ctx.db.get(territoryId);
  if (!territory) {
    return { success: false, error: "Territory not found" };
  }

  const nextLevel = building.level + 1;
  const upgradeCost = UPGRADE_COSTS[nextLevel];

  if (territory.wealth < upgradeCost.wealth) {
    return { success: false, error: "Not enough wealth for upgrade" };
  }

  // Deduct costs
  await ctx.db.patch(territoryId, {
    wealth: territory.wealth - upgradeCost.wealth,
  });

  // Upgrade the building
  const buildingDef = BUILDING_TYPES[building.type as BuildingType];
  await ctx.db.patch(buildingId, {
    level: nextLevel,
    maxWorkers: buildingDef.maxWorkers + nextLevel * 2,
    outputPerTick: buildingDef.baseOutput * (1 + (nextLevel - 1) * 0.3),
    maintenanceCost: buildingDef.maintenanceCost * (1 + (nextLevel - 1) * 0.2),
  });

  return { success: true, newLevel: nextLevel };
}

// Repair a building
export async function repairBuilding(
  ctx: MutationCtx,
  buildingId: Id<"buildings">,
  territoryId: Id<"territories">
): Promise<{ success: boolean; newCondition?: number; error?: string }> {
  const building = await ctx.db.get(buildingId);
  if (!building) {
    return { success: false, error: "Building not found" };
  }

  if (building.territoryId !== territoryId) {
    return { success: false, error: "Building does not belong to territory" };
  }

  const territory = await ctx.db.get(territoryId);
  if (!territory) {
    return { success: false, error: "Territory not found" };
  }

  // Calculate repair cost (based on damage)
  const damage = 100 - building.condition;
  const repairCost = Math.ceil(damage * 0.2);

  if (territory.wealth < repairCost) {
    return { success: false, error: "Not enough wealth for repairs" };
  }

  // Deduct costs and repair
  await ctx.db.patch(territoryId, {
    wealth: territory.wealth - repairCost,
  });

  await ctx.db.patch(buildingId, {
    condition: 100,
  });

  return { success: true, newCondition: 100 };
}

// Assign workers to a building
export async function assignWorkers(
  ctx: MutationCtx,
  buildingId: Id<"buildings">,
  workerCount: number
): Promise<{ success: boolean; assignedWorkers?: number; error?: string }> {
  const building = await ctx.db.get(buildingId);
  if (!building) {
    return { success: false, error: "Building not found" };
  }

  const actualWorkers = Math.min(workerCount, building.maxWorkers);

  await ctx.db.patch(buildingId, {
    workers: actualWorkers,
  });

  return { success: true, assignedWorkers: actualWorkers };
}

// Demolish a building
export async function demolishBuilding(
  ctx: MutationCtx,
  buildingId: Id<"buildings">,
  territoryId: Id<"territories">
): Promise<{ success: boolean; salvageValue?: number; error?: string }> {
  const building = await ctx.db.get(buildingId);
  if (!building) {
    return { success: false, error: "Building not found" };
  }

  if (building.territoryId !== territoryId) {
    return { success: false, error: "Building does not belong to territory" };
  }

  // Calculate salvage value (25% of original cost * condition)
  const buildingDef = BUILDING_TYPES[building.type as BuildingType];
  const salvageValue = Math.floor(
    (buildingDef.buildCost.wealth || 0) * 0.25 * (building.condition / 100) * building.level
  );

  const territory = await ctx.db.get(territoryId);
  if (territory) {
    await ctx.db.patch(territoryId, {
      wealth: territory.wealth + salvageValue,
    });
  }

  await ctx.db.delete(buildingId);

  return { success: true, salvageValue };
}

// Process building maintenance costs
export async function processBuildingMaintenance(
  ctx: MutationCtx,
  territoryId: Id<"territories">
): Promise<{ totalCost: number; abandonedBuildings: string[] }> {
  const territory = await ctx.db.get(territoryId);
  if (!territory) {
    return { totalCost: 0, abandonedBuildings: [] };
  }

  const buildings = await ctx.db
    .query("buildings")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .collect();

  let totalCost = 0;
  const abandonedBuildings: string[] = [];

  for (const building of buildings) {
    totalCost += building.maintenanceCost;
  }

  if (territory.wealth >= totalCost) {
    // Can afford maintenance
    await ctx.db.patch(territoryId, {
      wealth: territory.wealth - totalCost,
    });
  } else {
    // Cannot afford - buildings degrade faster
    const shortfall = totalCost - territory.wealth;
    await ctx.db.patch(territoryId, { wealth: 0 });

    // Degrade random buildings
    for (const building of buildings) {
      const degradation = (shortfall / buildings.length) * 2;
      const newCondition = Math.max(0, building.condition - degradation);

      await ctx.db.patch(building._id, { condition: newCondition });

      if (newCondition <= 0) {
        abandonedBuildings.push(building.name || building.type);
        await ctx.db.delete(building._id);
      }
    }
  }

  return { totalCost, abandonedBuildings };
}

// Get building summary for a territory
export async function getBuildingSummary(
  ctx: MutationCtx,
  territoryId: Id<"territories">
): Promise<{
  totalBuildings: number;
  byType: Record<string, number>;
  totalWorkers: number;
  totalCapacity: number;
  averageCondition: number;
}> {
  const buildings = await ctx.db
    .query("buildings")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .collect();

  const byType: Record<string, number> = {};
  let totalWorkers = 0;
  let totalCapacity = 0;
  let totalCondition = 0;

  for (const building of buildings) {
    byType[building.type] = (byType[building.type] || 0) + 1;
    totalWorkers += building.workers;
    totalCapacity += building.maxWorkers;
    totalCondition += building.condition;
  }

  return {
    totalBuildings: buildings.length,
    byType,
    totalWorkers,
    totalCapacity,
    averageCondition: buildings.length > 0 ? totalCondition / buildings.length : 100,
  };
}
