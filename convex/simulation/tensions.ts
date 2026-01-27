import { internalMutation, query, MutationCtx } from "../_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "../_generated/dataModel";

// =============================================
// NATURAL CONSTANTS
// =============================================

// Food requirement per person per tick
const FOOD_REQUIREMENT_PER_PERSON = 0.5;

// Expected happiness baseline (what people expect as "normal")
const EXPECTED_HAPPINESS_BASELINE = 50;

// Control capacity scaling (how much unrest can be controlled per military point)
const CONTROL_PER_MILITARY = 2;

// =============================================
// HELPER FUNCTIONS FOR NATURAL CALCULATIONS
// =============================================

// Calculate food per capita ratio
function calculateFoodPerCapita(territory: Doc<"territories">): number {
  return territory.food / Math.max(1, territory.population);
}

// Calculate famine risk as continuous 0-1 value based on food per capita
function calculateFamineRisk(foodPerCapita: number): number {
  // 0 risk when food/person >= 1.0
  // Gradual increase as food drops
  // Returns 0-1 scale
  if (foodPerCapita >= FOOD_REQUIREMENT_PER_PERSON * 2) return 0;
  if (foodPerCapita <= 0) return 1;

  // Smooth sigmoid-like curve
  const shortage = 1 - (foodPerCapita / (FOOD_REQUIREMENT_PER_PERSON * 2));
  return shortage * shortage; // Quadratic for gradual onset
}

// Calculate resource competition with neighbors
function calculateResourceCompetition(
  territory: Doc<"territories">,
  neighborResources: Array<{ food: number; wealth: number; population: number }>
): number {
  if (neighborResources.length === 0) return 0;

  // Calculate average neighbor resources
  const avgNeighborFood = neighborResources.reduce((sum, n) => sum + n.food, 0) / neighborResources.length;
  const avgNeighborWealth = neighborResources.reduce((sum, n) => sum + n.wealth, 0) / neighborResources.length;

  // Competition increases when we have less than neighbors
  let competition = 0;

  // Food scarcity creates competition
  if (territory.food < avgNeighborFood * 0.7) {
    competition += (avgNeighborFood - territory.food) / Math.max(1, avgNeighborFood);
  }

  // Wealth disparity creates envy/competition
  if (territory.wealth < avgNeighborWealth * 0.6) {
    competition += (avgNeighborWealth - territory.wealth) / Math.max(1, avgNeighborWealth) * 0.5;
  }

  // Population pressure on limited resources
  const totalNeighborPop = neighborResources.reduce((sum, n) => sum + n.population, 0);
  if (totalNeighborPop > 0 && territory.food < 40) {
    competition += 0.2 * (1 - territory.food / 100);
  }

  return Math.min(1, competition); // Cap at 1
}

// Calculate military balance ratio
function calculateMilitaryBalance(ourMilitary: number, avgNeighborMilitary: number): number {
  if (avgNeighborMilitary <= 0) return 1; // No neighbors = strong position
  return ourMilitary / Math.max(1, avgNeighborMilitary);
}

// Calculate natural war probability
function calculateWarProbability(
  resourceCompetition: number,
  militaryBalance: number,
  tensionLevel: number,
  rivalryIntensity: number
): number {
  // War is more likely when:
  // - Resource competition is high
  // - Military balance favors aggression (we're stronger) OR desperation (we're starving)
  // - Tension/trust is poor
  // - Historical grievances (rivalry) exist

  let probability = 0;

  // Resource competition drives war
  probability += resourceCompetition * 0.3;

  // Military advantage encourages aggression
  if (militaryBalance > 1.2) {
    probability += (militaryBalance - 1) * 0.2;
  }
  // Desperation (weak military but starving) also drives war
  if (militaryBalance < 0.8 && resourceCompetition > 0.5) {
    probability += 0.15; // Desperate attack
  }

  // Tension/distrust
  probability += tensionLevel * 0.25;

  // Rivalry intensity
  probability += (rivalryIntensity / 100) * 0.25;

  return Math.min(1, Math.max(0, probability));
}

// Calculate expected happiness based on conditions
function calculateExpectedHappiness(territory: Doc<"territories">): number {
  let expected = EXPECTED_HAPPINESS_BASELINE;

  // Good food raises expectations
  const foodPerCapita = calculateFoodPerCapita(territory);
  if (foodPerCapita > 1.5) expected += 10;

  // Wealth raises expectations
  if (territory.wealth > 60) expected += 10;
  if (territory.wealth > 80) expected += 5;

  // Technology and knowledge raise expectations
  if (territory.technology > 50) expected += 5;
  if (territory.knowledge > 50) expected += 5;

  // Recent prosperity raises expectations (complacency)
  // This would be tracked separately but simplified here

  return expected;
}

// =============================================
// CALCULATE TENSIONS
// =============================================

export async function calculateTensions(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  tick: number
): Promise<void> {
  const territory = await ctx.db.get(territoryId);
  if (!territory) return;

  // Get all relationships
  const allRelationships = await ctx.db.query("relationships").collect();
  const relationships = allRelationships.filter(
    (r) => r.territory1Id === territoryId || r.territory2Id === territoryId
  );

  // Get neighbor territories for resource comparison
  const neighborIds = relationships.map((r) =>
    r.territory1Id === territoryId ? r.territory2Id : r.territory1Id
  );
  const neighbors: Array<{ food: number; wealth: number; population: number; military: number }> = [];
  for (const nId of neighborIds) {
    const neighbor = await ctx.db.get(nId);
    if (neighbor) {
      neighbors.push({
        food: neighbor.food,
        wealth: neighbor.wealth,
        population: neighbor.population,
        military: neighbor.military,
      });
    }
  }

  // Get characters
  const characters = await ctx.db
    .query("characters")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .filter((q) => q.eq(q.field("isAlive"), true))
    .collect();

  const ruler = characters.find((c) => c.role === "ruler");
  const heir = characters.find((c) => c.role === "heir");
  const generals = characters.filter((c) => c.role === "general");
  const advisors = characters.filter((c) => c.role === "advisor");

  // Get factions
  const factions = await ctx.db
    .query("factions")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .collect();

  // Get prosperity tier
  const prosperityTier = await ctx.db
    .query("prosperityTiers")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .first();

  // Get rivalries
  const rivalries = await ctx.db
    .query("rivalries")
    .withIndex("by_territory1", (q) => q.eq("territory1Id", territoryId))
    .filter((q) => q.eq(q.field("status"), "active"))
    .collect();

  const rivalries2 = await ctx.db
    .query("rivalries")
    .withIndex("by_territory2", (q) => q.eq("territory2Id", territoryId))
    .filter((q) => q.eq(q.field("status"), "active"))
    .collect();

  const allRivalries = [...rivalries, ...rivalries2];

  // =============================================
  // CALCULATE NATURAL WAR LIKELIHOOD
  // Based on: resource competition, military balance, rivalries
  // =============================================

  let warLikelihood = 0;
  const brewingConflicts: Array<{
    targetId: Id<"territories">;
    likelihood: number;
    reason: string;
  }> = [];

  // Calculate resource competition
  const resourceCompetition = calculateResourceCompetition(territory, neighbors);

  // Average neighbor military for balance calculation
  const avgNeighborMilitary = neighbors.length > 0
    ? neighbors.reduce((sum, n) => sum + n.military, 0) / neighbors.length
    : 0;
  const militaryBalance = calculateMilitaryBalance(territory.military, avgNeighborMilitary);

  for (const rel of relationships) {
    const otherTerritoryId =
      rel.territory1Id === territoryId ? rel.territory2Id : rel.territory1Id;
    const reasons: string[] = [];

    // Find rivalry with this specific neighbor
    const rivalryWithNeighbor = allRivalries.find(
      (r) => r.territory1Id === otherTerritoryId || r.territory2Id === otherTerritoryId
    );
    const rivalryIntensity = rivalryWithNeighbor ? rivalryWithNeighbor.intensity : 0;

    // Calculate tension level from trust (normalized to 0-1)
    const tensionLevel = rel.trust < 0 ? Math.abs(rel.trust) / 100 : 0;

    // Calculate natural war probability
    const warProb = calculateWarProbability(
      resourceCompetition,
      militaryBalance,
      tensionLevel,
      rivalryIntensity
    );

    // Build reason string
    if (resourceCompetition > 0.3) reasons.push("resource scarcity");
    if (militaryBalance > 1.3) reasons.push("military advantage");
    if (militaryBalance < 0.7 && resourceCompetition > 0.5) reasons.push("desperation");
    if (tensionLevel > 0.3) reasons.push("distrust");
    if (rivalryIntensity > 30) reasons.push("historical grievances");
    if (ruler && ruler.traits.ambition > 70) reasons.push("ambitious ruler");

    const conflictLikelihood = warProb * 100;

    if (conflictLikelihood > 15) {
      brewingConflicts.push({
        targetId: otherTerritoryId,
        likelihood: Math.round(conflictLikelihood),
        reason: reasons.length > 0 ? reasons.join(", ") : "tensions",
      });
    }

    warLikelihood = Math.max(warLikelihood, conflictLikelihood);
  }

  warLikelihood = Math.round(warLikelihood);

    // =============================================
    // CALCULATE COUP LIKELIHOOD (NATURAL SYSTEM)
    // Based on character ambitions, ruler strength, and opportunity
    // =============================================

    let coupLikelihood = 0;

    // Check for ambitious generals - continuous scaling
    for (const general of generals) {
      const ambitionFactor = (general.traits.ambition - 50) / 50; // -1 to 1
      const loyaltyFactor = (50 - general.traits.loyalty) / 50; // -1 to 1
      if (ambitionFactor > 0 && loyaltyFactor > 0) {
        coupLikelihood += ambitionFactor * loyaltyFactor * 30;
      }
    }

    // Check for ambitious advisors
    for (const advisor of advisors) {
      const ambitionFactor = (advisor.traits.ambition - 50) / 50;
      const loyaltyFactor = (50 - advisor.traits.loyalty) / 50;
      if (ambitionFactor > 0 && loyaltyFactor > 0) {
        coupLikelihood += ambitionFactor * loyaltyFactor * 25;
      }
    }

    // Low happiness makes coups easier (ruler unpopular)
    // Smooth curve instead of threshold
    if (territory.happiness < 60) {
      coupLikelihood += (60 - territory.happiness) * 0.5;
    }

    // Weak military - continuous scaling
    if (territory.military < 50) {
      coupLikelihood += (50 - territory.military) * 0.3;
    }

    // Existing plots - each plot increases likelihood
    const plotCount = characters.reduce((sum, c) => sum + c.activePlots.length, 0);
    coupLikelihood += plotCount * 20;

    // Prosperity decadence - continuous scaling
    if (prosperityTier && prosperityTier.decadenceLevel > 30) {
      coupLikelihood += (prosperityTier.decadenceLevel - 30) * 0.4;
    }

    // Old ruler - succession uncertainty increases with age
    if (ruler && ruler.age > 50) {
      coupLikelihood += (ruler.age - 50) * 0.5;
    }

    coupLikelihood = Math.round(Math.min(100, coupLikelihood));

    // =============================================
    // CALCULATE FAMINE LIKELIHOOD (NATURAL SYSTEM)
    // Based on food-per-capita, not arbitrary thresholds
    // =============================================

    // Calculate food per capita - the key metric
    const foodPerCapita = calculateFoodPerCapita(territory);
    const baseFamineRisk = calculateFamineRisk(foodPerCapita);

    let famineLikelihood = baseFamineRisk * 70; // Convert to 0-70 base scale

    // Check for farms (production capacity)
    const farms = await ctx.db
      .query("buildings")
      .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
      .filter((q) => q.eq(q.field("type"), "farm"))
      .collect();

    // No farms means no production buffer - increases risk
    if (farms.length === 0 && foodPerCapita < 1.5) {
      famineLikelihood += 15;
    }

    // War damage to food production
    const isAtWar = relationships.some((r) => r.status === "at_war");
    if (isAtWar) {
      famineLikelihood += 15; // War disrupts food production
    }

    // Gradual escalation stages based on food per capita:
    // - Abundance (foodPerCapita > 1.5): No famine risk
    // - Sufficient (1.0-1.5): Low risk, some scarcity
    // - Scarcity (0.5-1.0): Rationing begins
    // - Shortage (0.3-0.5): Hunger widespread
    // - Famine (<0.3): Starvation
    if (foodPerCapita < 0.3) {
      famineLikelihood = Math.max(famineLikelihood, 85); // Guaranteed high
    } else if (foodPerCapita < 0.5) {
      famineLikelihood = Math.max(famineLikelihood, 60);
    } else if (foodPerCapita < 0.7) {
      famineLikelihood = Math.max(famineLikelihood, 40);
    }

    famineLikelihood = Math.round(Math.min(100, famineLikelihood));

    // =============================================
    // CALCULATE SUCCESSION CRISIS LIKELIHOOD (NATURAL SYSTEM)
    // Based on heir status, claimants, and ruler age
    // =============================================

    let successionCrisisLikelihood = 0;

    if (!heir) {
      // No heir - crisis likelihood scales with ruler age
      if (ruler) {
        successionCrisisLikelihood += 20 + Math.max(0, ruler.age - 40) * 1.5;
      } else {
        successionCrisisLikelihood += 50; // No ruler AND no heir
      }
    } else {
      // Have heir - but may have problems
      // Ambitious heir might not wait
      if (heir.traits.ambition > 50) {
        successionCrisisLikelihood += (heir.traits.ambition - 50) * 0.5;
      }
      // Disloyal heir is dangerous
      if (heir.traits.loyalty < 50) {
        successionCrisisLikelihood += (50 - heir.traits.loyalty) * 0.5;
      }
    }

    // Multiple potential claimants - each adds to crisis risk
    const claimants = characters.filter(
      (c) => c.traits.ambition > 50 && c.role !== "ruler" && c.role !== "heir"
    );
    // Continuous scaling based on number and ambition
    for (const claimant of claimants) {
      successionCrisisLikelihood += (claimant.traits.ambition - 50) * 0.3;
    }

    // Ruler age - crisis becomes more likely as ruler ages
    if (ruler && ruler.age > 50) {
      successionCrisisLikelihood += (ruler.age - 50) * 1.0;
    }

    successionCrisisLikelihood = Math.round(Math.min(100, successionCrisisLikelihood));

    // =============================================
    // CALCULATE REBELLION LIKELIHOOD (ACCUMULATED UNREST SYSTEM)
    // Unrest builds when happiness < expectations
    // Rebellion occurs when unrest exceeds control capacity
    // =============================================

    // Calculate expected happiness based on conditions
    const expectedHappiness = calculateExpectedHappiness(territory);

    // Get current unrest level (or 0 if not tracked yet)
    const currentUnrest = territory.unrest || 0;

    // Calculate unrest change for this tick
    // Unrest grows when happiness is below expectations
    // Unrest dissipates slowly when conditions improve
    const happinessDeficit = expectedHappiness - territory.happiness;
    let unrestChange = 0;

    if (happinessDeficit > 0) {
      // Unrest grows proportionally to how much happiness is below expectations
      unrestChange = happinessDeficit * 0.1;
    } else {
      // Conditions are good - unrest slowly dissipates
      unrestChange = -Math.min(currentUnrest * 0.05, 5);
    }

    // Apply unrest change to territory
    const newUnrest = Math.max(0, currentUnrest + unrestChange);
    if (newUnrest !== currentUnrest) {
      await ctx.db.patch(territoryId, { unrest: newUnrest });
    }

    // Calculate control capacity (military + ruler popularity)
    const controlCapacity = territory.military * CONTROL_PER_MILITARY +
      (ruler ? ruler.traits.charisma * 0.5 : 0) +
      (territory.happiness > 40 ? 20 : 0);

    // Rebellion likelihood = how much unrest exceeds control capacity
    let rebellionLikelihood = 0;
    if (newUnrest > controlCapacity) {
      rebellionLikelihood = ((newUnrest - controlCapacity) / Math.max(1, controlCapacity)) * 50;
    }

    // Rebellious factions add directly to likelihood
    const rebelliousFactions = factions.filter((f) => f.rebellionRisk > 50);
    rebellionLikelihood += rebelliousFactions.length * 15;

    // Military absent (at war elsewhere) - harder to suppress
    if (isAtWar && territory.military < 40) {
      rebellionLikelihood += 20;
    }

    // Low happiness contributes independently
    if (territory.happiness < 30) {
      rebellionLikelihood += 15;
    }

    rebellionLikelihood = Math.round(Math.min(100, rebellionLikelihood));

    // =============================================
    // BUILD COUNTDOWNS (NATURAL ESTIMATES)
    // =============================================

    const countdowns: Array<{ type: string; label: string; ticksRemaining: number }> = [];

    // Old ruler countdown - based on age
    if (ruler && ruler.age > 60) {
      const yearsRemaining = Math.max(1, 85 - ruler.age);
      countdowns.push({
        type: "ruler_death",
        label: `${ruler.name}'s reign may end`,
        ticksRemaining: yearsRemaining * 12, // Months
      });
    }

    // Famine countdown - based on food per capita consumption rate
    if (foodPerCapita < 1.0) {
      // Estimate ticks until starvation based on food consumption
      const consumptionPerTick = territory.population * FOOD_REQUIREMENT_PER_PERSON;
      const ticksUntilOut = Math.max(1, Math.floor(territory.food / consumptionPerTick));
      countdowns.push({
        type: "famine",
        label: foodPerCapita < 0.5 ? "Famine ongoing" : "Food shortage developing",
        ticksRemaining: ticksUntilOut,
      });
    }

    // Unrest countdown - based on unrest accumulation rate
    if (newUnrest > controlCapacity * 0.7 && happinessDeficit > 0) {
      const ticksToRebellion = Math.max(1, Math.floor((controlCapacity - newUnrest) / (happinessDeficit * 0.1)));
      countdowns.push({
        type: "rebellion",
        label: "Civil unrest building",
        ticksRemaining: Math.max(1, ticksToRebellion),
      });
    }

    // War exhaustion countdown
    const exhaustedWars = relationships.filter(
      (r) => r.status === "at_war" && (r.warExhaustion || 0) > 70
    );
    if (exhaustedWars.length > 0) {
      const exhaustion = exhaustedWars[0].warExhaustion || 70;
      countdowns.push({
        type: "war_exhaustion",
        label: "War exhaustion critical",
        ticksRemaining: Math.max(1, Math.floor((100 - exhaustion) / 2)),
      });
    }

    // =============================================
    // SAVE TENSION INDICATORS
    // =============================================

    // Delete old indicator for this territory
    const oldIndicator = await ctx.db
      .query("tensionIndicators")
      .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
      .first();

    if (oldIndicator) {
      await ctx.db.delete(oldIndicator._id);
    }

    await ctx.db.insert("tensionIndicators", {
      territoryId: territoryId,
      tick: tick,
      warLikelihood,
      coupLikelihood,
      famineLikelihood,
      successionCrisisLikelihood,
      rebellionLikelihood,
      countdowns,
      brewingConflicts,
    });

}

// =============================================
// QUERIES
// =============================================

export const getTensionIndicators = query({
  args: { territoryId: v.id("territories") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("tensionIndicators")
      .withIndex("by_territory", (q) => q.eq("territoryId", args.territoryId))
      .first();
  },
});

export const getAllTensionIndicators = query({
  args: {},
  handler: async (ctx) => {
    const territories = await ctx.db.query("territories").collect();
    const results: Array<{
      territoryId: Id<"territories">;
      territoryName: string;
      indicators: Doc<"tensionIndicators"> | null;
    }> = [];

    for (const territory of territories) {
      const indicators = await ctx.db
        .query("tensionIndicators")
        .withIndex("by_territory", (q) => q.eq("territoryId", territory._id))
        .first();

      results.push({
        territoryId: territory._id,
        territoryName: territory.name,
        indicators,
      });
    }

    return results;
  },
});

export const getHighestTensions = query({
  args: {},
  handler: async (ctx) => {
    const territories = await ctx.db.query("territories").collect();
    const tensions: Array<{
      territoryName: string;
      type: string;
      likelihood: number;
    }> = [];

    for (const territory of territories) {
      const indicators = await ctx.db
        .query("tensionIndicators")
        .withIndex("by_territory", (q) => q.eq("territoryId", territory._id))
        .first();

      if (indicators) {
        if (indicators.warLikelihood >= 50) {
          tensions.push({
            territoryName: territory.name,
            type: "War",
            likelihood: indicators.warLikelihood,
          });
        }
        if (indicators.coupLikelihood >= 50) {
          tensions.push({
            territoryName: territory.name,
            type: "Coup",
            likelihood: indicators.coupLikelihood,
          });
        }
        if (indicators.famineLikelihood >= 50) {
          tensions.push({
            territoryName: territory.name,
            type: "Famine",
            likelihood: indicators.famineLikelihood,
          });
        }
        if (indicators.successionCrisisLikelihood >= 50) {
          tensions.push({
            territoryName: territory.name,
            type: "Succession Crisis",
            likelihood: indicators.successionCrisisLikelihood,
          });
        }
        if (indicators.rebellionLikelihood >= 50) {
          tensions.push({
            territoryName: territory.name,
            type: "Rebellion",
            likelihood: indicators.rebellionLikelihood,
          });
        }
      }
    }

    return tensions.sort((a, b) => b.likelihood - a.likelihood);
  },
});
