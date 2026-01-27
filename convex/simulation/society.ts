import { Doc, Id } from "../_generated/dataModel";
import { MutationCtx } from "../_generated/server";

// Clamp helper
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// Social class definitions
export const SOCIAL_CLASSES = {
  noble: {
    baseProductivity: 0.5,
    basePoliticalPower: 40,
    wealthShare: 30,
    description: "Ruling class with political power",
  },
  warrior: {
    baseProductivity: 1.0,
    basePoliticalPower: 20,
    wealthShare: 15,
    description: "Military class defending the territory",
  },
  merchant: {
    baseProductivity: 1.5,
    basePoliticalPower: 15,
    wealthShare: 25,
    description: "Trading class generating wealth",
  },
  craftsman: {
    baseProductivity: 1.8,
    basePoliticalPower: 10,
    wealthShare: 15,
    description: "Skilled workers producing goods",
  },
  farmer: {
    baseProductivity: 2.0,
    basePoliticalPower: 5,
    wealthShare: 10,
    description: "Agricultural class producing food",
  },
  slave: {
    baseProductivity: 2.5,
    basePoliticalPower: 0,
    wealthShare: 2,
    description: "Enslaved people with no rights",
  },
} as const;

export type SocialClassName = keyof typeof SOCIAL_CLASSES;

// Faction types
export const FACTION_TYPES = {
  political: "Seeks to change government or gain power",
  religious: "Motivated by spiritual beliefs",
  economic: "Seeks to change trade or wealth distribution",
  military: "Seeks military expansion or independence",
  ethnic: "Based on cultural or ethnic identity",
} as const;

// Initialize social classes for a new territory
export async function initializeSocialClasses(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  totalPopulation: number
): Promise<void> {
  // Small tribal populations start mostly as farmers with some warriors
  const distribution = {
    noble: Math.max(1, Math.floor(totalPopulation * 0.02)),
    warrior: Math.floor(totalPopulation * 0.08),
    merchant: Math.floor(totalPopulation * 0.05),
    craftsman: Math.floor(totalPopulation * 0.15),
    farmer: Math.floor(totalPopulation * 0.70),
    slave: 0,
  };

  for (const [className, population] of Object.entries(distribution)) {
    if (population > 0) {
      const classDef = SOCIAL_CLASSES[className as SocialClassName];
      await ctx.db.insert("socialClasses", {
        territoryId,
        className,
        population,
        happiness: 50,
        productivityModifier: classDef.baseProductivity,
        wealthShare: classDef.wealthShare,
        politicalPower: classDef.basePoliticalPower,
      });
    }
  }
}

// Process social class dynamics
export async function processSocialClasses(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  tick: number
): Promise<{
  unrest: number;
  productivity: number;
  events: Array<{ type: string; description: string }>;
}> {
  const events: Array<{ type: string; description: string }> = [];

  const territory = await ctx.db.get(territoryId);
  const classes = await ctx.db
    .query("socialClasses")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .collect();

  if (!territory || classes.length === 0) {
    return { unrest: 0, productivity: 1.0, events: [] };
  }

  let totalUnrest = 0;
  let totalProductivity = 0;
  let totalPopulation = 0;

  for (const socialClass of classes) {
    const classDef = SOCIAL_CLASSES[socialClass.className as SocialClassName];
    if (!classDef) continue;

    // Calculate class happiness based on conditions
    let happinessChange = 0;

    // Food affects happiness
    if (territory.food < 20) {
      happinessChange -= 10;
    } else if (territory.food > 60) {
      happinessChange += 2;
    }

    // Wealth distribution affects happiness
    // Compare actual wealth share to what class expects
    if (socialClass.wealthShare < classDef.wealthShare * 0.5) {
      happinessChange -= 5;
    }

    // Government type affects certain classes
    if (territory.governance === "dictatorship") {
      if (socialClass.className === "noble") happinessChange -= 3;
      if (socialClass.className === "farmer") happinessChange += 1; // More order
    } else if (territory.governance === "democracy") {
      if (socialClass.className === "farmer") happinessChange += 3;
      if (socialClass.className === "noble") happinessChange -= 2; // Less power
    }

    // Update happiness
    const newHappiness = clamp(socialClass.happiness + happinessChange, 0, 100);
    await ctx.db.patch(socialClass._id, {
      happiness: newHappiness,
    });

    // Calculate unrest contribution
    const classUnrest = (100 - newHappiness) * (socialClass.population / 100);
    totalUnrest += classUnrest;

    // Calculate productivity contribution
    const productivityMod = socialClass.productivityModifier * (newHappiness / 100 + 0.5);
    totalProductivity += productivityMod * socialClass.population;
    totalPopulation += socialClass.population;

    // Check for class-based events
    if (newHappiness < 20 && socialClass.population > 5) {
      events.push({
        type: "class_unrest",
        description: `The ${socialClass.className} class is deeply unhappy`,
      });
    }
  }

  const avgUnrest = totalPopulation > 0 ? totalUnrest / classes.length : 0;
  const avgProductivity = totalPopulation > 0 ? totalProductivity / totalPopulation : 1.0;

  return { unrest: avgUnrest, productivity: avgProductivity, events };
}

// Class reform action - redistribute wealth/power
export async function classReform(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  reformType: "redistribute_wealth" | "expand_rights" | "strengthen_hierarchy"
): Promise<{ success: boolean; effects: string[] }> {
  const classes = await ctx.db
    .query("socialClasses")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .collect();

  const effects: string[] = [];

  for (const socialClass of classes) {
    switch (reformType) {
      case "redistribute_wealth":
        // Take from nobles, give to farmers
        if (socialClass.className === "noble") {
          await ctx.db.patch(socialClass._id, {
            wealthShare: Math.max(10, socialClass.wealthShare - 5),
            happiness: Math.max(0, socialClass.happiness - 10),
          });
          effects.push("Nobles lose wealth share");
        } else if (socialClass.className === "farmer" || socialClass.className === "craftsman") {
          await ctx.db.patch(socialClass._id, {
            wealthShare: Math.min(30, socialClass.wealthShare + 3),
            happiness: Math.min(100, socialClass.happiness + 10),
          });
          effects.push("Workers gain wealth share");
        }
        break;

      case "expand_rights":
        // Increase political power for lower classes
        if (socialClass.className === "farmer" || socialClass.className === "craftsman") {
          await ctx.db.patch(socialClass._id, {
            politicalPower: Math.min(30, socialClass.politicalPower + 5),
            happiness: Math.min(100, socialClass.happiness + 8),
          });
          effects.push("Workers gain political power");
        } else if (socialClass.className === "noble") {
          await ctx.db.patch(socialClass._id, {
            happiness: Math.max(0, socialClass.happiness - 5),
          });
        }
        break;

      case "strengthen_hierarchy":
        // Increase noble power, potentially creates stability
        if (socialClass.className === "noble") {
          await ctx.db.patch(socialClass._id, {
            politicalPower: Math.min(60, socialClass.politicalPower + 10),
            happiness: Math.min(100, socialClass.happiness + 5),
          });
          effects.push("Nobles gain power");
        } else {
          await ctx.db.patch(socialClass._id, {
            happiness: Math.max(0, socialClass.happiness - 3),
          });
        }
        break;
    }
  }

  return { success: true, effects };
}

// Create a new faction
export async function createFaction(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  name: string,
  type: keyof typeof FACTION_TYPES,
  ideology: string,
  tick: number
): Promise<{ success: boolean; factionId?: Id<"factions"> }> {
  const territory = await ctx.db.get(territoryId);
  if (!territory) {
    return { success: false };
  }

  // Initial faction size based on territory population
  const initialMembers = Math.floor(territory.population * 0.05);

  const factionId = await ctx.db.insert("factions", {
    territoryId,
    name,
    type,
    ideology,
    power: 10,
    happiness: 50,
    rebellionRisk: 10,
    memberCount: initialMembers,
    foundedAtTick: tick,
  });

  return { success: true, factionId };
}

// Process faction dynamics
export async function processFactions(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  tick: number
): Promise<{
  totalPower: number;
  rebellionRisk: number;
  events: Array<{ type: string; description: string }>;
}> {
  const events: Array<{ type: string; description: string }> = [];

  const territory = await ctx.db.get(territoryId);
  const factions = await ctx.db
    .query("factions")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .collect();

  if (!territory || factions.length === 0) {
    return { totalPower: 0, rebellionRisk: 0, events: [] };
  }

  let totalPower = 0;
  let maxRebellionRisk = 0;

  // Check for ongoing wars affecting faction happiness
  const relationships = await ctx.db
    .query("relationships")
    .withIndex("by_territory1", (q) => q.eq("territory1Id", territoryId))
    .collect();

  const atWar = relationships.some(r => r.status === "at_war");
  const warExhaustion = relationships
    .filter(r => r.status === "at_war")
    .reduce((max, r) => Math.max(max, r.warExhaustion || 0), 0);

  for (const faction of factions) {
    let happinessChange = 0;
    let rebellionChange = 0;

    // War exhaustion increases faction unhappiness
    if (atWar && warExhaustion > 50) {
      happinessChange -= (warExhaustion - 50) / 10;
      rebellionChange += (warExhaustion - 50) / 20;
    }

    // Low food creates unrest
    if (territory.food < 20) {
      happinessChange -= 5;
      rebellionChange += 3;
    }

    // Update faction
    const newHappiness = clamp(faction.happiness + happinessChange, 0, 100);
    const newRebellionRisk = clamp(faction.rebellionRisk + rebellionChange, 0, 100);

    await ctx.db.patch(faction._id, {
      happiness: newHappiness,
      rebellionRisk: newRebellionRisk,
    });

    totalPower += faction.power;
    maxRebellionRisk = Math.max(maxRebellionRisk, newRebellionRisk);

    // Check for rebellion
    if (newRebellionRisk > 80 && Math.random() < (newRebellionRisk - 80) / 100) {
      events.push({
        type: "rebellion_warning",
        description: `The ${faction.name} faction is on the verge of rebellion!`,
      });

      // Create rebellion record if risk is critical
      if (newRebellionRisk > 90) {
        await ctx.db.insert("rebellions", {
          territoryId,
          factionId: faction._id,
          startedAtTick: tick,
          strength: Math.floor(faction.power * (faction.memberCount / 100)),
          demands: faction.ideology || "Change in leadership",
          status: "active",
        });

        events.push({
          type: "rebellion_started",
          description: `The ${faction.name} faction has risen in rebellion!`,
        });
      }
    }
  }

  return { totalPower, rebellionRisk: maxRebellionRisk, events };
}

// Appease a faction
export async function appeaseFaction(
  ctx: MutationCtx,
  factionId: Id<"factions">,
  method: "gold" | "concessions" | "promises"
): Promise<{ success: boolean; effects: string[] }> {
  const faction = await ctx.db.get(factionId);
  if (!faction) {
    return { success: false, effects: [] };
  }

  const effects: string[] = [];

  switch (method) {
    case "gold":
      // Bribery - quick but temporary
      await ctx.db.patch(factionId, {
        happiness: Math.min(100, faction.happiness + 20),
        rebellionRisk: Math.max(0, faction.rebellionRisk - 15),
      });
      effects.push("Faction temporarily appeased with gold");
      break;

    case "concessions":
      // Give them what they want - more lasting
      await ctx.db.patch(factionId, {
        happiness: Math.min(100, faction.happiness + 30),
        rebellionRisk: Math.max(0, faction.rebellionRisk - 25),
        power: Math.min(50, faction.power + 5),
      });
      effects.push("Faction granted concessions, their power grows");
      break;

    case "promises":
      // Cheap but may backfire
      const trustRoll = Math.random();
      if (trustRoll > 0.3) {
        await ctx.db.patch(factionId, {
          happiness: Math.min(100, faction.happiness + 10),
          rebellionRisk: Math.max(0, faction.rebellionRisk - 5),
        });
        effects.push("Faction accepts promises... for now");
      } else {
        await ctx.db.patch(factionId, {
          happiness: Math.max(0, faction.happiness - 5),
          rebellionRisk: Math.min(100, faction.rebellionRisk + 10),
        });
        effects.push("Faction sees through empty promises, anger grows");
      }
      break;
  }

  return { success: true, effects };
}

// Suppress a faction
export async function suppressFaction(
  ctx: MutationCtx,
  factionId: Id<"factions">,
  militaryStrength: number
): Promise<{ success: boolean; casualties: number; effects: string[] }> {
  const faction = await ctx.db.get(factionId);
  if (!faction) {
    return { success: false, casualties: 0, effects: [] };
  }

  const effects: string[] = [];

  // Compare military strength to faction power
  const successChance = militaryStrength / (faction.power + 10);

  if (Math.random() < successChance) {
    // Successful suppression
    const casualties = Math.floor(faction.memberCount * 0.2);
    await ctx.db.patch(factionId, {
      memberCount: Math.max(1, faction.memberCount - casualties),
      power: Math.max(0, faction.power - 20),
      rebellionRisk: Math.max(0, faction.rebellionRisk - 30),
      happiness: Math.max(0, faction.happiness - 20),
    });

    effects.push(`Faction suppressed, ${casualties} members arrested or killed`);
    return { success: true, casualties, effects };
  } else {
    // Failed suppression - faction grows stronger
    await ctx.db.patch(factionId, {
      power: Math.min(100, faction.power + 10),
      rebellionRisk: Math.min(100, faction.rebellionRisk + 20),
    });

    effects.push("Suppression failed, faction gains sympathy and power");
    return { success: false, casualties: 0, effects };
  }
}

// Process active rebellions
export async function processRebellions(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  tick: number
): Promise<{
  resolved: boolean;
  outcome?: "suppressed" | "successful" | "negotiated";
  effects: string[];
}> {
  const effects: string[] = [];

  const rebellions = await ctx.db
    .query("rebellions")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .filter((q) => q.eq(q.field("status"), "active"))
    .collect();

  if (rebellions.length === 0) {
    return { resolved: false, effects: [] };
  }

  const territory = await ctx.db.get(territoryId);
  if (!territory) {
    return { resolved: false, effects: [] };
  }

  for (const rebellion of rebellions) {
    // Each tick, rebellion either grows or shrinks
    const governmentStrength = territory.military + territory.happiness / 2;
    const rebellionStrength = rebellion.strength;

    if (governmentStrength > rebellionStrength * 1.5) {
      // Government winning
      const newStrength = rebellion.strength - 10;
      if (newStrength <= 0) {
        await ctx.db.patch(rebellion._id, { status: "suppressed" });
        effects.push("Rebellion has been suppressed");
        return { resolved: true, outcome: "suppressed", effects };
      }
      await ctx.db.patch(rebellion._id, { strength: newStrength });
    } else if (rebellionStrength > governmentStrength * 1.5) {
      // Rebellion winning
      await ctx.db.patch(rebellion._id, { status: "successful" });
      effects.push("Rebellion has succeeded!");

      // Rebellion effects - government change, leader change
      await ctx.db.patch(territoryId, {
        happiness: Math.max(0, territory.happiness - 20),
        wealth: Math.max(0, territory.wealth - 10),
        governance: "none", // Government overthrown
        leaderName: undefined,
        governmentName: undefined,
      });

      return { resolved: true, outcome: "successful", effects };
    } else {
      // Stalemate - both sides lose
      await ctx.db.patch(territoryId, {
        happiness: Math.max(0, territory.happiness - 5),
        wealth: Math.max(0, territory.wealth - 2),
      });
      effects.push("Rebellion continues, resources being drained");
    }
  }

  return { resolved: false, effects };
}
