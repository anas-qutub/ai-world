/**
 * Endgame Tensions System
 *
 * Creates dramatic late-game dynamics with nuclear weapons, arms races,
 * and the ever-present threat of mutually assured destruction.
 *
 * Core mechanics:
 * - Nuclear arsenals build tension
 * - Arms races between rivals
 * - Doomsday clock tracks global danger
 * - Near-miss incidents create drama
 * - MAD prevents total annihilation (usually)
 */

import { Doc, Id } from "../_generated/dataModel";
import { MutationCtx, QueryCtx } from "../_generated/server";

// =============================================
// CONSTANTS
// =============================================

export const NUCLEAR_THRESHOLDS = {
  // Technology requirements
  NUCLEAR_TECH_ID: "nuclear_fission",
  MISSILE_TECH_ID: "rocketry",

  // Production
  WARHEAD_COST_WEALTH: 20,
  WARHEAD_PRODUCTION_TIME: 12, // ticks to build one
  MAX_WARHEADS: 100,

  // Tension mechanics
  BASE_TENSION_PER_WARHEAD: 2,
  TENSION_DECAY_RATE: 0.5, // per tick when no escalation
  TENSION_THRESHOLD_WARNING: 50,
  TENSION_THRESHOLD_CRISIS: 75,
  TENSION_THRESHOLD_BRINK: 90,

  // Doomsday clock
  INITIAL_MINUTES_TO_MIDNIGHT: 12,
  MIN_MINUTES: 1, // Closest to midnight (most danger)
  MAX_MINUTES: 12,

  // Arms race
  ARMS_RACE_START_THRESHOLD: 3, // both have 3+ nukes
  ARMS_RACE_INTENSITY_GROWTH: 2, // per tick

  // MAD mechanics
  MAD_RETALIATION_THRESHOLD: 5, // Nukes needed for guaranteed retaliation
  FIRST_STRIKE_SURVIVAL_RATE: 0.3, // 30% of arsenal survives first strike
};

// =============================================
// NEAR-MISS INCIDENTS
// =============================================

export interface NearMissIncident {
  id: string;
  name: string;
  description: string;
  tensionIncrease: number;
  doomsdayMinutesLost: number;
  probability: number; // Base chance per tick when tension > 50
}

export const NEAR_MISS_INCIDENTS: NearMissIncident[] = [
  {
    id: "false_alarm",
    name: "False Alarm",
    description: "Radar systems detect incoming missiles that turn out to be a flock of birds",
    tensionIncrease: 15,
    doomsdayMinutesLost: 1,
    probability: 0.02,
  },
  {
    id: "submarine_collision",
    name: "Submarine Collision",
    description: "Nuclear-armed submarines from opposing powers collide in murky waters",
    tensionIncrease: 20,
    doomsdayMinutesLost: 1,
    probability: 0.01,
  },
  {
    id: "bomber_incursion",
    name: "Bomber Incursion",
    description: "Nuclear bombers accidentally cross into enemy airspace",
    tensionIncrease: 25,
    doomsdayMinutesLost: 2,
    probability: 0.015,
  },
  {
    id: "communication_failure",
    name: "Communication Blackout",
    description: "Communications go dark during a tense standoff, leaving leaders blind",
    tensionIncrease: 30,
    doomsdayMinutesLost: 2,
    probability: 0.01,
  },
  {
    id: "rogue_officer",
    name: "Rogue Officer",
    description: "A military officer refuses to stand down during alert, almost launching",
    tensionIncrease: 40,
    doomsdayMinutesLost: 3,
    probability: 0.005,
  },
  {
    id: "test_misinterpreted",
    name: "Test Misinterpreted",
    description: "A missile test is mistaken for a first strike",
    tensionIncrease: 35,
    doomsdayMinutesLost: 2,
    probability: 0.008,
  },
];

// =============================================
// MAIN PROCESSING
// =============================================

/**
 * Process all endgame tension mechanics
 */
export async function processEndgameTensions(
  ctx: MutationCtx,
  territories: Doc<"territories">[],
  tick: number
): Promise<{
  newArsenals: Id<"territories">[];
  armsRaceEvents: string[];
  nearMisses: string[];
  doomsdayMovement?: { direction: "closer" | "further"; minutes: number; reason: string };
  nuclearStrikes: Array<{ attacker: string; target: string; warheads: number }>;
}> {
  const results = {
    newArsenals: [] as Id<"territories">[],
    armsRaceEvents: [] as string[],
    nearMisses: [] as string[],
    doomsdayMovement: undefined as { direction: "closer" | "further"; minutes: number; reason: string } | undefined,
    nuclearStrikes: [] as Array<{ attacker: string; target: string; warheads: number }>,
  };

  const activeTerritories = territories.filter(t => !t.isEliminated);

  // Get all nuclear arsenals
  const arsenals = await ctx.db.query("nuclearArsenals").collect();
  const arsenalMap = new Map(arsenals.map(a => [a.territoryId.toString(), a]));

  // Process each territory
  for (const territory of activeTerritories) {
    // Check if territory can develop nukes
    const canDevelopNukes = await checkNuclearCapability(ctx, territory._id);

    if (canDevelopNukes) {
      let arsenal = arsenalMap.get(territory._id.toString());

      // Initialize arsenal if first time
      if (!arsenal) {
        const newArsenalId = await ctx.db.insert("nuclearArsenals", {
          territoryId: territory._id,
          warheads: 0,
          deliverySystems: 0,
          productionRate: 0,
          isProducing: false,
          nukesUsed: 0,
          targetedBy: [],
        });
        arsenal = await ctx.db.get(newArsenalId);
        if (arsenal) {
          results.newArsenals.push(territory._id);
        }
      }

      // Process nuclear production if active
      if (arsenal && arsenal.isProducing) {
        await processNuclearProduction(ctx, territory, arsenal, tick);
      }
    }
  }

  // Process arms races between nuclear powers
  const armsRaceResults = await processArmsRaces(ctx, arsenals, tick);
  results.armsRaceEvents = armsRaceResults.events;

  // Check for near-miss incidents
  const nearMissResults = await checkNearMissIncidents(ctx, arsenals, tick);
  results.nearMisses = nearMissResults.incidents;

  // Update doomsday clock
  const doomsdayResult = await updateDoomsdayClock(ctx, arsenals, nearMissResults.tensionAdded, tick);
  results.doomsdayMovement = doomsdayResult;

  return results;
}

/**
 * Check if a territory has nuclear capability
 */
async function checkNuclearCapability(
  ctx: MutationCtx,
  territoryId: Id<"territories">
): Promise<boolean> {
  const techs = await ctx.db
    .query("technologies")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .collect();

  const hasNuclearFission = techs.some(
    t => t.techId === NUCLEAR_THRESHOLDS.NUCLEAR_TECH_ID && t.researched
  );

  return hasNuclearFission;
}

/**
 * Process nuclear weapon production
 */
async function processNuclearProduction(
  ctx: MutationCtx,
  territory: Doc<"territories">,
  arsenal: Doc<"nuclearArsenals">,
  tick: number
): Promise<void> {
  // Check if can afford production
  if (territory.wealth < NUCLEAR_THRESHOLDS.WARHEAD_COST_WEALTH) {
    // Can't afford, stop production
    await ctx.db.patch(arsenal._id, { isProducing: false });
    return;
  }

  // Check max warheads
  if (arsenal.warheads >= NUCLEAR_THRESHOLDS.MAX_WARHEADS) {
    await ctx.db.patch(arsenal._id, { isProducing: false });
    return;
  }

  // Produce warhead (simplified - instant with cost)
  const newWarheads = arsenal.warheads + 1;

  await ctx.db.patch(arsenal._id, {
    warheads: newWarheads,
    firstNukeTick: arsenal.firstNukeTick ?? tick,
  });

  // Deduct cost
  await ctx.db.patch(territory._id, {
    wealth: territory.wealth - NUCLEAR_THRESHOLDS.WARHEAD_COST_WEALTH,
  });

  // Log first nuke as major event
  if (newWarheads === 1) {
    await ctx.db.insert("events", {
      tick,
      type: "nuclear",
      territoryId: territory._id,
      title: `${territory.tribeName || territory.name} Goes Nuclear!`,
      description: `${territory.tribeName || territory.name} has successfully developed their first nuclear weapon. The world holds its breath.`,
      severity: "critical",
      createdAt: Date.now(),
    });
  }
}

/**
 * Process arms races between nuclear powers
 */
async function processArmsRaces(
  ctx: MutationCtx,
  arsenals: Doc<"nuclearArsenals">[],
  tick: number
): Promise<{ events: string[] }> {
  const events: string[] = [];

  // Find territories with nukes
  const nuclearPowers = arsenals.filter(a => a.warheads >= NUCLEAR_THRESHOLDS.ARMS_RACE_START_THRESHOLD);

  if (nuclearPowers.length < 2) return { events };

  // Get existing arms races
  const existingRaces = await ctx.db
    .query("armsRaces")
    .withIndex("by_active", (q) => q.eq("isActive", true))
    .collect();

  const existingPairs = new Set(
    existingRaces.map(r => [r.territory1Id.toString(), r.territory2Id.toString()].sort().join("-"))
  );

  // Check for new arms races between hostile nuclear powers
  for (let i = 0; i < nuclearPowers.length; i++) {
    for (let j = i + 1; j < nuclearPowers.length; j++) {
      const p1 = nuclearPowers[i];
      const p2 = nuclearPowers[j];

      const pairKey = [p1.territoryId.toString(), p2.territoryId.toString()].sort().join("-");

      if (existingPairs.has(pairKey)) continue;

      // Check if they're hostile
      const relationship = await ctx.db
        .query("relationships")
        .filter(q => q.or(
          q.and(
            q.eq(q.field("territory1Id"), p1.territoryId),
            q.eq(q.field("territory2Id"), p2.territoryId)
          ),
          q.and(
            q.eq(q.field("territory1Id"), p2.territoryId),
            q.eq(q.field("territory2Id"), p1.territoryId)
          )
        ))
        .first();

      if (relationship && (relationship.status === "hostile" || relationship.status === "at_war" || relationship.status === "tense")) {
        // Start arms race!
        await ctx.db.insert("armsRaces", {
          territory1Id: p1.territoryId,
          territory2Id: p2.territoryId,
          startTick: tick,
          intensity: 20,
          nuclearTension: 30,
          closeCalls: [],
          isActive: true,
        });

        const t1 = await ctx.db.get(p1.territoryId);
        const t2 = await ctx.db.get(p2.territoryId);

        events.push(`Arms race begins between ${t1?.tribeName || t1?.name} and ${t2?.tribeName || t2?.name}!`);

        await ctx.db.insert("events", {
          tick,
          type: "nuclear",
          territoryId: p1.territoryId,
          targetTerritoryId: p2.territoryId,
          title: "Arms Race Begins!",
          description: `A nuclear arms race has begun between ${t1?.tribeName || t1?.name} and ${t2?.tribeName || t2?.name}. Both nations race to build more weapons.`,
          severity: "critical",
          createdAt: Date.now(),
        });
      }
    }
  }

  // Update existing arms races
  for (const race of existingRaces) {
    const p1Arsenal = arsenals.find(a => a.territoryId.toString() === race.territory1Id.toString());
    const p2Arsenal = arsenals.find(a => a.territoryId.toString() === race.territory2Id.toString());

    if (!p1Arsenal || !p2Arsenal) continue;

    // Calculate tension based on arsenal disparity
    const maxWarheads = Math.max(p1Arsenal.warheads, p2Arsenal.warheads);
    const minWarheads = Math.min(p1Arsenal.warheads, p2Arsenal.warheads);
    const disparity = maxWarheads > 0 ? minWarheads / maxWarheads : 1;

    // Tension increases when arsenals are unequal (one side feels threatened)
    const tensionGrowth = (1 - disparity) * 5 + NUCLEAR_THRESHOLDS.ARMS_RACE_INTENSITY_GROWTH;

    const newIntensity = Math.min(100, race.intensity + tensionGrowth);
    const newTension = Math.min(100, race.nuclearTension + tensionGrowth * 0.5);

    await ctx.db.patch(race._id, {
      intensity: newIntensity,
      nuclearTension: newTension,
    });

    // Log escalation milestones
    if (newTension >= NUCLEAR_THRESHOLDS.TENSION_THRESHOLD_CRISIS &&
        race.nuclearTension < NUCLEAR_THRESHOLDS.TENSION_THRESHOLD_CRISIS) {
      const t1 = await ctx.db.get(race.territory1Id);
      const t2 = await ctx.db.get(race.territory2Id);

      events.push(`Nuclear tension reaches crisis levels between ${t1?.tribeName || t1?.name} and ${t2?.tribeName || t2?.name}!`);

      await ctx.db.insert("events", {
        tick,
        type: "nuclear",
        territoryId: race.territory1Id,
        targetTerritoryId: race.territory2Id,
        title: "Nuclear Crisis!",
        description: `Nuclear tension between ${t1?.tribeName || t1?.name} and ${t2?.tribeName || t2?.name} has reached crisis levels. The world watches in fear.`,
        severity: "critical",
        createdAt: Date.now(),
      });
    }
  }

  return { events };
}

/**
 * Check for near-miss nuclear incidents
 */
async function checkNearMissIncidents(
  ctx: MutationCtx,
  arsenals: Doc<"nuclearArsenals">[],
  tick: number
): Promise<{ incidents: string[]; tensionAdded: number }> {
  const incidents: string[] = [];
  let tensionAdded = 0;

  // Get active arms races
  const activeRaces = await ctx.db
    .query("armsRaces")
    .withIndex("by_active", (q) => q.eq("isActive", true))
    .collect();

  for (const race of activeRaces) {
    // Only check for incidents when tension is high enough
    if (race.nuclearTension < NUCLEAR_THRESHOLDS.TENSION_THRESHOLD_WARNING) continue;

    // Higher tension = higher chance of incidents
    const tensionMultiplier = race.nuclearTension / 100;

    for (const incident of NEAR_MISS_INCIDENTS) {
      if (Math.random() < incident.probability * tensionMultiplier) {
        // Near miss occurred!
        const t1 = await ctx.db.get(race.territory1Id);
        const t2 = await ctx.db.get(race.territory2Id);

        const closeCalls = race.closeCalls || [];
        closeCalls.push({
          tick,
          description: incident.description,
          tensionAdded: incident.tensionIncrease,
        });

        await ctx.db.patch(race._id, {
          nuclearTension: Math.min(100, race.nuclearTension + incident.tensionIncrease),
          closeCalls,
        });

        tensionAdded += incident.tensionIncrease;
        incidents.push(`${incident.name} between ${t1?.tribeName || t1?.name} and ${t2?.tribeName || t2?.name}!`);

        await ctx.db.insert("events", {
          tick,
          type: "nuclear",
          territoryId: race.territory1Id,
          targetTerritoryId: race.territory2Id,
          title: `Near Miss: ${incident.name}`,
          description: `${incident.description} The incident between ${t1?.tribeName || t1?.name} and ${t2?.tribeName || t2?.name} nearly led to nuclear war!`,
          severity: "critical",
          createdAt: Date.now(),
        });

        // Only one incident per race per tick
        break;
      }
    }
  }

  return { incidents, tensionAdded };
}

/**
 * Update the doomsday clock
 */
async function updateDoomsdayClock(
  ctx: MutationCtx,
  arsenals: Doc<"nuclearArsenals">[],
  tensionAdded: number,
  tick: number
): Promise<{ direction: "closer" | "further"; minutes: number; reason: string } | undefined> {
  let doomsdayClock = await ctx.db.query("doomsdayClock").first();

  if (!doomsdayClock) {
    // Initialize doomsday clock
    const newId = await ctx.db.insert("doomsdayClock", {
      minutesToMidnight: NUCLEAR_THRESHOLDS.INITIAL_MINUTES_TO_MIDNIGHT,
      lastMovement: tick,
      movementReason: "Clock initialized",
      allTimeLowest: NUCLEAR_THRESHOLDS.INITIAL_MINUTES_TO_MIDNIGHT,
    });
    doomsdayClock = await ctx.db.get(newId);
    if (!doomsdayClock) return undefined;
  }

  // Calculate factors that move the clock
  const totalWarheads = arsenals.reduce((sum, a) => sum + a.warheads, 0);
  const nuclearPowers = arsenals.filter(a => a.warheads > 0).length;

  // Get active arms races
  const activeRaces = await ctx.db
    .query("armsRaces")
    .withIndex("by_active", (q) => q.eq("isActive", true))
    .collect();

  const avgTension = activeRaces.length > 0
    ? activeRaces.reduce((sum, r) => sum + r.nuclearTension, 0) / activeRaces.length
    : 0;

  // Determine clock movement
  let clockChange = 0;
  let reason = "";

  // Closer to midnight (danger increasing)
  if (tensionAdded > 0) {
    clockChange = -Math.ceil(tensionAdded / 20);
    reason = "Near-miss incident increased global danger";
  } else if (avgTension > NUCLEAR_THRESHOLDS.TENSION_THRESHOLD_BRINK) {
    clockChange = -1;
    reason = "Nuclear tensions at critical levels";
  } else if (totalWarheads > 50 && nuclearPowers > 2) {
    clockChange = -0.5;
    reason = "Nuclear proliferation continues";
  }

  // Further from midnight (danger decreasing) - happens rarely
  if (activeRaces.length === 0 && totalWarheads < 20) {
    clockChange = 0.5;
    reason = "Nuclear tensions easing globally";
  }

  if (clockChange === 0) return undefined;

  const newMinutes = Math.max(
    NUCLEAR_THRESHOLDS.MIN_MINUTES,
    Math.min(NUCLEAR_THRESHOLDS.MAX_MINUTES, doomsdayClock.minutesToMidnight + clockChange)
  );

  // Only update if actually changed
  if (newMinutes === doomsdayClock.minutesToMidnight) return undefined;

  const direction = clockChange < 0 ? "closer" : "further";
  const newAllTimeLowest = Math.min(doomsdayClock.allTimeLowest, newMinutes);

  await ctx.db.patch(doomsdayClock._id, {
    minutesToMidnight: newMinutes,
    lastMovement: tick,
    movementReason: reason,
    allTimeLowest: newAllTimeLowest,
    allTimeLowestTick: newAllTimeLowest < doomsdayClock.allTimeLowest ? tick : doomsdayClock.allTimeLowestTick,
  });

  // Log significant clock movements
  await ctx.db.insert("events", {
    tick,
    type: "nuclear",
    title: `Doomsday Clock: ${newMinutes} Minutes to Midnight`,
    description: `The Doomsday Clock has moved ${direction === "closer" ? "closer to" : "further from"} midnight. ${reason}. Humanity stands ${newMinutes} minutes from potential annihilation.`,
    severity: direction === "closer" ? "critical" : "positive",
    createdAt: Date.now(),
  });

  return { direction, minutes: newMinutes, reason };
}

// =============================================
// NUCLEAR STRIKE MECHANICS
// =============================================

/**
 * Execute a nuclear strike (called from AI decisions)
 */
export async function executeNuclearStrike(
  ctx: MutationCtx,
  attackerId: Id<"territories">,
  targetId: Id<"territories">,
  warheadsUsed: number,
  tick: number
): Promise<{
  success: boolean;
  casualties: number;
  retaliation: boolean;
  retaliationCasualties?: number;
  message: string;
}> {
  const attacker = await ctx.db.get(attackerId);
  const target = await ctx.db.get(targetId);

  if (!attacker || !target) {
    return { success: false, casualties: 0, retaliation: false, message: "Invalid territories" };
  }

  const attackerArsenal = await ctx.db
    .query("nuclearArsenals")
    .withIndex("by_territory", (q) => q.eq("territoryId", attackerId))
    .first();

  if (!attackerArsenal || attackerArsenal.warheads < warheadsUsed) {
    return { success: false, casualties: 0, retaliation: false, message: "Insufficient nuclear weapons" };
  }

  // Calculate strike damage (each warhead kills 5-15% of population)
  const damagePerWarhead = 0.05 + Math.random() * 0.1;
  const totalDamage = Math.min(0.9, warheadsUsed * damagePerWarhead);
  const casualties = Math.floor(target.population * totalDamage);

  // Apply damage
  await ctx.db.patch(targetId, {
    population: Math.max(5, target.population - casualties),
    happiness: Math.max(0, target.happiness - 50),
    wealth: Math.max(0, target.wealth - 40),
    food: Math.max(0, target.food - 30),
  });

  // Deduct warheads
  await ctx.db.patch(attackerArsenal._id, {
    warheads: attackerArsenal.warheads - warheadsUsed,
    nukesUsed: attackerArsenal.nukesUsed + warheadsUsed,
  });

  // Log the strike
  await ctx.db.insert("events", {
    tick,
    type: "nuclear",
    territoryId: attackerId,
    targetTerritoryId: targetId,
    title: `NUCLEAR STRIKE!`,
    description: `${attacker.tribeName || attacker.name} has launched ${warheadsUsed} nuclear weapon(s) at ${target.tribeName || target.name}! ${casualties.toLocaleString()} people killed. The world is changed forever.`,
    severity: "critical",
    createdAt: Date.now(),
  });

  // Check for retaliation (MAD)
  const targetArsenal = await ctx.db
    .query("nuclearArsenals")
    .withIndex("by_territory", (q) => q.eq("territoryId", targetId))
    .first();

  let retaliation = false;
  let retaliationCasualties = 0;

  if (targetArsenal && targetArsenal.warheads >= NUCLEAR_THRESHOLDS.MAD_RETALIATION_THRESHOLD) {
    // Automatic retaliation! (MAD doctrine)
    const survivingWarheads = Math.floor(targetArsenal.warheads * NUCLEAR_THRESHOLDS.FIRST_STRIKE_SURVIVAL_RATE);

    if (survivingWarheads > 0) {
      retaliation = true;
      const retaliationDamage = Math.min(0.9, survivingWarheads * damagePerWarhead);
      retaliationCasualties = Math.floor(attacker.population * retaliationDamage);

      await ctx.db.patch(attackerId, {
        population: Math.max(5, attacker.population - retaliationCasualties),
        happiness: Math.max(0, attacker.happiness - 50),
        wealth: Math.max(0, attacker.wealth - 40),
        food: Math.max(0, attacker.food - 30),
      });

      await ctx.db.patch(targetArsenal._id, {
        warheads: 0,
        nukesUsed: targetArsenal.nukesUsed + survivingWarheads,
      });

      await ctx.db.insert("events", {
        tick,
        type: "nuclear",
        territoryId: targetId,
        targetTerritoryId: attackerId,
        title: `NUCLEAR RETALIATION!`,
        description: `${target.tribeName || target.name} has launched a retaliatory nuclear strike with ${survivingWarheads} surviving weapons! ${retaliationCasualties.toLocaleString()} killed in ${attacker.tribeName || attacker.name}. Mutually Assured Destruction has claimed countless lives.`,
        severity: "critical",
        createdAt: Date.now(),
      });
    }
  }

  // Move doomsday clock to 1 minute
  const doomsdayClock = await ctx.db.query("doomsdayClock").first();
  if (doomsdayClock) {
    await ctx.db.patch(doomsdayClock._id, {
      minutesToMidnight: NUCLEAR_THRESHOLDS.MIN_MINUTES,
      lastMovement: tick,
      movementReason: "Nuclear weapons used in warfare",
      allTimeLowest: NUCLEAR_THRESHOLDS.MIN_MINUTES,
      allTimeLowestTick: tick,
    });
  }

  return {
    success: true,
    casualties,
    retaliation,
    retaliationCasualties,
    message: retaliation
      ? `Nuclear exchange! Both sides devastated by MAD.`
      : `Nuclear strike successful. ${casualties.toLocaleString()} killed.`,
  };
}

// =============================================
// QUERY FUNCTIONS
// =============================================

/**
 * Get nuclear status for a territory
 */
export async function getNuclearStatus(
  ctx: QueryCtx,
  territoryId: Id<"territories">
): Promise<{
  hasNukes: boolean;
  warheads: number;
  isProducing: boolean;
  nukesUsed: number;
} | null> {
  const arsenal = await ctx.db
    .query("nuclearArsenals")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .first();

  if (!arsenal) return null;

  return {
    hasNukes: arsenal.warheads > 0,
    warheads: arsenal.warheads,
    isProducing: arsenal.isProducing,
    nukesUsed: arsenal.nukesUsed,
  };
}

/**
 * Get doomsday clock status
 */
export async function getDoomsdayClockStatus(
  ctx: QueryCtx
): Promise<{
  minutesToMidnight: number;
  lastMovementReason: string;
  allTimeLowest: number;
  dangerLevel: "low" | "moderate" | "high" | "critical" | "extreme";
}> {
  const clock = await ctx.db.query("doomsdayClock").first();

  if (!clock) {
    return {
      minutesToMidnight: NUCLEAR_THRESHOLDS.INITIAL_MINUTES_TO_MIDNIGHT,
      lastMovementReason: "Clock not yet initialized",
      allTimeLowest: NUCLEAR_THRESHOLDS.INITIAL_MINUTES_TO_MIDNIGHT,
      dangerLevel: "low",
    };
  }

  let dangerLevel: "low" | "moderate" | "high" | "critical" | "extreme";
  if (clock.minutesToMidnight <= 2) dangerLevel = "extreme";
  else if (clock.minutesToMidnight <= 4) dangerLevel = "critical";
  else if (clock.minutesToMidnight <= 6) dangerLevel = "high";
  else if (clock.minutesToMidnight <= 9) dangerLevel = "moderate";
  else dangerLevel = "low";

  return {
    minutesToMidnight: clock.minutesToMidnight,
    lastMovementReason: clock.movementReason,
    allTimeLowest: clock.allTimeLowest,
    dangerLevel,
  };
}

/**
 * Get all active arms races
 */
export async function getActiveArmsRaces(
  ctx: QueryCtx
): Promise<Array<{
  territory1Name: string;
  territory2Name: string;
  intensity: number;
  nuclearTension: number;
  closeCalls: number;
}>> {
  const races = await ctx.db
    .query("armsRaces")
    .withIndex("by_active", (q) => q.eq("isActive", true))
    .collect();

  const results = [];
  for (const race of races) {
    const t1 = await ctx.db.get(race.territory1Id);
    const t2 = await ctx.db.get(race.territory2Id);

    results.push({
      territory1Name: t1?.tribeName || t1?.name || "Unknown",
      territory2Name: t2?.tribeName || t2?.name || "Unknown",
      intensity: race.intensity,
      nuclearTension: race.nuclearTension,
      closeCalls: race.closeCalls.length,
    });
  }

  return results;
}

/**
 * Start nuclear production for a territory
 */
export async function startNuclearProduction(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  tick: number
): Promise<{ success: boolean; message: string }> {
  // Check capability
  const canDevelop = await checkNuclearCapability(ctx, territoryId);
  if (!canDevelop) {
    return { success: false, message: "Nuclear fission technology required" };
  }

  let arsenal = await ctx.db
    .query("nuclearArsenals")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .first();

  if (!arsenal) {
    const newId = await ctx.db.insert("nuclearArsenals", {
      territoryId,
      warheads: 0,
      deliverySystems: 0,
      productionRate: 1,
      isProducing: true,
      nukesUsed: 0,
      targetedBy: [],
    });

    const territory = await ctx.db.get(territoryId);
    await ctx.db.insert("events", {
      tick,
      type: "nuclear",
      territoryId,
      title: "Nuclear Program Begins",
      description: `${territory?.tribeName || territory?.name} has begun developing nuclear weapons. The world grows more dangerous.`,
      severity: "negative",
      createdAt: Date.now(),
    });

    return { success: true, message: "Nuclear weapons program initiated" };
  }

  if (arsenal.isProducing) {
    return { success: false, message: "Already producing nuclear weapons" };
  }

  await ctx.db.patch(arsenal._id, { isProducing: true });
  return { success: true, message: "Nuclear production resumed" };
}
