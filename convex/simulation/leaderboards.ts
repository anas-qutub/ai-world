import { internalMutation, query, MutationCtx } from "../_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "../_generated/dataModel";

// =============================================
// LEADERBOARD CATEGORIES
// =============================================

export const LEADERBOARD_CATEGORIES = [
  "population",
  "military",
  "wealth",
  "technology",
  "happiness",
  "influence",
  "knowledge",
] as const;

type LeaderboardCategory = typeof LEADERBOARD_CATEGORIES[number];

// =============================================
// UPDATE LEADERBOARDS
// =============================================

export async function updateLeaderboards(
  ctx: MutationCtx,
  tick: number
): Promise<string[]> {
  const territories = await ctx.db.query("territories").collect();
  const events: string[] = [];

  for (const category of LEADERBOARD_CATEGORIES) {
    // Get previous snapshot for this category
    const previousSnapshot = await ctx.db
      .query("leaderboardSnapshots")
      .withIndex("by_category", (q) => q.eq("category", category))
      .order("desc")
      .first();

    // Create rankings
    const rankings = territories
      .map((t) => ({
        territoryId: t._id,
        territoryName: t.name,
        value: t[category] as number,
        rank: 0,
        previousRank: undefined as number | undefined,
        change: undefined as number | undefined,
      }))
      .sort((a, b) => b.value - a.value);

    // Assign ranks and calculate changes
    rankings.forEach((r, index) => {
      r.rank = index + 1;

      // Find previous rank
      if (previousSnapshot) {
        const prevEntry = previousSnapshot.rankings.find(
          (pr) => pr.territoryId === r.territoryId
        );
        if (prevEntry) {
          r.previousRank = prevEntry.rank;
          r.change = prevEntry.rank - r.rank; // Positive = moved up
        }
      }
    });

    // Insert new snapshot
    await ctx.db.insert("leaderboardSnapshots", {
      tick,
      category,
      rankings,
    });

    // Generate events for significant changes
    for (const ranking of rankings) {
      if (ranking.change && ranking.change > 0 && ranking.rank === 1) {
        events.push(
          `${ranking.territoryName} has claimed the top spot in ${category}!`
        );
      } else if (ranking.change && ranking.change >= 2) {
        events.push(
          `${ranking.territoryName} surged ${ranking.change} places in ${category}!`
        );
      } else if (ranking.change && ranking.change <= -2) {
        events.push(
          `${ranking.territoryName} dropped ${Math.abs(ranking.change)} places in ${category}.`
        );
      }
    }
  }

  return events;
}

// =============================================
// QUERIES
// =============================================

export const getLeaderboard = query({
  args: { category: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("leaderboardSnapshots")
      .withIndex("by_category", (q) => q.eq("category", args.category))
      .order("desc")
      .first();
  },
});

export const getAllLeaderboards = query({
  args: {},
  handler: async (ctx) => {
    const results: Record<string, Doc<"leaderboardSnapshots"> | null> = {};

    for (const category of LEADERBOARD_CATEGORIES) {
      results[category] = await ctx.db
        .query("leaderboardSnapshots")
        .withIndex("by_category", (q) => q.eq("category", category))
        .order("desc")
        .first();
    }

    return results;
  },
});

export const getLeaderboardHistory = query({
  args: {
    category: v.string(),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("leaderboardSnapshots")
      .withIndex("by_category", (q) => q.eq("category", args.category))
      .order("desc")
      .take(args.limit);
  },
});

export const getTerritoryRankings = query({
  args: { territoryId: v.id("territories") },
  handler: async (ctx, args) => {
    const rankings: Record<string, { rank: number; value: number; change?: number }> = {};

    for (const category of LEADERBOARD_CATEGORIES) {
      const snapshot = await ctx.db
        .query("leaderboardSnapshots")
        .withIndex("by_category", (q) => q.eq("category", category))
        .order("desc")
        .first();

      if (snapshot) {
        const entry = snapshot.rankings.find((r) => r.territoryId === args.territoryId);
        if (entry) {
          rankings[category] = {
            rank: entry.rank,
            value: entry.value,
            change: entry.change,
          };
        }
      }
    }

    return rankings;
  },
});
