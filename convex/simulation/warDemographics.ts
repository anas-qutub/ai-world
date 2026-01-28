/**
 * War Demographics System
 *
 * Tracks who can fight (fighting-age men by default), casualties,
 * widows, orphans, and emergency conscription measures.
 */

import { MutationCtx, QueryCtx } from "../_generated/server";
import { Id, Doc } from "../_generated/dataModel";
import { getGenderRoles, canFight, GenderRoles } from "./gender";

// Age ranges for fighting
const NORMAL_FIGHTING_AGE = { min: 16, max: 50 };
const EXPANDED_FIGHTING_AGE = { min: 14, max: 60 };
const CHILD_SOLDIER_AGE = { min: 12, max: 14 };

// Default fighting population structure
const DEFAULT_FIGHTING_POPULATION = {
  eligibleMen: 0,
  eligibleWomen: 0,
  currentSoldiers: 0,
  reserves: 0,
  casualties: 0,
  widows: 0,
  orphans: 0,
  warWeariness: 0,
  emergencyMeasures: "none" as const,
};

export interface FightingPopulation {
  eligibleMen: number;
  eligibleWomen: number;
  currentSoldiers: number;
  reserves: number;
  casualties: number;
  widows: number;
  orphans: number;
  warWeariness: number;
  lastConscriptionTick?: number;
  emergencyMeasures?: "none" | "expanded_age" | "women_conscripted" | "child_soldiers";
}

/**
 * Initialize fighting population for a territory
 */
export async function initializeFightingPopulation(
  ctx: MutationCtx,
  territoryId: Id<"territories">
): Promise<FightingPopulation> {
  const territory = await ctx.db.get(territoryId);
  if (!territory) throw new Error("Territory not found");

  // Calculate initial eligible population
  const genderRoles = territory.genderRoles;
  const population = territory.population;

  // Roughly 50% male, 30% in fighting age
  const eligibleMen = Math.floor(population * 0.5 * 0.3);
  const eligibleWomen = genderRoles?.womenCanFight
    ? Math.floor(population * 0.5 * 0.3)
    : 0;

  const fightingPopulation: FightingPopulation = {
    ...DEFAULT_FIGHTING_POPULATION,
    eligibleMen,
    eligibleWomen,
  };

  await ctx.db.patch(territoryId, { fightingPopulation });

  return fightingPopulation;
}

/**
 * Process war demographics each tick
 * Updates eligible fighters, handles casualties aftermath
 */
export async function processWarDemographics(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  tick: number
): Promise<{ events: Array<{ type: string; description: string }> }> {
  const events: Array<{ type: string; description: string }> = [];

  const territory = await ctx.db.get(territoryId);
  if (!territory) return { events };

  let fightingPop = territory.fightingPopulation || { ...DEFAULT_FIGHTING_POPULATION };
  const genderRoles = territory.genderRoles;
  const population = territory.population;

  // Recalculate eligible population based on current population
  const baseEligiblePercent = 0.15; // 15% of total population is fighting-age male

  // Adjust for emergency measures
  let ageMultiplier = 1.0;
  if (fightingPop.emergencyMeasures === "expanded_age") {
    ageMultiplier = 1.3; // 30% more with expanded age range
  }

  // Calculate eligible men
  fightingPop.eligibleMen = Math.floor(population * baseEligiblePercent * ageMultiplier);

  // Calculate eligible women if allowed
  if (genderRoles?.womenCanFight) {
    fightingPop.eligibleWomen = Math.floor(population * baseEligiblePercent * ageMultiplier);
  } else if (fightingPop.emergencyMeasures === "women_conscripted") {
    // Forced conscription - very unpopular
    fightingPop.eligibleWomen = Math.floor(population * baseEligiblePercent * 0.5); // Not as many volunteer
  } else {
    fightingPop.eligibleWomen = 0;
  }

  // Natural recovery of war weariness (slow)
  if (fightingPop.warWeariness > 0) {
    fightingPop.warWeariness = Math.max(0, fightingPop.warWeariness - 1);
  }

  // Widows and orphans slowly decrease (remarriage, children grow up)
  if (fightingPop.widows > 0 && tick % 12 === 0) {
    const remarried = Math.floor(fightingPop.widows * 0.1); // 10% remarry per year
    fightingPop.widows = Math.max(0, fightingPop.widows - remarried);
    if (remarried > 0) {
      events.push({
        type: "demographics",
        description: `${remarried} war widows have remarried.`
      });
    }
  }

  if (fightingPop.orphans > 0 && tick % 12 === 0) {
    const grownUp = Math.floor(fightingPop.orphans * 0.15); // 15% grow up per year
    fightingPop.orphans = Math.max(0, fightingPop.orphans - grownUp);
  }

  // Reserves slowly transition back to civilian life if no war
  const isAtWar = await checkIfAtWar(ctx, territoryId);
  if (!isAtWar && fightingPop.reserves > 0) {
    const demobilized = Math.floor(fightingPop.reserves * 0.2);
    fightingPop.reserves = Math.max(0, fightingPop.reserves - demobilized);
    fightingPop.eligibleMen += demobilized;
  }

  // Emergency measures have costs
  if (fightingPop.emergencyMeasures === "child_soldiers") {
    events.push({
      type: "crisis",
      description: "Child soldiers continue to serve. The population is horrified."
    });
    // This should heavily impact happiness (handled elsewhere)
  }

  await ctx.db.patch(territoryId, { fightingPopulation: fightingPop });

  return { events };
}

/**
 * Check if territory is at war
 */
async function checkIfAtWar(ctx: QueryCtx, territoryId: Id<"territories">): Promise<boolean> {
  const relationships1 = await ctx.db
    .query("relationships")
    .withIndex("by_territory1", (q) => q.eq("territory1Id", territoryId))
    .filter((q) => q.eq(q.field("status"), "at_war"))
    .first();

  if (relationships1) return true;

  const relationships2 = await ctx.db
    .query("relationships")
    .withIndex("by_territory2", (q) => q.eq("territory2Id", territoryId))
    .filter((q) => q.eq(q.field("status"), "at_war"))
    .first();

  return !!relationships2;
}

/**
 * Conscript soldiers from eligible population
 */
export async function conscriptSoldiers(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  count: number,
  tick: number
): Promise<{ success: boolean; actualCount: number; message: string }> {
  const territory = await ctx.db.get(territoryId);
  if (!territory) return { success: false, actualCount: 0, message: "Territory not found" };

  let fightingPop = territory.fightingPopulation || { ...DEFAULT_FIGHTING_POPULATION };
  const genderRoles = territory.genderRoles;

  // Calculate total available
  let availableMen = fightingPop.eligibleMen - fightingPop.currentSoldiers;
  let availableWomen = genderRoles?.womenCanFight || fightingPop.emergencyMeasures === "women_conscripted"
    ? fightingPop.eligibleWomen
    : 0;

  const totalAvailable = availableMen + availableWomen;

  if (totalAvailable <= 0) {
    return {
      success: false,
      actualCount: 0,
      message: "No eligible fighters available for conscription"
    };
  }

  // Take what we can
  const actualCount = Math.min(count, totalAvailable);

  // First from men, then from women if needed
  const fromMen = Math.min(actualCount, availableMen);
  const fromWomen = actualCount - fromMen;

  fightingPop.currentSoldiers += actualCount;
  fightingPop.lastConscriptionTick = tick;

  // Conscription increases war weariness
  fightingPop.warWeariness = Math.min(100, fightingPop.warWeariness + actualCount * 0.5);

  await ctx.db.patch(territoryId, { fightingPopulation: fightingPop });

  let message = `Conscripted ${actualCount} soldiers`;
  if (fromWomen > 0) {
    message += ` (including ${fromWomen} women)`;
  }

  return { success: true, actualCount, message };
}

/**
 * Call up reserves
 */
export async function callUpReserves(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  tick: number
): Promise<{ success: boolean; count: number; message: string }> {
  const territory = await ctx.db.get(territoryId);
  if (!territory) return { success: false, count: 0, message: "Territory not found" };

  let fightingPop = territory.fightingPopulation || { ...DEFAULT_FIGHTING_POPULATION };

  if (fightingPop.reserves <= 0) {
    return { success: false, count: 0, message: "No reserves available" };
  }

  const count = fightingPop.reserves;
  fightingPop.currentSoldiers += count;
  fightingPop.reserves = 0;
  fightingPop.lastConscriptionTick = tick;

  await ctx.db.patch(territoryId, { fightingPopulation: fightingPop });

  return { success: true, count, message: `Called up ${count} reserve soldiers` };
}

/**
 * Activate emergency conscription measures
 */
export async function activateEmergencyMeasures(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  measure: "expanded_age" | "women_conscripted" | "child_soldiers",
  tick: number
): Promise<{ success: boolean; message: string; happinessPenalty: number }> {
  const territory = await ctx.db.get(territoryId);
  if (!territory) return { success: false, message: "Territory not found", happinessPenalty: 0 };

  let fightingPop = territory.fightingPopulation || { ...DEFAULT_FIGHTING_POPULATION };
  const genderRoles = territory.genderRoles;

  // Check if measure is valid
  if (measure === "women_conscripted" && genderRoles?.womenCanFight) {
    return {
      success: false,
      message: "Women already serve voluntarily, no need for forced conscription",
      happinessPenalty: 0
    };
  }

  const currentMeasure = fightingPop.emergencyMeasures || "none";

  // Can't downgrade measures
  const measureOrder = ["none", "expanded_age", "women_conscripted", "child_soldiers"];
  if (measureOrder.indexOf(measure) <= measureOrder.indexOf(currentMeasure)) {
    return {
      success: false,
      message: `Already have ${currentMeasure} measures in place`,
      happinessPenalty: 0
    };
  }

  fightingPop.emergencyMeasures = measure;

  // Calculate happiness penalty
  const penalties: Record<string, number> = {
    expanded_age: 5,
    women_conscripted: 15,
    child_soldiers: 40, // Devastating to morale
  };

  const happinessPenalty = penalties[measure];

  // Apply happiness penalty
  await ctx.db.patch(territoryId, {
    fightingPopulation: fightingPop,
    happiness: Math.max(0, territory.happiness - happinessPenalty),
  });

  const messages: Record<string, string> = {
    expanded_age: "Age requirements for military service have been expanded to 14-60.",
    women_conscripted: "Women are now being forcibly conscripted into military service.",
    child_soldiers: "In a desperate measure, children as young as 12 are being armed. The population is horrified.",
  };

  return { success: true, message: messages[measure], happinessPenalty };
}

/**
 * Deactivate emergency measures
 */
export async function deactivateEmergencyMeasures(
  ctx: MutationCtx,
  territoryId: Id<"territories">
): Promise<{ success: boolean; message: string }> {
  const territory = await ctx.db.get(territoryId);
  if (!territory) return { success: false, message: "Territory not found" };

  let fightingPop = territory.fightingPopulation || { ...DEFAULT_FIGHTING_POPULATION };

  if (!fightingPop.emergencyMeasures || fightingPop.emergencyMeasures === "none") {
    return { success: false, message: "No emergency measures are active" };
  }

  fightingPop.emergencyMeasures = "none";

  await ctx.db.patch(territoryId, { fightingPopulation: fightingPop });

  return { success: true, message: "Emergency conscription measures have been lifted." };
}

/**
 * Record war casualties and create widows/orphans
 */
export async function recordWarCasualties(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  casualties: number,
  tick: number
): Promise<{ widowsCreated: number; orphansCreated: number }> {
  const territory = await ctx.db.get(territoryId);
  if (!territory) return { widowsCreated: 0, orphansCreated: 0 };

  let fightingPop = territory.fightingPopulation || { ...DEFAULT_FIGHTING_POPULATION };

  // Record casualties
  fightingPop.casualties += casualties;
  fightingPop.currentSoldiers = Math.max(0, fightingPop.currentSoldiers - casualties);

  // Increase war weariness
  fightingPop.warWeariness = Math.min(100, fightingPop.warWeariness + casualties * 2);

  // Create widows (assume 70% of soldiers were married)
  const widowsCreated = Math.floor(casualties * 0.7);
  fightingPop.widows += widowsCreated;

  // Create orphans (assume average 1.5 children per soldier)
  const orphansCreated = Math.floor(casualties * 1.5);
  fightingPop.orphans += orphansCreated;

  await ctx.db.patch(territoryId, { fightingPopulation: fightingPop });

  return { widowsCreated, orphansCreated };
}

/**
 * Provide care for widows and orphans (AI action)
 */
export async function careForWidowsOrphans(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  wealthInvested: number
): Promise<{ success: boolean; message: string; happinessGain: number }> {
  const territory = await ctx.db.get(territoryId);
  if (!territory) return { success: false, message: "Territory not found", happinessGain: 0 };

  if (territory.wealth < wealthInvested) {
    return { success: false, message: "Not enough wealth", happinessGain: 0 };
  }

  const fightingPop = territory.fightingPopulation || { ...DEFAULT_FIGHTING_POPULATION };

  if (fightingPop.widows === 0 && fightingPop.orphans === 0) {
    return { success: false, message: "No widows or orphans to care for", happinessGain: 0 };
  }

  // Calculate impact
  const totalNeedy = fightingPop.widows + fightingPop.orphans;
  const carePerPerson = wealthInvested / totalNeedy;

  // Happiness gain based on care quality
  let happinessGain = 0;
  if (carePerPerson >= 2) {
    happinessGain = 5; // Good care
  } else if (carePerPerson >= 1) {
    happinessGain = 3; // Adequate care
  } else {
    happinessGain = 1; // Minimal care
  }

  // War weariness decreases when you care for victims
  const newWarWeariness = Math.max(0, fightingPop.warWeariness - 5);

  await ctx.db.patch(territoryId, {
    wealth: territory.wealth - wealthInvested,
    happiness: Math.min(100, territory.happiness + happinessGain),
    fightingPopulation: {
      ...fightingPop,
      warWeariness: newWarWeariness,
    },
  });

  return {
    success: true,
    message: `Invested ${wealthInvested} wealth in caring for ${fightingPop.widows} widows and ${fightingPop.orphans} orphans.`,
    happinessGain,
  };
}

/**
 * Get war demographics summary for AI decision-making
 */
export async function getWarDemographicsSummary(
  ctx: QueryCtx,
  territoryId: Id<"territories">
): Promise<{
  eligibleFighters: number;
  currentSoldiers: number;
  reserves: number;
  casualties: number;
  widows: number;
  orphans: number;
  warWeariness: number;
  emergencyMeasures: string;
  availableForConscription: number;
}> {
  const territory = await ctx.db.get(territoryId);
  if (!territory) throw new Error("Territory not found");

  const fightingPop = territory.fightingPopulation || DEFAULT_FIGHTING_POPULATION;

  const totalEligible = fightingPop.eligibleMen + fightingPop.eligibleWomen;
  const availableForConscription = totalEligible - fightingPop.currentSoldiers;

  return {
    eligibleFighters: totalEligible,
    currentSoldiers: fightingPop.currentSoldiers,
    reserves: fightingPop.reserves,
    casualties: fightingPop.casualties,
    widows: fightingPop.widows,
    orphans: fightingPop.orphans,
    warWeariness: fightingPop.warWeariness,
    emergencyMeasures: fightingPop.emergencyMeasures || "none",
    availableForConscription: Math.max(0, availableForConscription),
  };
}
