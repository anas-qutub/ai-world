import { MutationCtx, QueryCtx } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";
import { recordMemory } from "./memory";

// =============================================
// RELIGION SYSTEM
// =============================================
// Religions provide faith, unity, and various bonuses to civilizations.
// Temples spread religion, priests convert followers, and religious
// events shape society.

// Deity name generators
const DEITY_PREFIXES = [
  "The Great", "The Eternal", "The Almighty", "The Divine", "The Sacred",
  "The Holy", "The Ancient", "The Wise", "The Merciful", "The Just",
];

const DEITY_TYPES = [
  "Sun God", "Moon Goddess", "Sky Father", "Earth Mother", "Storm Lord",
  "Sea King", "Fire Spirit", "Wind Dancer", "Mountain Guardian", "Forest Spirit",
  "Harvest Keeper", "War Bringer", "Peace Weaver", "Death Walker", "Life Giver",
  "Cosmic One", "Star Watcher", "Dream Weaver", "Fate Spinner", "Time Keeper",
];

// Core beliefs templates
const BELIEF_TEMPLATES = [
  "Life is sacred and must be protected",
  "The afterlife rewards the faithful",
  "Honor the ancestors and they will guide you",
  "Nature is divine and must be respected",
  "Strength is virtue, weakness is sin",
  "Compassion for all living beings",
  "Knowledge is the path to enlightenment",
  "Duty to community above self",
  "Balance in all things brings harmony",
  "Suffering purifies the soul",
  "Joy is the highest form of worship",
  "Truth must be spoken at all costs",
  "The ruler is chosen by divine will",
  "All are equal before the divine",
  "War is holy when fought for faith",
  "Peace is the highest calling",
];

// Practice templates
const PRACTICE_TEMPLATES = [
  "Daily prayers at sunrise",
  "Weekly communal worship",
  "Monthly fasting rituals",
  "Annual harvest festival",
  "Pilgrimage to holy sites",
  "Offerings at shrines",
  "Meditation and contemplation",
  "Sacred dance ceremonies",
  "Ritual cleansing with water",
  "Burning incense for blessings",
  "Blood sacrifice (animals)",
  "Charitable giving to the poor",
  "Confession of sins to priests",
  "Rites of passage for youth",
  "Funeral rites for the dead",
  "Marriage ceremonies",
];

/**
 * Generate a new religion
 */
export function generateReligion(): {
  deity: string;
  beliefs: string[];
  practices: string[];
  organizationType: "decentralized" | "hierarchical" | "monastic" | "shamanic";
} {
  const prefix = DEITY_PREFIXES[Math.floor(Math.random() * DEITY_PREFIXES.length)];
  const type = DEITY_TYPES[Math.floor(Math.random() * DEITY_TYPES.length)];
  const deity = `${prefix} ${type}`;

  // Pick 3-5 random beliefs
  const shuffledBeliefs = [...BELIEF_TEMPLATES].sort(() => Math.random() - 0.5);
  const beliefs = shuffledBeliefs.slice(0, 3 + Math.floor(Math.random() * 3));

  // Pick 4-6 random practices
  const shuffledPractices = [...PRACTICE_TEMPLATES].sort(() => Math.random() - 0.5);
  const practices = shuffledPractices.slice(0, 4 + Math.floor(Math.random() * 3));

  const orgTypes: Array<"decentralized" | "hierarchical" | "monastic" | "shamanic"> = [
    "decentralized", "hierarchical", "monastic", "shamanic"
  ];
  const organizationType = orgTypes[Math.floor(Math.random() * orgTypes.length)];

  return { deity, beliefs, practices, organizationType };
}

/**
 * Found a new religion
 */
export async function foundReligion(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  founderId: Id<"characters"> | undefined,
  name: string,
  tick: number,
  customReligion?: ReturnType<typeof generateReligion>
): Promise<{ success: boolean; religionId?: Id<"religions">; message: string }> {
  const territory = await ctx.db.get(territoryId);
  if (!territory) {
    return { success: false, message: "Territory not found" };
  }

  const religionData = customReligion || generateReligion();

  // Calculate initial doctrine effects based on beliefs
  const doctrineEffects = {
    fertilityBonus: religionData.beliefs.some(b => b.includes("Life")) ? 5 : 0,
    militaryBonus: religionData.beliefs.some(b => b.includes("War") || b.includes("Strength")) ? 10 : 0,
    happinessBonus: religionData.beliefs.some(b => b.includes("Joy") || b.includes("Peace")) ? 5 : 0,
    educationBonus: religionData.beliefs.some(b => b.includes("Knowledge")) ? 10 : 0,
    wealthPenalty: religionData.beliefs.some(b => b.includes("Charitable")) ? 5 : 0,
  };

  const religionId = await ctx.db.insert("religions", {
    name,
    foundingTerritoryId: territoryId,
    foundedTick: tick,
    founderId,
    deity: religionData.deity,
    beliefs: religionData.beliefs,
    practices: religionData.practices,
    organizationType: religionData.organizationType,
    followerCount: Math.floor(territory.population * 0.1), // Start with 10%
    territoriesPresent: [territoryId],
    doctrineEffects,
    tolerance: 50 + Math.floor(Math.random() * 30), // 50-80
    conversionZeal: 30 + Math.floor(Math.random() * 40), // 30-70
    isStateReligion: undefined,
  });

  // Record memory
  const agent = await ctx.db
    .query("agents")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .first();

  if (agent) {
    await recordMemory(ctx, agent._id, {
      type: "victory",
      description: `The faith of ${name}, worshipping ${religionData.deity}, was founded in our lands.`,
      emotionalWeight: 50,
    });
  }

  return {
    success: true,
    religionId,
    message: `The religion of ${name} has been founded, worshipping ${religionData.deity}`,
  };
}

/**
 * Build a temple
 */
export async function buildTemple(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  religionId: Id<"religions">,
  name: string,
  templeType: "shrine" | "temple" | "cathedral" | "monastery" | "oracle",
  tick: number
): Promise<{ success: boolean; templeId?: Id<"temples">; message: string }> {
  const territory = await ctx.db.get(territoryId);
  const religion = await ctx.db.get(religionId);

  if (!territory) {
    return { success: false, message: "Territory not found" };
  }
  if (!religion) {
    return { success: false, message: "Religion not found" };
  }

  // Cost based on temple type
  const costs: Record<string, number> = {
    shrine: 20,
    temple: 50,
    cathedral: 150,
    monastery: 80,
    oracle: 100,
  };

  const cost = costs[templeType];
  if (territory.wealth < cost) {
    return { success: false, message: `Not enough wealth (need ${cost})` };
  }

  const templeId = await ctx.db.insert("temples", {
    name,
    religionId,
    territoryId,
    level: 1,
    condition: 100,
    constructionTick: tick,
    highPriestId: undefined,
    priestCount: templeType === "shrine" ? 1 : templeType === "temple" ? 3 : 5,
    localInfluence: templeType === "shrine" ? 20 : templeType === "temple" ? 40 : 70,
    pilgrimageDestination: templeType === "cathedral" || templeType === "oracle",
    treasury: 0,
    titheRate: 5, // 5% of followers' wealth
    templeType,
  });

  await ctx.db.patch(territoryId, {
    wealth: territory.wealth - cost,
  });

  // Add territory to religion's presence if not already
  if (!religion.territoriesPresent.includes(territoryId)) {
    await ctx.db.patch(religionId, {
      territoriesPresent: [...religion.territoriesPresent, territoryId],
    });
  }

  return {
    success: true,
    templeId,
    message: `${name} (${templeType}) has been constructed`,
  };
}

/**
 * Convert a character to a religion
 */
export async function convertToReligion(
  ctx: MutationCtx,
  characterId: Id<"characters">,
  religionId: Id<"religions">
): Promise<{ success: boolean; message: string }> {
  const character = await ctx.db.get(characterId);
  const religion = await ctx.db.get(religionId);

  if (!character || !character.isAlive) {
    return { success: false, message: "Character not found or deceased" };
  }
  if (!religion) {
    return { success: false, message: "Religion not found" };
  }

  const oldFaith = character.faith;

  await ctx.db.patch(characterId, {
    faith: religionId,
    piety: 30, // Start with moderate piety
    religiousRank: "layperson",
  });

  // Update follower counts
  if (oldFaith && oldFaith !== religionId) {
    const oldReligion = await ctx.db.get(oldFaith);
    if (oldReligion) {
      await ctx.db.patch(oldFaith, {
        followerCount: Math.max(0, oldReligion.followerCount - 1),
      });
    }
  }

  await ctx.db.patch(religionId, {
    followerCount: religion.followerCount + 1,
  });

  return {
    success: true,
    message: `${character.name} converted to ${religion.name}`,
  };
}

/**
 * Ordain a character as priest
 */
export async function ordainPriest(
  ctx: MutationCtx,
  characterId: Id<"characters">,
  templeId: Id<"temples">
): Promise<{ success: boolean; message: string }> {
  const character = await ctx.db.get(characterId);
  const temple = await ctx.db.get(templeId);

  if (!character || !character.isAlive) {
    return { success: false, message: "Character not found or deceased" };
  }
  if (!temple) {
    return { success: false, message: "Temple not found" };
  }

  // Check if they follow the right religion
  if (character.faith !== temple.religionId) {
    return { success: false, message: "Character does not follow this religion" };
  }

  // Check piety requirement
  if ((character.piety || 0) < 50) {
    return { success: false, message: "Character needs higher piety (50+)" };
  }

  // Check theology skill
  const theology = character.skills?.theology || 0;
  if (theology < 30) {
    return { success: false, message: "Character needs theology skill (30+)" };
  }

  await ctx.db.patch(characterId, {
    profession: "priest" as any,
    religiousRank: "priest",
  });

  await ctx.db.patch(templeId, {
    priestCount: temple.priestCount + 1,
  });

  return {
    success: true,
    message: `${character.name} has been ordained as a priest`,
  };
}

/**
 * Process religion each tick
 */
export async function processReligion(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  tick: number
): Promise<Array<{ type: string; description: string }>> {
  const events: Array<{ type: string; description: string }> = [];

  // Get all temples in territory
  const temples = await ctx.db
    .query("temples")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .collect();

  for (const temple of temples) {
    const religion = await ctx.db.get(temple.religionId);
    if (!religion) continue;

    // Collect tithes
    if (temple.titheRate > 0 && temple.priestCount > 0) {
      const titheCollected = Math.floor(religion.followerCount * temple.titheRate / 100);
      await ctx.db.patch(temple._id, {
        treasury: temple.treasury + titheCollected,
      });
    }

    // Spread religion (conversion)
    if (religion.conversionZeal > 30 && temple.priestCount > 0) {
      const territory = await ctx.db.get(territoryId);
      if (territory) {
        const conversionChance = (temple.localInfluence / 100) * (religion.conversionZeal / 100) * (temple.priestCount / 10);

        if (Math.random() < conversionChance * 0.1) {
          // Convert some population
          const newFollowers = Math.floor(Math.random() * 10) + 1;
          await ctx.db.patch(religion._id, {
            followerCount: religion.followerCount + newFollowers,
          });
        }
      }
    }

    // Temple maintenance
    if (temple.condition > 0) {
      const maintenanceCost = temple.level * 2;
      if (temple.treasury >= maintenanceCost) {
        await ctx.db.patch(temple._id, {
          treasury: temple.treasury - maintenanceCost,
          condition: Math.min(100, temple.condition + 1),
        });
      } else {
        // Temple degrades
        await ctx.db.patch(temple._id, {
          condition: Math.max(0, temple.condition - 2),
        });

        if (temple.condition <= 20) {
          events.push({
            type: "warning",
            description: `${temple.name} is falling into disrepair!`,
          });
        }
      }
    }

    // Religious events (rare)
    if (Math.random() < 0.01) { // 1% chance per tick
      const eventTypes = [
        { type: "miracle", desc: `A miracle has been reported at ${temple.name}!`, happinessBonus: 5 },
        { type: "vision", desc: `A priest at ${temple.name} received a divine vision.`, faithBonus: 10 },
        { type: "festival", desc: `A religious festival is celebrated at ${temple.name}.`, happinessBonus: 3 },
      ];

      const event = eventTypes[Math.floor(Math.random() * eventTypes.length)];
      events.push({ type: event.type, description: event.desc });

      // Apply bonus
      const territory = await ctx.db.get(territoryId);
      if (territory && event.happinessBonus) {
        await ctx.db.patch(territoryId, {
          happiness: Math.min(100, territory.happiness + event.happinessBonus),
        });
      }
    }
  }

  // Piety changes for characters
  const characters = await ctx.db
    .query("characters")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .filter((q) =>
      q.and(
        q.eq(q.field("isAlive"), true),
        q.neq(q.field("faith"), undefined)
      )
    )
    .collect();

  for (const character of characters) {
    if (character.piety !== undefined) {
      // Priests gain piety
      if (character.profession === "priest" || character.profession === "monk") {
        const newPiety = Math.min(100, character.piety + 0.5);
        await ctx.db.patch(character._id, { piety: newPiety });
      }
      // Others slowly lose piety without temple visits (simulated)
      else if (temples.length === 0) {
        const newPiety = Math.max(0, character.piety - 0.1);
        await ctx.db.patch(character._id, { piety: newPiety });
      }
    }
  }

  return events;
}

/**
 * Declare a state religion
 */
export async function declareStateReligion(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  religionId: Id<"religions">
): Promise<{ success: boolean; message: string }> {
  const territory = await ctx.db.get(territoryId);
  const religion = await ctx.db.get(religionId);

  if (!territory) {
    return { success: false, message: "Territory not found" };
  }
  if (!religion) {
    return { success: false, message: "Religion not found" };
  }

  // Check if religion has presence here
  if (!religion.territoriesPresent.includes(territoryId)) {
    return { success: false, message: "Religion has no presence in this territory" };
  }

  await ctx.db.patch(religionId, {
    isStateReligion: territoryId,
  });

  return {
    success: true,
    message: `${religion.name} is now the state religion of ${territory.name}`,
  };
}

/**
 * Get religion statistics for a territory
 */
export async function getReligionStats(
  ctx: QueryCtx,
  territoryId: Id<"territories">
): Promise<{
  religions: Array<{ name: string; followers: number; temples: number }>;
  stateReligion: string | null;
  totalTemples: number;
  totalPriests: number;
}> {
  const temples = await ctx.db
    .query("temples")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .collect();

  const religionIds = [...new Set(temples.map((t) => t.religionId))];
  const religions: Array<{ name: string; followers: number; temples: number }> = [];
  let stateReligion: string | null = null;
  let totalPriests = 0;

  for (const religionId of religionIds) {
    const religion = await ctx.db.get(religionId);
    if (religion) {
      const templeCount = temples.filter((t) => t.religionId === religionId).length;
      religions.push({
        name: religion.name,
        followers: religion.followerCount,
        temples: templeCount,
      });

      if (religion.isStateReligion === territoryId) {
        stateReligion = religion.name;
      }
    }
  }

  totalPriests = temples.reduce((sum, t) => sum + t.priestCount, 0);

  return {
    religions,
    stateReligion,
    totalTemples: temples.length,
    totalPriests,
  };
}

/**
 * Calculate religion's effect on territory
 */
export async function calculateReligionEffects(
  ctx: QueryCtx,
  territoryId: Id<"territories">
): Promise<{
  happinessBonus: number;
  militaryBonus: number;
  fertilityBonus: number;
  educationBonus: number;
}> {
  const temples = await ctx.db
    .query("temples")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .collect();

  let totalEffects = {
    happinessBonus: 0,
    militaryBonus: 0,
    fertilityBonus: 0,
    educationBonus: 0,
  };

  for (const temple of temples) {
    const religion = await ctx.db.get(temple.religionId);
    if (!religion) continue;

    const influence = temple.localInfluence / 100;
    totalEffects.happinessBonus += religion.doctrineEffects.happinessBonus * influence;
    totalEffects.militaryBonus += religion.doctrineEffects.militaryBonus * influence;
    totalEffects.fertilityBonus += religion.doctrineEffects.fertilityBonus * influence;
    totalEffects.educationBonus += religion.doctrineEffects.educationBonus * influence;
  }

  return totalEffects;
}
