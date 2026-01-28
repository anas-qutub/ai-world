/**
 * Gender Dynamics System
 *
 * Manages gender roles, who can work/rule/fight, and progressive reforms.
 * Default state is ancient/traditional, with options to progress.
 */

import { MutationCtx, QueryCtx } from "../_generated/server";
import { Id, Doc } from "../_generated/dataModel";

// Default gender roles (ancient society)
const DEFAULT_GENDER_ROLES = {
  womenCanWork: false,      // Only domestic work
  womenCanOwn: false,       // Cannot own property
  womenCanRule: false,      // Cannot be rulers
  womenCanFight: false,     // Cannot serve in military
  progressLevel: 0,         // Starting level
};

// Progress thresholds for unlocking rights
const PROGRESS_THRESHOLDS = {
  womenCanWork: 20,         // First reform
  womenCanOwn: 40,          // Second reform
  womenCanRule: 70,         // Third reform (rare)
  womenCanFight: 90,        // Fourth reform (very rare, Amazonian)
};

// Factors that increase progress
const PROGRESS_FACTORS = {
  highEducation: 0.5,       // Knowledge > 60
  prosperity: 0.3,          // Wealth > 70
  lowMilitarism: 0.2,       // Military < 30 (peaceful societies)
  foreignInfluence: 0.4,    // Trade with progressive neighbors
  warNecessity: 1.0,        // Low population of men (war casualties)
};

export interface GenderRoles {
  womenCanWork: boolean;
  womenCanOwn: boolean;
  womenCanRule: boolean;
  womenCanFight: boolean;
  progressLevel: number;
  lastReformTick?: number;
}

/**
 * Initialize gender roles for a territory
 */
export async function initializeGenderRoles(
  ctx: MutationCtx,
  territoryId: Id<"territories">
): Promise<GenderRoles> {
  const territory = await ctx.db.get(territoryId);
  if (!territory) throw new Error("Territory not found");

  const genderRoles = { ...DEFAULT_GENDER_ROLES };

  await ctx.db.patch(territoryId, { genderRoles });

  return genderRoles;
}

/**
 * Get current gender roles for a territory
 */
export async function getGenderRoles(
  ctx: QueryCtx,
  territoryId: Id<"territories">
): Promise<GenderRoles> {
  const territory = await ctx.db.get(territoryId);
  if (!territory) throw new Error("Territory not found");

  return territory.genderRoles || DEFAULT_GENDER_ROLES;
}

/**
 * Process gender dynamics for a territory each tick
 * Calculates natural progress based on factors
 */
export async function processGenderDynamics(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  tick: number
): Promise<{ events: Array<{ type: string; description: string }> }> {
  const events: Array<{ type: string; description: string }> = [];

  const territory = await ctx.db.get(territoryId);
  if (!territory) return { events };

  let genderRoles = territory.genderRoles || { ...DEFAULT_GENDER_ROLES };

  // Calculate progress factors
  let progressGain = 0;

  // High education promotes progress
  if (territory.knowledge > 60) {
    progressGain += PROGRESS_FACTORS.highEducation;
  }

  // Prosperity enables social change
  if (territory.wealth > 70) {
    progressGain += PROGRESS_FACTORS.prosperity;
  }

  // Peaceful societies may progress
  if (territory.military < 30) {
    progressGain += PROGRESS_FACTORS.lowMilitarism;
  }

  // War necessity - if few men left, women must step up
  const fightingPop = territory.fightingPopulation;
  if (fightingPop && fightingPop.eligibleMen < territory.population * 0.2) {
    progressGain += PROGRESS_FACTORS.warNecessity;
    if (!genderRoles.womenCanWork) {
      events.push({
        type: "war_necessity",
        description: "With so many men lost to war, women have begun taking on traditionally male roles out of necessity."
      });
    }
  }

  // Apply progress (very slow natural change)
  const newProgress = Math.min(100, genderRoles.progressLevel + progressGain * 0.1);
  genderRoles.progressLevel = newProgress;

  // Check for threshold unlocks
  const oldRoles = { ...genderRoles };

  if (newProgress >= PROGRESS_THRESHOLDS.womenCanWork && !genderRoles.womenCanWork) {
    genderRoles.womenCanWork = true;
    genderRoles.lastReformTick = tick;
    events.push({
      type: "reform",
      description: "Women are now permitted to work outside the home. The workforce has doubled."
    });
  }

  if (newProgress >= PROGRESS_THRESHOLDS.womenCanOwn && !genderRoles.womenCanOwn) {
    genderRoles.womenCanOwn = true;
    genderRoles.lastReformTick = tick;
    events.push({
      type: "reform",
      description: "Women can now own property and inherit. Economic activity increases."
    });
  }

  if (newProgress >= PROGRESS_THRESHOLDS.womenCanRule && !genderRoles.womenCanRule) {
    genderRoles.womenCanRule = true;
    genderRoles.lastReformTick = tick;
    events.push({
      type: "reform",
      description: "In a historic change, women may now hold positions of power, including rulership."
    });
  }

  if (newProgress >= PROGRESS_THRESHOLDS.womenCanFight && !genderRoles.womenCanFight) {
    genderRoles.womenCanFight = true;
    genderRoles.lastReformTick = tick;
    events.push({
      type: "reform",
      description: "Women warriors are now accepted into the military. A new era of Amazonian strength begins."
    });
  }

  // Update territory
  await ctx.db.patch(territoryId, { genderRoles });

  return { events };
}

/**
 * Grant a specific women's right (AI action)
 */
export async function grantWomenRights(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  rightType: "work" | "own" | "rule" | "fight",
  tick: number
): Promise<{ success: boolean; message: string }> {
  const territory = await ctx.db.get(territoryId);
  if (!territory) return { success: false, message: "Territory not found" };

  let genderRoles = territory.genderRoles || { ...DEFAULT_GENDER_ROLES };

  switch (rightType) {
    case "work":
      if (genderRoles.womenCanWork) {
        return { success: false, message: "Women can already work" };
      }
      genderRoles.womenCanWork = true;
      genderRoles.progressLevel = Math.max(genderRoles.progressLevel, PROGRESS_THRESHOLDS.womenCanWork);
      break;

    case "own":
      if (!genderRoles.womenCanWork) {
        return { success: false, message: "Women must be able to work before they can own property" };
      }
      if (genderRoles.womenCanOwn) {
        return { success: false, message: "Women can already own property" };
      }
      genderRoles.womenCanOwn = true;
      genderRoles.progressLevel = Math.max(genderRoles.progressLevel, PROGRESS_THRESHOLDS.womenCanOwn);
      break;

    case "rule":
      if (!genderRoles.womenCanOwn) {
        return { success: false, message: "Women must be able to own property before they can rule" };
      }
      if (genderRoles.womenCanRule) {
        return { success: false, message: "Women can already rule" };
      }
      genderRoles.womenCanRule = true;
      genderRoles.progressLevel = Math.max(genderRoles.progressLevel, PROGRESS_THRESHOLDS.womenCanRule);
      break;

    case "fight":
      if (!genderRoles.womenCanWork) {
        return { success: false, message: "Women must be able to work before they can fight" };
      }
      if (genderRoles.womenCanFight) {
        return { success: false, message: "Women can already fight" };
      }
      genderRoles.womenCanFight = true;
      genderRoles.progressLevel = Math.max(genderRoles.progressLevel, PROGRESS_THRESHOLDS.womenCanFight);
      break;
  }

  genderRoles.lastReformTick = tick;
  await ctx.db.patch(territoryId, { genderRoles });

  const rightNames = {
    work: "work outside the home",
    own: "own property",
    rule: "hold positions of power",
    fight: "serve in the military"
  };

  return {
    success: true,
    message: `Women are now permitted to ${rightNames[rightType]}.`
  };
}

/**
 * Restrict women's roles (conservative/traditional reform)
 */
export async function restrictWomenRoles(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  roleType: "work" | "own" | "rule" | "fight",
  tick: number
): Promise<{ success: boolean; message: string }> {
  const territory = await ctx.db.get(territoryId);
  if (!territory) return { success: false, message: "Territory not found" };

  let genderRoles = territory.genderRoles || { ...DEFAULT_GENDER_ROLES };

  switch (roleType) {
    case "fight":
      if (!genderRoles.womenCanFight) {
        return { success: false, message: "Women already cannot fight" };
      }
      genderRoles.womenCanFight = false;
      genderRoles.progressLevel = Math.min(genderRoles.progressLevel, PROGRESS_THRESHOLDS.womenCanFight - 1);
      break;

    case "rule":
      if (genderRoles.womenCanFight) {
        return { success: false, message: "Must restrict fighting rights before ruling rights" };
      }
      if (!genderRoles.womenCanRule) {
        return { success: false, message: "Women already cannot rule" };
      }
      genderRoles.womenCanRule = false;
      genderRoles.progressLevel = Math.min(genderRoles.progressLevel, PROGRESS_THRESHOLDS.womenCanRule - 1);
      break;

    case "own":
      if (genderRoles.womenCanRule) {
        return { success: false, message: "Must restrict ruling rights before property rights" };
      }
      if (!genderRoles.womenCanOwn) {
        return { success: false, message: "Women already cannot own property" };
      }
      genderRoles.womenCanOwn = false;
      genderRoles.progressLevel = Math.min(genderRoles.progressLevel, PROGRESS_THRESHOLDS.womenCanOwn - 1);
      break;

    case "work":
      if (genderRoles.womenCanOwn || genderRoles.womenCanFight) {
        return { success: false, message: "Must restrict other rights before work rights" };
      }
      if (!genderRoles.womenCanWork) {
        return { success: false, message: "Women already cannot work" };
      }
      genderRoles.womenCanWork = false;
      genderRoles.progressLevel = Math.min(genderRoles.progressLevel, PROGRESS_THRESHOLDS.womenCanWork - 1);
      break;
  }

  genderRoles.lastReformTick = tick;
  await ctx.db.patch(territoryId, { genderRoles });

  return {
    success: true,
    message: `Traditional restrictions on women's roles have been enforced.`
  };
}

/**
 * Calculate workforce multiplier based on gender roles
 */
export function getWorkforceMultiplier(genderRoles: GenderRoles | undefined): number {
  if (!genderRoles) return 1.0; // Default: only men work

  // If women can work, effective workforce is larger
  if (genderRoles.womenCanWork) {
    return 1.7; // Not quite double due to some domestic responsibilities
  }

  return 1.0;
}

/**
 * Calculate military pool multiplier based on gender roles
 */
export function getMilitaryPoolMultiplier(genderRoles: GenderRoles | undefined): number {
  if (!genderRoles) return 1.0; // Default: only men fight

  // If women can fight, military pool is larger
  if (genderRoles.womenCanFight) {
    return 1.8; // Significant increase in potential soldiers
  }

  return 1.0;
}

/**
 * Check if a character can be a ruler based on gender roles
 */
export function canBeRuler(
  character: Doc<"characters">,
  genderRoles: GenderRoles | undefined
): boolean {
  if (!character.gender) return true; // Legacy characters without gender

  if (character.gender === "male") return true;

  // Female characters need permission to rule
  return genderRoles?.womenCanRule ?? false;
}

/**
 * Check if a character can fight based on gender roles and age
 */
export function canFight(
  character: Doc<"characters">,
  genderRoles: GenderRoles | undefined
): boolean {
  // Age check (16-50)
  const age = character.age || 30; // Default to adult if no age
  if (age < 16 || age > 50) return false;

  if (!character.gender) return true; // Legacy characters

  if (character.gender === "male") return true;

  // Female characters need permission to fight
  return genderRoles?.womenCanFight ?? false;
}

/**
 * Assign gender to existing characters without one
 */
export async function assignGenderToCharacters(
  ctx: MutationCtx,
  territoryId: Id<"territories">
): Promise<number> {
  const characters = await ctx.db
    .query("characters")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .filter((q) => q.eq(q.field("isAlive"), true))
    .collect();

  let updated = 0;

  for (const character of characters) {
    if (!character.gender) {
      // 50/50 split for new gender assignment
      // Rulers are more likely male in traditional societies
      let gender: "male" | "female";

      if (character.role === "ruler" || character.role === "general") {
        gender = Math.random() < 0.85 ? "male" : "female";
      } else {
        gender = Math.random() < 0.5 ? "male" : "female";
      }

      await ctx.db.patch(character._id, { gender });
      updated++;
    }
  }

  return updated;
}
