import { MutationCtx, QueryCtx } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";
import { recordMemory } from "./memory";

// =============================================
// ORGANIC SURVIVAL TECHNOLOGY DISCOVERY
// =============================================
// Civilizations don't start knowing how to build wells or sewers.
// They discover these technologies through:
// - Experiencing crises (drought leads to well discovery)
// - Accumulating knowledge
// - Having wise individuals who figure things out
// - Trial and error over generations

// =============================================
// SURVIVAL TECHNOLOGY DEFINITIONS
// =============================================

export interface SurvivalTechnology {
  id: string;
  name: string;
  description: string;
  tier: number;                    // 1 = basic, 2 = intermediate, 3 = advanced
  category: "water" | "sanitation" | "food" | "clothing" | "medicine" | "shelter";

  // Discovery requirements
  requirements: {
    minKnowledge?: number;         // Minimum knowledge level
    minPopulation?: number;        // Need enough people to experiment
    triggerCrisis?: string;        // Crisis type that can trigger discovery
    prerequisiteTech?: string;     // Must have discovered this first
    minTechLevel?: number;         // Overall technology level
  };

  // Discovery chance modifiers
  discoveryFactors: {
    baseChance: number;            // Base chance per tick when conditions met
    crisisBonus: number;           // Bonus when experiencing relevant crisis
    scholarBonus: number;          // Bonus per scholar/wise person
    elderBonus: number;            // Bonus from elderly (experience)
  };

  // What it unlocks
  unlocks: string[];               // Action IDs this tech unlocks
}

export const SURVIVAL_TECHNOLOGIES: SurvivalTechnology[] = [
  // =============================================
  // WATER TECHNOLOGIES
  // =============================================
  {
    id: "water_collection",
    name: "Rain Collection",
    description: "Collecting rainwater in containers and natural basins",
    tier: 1,
    category: "water",
    requirements: {
      minKnowledge: 5,
      minPopulation: 20,
    },
    discoveryFactors: {
      baseChance: 0.1,      // Easy to discover
      crisisBonus: 0.3,     // Drought makes it obvious
      scholarBonus: 0.05,
      elderBonus: 0.05,
    },
    unlocks: ["collect_rainwater"],
  },
  {
    id: "well_digging",
    name: "Well Digging",
    description: "Digging into the earth to reach underground water",
    tier: 2,
    category: "water",
    requirements: {
      minKnowledge: 15,
      minPopulation: 50,
      triggerCrisis: "drought",
      prerequisiteTech: "water_collection",
    },
    discoveryFactors: {
      baseChance: 0.02,
      crisisBonus: 0.15,    // Desperation drives innovation
      scholarBonus: 0.03,
      elderBonus: 0.02,
    },
    unlocks: ["dig_well"],
  },
  {
    id: "water_storage",
    name: "Water Storage",
    description: "Building cisterns and containers to store water",
    tier: 2,
    category: "water",
    requirements: {
      minKnowledge: 20,
      minPopulation: 100,
      prerequisiteTech: "well_digging",
    },
    discoveryFactors: {
      baseChance: 0.03,
      crisisBonus: 0.1,
      scholarBonus: 0.04,
      elderBonus: 0.02,
    },
    unlocks: ["build_cistern"],
  },
  {
    id: "aqueducts",
    name: "Aqueducts",
    description: "Channels to transport water from distant sources",
    tier: 3,
    category: "water",
    requirements: {
      minKnowledge: 50,
      minPopulation: 500,
      minTechLevel: 40,
      prerequisiteTech: "water_storage",
    },
    discoveryFactors: {
      baseChance: 0.01,
      crisisBonus: 0.05,
      scholarBonus: 0.05,
      elderBonus: 0.01,
    },
    unlocks: ["build_aqueduct"],
  },

  // =============================================
  // SANITATION TECHNOLOGIES
  // =============================================
  {
    id: "waste_disposal",
    name: "Basic Waste Disposal",
    description: "Understanding that waste should be kept away from living areas",
    tier: 1,
    category: "sanitation",
    requirements: {
      minKnowledge: 10,
      minPopulation: 30,
      triggerCrisis: "disease",
    },
    discoveryFactors: {
      baseChance: 0.05,
      crisisBonus: 0.2,     // Disease outbreak teaches this fast
      scholarBonus: 0.03,
      elderBonus: 0.05,     // Elders notice patterns
    },
    unlocks: ["designate_waste_area"],
  },
  {
    id: "latrine_building",
    name: "Latrine Construction",
    description: "Building dedicated structures for human waste",
    tier: 2,
    category: "sanitation",
    requirements: {
      minKnowledge: 20,
      minPopulation: 100,
      prerequisiteTech: "waste_disposal",
    },
    discoveryFactors: {
      baseChance: 0.03,
      crisisBonus: 0.1,
      scholarBonus: 0.03,
      elderBonus: 0.02,
    },
    unlocks: ["build_latrine"],
  },
  {
    id: "sewer_systems",
    name: "Sewer Systems",
    description: "Underground channels to carry waste away from the city",
    tier: 3,
    category: "sanitation",
    requirements: {
      minKnowledge: 45,
      minPopulation: 500,
      minTechLevel: 35,
      prerequisiteTech: "latrine_building",
    },
    discoveryFactors: {
      baseChance: 0.01,
      crisisBonus: 0.05,
      scholarBonus: 0.04,
      elderBonus: 0.01,
    },
    unlocks: ["build_sewer"],
  },

  // =============================================
  // FOOD PRESERVATION TECHNOLOGIES
  // =============================================
  {
    id: "food_drying",
    name: "Food Drying",
    description: "Drying meat and plants in the sun to preserve them",
    tier: 1,
    category: "food",
    requirements: {
      minKnowledge: 5,
      minPopulation: 20,
    },
    discoveryFactors: {
      baseChance: 0.1,      // Natural observation
      crisisBonus: 0.2,     // Food spoilage teaches this
      scholarBonus: 0.02,
      elderBonus: 0.1,      // Elders remember dried food lasting
    },
    unlocks: ["dry_food"],
  },
  {
    id: "smoking_food",
    name: "Smoking Food",
    description: "Using smoke to preserve meat and fish",
    tier: 2,
    category: "food",
    requirements: {
      minKnowledge: 15,
      minPopulation: 50,
      prerequisiteTech: "food_drying",
      triggerCrisis: "famine",
    },
    discoveryFactors: {
      baseChance: 0.03,
      crisisBonus: 0.15,
      scholarBonus: 0.03,
      elderBonus: 0.05,
    },
    unlocks: ["build_smokehouse", "smoke_food"],
  },
  {
    id: "salt_preservation",
    name: "Salt Preservation",
    description: "Using salt to preserve food for long periods",
    tier: 2,
    category: "food",
    requirements: {
      minKnowledge: 20,
      minPopulation: 100,
      prerequisiteTech: "food_drying",
    },
    discoveryFactors: {
      baseChance: 0.02,
      crisisBonus: 0.1,
      scholarBonus: 0.04,
      elderBonus: 0.03,
    },
    unlocks: ["gather_salt", "preserve_food"],
  },
  {
    id: "fermentation",
    name: "Fermentation",
    description: "Controlled rotting to preserve food and create drinks",
    tier: 3,
    category: "food",
    requirements: {
      minKnowledge: 35,
      minPopulation: 200,
      prerequisiteTech: "salt_preservation",
    },
    discoveryFactors: {
      baseChance: 0.02,
      crisisBonus: 0.05,
      scholarBonus: 0.05,
      elderBonus: 0.03,
    },
    unlocks: ["ferment_food", "brew_alcohol"],
  },

  // =============================================
  // CLOTHING TECHNOLOGIES
  // =============================================
  {
    id: "animal_skins",
    name: "Animal Skin Clothing",
    description: "Using animal hides for warmth and protection",
    tier: 1,
    category: "clothing",
    requirements: {
      minKnowledge: 5,
      minPopulation: 10,
    },
    discoveryFactors: {
      baseChance: 0.15,     // Very natural discovery
      crisisBonus: 0.3,     // Cold weather teaches fast
      scholarBonus: 0.01,
      elderBonus: 0.1,
    },
    unlocks: ["make_basic_clothing"],
  },
  {
    id: "weaving",
    name: "Weaving",
    description: "Creating fabric from plant fibers",
    tier: 2,
    category: "clothing",
    requirements: {
      minKnowledge: 20,
      minPopulation: 100,
      prerequisiteTech: "animal_skins",
    },
    discoveryFactors: {
      baseChance: 0.02,
      crisisBonus: 0.1,
      scholarBonus: 0.04,
      elderBonus: 0.03,
    },
    unlocks: ["make_clothing", "build_loom"],
  },
  {
    id: "tailoring",
    name: "Tailoring",
    description: "Cutting and sewing fitted garments",
    tier: 3,
    category: "clothing",
    requirements: {
      minKnowledge: 40,
      minPopulation: 300,
      prerequisiteTech: "weaving",
    },
    discoveryFactors: {
      baseChance: 0.02,
      crisisBonus: 0.05,
      scholarBonus: 0.05,
      elderBonus: 0.02,
    },
    unlocks: ["make_fitted_clothing", "make_armor_padding"],
  },

  // =============================================
  // MEDICINE TECHNOLOGIES
  // =============================================
  {
    id: "herbal_knowledge",
    name: "Herbal Knowledge",
    description: "Understanding which plants heal and which harm",
    tier: 1,
    category: "medicine",
    requirements: {
      minKnowledge: 10,
      minPopulation: 30,
      triggerCrisis: "disease",
    },
    discoveryFactors: {
      baseChance: 0.05,
      crisisBonus: 0.2,
      scholarBonus: 0.05,
      elderBonus: 0.1,      // Elders remember what worked
    },
    unlocks: ["gather_herbs"],
  },
  {
    id: "wound_treatment",
    name: "Wound Treatment",
    description: "Cleaning and binding wounds to prevent infection",
    tier: 1,
    category: "medicine",
    requirements: {
      minKnowledge: 15,
      minPopulation: 50,
    },
    discoveryFactors: {
      baseChance: 0.04,
      crisisBonus: 0.15,    // War injuries teach this
      scholarBonus: 0.03,
      elderBonus: 0.05,
    },
    unlocks: ["treat_wounds"],
  },
  {
    id: "healer_training",
    name: "Healer Training",
    description: "Passing down healing knowledge to dedicated practitioners",
    tier: 2,
    category: "medicine",
    requirements: {
      minKnowledge: 25,
      minPopulation: 100,
      prerequisiteTech: "herbal_knowledge",
    },
    discoveryFactors: {
      baseChance: 0.02,
      crisisBonus: 0.1,
      scholarBonus: 0.05,
      elderBonus: 0.05,
    },
    unlocks: ["train_healer"],
  },
  {
    id: "surgery",
    name: "Basic Surgery",
    description: "Cutting into the body to remove problems",
    tier: 3,
    category: "medicine",
    requirements: {
      minKnowledge: 50,
      minPopulation: 300,
      minTechLevel: 40,
      prerequisiteTech: "healer_training",
    },
    discoveryFactors: {
      baseChance: 0.01,
      crisisBonus: 0.05,
      scholarBonus: 0.05,
      elderBonus: 0.02,
    },
    unlocks: ["perform_surgery"],
  },

  // =============================================
  // SHELTER TECHNOLOGIES
  // =============================================
  {
    id: "basic_shelter",
    name: "Basic Shelter",
    description: "Building simple structures from branches and leaves",
    tier: 1,
    category: "shelter",
    requirements: {
      minKnowledge: 3,
      minPopulation: 5,
    },
    discoveryFactors: {
      baseChance: 0.2,      // Very natural
      crisisBonus: 0.4,     // Cold/rain teaches fast
      scholarBonus: 0.01,
      elderBonus: 0.1,
    },
    unlocks: ["build_shelter"],
  },
  {
    id: "permanent_housing",
    name: "Permanent Housing",
    description: "Building sturdy structures meant to last",
    tier: 2,
    category: "shelter",
    requirements: {
      minKnowledge: 20,
      minPopulation: 100,
      prerequisiteTech: "basic_shelter",
    },
    discoveryFactors: {
      baseChance: 0.03,
      crisisBonus: 0.1,
      scholarBonus: 0.03,
      elderBonus: 0.03,
    },
    unlocks: ["build_houses"],
  },
  {
    id: "insulation",
    name: "Insulation Techniques",
    description: "Keeping buildings warm in winter and cool in summer",
    tier: 2,
    category: "shelter",
    requirements: {
      minKnowledge: 25,
      minPopulation: 150,
      prerequisiteTech: "permanent_housing",
      triggerCrisis: "exposure",
    },
    discoveryFactors: {
      baseChance: 0.02,
      crisisBonus: 0.15,
      scholarBonus: 0.04,
      elderBonus: 0.03,
    },
    unlocks: ["insulate_buildings"],
  },
  {
    id: "stone_masonry",
    name: "Stone Masonry",
    description: "Building with cut stone for permanence and strength",
    tier: 3,
    category: "shelter",
    requirements: {
      minKnowledge: 45,
      minPopulation: 400,
      minTechLevel: 35,
      prerequisiteTech: "permanent_housing",
    },
    discoveryFactors: {
      baseChance: 0.01,
      crisisBonus: 0.03,
      scholarBonus: 0.04,
      elderBonus: 0.02,
    },
    unlocks: ["build_stone_buildings", "build_walls"],
  },
];

// =============================================
// DISCOVERY TRACKING
// =============================================

export interface TerritoryDiscoveries {
  discovered: string[];           // Tech IDs that have been discovered
  inProgress: {                   // Techs being figured out
    techId: string;
    progress: number;             // 0-100
    startTick: number;
  }[];
  recentDiscovery?: {
    techId: string;
    tick: number;
    discoveredBy?: string;        // Character name if applicable
  };
}

/**
 * Get technologies available for discovery
 */
export function getAvailableTechsForDiscovery(
  discovered: string[],
  knowledge: number,
  population: number,
  techLevel: number
): SurvivalTechnology[] {
  return SURVIVAL_TECHNOLOGIES.filter(tech => {
    // Already discovered?
    if (discovered.includes(tech.id)) return false;

    // Check requirements
    const req = tech.requirements;

    if (req.minKnowledge && knowledge < req.minKnowledge) return false;
    if (req.minPopulation && population < req.minPopulation) return false;
    if (req.minTechLevel && techLevel < req.minTechLevel) return false;
    if (req.prerequisiteTech && !discovered.includes(req.prerequisiteTech)) return false;

    return true;
  });
}

/**
 * Check if an action is unlocked
 */
export function isActionUnlocked(
  actionId: string,
  discovered: string[]
): boolean {
  // Some basic actions are always available
  const alwaysAvailable = [
    "gather_food", "gather_wood", "rest", "explore_land",
    "train_warriors", "grow_community", "develop_tools",
  ];

  if (alwaysAvailable.includes(actionId)) return true;

  // Check if any discovered tech unlocks this action
  for (const techId of discovered) {
    const tech = SURVIVAL_TECHNOLOGIES.find(t => t.id === techId);
    if (tech && tech.unlocks.includes(actionId)) {
      return true;
    }
  }

  return false;
}

/**
 * Process organic technology discovery for a territory
 */
export async function processDiscovery(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  tick: number,
  currentCrisis?: string  // "drought", "disease", "famine", "exposure"
): Promise<{ discovered?: SurvivalTechnology; message?: string }> {
  const territory = await ctx.db.get(territoryId);
  if (!territory) return {};

  // Get current discoveries
  const discoveries: TerritoryDiscoveries = (territory as any).discoveries || {
    discovered: [],
    inProgress: [],
  };

  // Get characters for bonuses
  const characters = await ctx.db
    .query("characters")
    .withIndex("by_territory", (q: any) => q.eq("territoryId", territoryId))
    .filter((q: any) => q.eq(q.field("isAlive"), true))
    .collect();

  const scholars = characters.filter(c =>
    c.profession === "scholar" ||
    c.role === "priest" ||
    (c.traits.intelligence || 50) > 70
  );

  const elders = characters.filter(c => (c.age || 0) > 50);

  // Get available techs
  const availableTechs = getAvailableTechsForDiscovery(
    discoveries.discovered,
    territory.knowledge,
    territory.population,
    territory.technology
  );

  if (availableTechs.length === 0) return {};

  // Check each available tech for discovery
  for (const tech of availableTechs) {
    // Calculate discovery chance
    let chance = tech.discoveryFactors.baseChance;

    // Crisis bonus - the mother of invention
    if (currentCrisis && tech.requirements.triggerCrisis === currentCrisis) {
      chance += tech.discoveryFactors.crisisBonus;
    }

    // Scholar bonus
    chance += scholars.length * tech.discoveryFactors.scholarBonus;

    // Elder bonus (wisdom of experience)
    chance += elders.length * tech.discoveryFactors.elderBonus;

    // Knowledge level bonus
    const knowledgeBonus = (territory.knowledge - (tech.requirements.minKnowledge || 0)) / 200;
    chance += Math.max(0, knowledgeBonus);

    // Check for discovery
    if (Math.random() < chance) {
      // Discovery made!
      const newDiscovered = [...discoveries.discovered, tech.id];

      // Find who discovered it
      let discoverer: Doc<"characters"> | undefined;
      if (scholars.length > 0 && Math.random() < 0.6) {
        discoverer = scholars[Math.floor(Math.random() * scholars.length)];
      } else if (elders.length > 0 && Math.random() < 0.4) {
        discoverer = elders[Math.floor(Math.random() * elders.length)];
      }

      // Update territory
      await ctx.db.patch(territoryId, {
        discoveries: {
          discovered: newDiscovered,
          inProgress: discoveries.inProgress.filter(p => p.techId !== tech.id),
          recentDiscovery: {
            techId: tech.id,
            tick,
            discoveredBy: discoverer?.name,
          },
        },
        // Knowledge boost from discovery
        knowledge: Math.min(100, territory.knowledge + 2),
      } as any);

      // Create event
      const tribeName = (territory as any).tribeName || territory.name;
      const discovererText = discoverer
        ? `${discoverer.name} has discovered`
        : `The people of ${tribeName} have discovered`;

      await ctx.db.insert("events", {
        tick,
        type: "breakthrough",
        territoryId,
        title: `Discovery: ${tech.name}!`,
        description: `${discovererText} ${tech.name.toLowerCase()}! ${tech.description}. New abilities unlocked: ${tech.unlocks.join(", ")}.`,
        severity: "positive",
        createdAt: Date.now(),
      });

      // Record memory
      const agent = await ctx.db
        .query("agents")
        .withIndex("by_territory", (q: any) => q.eq("territoryId", territoryId))
        .first();

      if (agent) {
        await recordMemory(ctx, agent._id, {
          type: "victory",
          description: `We discovered ${tech.name}! ${tech.description}`,
          emotionalWeight: 40,
        });
      }

      // If discoverer exists, they gain prestige
      if (discoverer) {
        await ctx.db.patch(discoverer._id, {
          traits: {
            ...discoverer.traits,
            intelligence: Math.min(100, (discoverer.traits.intelligence || 50) + 5),
          },
        });
      }

      return {
        discovered: tech,
        message: `${discovererText} ${tech.name}!`,
      };
    }
  }

  return {};
}

/**
 * Check if territory has discovered a technology
 */
export async function hasTechnology(
  ctx: QueryCtx,
  territoryId: Id<"territories">,
  techId: string
): Promise<boolean> {
  const territory = await ctx.db.get(territoryId);
  if (!territory) return false;

  const discoveries: TerritoryDiscoveries = (territory as any).discoveries || {
    discovered: [],
    inProgress: [],
  };

  return discoveries.discovered.includes(techId);
}

/**
 * Get all discovered technologies for a territory
 */
export async function getDiscoveredTechnologies(
  ctx: QueryCtx,
  territoryId: Id<"territories">
): Promise<SurvivalTechnology[]> {
  const territory = await ctx.db.get(territoryId);
  if (!territory) return [];

  const discoveries: TerritoryDiscoveries = (territory as any).discoveries || {
    discovered: [],
    inProgress: [],
  };

  return SURVIVAL_TECHNOLOGIES.filter(tech =>
    discoveries.discovered.includes(tech.id)
  );
}

/**
 * Get technologies available for discovery (for AI prompt)
 */
export async function getAvailableDiscoveries(
  ctx: QueryCtx,
  territoryId: Id<"territories">
): Promise<{ tech: SurvivalTechnology; chance: string }[]> {
  const territory = await ctx.db.get(territoryId);
  if (!territory) return [];

  const discoveries: TerritoryDiscoveries = (territory as any).discoveries || {
    discovered: [],
    inProgress: [],
  };

  const available = getAvailableTechsForDiscovery(
    discoveries.discovered,
    territory.knowledge,
    territory.population,
    territory.technology
  );

  return available.map(tech => ({
    tech,
    chance: tech.discoveryFactors.baseChance > 0.1 ? "High" :
            tech.discoveryFactors.baseChance > 0.03 ? "Medium" : "Low",
  }));
}

/**
 * Force-discover a technology (for events or special circumstances)
 */
export async function forceDiscovery(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  techId: string,
  tick: number,
  reason: string
): Promise<boolean> {
  const territory = await ctx.db.get(territoryId);
  if (!territory) return false;

  const tech = SURVIVAL_TECHNOLOGIES.find(t => t.id === techId);
  if (!tech) return false;

  const discoveries: TerritoryDiscoveries = (territory as any).discoveries || {
    discovered: [],
    inProgress: [],
  };

  if (discoveries.discovered.includes(techId)) return false;

  await ctx.db.patch(territoryId, {
    discoveries: {
      discovered: [...discoveries.discovered, techId],
      inProgress: discoveries.inProgress,
      recentDiscovery: { techId, tick },
    },
  } as any);

  await ctx.db.insert("events", {
    tick,
    type: "breakthrough",
    territoryId,
    title: `Discovery: ${tech.name}!`,
    description: `${reason}. We have learned ${tech.name.toLowerCase()}.`,
    severity: "positive",
    createdAt: Date.now(),
  });

  return true;
}

/**
 * Get crisis type from current conditions
 */
export function detectCurrentCrisis(territory: Doc<"territories">): string | undefined {
  const water = (territory as any).water;
  const sanitation = (territory as any).sanitation;
  const sickPopulation = (territory as any).sickPopulation || 0;

  // Drought - water shortage
  if (water && water.stored < 10 && water.wells < 1) {
    return "drought";
  }

  // Disease - high sick population or poor sanitation
  if (sickPopulation > territory.population * 0.1) {
    return "disease";
  }
  if (sanitation && sanitation.wasteLevel > 50) {
    return "disease";
  }

  // Famine - low food
  if (territory.food < 20) {
    return "famine";
  }

  // Exposure - shelter shortage
  const shelterCapacity = (territory as any).shelterCapacity || 0;
  if (shelterCapacity < territory.population * 0.7) {
    return "exposure";
  }

  return undefined;
}

/**
 * Initialize basic discoveries for new territory
 * New civilizations start with the most basic knowledge
 */
export async function initializeBasicDiscoveries(
  ctx: MutationCtx,
  territoryId: Id<"territories">
): Promise<void> {
  // Start with tier 1 basics that any human would know
  const basicTechs = [
    "basic_shelter",    // Everyone knows to get out of the rain
    "animal_skins",     // Basic clothing from hunting
  ];

  await ctx.db.patch(territoryId, {
    discoveries: {
      discovered: basicTechs,
      inProgress: [],
    },
  } as any);
}
