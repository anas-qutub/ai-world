import { Doc, Id } from "../_generated/dataModel";
import { MutationCtx } from "../_generated/server";

// Victory condition thresholds
export const VICTORY_THRESHOLDS = {
  DOMINATION_POPULATION_PERCENT: 60,  // Control 60%+ of total world population
  ELIMINATION_MIN_POPULATION: 5,      // Below this for X ticks = eliminated
  ELIMINATION_TICK_THRESHOLD: 12,     // Consecutive ticks below min pop to be eliminated
  CULTURAL_INFLUENCE: 200,            // Reach 200+ influence
  SCIENTIFIC_TECHNOLOGY: 150,         // Reach 150+ technology
};

export type VictoryType = "domination" | "elimination" | "cultural" | "scientific";

export interface VictoryCheckResult {
  hasWinner: boolean;
  victoryType?: VictoryType;
  winnerId?: Id<"territories">;
  winnerName?: string;
  description?: string;
}

export interface EliminationResult {
  eliminated: boolean;
  territoryId?: Id<"territories">;
  territoryName?: string;
  description?: string;
}

/**
 * Check if any territory has achieved a victory condition
 */
export async function checkVictoryConditions(
  ctx: MutationCtx,
  territories: Doc<"territories">[],
  tick: number
): Promise<VictoryCheckResult> {
  // Filter out already eliminated territories
  const activeTerritories = territories.filter(t => !t.isEliminated);

  // 1. Check ELIMINATION victory - last one standing
  if (activeTerritories.length === 1) {
    const winner = activeTerritories[0];
    return {
      hasWinner: true,
      victoryType: "elimination",
      winnerId: winner._id,
      winnerName: winner.tribeName || winner.name,
      description: `${winner.tribeName || winner.name} has achieved ELIMINATION VICTORY! They are the last civilization standing.`,
    };
  }

  // 2. Check DOMINATION victory - 60%+ of total population
  const totalPopulation = activeTerritories.reduce((sum, t) => sum + t.population, 0);
  for (const territory of activeTerritories) {
    const populationPercent = (territory.population / totalPopulation) * 100;
    if (populationPercent >= VICTORY_THRESHOLDS.DOMINATION_POPULATION_PERCENT) {
      return {
        hasWinner: true,
        victoryType: "domination",
        winnerId: territory._id,
        winnerName: territory.tribeName || territory.name,
        description: `${territory.tribeName || territory.name} has achieved DOMINATION VICTORY! They control ${populationPercent.toFixed(1)}% of the world's population.`,
      };
    }
  }

  // 3. Check CULTURAL victory - 200+ influence
  for (const territory of activeTerritories) {
    if (territory.influence >= VICTORY_THRESHOLDS.CULTURAL_INFLUENCE) {
      return {
        hasWinner: true,
        victoryType: "cultural",
        winnerId: territory._id,
        winnerName: territory.tribeName || territory.name,
        description: `${territory.tribeName || territory.name} has achieved CULTURAL VICTORY! Their influence (${territory.influence}) has spread across the world.`,
      };
    }
  }

  // 4. Check SCIENTIFIC victory - 150+ technology
  for (const territory of activeTerritories) {
    if (territory.technology >= VICTORY_THRESHOLDS.SCIENTIFIC_TECHNOLOGY) {
      return {
        hasWinner: true,
        victoryType: "scientific",
        winnerId: territory._id,
        winnerName: territory.tribeName || territory.name,
        description: `${territory.tribeName || territory.name} has achieved SCIENTIFIC VICTORY! Their technology (${territory.technology}) has revolutionized the world.`,
      };
    }
  }

  // No winner yet
  return { hasWinner: false };
}

/**
 * Check if any territory should be eliminated (population < 5 for 12 consecutive ticks)
 */
export async function checkElimination(
  ctx: MutationCtx,
  territories: Doc<"territories">[],
  tick: number
): Promise<EliminationResult[]> {
  const eliminations: EliminationResult[] = [];

  for (const territory of territories) {
    // Skip already eliminated territories
    if (territory.isEliminated) continue;

    const currentStreak = territory.lowPopulationStreak || 0;

    if (territory.population < VICTORY_THRESHOLDS.ELIMINATION_MIN_POPULATION) {
      // Increment streak
      const newStreak = currentStreak + 1;

      if (newStreak >= VICTORY_THRESHOLDS.ELIMINATION_TICK_THRESHOLD) {
        // ELIMINATED!
        await ctx.db.patch(territory._id, {
          isEliminated: true,
          eliminatedAtTick: tick,
          lowPopulationStreak: newStreak,
        });

        eliminations.push({
          eliminated: true,
          territoryId: territory._id,
          territoryName: territory.tribeName || territory.name,
          description: `${territory.tribeName || territory.name} has been ELIMINATED! Their population dwindled below ${VICTORY_THRESHOLDS.ELIMINATION_MIN_POPULATION} for ${newStreak} consecutive months.`,
        });

        // Distribute their resources to neighbors (simplified: just log it)
        await distributeEliminatedResources(ctx, territory, tick);
      } else {
        // Update streak
        await ctx.db.patch(territory._id, {
          lowPopulationStreak: newStreak,
        });
      }
    } else {
      // Population recovered, reset streak
      if (currentStreak > 0) {
        await ctx.db.patch(territory._id, {
          lowPopulationStreak: 0,
        });
      }
    }
  }

  return eliminations;
}

/**
 * Distribute eliminated territory's resources to neighbors
 */
async function distributeEliminatedResources(
  ctx: MutationCtx,
  eliminatedTerritory: Doc<"territories">,
  tick: number
): Promise<void> {
  // Get all active territories (potential beneficiaries)
  const allTerritories = await ctx.db.query("territories").collect();
  const activeTerritories = allTerritories.filter(
    t => !t.isEliminated && t._id !== eliminatedTerritory._id
  );

  if (activeTerritories.length === 0) return;

  // Distribute resources evenly (simplified)
  const shareCount = activeTerritories.length;
  const wealthShare = Math.floor(eliminatedTerritory.wealth / shareCount);
  const techShare = Math.floor(eliminatedTerritory.technology / (shareCount * 2)); // Slower tech spread
  const influenceShare = Math.floor(eliminatedTerritory.influence / (shareCount * 2));

  for (const territory of activeTerritories) {
    await ctx.db.patch(territory._id, {
      wealth: territory.wealth + wealthShare,
      technology: territory.technology + techShare,
      influence: territory.influence + influenceShare,
    });
  }

  // Log the resource distribution
  await ctx.db.insert("events", {
    tick,
    type: "system",
    territoryId: eliminatedTerritory._id,
    title: `${eliminatedTerritory.tribeName || eliminatedTerritory.name} Falls`,
    description: `The fall of ${eliminatedTerritory.tribeName || eliminatedTerritory.name} has left their lands open. Neighboring civilizations absorb their remaining resources: ${wealthShare} wealth, ${techShare} technology, ${influenceShare} influence each.`,
    severity: "critical",
    createdAt: Date.now(),
  });
}

/**
 * End the match and record final results
 */
export async function endMatch(
  ctx: MutationCtx,
  match: Doc<"matches">,
  victoryResult: VictoryCheckResult,
  territories: Doc<"territories">[],
  tick: number
): Promise<void> {
  // Calculate final scores for all territories
  const { calculatePowerScore } = await import("./scoring");
  const relationships = await ctx.db.query("relationships").collect();

  const finalScores = await Promise.all(
    territories.map(async (t) => {
      const powerScore = await calculatePowerScore(ctx, t, relationships);
      return {
        territoryId: t._id,
        territoryName: t.tribeName || t.name,
        powerScore: powerScore.total,
        population: t.population,
        military: t.military,
        wealth: t.wealth,
        technology: t.technology,
        influence: t.influence,
        knowledge: t.knowledge,
        happiness: t.happiness,
        rank: 0, // Will be filled after sorting
        wasEliminated: t.isEliminated || false,
      };
    })
  );

  // Sort by power score and assign ranks
  finalScores.sort((a, b) => b.powerScore - a.powerScore);
  finalScores.forEach((score, index) => {
    score.rank = index + 1;
  });

  // Update the match record
  await ctx.db.patch(match._id, {
    endTick: tick,
    status: "ended",
    victoryType: victoryResult.victoryType,
    winnerId: victoryResult.winnerId,
    winnerName: victoryResult.winnerName,
    finalScores,
    matchNarrative: victoryResult.description,
  });

  // Create victory event
  await ctx.db.insert("events", {
    tick,
    type: "system",
    territoryId: victoryResult.winnerId,
    title: `VICTORY: ${victoryResult.winnerName}`,
    description: victoryResult.description || "A civilization has achieved victory!",
    severity: "critical",
    createdAt: Date.now(),
  });
}

/**
 * Start a new match
 */
export async function startMatch(
  ctx: MutationCtx,
  tick: number
): Promise<Id<"matches">> {
  // Check if there's already a running match
  const existingMatch = await ctx.db
    .query("matches")
    .withIndex("by_status", (q) => q.eq("status", "running"))
    .first();

  if (existingMatch) {
    return existingMatch._id;
  }

  // Create new match
  const matchId = await ctx.db.insert("matches", {
    startTick: tick,
    status: "running",
    keyMoments: [],
  });

  return matchId;
}

/**
 * Record a key moment in the match
 */
export async function recordKeyMoment(
  ctx: MutationCtx,
  title: string,
  description: string,
  tick: number
): Promise<void> {
  const match = await ctx.db
    .query("matches")
    .withIndex("by_status", (q) => q.eq("status", "running"))
    .first();

  if (!match) return;

  const keyMoments = match.keyMoments || [];
  keyMoments.push({ tick, title, description });

  // Keep only the last 50 key moments
  const trimmedMoments = keyMoments.slice(-50);

  await ctx.db.patch(match._id, {
    keyMoments: trimmedMoments,
  });
}

/**
 * Get victory progress for all territories
 */
export function getVictoryProgress(
  territories: Doc<"territories">[]
): Array<{
  territoryId: Id<"territories">;
  territoryName: string;
  domination: number;
  cultural: number;
  scientific: number;
  eliminationRisk: number;
}> {
  const activeTerritories = territories.filter(t => !t.isEliminated);
  const totalPopulation = activeTerritories.reduce((sum, t) => sum + t.population, 0);

  return territories.map(t => ({
    territoryId: t._id,
    territoryName: t.tribeName || t.name,
    // Domination progress: current population % vs 60% threshold
    domination: totalPopulation > 0
      ? Math.min(100, ((t.population / totalPopulation) * 100 / VICTORY_THRESHOLDS.DOMINATION_POPULATION_PERCENT) * 100)
      : 0,
    // Cultural progress: current influence vs 200 threshold
    cultural: Math.min(100, (t.influence / VICTORY_THRESHOLDS.CULTURAL_INFLUENCE) * 100),
    // Scientific progress: current tech vs 150 threshold
    scientific: Math.min(100, (t.technology / VICTORY_THRESHOLDS.SCIENTIFIC_TECHNOLOGY) * 100),
    // Elimination risk: how close to being eliminated
    eliminationRisk: t.population < VICTORY_THRESHOLDS.ELIMINATION_MIN_POPULATION
      ? ((t.lowPopulationStreak || 0) / VICTORY_THRESHOLDS.ELIMINATION_TICK_THRESHOLD) * 100
      : 0,
  }));
}
