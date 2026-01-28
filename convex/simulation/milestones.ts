/**
 * Milestone Achievements System
 *
 * Track "First To" achievements that create memorable moments for viewers.
 * These are permanent achievements that show which civilization reached
 * important milestones first.
 */

import { Doc, Id } from "../_generated/dataModel";
import { MutationCtx, QueryCtx } from "../_generated/server";

// =============================================
// MILESTONE DEFINITIONS
// =============================================

export type MilestoneCategory =
  | "technology"
  | "population"
  | "military"
  | "culture"
  | "economy"
  | "wonder"
  | "era"
  | "government"
  | "religion"
  | "exploration";

export interface MilestoneDefinition {
  id: string;
  name: string;
  description: string;
  category: MilestoneCategory;
  points: number; // Victory points awarded
  icon: string; // Emoji for display
  // Condition checker - returns true if achieved
  checkCondition: (territory: Doc<"territories">, world: Doc<"world">, extras?: any) => boolean;
}

// All possible milestones
export const MILESTONES: MilestoneDefinition[] = [
  // =============================================
  // POPULATION MILESTONES
  // =============================================
  {
    id: "pop_100",
    name: "First Hundred",
    description: "First civilization to reach 100 population",
    category: "population",
    points: 10,
    icon: "👥",
    checkCondition: (t) => t.population >= 100,
  },
  {
    id: "pop_500",
    name: "Growing Nation",
    description: "First civilization to reach 500 population",
    category: "population",
    points: 25,
    icon: "🏘️",
    checkCondition: (t) => t.population >= 500,
  },
  {
    id: "pop_1000",
    name: "Mighty Empire",
    description: "First civilization to reach 1,000 population",
    category: "population",
    points: 50,
    icon: "🏙️",
    checkCondition: (t) => t.population >= 1000,
  },
  {
    id: "pop_5000",
    name: "Superpower",
    description: "First civilization to reach 5,000 population",
    category: "population",
    points: 100,
    icon: "🌆",
    checkCondition: (t) => t.population >= 5000,
  },

  // =============================================
  // TECHNOLOGY MILESTONES
  // =============================================
  {
    id: "tech_writing",
    name: "Dawn of History",
    description: "First civilization to discover Writing",
    category: "technology",
    points: 30,
    icon: "📜",
    checkCondition: (t, w, extras) => extras?.techs?.includes("writing"),
  },
  {
    id: "tech_bronze",
    name: "Bronze Age Pioneer",
    description: "First civilization to discover Bronze Working",
    category: "technology",
    points: 25,
    icon: "⚔️",
    checkCondition: (t, w, extras) => extras?.techs?.includes("bronze_working"),
  },
  {
    id: "tech_iron",
    name: "Iron Age Pioneer",
    description: "First civilization to discover Iron Working",
    category: "technology",
    points: 40,
    icon: "🗡️",
    checkCondition: (t, w, extras) => extras?.techs?.includes("iron_working"),
  },
  {
    id: "tech_gunpowder",
    name: "Explosive Discovery",
    description: "First civilization to discover Gunpowder",
    category: "technology",
    points: 60,
    icon: "💥",
    checkCondition: (t, w, extras) => extras?.techs?.includes("gunpowder"),
  },
  {
    id: "tech_printing",
    name: "Information Revolution",
    description: "First civilization to discover the Printing Press",
    category: "technology",
    points: 50,
    icon: "📰",
    checkCondition: (t, w, extras) => extras?.techs?.includes("printing_press"),
  },
  {
    id: "tech_steam",
    name: "Industrial Pioneer",
    description: "First civilization to discover Steam Power",
    category: "technology",
    points: 70,
    icon: "🚂",
    checkCondition: (t, w, extras) => extras?.techs?.includes("steam_power"),
  },
  {
    id: "tech_electricity",
    name: "Electric Dreams",
    description: "First civilization to discover Electricity",
    category: "technology",
    points: 80,
    icon: "⚡",
    checkCondition: (t, w, extras) => extras?.techs?.includes("electricity"),
  },
  {
    id: "tech_flight",
    name: "Conquest of the Skies",
    description: "First civilization to discover Flight",
    category: "technology",
    points: 90,
    icon: "✈️",
    checkCondition: (t, w, extras) => extras?.techs?.includes("flight"),
  },
  {
    id: "tech_nuclear",
    name: "Atomic Age",
    description: "First civilization to discover Nuclear Fission",
    category: "technology",
    points: 120,
    icon: "☢️",
    checkCondition: (t, w, extras) => extras?.techs?.includes("nuclear_fission"),
  },
  {
    id: "tech_computers",
    name: "Digital Revolution",
    description: "First civilization to discover Computers",
    category: "technology",
    points: 100,
    icon: "💻",
    checkCondition: (t, w, extras) => extras?.techs?.includes("computers"),
  },
  {
    id: "tech_space",
    name: "To the Stars",
    description: "First civilization to develop a Space Program",
    category: "technology",
    points: 150,
    icon: "🚀",
    checkCondition: (t, w, extras) => extras?.techs?.includes("space_program"),
  },

  // =============================================
  // ERA MILESTONES
  // =============================================
  {
    id: "era_bronze",
    name: "First Bronze Age Civilization",
    description: "First to enter the Bronze Age",
    category: "era",
    points: 30,
    icon: "🥉",
    checkCondition: (t, w, extras) => extras?.era === "bronze_age",
  },
  {
    id: "era_iron",
    name: "First Iron Age Civilization",
    description: "First to enter the Iron Age",
    category: "era",
    points: 45,
    icon: "🔩",
    checkCondition: (t, w, extras) => extras?.era === "iron_age",
  },
  {
    id: "era_medieval",
    name: "First Medieval Civilization",
    description: "First to enter the Medieval Era",
    category: "era",
    points: 60,
    icon: "🏰",
    checkCondition: (t, w, extras) => extras?.era === "medieval",
  },
  {
    id: "era_renaissance",
    name: "First Renaissance",
    description: "First to enter the Renaissance Era",
    category: "era",
    points: 80,
    icon: "🎨",
    checkCondition: (t, w, extras) => extras?.era === "renaissance",
  },
  {
    id: "era_industrial",
    name: "First Industrial Nation",
    description: "First to enter the Industrial Era",
    category: "era",
    points: 100,
    icon: "🏭",
    checkCondition: (t, w, extras) => extras?.era === "industrial",
  },
  {
    id: "era_modern",
    name: "First Modern Nation",
    description: "First to enter the Modern Era",
    category: "era",
    points: 120,
    icon: "🌐",
    checkCondition: (t, w, extras) => extras?.era === "modern",
  },
  {
    id: "era_atomic",
    name: "First Atomic Power",
    description: "First to enter the Atomic Era",
    category: "era",
    points: 150,
    icon: "⚛️",
    checkCondition: (t, w, extras) => extras?.era === "atomic",
  },

  // =============================================
  // MILITARY MILESTONES
  // =============================================
  {
    id: "mil_first_war",
    name: "First Blood",
    description: "First civilization to declare war",
    category: "military",
    points: 5,
    icon: "⚔️",
    checkCondition: (t, w, extras) => extras?.declaredWar === true,
  },
  {
    id: "mil_first_victory",
    name: "Conqueror",
    description: "First civilization to win a war",
    category: "military",
    points: 30,
    icon: "🏆",
    checkCondition: (t, w, extras) => extras?.warsWon >= 1,
  },
  {
    id: "mil_great_general",
    name: "Great General",
    description: "First civilization to win 5 wars",
    category: "military",
    points: 75,
    icon: "🎖️",
    checkCondition: (t, w, extras) => extras?.warsWon >= 5,
  },
  {
    id: "mil_undefeated",
    name: "Undefeated",
    description: "Win 10 wars without losing any",
    category: "military",
    points: 100,
    icon: "👑",
    checkCondition: (t, w, extras) => extras?.warsWon >= 10 && extras?.warsLost === 0,
  },
  {
    id: "mil_nuclear_armed",
    name: "Nuclear Armed",
    description: "First civilization to build nuclear weapons",
    category: "military",
    points: 100,
    icon: "☢️",
    checkCondition: (t, w, extras) => extras?.hasNukes === true,
  },
  {
    id: "mil_first_strike",
    name: "First Strike",
    description: "First civilization to use nuclear weapons",
    category: "military",
    points: 50,
    icon: "💀",
    checkCondition: (t, w, extras) => extras?.usedNukes === true,
  },

  // =============================================
  // CULTURE MILESTONES
  // =============================================
  {
    id: "culture_religion",
    name: "Divine Inspiration",
    description: "First civilization to found a religion",
    category: "religion",
    points: 30,
    icon: "🙏",
    checkCondition: (t, w, extras) => extras?.hasReligion === true,
  },
  {
    id: "culture_world_religion",
    name: "World Religion",
    description: "Spread religion to 3+ other civilizations",
    category: "religion",
    points: 75,
    icon: "✝️",
    checkCondition: (t, w, extras) => extras?.religionSpread >= 3,
  },
  {
    id: "culture_university",
    name: "Seat of Learning",
    description: "First civilization to build a university",
    category: "culture",
    points: 40,
    icon: "🎓",
    checkCondition: (t, w, extras) => extras?.hasUniversity === true,
  },
  {
    id: "culture_golden_age",
    name: "Golden Age",
    description: "First civilization to enter a Golden Age",
    category: "culture",
    points: 50,
    icon: "✨",
    checkCondition: (t, w, extras) => extras?.inGoldenAge === true,
  },

  // =============================================
  // ECONOMY MILESTONES
  // =============================================
  {
    id: "econ_trade",
    name: "Merchant Nation",
    description: "First civilization to establish 3 trade routes",
    category: "economy",
    points: 25,
    icon: "🛒",
    checkCondition: (t, w, extras) => extras?.tradeRoutes >= 3,
  },
  {
    id: "econ_wealth_100",
    name: "Prosperous",
    description: "First civilization to accumulate 100 wealth",
    category: "economy",
    points: 20,
    icon: "💰",
    checkCondition: (t) => t.wealth >= 100,
  },
  {
    id: "econ_wealth_500",
    name: "Rich Nation",
    description: "First civilization to accumulate 500 wealth",
    category: "economy",
    points: 50,
    icon: "💎",
    checkCondition: (t) => t.wealth >= 500,
  },
  {
    id: "econ_banking",
    name: "Banking Empire",
    description: "First civilization to develop banking",
    category: "economy",
    points: 45,
    icon: "🏦",
    checkCondition: (t, w, extras) => extras?.techs?.includes("banking"),
  },

  // =============================================
  // GOVERNMENT MILESTONES
  // =============================================
  {
    id: "gov_democracy",
    name: "Voice of the People",
    description: "First civilization to establish democracy",
    category: "government",
    points: 40,
    icon: "🗳️",
    checkCondition: (t) => t.governance === "democracy",
  },
  {
    id: "gov_empire",
    name: "Empire Builder",
    description: "First civilization to establish an empire",
    category: "government",
    points: 35,
    icon: "👑",
    checkCondition: (t) => t.governance === "dictatorship" && t.population >= 200,
  },
  {
    id: "gov_theocracy",
    name: "Divine Right",
    description: "First civilization to establish a theocracy",
    category: "government",
    points: 30,
    icon: "⛪",
    checkCondition: (t) => t.governance === "theocracy",
  },

  // =============================================
  // WONDER MILESTONES
  // =============================================
  {
    id: "wonder_monument",
    name: "Monument Builder",
    description: "First civilization to build a grand monument",
    category: "wonder",
    points: 60,
    icon: "🗿",
    checkCondition: (t, w, extras) => extras?.hasMonument === true,
  },
  {
    id: "wonder_castle",
    name: "Castle Builder",
    description: "First civilization to build a castle",
    category: "wonder",
    points: 50,
    icon: "🏰",
    checkCondition: (t, w, extras) => extras?.hasCastle === true,
  },
];

// Map for quick lookup
export const MILESTONE_MAP = new Map<string, MilestoneDefinition>(
  MILESTONES.map(m => [m.id, m])
);

// =============================================
// MILESTONE CHECKING & AWARDING
// =============================================

/**
 * Check all milestones for a territory and award any newly achieved ones
 */
export async function checkAndAwardMilestones(
  ctx: MutationCtx,
  territory: Doc<"territories">,
  world: Doc<"world">,
  tick: number,
  extras?: {
    techs?: string[];
    era?: string;
    declaredWar?: boolean;
    warsWon?: number;
    warsLost?: number;
    hasNukes?: boolean;
    usedNukes?: boolean;
    hasReligion?: boolean;
    religionSpread?: number;
    hasUniversity?: boolean;
    inGoldenAge?: boolean;
    tradeRoutes?: number;
    hasMonument?: boolean;
    hasCastle?: boolean;
  }
): Promise<string[]> {
  const newlyAchieved: string[] = [];

  // Get all milestones already achieved by ANY territory
  const allAchievedMilestones = await ctx.db
    .query("milestones")
    .collect();

  const achievedMilestoneIds = new Set(allAchievedMilestones.map(m => m.milestoneId));

  // Check each milestone that hasn't been achieved yet
  for (const milestone of MILESTONES) {
    // Skip if already achieved by someone
    if (achievedMilestoneIds.has(milestone.id)) continue;

    // Check if this territory meets the condition
    try {
      if (milestone.checkCondition(territory, world, extras)) {
        // Award the milestone!
        await ctx.db.insert("milestones", {
          milestoneId: milestone.id,
          territoryId: territory._id,
          territoryName: territory.tribeName || territory.name,
          achievedAtTick: tick,
          achievedAtYear: world.year,
          points: milestone.points,
          category: milestone.category,
        });

        newlyAchieved.push(milestone.id);

        // Create event for this achievement
        await ctx.db.insert("events", {
          tick,
          type: "milestone",
          territoryId: territory._id,
          title: `${milestone.icon} ${milestone.name}`,
          description: `${territory.tribeName || territory.name} has achieved "${milestone.name}": ${milestone.description}! (+${milestone.points} victory points)`,
          severity: "positive",
          createdAt: Date.now(),
        });
      }
    } catch (e) {
      // Condition check failed, skip this milestone
      console.error(`Error checking milestone ${milestone.id}:`, e);
    }
  }

  return newlyAchieved;
}

/**
 * Get all milestones with their status (achieved or not)
 */
export async function getMilestoneStatus(
  ctx: QueryCtx
): Promise<Array<{
  milestone: MilestoneDefinition;
  achieved: boolean;
  achievedBy?: string;
  achievedAtTick?: number;
  achievedAtYear?: number;
}>> {
  const achievedMilestones = await ctx.db.query("milestones").collect();
  const achievedMap = new Map(achievedMilestones.map(m => [m.milestoneId, m]));

  return MILESTONES.map(milestone => {
    const achieved = achievedMap.get(milestone.id);
    return {
      milestone,
      achieved: !!achieved,
      achievedBy: achieved?.territoryName,
      achievedAtTick: achieved?.achievedAtTick,
      achievedAtYear: achieved?.achievedAtYear,
    };
  });
}

/**
 * Get milestone points total for a territory
 */
export async function getMilestonePoints(
  ctx: QueryCtx,
  territoryId: Id<"territories">
): Promise<number> {
  const milestones = await ctx.db
    .query("milestones")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .collect();

  return milestones.reduce((sum, m) => sum + m.points, 0);
}

/**
 * Get milestone leaderboard
 */
export async function getMilestoneLeaderboard(
  ctx: QueryCtx
): Promise<Array<{
  territoryId: Id<"territories">;
  territoryName: string;
  milestoneCount: number;
  totalPoints: number;
  milestones: string[];
}>> {
  const allMilestones = await ctx.db.query("milestones").collect();

  // Group by territory
  const byTerritory = new Map<string, {
    territoryId: Id<"territories">;
    territoryName: string;
    milestones: string[];
    totalPoints: number;
  }>();

  for (const m of allMilestones) {
    const key = m.territoryId.toString();
    if (!byTerritory.has(key)) {
      byTerritory.set(key, {
        territoryId: m.territoryId,
        territoryName: m.territoryName,
        milestones: [],
        totalPoints: 0,
      });
    }
    const entry = byTerritory.get(key)!;
    entry.milestones.push(m.milestoneId);
    entry.totalPoints += m.points;
  }

  // Convert to array and sort by points
  return Array.from(byTerritory.values())
    .map(t => ({
      ...t,
      milestoneCount: t.milestones.length,
    }))
    .sort((a, b) => b.totalPoints - a.totalPoints);
}

/**
 * Get recent milestone achievements (for news feed)
 */
export async function getRecentMilestones(
  ctx: QueryCtx,
  limit: number = 10
): Promise<Doc<"milestones">[]> {
  return await ctx.db
    .query("milestones")
    .order("desc")
    .take(limit);
}
