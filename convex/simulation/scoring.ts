import { Doc, Id } from "../_generated/dataModel";
import { MutationCtx, QueryCtx } from "../_generated/server";

// Power Score Weights
export const POWER_SCORE_WEIGHTS = {
  population: 2.0,      // Raw population matters most
  military: 1.5,        // Military strength
  wealth: 1.0,          // Economic power
  technology: 1.5,      // Tech advantage
  influence: 1.0,       // Cultural reach
  knowledge: 0.5,       // Wisdom
  happiness: 0.5,       // Stability
  allianceBonus: 10,    // Per ally
};

export interface PowerScoreBreakdown {
  total: number;
  populationScore: number;
  militaryScore: number;
  wealthScore: number;
  technologyScore: number;
  influenceScore: number;
  knowledgeScore: number;
  happinessScore: number;
  allianceBonus: number;
  allyCount: number;
}

export interface PowerRanking {
  rank: number;
  territoryId: Id<"territories">;
  territoryName: string;
  color: string;
  powerScore: number;
  breakdown: PowerScoreBreakdown;
  previousRank?: number;
  rankChange?: number;
  isEliminated: boolean;
}

/**
 * Calculate power score for a single territory
 */
export async function calculatePowerScore(
  ctx: QueryCtx | MutationCtx,
  territory: Doc<"territories">,
  relationships: Doc<"relationships">[]
): Promise<PowerScoreBreakdown> {
  // Count alliances for this territory
  const allyCount = relationships.filter(
    r =>
      r.hasAlliance &&
      (r.territory1Id === territory._id || r.territory2Id === territory._id)
  ).length;

  // Calculate individual scores
  const populationScore = territory.population * POWER_SCORE_WEIGHTS.population;
  const militaryScore = territory.military * POWER_SCORE_WEIGHTS.military;
  const wealthScore = territory.wealth * POWER_SCORE_WEIGHTS.wealth;
  const technologyScore = territory.technology * POWER_SCORE_WEIGHTS.technology;
  const influenceScore = territory.influence * POWER_SCORE_WEIGHTS.influence;
  const knowledgeScore = territory.knowledge * POWER_SCORE_WEIGHTS.knowledge;
  const happinessScore = territory.happiness * POWER_SCORE_WEIGHTS.happiness;
  const allianceBonus = allyCount * POWER_SCORE_WEIGHTS.allianceBonus;

  const total =
    populationScore +
    militaryScore +
    wealthScore +
    technologyScore +
    influenceScore +
    knowledgeScore +
    happinessScore +
    allianceBonus;

  return {
    total: Math.round(total * 10) / 10,
    populationScore: Math.round(populationScore * 10) / 10,
    militaryScore: Math.round(militaryScore * 10) / 10,
    wealthScore: Math.round(wealthScore * 10) / 10,
    technologyScore: Math.round(technologyScore * 10) / 10,
    influenceScore: Math.round(influenceScore * 10) / 10,
    knowledgeScore: Math.round(knowledgeScore * 10) / 10,
    happinessScore: Math.round(happinessScore * 10) / 10,
    allianceBonus: Math.round(allianceBonus * 10) / 10,
    allyCount,
  };
}

/**
 * Get power rankings for all territories
 */
export async function getPowerRankings(
  ctx: QueryCtx | MutationCtx,
  territories: Doc<"territories">[],
  relationships: Doc<"relationships">[],
  previousRankings?: Map<string, number>
): Promise<PowerRanking[]> {
  // Calculate scores for all territories
  const rankings: PowerRanking[] = await Promise.all(
    territories.map(async (territory) => {
      const breakdown = await calculatePowerScore(ctx, territory, relationships);

      return {
        rank: 0, // Will be assigned after sorting
        territoryId: territory._id,
        territoryName: territory.tribeName || territory.name,
        color: territory.color,
        powerScore: breakdown.total,
        breakdown,
        isEliminated: territory.isEliminated || false,
      };
    })
  );

  // Sort by power score (eliminated territories go to bottom)
  rankings.sort((a, b) => {
    if (a.isEliminated && !b.isEliminated) return 1;
    if (!a.isEliminated && b.isEliminated) return -1;
    return b.powerScore - a.powerScore;
  });

  // Assign ranks and calculate rank changes
  rankings.forEach((ranking, index) => {
    ranking.rank = index + 1;

    if (previousRankings) {
      const prevRank = previousRankings.get(ranking.territoryId.toString());
      if (prevRank !== undefined) {
        ranking.previousRank = prevRank;
        ranking.rankChange = prevRank - ranking.rank; // Positive = moved up
      }
    }
  });

  return rankings;
}

/**
 * Record power scores for history tracking
 */
export async function recordPowerScores(
  ctx: MutationCtx,
  tick: number
): Promise<void> {
  const territories = await ctx.db.query("territories").collect();
  const relationships = await ctx.db.query("relationships").collect();

  for (const territory of territories) {
    // Skip eliminated territories
    if (territory.isEliminated) continue;

    const breakdown = await calculatePowerScore(ctx, territory, relationships);

    await ctx.db.insert("powerScoreHistory", {
      tick,
      territoryId: territory._id,
      territoryName: territory.tribeName || territory.name,
      powerScore: breakdown.total,
      populationScore: breakdown.populationScore,
      militaryScore: breakdown.militaryScore,
      wealthScore: breakdown.wealthScore,
      technologyScore: breakdown.technologyScore,
      influenceScore: breakdown.influenceScore,
      knowledgeScore: breakdown.knowledgeScore,
      happinessScore: breakdown.happinessScore,
      allianceBonus: breakdown.allianceBonus,
    });
  }
}

/**
 * Get power score history for a territory (for graphs)
 */
export async function getPowerScoreHistory(
  ctx: QueryCtx,
  territoryId: Id<"territories">,
  limit: number = 100
): Promise<Doc<"powerScoreHistory">[]> {
  return await ctx.db
    .query("powerScoreHistory")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .order("desc")
    .take(limit);
}

/**
 * Get the current leader (highest power score)
 */
export async function getCurrentLeader(
  ctx: QueryCtx | MutationCtx
): Promise<PowerRanking | null> {
  const territories = await ctx.db.query("territories").collect();
  const relationships = await ctx.db.query("relationships").collect();

  const rankings = await getPowerRankings(ctx, territories, relationships);

  return rankings.length > 0 ? rankings[0] : null;
}

/**
 * Get lead changes count (for stats)
 */
export async function getLeadChanges(
  ctx: QueryCtx,
  sinceTicksAgo: number = 100
): Promise<number> {
  const world = await ctx.db.query("world").first();
  if (!world) return 0;

  const minTick = Math.max(0, world.tick - sinceTicksAgo);

  // Get all power score history since minTick
  const history = await ctx.db
    .query("powerScoreHistory")
    .withIndex("by_tick")
    .filter((q) => q.gte(q.field("tick"), minTick))
    .collect();

  if (history.length === 0) return 0;

  // Group by tick
  const tickGroups = new Map<number, Doc<"powerScoreHistory">[]>();
  for (const record of history) {
    const tick = record.tick;
    if (!tickGroups.has(tick)) {
      tickGroups.set(tick, []);
    }
    tickGroups.get(tick)!.push(record);
  }

  // Count lead changes
  let leadChanges = 0;
  let previousLeader: string | null = null;

  const sortedTicks = Array.from(tickGroups.keys()).sort((a, b) => a - b);
  for (const tick of sortedTicks) {
    const records = tickGroups.get(tick)!;
    // Find the leader for this tick
    const leader = records.reduce((max, r) =>
      r.powerScore > max.powerScore ? r : max
    );

    if (previousLeader !== null && leader.territoryId.toString() !== previousLeader) {
      leadChanges++;
    }
    previousLeader = leader.territoryId.toString();
  }

  return leadChanges;
}

/**
 * Get competition stats summary
 */
export async function getCompetitionStats(
  ctx: QueryCtx
): Promise<{
  leadChanges: number;
  closestRace: { first: string; second: string; gap: number } | null;
  dominantCategory: Record<string, string>;
  eliminatedCount: number;
}> {
  const territories = await ctx.db.query("territories").collect();
  const relationships = await ctx.db.query("relationships").collect();

  const rankings = await getPowerRankings(ctx, territories, relationships);

  // Find closest race (difference between 1st and 2nd)
  let closestRace = null;
  const activeRankings = rankings.filter((r) => !r.isEliminated);
  if (activeRankings.length >= 2) {
    closestRace = {
      first: activeRankings[0].territoryName,
      second: activeRankings[1].territoryName,
      gap: Math.round(
        (activeRankings[0].powerScore - activeRankings[1].powerScore) * 10
      ) / 10,
    };
  }

  // Find who's dominant in each category
  const dominantCategory: Record<string, string> = {};
  const categories = [
    "population",
    "military",
    "wealth",
    "technology",
    "influence",
    "knowledge",
    "happiness",
  ] as const;

  for (const category of categories) {
    const leader = territories
      .filter((t) => !t.isEliminated)
      .reduce((max, t) => (t[category] > max[category] ? t : max));
    dominantCategory[category] = leader.tribeName || leader.name;
  }

  // Count eliminated
  const eliminatedCount = territories.filter((t) => t.isEliminated).length;

  // Get lead changes
  const leadChanges = await getLeadChanges(ctx);

  return {
    leadChanges,
    closestRace,
    dominantCategory,
    eliminatedCount,
  };
}
