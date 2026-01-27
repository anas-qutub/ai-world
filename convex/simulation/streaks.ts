import { internalMutation, query, MutationCtx } from "../_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "../_generated/dataModel";

// =============================================
// STREAK TYPES
// =============================================

export const STREAK_TYPES = {
  peace: {
    name: "Years of Peace",
    description: "Consecutive months without war",
    condition: (territory: Doc<"territories">, relationships: Doc<"relationships">[]) => {
      return !relationships.some((r) => r.status === "at_war");
    },
  },
  prosperity: {
    name: "Prosperity Streak",
    description: "Consecutive months with happiness above 70",
    condition: (territory: Doc<"territories">) => territory.happiness >= 70,
  },
  growth: {
    name: "Population Growth",
    description: "Consecutive months with population increase",
    // This needs history, handled separately
    condition: () => true,
  },
  alliance: {
    name: "Alliance Duration",
    description: "Consecutive months with at least one alliance",
    condition: (territory: Doc<"territories">, relationships: Doc<"relationships">[]) => {
      return relationships.some((r) => r.hasAlliance);
    },
  },
  dominance: {
    name: "Military Dominance",
    description: "Consecutive months as #1 in military",
    // Handled via leaderboard
    condition: () => true,
  },
  stability: {
    name: "Political Stability",
    description: "Consecutive months without ruler change",
    condition: () => true, // Handled via succession events
  },
};

// =============================================
// UPDATE STREAKS
// =============================================

export async function updateStreaks(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  tick: number
): Promise<string[]> {
  const territory = await ctx.db.get(territoryId);
  if (!territory) return [];

  // Get all relationships for this territory
  const allRelationships = await ctx.db.query("relationships").collect();
  const relationships = allRelationships.filter(
    (r) => r.territory1Id === territoryId || r.territory2Id === territoryId
  );

  const events: string[] = [];

  // Check each streak type
  for (const [streakType, config] of Object.entries(STREAK_TYPES)) {
    if (streakType === "growth" || streakType === "dominance" || streakType === "stability") {
      continue; // These are handled separately
    }

    const conditionMet = config.condition(territory, relationships);

    // Find existing active streak
    const existingStreak = await ctx.db
      .query("streaks")
      .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
      .filter((q) =>
        q.and(
          q.eq(q.field("streakType"), streakType),
          q.eq(q.field("isActive"), true)
        )
      )
      .first();

    if (conditionMet) {
      if (existingStreak) {
        // Extend the streak
        const newLength = existingStreak.currentLength + 1;
        await ctx.db.patch(existingStreak._id, {
          currentLength: newLength,
        });

        // Milestone events
        if (newLength === 12) {
          events.push(`${territory.name} has maintained ${config.name} for one full year!`);
        } else if (newLength === 60) {
          events.push(`${territory.name}'s ${config.name} streak reaches 5 years!`);
        } else if (newLength === 120) {
          events.push(`${territory.name} achieves a decade-long ${config.name} streak!`);
        }

        // Check for records
        await checkAndUpdateRecord(ctx, territoryId, territory.name, streakType, newLength, tick);
      } else {
        // Start new streak
        await ctx.db.insert("streaks", {
          territoryId,
          streakType,
          startTick: tick,
          currentLength: 1,
          isActive: true,
        });
      }
    } else {
      if (existingStreak) {
        // End the streak
        await ctx.db.patch(existingStreak._id, {
          isActive: false,
          endTick: tick,
          endReason: `Condition no longer met`,
        });

        if (existingStreak.currentLength >= 12) {
          events.push(
            `${territory.name}'s ${config.name} streak of ${Math.floor(existingStreak.currentLength / 12)} years has ended.`
          );
        }
      }
    }
  }

  return events;
}

// =============================================
// CHECK AND UPDATE RECORDS
// =============================================

async function checkAndUpdateRecord(
  ctx: any,
  territoryId: Id<"territories">,
  territoryName: string,
  recordType: string,
  value: number,
  tick: number
): Promise<boolean> {
  const existingRecord = await ctx.db
    .query("records")
    .withIndex("by_type", (q: any) => q.eq("recordType", recordType))
    .first();

  if (!existingRecord || value > existingRecord.value) {
    if (existingRecord) {
      await ctx.db.patch(existingRecord._id, {
        territoryId,
        territoryName,
        value,
        setAtTick: tick,
      });
    } else {
      await ctx.db.insert("records", {
        recordType,
        territoryId,
        territoryName,
        value,
        setAtTick: tick,
      });
    }
    return true;
  }
  return false;
}

// =============================================
// RECORD SPECIFIC RECORDS
// =============================================

export const recordWarCasualties = internalMutation({
  args: {
    territoryId: v.id("territories"),
    territoryName: v.string(),
    casualties: v.number(),
    warName: v.string(),
    tick: v.number(),
  },
  handler: async (ctx, args) => {
    const existingRecord = await ctx.db
      .query("records")
      .withIndex("by_type", (q) => q.eq("recordType", "bloodiest_war"))
      .first();

    if (!existingRecord || args.casualties > existingRecord.value) {
      if (existingRecord) {
        await ctx.db.patch(existingRecord._id, {
          territoryId: args.territoryId,
          territoryName: args.territoryName,
          value: args.casualties,
          setAtTick: args.tick,
          description: args.warName,
        });
      } else {
        await ctx.db.insert("records", {
          recordType: "bloodiest_war",
          territoryId: args.territoryId,
          territoryName: args.territoryName,
          value: args.casualties,
          setAtTick: args.tick,
          description: args.warName,
        });
      }
      return true;
    }
    return false;
  },
});

export const recordDynastyLength = internalMutation({
  args: {
    territoryId: v.id("territories"),
    territoryName: v.string(),
    generations: v.number(),
    dynastyName: v.string(),
    tick: v.number(),
  },
  handler: async (ctx, args) => {
    const existingRecord = await ctx.db
      .query("records")
      .withIndex("by_type", (q) => q.eq("recordType", "longest_dynasty"))
      .first();

    if (!existingRecord || args.generations > existingRecord.value) {
      if (existingRecord) {
        await ctx.db.patch(existingRecord._id, {
          territoryId: args.territoryId,
          territoryName: args.territoryName,
          value: args.generations,
          setAtTick: args.tick,
          description: args.dynastyName,
        });
      } else {
        await ctx.db.insert("records", {
          recordType: "longest_dynasty",
          territoryId: args.territoryId,
          territoryName: args.territoryName,
          value: args.generations,
          setAtTick: args.tick,
          description: args.dynastyName,
        });
      }
      return true;
    }
    return false;
  },
});

export async function recordPopulationPeak(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  territoryName: string,
  population: number,
  tick: number
): Promise<boolean> {
  const existingRecord = await ctx.db
    .query("records")
    .withIndex("by_type", (q) => q.eq("recordType", "highest_population"))
    .first();

  if (!existingRecord || population > existingRecord.value) {
    if (existingRecord) {
      await ctx.db.patch(existingRecord._id, {
        territoryId,
        territoryName,
        value: population,
        setAtTick: tick,
      });
    } else {
      await ctx.db.insert("records", {
        recordType: "highest_population",
        territoryId,
        territoryName,
        value: population,
        setAtTick: tick,
      });
    }
    return true;
  }
  return false;
}

// =============================================
// QUERIES
// =============================================

export const getActiveStreaks = query({
  args: { territoryId: v.id("territories") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("streaks")
      .withIndex("by_territory", (q) => q.eq("territoryId", args.territoryId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
  },
});

export const getAllActiveStreaks = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("streaks")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();
  },
});

export const getRecords = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("records").collect();
  },
});

export const getRecordsByType = query({
  args: { recordType: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("records")
      .withIndex("by_type", (q) => q.eq("recordType", args.recordType))
      .first();
  },
});

export const getTerritoryRecords = query({
  args: { territoryId: v.id("territories") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("records")
      .withIndex("by_territory", (q) => q.eq("territoryId", args.territoryId))
      .collect();
  },
});
