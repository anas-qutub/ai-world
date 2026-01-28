/**
 * Addiction System
 *
 * Handles alcohol, gambling, opium addiction - triggers, progression,
 * effects, and recovery.
 */

import { MutationCtx, QueryCtx } from "../_generated/server";
import { Id, Doc } from "../_generated/dataModel";

// Addiction types
export type AddictionType = "alcohol" | "gambling" | "opium" | "other";
export type AddictionSeverity = "mild" | "moderate" | "severe" | "crippling";

// Severity progression thresholds
const SEVERITY_THRESHOLDS = {
  mild: { withdrawalMax: 20, functionalityImpact: 10, wealthDrain: 5 },
  moderate: { withdrawalMax: 40, functionalityImpact: 25, wealthDrain: 15 },
  severe: { withdrawalMax: 70, functionalityImpact: 50, wealthDrain: 30 },
  crippling: { withdrawalMax: 100, functionalityImpact: 80, wealthDrain: 50 },
};

// Addiction triggers
const ADDICTION_TRIGGERS = {
  trauma: 0.1, // 10% chance per high trauma event
  boredom: 0.05, // 5% for wealthy with nothing to do
  culture: 0.03, // 3% if alcohol is cultural norm
  genetics: 0.15, // 15% if parent had addiction
  grief: 0.08, // 8% after losing loved one
};

/**
 * Check if a character develops addiction
 */
export async function checkAddictionTrigger(
  ctx: MutationCtx,
  characterId: Id<"characters">,
  triggerType: keyof typeof ADDICTION_TRIGGERS,
  tick: number
): Promise<{ addicted: boolean; type?: AddictionType }> {
  const character = await ctx.db.get(characterId);
  if (!character || !character.isAlive) return { addicted: false };

  // Already has addiction
  if (character.hasAddiction) return { addicted: false };

  const probability = ADDICTION_TRIGGERS[triggerType];

  // Modifiers
  let adjustedProb = probability;

  // Traits affect susceptibility (high values in certain traits)
  // High wisdom = disciplined, high honor = temperate
  if (character.traits.wisdom > 70) adjustedProb *= 0.5;
  if (character.traits.greed > 70) adjustedProb *= 2;
  if (character.traits.honor > 70) adjustedProb *= 0.3;
  if (character.traits.wrath > 70) adjustedProb *= 1.5;

  // Mental health affects susceptibility
  if (character.mentalHealth) {
    if (character.mentalHealth.depression > 50) adjustedProb *= 1.5;
    if (character.mentalHealth.trauma > 50) adjustedProb *= 1.3;
  }

  if (Math.random() >= adjustedProb) return { addicted: false };

  // Determine addiction type
  let addictionType: AddictionType;
  const roll = Math.random();

  if (triggerType === "boredom" && roll < 0.4) {
    addictionType = "gambling";
  } else if (triggerType === "trauma" || triggerType === "grief") {
    addictionType = roll < 0.6 ? "alcohol" : roll < 0.9 ? "opium" : "gambling";
  } else {
    addictionType = roll < 0.7 ? "alcohol" : roll < 0.85 ? "gambling" : "opium";
  }

  // Create addiction record
  const addictionId = await ctx.db.insert("addictions", {
    characterId,
    territoryId: character.territoryId,
    type: addictionType,
    severity: "mild",
    startTick: tick,
    lastIndulgeTick: tick,
    withdrawalLevel: 0,
    functionalityImpact: SEVERITY_THRESHOLDS.mild.functionalityImpact,
    wealthDrain: SEVERITY_THRESHOLDS.mild.wealthDrain,
    isSecret: true,
    recoveryAttempts: 0,
    inRecovery: false,
  });

  await ctx.db.patch(characterId, {
    hasAddiction: true,
    addictionType,
    addictionId,
  });

  return { addicted: true, type: addictionType };
}

/**
 * Process addiction for a character
 */
async function processCharacterAddiction(
  ctx: MutationCtx,
  addiction: Doc<"addictions">,
  tick: number
): Promise<{ events: Array<{ type: string; description: string }> }> {
  const events: Array<{ type: string; description: string }> = [];

  const character = await ctx.db.get(addiction.characterId);
  if (!character || !character.isAlive) {
    // Character dead, remove addiction
    await ctx.db.delete(addiction._id);
    return { events };
  }

  // Calculate time since last indulgence
  const ticksSinceIndulge = tick - addiction.lastIndulgeTick;

  // Withdrawal increases over time without indulging
  let newWithdrawal = addiction.withdrawalLevel;
  if (ticksSinceIndulge > 2) {
    const withdrawalIncrease = (ticksSinceIndulge - 2) * 10;
    newWithdrawal = Math.min(100, addiction.withdrawalLevel + withdrawalIncrease);
  } else {
    // Withdrawal decreases if recently indulged
    newWithdrawal = Math.max(0, addiction.withdrawalLevel - 5);
  }

  // Character may choose to indulge
  const willIndulge = shouldIndulge(character, addiction, newWithdrawal);

  if (willIndulge) {
    newWithdrawal = 0;
    await ctx.db.patch(addiction._id, {
      lastIndulgeTick: tick,
      withdrawalLevel: 0,
    });

    // Wealth drain
    const territory = await ctx.db.get(addiction.territoryId);
    if (territory) {
      const drain = addiction.wealthDrain;
      await ctx.db.patch(addiction.territoryId, {
        wealth: Math.max(0, territory.wealth - drain),
      });

      // Gambling can lead to embezzlement at severe levels
      if (
        addiction.type === "gambling" &&
        (addiction.severity === "severe" || addiction.severity === "crippling") &&
        Math.random() < 0.1
      ) {
        events.push({
          type: "embezzlement",
          description: `${character.name}'s gambling debts have led to embezzlement of funds.`,
        });
      }
    }

    // Check for severity progression
    if (Math.random() < 0.05) {
      const newSeverity = progressSeverity(addiction.severity);
      if (newSeverity !== addiction.severity) {
        const thresholds = SEVERITY_THRESHOLDS[newSeverity];
        await ctx.db.patch(addiction._id, {
          severity: newSeverity,
          functionalityImpact: thresholds.functionalityImpact,
          wealthDrain: thresholds.wealthDrain,
        });

        events.push({
          type: "addiction_worsened",
          description: `${character.name}'s ${addiction.type} problem has worsened to ${newSeverity}.`,
        });
      }
    }

    // Secret may be discovered
    if (addiction.isSecret && Math.random() < 0.1) {
      await ctx.db.patch(addiction._id, { isSecret: false });
      events.push({
        type: "addiction_discovered",
        description: `${character.name}'s ${addiction.type} addiction has been discovered.`,
      });
    }
  } else {
    // Update withdrawal level
    await ctx.db.patch(addiction._id, { withdrawalLevel: newWithdrawal });

    // High withdrawal effects
    if (newWithdrawal > 70) {
      events.push({
        type: "withdrawal_severe",
        description: `${character.name} suffers from severe ${addiction.type} withdrawal.`,
      });

      // Withdrawal can cause health issues
      if (newWithdrawal > 90 && Math.random() < 0.05) {
        // Death from withdrawal (rare, mainly opium)
        if (addiction.type === "opium" && Math.random() < 0.3) {
          await ctx.db.patch(character._id, {
            isAlive: false,
            deathTick: tick,
            deathCause: "withdrawal",
          });

          events.push({
            type: "death_withdrawal",
            description: `${character.name} died from severe opium withdrawal.`,
          });
        }
      }
    }
  }

  // Death from overdose (crippling severity)
  if (addiction.severity === "crippling" && willIndulge && Math.random() < 0.02) {
    await ctx.db.patch(character._id, {
      isAlive: false,
      deathTick: tick,
      deathCause: addiction.type === "alcohol" ? "alcohol poisoning" : "overdose",
    });

    events.push({
      type: "death_overdose",
      description: `${character.name} died from ${addiction.type === "alcohol" ? "alcohol poisoning" : "overdose"}.`,
    });
  }

  return { events };
}

/**
 * Determine if character will indulge
 */
function shouldIndulge(
  character: Doc<"characters">,
  addiction: Doc<"addictions">,
  withdrawal: number
): boolean {
  // Base chance to indulge
  let chance = 0.3;

  // Higher withdrawal = higher chance to indulge
  chance += withdrawal / 200;

  // Severity affects compulsion
  switch (addiction.severity) {
    case "mild":
      chance *= 0.8;
      break;
    case "moderate":
      chance *= 1;
      break;
    case "severe":
      chance *= 1.3;
      break;
    case "crippling":
      chance *= 1.8;
      break;
  }

  // Traits affect willpower (high wisdom = disciplined, low loyalty = weak-willed)
  if (character.traits.wisdom > 70) chance *= 0.6;
  if (character.traits.loyalty < 30) chance *= 1.5;
  if (character.traits.honor > 70) chance *= 0.7;

  // In recovery attempt
  if (addiction.recoveryAttempts > 0) chance *= 0.7;

  return Math.random() < chance;
}

/**
 * Progress severity to next level
 */
function progressSeverity(current: AddictionSeverity): AddictionSeverity {
  switch (current) {
    case "mild":
      return "moderate";
    case "moderate":
      return "severe";
    case "severe":
      return "crippling";
    case "crippling":
      return "crippling";
  }
}

/**
 * Attempt recovery from addiction
 */
export async function attemptRecovery(
  ctx: MutationCtx,
  addictionId: Id<"addictions">,
  tick: number
): Promise<{ success: boolean; message: string }> {
  const addiction = await ctx.db.get(addictionId);
  if (!addiction) {
    return { success: false, message: "Addiction not found" };
  }

  const character = await ctx.db.get(addiction.characterId);
  if (!character) {
    return { success: false, message: "Character not found" };
  }

  // Increment recovery attempts
  await ctx.db.patch(addictionId, {
    recoveryAttempts: addiction.recoveryAttempts + 1,
  });

  // Calculate success chance
  let successChance = 0.1; // Base 10%

  // More attempts = slightly better chance (learned from failure)
  successChance += addiction.recoveryAttempts * 0.02;

  // Severity affects difficulty
  switch (addiction.severity) {
    case "mild":
      successChance += 0.2;
      break;
    case "moderate":
      successChance += 0.1;
      break;
    case "severe":
      successChance -= 0.05;
      break;
    case "crippling":
      successChance -= 0.1;
      break;
  }

  // Traits affect success (high wisdom/honor = disciplined/determined)
  if (character.traits.wisdom > 70) successChance += 0.15;
  if (character.traits.courage > 70) successChance += 0.1;
  if (character.traits.loyalty < 30) successChance -= 0.1;

  // Support helps (in therapy)
  if (character.mentalHealth?.inTherapy) successChance += 0.15;

  // Close friends help
  const friendships = await ctx.db
    .query("friendships")
    .withIndex("by_territory", (q) => q.eq("territoryId", addiction.territoryId))
    .collect();

  const closeFriends = friendships.filter(
    (f) =>
      (f.character1Id === character._id || f.character2Id === character._id) &&
      (f.friendshipType === "close_friend" ||
        f.friendshipType === "best_friend" ||
        f.friendshipType === "sworn_brother")
  );

  if (closeFriends.length > 0) successChance += 0.1;

  if (Math.random() < successChance) {
    // Recovery successful!
    await ctx.db.delete(addictionId);
    await ctx.db.patch(character._id, {
      hasAddiction: false,
      addictionType: undefined,
      addictionId: undefined,
    });

    // Record memory
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_territory", (q) => q.eq("territoryId", addiction.territoryId))
      .first();

    if (agent) {
      await ctx.db.insert("agentMemories", {
        agentId: agent._id,
        territoryId: addiction.territoryId,
        memoryType: "victory",
        tick,
        description: `${character.name} has overcome their ${addiction.type} addiction.`,
        emotionalWeight: 15,
        salience: 50,
        timesReferenced: 0,
      });
    }

    return {
      success: true,
      message: `${character.name} has successfully overcome their ${addiction.type} addiction!`,
    };
  } else {
    // Recovery failed
    // May worsen severity due to relapse
    if (Math.random() < 0.2) {
      const newSeverity = progressSeverity(addiction.severity);
      if (newSeverity !== addiction.severity) {
        await ctx.db.patch(addictionId, {
          severity: newSeverity,
          functionalityImpact: SEVERITY_THRESHOLDS[newSeverity].functionalityImpact,
          wealthDrain: SEVERITY_THRESHOLDS[newSeverity].wealthDrain,
        });
      }
    }

    return {
      success: false,
      message: `${character.name}'s recovery attempt failed. The struggle continues.`,
    };
  }
}

/**
 * Ban substances in territory
 */
export async function banSubstances(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  substanceType: AddictionType,
  tick: number
): Promise<{ success: boolean; message: string }> {
  // This is a territory-wide policy
  // In reality, it would affect availability and social acceptability

  // Record memory
  const agent = await ctx.db
    .query("agents")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .first();

  if (agent) {
    await ctx.db.insert("agentMemories", {
      agentId: agent._id,
      territoryId,
      memoryType: "crisis",
      tick,
      description: `Prohibition enacted on ${substanceType}. Whether this helps or creates new problems remains to be seen.`,
      emotionalWeight: 0,
      salience: 60,
      timesReferenced: 0,
    });
  }

  // Prohibition has mixed effects - can reduce new addictions but also drives it underground
  return {
    success: true,
    message: `${substanceType.charAt(0).toUpperCase() + substanceType.slice(1)} has been banned. Enforcement will be challenging.`,
  };
}

/**
 * Regulate taverns in territory
 */
export async function regulateTaverns(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  tick: number
): Promise<{ success: boolean; message: string }> {
  // Record memory
  const agent = await ctx.db
    .query("agents")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .first();

  if (agent) {
    await ctx.db.insert("agentMemories", {
      agentId: agent._id,
      territoryId,
      memoryType: "crisis",
      tick,
      description:
        "Tavern regulations enacted. Hours restricted, serving to intoxicated persons prohibited.",
      emotionalWeight: 0,
      salience: 40,
      timesReferenced: 0,
    });
  }

  return {
    success: true,
    message: "Tavern regulations have been enacted to reduce excessive drinking.",
  };
}

/**
 * Process all addictions in territory
 */
export async function processAddictions(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  tick: number
): Promise<{ events: Array<{ type: string; description: string }> }> {
  const allEvents: Array<{ type: string; description: string }> = [];

  const addictions = await ctx.db
    .query("addictions")
    .filter((q) => q.eq(q.field("territoryId"), territoryId))
    .collect();

  for (const addiction of addictions) {
    const { events } = await processCharacterAddiction(ctx, addiction, tick);
    allEvents.push(...events);
  }

  return { events: allEvents };
}

/**
 * Get addiction summary for AI
 */
export async function getAddictionSummary(
  ctx: QueryCtx,
  territoryId: Id<"territories">
): Promise<string> {
  const addictions = await ctx.db
    .query("addictions")
    .filter((q) => q.eq(q.field("territoryId"), territoryId))
    .collect();

  if (addictions.length === 0) {
    return "No known addiction problems in the territory.";
  }

  const byType: Record<string, number> = {};
  let severe = 0;

  for (const addiction of addictions) {
    byType[addiction.type] = (byType[addiction.type] || 0) + 1;
    if (addiction.severity === "severe" || addiction.severity === "crippling") {
      severe++;
    }
  }

  const typeList = Object.entries(byType)
    .map(([type, count]) => `${count} with ${type} problems`)
    .join(", ");

  let summary = `Addiction issues: ${typeList}.`;
  if (severe > 0) {
    summary += ` ${severe} with severe/crippling addictions.`;
  }

  return summary;
}
