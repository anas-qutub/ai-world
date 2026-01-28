import { MutationCtx, QueryCtx } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";
import { recordMemory } from "./memory";

// =============================================
// RELIGION SYSTEM - ORGANIC EMERGENCE
// =============================================
// Religions emerge organically from a civilization's environment,
// experiences, and history. A coastal people worship the sea,
// a war-torn society develops beliefs about the afterlife,
// a prosperous nation celebrates joy and abundance.

// =============================================
// ENVIRONMENT-BASED DEITY MAPPING
// =============================================

// Deities that make sense for different environments
const ENVIRONMENT_DEITIES: Record<string, { primary: string[]; secondary: string[] }> = {
  // Coastal/Island territories
  coastal: {
    primary: ["The Ocean Father", "The Sea Mother", "The Tide Lord", "The Wave Keeper", "The Deep One"],
    secondary: ["The Storm Bringer", "The Fish Giver", "The Pearl Guardian", "The Coral Spirit"],
  },
  // Desert/Arid regions
  desert: {
    primary: ["The Burning Sun", "The Oasis Keeper", "The Sand Walker", "The Eternal Flame", "The Water Giver"],
    secondary: ["The Night Star", "The Cool Wind", "The Shade Bringer", "The Mirage Spirit"],
  },
  // Forested regions
  forest: {
    primary: ["The Forest Mother", "The Green Father", "The Tree Spirit", "The Wild Hunter", "The Leaf Keeper"],
    secondary: ["The Animal Speaker", "The Root Walker", "The Mushroom Sage", "The Bird Caller"],
  },
  // Mountain regions
  mountain: {
    primary: ["The Sky Father", "The Thunder Lord", "The Peak Guardian", "The Stone Mother", "The Eagle Spirit"],
    secondary: ["The Avalanche Bringer", "The Cave Dweller", "The Wind Howler", "The Goat Guide"],
  },
  // Plains/Grasslands
  plains: {
    primary: ["The Horizon Walker", "The Grass Mother", "The Wind Runner", "The Sky Watcher", "The Herd Keeper"],
    secondary: ["The Buffalo Spirit", "The Prairie Fire", "The Seed Sower", "The Rain Dancer"],
  },
  // River valleys
  river: {
    primary: ["The River Mother", "The Flow Keeper", "The Flood Bringer", "The Fish Father", "The Reed Spirit"],
    secondary: ["The Fertile One", "The Mud Shaper", "The Current Guide", "The Delta Guardian"],
  },
  // Cold/Arctic regions
  arctic: {
    primary: ["The Frozen One", "The Aurora Spirit", "The Ice Father", "The Long Night", "The Blizzard Mother"],
    secondary: ["The Seal Giver", "The Fire Keeper", "The Warmth Bringer", "The Snow Walker"],
  },
  // Default/Generic
  default: {
    primary: ["The Great Spirit", "The Divine One", "The Creator", "The Eternal", "The All-Seeing"],
    secondary: ["The Life Giver", "The Death Walker", "The Fate Weaver", "The Dream Keeper"],
  },
};

// =============================================
// EXPERIENCE-BASED BELIEFS
// =============================================

// Beliefs that emerge from different experiences
const EXPERIENCE_BELIEFS: Record<string, string[]> = {
  // After wars and conflict
  war_survivor: [
    "The fallen warriors feast in the halls of the divine",
    "Strength in battle pleases the gods",
    "Those who die defending their people are blessed",
    "Our enemies are cursed by the divine",
  ],
  war_weary: [
    "Peace is the highest calling",
    "Violence begets only more suffering",
    "The divine weeps at bloodshed",
    "Forgiveness is sacred",
  ],
  // After disasters
  disaster_survivor: [
    "Suffering purifies the soul",
    "The divine tests those they love",
    "From destruction comes renewal",
    "We must appease the spirits to prevent calamity",
    "The afterlife rewards those who endure",
  ],
  // Prosperity and abundance
  prosperous: [
    "Joy is the highest form of worship",
    "The divine rewards the faithful with abundance",
    "Generosity brings blessings",
    "Life is a gift to be celebrated",
  ],
  // Famine and hardship
  famine_survivor: [
    "Sacrifice ensures survival",
    "The divine provides for the faithful",
    "Waste is a sin against the sacred",
    "Share what you have, for tomorrow is uncertain",
  ],
  // High knowledge/scholarly
  scholarly: [
    "Knowledge is the path to enlightenment",
    "The divine reveals truth to the wise",
    "Understanding the world honors the creator",
    "Questions are prayers",
  ],
  // Military-focused society
  militaristic: [
    "Strength is virtue, weakness is sin",
    "The gods favor the bold",
    "War is holy when fought for righteous cause",
    "Honor in battle is the path to paradise",
  ],
  // Community-focused
  communal: [
    "Duty to community above self",
    "All are equal before the divine",
    "The tribe is sacred, the individual serves",
    "Together we are blessed, alone we are nothing",
  ],
  // Death and loss
  grieving: [
    "The dead watch over the living",
    "Honor the ancestors and they will guide you",
    "Death is not an end but a transformation",
    "The afterlife reunites those who loved",
  ],
  // Nature-connected
  nature_reverent: [
    "Nature is divine and must be respected",
    "The land is sacred, we are its guardians",
    "All living things carry the spark of divinity",
    "Harmony with nature brings blessings",
  ],
  // Default universal beliefs
  universal: [
    "Life is sacred and must be protected",
    "Truth must be spoken at all costs",
    "The ruler is chosen by divine will",
    "Balance in all things brings harmony",
    "Marriage ceremonies",
    "Rites of passage for youth",
  ],
};

// =============================================
// ENVIRONMENT/EXPERIENCE-BASED PRACTICES
// =============================================

const ENVIRONMENT_PRACTICES: Record<string, string[]> = {
  coastal: [
    "Offerings cast into the sea",
    "Blessing of the boats at dawn",
    "Festival of the first catch",
    "Prayers during storms for safe return",
  ],
  desert: [
    "Prayers at sunrise and sunset",
    "Water blessing ceremonies",
    "Night sky worship under the stars",
    "Pilgrimage to sacred oases",
  ],
  forest: [
    "Sacred grove ceremonies",
    "Offerings hung from trees",
    "Hunting rituals for permission from spirits",
    "Festival of the green awakening in spring",
  ],
  mountain: [
    "Pilgrimage to sacred peaks",
    "Echo prayers to the sky",
    "Stone circle ceremonies",
    "Thunder prayers during storms",
  ],
  plains: [
    "Following the herds as sacred duty",
    "Sky watching for divine signs",
    "Grass burning ceremonies for renewal",
    "Wind prayers for guidance",
  ],
  river: [
    "Ritual cleansing in sacred waters",
    "Flood prayers for fertile lands",
    "Floating offerings downstream",
    "Fishing season blessings",
  ],
  arctic: [
    "Fire keeping as sacred duty",
    "Aurora worship ceremonies",
    "Seal hunting blessings",
    "Long night vigils in winter",
  ],
};

const EXPERIENCE_PRACTICES: Record<string, string[]> = {
  war_focused: [
    "Warrior initiation rites",
    "Battle prayers before combat",
    "Victory celebrations with sacrifice",
    "Memorial rites for fallen warriors",
  ],
  peaceful: [
    "Meditation and contemplation",
    "Peace pipe ceremonies",
    "Conflict resolution through prayer",
    "Hospitality to strangers as sacred duty",
  ],
  scholarly: [
    "Reading sacred texts",
    "Debates as form of worship",
    "Library keeping as sacred duty",
    "Teaching the young as blessing",
  ],
  agricultural: [
    "Harvest festival",
    "Seed blessing ceremonies",
    "Rain dances and prayers",
    "First fruits offerings",
  ],
};

// Universal practices all religions tend to have
const UNIVERSAL_PRACTICES = [
  "Marriage ceremonies",
  "Funeral rites for the dead",
  "Rites of passage for youth",
  "Weekly communal worship",
  "Charitable giving to the poor",
];

// =============================================
// CONTEXT FOR ORGANIC GENERATION
// =============================================

export interface ReligionGenerationContext {
  // Environment
  continent?: string;  // "North America", "Africa", etc.
  biome?: string;      // "coastal", "desert", "forest", etc.
  naturalResources?: string[];

  // History and experiences
  hasExperiencedWar?: boolean;
  hasExperiencedDisaster?: boolean;
  hasExperiencedFamine?: boolean;
  hasExperiencedProsperity?: boolean;
  recentDeaths?: number;  // Significant deaths in community

  // Current state
  population?: number;
  happiness?: number;
  military?: number;
  knowledge?: number;

  // Existing culture
  existingTraditions?: string[];
  existingBeliefs?: string;
}

/**
 * Determine biome from continent and resources
 */
function determineBiome(continent?: string, resources?: string[]): string {
  // Check resources for hints
  if (resources) {
    if (resources.some(r => r.toLowerCase().includes("fish") || r.toLowerCase().includes("pearl"))) {
      return "coastal";
    }
    if (resources.some(r => r.toLowerCase().includes("gold") || r.toLowerCase().includes("spice"))) {
      return "desert";
    }
    if (resources.some(r => r.toLowerCase().includes("timber") || r.toLowerCase().includes("fur"))) {
      return "forest";
    }
    if (resources.some(r => r.toLowerCase().includes("iron") || r.toLowerCase().includes("gem"))) {
      return "mountain";
    }
    if (resources.some(r => r.toLowerCase().includes("grain") || r.toLowerCase().includes("horse"))) {
      return "plains";
    }
  }

  // Default by continent
  switch (continent) {
    case "Africa": return Math.random() > 0.5 ? "desert" : "plains";
    case "Europe": return Math.random() > 0.5 ? "forest" : "plains";
    case "Asia": return Math.random() > 0.5 ? "mountain" : "river";
    case "North America": return Math.random() > 0.5 ? "forest" : "plains";
    case "South America": return Math.random() > 0.5 ? "forest" : "river";
    case "Australia": return Math.random() > 0.5 ? "desert" : "coastal";
    default: return "default";
  }
}

/**
 * Generate an organic religion based on context
 */
export function generateOrganicReligion(context: ReligionGenerationContext): {
  deity: string;
  beliefs: string[];
  practices: string[];
  organizationType: "decentralized" | "hierarchical" | "monastic" | "shamanic";
  emergenceReason: string;
} {
  const beliefs: string[] = [];
  const practices: string[] = [];
  let emergenceReason = "The people sought meaning in their lives";

  // Determine biome for deity and environmental practices
  const biome = context.biome || determineBiome(context.continent, context.naturalResources);

  // Select deity based on environment
  const envDeities = ENVIRONMENT_DEITIES[biome] || ENVIRONMENT_DEITIES.default;
  const deityPool = [...envDeities.primary, ...envDeities.secondary];
  const deity = deityPool[Math.floor(Math.random() * deityPool.length)];

  // Add environmental practices
  const envPractices = ENVIRONMENT_PRACTICES[biome] || [];
  if (envPractices.length > 0) {
    const shuffled = [...envPractices].sort(() => Math.random() - 0.5);
    practices.push(...shuffled.slice(0, 2));
  }

  // Add beliefs based on experiences

  // War experience shapes beliefs
  if (context.hasExperiencedWar) {
    if (context.happiness && context.happiness < 40) {
      // War-weary people want peace
      beliefs.push(...pickRandom(EXPERIENCE_BELIEFS.war_weary, 2));
      practices.push(...pickRandom(EXPERIENCE_PRACTICES.peaceful, 1));
      emergenceReason = "After the horrors of war, the people turned to faith seeking peace";
    } else {
      // Victorious or militaristic people glorify war
      beliefs.push(...pickRandom(EXPERIENCE_BELIEFS.war_survivor, 2));
      practices.push(...pickRandom(EXPERIENCE_PRACTICES.war_focused, 2));
      emergenceReason = "Through victory in battle, the people found divine favor";
    }
  }

  // Disaster experience
  if (context.hasExperiencedDisaster) {
    beliefs.push(...pickRandom(EXPERIENCE_BELIEFS.disaster_survivor, 2));
    emergenceReason = "In the aftermath of catastrophe, the people sought divine explanation";
  }

  // Famine experience
  if (context.hasExperiencedFamine) {
    beliefs.push(...pickRandom(EXPERIENCE_BELIEFS.famine_survivor, 2));
    practices.push("Fasting rituals to remember hardship");
    practices.push("Food blessing ceremonies");
    emergenceReason = "Through hunger and hardship, the people found faith";
  }

  // Prosperity
  if (context.hasExperiencedProsperity) {
    beliefs.push(...pickRandom(EXPERIENCE_BELIEFS.prosperous, 2));
    practices.push("Feasts of thanksgiving");
    emergenceReason = "In times of plenty, the people gave thanks to the divine";
  }

  // Recent deaths lead to ancestor worship
  if (context.recentDeaths && context.recentDeaths > 10) {
    beliefs.push(...pickRandom(EXPERIENCE_BELIEFS.grieving, 2));
    practices.push("Ancestor shrines in homes");
    practices.push("Annual remembrance of the dead");
    emergenceReason = "Grief for the lost led the people to believe in an afterlife";
  }

  // High knowledge leads to scholarly religion
  if (context.knowledge && context.knowledge > 60) {
    beliefs.push(...pickRandom(EXPERIENCE_BELIEFS.scholarly, 1));
    practices.push(...pickRandom(EXPERIENCE_PRACTICES.scholarly, 1));
  }

  // High military leads to warrior beliefs
  if (context.military && context.military > 60 && !context.hasExperiencedWar) {
    beliefs.push(...pickRandom(EXPERIENCE_BELIEFS.militaristic, 1));
  }

  // Nature reverence for small, connected communities
  if (context.population && context.population < 500) {
    beliefs.push(...pickRandom(EXPERIENCE_BELIEFS.nature_reverent, 1));
  }

  // Add universal beliefs if we don't have enough
  while (beliefs.length < 3) {
    const universalBelief = EXPERIENCE_BELIEFS.universal[Math.floor(Math.random() * EXPERIENCE_BELIEFS.universal.length)];
    if (!beliefs.includes(universalBelief)) {
      beliefs.push(universalBelief);
    }
  }

  // Add universal practices
  practices.push(...pickRandom(UNIVERSAL_PRACTICES, 3));

  // Remove duplicates
  const uniqueBeliefs = [...new Set(beliefs)].slice(0, 5);
  const uniquePractices = [...new Set(practices)].slice(0, 6);

  // Determine organization type based on context
  let organizationType: "decentralized" | "hierarchical" | "monastic" | "shamanic";
  if (context.population && context.population < 200) {
    organizationType = "shamanic"; // Small tribes have spiritual leaders
  } else if (context.knowledge && context.knowledge > 70) {
    organizationType = "monastic"; // Scholarly societies have monasteries
  } else if (context.population && context.population > 1000) {
    organizationType = "hierarchical"; // Large populations need structure
  } else {
    organizationType = "decentralized"; // Default for medium communities
  }

  return {
    deity,
    beliefs: uniqueBeliefs,
    practices: uniquePractices,
    organizationType,
    emergenceReason,
  };
}

/**
 * Helper: pick N random items from array
 */
function pickRandom<T>(array: T[], count: number): T[] {
  const shuffled = [...array].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/**
 * Check if conditions are right for organic religion emergence
 * Returns a reason if religion should emerge, null otherwise
 */
export async function checkReligionEmergence(
  ctx: QueryCtx,
  territoryId: Id<"territories">,
  tick: number
): Promise<{ shouldEmerge: boolean; reason: string; context: ReligionGenerationContext }> {
  const territory = await ctx.db.get(territoryId);
  if (!territory) {
    return { shouldEmerge: false, reason: "", context: {} };
  }

  // Check if already has religion
  const existingReligion = await ctx.db
    .query("religions")
    .withIndex("by_territory", (q: any) => q.eq("foundingTerritoryId", territoryId))
    .first();

  if (existingReligion) {
    return { shouldEmerge: false, reason: "Already has religion", context: {} };
  }

  // Build context
  const context: ReligionGenerationContext = {
    continent: territory.continent,
    naturalResources: (territory as any).naturalResources,
    population: territory.population,
    happiness: territory.happiness,
    military: territory.military,
    knowledge: territory.knowledge,
    existingTraditions: (territory as any).traditions?.map((t: any) => t.name),
    existingBeliefs: (territory as any).beliefs,
  };

  // Check for recent disasters
  const recentDisasters = await ctx.db
    .query("disasters")
    .withIndex("by_territory", (q: any) => q.eq("territoryId", territoryId))
    .filter((q: any) => q.gte(q.field("startTick"), tick - 24)) // Within 2 years
    .collect();
  context.hasExperiencedDisaster = recentDisasters.length > 0;

  // Check for recent wars
  const relationships = await ctx.db
    .query("relationships")
    .filter((q: any) =>
      q.or(
        q.eq(q.field("territory1Id"), territoryId),
        q.eq(q.field("territory2Id"), territoryId)
      )
    )
    .collect();
  context.hasExperiencedWar = relationships.some(r => r.status === "at_war" || (r as any).warHistory?.length > 0);

  // Check for prosperity (high wealth + happiness over time)
  context.hasExperiencedProsperity = territory.wealth > 70 && territory.happiness > 60;

  // Check for famine
  context.hasExperiencedFamine = territory.food < 20;

  // Conditions for emergence:
  let shouldEmerge = false;
  let reason = "";

  // 1. Population threshold (natural complexity requires spiritual framework)
  if (territory.population >= 300 && Math.random() < 0.3) {
    shouldEmerge = true;
    reason = "Growing population seeks shared meaning";
  }

  // 2. After major disaster (seeking explanation)
  if (context.hasExperiencedDisaster && Math.random() < 0.5) {
    shouldEmerge = true;
    reason = "Disaster survivors seek divine explanation";
  }

  // 3. After/during war (dealing with death and seeking protection)
  if (context.hasExperiencedWar && Math.random() < 0.4) {
    shouldEmerge = true;
    reason = "War brings people to seek divine protection";
  }

  // 4. High prosperity + happiness (gratitude and celebration)
  if (context.hasExperiencedProsperity && Math.random() < 0.3) {
    shouldEmerge = true;
    reason = "Prosperous people give thanks to divine forces";
  }

  // 5. Low happiness + high population (need for hope)
  if (territory.happiness < 30 && territory.population > 200 && Math.random() < 0.4) {
    shouldEmerge = true;
    reason = "Suffering people turn to faith for hope";
  }

  // 6. High knowledge society (philosophical development)
  if (territory.knowledge > 70 && Math.random() < 0.3) {
    shouldEmerge = true;
    reason = "Wise thinkers contemplate the nature of existence";
  }

  return { shouldEmerge, reason, context };
}

/**
 * Generate a new religion (legacy function for compatibility)
 */
export function generateReligion(): {
  deity: string;
  beliefs: string[];
  practices: string[];
  organizationType: "decentralized" | "hierarchical" | "monastic" | "shamanic";
} {
  // Use default context for backward compatibility
  const result = generateOrganicReligion({});
  return {
    deity: result.deity,
    beliefs: result.beliefs,
    practices: result.practices,
    organizationType: result.organizationType,
  };
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
  customReligion?: ReturnType<typeof generateReligion>,
  organicContext?: ReligionGenerationContext
): Promise<{ success: boolean; religionId?: Id<"religions">; message: string; emergenceReason?: string }> {
  const territory = await ctx.db.get(territoryId);
  if (!territory) {
    return { success: false, message: "Territory not found" };
  }

  // Use organic generation if context provided, otherwise fall back to legacy
  let religionData: ReturnType<typeof generateReligion> & { emergenceReason?: string };
  if (organicContext) {
    religionData = generateOrganicReligion(organicContext);
  } else if (customReligion) {
    religionData = customReligion;
  } else {
    religionData = generateReligion();
  }

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
    const memoryDescription = religionData.emergenceReason
      ? `${religionData.emergenceReason}. The faith of ${name}, worshipping ${religionData.deity}, emerged among our people.`
      : `The faith of ${name}, worshipping ${religionData.deity}, was founded in our lands.`;

    await recordMemory(ctx, agent._id, {
      type: "victory",
      description: memoryDescription,
      emotionalWeight: 50,
    });
  }

  return {
    success: true,
    religionId,
    message: `The religion of ${name} has been founded, worshipping ${religionData.deity}`,
    emergenceReason: religionData.emergenceReason,
  };
}

/**
 * Organically emerge a religion during tick processing
 * Call this during tick to see if a religion naturally emerges
 */
export async function processOrganicReligionEmergence(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  tick: number
): Promise<{ emerged: boolean; religionId?: Id<"religions">; message?: string }> {
  const territory = await ctx.db.get(territoryId);
  if (!territory) {
    return { emerged: false };
  }

  // Check if already has religion
  const existingReligion = await ctx.db
    .query("religions")
    .withIndex("by_territory", (q: any) => q.eq("foundingTerritoryId", territoryId))
    .first();

  if (existingReligion) {
    return { emerged: false };
  }

  // Build context for organic generation
  const context: ReligionGenerationContext = {
    continent: territory.continent,
    naturalResources: (territory as any).naturalResources,
    population: territory.population,
    happiness: territory.happiness,
    military: territory.military,
    knowledge: territory.knowledge,
    existingTraditions: (territory as any).traditions?.map((t: any) => t.name),
    existingBeliefs: (territory as any).beliefs,
  };

  // Check for recent disasters
  const recentDisasters = await ctx.db
    .query("disasters")
    .withIndex("by_territory", (q: any) => q.eq("territoryId", territoryId))
    .filter((q: any) => q.gte(q.field("startTick"), tick - 24))
    .collect();
  context.hasExperiencedDisaster = recentDisasters.length > 0;

  // Check for recent wars
  const relationships = await ctx.db
    .query("relationships")
    .filter((q: any) =>
      q.or(
        q.eq(q.field("territory1Id"), territoryId),
        q.eq(q.field("territory2Id"), territoryId)
      )
    )
    .collect();
  context.hasExperiencedWar = relationships.some(r => r.status === "at_war" || (r as any).warHistory?.length > 0);

  // Check for prosperity
  context.hasExperiencedProsperity = territory.wealth > 70 && territory.happiness > 60;

  // Check for famine
  context.hasExperiencedFamine = territory.food < 20;

  // Determine if religion should emerge
  let shouldEmerge = false;
  let emergenceChance = 0;

  // Base chance increases with population
  if (territory.population >= 300) emergenceChance += 0.05;
  if (territory.population >= 500) emergenceChance += 0.05;
  if (territory.population >= 1000) emergenceChance += 0.05;

  // Experiences increase chance
  if (context.hasExperiencedDisaster) emergenceChance += 0.15;
  if (context.hasExperiencedWar) emergenceChance += 0.1;
  if (context.hasExperiencedFamine) emergenceChance += 0.1;
  if (territory.happiness < 30) emergenceChance += 0.1;
  if (territory.knowledge > 60) emergenceChance += 0.05;

  shouldEmerge = Math.random() < emergenceChance;

  if (!shouldEmerge) {
    return { emerged: false };
  }

  // Generate the religion organically
  const religionData = generateOrganicReligion(context);

  // Generate a name based on the deity
  const tribeName = (territory as any).tribeName || territory.name;
  const religionName = generateReligionName(tribeName, religionData.deity);

  // Look for a potential founder (wise elder, spiritual person)
  const characters = await ctx.db
    .query("characters")
    .withIndex("by_territory", (q: any) => q.eq("territoryId", territoryId))
    .filter((q: any) => q.eq(q.field("isAlive"), true))
    .collect();

  // Find someone suitable - old, wise, or traumatized
  let founderId: Id<"characters"> | undefined;
  const potentialFounders = characters.filter(c => {
    const age = c.age || 0;
    const mentalHealth = c.mentalHealth;
    // Older, wiser, or those who've suffered
    return age > 40 || (mentalHealth && mentalHealth.trauma > 30);
  });
  if (potentialFounders.length > 0) {
    founderId = potentialFounders[Math.floor(Math.random() * potentialFounders.length)]._id;
  }

  const result = await foundReligion(
    ctx,
    territoryId,
    founderId,
    religionName,
    tick,
    undefined,
    context
  );

  if (result.success) {
    // Update territory happiness (religion brings comfort)
    await ctx.db.patch(territoryId, {
      happiness: Math.min(100, territory.happiness + 5),
    });

    return {
      emerged: true,
      religionId: result.religionId,
      message: `${religionData.emergenceReason}. The people of ${tribeName} have begun worshipping ${religionData.deity}, founding the faith of ${religionName}.`,
    };
  }

  return { emerged: false };
}

/**
 * Generate a religion name based on tribe and deity
 */
function generateReligionName(tribeName: string, deity: string): string {
  const patterns = [
    () => `The Way of ${deity.replace("The ", "")}`,
    () => `${tribeName} Faith`,
    () => `Children of ${deity.replace("The ", "")}`,
    () => `The ${deity.split(" ").pop()} Cult`,
    () => `Followers of ${deity.replace("The ", "")}`,
    () => `The Sacred Path`,
    () => `${tribeName} Beliefs`,
  ];

  return patterns[Math.floor(Math.random() * patterns.length)]();
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

  // RELIGION INFLUENCE: Active religious community provides happiness
  // Throughout history, religion has provided meaning, community, and comfort
  if (temples.length > 0) {
    const territory = await ctx.db.get(territoryId);
    if (territory) {
      // Calculate religious happiness bonus
      let religiousBonus = 0;

      // More temples = more community gatherings and support
      religiousBonus += Math.min(5, temples.length * 1);

      // Calculate average piety of population
      const avgPiety = characters.length > 0
        ? characters.reduce((sum, c) => sum + (c.piety || 0), 0) / characters.length
        : 0;

      // High piety population = stronger faith community
      if (avgPiety > 60) {
        religiousBonus += 3;
      } else if (avgPiety > 30) {
        religiousBonus += 1;
      }

      // State religion gives unity
      const stateReligion = await ctx.db
        .query("religions")
        .filter((q) => q.eq(q.field("isStateReligion"), territoryId))
        .first();

      if (stateReligion) {
        religiousBonus += 2;

        // Check for religious practices that affect daily life
        if (stateReligion.practices) {
          // Charitable giving helps poor, reduces inequality
          if (stateReligion.practices.includes("Charitable giving to the poor")) {
            religiousBonus += 1;
          }
          // Community worship strengthens bonds
          if (stateReligion.practices.includes("Weekly communal worship")) {
            religiousBonus += 1;
          }
        }
      }

      // Apply bonus (slowly, as it represents ongoing effect)
      if (religiousBonus > 0) {
        const smallBonus = Math.min(0.5, religiousBonus / 20); // Max +0.5 per tick
        await ctx.db.patch(territoryId, {
          happiness: Math.min(100, territory.happiness + smallBonus),
        });
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
