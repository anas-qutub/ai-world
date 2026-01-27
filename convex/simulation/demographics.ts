import { Doc, Id } from "../_generated/dataModel";
import { MutationCtx } from "../_generated/server";

// Clamp helper
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// Age distribution ratios
const NATURAL_AGE_DISTRIBUTION = {
  children: 0.25, // 25% children
  adults: 0.60, // 60% working adults
  elderly: 0.15, // 15% elderly
};

// Base rates per 1000 population per tick
const BASE_RATES = {
  birthRate: 20, // 2% births per tick
  deathRate: 10, // 1% deaths per tick
  childMortality: 15, // Additional 1.5% for children
  elderlyMortality: 25, // Additional 2.5% for elderly
};

// Process demographics for a territory
export async function processDemographics(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  tick: number
): Promise<{
  births: number;
  deaths: number;
  netChange: number;
  events: Array<{ type: string; description: string }>;
}> {
  const events: Array<{ type: string; description: string }> = [];

  // Get demographics record
  let demo = await ctx.db
    .query("demographics")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .first();

  // Get territory for modifiers
  const territory = await ctx.db.get(territoryId);
  if (!territory) {
    return { births: 0, deaths: 0, netChange: 0, events: [] };
  }

  // If no demographics record exists, create one based on current population
  if (!demo) {
    demo = await initializeDemographics(ctx, territoryId, territory.population, tick);
  }

  // Calculate modified birth rate based on conditions
  let effectiveBirthRate = demo.birthRate;
  let effectiveDeathRate = demo.deathRate;

  // Food affects birth/death rates
  if (territory.food < 20) {
    effectiveBirthRate *= 0.3; // Severe food shortage
    effectiveDeathRate *= 2.5; // Starvation
    events.push({ type: "famine", description: "Famine conditions reducing births and increasing deaths" });
  } else if (territory.food < 40) {
    effectiveBirthRate *= 0.7;
    effectiveDeathRate *= 1.3;
  } else if (territory.food > 70) {
    effectiveBirthRate *= 1.3; // Prosperity increases births
  }

  // Happiness affects birth rate
  if (territory.happiness > 60) {
    effectiveBirthRate *= 1.2;
  } else if (territory.happiness < 30) {
    effectiveBirthRate *= 0.6;
  }

  // Calculate births (only from adults)
  const potentialMothers = demo.adults * 0.5; // Roughly half are women
  const births = Math.floor((potentialMothers * effectiveBirthRate) / 1000);

  // Calculate deaths across age groups
  const childDeaths = Math.floor((demo.children * (effectiveDeathRate + BASE_RATES.childMortality)) / 1000);
  const adultDeaths = Math.floor((demo.adults * effectiveDeathRate) / 1000);
  const elderlyDeaths = Math.floor((demo.elderly * (effectiveDeathRate + BASE_RATES.elderlyMortality)) / 1000);
  const totalDeaths = childDeaths + adultDeaths + elderlyDeaths;

  // Update age groups
  // Children become adults (aging happens over many ticks, simplified here)
  const agingChildren = Math.floor(demo.children * 0.02); // 2% age out per tick
  const agingAdults = Math.floor(demo.adults * 0.01); // 1% become elderly per tick

  const newChildren = Math.max(0, demo.children + births - childDeaths - agingChildren);
  const newAdults = Math.max(0, demo.adults - adultDeaths - agingAdults + agingChildren);
  const newElderly = Math.max(0, demo.elderly - elderlyDeaths + agingAdults);

  // Update demographics record
  await ctx.db.patch(demo._id, {
    children: newChildren,
    adults: newAdults,
    elderly: newElderly,
    birthRate: effectiveBirthRate,
    deathRate: effectiveDeathRate,
    lastUpdatedTick: tick,
  });

  // Update territory population
  const totalPopulation = newChildren + newAdults + newElderly;
  await ctx.db.patch(territoryId, {
    population: totalPopulation,
  });

  const netChange = births - totalDeaths;

  // Generate events for significant changes
  if (births > 3) {
    events.push({ type: "birth_boom", description: `${births} children born this period` });
  }
  if (totalDeaths > territory.population * 0.05) {
    events.push({ type: "high_mortality", description: `${totalDeaths} deaths recorded` });
  }

  return { births, deaths: totalDeaths, netChange, events };
}

// Initialize demographics for a territory
async function initializeDemographics(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  totalPopulation: number,
  tick: number
): Promise<Doc<"demographics">> {
  const demoId = await ctx.db.insert("demographics", {
    territoryId,
    children: Math.floor(totalPopulation * NATURAL_AGE_DISTRIBUTION.children),
    adults: Math.floor(totalPopulation * NATURAL_AGE_DISTRIBUTION.adults),
    elderly: Math.floor(totalPopulation * NATURAL_AGE_DISTRIBUTION.elderly),
    birthRate: BASE_RATES.birthRate,
    deathRate: BASE_RATES.deathRate,
    immigrationRate: 0,
    lastUpdatedTick: tick,
  });

  return (await ctx.db.get(demoId))!;
}

// Promote births (action effect)
export async function promoteBirths(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  tick: number
): Promise<{ success: boolean; newBirthRate?: number }> {
  const demo = await ctx.db
    .query("demographics")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .first();

  if (!demo) {
    return { success: false };
  }

  // Increase birth rate by 20%
  const newBirthRate = Math.min(50, demo.birthRate * 1.2);

  await ctx.db.patch(demo._id, {
    birthRate: newBirthRate,
    lastUpdatedTick: tick,
  });

  return { success: true, newBirthRate };
}

// Calculate workforce availability
export function calculateWorkforce(demo: Doc<"demographics">): {
  totalWorkers: number;
  productivity: number;
} {
  // Adults are primary workers
  const adultWorkers = demo.adults;
  // Elderly can do light work
  const elderlyWorkers = demo.elderly * 0.3;
  // Older children can help
  const childWorkers = Math.floor(demo.children * 0.2);

  const totalWorkers = adultWorkers + elderlyWorkers + childWorkers;

  // Productivity is affected by age distribution
  // Ideal is lots of adults, fewer dependents
  const dependencyRatio = (demo.children + demo.elderly) / Math.max(1, demo.adults);
  const productivity = Math.max(0.5, 1.0 - dependencyRatio * 0.2);

  return { totalWorkers, productivity };
}

// Calculate food requirements
export function calculateFoodRequirements(demo: Doc<"demographics">): number {
  // Children need less food, elderly need less
  const childFood = demo.children * 0.5;
  const adultFood = demo.adults * 1.0;
  const elderlyFood = demo.elderly * 0.7;

  return childFood + adultFood + elderlyFood;
}

// Handle immigration (attracts people from other territories)
export async function processImmigration(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  tick: number
): Promise<{ immigrants: number; emigrants: number }> {
  const territory = await ctx.db.get(territoryId);
  const demo = await ctx.db
    .query("demographics")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .first();

  if (!territory || !demo) {
    return { immigrants: 0, emigrants: 0 };
  }

  // Calculate territory attractiveness
  let attractiveness = 0;
  attractiveness += territory.happiness * 0.3;
  attractiveness += territory.food * 0.2;
  attractiveness += territory.wealth * 0.2;
  attractiveness += (100 - territory.military * 0.1); // Less war = more attractive
  attractiveness = attractiveness / 100; // Normalize to 0-1

  // Immigration/emigration based on attractiveness vs average
  const baseRate = 0.5; // 0.5% base migration rate
  let netMigration = 0;

  if (attractiveness > 0.6) {
    // Attractive territory gains people
    netMigration = Math.floor(demo.adults * baseRate * (attractiveness - 0.5) * 0.1);
  } else if (attractiveness < 0.4) {
    // Poor conditions cause emigration
    netMigration = -Math.floor(demo.adults * baseRate * (0.5 - attractiveness) * 0.1);
  }

  // Apply migration (mostly working adults migrate)
  if (netMigration !== 0) {
    await ctx.db.patch(demo._id, {
      adults: Math.max(1, demo.adults + netMigration),
      immigrationRate: netMigration,
      lastUpdatedTick: tick,
    });

    // Update total population
    const totalPopulation = demo.children + Math.max(1, demo.adults + netMigration) + demo.elderly;
    await ctx.db.patch(territoryId, {
      population: totalPopulation,
    });
  }

  return {
    immigrants: Math.max(0, netMigration),
    emigrants: Math.abs(Math.min(0, netMigration)),
  };
}

// Get demographic summary
export async function getDemographicSummary(
  ctx: MutationCtx,
  territoryId: Id<"territories">
): Promise<{
  totalPopulation: number;
  ageDistribution: { children: number; adults: number; elderly: number };
  dependencyRatio: number;
  growthRate: number;
  workforce: number;
}> {
  const demo = await ctx.db
    .query("demographics")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .first();

  if (!demo) {
    return {
      totalPopulation: 0,
      ageDistribution: { children: 0, adults: 0, elderly: 0 },
      dependencyRatio: 0,
      growthRate: 0,
      workforce: 0,
    };
  }

  const total = demo.children + demo.adults + demo.elderly;
  const dependencyRatio = (demo.children + demo.elderly) / Math.max(1, demo.adults);
  const growthRate = (demo.birthRate - demo.deathRate) / 1000 * 100; // Percentage

  const { totalWorkers } = calculateWorkforce(demo);

  return {
    totalPopulation: total,
    ageDistribution: {
      children: demo.children,
      adults: demo.adults,
      elderly: demo.elderly,
    },
    dependencyRatio,
    growthRate,
    workforce: totalWorkers,
  };
}
