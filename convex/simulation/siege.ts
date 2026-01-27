import { Doc, Id } from "../_generated/dataModel";
import { MutationCtx } from "../_generated/server";
import { calculateArmyStrength, UNIT_TYPES } from "./military";

// Clamp helper
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// Fortification type definitions
export const FORTIFICATION_TYPES = {
  palisade: {
    defenseBonus: 0.2,
    maxHealth: 50,
    buildCost: { wealth: 10, timber: 10 },
    buildTime: 2,
    requiredTech: null,
  },
  wooden_wall: {
    defenseBonus: 0.4,
    maxHealth: 100,
    buildCost: { wealth: 25, timber: 30 },
    buildTime: 4,
    requiredTech: "construction",
  },
  stone_wall: {
    defenseBonus: 0.7,
    maxHealth: 200,
    buildCost: { wealth: 80 },
    buildTime: 8,
    requiredTech: "masonry",
  },
  castle: {
    defenseBonus: 1.0,
    maxHealth: 400,
    buildCost: { wealth: 200 },
    buildTime: 16,
    requiredTech: "castle_building",
  },
  fortress: {
    defenseBonus: 1.5,
    maxHealth: 600,
    buildCost: { wealth: 500 },
    buildTime: 24,
    requiredTech: "advanced_fortifications",
  },
} as const;

export type FortificationType = keyof typeof FORTIFICATION_TYPES;

// Build fortifications
export async function buildFortification(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  type: FortificationType,
  tick: number
): Promise<{ success: boolean; fortificationId?: Id<"fortifications">; error?: string }> {
  const territory = await ctx.db.get(territoryId);
  if (!territory) {
    return { success: false, error: "Territory not found" };
  }

  const fortDef = FORTIFICATION_TYPES[type];

  // Check costs
  if (territory.wealth < fortDef.buildCost.wealth) {
    return { success: false, error: "Not enough wealth" };
  }

  // Check for existing fortification
  const existing = await ctx.db
    .query("fortifications")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .first();

  if (existing) {
    // Upgrade existing
    const existingType = existing.type as FortificationType;
    const fortTypes: FortificationType[] = ["palisade", "wooden_wall", "stone_wall", "castle", "fortress"];
    const existingIndex = fortTypes.indexOf(existingType);
    const newIndex = fortTypes.indexOf(type);

    if (newIndex <= existingIndex) {
      return { success: false, error: "Cannot downgrade fortifications" };
    }

    await ctx.db.patch(territoryId, {
      wealth: territory.wealth - fortDef.buildCost.wealth,
    });

    await ctx.db.patch(existing._id, {
      type,
      level: existing.level + 1,
      maxHealth: fortDef.maxHealth,
      health: fortDef.maxHealth,
      defenseBonus: fortDef.defenseBonus,
    });

    return { success: true, fortificationId: existing._id };
  }

  // Build new
  await ctx.db.patch(territoryId, {
    wealth: territory.wealth - fortDef.buildCost.wealth,
  });

  const fortificationId = await ctx.db.insert("fortifications", {
    territoryId,
    type,
    level: 1,
    health: fortDef.maxHealth,
    maxHealth: fortDef.maxHealth,
    defenseBonus: fortDef.defenseBonus,
    constructedAtTick: tick,
  });

  return { success: true, fortificationId };
}

// Start a siege
export async function startSiege(
  ctx: MutationCtx,
  attackerArmyId: Id<"armies">,
  defenderTerritoryId: Id<"territories">,
  tick: number
): Promise<{ success: boolean; siegeId?: Id<"sieges">; error?: string }> {
  const attacker = await ctx.db.get(attackerArmyId);
  if (!attacker) {
    return { success: false, error: "Attacking army not found" };
  }

  // Army must be at the target location
  if (attacker.locationId !== defenderTerritoryId) {
    return { success: false, error: "Army must be at target location to begin siege" };
  }

  // Check for existing siege
  const existingSiege = await ctx.db
    .query("sieges")
    .withIndex("by_defender", (q) => q.eq("defenderTerritoryId", defenderTerritoryId))
    .filter((q) => q.eq(q.field("status"), "ongoing"))
    .first();

  if (existingSiege) {
    return { success: false, error: "Territory is already under siege" };
  }

  // Get fortification
  const fortification = await ctx.db
    .query("fortifications")
    .withIndex("by_territory", (q) => q.eq("territoryId", defenderTerritoryId))
    .first();

  const fortLevel = fortification?.level || 0;
  const currentDefense = fortification?.health || 0;

  // Check for defending army
  const defenderArmy = await ctx.db
    .query("armies")
    .withIndex("by_location", (q) => q.eq("locationId", defenderTerritoryId))
    .filter((q) =>
      q.and(
        q.eq(q.field("territoryId"), defenderTerritoryId),
        q.neq(q.field("status"), "disbanded")
      )
    )
    .first();

  // Create siege
  const siegeId = await ctx.db.insert("sieges", {
    attackerArmyId,
    defenderTerritoryId,
    defenderArmyId: defenderArmy?._id,
    fortificationLevel: fortLevel,
    currentDefense,
    progress: 0,
    startedAtTick: tick,
    status: "ongoing",
  });

  // Update army status
  await ctx.db.patch(attackerArmyId, { status: "besieging" });

  // Log event
  const territory = await ctx.db.get(defenderTerritoryId);
  const attackerTerritory = await ctx.db.get(attacker.territoryId);

  await ctx.db.insert("events", {
    tick,
    type: "war",
    territoryId: attacker.territoryId,
    targetTerritoryId: defenderTerritoryId,
    title: "Siege Begins",
    description: `The ${attacker.name} from ${attackerTerritory?.name} has begun a siege of ${territory?.name}.`,
    severity: "critical",
    createdAt: Date.now(),
  });

  return { success: true, siegeId };
}

// Process ongoing sieges
export async function processSieges(
  ctx: MutationCtx,
  tick: number
): Promise<{
  resolved: Array<{ territory: string; outcome: string }>;
  ongoing: number;
}> {
  const resolved: Array<{ territory: string; outcome: string }> = [];

  const sieges = await ctx.db
    .query("sieges")
    .filter((q) => q.eq(q.field("status"), "ongoing"))
    .collect();

  for (const siege of sieges) {
    const attacker = await ctx.db.get(siege.attackerArmyId);
    const defenderTerritory = await ctx.db.get(siege.defenderTerritoryId);

    if (!attacker || !defenderTerritory) {
      await ctx.db.patch(siege._id, { status: "lifted" });
      continue;
    }

    // Check if attacker still has supplies
    if (attacker.supplies <= 0) {
      // Siege lifts due to no supplies
      await ctx.db.patch(siege._id, { status: "lifted" });
      await ctx.db.patch(siege.attackerArmyId, { status: "retreating" });

      resolved.push({
        territory: defenderTerritory.name,
        outcome: "Siege lifted - attackers out of supplies",
      });

      await ctx.db.insert("events", {
        tick,
        type: "war",
        territoryId: defenderTerritory._id,
        title: "Siege Lifted",
        description: `The siege of ${defenderTerritory.name} has been lifted as the attackers ran out of supplies.`,
        severity: "positive",
        createdAt: Date.now(),
      });

      continue;
    }

    // Calculate siege progress
    const attackerStrength = calculateArmyStrength(attacker);

    // Siege units are much more effective
    const siegeUnits = attacker.units.find(u => u.type === "siege");
    const siegeBonus = siegeUnits ? siegeUnits.count * 5 : 0;

    const effectiveStrength = attackerStrength + siegeBonus;

    // Progress based on strength vs fortification
    const fortificationResistance = siege.fortificationLevel * 20 + 10;
    const progressGain = (effectiveStrength / (fortificationResistance + 50)) * 10;

    const newProgress = Math.min(100, siege.progress + progressGain);

    // Damage fortifications
    const fortification = await ctx.db
      .query("fortifications")
      .withIndex("by_territory", (q) => q.eq("territoryId", siege.defenderTerritoryId))
      .first();

    if (fortification) {
      const damage = progressGain * 2;
      const newHealth = Math.max(0, fortification.health - damage);
      await ctx.db.patch(fortification._id, { health: newHealth });

      await ctx.db.patch(siege._id, { currentDefense: newHealth });
    }

    // Update progress
    await ctx.db.patch(siege._id, { progress: newProgress });

    // Check for siege completion
    if (newProgress >= 100) {
      // Siege successful - territory is breached
      await ctx.db.patch(siege._id, { status: "breached" });

      resolved.push({
        territory: defenderTerritory.name,
        outcome: "Siege successful - walls breached",
      });

      await ctx.db.insert("events", {
        tick,
        type: "war",
        territoryId: siege.defenderTerritoryId,
        title: "Walls Breached",
        description: `The walls of ${defenderTerritory.name} have been breached! The attackers storm the city.`,
        severity: "critical",
        createdAt: Date.now(),
      });

      // Assault automatically begins
      await assaultWalls(ctx, siege._id, tick);
    }

    // Consume supplies during siege
    await ctx.db.patch(siege.attackerArmyId, {
      supplies: Math.max(0, attacker.supplies - 0.5),
    });

    // Defender territory suffers during siege
    await ctx.db.patch(siege.defenderTerritoryId, {
      food: Math.max(0, defenderTerritory.food - 2),
      happiness: Math.max(0, defenderTerritory.happiness - 1),
    });
  }

  const ongoingSieges = await ctx.db
    .query("sieges")
    .filter((q) => q.eq(q.field("status"), "ongoing"))
    .collect();

  return {
    resolved,
    ongoing: ongoingSieges.length,
  };
}

// Assault the walls (attempt to storm before siege is complete)
export async function assaultWalls(
  ctx: MutationCtx,
  siegeId: Id<"sieges">,
  tick: number
): Promise<{ success: boolean; outcome: string; casualties: number }> {
  const siege = await ctx.db.get(siegeId);
  if (!siege) {
    return { success: false, outcome: "Siege not found", casualties: 0 };
  }

  const attacker = await ctx.db.get(siege.attackerArmyId);
  const defenderTerritory = await ctx.db.get(siege.defenderTerritoryId);

  if (!attacker || !defenderTerritory) {
    return { success: false, outcome: "Invalid siege state", casualties: 0 };
  }

  // Assault is risky - high casualties regardless of outcome
  const attackerStrength = calculateArmyStrength(attacker);

  // Defense strength based on remaining fortification and garrison
  let defenseStrength = defenderTerritory.military * 3;

  // Add fortification defense
  const fortification = await ctx.db
    .query("fortifications")
    .withIndex("by_territory", (q) => q.eq("territoryId", siege.defenderTerritoryId))
    .first();

  if (fortification && fortification.health > 0) {
    defenseStrength *= (1 + fortification.health / fortification.maxHealth);
  }

  // Siege progress makes assault easier
  const progressBonus = siege.progress / 100;
  const adjustedAttackerStrength = attackerStrength * (1 + progressBonus);

  // Roll for outcome
  const attackRoll = adjustedAttackerStrength * (0.7 + Math.random() * 0.6);
  const defenseRoll = defenseStrength * (0.7 + Math.random() * 0.6);

  const success = attackRoll > defenseRoll;

  // Calculate casualties (high for assault)
  const baseCasualtyRate = success ? 0.2 : 0.4;
  const totalSoldiers = attacker.units.reduce((sum, u) => sum + u.count, 0);
  const casualties = Math.floor(totalSoldiers * baseCasualtyRate);

  // Apply casualties
  const updatedUnits = attacker.units.map(unit => {
    const unitCasualties = Math.floor(unit.count * baseCasualtyRate);
    return {
      ...unit,
      count: Math.max(0, unit.count - unitCasualties),
      morale: Math.max(0, unit.morale - (success ? 5 : 15)),
    };
  }).filter(u => u.count > 0);

  if (updatedUnits.length === 0) {
    await ctx.db.patch(siege.attackerArmyId, {
      status: "disbanded",
      units: [],
    });
    await ctx.db.patch(siegeId, { status: "lifted" });
    return { success: false, outcome: "Army destroyed in assault", casualties };
  }

  await ctx.db.patch(siege.attackerArmyId, { units: updatedUnits });

  if (success) {
    // City captured!
    await ctx.db.patch(siegeId, { status: "successful" });

    // Transfer territory effects
    await ctx.db.patch(siege.defenderTerritoryId, {
      happiness: Math.max(0, defenderTerritory.happiness - 30),
      wealth: Math.max(0, defenderTerritory.wealth - 20),
      population: Math.max(1, defenderTerritory.population - Math.floor(defenderTerritory.population * 0.1)),
    });

    // Update army status
    await ctx.db.patch(siege.attackerArmyId, { status: "garrison" });

    await ctx.db.insert("events", {
      tick,
      type: "war",
      territoryId: attacker.territoryId,
      targetTerritoryId: siege.defenderTerritoryId,
      title: "City Captured",
      description: `${defenderTerritory.name} has fallen! The attackers now control the city.`,
      severity: "critical",
      createdAt: Date.now(),
    });

    return {
      success: true,
      outcome: `${defenderTerritory.name} captured!`,
      casualties,
    };
  } else {
    // Assault repelled
    await ctx.db.patch(siege.attackerArmyId, {
      status: "besieging", // Continue siege
    });

    await ctx.db.insert("events", {
      tick,
      type: "war",
      territoryId: siege.defenderTerritoryId,
      title: "Assault Repelled",
      description: `The defenders of ${defenderTerritory.name} have repelled an assault with heavy enemy casualties.`,
      severity: "positive",
      createdAt: Date.now(),
    });

    return {
      success: false,
      outcome: "Assault repelled with heavy casualties",
      casualties,
    };
  }
}

// Lift a siege (attacker withdraws)
export async function liftSiege(
  ctx: MutationCtx,
  siegeId: Id<"sieges">
): Promise<{ success: boolean }> {
  const siege = await ctx.db.get(siegeId);
  if (!siege) {
    return { success: false };
  }

  // Reset siege progress when lifted so it doesn't carry over
  await ctx.db.patch(siegeId, {
    status: "lifted",
    progress: 0, // Reset progress
  });
  await ctx.db.patch(siege.attackerArmyId, { status: "marching" });

  return { success: true };
}

// Repair fortifications
export async function repairFortifications(
  ctx: MutationCtx,
  territoryId: Id<"territories">
): Promise<{ success: boolean; repaired: number }> {
  const territory = await ctx.db.get(territoryId);
  if (!territory) {
    return { success: false, repaired: 0 };
  }

  const fortification = await ctx.db
    .query("fortifications")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .first();

  if (!fortification) {
    return { success: false, repaired: 0 };
  }

  const damage = fortification.maxHealth - fortification.health;
  if (damage <= 0) {
    return { success: true, repaired: 0 };
  }

  // Repair cost
  const repairCost = Math.ceil(damage * 0.1);
  if (territory.wealth < repairCost) {
    return { success: false, repaired: 0 };
  }

  await ctx.db.patch(territoryId, {
    wealth: territory.wealth - repairCost,
  });

  await ctx.db.patch(fortification._id, {
    health: fortification.maxHealth,
  });

  return { success: true, repaired: damage };
}

// Get siege summary
export async function getSiegeSummary(
  ctx: MutationCtx,
  territoryId: Id<"territories">
): Promise<{
  underSiege: boolean;
  siegeProgress: number;
  daysRemaining: number;
  attackerStrength: number;
}> {
  const siege = await ctx.db
    .query("sieges")
    .withIndex("by_defender", (q) => q.eq("defenderTerritoryId", territoryId))
    .filter((q) => q.eq(q.field("status"), "ongoing"))
    .first();

  if (!siege) {
    return {
      underSiege: false,
      siegeProgress: 0,
      daysRemaining: 0,
      attackerStrength: 0,
    };
  }

  const attacker = await ctx.db.get(siege.attackerArmyId);
  const attackerStrength = attacker ? calculateArmyStrength(attacker) : 0;

  // Estimate days remaining
  const progressPerTick = attackerStrength / 100;
  const remainingProgress = 100 - siege.progress;
  const daysRemaining = Math.ceil(remainingProgress / (progressPerTick || 1));

  return {
    underSiege: true,
    siegeProgress: siege.progress,
    daysRemaining,
    attackerStrength,
  };
}
