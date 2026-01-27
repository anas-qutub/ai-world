import { Doc, Id } from "../_generated/dataModel";
import { MutationCtx } from "../_generated/server";

// Clamp helper
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// Unit type definitions
export const UNIT_TYPES = {
  militia: {
    attack: 5,
    defense: 3,
    speed: 1.0,
    upkeep: 0.5,
    recruitCost: { wealth: 2, population: 1 },
    requiredTech: null,
    description: "Quickly raised local defenders",
  },
  infantry: {
    attack: 10,
    defense: 8,
    speed: 0.8,
    upkeep: 1,
    recruitCost: { wealth: 5, population: 1 },
    requiredTech: "military_training",
    description: "Professional foot soldiers",
  },
  cavalry: {
    attack: 15,
    defense: 5,
    speed: 1.5,
    upkeep: 2,
    recruitCost: { wealth: 15, population: 1 },
    requiredTech: "horse_riding",
    description: "Fast mounted warriors",
  },
  archer: {
    attack: 12,
    defense: 4,
    speed: 0.9,
    upkeep: 1.5,
    recruitCost: { wealth: 8, population: 1 },
    requiredTech: "archery",
    description: "Ranged attackers",
  },
  siege: {
    attack: 20,
    defense: 2,
    speed: 0.3,
    upkeep: 3,
    recruitCost: { wealth: 25, population: 2 },
    requiredTech: "siege_warfare",
    description: "Siege equipment crews",
  },
} as const;

export type UnitType = keyof typeof UNIT_TYPES;

// Commander name generator
const COMMANDER_NAMES = [
  "Varen", "Kira", "Thane", "Lyra", "Marcus", "Elena",
  "Draken", "Mira", "Orin", "Thessa", "Cael", "Sera",
  "Alaric", "Nyla", "Bran", "Astra", "Dorn", "Zara",
];

function generateCommanderName(): string {
  return COMMANDER_NAMES[Math.floor(Math.random() * COMMANDER_NAMES.length)];
}

// Army name generator
const ARMY_PREFIXES = ["First", "Second", "Iron", "Storm", "Shadow", "Dawn", "Northern", "Southern"];
const ARMY_SUFFIXES = ["Legion", "Guard", "Host", "Army", "Company", "Band", "Defenders", "Warriors"];

function generateArmyName(): string {
  const prefix = ARMY_PREFIXES[Math.floor(Math.random() * ARMY_PREFIXES.length)];
  const suffix = ARMY_SUFFIXES[Math.floor(Math.random() * ARMY_SUFFIXES.length)];
  return `${prefix} ${suffix}`;
}

// Create a new army
export async function createArmy(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  initialUnits: Array<{ type: UnitType; count: number }>,
  tick: number,
  name?: string
): Promise<{ success: boolean; armyId?: Id<"armies">; error?: string }> {
  const territory = await ctx.db.get(territoryId);
  if (!territory) {
    return { success: false, error: "Territory not found" };
  }

  // Calculate total cost and population needed
  let totalCost = 0;
  let totalPopulation = 0;

  const units = initialUnits.map(u => {
    const unitDef = UNIT_TYPES[u.type];
    totalCost += unitDef.recruitCost.wealth * u.count;
    totalPopulation += unitDef.recruitCost.population * u.count;

    return {
      type: u.type,
      count: u.count,
      experience: 0,
      morale: 70,
      equipment: 50,
    };
  });

  // Check resources
  if (territory.wealth < totalCost) {
    return { success: false, error: "Not enough wealth to raise army" };
  }

  if (territory.population < totalPopulation * 2) { // Need some civilians left
    return { success: false, error: "Not enough population to raise army" };
  }

  // Deduct costs
  await ctx.db.patch(territoryId, {
    wealth: territory.wealth - totalCost,
    population: territory.population - totalPopulation,
  });

  // Create the army
  const armyId = await ctx.db.insert("armies", {
    territoryId,
    name: name || generateArmyName(),
    locationId: territoryId, // Starts at home
    units,
    supplies: 10, // 10 ticks worth of supplies
    status: "garrison",
    commanderName: generateCommanderName(),
    createdAtTick: tick,
  });

  return { success: true, armyId };
}

// Raise militia quickly
export async function raiseMilitia(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  count: number,
  tick: number
): Promise<{ success: boolean; armyId?: Id<"armies">; actualCount: number }> {
  const territory = await ctx.db.get(territoryId);
  if (!territory) {
    return { success: false, actualCount: 0 };
  }

  // Militia is cheap but limited by population
  const maxMilitia = Math.floor(territory.population * 0.2); // Max 20% of pop
  const actualCount = Math.min(count, maxMilitia);

  if (actualCount < 1) {
    return { success: false, actualCount: 0 };
  }

  const cost = actualCount * UNIT_TYPES.militia.recruitCost.wealth;

  // Even if no wealth, can raise some militia
  const affordableCount = territory.wealth >= cost
    ? actualCount
    : Math.floor(territory.wealth / UNIT_TYPES.militia.recruitCost.wealth);

  if (affordableCount < 1) {
    return { success: false, actualCount: 0 };
  }

  // Create militia army
  const result = await createArmy(
    ctx,
    territoryId,
    [{ type: "militia", count: affordableCount }],
    tick,
    "Local Militia"
  );

  return {
    success: result.success,
    armyId: result.armyId,
    actualCount: affordableCount,
  };
}

// Recruit professional soldiers into an existing army
export async function recruitSoldiers(
  ctx: MutationCtx,
  armyId: Id<"armies">,
  unitType: UnitType,
  count: number
): Promise<{ success: boolean; recruited: number; error?: string }> {
  const army = await ctx.db.get(armyId);
  if (!army) {
    return { success: false, recruited: 0, error: "Army not found" };
  }

  const territory = await ctx.db.get(army.territoryId);
  if (!territory) {
    return { success: false, recruited: 0, error: "Territory not found" };
  }

  const unitDef = UNIT_TYPES[unitType];
  const totalCost = unitDef.recruitCost.wealth * count;
  const totalPop = unitDef.recruitCost.population * count;

  if (territory.wealth < totalCost) {
    return { success: false, recruited: 0, error: "Not enough wealth" };
  }

  if (territory.population < totalPop * 2) {
    return { success: false, recruited: 0, error: "Not enough population" };
  }

  // Deduct costs
  await ctx.db.patch(army.territoryId, {
    wealth: territory.wealth - totalCost,
    population: territory.population - totalPop,
  });

  // Add to army
  const existingUnit = army.units.find(u => u.type === unitType);
  let newUnits;

  if (existingUnit) {
    newUnits = army.units.map(u => {
      if (u.type === unitType) {
        return { ...u, count: u.count + count };
      }
      return u;
    });
  } else {
    newUnits = [
      ...army.units,
      {
        type: unitType,
        count,
        experience: 0,
        morale: 70,
        equipment: 50,
      },
    ];
  }

  await ctx.db.patch(armyId, { units: newUnits });

  return { success: true, recruited: count };
}

// Move army to another territory
export async function moveArmy(
  ctx: MutationCtx,
  armyId: Id<"armies">,
  destinationId: Id<"territories">,
  tick: number
): Promise<{ success: boolean; error?: string }> {
  const army = await ctx.db.get(armyId);
  if (!army) {
    return { success: false, error: "Army not found" };
  }

  if (army.status === "battling" || army.status === "besieging") {
    return { success: false, error: "Army is engaged and cannot move" };
  }

  if (army.supplies < 2) {
    return { success: false, error: "Army needs supplies to march" };
  }

  // Consume supplies while marching
  await ctx.db.patch(armyId, {
    locationId: destinationId,
    status: "marching",
    supplies: army.supplies - 1,
  });

  return { success: true };
}

// Supply an army
export async function supplyArmy(
  ctx: MutationCtx,
  armyId: Id<"armies">,
  suppliesAmount: number
): Promise<{ success: boolean; newSupplies: number }> {
  const army = await ctx.db.get(armyId);
  if (!army) {
    return { success: false, newSupplies: 0 };
  }

  const territory = await ctx.db.get(army.territoryId);
  if (!territory) {
    return { success: false, newSupplies: 0 };
  }

  // Supplies cost food
  const foodCost = suppliesAmount * 2;
  if (territory.food < foodCost) {
    return { success: false, newSupplies: army.supplies };
  }

  await ctx.db.patch(army.territoryId, {
    food: territory.food - foodCost,
  });

  const newSupplies = Math.min(30, army.supplies + suppliesAmount); // Max 30 ticks supplies
  await ctx.db.patch(armyId, { supplies: newSupplies });

  return { success: true, newSupplies };
}

// Calculate army strength
export function calculateArmyStrength(
  army: Doc<"armies">,
  forDefense: boolean = false
): number {
  let totalStrength = 0;

  for (const unit of army.units) {
    const unitDef = UNIT_TYPES[unit.type as UnitType];
    if (!unitDef) continue;

    const baseStat = forDefense ? unitDef.defense : unitDef.attack;
    const experienceBonus = 1 + unit.experience / 100;
    const moraleBonus = unit.morale / 100;
    const equipmentBonus = 0.5 + unit.equipment / 200;

    const unitStrength = unit.count * baseStat * experienceBonus * moraleBonus * equipmentBonus;
    totalStrength += unitStrength;
  }

  return totalStrength;
}

// Process army upkeep
export async function processArmyUpkeep(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  tick: number
): Promise<{
  totalUpkeep: number;
  deserters: number;
  armiesAffected: number;
}> {
  const territory = await ctx.db.get(territoryId);
  if (!territory) {
    return { totalUpkeep: 0, deserters: 0, armiesAffected: 0 };
  }

  const armies = await ctx.db
    .query("armies")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .filter((q) => q.neq(q.field("status"), "disbanded"))
    .collect();

  let totalUpkeep = 0;
  let deserters = 0;
  let armiesAffected = 0;

  for (const army of armies) {
    let armyUpkeep = 0;

    for (const unit of army.units) {
      const unitDef = UNIT_TYPES[unit.type as UnitType];
      if (unitDef) {
        armyUpkeep += unit.count * unitDef.upkeep;
      }
    }

    totalUpkeep += armyUpkeep;

    // Consume supplies
    if (army.supplies > 0) {
      await ctx.db.patch(army._id, {
        supplies: army.supplies - 1,
      });
    } else {
      // No supplies - morale drops, soldiers desert
      armiesAffected++;
      const updatedUnits = army.units.map(unit => {
        const desertionRate = 0.05; // 5% desert per tick without supplies
        const unitDeserters = Math.floor(unit.count * desertionRate);
        deserters += unitDeserters;

        return {
          ...unit,
          count: Math.max(0, unit.count - unitDeserters),
          morale: Math.max(0, unit.morale - 10),
        };
      }).filter(u => u.count > 0);

      if (updatedUnits.length === 0) {
        // Army disbanded
        await ctx.db.patch(army._id, { status: "disbanded" });
      } else {
        await ctx.db.patch(army._id, { units: updatedUnits });
      }
    }
  }

  // Deduct upkeep from territory wealth
  if (territory.wealth >= totalUpkeep) {
    await ctx.db.patch(territoryId, {
      wealth: territory.wealth - totalUpkeep,
    });
  } else {
    // Can't afford upkeep - morale penalty to all armies
    await ctx.db.patch(territoryId, { wealth: 0 });

    for (const army of armies) {
      const updatedUnits = army.units.map(unit => ({
        ...unit,
        morale: Math.max(0, unit.morale - 5),
      }));
      await ctx.db.patch(army._id, { units: updatedUnits });
    }
  }

  return { totalUpkeep, deserters, armiesAffected };
}

// Disband an army (return soldiers to population)
export async function disbandArmy(
  ctx: MutationCtx,
  armyId: Id<"armies">
): Promise<{ success: boolean; populationReturned: number }> {
  const army = await ctx.db.get(armyId);
  if (!army) {
    return { success: false, populationReturned: 0 };
  }

  const territory = await ctx.db.get(army.territoryId);
  if (!territory) {
    return { success: false, populationReturned: 0 };
  }

  // Return soldiers to population
  let totalSoldiers = 0;
  for (const unit of army.units) {
    totalSoldiers += unit.count;
  }

  await ctx.db.patch(army.territoryId, {
    population: territory.population + totalSoldiers,
  });

  await ctx.db.patch(armyId, { status: "disbanded" });

  return { success: true, populationReturned: totalSoldiers };
}

// Get army summary for a territory
export async function getArmySummary(
  ctx: MutationCtx,
  territoryId: Id<"territories">
): Promise<{
  totalArmies: number;
  totalSoldiers: number;
  totalStrength: number;
  armyDetails: Array<{
    name: string;
    status: string;
    soldiers: number;
    strength: number;
    supplies: number;
  }>;
}> {
  const armies = await ctx.db
    .query("armies")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .filter((q) => q.neq(q.field("status"), "disbanded"))
    .collect();

  let totalSoldiers = 0;
  let totalStrength = 0;

  const armyDetails = armies.map(army => {
    const soldiers = army.units.reduce((sum, u) => sum + u.count, 0);
    const strength = calculateArmyStrength(army);

    totalSoldiers += soldiers;
    totalStrength += strength;

    return {
      name: army.name,
      status: army.status,
      soldiers,
      strength,
      supplies: army.supplies,
    };
  });

  return {
    totalArmies: armies.length,
    totalSoldiers,
    totalStrength,
    armyDetails,
  };
}
