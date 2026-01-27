import { Doc, Id } from "../_generated/dataModel";
import { MutationCtx } from "../_generated/server";

// Clamp helper
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// Technology eras and their thresholds
export const TECHNOLOGY_ERAS = {
  stone_age: { minTech: 0, maxTech: 24, name: "Stone Age" },
  bronze_age: { minTech: 25, maxTech: 49, name: "Bronze Age" },
  iron_age: { minTech: 50, maxTech: 74, name: "Iron Age" },
  medieval: { minTech: 75, maxTech: 100, name: "Medieval Era" },
} as const;

export type TechnologyEra = keyof typeof TECHNOLOGY_ERAS;

// Get current era based on technology level
export function getCurrentEra(technologyLevel: number): TechnologyEra {
  if (technologyLevel >= 75) return "medieval";
  if (technologyLevel >= 50) return "iron_age";
  if (technologyLevel >= 25) return "bronze_age";
  return "stone_age";
}

// Research a technology
export async function researchTechnology(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  techId: string,
  tick: number
): Promise<{
  success: boolean;
  progress?: number;
  completed?: boolean;
  error?: string;
}> {
  const territory = await ctx.db.get(territoryId);
  if (!territory) {
    return { success: false, error: "Territory not found" };
  }

  // Get tech definition
  const techDef = await ctx.db
    .query("techTree")
    .filter((q) => q.eq(q.field("techId"), techId))
    .first();

  if (!techDef) {
    return { success: false, error: "Technology not found" };
  }

  // Check prerequisites
  for (const prereq of techDef.prerequisites) {
    const prereqResearch = await ctx.db
      .query("technologies")
      .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
      .filter((q) => q.eq(q.field("techId"), prereq))
      .first();

    if (!prereqResearch?.researched) {
      return { success: false, error: `Prerequisite not met: ${prereq}` };
    }
  }

  // Check era requirement
  const currentEra = getCurrentEra(territory.technology);
  const eraOrder: TechnologyEra[] = ["stone_age", "bronze_age", "iron_age", "medieval"];
  const techEraIndex = eraOrder.indexOf(techDef.era as TechnologyEra);
  const currentEraIndex = eraOrder.indexOf(currentEra);

  if (techEraIndex > currentEraIndex + 1) {
    return { success: false, error: "Technology is from a future era" };
  }

  // Get or create research progress
  let techProgress = await ctx.db
    .query("technologies")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .filter((q) => q.eq(q.field("techId"), techId))
    .first();

  if (techProgress?.researched) {
    return { success: false, error: "Technology already researched" };
  }

  // Calculate research progress based on knowledge
  const researchBonus = territory.knowledge / 100;
  const academyBonus = await calculateAcademyBonus(ctx, territoryId);
  const progressPerTick = (5 + researchBonus * 10 + academyBonus) * (1 + territory.technology / 200);

  if (!techProgress) {
    // Start new research
    await ctx.db.insert("technologies", {
      territoryId,
      techId,
      researched: false,
      researchProgress: progressPerTick,
      researchStartedTick: tick,
    });

    return { success: true, progress: progressPerTick, completed: false };
  }

  // Continue existing research
  const newProgress = techProgress.researchProgress + progressPerTick;
  const completed = newProgress >= techDef.knowledgeCost;

  await ctx.db.patch(techProgress._id, {
    researchProgress: Math.min(techDef.knowledgeCost, newProgress),
    researched: completed,
    researchedAtTick: completed ? tick : undefined,
  });

  if (completed) {
    // Apply technology effects
    await applyTechnologyEffects(ctx, territoryId, techDef, tick);
  }

  return { success: true, progress: newProgress, completed };
}

// Calculate academy bonus to research
async function calculateAcademyBonus(
  ctx: MutationCtx,
  territoryId: Id<"territories">
): Promise<number> {
  const academies = await ctx.db
    .query("buildings")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .filter((q) => q.eq(q.field("type"), "academy"))
    .collect();

  let bonus = 0;
  for (const academy of academies) {
    bonus += academy.level * 2 * (academy.condition / 100);
  }

  return bonus;
}

// Apply effects when technology is completed
async function applyTechnologyEffects(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  techDef: Doc<"techTree">,
  tick: number
): Promise<void> {
  const territory = await ctx.db.get(territoryId);
  if (!territory) return;

  // Increase base technology stat
  await ctx.db.patch(territoryId, {
    technology: Math.min(100, territory.technology + 3),
    knowledge: Math.min(100, territory.knowledge + 2),
    influence: Math.min(100, territory.influence + 1),
  });

  // Check for era transition
  const oldEra = getCurrentEra(territory.technology);
  const newEra = getCurrentEra(territory.technology + 3);

  if (oldEra !== newEra) {
    // Era transition!
    await ctx.db.insert("events", {
      tick,
      type: "breakthrough",
      territoryId,
      title: `${territory.name} Enters ${TECHNOLOGY_ERAS[newEra].name}`,
      description: `Through technological advancement, ${territory.name} has entered a new era of civilization. New possibilities await!`,
      severity: "positive",
      createdAt: Date.now(),
    });

    // Boost happiness for new era
    await ctx.db.patch(territoryId, {
      happiness: Math.min(100, territory.happiness + 10),
    });
  }

  // Log technology completion
  await ctx.db.insert("events", {
    tick,
    type: "breakthrough",
    territoryId,
    title: `${techDef.name} Discovered`,
    description: `${territory.name} has discovered ${techDef.name}! ${techDef.description}`,
    severity: "positive",
    createdAt: Date.now(),
  });
}

// Share technology with an ally
export async function shareTechnology(
  ctx: MutationCtx,
  fromTerritoryId: Id<"territories">,
  toTerritoryId: Id<"territories">,
  techId: string,
  tick: number
): Promise<{ success: boolean; error?: string }> {
  // Check relationship
  let relationship = await ctx.db
    .query("relationships")
    .withIndex("by_territories", (q) =>
      q.eq("territory1Id", fromTerritoryId).eq("territory2Id", toTerritoryId)
    )
    .first();

  if (!relationship) {
    relationship = await ctx.db
      .query("relationships")
      .withIndex("by_territories", (q) =>
        q.eq("territory1Id", toTerritoryId).eq("territory2Id", fromTerritoryId)
      )
      .first();
  }

  if (!relationship || relationship.status === "hostile" || relationship.status === "at_war") {
    return { success: false, error: "Cannot share technology with hostile nations" };
  }

  // Check if source has the technology
  const sourceTech = await ctx.db
    .query("technologies")
    .withIndex("by_territory", (q) => q.eq("territoryId", fromTerritoryId))
    .filter((q) => q.and(q.eq(q.field("techId"), techId), q.eq(q.field("researched"), true)))
    .first();

  if (!sourceTech) {
    return { success: false, error: "Source does not have this technology" };
  }

  // Check if target already has it
  const targetTech = await ctx.db
    .query("technologies")
    .withIndex("by_territory", (q) => q.eq("territoryId", toTerritoryId))
    .filter((q) => q.eq(q.field("techId"), techId))
    .first();

  if (targetTech?.researched) {
    return { success: false, error: "Target already has this technology" };
  }

  // Get tech definition for cost
  const techDef = await ctx.db
    .query("techTree")
    .filter((q) => q.eq(q.field("techId"), techId))
    .first();

  if (!techDef) {
    return { success: false, error: "Technology not found" };
  }

  // Sharing gives 50% progress
  const sharedProgress = techDef.knowledgeCost * 0.5;

  if (targetTech) {
    // Continue existing research
    const newProgress = targetTech.researchProgress + sharedProgress;
    const completed = newProgress >= techDef.knowledgeCost;

    await ctx.db.patch(targetTech._id, {
      researchProgress: Math.min(techDef.knowledgeCost, newProgress),
      researched: completed,
      researchedAtTick: completed ? tick : undefined,
    });
  } else {
    // Start with shared knowledge
    await ctx.db.insert("technologies", {
      territoryId: toTerritoryId,
      techId,
      researched: sharedProgress >= techDef.knowledgeCost,
      researchProgress: sharedProgress,
      researchStartedTick: tick,
      researchedAtTick: sharedProgress >= techDef.knowledgeCost ? tick : undefined,
    });
  }

  // Improve relationship from sharing
  await ctx.db.patch(relationship._id, {
    trust: Math.min(100, relationship.trust + 10),
  });

  return { success: true };
}

// Steal technology through espionage
export async function stealTechnology(
  ctx: MutationCtx,
  thievingTerritoryId: Id<"territories">,
  targetTerritoryId: Id<"territories">,
  tick: number
): Promise<{
  success: boolean;
  stolenTech?: string;
  discovered?: boolean;
  error?: string;
}> {
  const thief = await ctx.db.get(thievingTerritoryId);
  const target = await ctx.db.get(targetTerritoryId);

  if (!thief || !target) {
    return { success: false, error: "Territory not found" };
  }

  // Get target's researched technologies
  const targetTechs = await ctx.db
    .query("technologies")
    .withIndex("by_territory", (q) => q.eq("territoryId", targetTerritoryId))
    .filter((q) => q.eq(q.field("researched"), true))
    .collect();

  // Get thief's researched technologies
  const thiefTechs = await ctx.db
    .query("technologies")
    .withIndex("by_territory", (q) => q.eq("territoryId", thievingTerritoryId))
    .filter((q) => q.eq(q.field("researched"), true))
    .collect();

  const thiefTechIds = new Set(thiefTechs.map(t => t.techId));

  // Find technologies target has that thief doesn't
  const stealableTechs = targetTechs.filter(t => !thiefTechIds.has(t.techId));

  if (stealableTechs.length === 0) {
    return { success: false, error: "No technologies to steal" };
  }

  // Espionage success chance based on influence and target's technology
  const successChance = (thief.influence / 100) * 0.5 + 0.2;
  const discovered = Math.random() > 0.6; // 40% chance of being caught

  if (Math.random() < successChance) {
    // Successful theft
    const stolenTech = stealableTechs[Math.floor(Math.random() * stealableTechs.length)];

    // Get tech definition
    const techDef = await ctx.db
      .query("techTree")
      .filter((q) => q.eq(q.field("techId"), stolenTech.techId))
      .first();

    // Grant the technology (or significant progress)
    const existingProgress = await ctx.db
      .query("technologies")
      .withIndex("by_territory", (q) => q.eq("territoryId", thievingTerritoryId))
      .filter((q) => q.eq(q.field("techId"), stolenTech.techId))
      .first();

    if (existingProgress) {
      await ctx.db.patch(existingProgress._id, {
        researched: true,
        researchProgress: techDef?.knowledgeCost || 100,
        researchedAtTick: tick,
      });
    } else {
      await ctx.db.insert("technologies", {
        territoryId: thievingTerritoryId,
        techId: stolenTech.techId,
        researched: true,
        researchProgress: techDef?.knowledgeCost || 100,
        researchStartedTick: tick,
        researchedAtTick: tick,
      });
    }

    // If discovered, damage relationship
    if (discovered) {
      let relationship = await ctx.db
        .query("relationships")
        .withIndex("by_territories", (q) =>
          q.eq("territory1Id", thievingTerritoryId).eq("territory2Id", targetTerritoryId)
        )
        .first();

      if (!relationship) {
        relationship = await ctx.db
          .query("relationships")
          .withIndex("by_territories", (q) =>
            q.eq("territory1Id", targetTerritoryId).eq("territory2Id", thievingTerritoryId)
          )
          .first();
      }

      if (relationship) {
        await ctx.db.patch(relationship._id, {
          trust: Math.max(-100, relationship.trust - 30),
          status: relationship.trust - 30 < -50 ? "hostile" : relationship.status,
        });
      }

      await ctx.db.insert("events", {
        tick,
        type: "decision",
        territoryId: targetTerritoryId,
        targetTerritoryId: thievingTerritoryId,
        title: "Espionage Discovered",
        description: `Spies from ${thief.name} were caught stealing secrets from ${target.name}!`,
        severity: "negative",
        createdAt: Date.now(),
      });
    }

    return {
      success: true,
      stolenTech: stolenTech.techId,
      discovered,
    };
  }

  // Failed theft
  if (discovered) {
    // Damage relationship even on failure if discovered
    let relationship = await ctx.db
      .query("relationships")
      .withIndex("by_territories", (q) =>
        q.eq("territory1Id", thievingTerritoryId).eq("territory2Id", targetTerritoryId)
      )
      .first();

    if (!relationship) {
      relationship = await ctx.db
        .query("relationships")
        .withIndex("by_territories", (q) =>
          q.eq("territory1Id", targetTerritoryId).eq("territory2Id", thievingTerritoryId)
        )
        .first();
    }

    if (relationship) {
      await ctx.db.patch(relationship._id, {
        trust: Math.max(-100, relationship.trust - 20),
      });
    }
  }

  return { success: false, discovered };
}

// Establish academy for research bonus
export async function establishAcademy(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  tick: number
): Promise<{ success: boolean; error?: string }> {
  const territory = await ctx.db.get(territoryId);
  if (!territory) {
    return { success: false, error: "Territory not found" };
  }

  // Check if writing technology is researched
  const writingTech = await ctx.db
    .query("technologies")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .filter((q) => q.and(q.eq(q.field("techId"), "writing"), q.eq(q.field("researched"), true)))
    .first();

  if (!writingTech) {
    return { success: false, error: "Writing technology required to establish academy" };
  }

  // Check cost
  const academyCost = 50;
  if (territory.wealth < academyCost) {
    return { success: false, error: "Not enough wealth" };
  }

  // Build academy
  await ctx.db.patch(territoryId, {
    wealth: territory.wealth - academyCost,
  });

  await ctx.db.insert("buildings", {
    territoryId,
    type: "academy",
    name: "Academy of Learning",
    level: 1,
    workers: 0,
    maxWorkers: 3,
    outputPerTick: 2, // Knowledge per tick
    maintenanceCost: 4,
    condition: 100,
    constructedAtTick: tick,
  });

  return { success: true };
}

// Get technology summary for a territory
export async function getTechnologySummary(
  ctx: MutationCtx,
  territoryId: Id<"territories">
): Promise<{
  currentEra: string;
  technologyLevel: number;
  researchedCount: number;
  inProgressCount: number;
  availableTechs: string[];
}> {
  const territory = await ctx.db.get(territoryId);
  if (!territory) {
    return {
      currentEra: "Stone Age",
      technologyLevel: 0,
      researchedCount: 0,
      inProgressCount: 0,
      availableTechs: [],
    };
  }

  const allTechs = await ctx.db
    .query("technologies")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .collect();

  const researched = allTechs.filter(t => t.researched);
  const inProgress = allTechs.filter(t => !t.researched && t.researchProgress > 0);

  // Get available technologies (prerequisites met, not yet started)
  const researchedIds = new Set(researched.map(t => t.techId));
  const allTechDefs = await ctx.db.query("techTree").collect();

  const availableTechs = allTechDefs
    .filter(tech => {
      if (researchedIds.has(tech.techId)) return false;
      return tech.prerequisites.every(p => researchedIds.has(p));
    })
    .map(t => t.techId);

  const currentEra = getCurrentEra(territory.technology);

  return {
    currentEra: TECHNOLOGY_ERAS[currentEra].name,
    technologyLevel: territory.technology,
    researchedCount: researched.length,
    inProgressCount: inProgress.length,
    availableTechs,
  };
}
