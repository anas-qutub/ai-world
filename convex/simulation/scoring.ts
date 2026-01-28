import { Doc, Id } from "../_generated/dataModel";
import { MutationCtx, QueryCtx } from "../_generated/server";
import { getMilestonePoints } from "./milestones";

// =============================================
// VICTORY SCORING - Combines power, milestones, achievements
// =============================================

export interface VictoryScoreBreakdown {
  total: number;
  powerScore: number;
  milestonePoints: number;
  eraBonus: number;
  goldenAgeBonus: number;
  underdogBonus: number;
  statusPenalty: number; // Penalty for crisis/collapse
}

// Era bonuses for being first to reach each era
export const ERA_BONUSES: Record<string, number> = {
  stone_age: 0,
  bronze_age: 20,
  iron_age: 40,
  medieval: 60,
  renaissance: 80,
  industrial: 100,
  modern: 150,
  atomic: 200,
};

// Status modifiers
export const STATUS_MODIFIERS: Record<string, number> = {
  stable: 0,
  struggling: -10,
  prospering: 10,
  golden_age: 50,
  decadent: -20,
  crisis: -40,
  collapsing: -80,
  reforming: 5,
};

/**
 * Calculate total victory score including milestones and bonuses
 */
export async function calculateVictoryScore(
  ctx: QueryCtx | MutationCtx,
  territory: Doc<"territories">,
  relationships: Doc<"relationships">[]
): Promise<VictoryScoreBreakdown> {
  // Get base power score
  const powerBreakdown = await calculatePowerScore(ctx, territory, relationships);
  const powerScore = powerBreakdown.total;

  // Get milestone points
  const milestonePoints = await getMilestonePoints(ctx, territory._id);

  // Calculate era bonus based on current era
  const techs = await (ctx as QueryCtx).db
    .query("technologies")
    .withIndex("by_territory", (q) => q.eq("territoryId", territory._id))
    .collect();

  let currentEra = "stone_age";
  const eraOrder = ["stone_age", "bronze_age", "iron_age", "medieval", "renaissance", "industrial", "modern", "atomic"];

  for (const tech of techs.filter(t => t.researched)) {
    // Determine era from tech (would need to lookup tech tree)
    // For now, use a simplified check based on tech names
    if (tech.techId.includes("nuclear") || tech.techId.includes("computer") || tech.techId.includes("space")) {
      currentEra = "atomic";
    } else if (tech.techId.includes("electricity") || tech.techId.includes("combustion")) {
      if (eraOrder.indexOf("modern") > eraOrder.indexOf(currentEra)) currentEra = "modern";
    } else if (tech.techId.includes("steam") || tech.techId.includes("factory")) {
      if (eraOrder.indexOf("industrial") > eraOrder.indexOf(currentEra)) currentEra = "industrial";
    } else if (tech.techId.includes("printing") || tech.techId.includes("banking")) {
      if (eraOrder.indexOf("renaissance") > eraOrder.indexOf(currentEra)) currentEra = "renaissance";
    } else if (tech.techId.includes("feudal") || tech.techId.includes("castle")) {
      if (eraOrder.indexOf("medieval") > eraOrder.indexOf(currentEra)) currentEra = "medieval";
    } else if (tech.techId.includes("iron")) {
      if (eraOrder.indexOf("iron_age") > eraOrder.indexOf(currentEra)) currentEra = "iron_age";
    } else if (tech.techId.includes("bronze")) {
      if (eraOrder.indexOf("bronze_age") > eraOrder.indexOf(currentEra)) currentEra = "bronze_age";
    }
  }

  const eraBonus = ERA_BONUSES[currentEra] || 0;

  // Get rise and fall status for bonuses/penalties
  const riseAndFall = await (ctx as QueryCtx).db
    .query("riseAndFall")
    .withIndex("by_territory", (q) => q.eq("territoryId", territory._id))
    .first();

  const status = riseAndFall?.status || "stable";
  const statusPenalty = STATUS_MODIFIERS[status] || 0;

  // Golden age bonus
  const goldenAgeBonus = riseAndFall?.goldenAgeTicks && riseAndFall.goldenAgeTicks > 0 ? 50 : 0;

  // Underdog bonus (already calculated in rise and fall)
  const underdogBonus = riseAndFall?.underdogBonus || 0;

  const total = powerScore + milestonePoints + eraBonus + goldenAgeBonus + underdogBonus + statusPenalty;

  return {
    total: Math.round(total * 10) / 10,
    powerScore: Math.round(powerScore * 10) / 10,
    milestonePoints,
    eraBonus,
    goldenAgeBonus,
    underdogBonus,
    statusPenalty,
  };
}

/**
 * Get victory rankings for all territories
 */
export async function getVictoryRankings(
  ctx: QueryCtx | MutationCtx,
  territories: Doc<"territories">[],
  relationships: Doc<"relationships">[]
): Promise<Array<{
  rank: number;
  territoryId: Id<"territories">;
  territoryName: string;
  color: string;
  victoryScore: number;
  breakdown: VictoryScoreBreakdown;
  isEliminated: boolean;
}>> {
  const rankings = await Promise.all(
    territories.map(async (territory) => {
      const breakdown = await calculateVictoryScore(ctx, territory, relationships);

      return {
        rank: 0,
        territoryId: territory._id,
        territoryName: territory.tribeName || territory.name,
        color: territory.color,
        victoryScore: breakdown.total,
        breakdown,
        isEliminated: territory.isEliminated || false,
      };
    })
  );

  // Sort by victory score
  rankings.sort((a, b) => {
    if (a.isEliminated && !b.isEliminated) return 1;
    if (!a.isEliminated && b.isEliminated) return -1;
    return b.victoryScore - a.victoryScore;
  });

  // Assign ranks
  rankings.forEach((r, i) => { r.rank = i + 1; });

  return rankings;
}

// =============================================
// VICTORY CONDITIONS
// =============================================

export type VictoryType =
  | "domination"     // Eliminate all other civilizations
  | "science"        // Reach space program
  | "cultural"       // 500+ influence and 5+ world wonders
  | "economic"       // 1000+ wealth
  | "score"          // Highest score after certain ticks
  | "nuclear_survival"; // Survive nuclear war while others collapse

/**
 * Check if any civilization has achieved victory
 */
export async function checkVictoryConditions(
  ctx: QueryCtx,
  territories: Doc<"territories">[]
): Promise<{
  hasVictor: boolean;
  victor?: Id<"territories">;
  victoryType?: VictoryType;
  description?: string;
} | null> {
  const activeTerritories = territories.filter(t => !t.isEliminated);

  // Domination Victory - only one civilization left
  if (activeTerritories.length === 1) {
    return {
      hasVictor: true,
      victor: activeTerritories[0]._id,
      victoryType: "domination",
      description: `${activeTerritories[0].tribeName || activeTerritories[0].name} has achieved DOMINATION VICTORY by eliminating all rivals!`,
    };
  }

  for (const territory of activeTerritories) {
    // Science Victory - reached space program
    const hasSpaceProgram = await ctx.db
      .query("technologies")
      .withIndex("by_territory", (q) => q.eq("territoryId", territory._id))
      .filter((q) => q.and(
        q.eq(q.field("techId"), "space_program"),
        q.eq(q.field("researched"), true)
      ))
      .first();

    if (hasSpaceProgram) {
      return {
        hasVictor: true,
        victor: territory._id,
        victoryType: "science",
        description: `${territory.tribeName || territory.name} has achieved SCIENCE VICTORY by developing a space program!`,
      };
    }

    // Economic Victory - 1000+ wealth
    if (territory.wealth >= 1000) {
      return {
        hasVictor: true,
        victor: territory._id,
        victoryType: "economic",
        description: `${territory.tribeName || territory.name} has achieved ECONOMIC VICTORY with ${territory.wealth} wealth!`,
      };
    }

    // Cultural Victory - 500+ influence and high culture
    if (territory.influence >= 500 && territory.happiness >= 80) {
      return {
        hasVictor: true,
        victor: territory._id,
        victoryType: "cultural",
        description: `${territory.tribeName || territory.name} has achieved CULTURAL VICTORY with global cultural dominance!`,
      };
    }
  }

  return null;
}

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
