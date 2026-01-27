import { internalMutation, query, MutationCtx } from "../_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "../_generated/dataModel";

// =============================================
// RIVALRY TRIGGERS AND INTENSITY
// =============================================

export const RIVALRY_TRIGGERS = {
  killed_family: {
    type: "blood_feud",
    baseIntensity: 60,
    isHereditary: true,
    description: "killed a family member",
  },
  killed_ruler: {
    type: "blood_feud",
    baseIntensity: 80,
    isHereditary: true,
    description: "assassinated the ruler",
  },
  betrayed_alliance: {
    type: "betrayal",
    baseIntensity: 45,
    isHereditary: false,
    description: "betrayed an alliance",
  },
  broke_peace: {
    type: "betrayal",
    baseIntensity: 35,
    isHereditary: false,
    description: "broke a peace treaty",
  },
  stole_technology: {
    type: "honor",
    baseIntensity: 25,
    isHereditary: false,
    description: "stole technological secrets",
  },
  raided: {
    type: "territorial",
    baseIntensity: 20,
    isHereditary: false,
    description: "raided our lands",
  },
  insulted: {
    type: "personal",
    baseIntensity: 15,
    isHereditary: false,
    description: "insulted our honor",
  },
  conquered_territory: {
    type: "territorial",
    baseIntensity: 50,
    isHereditary: true,
    description: "conquered our ancestral lands",
  },
  humiliated_in_war: {
    type: "honor",
    baseIntensity: 40,
    isHereditary: false,
    description: "humiliated us in war",
  },
};

// =============================================
// CREATE RIVALRY
// =============================================

export const createRivalry = internalMutation({
  args: {
    character1Id: v.id("characters"),
    character2Id: v.id("characters"),
    territory1Id: v.id("territories"),
    territory2Id: v.id("territories"),
    trigger: v.string(),
    tick: v.number(),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    const triggerConfig = RIVALRY_TRIGGERS[args.trigger as keyof typeof RIVALRY_TRIGGERS];

    if (!triggerConfig) {
      return { success: false, error: "Unknown trigger type" };
    }

    // Check if rivalry already exists between these characters
    const existing = await ctx.db
      .query("rivalries")
      .withIndex("by_territory1", (q) => q.eq("territory1Id", args.territory1Id))
      .filter((q) =>
        q.and(
          q.eq(q.field("territory2Id"), args.territory2Id),
          q.eq(q.field("status"), "active")
        )
      )
      .first();

    if (existing) {
      // Add reason to existing rivalry
      const newReasons = [...existing.reasons, {
        reason: args.trigger,
        tick: args.tick,
        description: args.description,
        intensityAdded: triggerConfig.baseIntensity,
      }];

      const newIntensity = Math.min(100, existing.intensity + triggerConfig.baseIntensity);

      // If this trigger is hereditary, update that too
      const isHereditary = existing.isHereditary || triggerConfig.isHereditary;

      await ctx.db.patch(existing._id, {
        intensity: newIntensity,
        reasons: newReasons,
        isHereditary,
      });

      return {
        success: true,
        rivalryId: existing._id,
        newIntensity,
        isNew: false,
      };
    }

    // Create new rivalry
    const rivalryId = await ctx.db.insert("rivalries", {
      character1Id: args.character1Id,
      character2Id: args.character2Id,
      territory1Id: args.territory1Id,
      territory2Id: args.territory2Id,
      intensity: triggerConfig.baseIntensity,
      rivalryType: triggerConfig.type,
      reasons: [{
        reason: args.trigger,
        tick: args.tick,
        description: args.description,
        intensityAdded: triggerConfig.baseIntensity,
      }],
      isHereditary: triggerConfig.isHereditary,
      status: "active",
      startTick: args.tick,
    });

    return {
      success: true,
      rivalryId,
      newIntensity: triggerConfig.baseIntensity,
      isNew: true,
    };
  },
});

// =============================================
// TRANSFER RIVALRY TO SUCCESSOR
// =============================================

export const transferRivalryToSuccessor = internalMutation({
  args: {
    oldCharacterId: v.id("characters"),
    newCharacterId: v.id("characters"),
    tick: v.number(),
  },
  handler: async (ctx, args) => {
    // Find all hereditary rivalries involving the old character
    const rivalries1 = await ctx.db
      .query("rivalries")
      .filter((q) =>
        q.and(
          q.eq(q.field("character1Id"), args.oldCharacterId),
          q.eq(q.field("isHereditary"), true),
          q.eq(q.field("status"), "active")
        )
      )
      .collect();

    const rivalries2 = await ctx.db
      .query("rivalries")
      .filter((q) =>
        q.and(
          q.eq(q.field("character2Id"), args.oldCharacterId),
          q.eq(q.field("isHereditary"), true),
          q.eq(q.field("status"), "active")
        )
      )
      .collect();

    const transferred: Id<"rivalries">[] = [];

    // Transfer character1 rivalries
    for (const rivalry of rivalries1) {
      await ctx.db.patch(rivalry._id, {
        character1Id: args.newCharacterId,
        // Reduce intensity slightly on transfer (forgiveness over generations)
        intensity: Math.max(20, rivalry.intensity - 10),
        reasons: [...rivalry.reasons, {
          reason: "inherited",
          tick: args.tick,
          description: "Rivalry passed to successor",
          intensityAdded: -10,
        }],
      });
      transferred.push(rivalry._id);
    }

    // Transfer character2 rivalries
    for (const rivalry of rivalries2) {
      await ctx.db.patch(rivalry._id, {
        character2Id: args.newCharacterId,
        intensity: Math.max(20, rivalry.intensity - 10),
        reasons: [...rivalry.reasons, {
          reason: "inherited",
          tick: args.tick,
          description: "Rivalry passed to successor",
          intensityAdded: -10,
        }],
      });
      transferred.push(rivalry._id);
    }

    return { transferred };
  },
});

// =============================================
// PROCESS RIVALRIES
// =============================================

export async function processRivalries(
  ctx: MutationCtx,
  tick: number
): Promise<string[]> {
  const activeRivalries = await ctx.db
    .query("rivalries")
    .withIndex("by_status", (q) => q.eq("status", "active"))
    .collect();

  const events: string[] = [];

  for (const rivalry of activeRivalries) {
    // Check if either character is still alive
    const char1 = await ctx.db.get(rivalry.character1Id);
    const char2 = await ctx.db.get(rivalry.character2Id);

    if (!char1?.isAlive && !char2?.isAlive) {
      // Both dead, resolve rivalry if not hereditary
      if (!rivalry.isHereditary) {
        await ctx.db.patch(rivalry._id, {
          status: "resolved",
          endTick: tick,
        });
        events.push("An old rivalry has faded into history.");
      }
      continue;
    }

    // Intensity slowly decays over time (unless blood feud)
    if (rivalry.rivalryType !== "blood_feud") {
      const newIntensity = Math.max(0, rivalry.intensity - 1);
      if (newIntensity <= 10) {
        await ctx.db.patch(rivalry._id, {
          status: "dormant",
          intensity: newIntensity,
        });
        events.push("A rivalry has cooled into uneasy peace.");
      } else {
        await ctx.db.patch(rivalry._id, { intensity: newIntensity });
      }
    }

    // High intensity rivalries might trigger events
    if (rivalry.intensity >= 80 && Math.random() < 0.02) {
      // Possible assassination attempt or raid triggered by rivalry
      events.push(`The intense rivalry between territories has escalated!`);
    }
  }

  return events;
}

// =============================================
// RESOLVE RIVALRY
// =============================================

export const resolveRivalry = internalMutation({
  args: {
    rivalryId: v.id("rivalries"),
    tick: v.number(),
    resolution: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.rivalryId, {
      status: "resolved",
      endTick: args.tick,
    });

    return { success: true };
  },
});

// =============================================
// QUERIES
// =============================================

export const getRivalriesByTerritory = query({
  args: { territoryId: v.id("territories") },
  handler: async (ctx, args) => {
    const asTerritory1 = await ctx.db
      .query("rivalries")
      .withIndex("by_territory1", (q) => q.eq("territory1Id", args.territoryId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    const asTerritory2 = await ctx.db
      .query("rivalries")
      .withIndex("by_territory2", (q) => q.eq("territory2Id", args.territoryId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    return [...asTerritory1, ...asTerritory2];
  },
});

export const getActiveRivalries = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("rivalries")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();
  },
});

export const getRivalryById = query({
  args: { rivalryId: v.id("rivalries") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.rivalryId);
  },
});

export const getMostIntenseRivalries = query({
  args: { limit: v.number() },
  handler: async (ctx, args) => {
    const rivalries = await ctx.db
      .query("rivalries")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();

    return rivalries
      .sort((a, b) => b.intensity - a.intensity)
      .slice(0, args.limit);
  },
});
