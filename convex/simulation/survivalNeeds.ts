import { MutationCtx, QueryCtx } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";
import { recordMemory } from "./memory";
import { Season, SEASONAL_EFFECTS } from "./survival";

// =============================================
// COMPREHENSIVE SURVIVAL NEEDS SYSTEM
// =============================================
// Civilizations need more than just food to survive:
// - Water: The most critical need (death in 3 days without it)
// - Food: Energy and nutrition
// - Shelter: Protection from elements
// - Clothing: Warmth and protection
// - Sanitation: Disease prevention
// - Fuel: Heating in cold seasons
// - Preserved Food: Winter survival

// =============================================
// SURVIVAL CONSTANTS
// =============================================

export const SURVIVAL_CONSTANTS = {
  // Water needs
  water: {
    consumptionPerPerson: 0.5,      // Water units per person per tick
    wellCapacity: 50,               // Water a well provides per tick
    riverBonus: 100,                // Bonus water from river access
    rainCollection: 20,             // Water from rain collection
    droughtMultiplier: 0.3,         // Water available during drought
    dehydrationDeathRate: 0.15,     // 15% of dehydrated people die per tick (fast!)
    contaminationDiseaseChance: 0.3, // Chance of disease from bad water
  },

  // Clothing needs
  clothing: {
    baseNeed: 1,                    // Each person needs 1 clothing unit
    wearRate: 0.05,                 // Clothing degrades 5% per tick
    craftingPerWorker: 2,           // Clothing produced per craftsperson
    winterMultiplier: 1.5,          // Need 50% more clothing in winter
    exposureReduction: 0.7,         // Proper clothing reduces exposure deaths by 70%
    productionPerAction: 10,        // Clothing made per "make_clothing" action
  },

  // Sanitation needs
  sanitation: {
    wastePerPerson: 0.2,            // Waste generated per person per tick
    sewerCapacity: 100,             // Waste a sewer system handles per tick
    diseaseThreshold: 50,           // Waste accumulation before disease risk
    diseaseChancePerWaste: 0.01,    // Disease chance per waste unit over threshold
    cleanupPerAction: 30,           // Waste cleaned per sanitation action
    naturalDecay: 5,                // Waste that naturally decomposes
  },

  // Food preservation
  preservation: {
    spoilageRate: 0.1,              // 10% of unpreserved food spoils per tick
    preservedSpoilageRate: 0.01,    // 1% of preserved food spoils
    saltPerFood: 0.1,               // Salt needed to preserve 1 food
    smokehouseCapacity: 50,         // Food a smokehouse can preserve per tick
    preservePerAction: 20,          // Food preserved per action
    winterSpoilageReduction: 0.5,   // Cold naturally preserves (50% less spoilage)
  },

  // Medicine/Healing
  medicine: {
    herbsPerHealing: 1,             // Herbs needed per healing attempt
    healingSuccessBase: 0.5,        // Base 50% chance to heal sick person
    healerBonus: 0.3,               // Healer adds 30% success chance
    naturalRecoveryRate: 0.1,       // 10% of sick recover naturally per tick
    diseaseDeathRate: 0.05,         // 5% of untreated sick die per tick
  },
};

// =============================================
// WATER SYSTEM
// =============================================

export interface WaterStatus {
  supply: number;           // Current water available
  demand: number;           // Water needed this tick
  shortage: number;         // Unmet demand
  sources: {
    wells: number;
    river: boolean;
    rain: number;
    stored: number;
  };
  quality: number;          // 0-100 water quality (contamination)
  dehydrationDeaths: number;
}

/**
 * Process water needs for a territory
 */
export async function processWaterNeeds(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  tick: number,
  season: Season
): Promise<WaterStatus> {
  const territory = await ctx.db.get(territoryId);
  if (!territory) {
    return {
      supply: 0, demand: 0, shortage: 0,
      sources: { wells: 0, river: false, rain: 0, stored: 0 },
      quality: 100, dehydrationDeaths: 0
    };
  }

  const population = territory.population;
  const waterData = (territory as any).water || {
    stored: 0,
    wells: 0,
    hasRiver: false,
    quality: 100,
  };

  // Calculate demand
  const baseDemand = population * SURVIVAL_CONSTANTS.water.consumptionPerPerson;
  const seasonMultiplier = season === "summer" ? 1.3 : season === "winter" ? 0.8 : 1.0;
  const demand = baseDemand * seasonMultiplier;

  // Calculate supply from various sources
  let supply = 0;

  // Wells
  const wellSupply = waterData.wells * SURVIVAL_CONSTANTS.water.wellCapacity;
  supply += wellSupply;

  // River access
  if (waterData.hasRiver) {
    supply += SURVIVAL_CONSTANTS.water.riverBonus;
  }

  // Rain collection (varies by season)
  let rainSupply = 0;
  if (season === "spring" || season === "autumn") {
    rainSupply = SURVIVAL_CONSTANTS.water.rainCollection;
  } else if (season === "summer") {
    rainSupply = SURVIVAL_CONSTANTS.water.rainCollection * 0.5; // Less rain
  } else {
    rainSupply = 0; // Winter - frozen
  }
  supply += rainSupply;

  // Check for drought (from weather system)
  const weather = await ctx.db
    .query("weather")
    .withIndex("by_territory", (q: any) => q.eq("territoryId", territoryId))
    .first();

  if (weather?.currentWeather === "drought") {
    supply *= SURVIVAL_CONSTANTS.water.droughtMultiplier;
  }

  // Add stored water
  supply += waterData.stored;

  // Calculate shortage
  const shortage = Math.max(0, demand - supply);
  const excess = Math.max(0, supply - demand);

  // Update stored water (excess is stored, up to capacity)
  const maxStorage = 100 + (waterData.wells * 20); // Storage capacity
  const newStored = Math.min(maxStorage, excess);

  // Process dehydration deaths if shortage
  let dehydrationDeaths = 0;
  if (shortage > 0) {
    const dehydratedPopulation = Math.ceil((shortage / demand) * population);
    dehydrationDeaths = Math.floor(dehydratedPopulation * SURVIVAL_CONSTANTS.water.dehydrationDeathRate);

    if (dehydrationDeaths > 0) {
      await ctx.db.patch(territoryId, {
        population: Math.max(10, population - dehydrationDeaths),
        happiness: Math.max(0, territory.happiness - 15),
      });

      await ctx.db.insert("events", {
        tick,
        type: "death",
        territoryId,
        title: "Deaths from Dehydration!",
        description: `${dehydrationDeaths} people died from lack of water. The wells run dry and the people suffer.`,
        severity: "critical",
        createdAt: Date.now(),
      });

      // Record memory
      const agent = await ctx.db
        .query("agents")
        .withIndex("by_territory", (q: any) => q.eq("territoryId", territoryId))
        .first();

      if (agent) {
        await recordMemory(ctx, agent._id, {
          type: "crisis",
          description: `${dehydrationDeaths} of our people died of thirst. We desperately need more water sources.`,
          emotionalWeight: -60,
        });
      }
    }
  }

  // Check water quality and disease risk
  let quality = waterData.quality;
  if (quality < 50 && Math.random() < SURVIVAL_CONSTANTS.water.contaminationDiseaseChance) {
    // Contaminated water causes disease outbreak
    await ctx.db.insert("events", {
      tick,
      type: "death",
      territoryId,
      title: "Waterborne Illness!",
      description: `Contaminated water has caused sickness to spread. Water quality: ${quality}/100.`,
      severity: "warning",
      createdAt: Date.now(),
    });

    // Increase sick population (if tracking disease)
    const currentSick = (territory as any).sickPopulation || 0;
    const newSick = Math.floor(population * 0.1);
    await ctx.db.patch(territoryId, {
      sickPopulation: currentSick + newSick,
    } as any);
  }

  // Update territory water data
  await ctx.db.patch(territoryId, {
    water: {
      ...waterData,
      stored: newStored,
    },
  } as any);

  return {
    supply,
    demand,
    shortage,
    sources: {
      wells: wellSupply,
      river: waterData.hasRiver,
      rain: rainSupply,
      stored: waterData.stored,
    },
    quality,
    dehydrationDeaths,
  };
}

// =============================================
// CLOTHING SYSTEM
// =============================================

export interface ClothingStatus {
  supply: number;           // Clothing units available
  demand: number;           // Clothing needed
  shortage: number;         // People without adequate clothing
  condition: number;        // Average condition 0-100
  exposureModifier: number; // How much clothing reduces exposure
}

/**
 * Process clothing needs
 */
export async function processClothingNeeds(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  tick: number,
  season: Season
): Promise<ClothingStatus> {
  const territory = await ctx.db.get(territoryId);
  if (!territory) {
    return { supply: 0, demand: 0, shortage: 0, condition: 0, exposureModifier: 1 };
  }

  const population = territory.population;
  const clothingData = (territory as any).clothing || {
    supply: 0,
    condition: 50,
  };

  // Calculate demand (more in winter)
  const seasonMultiplier = season === "winter" ? SURVIVAL_CONSTANTS.clothing.winterMultiplier : 1.0;
  const demand = population * SURVIVAL_CONSTANTS.clothing.baseNeed * seasonMultiplier;

  // Clothing degrades over time
  const degradedSupply = clothingData.supply * (1 - SURVIVAL_CONSTANTS.clothing.wearRate);

  // Natural clothing production from craftspeople
  const craftspeople = await ctx.db
    .query("characters")
    .withIndex("by_territory", (q: any) => q.eq("territoryId", territoryId))
    .filter((q: any) => q.and(
      q.eq(q.field("isAlive"), true),
      q.eq(q.field("profession"), "craftsman")
    ))
    .collect();

  const craftedClothing = craftspeople.length * SURVIVAL_CONSTANTS.clothing.craftingPerWorker * 0.3; // 30% make clothes
  const newSupply = Math.min(population * 2, degradedSupply + craftedClothing); // Cap at 2x population

  const shortage = Math.max(0, demand - newSupply);

  // Calculate exposure modifier based on clothing
  let exposureModifier = 1;
  if (newSupply >= demand) {
    exposureModifier = 1 - SURVIVAL_CONSTANTS.clothing.exposureReduction; // 70% reduction
  } else if (newSupply > 0) {
    const coverageRatio = newSupply / demand;
    exposureModifier = 1 - (SURVIVAL_CONSTANTS.clothing.exposureReduction * coverageRatio);
  }

  // Update territory
  await ctx.db.patch(territoryId, {
    clothing: {
      supply: newSupply,
      condition: Math.max(10, clothingData.condition - 1), // Slowly degrades
    },
  } as any);

  // Event if shortage is severe
  if (shortage > population * 0.3 && (season === "winter" || season === "autumn")) {
    await ctx.db.insert("events", {
      tick,
      type: "decision",
      territoryId,
      title: "Clothing Shortage",
      description: `${Math.floor(shortage)} people lack adequate clothing for the cold. They are at risk of exposure.`,
      severity: "warning",
      createdAt: Date.now(),
    });
  }

  return {
    supply: newSupply,
    demand,
    shortage,
    condition: clothingData.condition,
    exposureModifier,
  };
}

// =============================================
// SANITATION SYSTEM
// =============================================

export interface SanitationStatus {
  wasteLevel: number;       // Accumulated waste
  sewerCapacity: number;    // Waste handling capacity
  diseaseRisk: number;      // 0-100 disease risk from sanitation
  events: string[];
}

/**
 * Process sanitation and waste
 */
export async function processSanitation(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  tick: number
): Promise<SanitationStatus> {
  const territory = await ctx.db.get(territoryId);
  if (!territory) {
    return { wasteLevel: 0, sewerCapacity: 0, diseaseRisk: 0, events: [] };
  }

  const events: string[] = [];
  const population = territory.population;
  const sanitationData = (territory as any).sanitation || {
    wasteLevel: 0,
    sewerCapacity: 0,
    latrines: 0,
  };

  // Generate waste
  const wasteGenerated = population * SURVIVAL_CONSTANTS.sanitation.wastePerPerson;

  // Calculate waste handling capacity
  const sewerCapacity = sanitationData.sewerCapacity +
    (sanitationData.latrines || 0) * 10; // Each latrine handles 10 waste

  // Natural decay
  const naturalDecay = SURVIVAL_CONSTANTS.sanitation.naturalDecay;

  // Calculate new waste level
  const wasteHandled = Math.min(wasteGenerated, sewerCapacity);
  const wasteAccumulated = wasteGenerated - wasteHandled;
  const newWasteLevel = Math.max(0, sanitationData.wasteLevel + wasteAccumulated - naturalDecay);

  // Calculate disease risk
  let diseaseRisk = 0;
  if (newWasteLevel > SURVIVAL_CONSTANTS.sanitation.diseaseThreshold) {
    const excessWaste = newWasteLevel - SURVIVAL_CONSTANTS.sanitation.diseaseThreshold;
    diseaseRisk = Math.min(80, excessWaste * SURVIVAL_CONSTANTS.sanitation.diseaseChancePerWaste * 100);
  }

  // Trigger disease if risk is high
  if (diseaseRisk > 30 && Math.random() < diseaseRisk / 100) {
    const sickCount = Math.floor(population * (diseaseRisk / 500)); // Up to 16% get sick

    const currentSick = (territory as any).sickPopulation || 0;
    await ctx.db.patch(territoryId, {
      sickPopulation: currentSick + sickCount,
      happiness: Math.max(0, territory.happiness - 5),
    } as any);

    events.push(`Poor sanitation caused ${sickCount} people to fall ill`);

    await ctx.db.insert("events", {
      tick,
      type: "death",
      territoryId,
      title: "Disease from Poor Sanitation",
      description: `Waste has accumulated to dangerous levels. ${sickCount} people have fallen ill from the filth.`,
      severity: "warning",
      createdAt: Date.now(),
    });
  }

  // Update territory
  await ctx.db.patch(territoryId, {
    sanitation: {
      ...sanitationData,
      wasteLevel: newWasteLevel,
    },
  } as any);

  return {
    wasteLevel: newWasteLevel,
    sewerCapacity,
    diseaseRisk,
    events,
  };
}

// =============================================
// FOOD PRESERVATION SYSTEM
// =============================================

export interface PreservationStatus {
  freshFood: number;
  preservedFood: number;
  spoiledFood: number;
  preservationCapacity: number;
}

/**
 * Process food spoilage and preservation
 */
export async function processFoodPreservation(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  tick: number,
  season: Season
): Promise<PreservationStatus> {
  const territory = await ctx.db.get(territoryId);
  if (!territory) {
    return { freshFood: 0, preservedFood: 0, spoiledFood: 0, preservationCapacity: 0 };
  }

  const preservationData = (territory as any).preservation || {
    preservedFood: 0,
    salt: 0,
    smokehouses: 0,
  };

  const totalFood = territory.food;
  const preservedFood = Math.min(totalFood, preservationData.preservedFood);
  const freshFood = totalFood - preservedFood;

  // Calculate spoilage
  let spoilageRate = SURVIVAL_CONSTANTS.preservation.spoilageRate;

  // Winter reduces spoilage (natural refrigeration)
  if (season === "winter") {
    spoilageRate *= SURVIVAL_CONSTANTS.preservation.winterSpoilageReduction;
  } else if (season === "summer") {
    spoilageRate *= 1.5; // More spoilage in summer
  }

  // Fresh food spoils faster
  const freshSpoiled = Math.floor(freshFood * spoilageRate);
  const preservedSpoiled = Math.floor(preservedFood * SURVIVAL_CONSTANTS.preservation.preservedSpoilageRate);
  const totalSpoiled = freshSpoiled + preservedSpoiled;

  // Preservation capacity (smokehouses + salt)
  const preservationCapacity = (preservationData.smokehouses || 0) * SURVIVAL_CONSTANTS.preservation.smokehouseCapacity;

  // Auto-preserve food if we have capacity and salt
  let newlyPreserved = 0;
  if (preservationCapacity > preservedFood && preservationData.salt > 0) {
    const canPreserve = Math.min(
      preservationCapacity - preservedFood,
      freshFood,
      preservationData.salt / SURVIVAL_CONSTANTS.preservation.saltPerFood
    );
    newlyPreserved = Math.floor(canPreserve * 0.3); // 30% efficiency for auto-preservation

    // Use salt
    const saltUsed = newlyPreserved * SURVIVAL_CONSTANTS.preservation.saltPerFood;
    await ctx.db.patch(territoryId, {
      preservation: {
        ...preservationData,
        preservedFood: preservedFood + newlyPreserved - preservedSpoiled,
        salt: preservationData.salt - saltUsed,
      },
    } as any);
  }

  // Update food (subtract spoilage)
  if (totalSpoiled > 0) {
    await ctx.db.patch(territoryId, {
      food: Math.max(0, totalFood - totalSpoiled),
    });

    if (totalSpoiled > totalFood * 0.15) {
      await ctx.db.insert("events", {
        tick,
        type: "decision",
        territoryId,
        title: "Food Spoilage",
        description: `${totalSpoiled} units of food have spoiled. We need better preservation methods.`,
        severity: "warning",
        createdAt: Date.now(),
      });
    }
  }

  return {
    freshFood: freshFood - freshSpoiled,
    preservedFood: preservedFood + newlyPreserved - preservedSpoiled,
    spoiledFood: totalSpoiled,
    preservationCapacity,
  };
}

// =============================================
// MEDICINE/HEALING SYSTEM
// =============================================

export interface MedicineStatus {
  sickPopulation: number;
  healed: number;
  died: number;
  herbSupply: number;
  healerCount: number;
}

/**
 * Process sickness and healing
 */
export async function processMedicine(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  tick: number
): Promise<MedicineStatus> {
  const territory = await ctx.db.get(territoryId);
  if (!territory) {
    return { sickPopulation: 0, healed: 0, died: 0, herbSupply: 0, healerCount: 0 };
  }

  const sickPopulation = (territory as any).sickPopulation || 0;
  if (sickPopulation === 0) {
    return { sickPopulation: 0, healed: 0, died: 0, herbSupply: 0, healerCount: 0 };
  }

  const medicineData = (territory as any).medicine || {
    herbs: 0,
  };

  // Get healers
  const healers = await ctx.db
    .query("characters")
    .withIndex("by_territory", (q: any) => q.eq("territoryId", territoryId))
    .filter((q: any) => q.and(
      q.eq(q.field("isAlive"), true),
      q.or(
        q.eq(q.field("profession"), "healer"),
        q.eq(q.field("role"), "priest") // Priests can heal too
      )
    ))
    .collect();

  const healerCount = healers.length;

  // Calculate healing
  let healed = 0;
  let herbsUsed = 0;

  // Natural recovery
  const naturalRecovery = Math.floor(sickPopulation * SURVIVAL_CONSTANTS.medicine.naturalRecoveryRate);
  healed += naturalRecovery;

  // Healer-assisted recovery
  if (healerCount > 0 && medicineData.herbs > 0) {
    const patientsPerHealer = Math.ceil(sickPopulation / healerCount);
    const canTreat = Math.min(sickPopulation - naturalRecovery, healerCount * 5); // Each healer treats 5

    for (let i = 0; i < canTreat && medicineData.herbs > herbsUsed; i++) {
      const successChance = SURVIVAL_CONSTANTS.medicine.healingSuccessBase +
        SURVIVAL_CONSTANTS.medicine.healerBonus;

      if (Math.random() < successChance) {
        healed++;
      }
      herbsUsed++;
    }
  }

  healed = Math.min(healed, sickPopulation);

  // Calculate deaths from untreated sickness
  const stillSick = sickPopulation - healed;
  const died = Math.floor(stillSick * SURVIVAL_CONSTANTS.medicine.diseaseDeathRate);

  // Update territory
  const newSickPopulation = Math.max(0, sickPopulation - healed - died);

  await ctx.db.patch(territoryId, {
    population: Math.max(10, territory.population - died),
    sickPopulation: newSickPopulation,
    medicine: {
      ...medicineData,
      herbs: Math.max(0, medicineData.herbs - herbsUsed),
    },
  } as any);

  if (died > 0) {
    await ctx.db.insert("events", {
      tick,
      type: "death",
      territoryId,
      title: "Deaths from Illness",
      description: `${died} people died from illness. ${healed} were healed. ${newSickPopulation} remain sick.`,
      severity: "critical",
      createdAt: Date.now(),
    });

    // Record memory
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", territoryId))
      .first();

    if (agent) {
      await recordMemory(ctx, agent._id, {
        type: "crisis",
        description: `${died} of our people died from sickness. We need more healers and herbs.`,
        emotionalWeight: -40,
      });
    }
  }

  return {
    sickPopulation: newSickPopulation,
    healed,
    died,
    herbSupply: medicineData.herbs - herbsUsed,
    healerCount,
  };
}

// =============================================
// MASTER SURVIVAL PROCESSING
// =============================================

export interface SurvivalReport {
  water: WaterStatus;
  clothing: ClothingStatus;
  sanitation: SanitationStatus;
  preservation: PreservationStatus;
  medicine: MedicineStatus;
  totalDeaths: number;
  criticalNeeds: string[];
}

/**
 * Process all survival needs for a territory
 */
export async function processAllSurvivalNeeds(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  tick: number,
  season: Season
): Promise<SurvivalReport> {
  const criticalNeeds: string[] = [];
  let totalDeaths = 0;

  // Process each survival system
  const water = await processWaterNeeds(ctx, territoryId, tick, season);
  totalDeaths += water.dehydrationDeaths;
  if (water.shortage > 0) criticalNeeds.push("WATER");

  const clothing = await processClothingNeeds(ctx, territoryId, tick, season);
  if (clothing.shortage > clothing.demand * 0.3) criticalNeeds.push("CLOTHING");

  const sanitation = await processSanitation(ctx, territoryId, tick);
  if (sanitation.diseaseRisk > 50) criticalNeeds.push("SANITATION");

  const preservation = await processFoodPreservation(ctx, territoryId, tick, season);
  if (preservation.spoiledFood > 10) criticalNeeds.push("PRESERVATION");

  const medicine = await processMedicine(ctx, territoryId, tick);
  totalDeaths += medicine.died;
  if (medicine.sickPopulation > 0) criticalNeeds.push("MEDICINE");

  return {
    water,
    clothing,
    sanitation,
    preservation,
    medicine,
    totalDeaths,
    criticalNeeds,
  };
}

// =============================================
// ACTION HANDLERS FOR NEW SURVIVAL ACTIONS
// =============================================

/**
 * Dig a well for water
 */
export async function digWell(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  tick: number
): Promise<{ success: boolean; message: string }> {
  const territory = await ctx.db.get(territoryId);
  if (!territory) return { success: false, message: "Territory not found" };

  const waterData = (territory as any).water || { stored: 0, wells: 0, hasRiver: false, quality: 100 };

  // Costs
  const woodCost = 10;
  const wealthCost = 5;

  if ((territory as any).woodStockpile < woodCost) {
    return { success: false, message: "Not enough wood to dig a well" };
  }
  if (territory.wealth < wealthCost) {
    return { success: false, message: "Not enough wealth to dig a well" };
  }

  await ctx.db.patch(territoryId, {
    woodStockpile: (territory as any).woodStockpile - woodCost,
    wealth: territory.wealth - wealthCost,
    water: {
      ...waterData,
      wells: waterData.wells + 1,
    },
  } as any);

  return { success: true, message: `A new well has been dug! Total wells: ${waterData.wells + 1}` };
}

/**
 * Make clothing
 */
export async function makeClothing(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  tick: number
): Promise<{ success: boolean; message: string }> {
  const territory = await ctx.db.get(territoryId);
  if (!territory) return { success: false, message: "Territory not found" };

  const clothingData = (territory as any).clothing || { supply: 0, condition: 50 };

  // Costs (need materials)
  const wealthCost = 3;

  if (territory.wealth < wealthCost) {
    return { success: false, message: "Not enough resources to make clothing" };
  }

  const produced = SURVIVAL_CONSTANTS.clothing.productionPerAction;

  await ctx.db.patch(territoryId, {
    wealth: territory.wealth - wealthCost,
    clothing: {
      ...clothingData,
      supply: clothingData.supply + produced,
      condition: Math.min(100, clothingData.condition + 5),
    },
  } as any);

  return { success: true, message: `Produced ${produced} units of clothing` };
}

/**
 * Build latrine for sanitation
 */
export async function buildLatrine(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  tick: number
): Promise<{ success: boolean; message: string }> {
  const territory = await ctx.db.get(territoryId);
  if (!territory) return { success: false, message: "Territory not found" };

  const sanitationData = (territory as any).sanitation || { wasteLevel: 0, sewerCapacity: 0, latrines: 0 };

  const woodCost = 5;

  if ((territory as any).woodStockpile < woodCost) {
    return { success: false, message: "Not enough wood to build latrine" };
  }

  await ctx.db.patch(territoryId, {
    woodStockpile: (territory as any).woodStockpile - woodCost,
    sanitation: {
      ...sanitationData,
      latrines: (sanitationData.latrines || 0) + 1,
    },
  } as any);

  return { success: true, message: `Built a latrine. Sanitation improved!` };
}

/**
 * Build sewer system
 */
export async function buildSewer(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  tick: number
): Promise<{ success: boolean; message: string }> {
  const territory = await ctx.db.get(territoryId);
  if (!territory) return { success: false, message: "Territory not found" };

  const sanitationData = (territory as any).sanitation || { wasteLevel: 0, sewerCapacity: 0, latrines: 0 };

  const wealthCost = 20;
  const woodCost = 15;

  if (territory.wealth < wealthCost || (territory as any).woodStockpile < woodCost) {
    return { success: false, message: "Not enough resources to build sewer" };
  }

  await ctx.db.patch(territoryId, {
    wealth: territory.wealth - wealthCost,
    woodStockpile: (territory as any).woodStockpile - woodCost,
    sanitation: {
      ...sanitationData,
      sewerCapacity: sanitationData.sewerCapacity + SURVIVAL_CONSTANTS.sanitation.sewerCapacity,
    },
  } as any);

  return { success: true, message: `Sewer system built! Can handle ${SURVIVAL_CONSTANTS.sanitation.sewerCapacity} waste.` };
}

/**
 * Preserve food
 */
export async function preserveFood(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  tick: number
): Promise<{ success: boolean; message: string }> {
  const territory = await ctx.db.get(territoryId);
  if (!territory) return { success: false, message: "Territory not found" };

  const preservationData = (territory as any).preservation || { preservedFood: 0, salt: 0, smokehouses: 0 };

  if (territory.food < 10) {
    return { success: false, message: "Not enough food to preserve" };
  }

  const saltNeeded = SURVIVAL_CONSTANTS.preservation.preservePerAction * SURVIVAL_CONSTANTS.preservation.saltPerFood;
  if (preservationData.salt < saltNeeded) {
    return { success: false, message: "Not enough salt to preserve food" };
  }

  const preserved = SURVIVAL_CONSTANTS.preservation.preservePerAction;

  await ctx.db.patch(territoryId, {
    preservation: {
      ...preservationData,
      preservedFood: preservationData.preservedFood + preserved,
      salt: preservationData.salt - saltNeeded,
    },
  } as any);

  return { success: true, message: `Preserved ${preserved} units of food for winter` };
}

/**
 * Build smokehouse
 */
export async function buildSmokehouse(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  tick: number
): Promise<{ success: boolean; message: string }> {
  const territory = await ctx.db.get(territoryId);
  if (!territory) return { success: false, message: "Territory not found" };

  const preservationData = (territory as any).preservation || { preservedFood: 0, salt: 0, smokehouses: 0 };

  const woodCost = 20;
  if ((territory as any).woodStockpile < woodCost) {
    return { success: false, message: "Not enough wood to build smokehouse" };
  }

  await ctx.db.patch(territoryId, {
    woodStockpile: (territory as any).woodStockpile - woodCost,
    preservation: {
      ...preservationData,
      smokehouses: (preservationData.smokehouses || 0) + 1,
    },
  } as any);

  return { success: true, message: `Smokehouse built! Can preserve ${SURVIVAL_CONSTANTS.preservation.smokehouseCapacity} food.` };
}

/**
 * Gather herbs for medicine
 */
export async function gatherHerbs(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  tick: number,
  season: Season
): Promise<{ success: boolean; message: string; amount?: number }> {
  const territory = await ctx.db.get(territoryId);
  if (!territory) return { success: false, message: "Territory not found" };

  const medicineData = (territory as any).medicine || { herbs: 0 };

  // Herbs available depend on season
  let herbsFound = 10;
  if (season === "spring" || season === "summer") {
    herbsFound = 15 + Math.floor(Math.random() * 10);
  } else if (season === "autumn") {
    herbsFound = 10 + Math.floor(Math.random() * 5);
  } else {
    herbsFound = 3 + Math.floor(Math.random() * 3); // Winter - few herbs
  }

  await ctx.db.patch(territoryId, {
    medicine: {
      ...medicineData,
      herbs: medicineData.herbs + herbsFound,
    },
  } as any);

  return { success: true, message: `Gathered ${herbsFound} medicinal herbs`, amount: herbsFound };
}

/**
 * Gather salt (for preservation)
 */
export async function gatherSalt(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  tick: number
): Promise<{ success: boolean; message: string; amount?: number }> {
  const territory = await ctx.db.get(territoryId);
  if (!territory) return { success: false, message: "Territory not found" };

  const preservationData = (territory as any).preservation || { preservedFood: 0, salt: 0, smokehouses: 0 };

  // Salt gathering depends on location (coastal = more salt)
  const waterData = (territory as any).water || {};
  const isCoastal = waterData.hasRiver || territory.continent === "Australia"; // Simplified

  let saltFound = 5 + Math.floor(Math.random() * 5);
  if (isCoastal) {
    saltFound *= 2; // Coastal areas can evaporate seawater
  }

  await ctx.db.patch(territoryId, {
    preservation: {
      ...preservationData,
      salt: preservationData.salt + saltFound,
    },
  } as any);

  return { success: true, message: `Gathered ${saltFound} units of salt`, amount: saltFound };
}
