import { Doc, Id } from "../_generated/dataModel";
import { MutationCtx } from "../_generated/server";
import { calculateArmyStrength, UNIT_TYPES, UnitType } from "./military";

// Clamp helper
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// Battle outcome determination
export interface BattleResult {
  winner: "attacker" | "defender" | "draw";
  attackerLosses: number;
  defenderLosses: number;
  attackerMoraleChange: number;
  defenderMoraleChange: number;
  warScoreChange: number;
  description: string;
}

// Resolve a battle between two armies
export async function resolveBattle(
  ctx: MutationCtx,
  attackerArmyId: Id<"armies">,
  defenderArmyId: Id<"armies">,
  locationId: Id<"territories">,
  tick: number
): Promise<BattleResult> {
  const attacker = await ctx.db.get(attackerArmyId);
  const defender = await ctx.db.get(defenderArmyId);

  if (!attacker || !defender) {
    return {
      winner: "draw",
      attackerLosses: 0,
      defenderLosses: 0,
      attackerMoraleChange: 0,
      defenderMoraleChange: 0,
      warScoreChange: 0,
      description: "Battle cancelled - army not found",
    };
  }

  // Calculate base strengths
  const attackerStrength = calculateArmyStrength(attacker, false);
  const defenderStrength = calculateArmyStrength(defender, true);

  // Get fortification bonus if defending in own territory
  const location = await ctx.db.get(locationId);
  let fortificationBonus = 1.0;

  if (location) {
    const fortification = await ctx.db
      .query("fortifications")
      .withIndex("by_territory", (q) => q.eq("territoryId", locationId))
      .first();

    if (fortification && defender.territoryId === locationId) {
      fortificationBonus = 1 + fortification.defenseBonus;
    }
  }

  const adjustedDefenderStrength = defenderStrength * fortificationBonus;

  // Add randomness (±20%)
  const attackerRoll = attackerStrength * (0.8 + Math.random() * 0.4);
  const defenderRoll = adjustedDefenderStrength * (0.8 + Math.random() * 0.4);

  // Determine winner
  let winner: "attacker" | "defender" | "draw";
  let warScoreChange = 0;

  if (attackerRoll > defenderRoll * 1.2) {
    winner = "attacker";
    warScoreChange = 10;
  } else if (defenderRoll > attackerRoll * 1.2) {
    winner = "defender";
    warScoreChange = -10;
  } else {
    winner = "draw";
    warScoreChange = 0;
  }

  // Calculate casualties based on strength ratio
  const strengthRatio = attackerStrength / (defenderStrength + 1);
  const inverseRatio = defenderStrength / (attackerStrength + 1);

  // Loser takes more casualties
  let attackerLossRate: number;
  let defenderLossRate: number;

  if (winner === "attacker") {
    attackerLossRate = 0.1 * inverseRatio;
    defenderLossRate = 0.3 * strengthRatio;
  } else if (winner === "defender") {
    attackerLossRate = 0.3 * inverseRatio;
    defenderLossRate = 0.1 * strengthRatio;
  } else {
    attackerLossRate = 0.2;
    defenderLossRate = 0.2;
  }

  // Apply casualties to units
  const attackerCasualties = await applyCasualties(ctx, attackerArmyId, attackerLossRate);
  const defenderCasualties = await applyCasualties(ctx, defenderArmyId, defenderLossRate);

  // Morale changes
  const attackerMoraleChange = winner === "attacker" ? 10 : winner === "draw" ? -5 : -15;
  const defenderMoraleChange = winner === "defender" ? 10 : winner === "draw" ? -5 : -15;

  await updateArmyMorale(ctx, attackerArmyId, attackerMoraleChange);
  await updateArmyMorale(ctx, defenderArmyId, defenderMoraleChange);

  // Experience gain for survivors
  await gainExperience(ctx, attackerArmyId, 5);
  await gainExperience(ctx, defenderArmyId, 5);

  // Update army statuses
  if (winner === "attacker") {
    await ctx.db.patch(defenderArmyId, { status: "retreating" });
  } else if (winner === "defender") {
    await ctx.db.patch(attackerArmyId, { status: "retreating" });
  }

  // Record battle
  await ctx.db.insert("battles", {
    attackerTerritoryId: attacker.territoryId,
    defenderTerritoryId: defender.territoryId,
    attackerArmyId,
    defenderArmyId,
    locationId,
    tick,
    attackerLosses: attackerCasualties,
    defenderLosses: defenderCasualties,
    winner,
    description: generateBattleDescription(
      attacker.name,
      defender.name,
      winner,
      attackerCasualties,
      defenderCasualties,
      location?.name || "unknown location"
    ),
  });

  return {
    winner,
    attackerLosses: attackerCasualties,
    defenderLosses: defenderCasualties,
    attackerMoraleChange,
    defenderMoraleChange,
    warScoreChange,
    description: `Battle at ${location?.name || "unknown"}: ${winner === "draw" ? "Inconclusive" : winner + " victory"}`,
  };
}

// Apply casualties to an army
async function applyCasualties(
  ctx: MutationCtx,
  armyId: Id<"armies">,
  lossRate: number
): Promise<number> {
  const army = await ctx.db.get(armyId);
  if (!army) return 0;

  let totalCasualties = 0;
  const updatedUnits = army.units.map(unit => {
    const casualties = Math.floor(unit.count * lossRate);
    totalCasualties += casualties;
    return {
      ...unit,
      count: Math.max(0, unit.count - casualties),
    };
  }).filter(u => u.count > 0);

  if (updatedUnits.length === 0) {
    await ctx.db.patch(armyId, { status: "disbanded", units: [] });
  } else {
    await ctx.db.patch(armyId, { units: updatedUnits });
  }

  return totalCasualties;
}

// Update army morale
async function updateArmyMorale(
  ctx: MutationCtx,
  armyId: Id<"armies">,
  change: number
): Promise<void> {
  const army = await ctx.db.get(armyId);
  if (!army) return;

  const updatedUnits = army.units.map(unit => ({
    ...unit,
    morale: clamp(unit.morale + change, 0, 100),
  }));

  await ctx.db.patch(armyId, { units: updatedUnits });
}

// Gain experience for surviving units
async function gainExperience(
  ctx: MutationCtx,
  armyId: Id<"armies">,
  amount: number
): Promise<void> {
  const army = await ctx.db.get(armyId);
  if (!army) return;

  const updatedUnits = army.units.map(unit => ({
    ...unit,
    experience: Math.min(100, unit.experience + amount),
  }));

  await ctx.db.patch(armyId, { units: updatedUnits });
}

// Generate battle description
function generateBattleDescription(
  attackerName: string,
  defenderName: string,
  winner: "attacker" | "defender" | "draw",
  attackerLosses: number,
  defenderLosses: number,
  location: string
): string {
  if (winner === "attacker") {
    return `The ${attackerName} achieved victory against the ${defenderName} at ${location}. ` +
      `The attackers lost ${attackerLosses} while inflicting ${defenderLosses} casualties on the defenders.`;
  } else if (winner === "defender") {
    return `The ${defenderName} successfully repelled the ${attackerName} at ${location}. ` +
      `The defenders lost ${defenderLosses} while the attackers suffered ${attackerLosses} casualties.`;
  } else {
    return `The battle between ${attackerName} and ${defenderName} at ${location} ended inconclusively. ` +
      `Both sides suffered heavy losses: ${attackerLosses} and ${defenderLosses} respectively.`;
  }
}

// Resolve battle against garrison (no formal army)
export async function resolveBattleAgainstGarrison(
  ctx: MutationCtx,
  attackerArmyId: Id<"armies">,
  defenderTerritoryId: Id<"territories">,
  tick: number
): Promise<BattleResult> {
  const attacker = await ctx.db.get(attackerArmyId);
  const defenderTerritory = await ctx.db.get(defenderTerritoryId);

  if (!attacker || !defenderTerritory) {
    return {
      winner: "draw",
      attackerLosses: 0,
      defenderLosses: 0,
      attackerMoraleChange: 0,
      defenderMoraleChange: 0,
      warScoreChange: 0,
      description: "Battle cancelled",
    };
  }

  // Garrison strength based on territory military and population
  const garrisonStrength = defenderTerritory.military * 2 + defenderTerritory.population * 0.5;
  const attackerStrength = calculateArmyStrength(attacker, false);

  // Fortification bonus
  const fortification = await ctx.db
    .query("fortifications")
    .withIndex("by_territory", (q) => q.eq("territoryId", defenderTerritoryId))
    .first();

  const fortBonus = fortification ? 1 + fortification.defenseBonus : 1.0;
  const adjustedGarrisonStrength = garrisonStrength * fortBonus;

  // Roll for outcome
  const attackerRoll = attackerStrength * (0.8 + Math.random() * 0.4);
  const defenderRoll = adjustedGarrisonStrength * (0.8 + Math.random() * 0.4);

  let winner: "attacker" | "defender" | "draw";
  let warScoreChange = 0;

  if (attackerRoll > defenderRoll * 1.3) {
    winner = "attacker";
    warScoreChange = 15;
  } else if (defenderRoll > attackerRoll * 1.3) {
    winner = "defender";
    warScoreChange = -15;
  } else {
    winner = "draw";
  }

  // Calculate losses
  const attackerLossRate = winner === "attacker" ? 0.15 : 0.25;
  const defenderPopLoss = winner === "attacker" ? Math.floor(defenderTerritory.population * 0.1) : 0;

  const attackerCasualties = await applyCasualties(ctx, attackerArmyId, attackerLossRate);

  // Update defender territory
  await ctx.db.patch(defenderTerritoryId, {
    population: Math.max(1, defenderTerritory.population - defenderPopLoss),
    military: Math.max(0, defenderTerritory.military - (winner === "attacker" ? 10 : 5)),
    happiness: Math.max(0, defenderTerritory.happiness - 10),
  });

  // Damage fortifications
  if (fortification) {
    await ctx.db.patch(fortification._id, {
      health: Math.max(0, fortification.health - 20),
    });
  }

  // Record battle
  await ctx.db.insert("battles", {
    attackerTerritoryId: attacker.territoryId,
    defenderTerritoryId,
    attackerArmyId,
    locationId: defenderTerritoryId,
    tick,
    attackerLosses: attackerCasualties,
    defenderLosses: defenderPopLoss,
    winner,
    description: `Attack on ${defenderTerritory.name}: ${winner === "attacker" ? "Successful" : winner === "defender" ? "Repelled" : "Inconclusive"}`,
  });

  return {
    winner,
    attackerLosses: attackerCasualties,
    defenderLosses: defenderPopLoss,
    attackerMoraleChange: winner === "attacker" ? 10 : -10,
    defenderMoraleChange: winner === "defender" ? 5 : -10,
    warScoreChange,
    description: `Attack on ${defenderTerritory.name}`,
  };
}

// Update war score and exhaustion for a relationship
export async function updateWarStatus(
  ctx: MutationCtx,
  territory1Id: Id<"territories">,
  territory2Id: Id<"territories">,
  warScoreChange: number,
  exhaustionIncrease: number = 5
): Promise<void> {
  // Find relationship
  let relationship = await ctx.db
    .query("relationships")
    .withIndex("by_territories", (q) => q.eq("territory1Id", territory1Id).eq("territory2Id", territory2Id))
    .first();

  if (!relationship) {
    relationship = await ctx.db
      .query("relationships")
      .withIndex("by_territories", (q) => q.eq("territory1Id", territory2Id).eq("territory2Id", territory1Id))
      .first();
  }

  if (!relationship || relationship.status !== "at_war") return;

  // Update war score (positive = territory1 winning, negative = territory2 winning)
  const newWarScore = clamp((relationship.warScore || 0) + warScoreChange, -100, 100);
  const newExhaustion = clamp((relationship.warExhaustion || 0) + exhaustionIncrease, 0, 100);

  await ctx.db.patch(relationship._id, {
    warScore: newWarScore,
    warExhaustion: newExhaustion,
  });

  // Check for automatic peace due to exhaustion or decisive victory
  if (newExhaustion >= 100) {
    // Both sides exhausted - forced peace
    await ctx.db.patch(relationship._id, {
      status: "tense",
      warScore: 0,
      warExhaustion: 0,
      trust: -50, // Still don't like each other
    });
  } else if (Math.abs(newWarScore) >= 100) {
    // Decisive victory - loser forced to surrender
    const winnerId = newWarScore > 0 ? territory1Id : territory2Id;
    await ctx.db.patch(relationship._id, {
      status: "tense",
      surrenderedTo: winnerId,
      warScore: 0,
      warExhaustion: 0,
      trust: -75,
    });
  }
}

// Check if armies should engage
export async function checkForBattles(
  ctx: MutationCtx,
  tick: number
): Promise<Array<{ location: string; attacker: string; defender: string }>> {
  const battles: Array<{ location: string; attacker: string; defender: string }> = [];

  // Get all non-garrison armies
  const armies = await ctx.db
    .query("armies")
    .filter((q) =>
      q.and(
        q.neq(q.field("status"), "disbanded"),
        q.neq(q.field("status"), "garrison")
      )
    )
    .collect();

  // Group by location
  const armiesByLocation = new Map<string, Doc<"armies">[]>();
  for (const army of armies) {
    const locationKey = army.locationId.toString();
    const existing = armiesByLocation.get(locationKey) || [];
    armiesByLocation.set(locationKey, [...existing, army]);
  }

  // Check each location for opposing armies
  for (const [locationId, localArmies] of armiesByLocation.entries()) {
    // Group by owner
    const byOwner = new Map<string, Doc<"armies">[]>();
    for (const army of localArmies) {
      const ownerKey = army.territoryId.toString();
      const existing = byOwner.get(ownerKey) || [];
      byOwner.set(ownerKey, [...existing, army]);
    }

    // If multiple owners in same location, check for war
    const owners = [...byOwner.keys()];
    for (let i = 0; i < owners.length; i++) {
      for (let j = i + 1; j < owners.length; j++) {
        const owner1Armies = byOwner.get(owners[i])!;
        const owner2Armies = byOwner.get(owners[j])!;

        // Check if at war
        const rel = await ctx.db
          .query("relationships")
          .withIndex("by_territories", (q) =>
            q.eq("territory1Id", owner1Armies[0].territoryId)
              .eq("territory2Id", owner2Armies[0].territoryId)
          )
          .first();

        let atWar = rel?.status === "at_war";

        if (!atWar) {
          const reverseRel = await ctx.db
            .query("relationships")
            .withIndex("by_territories", (q) =>
              q.eq("territory1Id", owner2Armies[0].territoryId)
                .eq("territory2Id", owner1Armies[0].territoryId)
            )
            .first();
          atWar = reverseRel?.status === "at_war";
        }

        if (atWar) {
          // Battle!
          const result = await resolveBattle(
            ctx,
            owner1Armies[0]._id,
            owner2Armies[0]._id,
            localArmies[0].locationId,
            tick
          );

          const location = await ctx.db.get(localArmies[0].locationId);
          battles.push({
            location: location?.name || "Unknown",
            attacker: owner1Armies[0].name,
            defender: owner2Armies[0].name,
          });

          // Update war status
          await updateWarStatus(
            ctx,
            owner1Armies[0].territoryId,
            owner2Armies[0].territoryId,
            result.warScoreChange
          );
        }
      }
    }
  }

  return battles;
}
