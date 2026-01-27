import { Doc, Id } from "../_generated/dataModel";
import { MutationCtx } from "../_generated/server";

// Clamp helper
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// Disease type definitions
export const DISEASE_TYPES = {
  plague: {
    mortalityRate: 0.3, // 30% of infected die
    spreadRate: 0.4, // 40% spread chance to adjacent
    duration: 24, // Lasts about 2 years (24 ticks)
    tradeSpread: true, // Can spread via trade routes
    description: "A deadly pestilence that kills swiftly",
  },
  fever: {
    mortalityRate: 0.1,
    spreadRate: 0.5,
    duration: 12,
    tradeSpread: true,
    description: "A burning sickness that weakens the body",
  },
  pox: {
    mortalityRate: 0.15,
    spreadRate: 0.6,
    duration: 18,
    tradeSpread: true,
    description: "A disfiguring illness that marks survivors",
  },
  cholera: {
    mortalityRate: 0.2,
    spreadRate: 0.3,
    duration: 8,
    tradeSpread: false, // Spreads through water
    description: "A water-borne sickness that strikes suddenly",
  },
  famine_sickness: {
    mortalityRate: 0.25,
    spreadRate: 0.1,
    duration: 6,
    tradeSpread: false,
    description: "Weakness and disease born of hunger",
  },
} as const;

export type DiseaseType = keyof typeof DISEASE_TYPES;

// Disease names for flavor
const DISEASE_NAMES: Record<DiseaseType, string[]> = {
  plague: ["The Black Death", "The Great Plague", "The Dying", "Shadow's Touch"],
  fever: ["The Burning", "Red Fever", "Summer's Curse", "Fire in the Blood"],
  pox: ["The Marking", "Star Pox", "White Death", "The Scarring"],
  cholera: ["The Flux", "Water's Revenge", "The Purging", "River's Curse"],
  famine_sickness: ["Hunger's Shadow", "The Wasting", "Empty Belly Death", "Bone Sickness"],
};

// Generate a random disease name
function generateDiseaseName(type: DiseaseType): string {
  const names = DISEASE_NAMES[type];
  return names[Math.floor(Math.random() * names.length)];
}

// Create a new disease outbreak
export async function createDiseaseOutbreak(
  ctx: MutationCtx,
  originTerritoryId: Id<"territories">,
  type: DiseaseType,
  tick: number
): Promise<{ success: boolean; diseaseId?: Id<"diseases">; name?: string }> {
  const territory = await ctx.db.get(originTerritoryId);
  if (!territory) {
    return { success: false };
  }

  const diseaseDef = DISEASE_TYPES[type];
  const name = generateDiseaseName(type);

  const diseaseId = await ctx.db.insert("diseases", {
    name,
    type,
    mortalityRate: diseaseDef.mortalityRate,
    spreadRate: diseaseDef.spreadRate,
    affectedTerritories: [originTerritoryId],
    originTerritoryId,
    startedAtTick: tick,
    status: "spreading",
  });

  // Log event
  await ctx.db.insert("events", {
    tick,
    type: "disaster",
    territoryId: originTerritoryId,
    title: `${name} Outbreak`,
    description: `${diseaseDef.description}. The sickness has begun to spread among the people of ${territory.name}.`,
    severity: "critical",
    createdAt: Date.now(),
  });

  return { success: true, diseaseId, name };
}

// Process disease spread and effects
export async function processDiseases(
  ctx: MutationCtx,
  tick: number
): Promise<{
  activeOutbreaks: number;
  totalDeaths: number;
  spreadEvents: Array<{ diseaseName: string; from: string; to: string }>;
  containedDiseases: string[];
}> {
  const spreadEvents: Array<{ diseaseName: string; from: string; to: string }> = [];
  const containedDiseases: string[] = [];
  let totalDeaths = 0;

  // Get all active diseases
  const diseases = await ctx.db
    .query("diseases")
    .withIndex("by_status", (q) => q.eq("status", "spreading"))
    .collect();

  for (const disease of diseases) {
    const diseaseDef = DISEASE_TYPES[disease.type as DiseaseType];
    if (!diseaseDef) continue;

    // Check if disease should end naturally
    const ticksActive = tick - disease.startedAtTick;
    if (ticksActive >= diseaseDef.duration) {
      await ctx.db.patch(disease._id, { status: "ended" });
      containedDiseases.push(disease.name);

      // Log end of disease
      await ctx.db.insert("events", {
        tick,
        type: "system",
        territoryId: disease.originTerritoryId,
        title: `${disease.name} Ends`,
        description: `The ${disease.name} has finally run its course. The survivors begin to recover.`,
        severity: "positive",
        createdAt: Date.now(),
      });

      continue;
    }

    // Process each affected territory
    for (const territoryId of disease.affectedTerritories) {
      const territory = await ctx.db.get(territoryId);
      if (!territory) continue;

      // Calculate deaths based on mortality rate and population
      const infectedRate = 0.3; // Assume 30% of population is infected at peak
      const infected = Math.floor(territory.population * infectedRate);
      const deaths = Math.floor(infected * disease.mortalityRate * 0.1); // Per tick deaths

      totalDeaths += deaths;

      if (deaths > 0) {
        // Update territory population
        await ctx.db.patch(territoryId, {
          population: Math.max(1, territory.population - deaths),
          happiness: Math.max(0, territory.happiness - deaths * 2),
        });

        // Update demographics if available
        const demo = await ctx.db
          .query("demographics")
          .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
          .first();

        if (demo) {
          // Disease kills across all age groups, but elderly more affected
          const childDeaths = Math.floor(deaths * 0.2);
          const adultDeaths = Math.floor(deaths * 0.4);
          const elderlyDeaths = Math.floor(deaths * 0.4);

          await ctx.db.patch(demo._id, {
            children: Math.max(0, demo.children - childDeaths),
            adults: Math.max(1, demo.adults - adultDeaths),
            elderly: Math.max(0, demo.elderly - elderlyDeaths),
            deathRate: demo.deathRate * 2, // Temporarily doubled
          });
        }
      }

      // Attempt to spread to adjacent territories
      if (diseaseDef.tradeSpread) {
        await attemptDiseaseSpread(ctx, disease, territoryId, tick, spreadEvents);
      }
    }
  }

  return {
    activeOutbreaks: diseases.filter(d => d.status === "spreading").length,
    totalDeaths,
    spreadEvents,
    containedDiseases,
  };
}

// Attempt to spread disease to connected territories
async function attemptDiseaseSpread(
  ctx: MutationCtx,
  disease: Doc<"diseases">,
  sourceId: Id<"territories">,
  tick: number,
  spreadEvents: Array<{ diseaseName: string; from: string; to: string }>
): Promise<void> {
  const source = await ctx.db.get(sourceId);
  if (!source) return;

  // Get trade routes from this territory
  const routes1 = await ctx.db
    .query("tradeRoutes")
    .withIndex("by_territory1", (q) => q.eq("territory1Id", sourceId))
    .filter((q) => q.eq(q.field("isActive"), true))
    .collect();

  const routes2 = await ctx.db
    .query("tradeRoutes")
    .withIndex("by_territory2", (q) => q.eq("territory2Id", sourceId))
    .filter((q) => q.eq(q.field("isActive"), true))
    .collect();

  const connectedTerritories: Id<"territories">[] = [
    ...routes1.map(r => r.territory2Id),
    ...routes2.map(r => r.territory1Id),
  ];

  for (const targetId of connectedTerritories) {
    // Check if already infected
    if (disease.affectedTerritories.includes(targetId)) continue;

    // Roll for spread
    if (Math.random() < disease.spreadRate * 0.1) {
      const target = await ctx.db.get(targetId);
      if (!target) continue;

      // Disease spreads
      await ctx.db.patch(disease._id, {
        affectedTerritories: [...disease.affectedTerritories, targetId],
      });

      spreadEvents.push({
        diseaseName: disease.name,
        from: source.name,
        to: target.name,
      });

      // Log spread event
      await ctx.db.insert("events", {
        tick,
        type: "disaster",
        territoryId: targetId,
        title: `${disease.name} Spreads`,
        description: `The ${disease.name} has spread from ${source.name} to ${target.name}. The people fear for their lives.`,
        severity: "critical",
        createdAt: Date.now(),
      });
    }
  }
}

// Quarantine action - attempt to contain disease
export async function quarantine(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  tick: number
): Promise<{
  success: boolean;
  containedDiseases: string[];
  tradeClosed: number;
}> {
  const containedDiseases: string[] = [];

  const territory = await ctx.db.get(territoryId);
  if (!territory) {
    return { success: false, containedDiseases: [], tradeClosed: 0 };
  }

  // Get all diseases affecting this territory
  const diseases = await ctx.db
    .query("diseases")
    .withIndex("by_status", (q) => q.eq("status", "spreading"))
    .collect();

  for (const disease of diseases) {
    if (disease.affectedTerritories.includes(territoryId)) {
      // Reduce spread rate from this territory
      const newSpreadRate = disease.spreadRate * 0.5;
      await ctx.db.patch(disease._id, {
        spreadRate: newSpreadRate,
      });

      containedDiseases.push(disease.name);
    }
  }

  // Close trade routes to prevent spread
  const routes1 = await ctx.db
    .query("tradeRoutes")
    .withIndex("by_territory1", (q) => q.eq("territory1Id", territoryId))
    .collect();

  const routes2 = await ctx.db
    .query("tradeRoutes")
    .withIndex("by_territory2", (q) => q.eq("territory2Id", territoryId))
    .collect();

  let tradeClosed = 0;
  for (const route of [...routes1, ...routes2]) {
    if (route.isActive) {
      await ctx.db.patch(route._id, { isActive: false });
      tradeClosed++;
    }
  }

  // Quarantine has happiness cost
  await ctx.db.patch(territoryId, {
    happiness: Math.max(0, territory.happiness - 10),
  });

  // Log event
  await ctx.db.insert("events", {
    tick,
    type: "decision",
    territoryId,
    title: "Quarantine Declared",
    description: `${territory.name} has closed its borders and trade routes to prevent disease spread. The people are isolated but may be safer.`,
    severity: "info",
    createdAt: Date.now(),
  });

  return { success: true, containedDiseases, tradeClosed };
}

// Check if conditions might spawn a disease
export async function checkDiseaseRisk(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  tick: number
): Promise<{ atRisk: boolean; riskType?: DiseaseType; riskLevel: number }> {
  const territory = await ctx.db.get(territoryId);
  if (!territory) {
    return { atRisk: false, riskLevel: 0 };
  }

  let riskLevel = 0;
  let riskType: DiseaseType | undefined;

  // Low food increases disease risk
  if (territory.food < 20) {
    riskLevel += 30;
    riskType = "famine_sickness";
  } else if (territory.food < 40) {
    riskLevel += 15;
  }

  // Dense population increases risk
  if (territory.population > 50) {
    riskLevel += (territory.population - 50) / 10;
  }

  // Low happiness/poor conditions
  if (territory.happiness < 30) {
    riskLevel += 10;
  }

  // Low technology means poor sanitation
  if (territory.technology < 20) {
    riskLevel += 10;
    if (!riskType) riskType = "cholera";
  }

  // Random chance based on risk
  if (riskLevel > 20 && Math.random() < riskLevel / 1000) {
    // Small chance per tick for disease outbreak
    if (!riskType) {
      const types: DiseaseType[] = ["plague", "fever", "pox"];
      riskType = types[Math.floor(Math.random() * types.length)];
    }
    return { atRisk: true, riskType, riskLevel };
  }

  return { atRisk: false, riskLevel };
}

// Get disease summary for a territory
export async function getDiseaseSummary(
  ctx: MutationCtx,
  territoryId: Id<"territories">
): Promise<{
  activeOutbreaks: Array<{ name: string; type: string; ticksRemaining: number }>;
  totalMortality: number;
  isQuarantined: boolean;
}> {
  const diseases = await ctx.db
    .query("diseases")
    .withIndex("by_status", (q) => q.eq("status", "spreading"))
    .collect();

  const world = await ctx.db.query("world").first();
  const currentTick = world?.tick || 0;

  const activeOutbreaks: Array<{ name: string; type: string; ticksRemaining: number }> = [];
  let totalMortality = 0;

  for (const disease of diseases) {
    if (disease.affectedTerritories.includes(territoryId)) {
      const diseaseDef = DISEASE_TYPES[disease.type as DiseaseType];
      const ticksActive = currentTick - disease.startedAtTick;
      const ticksRemaining = Math.max(0, (diseaseDef?.duration || 12) - ticksActive);

      activeOutbreaks.push({
        name: disease.name,
        type: disease.type,
        ticksRemaining,
      });

      totalMortality += disease.mortalityRate;
    }
  }

  // Check if quarantined (all trade routes closed)
  const routes1 = await ctx.db
    .query("tradeRoutes")
    .withIndex("by_territory1", (q) => q.eq("territory1Id", territoryId))
    .collect();

  const routes2 = await ctx.db
    .query("tradeRoutes")
    .withIndex("by_territory2", (q) => q.eq("territory2Id", territoryId))
    .collect();

  const allRoutes = [...routes1, ...routes2];
  const isQuarantined = allRoutes.length > 0 && allRoutes.every(r => !r.isActive);

  return {
    activeOutbreaks,
    totalMortality,
    isQuarantined,
  };
}
