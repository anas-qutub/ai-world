import { internalMutation, query, MutationCtx } from "../_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "../_generated/dataModel";

// =============================================
// WAR NAME GENERATION
// =============================================

const WAR_NAME_TEMPLATES = [
  // "The War of the {Adjective} {Noun}"
  { template: "The War of the {adjective} {noun}", weight: 3 },
  // "The {Noun} War"
  { template: "The {noun} War", weight: 2 },
  // "{Aggressor}'s {Noun}"
  { template: "{aggressor}'s {noun}", weight: 2 },
  // "The {Season} Offensive"
  { template: "The {season} Offensive", weight: 1 },
  // "The Great {Adjective} War"
  { template: "The Great {adjective} War", weight: 1 },
  // "War of {Year}"
  { template: "War of Year {year}", weight: 1 },
  // "The {Adjective} Crusade"
  { template: "The {adjective} Crusade", weight: 1 },
  // "{Defender}'s Last Stand"
  { template: "{defender}'s Last Stand", weight: 1 },
];

const WAR_ADJECTIVES = [
  "Iron", "Blood", "Crimson", "Golden", "Silver", "Dark", "Burning", "Frozen",
  "Endless", "Bitter", "Sacred", "Unholy", "Righteous", "Treacherous",
  "Glorious", "Terrible", "Grand", "Final", "First", "Second", "Great",
  "Northern", "Southern", "Eastern", "Western", "Highland", "Coastal",
];

const WAR_NOUNS = [
  "Rivers", "Mountains", "Crowns", "Thrones", "Eagles", "Lions", "Wolves",
  "Swords", "Shields", "Banners", "Realms", "Kingdoms", "Empires", "Nations",
  "Honor", "Vengeance", "Justice", "Conquest", "Liberation", "Succession",
  "Brothers", "Fathers", "Roses", "Thorns", "Stars", "Moons", "Flames",
];

const SEASONS = ["Spring", "Summer", "Autumn", "Winter"];

const BATTLE_NAME_PREFIXES = [
  "Battle of", "Siege of", "Assault on", "Defense of", "Crossing of",
  "Stand at", "Clash at", "Raid on", "Storming of", "Massacre at",
];

const LOCATION_SUFFIXES = [
  "Fields", "Plains", "Hills", "Mountains", "River", "Valley", "Forest",
  "Bridge", "Fort", "Castle", "Pass", "Gate", "Wall", "Keep", "Crossing",
];

function generateWarName(
  aggressorName: string,
  defenderName: string,
  year: number,
  causeType: string
): string {
  // Weight the templates
  const totalWeight = WAR_NAME_TEMPLATES.reduce((sum, t) => sum + t.weight, 0);
  let random = Math.random() * totalWeight;

  let selectedTemplate = WAR_NAME_TEMPLATES[0];
  for (const template of WAR_NAME_TEMPLATES) {
    random -= template.weight;
    if (random <= 0) {
      selectedTemplate = template;
      break;
    }
  }

  const adjective = WAR_ADJECTIVES[Math.floor(Math.random() * WAR_ADJECTIVES.length)];
  const noun = WAR_NOUNS[Math.floor(Math.random() * WAR_NOUNS.length)];
  const season = SEASONS[Math.floor(Math.random() * SEASONS.length)];

  let name = selectedTemplate.template
    .replace("{adjective}", adjective)
    .replace("{noun}", noun)
    .replace("{aggressor}", aggressorName)
    .replace("{defender}", defenderName)
    .replace("{season}", season)
    .replace("{year}", year.toString());

  // Special names for certain cause types
  if (causeType === "revenge" && Math.random() < 0.5) {
    name = `The War of ${aggressorName}'s Vengeance`;
  } else if (causeType === "succession" && Math.random() < 0.5) {
    name = `The Succession War`;
  } else if (causeType === "honor" && Math.random() < 0.5) {
    name = `The War of Wounded Honor`;
  }

  return name;
}

function generateBattleName(locationName: string): string {
  const prefix = BATTLE_NAME_PREFIXES[Math.floor(Math.random() * BATTLE_NAME_PREFIXES.length)];
  const suffix = LOCATION_SUFFIXES[Math.floor(Math.random() * LOCATION_SUFFIXES.length)];

  // Sometimes use the territory name directly
  if (Math.random() < 0.3) {
    return `${prefix} ${locationName}`;
  }

  // Generate a made-up location name
  const locationPrefixes = ["Red", "Black", "White", "Green", "Stone", "Iron", "Gold", "Silver"];
  const locationPrefix = locationPrefixes[Math.floor(Math.random() * locationPrefixes.length)];

  return `${prefix} ${locationPrefix} ${suffix}`;
}

// =============================================
// START A WAR
// =============================================

export async function startWarInternal(
  ctx: MutationCtx,
  aggressorId: Id<"territories">,
  defenderId: Id<"territories">,
  causeType: string,
  causeDescription: string,
  tick: number,
  year: number
): Promise<{ success: boolean; error?: string; warId?: Id<"wars">; warName?: string }> {
  // Get territory info
  const aggressor = await ctx.db.get(aggressorId);
  const defender = await ctx.db.get(defenderId);

  if (!aggressor || !defender) {
    return { success: false, error: "Territories not found" };
  }

  // Get rulers if they exist
  const aggressorRuler = await ctx.db
    .query("characters")
    .withIndex("by_territory", (q) => q.eq("territoryId", aggressorId))
    .filter((q) =>
      q.and(
        q.eq(q.field("isAlive"), true),
        q.eq(q.field("role"), "ruler")
      )
    )
    .first();

  const defenderRuler = await ctx.db
    .query("characters")
    .withIndex("by_territory", (q) => q.eq("territoryId", defenderId))
    .filter((q) =>
      q.and(
        q.eq(q.field("isAlive"), true),
        q.eq(q.field("role"), "ruler")
      )
    )
    .first();

  // Generate war name
  const warName = generateWarName(
    aggressor.name,
    defender.name,
    year,
    causeType
  );

  // Create the war record
  const warId = await ctx.db.insert("wars", {
    name: warName,
    aggressorId,
    defenderId,
    aggressorRulerId: aggressorRuler?._id,
    defenderRulerId: defenderRuler?._id,
    startTick: tick,
    causeType,
    causeDescription,
    casualties: {
      aggressor: 0,
      defender: 0,
    },
    majorBattles: [],
    status: "active",
  });

  // Update relationship to at_war
  const relationships = await ctx.db
    .query("relationships")
    .collect();

  const relationship = relationships.find(
    (r) =>
      (r.territory1Id === aggressorId && r.territory2Id === defenderId) ||
      (r.territory1Id === defenderId && r.territory2Id === aggressorId)
  );

  if (relationship) {
    await ctx.db.patch(relationship._id, {
      status: "at_war",
      warStartTick: tick,
      hasTradeAgreement: false,
      hasAlliance: false,
      warExhaustion: 0,
      warScore: 0,
    });
  }

  return {
    success: true,
    warId,
    warName,
  };
}

// Keep the internalMutation wrapper for external calls
export const startWar = internalMutation({
  args: {
    aggressorId: v.id("territories"),
    defenderId: v.id("territories"),
    causeType: v.string(),
    causeDescription: v.string(),
    tick: v.number(),
    year: v.number(),
  },
  handler: async (ctx, args) => {
    return startWarInternal(
      ctx,
      args.aggressorId,
      args.defenderId,
      args.causeType,
      args.causeDescription,
      args.tick,
      args.year
    );
  },
});

// =============================================
// RECORD A BATTLE
// =============================================

export const recordBattle = internalMutation({
  args: {
    aggressorId: v.id("territories"),
    defenderId: v.id("territories"),
    tick: v.number(),
    winner: v.union(v.literal("attacker"), v.literal("defender"), v.literal("draw")),
    attackerCasualties: v.number(),
    defenderCasualties: v.number(),
    locationName: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Find the active war between these territories
    const wars = await ctx.db
      .query("wars")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();

    const war = wars.find(
      (w) =>
        (w.aggressorId === args.aggressorId && w.defenderId === args.defenderId) ||
        (w.aggressorId === args.defenderId && w.defenderId === args.aggressorId)
    );

    if (!war) {
      // No war record exists, create one
      const aggressor = await ctx.db.get(args.aggressorId);
      const defender = await ctx.db.get(args.defenderId);
      if (aggressor && defender) {
        await startWarInternal(
          ctx,
          args.aggressorId,
          args.defenderId,
          "territorial",
          "Border conflict escalated to war",
          args.tick,
          Math.floor(args.tick / 12)
        );
      }
      return { success: false, error: "War not found, created new war record" };
    }

    const battleName = generateBattleName(args.locationName);
    const totalCasualties = args.attackerCasualties + args.defenderCasualties;

    // Determine if this is a "major" battle
    const isMajorBattle = totalCasualties > 100 || Math.random() < 0.3;

    if (isMajorBattle) {
      const aggressor = await ctx.db.get(war.aggressorId);
      const winnerName = args.winner === "attacker"
        ? (war.aggressorId === args.aggressorId ? aggressor?.name : (await ctx.db.get(war.defenderId))?.name)
        : args.winner === "defender"
          ? (war.aggressorId === args.aggressorId ? (await ctx.db.get(war.defenderId))?.name : aggressor?.name)
          : "Neither side";

      const newBattles = [...war.majorBattles, {
        name: battleName,
        tick: args.tick,
        winner: winnerName || "Unknown",
        casualties: totalCasualties,
        description: args.description,
      }];

      // Update casualties
      let aggressorCasualties = war.casualties.aggressor;
      let defenderCasualties = war.casualties.defender;

      if (war.aggressorId === args.aggressorId) {
        aggressorCasualties += args.attackerCasualties;
        defenderCasualties += args.defenderCasualties;
      } else {
        aggressorCasualties += args.defenderCasualties;
        defenderCasualties += args.attackerCasualties;
      }

      await ctx.db.patch(war._id, {
        majorBattles: newBattles,
        casualties: {
          aggressor: aggressorCasualties,
          defender: defenderCasualties,
        },
      });
    }

    return {
      success: true,
      battleName,
      isMajorBattle,
    };
  },
});

// =============================================
// END A WAR
// =============================================

export const endWar = internalMutation({
  args: {
    aggressorId: v.id("territories"),
    defenderId: v.id("territories"),
    tick: v.number(),
    outcome: v.string(),
    peaceTerms: v.string(),
  },
  handler: async (ctx, args) => {
    // Find the active war
    const wars = await ctx.db
      .query("wars")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();

    const war = wars.find(
      (w) =>
        (w.aggressorId === args.aggressorId && w.defenderId === args.defenderId) ||
        (w.aggressorId === args.defenderId && w.defenderId === args.aggressorId)
    );

    if (!war) {
      return { success: false, error: "No active war found" };
    }

    const aggressor = await ctx.db.get(war.aggressorId);
    const defender = await ctx.db.get(war.defenderId);

    // Generate war narrative
    const durationMonths = args.tick - war.startTick;
    const durationYears = Math.floor(durationMonths / 12);
    const remainingMonths = durationMonths % 12;

    let durationText = "";
    if (durationYears > 0) {
      durationText = `${durationYears} year${durationYears > 1 ? "s" : ""}`;
      if (remainingMonths > 0) {
        durationText += ` and ${remainingMonths} month${remainingMonths > 1 ? "s" : ""}`;
      }
    } else {
      durationText = `${durationMonths} month${durationMonths > 1 ? "s" : ""}`;
    }

    const totalCasualties = war.casualties.aggressor + war.casualties.defender;
    const narrative = buildWarNarrative(
      war,
      aggressor?.name || "Unknown",
      defender?.name || "Unknown",
      durationText,
      totalCasualties,
      args.outcome
    );

    await ctx.db.patch(war._id, {
      status: "ended",
      endTick: args.tick,
      outcome: args.outcome,
      peaceTerms: args.peaceTerms,
      narrative,
    });

    // Update relationship
    const relationships = await ctx.db.query("relationships").collect();
    const relationship = relationships.find(
      (r) =>
        (r.territory1Id === args.aggressorId && r.territory2Id === args.defenderId) ||
        (r.territory1Id === args.defenderId && r.territory2Id === args.aggressorId)
    );

    if (relationship) {
      await ctx.db.patch(relationship._id, {
        status: "tense",
        pendingPeaceOffer: undefined,
        peaceOfferTerms: undefined,
      });
    }

    return {
      success: true,
      warName: war.name,
      duration: durationText,
      totalCasualties,
      narrative,
    };
  },
});

function buildWarNarrative(
  war: Doc<"wars">,
  aggressorName: string,
  defenderName: string,
  duration: string,
  totalCasualties: number,
  outcome: string
): string {
  let narrative = `${war.name} lasted ${duration}. `;

  // Describe the cause
  narrative += `The war began when ${aggressorName} ${war.causeDescription}. `;

  // Describe major battles
  if (war.majorBattles.length > 0) {
    const lastBattle = war.majorBattles[war.majorBattles.length - 1];
    if (war.majorBattles.length === 1) {
      narrative += `The decisive battle was the ${lastBattle.name}, won by ${lastBattle.winner}. `;
    } else {
      narrative += `Key battles included `;
      const battleNames = war.majorBattles.slice(0, 3).map((b) => b.name);
      narrative += battleNames.join(", ");
      narrative += `. `;
    }
  }

  // Describe casualties
  if (totalCasualties > 1000) {
    narrative += `The war was devastatingly costly, with over ${Math.floor(totalCasualties / 100) * 100} casualties. `;
  } else if (totalCasualties > 100) {
    narrative += `The conflict claimed roughly ${totalCasualties} lives. `;
  }

  // Describe outcome
  narrative += outcome;

  return narrative;
}

// =============================================
// UPDATE ACTIVE WARS
// =============================================

export async function updateActiveWars(
  ctx: MutationCtx,
  tick: number
): Promise<string[]> {
  const activeWars = await ctx.db
    .query("wars")
    .withIndex("by_status", (q) => q.eq("status", "active"))
    .collect();

  const events: string[] = [];

  for (const war of activeWars) {
    // Check if the relationship is still at war
    const relationships = await ctx.db.query("relationships").collect();
    const relationship = relationships.find(
      (r) =>
        (r.territory1Id === war.aggressorId && r.territory2Id === war.defenderId) ||
        (r.territory1Id === war.defenderId && r.territory2Id === war.aggressorId)
    );

    if (relationship && relationship.status !== "at_war") {
      // War has ended through other means (peace, surrender)
      await ctx.db.patch(war._id, {
        status: "ended",
        endTick: tick,
        outcome: "Peace was negotiated.",
      });
      events.push(`${war.name} has ended.`);
    }

    // Add war duration milestone events
    const durationMonths = tick - war.startTick;
    if (durationMonths === 12) {
      events.push(`${war.name} has raged for one full year.`);
    } else if (durationMonths === 60) {
      events.push(`${war.name} enters its fifth year with no end in sight.`);
    } else if (durationMonths === 120) {
      events.push(`${war.name} has become a decade-long conflict.`);
    }
  }

  return events;
}

// =============================================
// QUERIES
// =============================================

export const getActiveWars = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("wars")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();
  },
});

export const getWarsByTerritory = query({
  args: { territoryId: v.id("territories") },
  handler: async (ctx, args) => {
    const asAggressor = await ctx.db
      .query("wars")
      .withIndex("by_aggressor", (q) => q.eq("aggressorId", args.territoryId))
      .collect();

    const asDefender = await ctx.db
      .query("wars")
      .withIndex("by_defender", (q) => q.eq("defenderId", args.territoryId))
      .collect();

    return [...asAggressor, ...asDefender];
  },
});

export const getWarById = query({
  args: { warId: v.id("wars") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.warId);
  },
});

export const getRecentWars = query({
  args: { limit: v.number() },
  handler: async (ctx, args) => {
    const wars = await ctx.db.query("wars").order("desc").take(args.limit);
    return wars;
  },
});
