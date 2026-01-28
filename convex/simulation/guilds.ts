import { MutationCtx, QueryCtx } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";

// =============================================
// GUILD SYSTEM
// =============================================
// Guilds organize craftsmen and merchants, provide quality control,
// training through apprenticeships, and political influence.

// Guild type configurations
export const GUILD_TYPES = {
  blacksmiths: {
    relatedProfessions: ["blacksmith", "jeweler"],
    relatedSkills: ["smithing"],
    productionBonus: "military_equipment",
    minimumSkill: 30,
  },
  masons: {
    relatedProfessions: ["mason"],
    relatedSkills: ["masonry", "engineering"],
    productionBonus: "construction",
    minimumSkill: 30,
  },
  carpenters: {
    relatedProfessions: ["carpenter"],
    relatedSkills: ["carpentry"],
    productionBonus: "wood_goods",
    minimumSkill: 25,
  },
  weavers: {
    relatedProfessions: ["weaver", "potter"],
    relatedSkills: ["tailoring"],
    productionBonus: "cloth",
    minimumSkill: 25,
  },
  merchants: {
    relatedProfessions: ["merchant", "trader", "banker"],
    relatedSkills: ["trading", "negotiation"],
    productionBonus: "trade_income",
    minimumSkill: 35,
  },
  miners: {
    relatedProfessions: ["miner"],
    relatedSkills: ["mining"],
    productionBonus: "ore",
    minimumSkill: 20,
  },
  farmers: {
    relatedProfessions: ["farmer", "herder"],
    relatedSkills: ["farming", "animalcare"],
    productionBonus: "food",
    minimumSkill: 20,
  },
  physicians: {
    relatedProfessions: ["physician", "alchemist"],
    relatedSkills: ["medicine"],
    productionBonus: "healthcare",
    minimumSkill: 50,
  },
  scribes: {
    relatedProfessions: ["scribe", "scholar"],
    relatedSkills: ["literacy", "mathematics"],
    productionBonus: "knowledge",
    minimumSkill: 50,
  },
  entertainers: {
    relatedProfessions: ["entertainer", "artisan"],
    relatedSkills: ["persuasion"],
    productionBonus: "happiness",
    minimumSkill: 30,
  },
};

// Rank requirements
export const GUILD_RANKS = {
  apprentice: {
    yearsRequired: 0,
    skillRequired: 0,
    canVote: false,
    canTeach: false,
  },
  journeyman: {
    yearsRequired: 3,
    skillRequired: 40,
    canVote: true,
    canTeach: false,
  },
  master: {
    yearsRequired: 7,
    skillRequired: 70,
    canVote: true,
    canTeach: true,
  },
  grandmaster: {
    yearsRequired: 15,
    skillRequired: 90,
    canVote: true,
    canTeach: true,
  },
};

/**
 * Found a new guild
 */
export async function foundGuild(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  guildType: keyof typeof GUILD_TYPES,
  name: string,
  founderId: Id<"characters">,
  tick: number
): Promise<{ success: boolean; guildId?: Id<"guilds">; message: string }> {
  const territory = await ctx.db.get(territoryId);
  const founder = await ctx.db.get(founderId);

  if (!territory) {
    return { success: false, message: "Territory not found" };
  }
  if (!founder || !founder.isAlive) {
    return { success: false, message: "Founder not found or deceased" };
  }

  // Check if guild type already exists in territory
  const existingGuild = await ctx.db
    .query("guilds")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .filter((q) => q.eq(q.field("guildType"), guildType))
    .first();

  if (existingGuild) {
    return { success: false, message: `A ${guildType} guild already exists here` };
  }

  // Check founder qualifications
  const config = GUILD_TYPES[guildType];
  const relevantSkill = founder.skills?.[config.relatedSkills[0] as keyof typeof founder.skills] || 0;
  if (relevantSkill < config.minimumSkill) {
    return { success: false, message: `Founder needs ${config.minimumSkill}+ ${config.relatedSkills[0]} skill` };
  }

  const guildId = await ctx.db.insert("guilds", {
    name,
    territoryId,
    foundedTick: tick,
    guildType,
    guildMasterId: founderId,
    councilMemberIds: [founderId],
    memberCount: 1,
    apprenticeCount: 0,
    journeymanCount: 0,
    masterCount: 1,
    treasury: 50, // Starting funds
    dues: 5,
    minimumWage: 10,
    priceControls: undefined,
    qualityStandard: 50,
    trainingQuality: 50,
    politicalInfluence: 10,
    relationshipWithRuler: 0,
    hasMonopoly: false,
    hasGuildHall: false,
  });

  // Update founder
  await ctx.db.patch(founderId, {
    guildId,
    guildRank: "grandmaster",
    guildJoinTick: tick,
  });

  return {
    success: true,
    guildId,
    message: `The ${name} has been founded`,
  };
}

/**
 * Join a guild
 */
export async function joinGuild(
  ctx: MutationCtx,
  characterId: Id<"characters">,
  guildId: Id<"guilds">,
  tick: number
): Promise<{ success: boolean; message: string }> {
  const character = await ctx.db.get(characterId);
  const guild = await ctx.db.get(guildId);

  if (!character || !character.isAlive) {
    return { success: false, message: "Character not found or deceased" };
  }
  if (!guild) {
    return { success: false, message: "Guild not found" };
  }

  // Check if already in a guild
  if (character.guildId) {
    return { success: false, message: "Already a member of a guild" };
  }

  // Check profession compatibility
  const config = GUILD_TYPES[guild.guildType as keyof typeof GUILD_TYPES];
  if (!config.relatedProfessions.includes(character.profession || "")) {
    return { success: false, message: `Must be a ${config.relatedProfessions.join(" or ")} to join` };
  }

  // Check skill requirement
  const relevantSkill = character.skills?.[config.relatedSkills[0] as keyof typeof character.skills] || 0;
  const rank = relevantSkill >= GUILD_RANKS.master.skillRequired ? "master" :
               relevantSkill >= GUILD_RANKS.journeyman.skillRequired ? "journeyman" : "apprentice";

  await ctx.db.patch(characterId, {
    guildId,
    guildRank: rank,
    guildJoinTick: tick,
  });

  // Update guild counts
  const countField = rank === "master" ? "masterCount" :
                     rank === "journeyman" ? "journeymanCount" : "apprenticeCount";

  await ctx.db.patch(guildId, {
    memberCount: guild.memberCount + 1,
    [countField]: (guild[countField as keyof typeof guild] as number) + 1,
  });

  return {
    success: true,
    message: `${character.name} joined ${guild.name} as a ${rank}`,
  };
}

/**
 * Assign an apprentice to a master
 */
export async function assignApprentice(
  ctx: MutationCtx,
  apprenticeId: Id<"characters">,
  masterId: Id<"characters">
): Promise<{ success: boolean; message: string }> {
  const apprentice = await ctx.db.get(apprenticeId);
  const master = await ctx.db.get(masterId);

  if (!apprentice || !apprentice.isAlive) {
    return { success: false, message: "Apprentice not found or deceased" };
  }
  if (!master || !master.isAlive) {
    return { success: false, message: "Master not found or deceased" };
  }

  // Check ranks
  if (apprentice.guildRank !== "apprentice") {
    return { success: false, message: "Character is not an apprentice" };
  }
  if (master.guildRank !== "master" && master.guildRank !== "grandmaster") {
    return { success: false, message: "Teacher must be a master or grandmaster" };
  }

  // Check same guild
  if (apprentice.guildId !== master.guildId) {
    return { success: false, message: "Must be in the same guild" };
  }

  await ctx.db.patch(apprenticeId, {
    apprenticeMasterId: masterId,
    teacherId: masterId,
  });

  return {
    success: true,
    message: `${apprentice.name} is now apprenticed to ${master.name}`,
  };
}

/**
 * Process guild activities each tick
 */
export async function processGuilds(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  tick: number
): Promise<Array<{ type: string; description: string }>> {
  const events: Array<{ type: string; description: string }> = [];

  const guilds = await ctx.db
    .query("guilds")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .collect();

  for (const guild of guilds) {
    // Collect dues
    if (guild.dues > 0 && guild.memberCount > 0) {
      const duesCollected = guild.dues * guild.memberCount;
      await ctx.db.patch(guild._id, {
        treasury: guild.treasury + duesCollected,
      });
    }

    // Train apprentices
    const apprentices = await ctx.db
      .query("characters")
      .withIndex("by_guild", (q) => q.eq("guildId", guild._id))
      .filter((q) =>
        q.and(
          q.eq(q.field("isAlive"), true),
          q.eq(q.field("guildRank"), "apprentice")
        )
      )
      .collect();

    const config = GUILD_TYPES[guild.guildType as keyof typeof GUILD_TYPES];

    for (const apprentice of apprentices) {
      if (!apprentice.apprenticeMasterId) continue;

      const master = await ctx.db.get(apprentice.apprenticeMasterId);
      if (!master || !master.isAlive) continue;

      // Training progress
      const masterSkill = master.skills?.[config.relatedSkills[0] as keyof typeof master.skills] || 50;
      const trainingQuality = guild.trainingQuality;
      const learningRate = (masterSkill / 100) * (trainingQuality / 100) * 0.5;

      const skills = apprentice.skills || {} as any;
      for (const skillName of config.relatedSkills) {
        const currentSkill = skills[skillName] || 0;
        if (currentSkill < masterSkill && Math.random() < learningRate) {
          skills[skillName] = Math.min(masterSkill, currentSkill + 1);
        }
      }

      await ctx.db.patch(apprentice._id, { skills });

      // Check for promotion to journeyman
      const relevantSkill = skills[config.relatedSkills[0]] || 0;
      const yearsInGuild = (tick - (apprentice.guildJoinTick || tick)) / 12;

      if (relevantSkill >= GUILD_RANKS.journeyman.skillRequired &&
          yearsInGuild >= GUILD_RANKS.journeyman.yearsRequired) {
        await ctx.db.patch(apprentice._id, {
          guildRank: "journeyman",
          apprenticeMasterId: undefined,
        });

        await ctx.db.patch(guild._id, {
          apprenticeCount: Math.max(0, guild.apprenticeCount - 1),
          journeymanCount: guild.journeymanCount + 1,
        });

        events.push({
          type: "promotion",
          description: `${apprentice.name} has been promoted to journeyman in ${guild.name}!`,
        });
      }
    }

    // Check journeymen for master promotion
    const journeymen = await ctx.db
      .query("characters")
      .withIndex("by_guild", (q) => q.eq("guildId", guild._id))
      .filter((q) =>
        q.and(
          q.eq(q.field("isAlive"), true),
          q.eq(q.field("guildRank"), "journeyman")
        )
      )
      .collect();

    for (const journeyman of journeymen) {
      const relevantSkill = journeyman.skills?.[config.relatedSkills[0] as keyof typeof journeyman.skills] || 0;
      const yearsInGuild = (tick - (journeyman.guildJoinTick || tick)) / 12;

      if (relevantSkill >= GUILD_RANKS.master.skillRequired &&
          yearsInGuild >= GUILD_RANKS.master.yearsRequired) {
        await ctx.db.patch(journeyman._id, {
          guildRank: "master",
        });

        await ctx.db.patch(guild._id, {
          journeymanCount: Math.max(0, guild.journeymanCount - 1),
          masterCount: guild.masterCount + 1,
        });

        events.push({
          type: "promotion",
          description: `${journeyman.name} has achieved the rank of master in ${guild.name}!`,
        });
      }
    }

    // Guild political influence grows with masters
    const newInfluence = Math.min(100, 10 + guild.masterCount * 5 + (guild.hasMonopoly ? 20 : 0));
    if (newInfluence !== guild.politicalInfluence) {
      await ctx.db.patch(guild._id, {
        politicalInfluence: newInfluence,
      });
    }

    // Quality standard based on masters
    const newQuality = Math.min(100, 30 + guild.masterCount * 10 + guild.trainingQuality / 5);
    if (newQuality !== guild.qualityStandard) {
      await ctx.db.patch(guild._id, {
        qualityStandard: Math.round(newQuality),
      });
    }
  }

  return events;
}

/**
 * Grant a monopoly to a guild
 */
export async function grantMonopoly(
  ctx: MutationCtx,
  guildId: Id<"guilds">,
  tick: number
): Promise<{ success: boolean; message: string }> {
  const guild = await ctx.db.get(guildId);
  if (!guild) {
    return { success: false, message: "Guild not found" };
  }

  if (guild.hasMonopoly) {
    return { success: false, message: "Guild already has a monopoly" };
  }

  await ctx.db.patch(guildId, {
    hasMonopoly: true,
    monopolyGrantedTick: tick,
    politicalInfluence: Math.min(100, guild.politicalInfluence + 20),
    relationshipWithRuler: guild.relationshipWithRuler + 30,
  });

  return {
    success: true,
    message: `${guild.name} has been granted exclusive trading rights`,
  };
}

/**
 * Build a guild hall
 */
export async function buildGuildHall(
  ctx: MutationCtx,
  guildId: Id<"guilds">
): Promise<{ success: boolean; message: string }> {
  const guild = await ctx.db.get(guildId);
  if (!guild) {
    return { success: false, message: "Guild not found" };
  }

  if (guild.hasGuildHall) {
    return { success: false, message: "Guild already has a hall" };
  }

  const cost = 100;
  if (guild.treasury < cost) {
    return { success: false, message: `Not enough funds (need ${cost})` };
  }

  await ctx.db.patch(guildId, {
    hasGuildHall: true,
    guildHallLevel: 1,
    treasury: guild.treasury - cost,
    trainingQuality: Math.min(100, guild.trainingQuality + 15),
    politicalInfluence: Math.min(100, guild.politicalInfluence + 10),
  });

  return {
    success: true,
    message: `${guild.name} has built a guild hall`,
  };
}

/**
 * Get guild statistics for a territory
 */
export async function getGuildStats(
  ctx: QueryCtx,
  territoryId: Id<"territories">
): Promise<{
  guilds: Array<{
    name: string;
    type: string;
    members: number;
    influence: number;
    hasMonopoly: boolean;
  }>;
  totalMembers: number;
  totalInfluence: number;
}> {
  const guilds = await ctx.db
    .query("guilds")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .collect();

  const guildStats = guilds.map((g) => ({
    name: g.name,
    type: g.guildType,
    members: g.memberCount,
    influence: g.politicalInfluence,
    hasMonopoly: g.hasMonopoly,
  }));

  return {
    guilds: guildStats,
    totalMembers: guilds.reduce((sum, g) => sum + g.memberCount, 0),
    totalInfluence: guilds.reduce((sum, g) => sum + g.politicalInfluence, 0),
  };
}

/**
 * Calculate guild production bonuses
 */
export async function calculateGuildBonuses(
  ctx: QueryCtx,
  territoryId: Id<"territories">
): Promise<Record<string, number>> {
  const guilds = await ctx.db
    .query("guilds")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .collect();

  const bonuses: Record<string, number> = {};

  for (const guild of guilds) {
    const config = GUILD_TYPES[guild.guildType as keyof typeof GUILD_TYPES];
    if (!config) continue;

    // Bonus based on quality standard and masters
    const bonus = (guild.qualityStandard / 100) * (1 + guild.masterCount * 0.1);

    if (config.productionBonus) {
      bonuses[config.productionBonus] = (bonuses[config.productionBonus] || 0) + bonus * 10;
    }
  }

  return bonuses;
}
