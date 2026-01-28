/**
 * Mental Health System
 *
 * Handles trauma, depression, anxiety, PTSD, madness, and recovery.
 */

import { MutationCtx, QueryCtx } from "../_generated/server";
import { Id, Doc } from "../_generated/dataModel";

// Madness types
export type MadnessType =
  | "paranoid"
  | "megalomaniac"
  | "violent"
  | "delusional"
  | "depressive"
  | "manic";

// Trauma sources
export type TraumaSource =
  | "war_witness"
  | "war_killing"
  | "disaster"
  | "loss_spouse"
  | "loss_child"
  | "loss_friend"
  | "betrayal"
  | "torture"
  | "imprisonment"
  | "famine";

// Trauma severity by source
const TRAUMA_SEVERITY: Record<TraumaSource, number> = {
  war_witness: 15,
  war_killing: 25,
  disaster: 30,
  loss_spouse: 40,
  loss_child: 50,
  loss_friend: 20,
  betrayal: 25,
  torture: 45,
  imprisonment: 20,
  famine: 15,
};

// Mental health default values
export const DEFAULT_MENTAL_HEALTH: {
  sanity: number;
  trauma: number;
  depression: number;
  anxiety: number;
  ptsd: boolean;
  inTherapy: boolean;
  madness?: MadnessType;
  lastTraumaticEvent?: string;
  lastTraumaticEventTick?: number;
} = {
  sanity: 80,
  trauma: 0,
  depression: 0,
  anxiety: 0,
  ptsd: false,
  inTherapy: false,
};

/**
 * Initialize mental health for a character based on their traits
 */
export function initializeMentalHealth(traits: {
  paranoia: number;
  courage: number;
  wisdom: number;
  [key: string]: number;
}): {
  sanity: number;
  trauma: number;
  depression: number;
  anxiety: number;
  ptsd: boolean;
  inTherapy: boolean;
} {
  let sanity = 80;
  let anxiety = 0;

  // Adjust based on numeric trait values
  // High paranoia = more anxious
  if (traits.paranoia > 70) anxiety += 20;
  // High courage = better sanity
  if (traits.courage > 70) sanity += 10;
  // Low courage = more anxious
  if (traits.courage < 30) anxiety += 15;
  // High wisdom = stoic, better sanity
  if (traits.wisdom > 70) sanity += 15;
  // High compassion = sensitive, more anxious
  if ((traits as any).compassion > 70) anxiety += 10;

  return {
    sanity: Math.min(100, sanity),
    trauma: 0,
    depression: 0,
    anxiety: Math.min(100, anxiety),
    ptsd: false,
    inTherapy: false,
  };
}

/**
 * Apply trauma to a character
 */
export async function applyTrauma(
  ctx: MutationCtx,
  characterId: Id<"characters">,
  source: TraumaSource,
  tick: number,
  intensityMultiplier: number = 1
): Promise<{
  newTraumaLevel: number;
  developedPTSD: boolean;
  developedMadness: MadnessType | null;
}> {
  const character = await ctx.db.get(characterId);
  if (!character) throw new Error("Character not found");

  const mentalHealth = character.mentalHealth || DEFAULT_MENTAL_HEALTH;
  const baseSeverity = TRAUMA_SEVERITY[source];
  const severity = Math.floor(baseSeverity * intensityMultiplier);

  // Calculate resistance based on traits and existing state
  let resistance = 1;
  // High wisdom = stoic
  if (character.traits.wisdom > 70) resistance *= 0.7;
  // High courage = brave
  if (character.traits.courage > 70) resistance *= 0.85;
  // High compassion = sensitive
  if (character.traits.compassion > 70) resistance *= 1.3;
  // Low courage = cowardly
  if (character.traits.courage < 30) resistance *= 1.2;

  // Existing trauma makes new trauma worse
  if (mentalHealth.trauma > 50) resistance *= 1.2;
  if (mentalHealth.ptsd) resistance *= 1.3;

  const adjustedSeverity = Math.floor(severity * resistance);

  // Update mental health values
  const newTrauma = Math.min(100, mentalHealth.trauma + adjustedSeverity);
  const newAnxiety = Math.min(100, mentalHealth.anxiety + adjustedSeverity * 0.5);
  const newDepression = Math.min(100, mentalHealth.depression + adjustedSeverity * 0.3);
  const newSanity = Math.max(0, mentalHealth.sanity - adjustedSeverity * 0.4);

  // Check for PTSD development
  let developedPTSD = false;
  if (!mentalHealth.ptsd && newTrauma > 60 && Math.random() < 0.3) {
    developedPTSD = true;
  }

  // Check for madness development
  let developedMadness: MadnessType | null = null;
  if (newSanity < 20 && Math.random() < 0.2) {
    const madnessTypes: MadnessType[] = [
      "paranoid",
      "megalomaniac",
      "violent",
      "delusional",
      "depressive",
      "manic",
    ];

    // Weight madness types based on trauma source
    if (source === "betrayal") {
      developedMadness = "paranoid";
    } else if (source === "war_killing" || source === "torture") {
      developedMadness = Math.random() < 0.5 ? "violent" : "paranoid";
    } else if (source === "loss_child" || source === "loss_spouse") {
      developedMadness = Math.random() < 0.5 ? "depressive" : "delusional";
    } else {
      developedMadness = madnessTypes[Math.floor(Math.random() * madnessTypes.length)];
    }
  }

  // Update character
  await ctx.db.patch(characterId, {
    mentalHealth: {
      sanity: newSanity,
      trauma: newTrauma,
      depression: newDepression,
      anxiety: newAnxiety,
      ptsd: mentalHealth.ptsd || developedPTSD,
      madness: developedMadness || mentalHealth.madness,
      inTherapy: mentalHealth.inTherapy,
      lastTraumaticEvent: source.replace(/_/g, " "),
      lastTraumaticEventTick: tick,
    },
  });

  return {
    newTraumaLevel: newTrauma,
    developedPTSD,
    developedMadness,
  };
}

/**
 * Natural recovery each tick
 */
async function naturalRecovery(
  ctx: MutationCtx,
  character: Doc<"characters">,
  tick: number
): Promise<{ recovered: boolean; description?: string }> {
  const mentalHealth = character.mentalHealth;
  if (!mentalHealth) return { recovered: false };

  let recoveryRate = 0.5; // Base recovery per tick

  // Factors that help recovery
  // High courage = resilient, high wisdom = optimistic
  if (character.traits.courage > 70) recoveryRate *= 1.5;
  if (character.traits.wisdom > 70) recoveryRate *= 1.3;
  if (mentalHealth.inTherapy) recoveryRate *= 2;

  // Check for close friends (helps recovery)
  const friendships = await ctx.db
    .query("friendships")
    .withIndex("by_territory", (q) => q.eq("territoryId", character.territoryId))
    .collect();

  const closeFriends = friendships.filter(
    (f) =>
      (f.character1Id === character._id || f.character2Id === character._id) &&
      (f.friendshipType === "close_friend" ||
        f.friendshipType === "best_friend" ||
        f.friendshipType === "sworn_brother")
  );

  if (closeFriends.length > 0) recoveryRate *= 1.3;

  // RELIGION INFLUENCE: Faith provides comfort and meaning in difficult times
  // This is historically accurate - religious practices help people cope with trauma
  const territory = await ctx.db.get(character.territoryId);

  // Personal piety helps recovery
  if (character.piety && character.piety > 30) {
    // Piety 30-60: small bonus, 60-100: significant bonus
    const pietyBonus = character.piety > 60 ? 1.4 : 1.2;
    recoveryRate *= pietyBonus;
  }

  // Territory with state religion and temples provides community support
  if (territory) {
    const stateReligion = await ctx.db
      .query("religions")
      .filter((q: any) => q.eq(q.field("isStateReligion"), character.territoryId))
      .first();

    if (stateReligion && character.faith === stateReligion._id) {
      // Character follows the state religion - community support
      recoveryRate *= 1.3;

      // Check for temples (more temples = more support)
      const temples = await ctx.db
        .query("temples")
        .withIndex("by_territory", (q: any) => q.eq("territoryId", character.territoryId))
        .collect();

      if (temples.length > 0) {
        // Priests and temples provide spiritual guidance
        recoveryRate *= 1.1;
      }
    }

    // General territory happiness still helps
    if (territory.happiness > 50) recoveryRate *= 1.2;
  }

  // Factors that slow recovery
  if (mentalHealth.ptsd) recoveryRate *= 0.5;
  if (mentalHealth.madness) recoveryRate *= 0.3;

  // Time since last trauma (recent trauma doesn't recover as fast)
  const ticksSinceTrauma = mentalHealth.lastTraumaticEventTick
    ? tick - mentalHealth.lastTraumaticEventTick
    : 100;

  if (ticksSinceTrauma < 5) recoveryRate *= 0.3;
  else if (ticksSinceTrauma < 10) recoveryRate *= 0.6;

  // Apply recovery
  const newTrauma = Math.max(0, mentalHealth.trauma - recoveryRate);
  const newDepression = Math.max(0, mentalHealth.depression - recoveryRate * 0.8);
  const newAnxiety = Math.max(0, mentalHealth.anxiety - recoveryRate * 0.7);
  const newSanity = Math.min(100, mentalHealth.sanity + recoveryRate * 0.5);

  // Check for PTSD recovery (rare)
  let ptsdRecovered = false;
  if (mentalHealth.ptsd && newTrauma < 20 && Math.random() < 0.01) {
    ptsdRecovered = true;
  }

  // Check for madness recovery (very rare)
  let madnessRecovered = false;
  if (mentalHealth.madness && newSanity > 70 && Math.random() < 0.005) {
    madnessRecovered = true;
  }

  await ctx.db.patch(character._id, {
    mentalHealth: {
      ...mentalHealth,
      trauma: newTrauma,
      depression: newDepression,
      anxiety: newAnxiety,
      sanity: newSanity,
      ptsd: ptsdRecovered ? false : mentalHealth.ptsd,
      madness: madnessRecovered ? undefined : mentalHealth.madness,
    },
  });

  if (ptsdRecovered || madnessRecovered) {
    return {
      recovered: true,
      description: ptsdRecovered
        ? `${character.name} has recovered from PTSD.`
        : `${character.name} has recovered from ${mentalHealth.madness} madness.`,
    };
  }

  return { recovered: false };
}

/**
 * Process mental health for all characters in territory
 */
export async function processMentalHealth(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  tick: number
): Promise<{ events: Array<{ type: string; description: string }> }> {
  const events: Array<{ type: string; description: string }> = [];

  const characters = await ctx.db
    .query("characters")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .filter((q) => q.eq(q.field("isAlive"), true))
    .collect();

  for (const character of characters) {
    if (!character.mentalHealth) continue;

    // Natural recovery
    const recovery = await naturalRecovery(ctx, character, tick);
    if (recovery.recovered && recovery.description) {
      events.push({
        type: "mental_health_recovery",
        description: recovery.description,
      });
    }

    // Check for madness effects
    if (character.mentalHealth.madness) {
      const madnessEvent = await processMadnessEffects(ctx, character, tick);
      if (madnessEvent) {
        events.push(madnessEvent);
      }
    }

    // Check for suicide risk (extremely high depression + low sanity)
    if (
      character.mentalHealth.depression > 90 &&
      character.mentalHealth.sanity < 10 &&
      Math.random() < 0.01
    ) {
      // Tragic death
      await ctx.db.patch(character._id, {
        isAlive: false,
        deathTick: tick,
        deathCause: "despair",
      });

      events.push({
        type: "tragic_death",
        description: `${character.name} succumbed to despair and took their own life.`,
      });

      // This causes trauma for family and friends
      await traumatizeLoveOnes(ctx, character, tick);
    }

    // Check for addiction trigger (trauma can lead to addiction)
    if (
      character.mentalHealth.trauma > 50 &&
      !character.hasAddiction &&
      Math.random() < 0.02
    ) {
      // Start mild addiction
      const addictionType = Math.random() < 0.7 ? "alcohol" : "gambling";
      await ctx.db.insert("addictions", {
        characterId: character._id,
        territoryId,
        type: addictionType,
        severity: "mild",
        startTick: tick,
        lastIndulgeTick: tick,
        withdrawalLevel: 0,
        functionalityImpact: 10,
        wealthDrain: 5,
        isSecret: true,
        recoveryAttempts: 0,
        inRecovery: false,
      });

      await ctx.db.patch(character._id, {
        hasAddiction: true,
        addictionType,
      });

      events.push({
        type: "addiction_start",
        description: `${character.name} has started drinking heavily to cope with their troubles.`,
      });
    }
  }

  return { events };
}

/**
 * Process effects of madness
 */
async function processMadnessEffects(
  ctx: MutationCtx,
  character: Doc<"characters">,
  tick: number
): Promise<{ type: string; description: string } | null> {
  const madness = character.mentalHealth?.madness;
  if (!madness) return null;

  // Random chance for madness to manifest
  if (Math.random() > 0.05) return null;

  switch (madness) {
    case "paranoid":
      // Sees plots everywhere, might exile/execute innocents
      return {
        type: "madness_paranoid",
        description: `${character.name}, gripped by paranoia, sees conspiracies everywhere.`,
      };

    case "megalomaniac":
      // Makes reckless decisions, overextends
      return {
        type: "madness_megalomaniac",
        description: `${character.name}'s delusions of grandeur lead to reckless ambitions.`,
      };

    case "violent":
      // May randomly attack others
      return {
        type: "madness_violent",
        description: `${character.name} has violent outbursts, frightening those around them.`,
      };

    case "delusional":
      // Believes false things, makes decisions based on delusions
      return {
        type: "madness_delusional",
        description: `${character.name} speaks of visions and believes things that aren't real.`,
      };

    case "depressive":
      // Cannot function, neglects duties
      return {
        type: "madness_depressive",
        description: `${character.name} has fallen into deep melancholy and neglects their duties.`,
      };

    case "manic":
      // Hyperactive, impulsive, might make brilliant or terrible decisions
      return {
        type: "madness_manic",
        description: `${character.name} is in a manic state, making impulsive decisions.`,
      };

    default:
      return null;
  }
}

/**
 * Traumatize loved ones when someone dies
 */
async function traumatizeLoveOnes(
  ctx: MutationCtx,
  deceased: Doc<"characters">,
  tick: number
): Promise<void> {
  // Find spouse
  if (deceased.spouseId) {
    await applyTrauma(ctx, deceased.spouseId, "loss_spouse", tick);
  }

  // Find close friends
  const friendships = await ctx.db
    .query("friendships")
    .withIndex("by_territory", (q) => q.eq("territoryId", deceased.territoryId))
    .collect();

  for (const friendship of friendships) {
    if (
      friendship.character1Id === deceased._id ||
      friendship.character2Id === deceased._id
    ) {
      const friendId =
        friendship.character1Id === deceased._id
          ? friendship.character2Id
          : friendship.character1Id;

      // Closer friends are more affected
      const intensity =
        friendship.friendshipType === "sworn_brother"
          ? 1.5
          : friendship.friendshipType === "best_friend"
            ? 1.3
            : friendship.friendshipType === "close_friend"
              ? 1
              : 0.5;

      await applyTrauma(ctx, friendId, "loss_friend", tick, intensity);
    }
  }
}

/**
 * Start therapy for a character
 */
export async function startTherapy(
  ctx: MutationCtx,
  characterId: Id<"characters">
): Promise<{ success: boolean; message: string }> {
  const character = await ctx.db.get(characterId);
  if (!character) {
    return { success: false, message: "Character not found" };
  }

  const mentalHealth = character.mentalHealth || DEFAULT_MENTAL_HEALTH;

  if (mentalHealth.inTherapy) {
    return { success: false, message: "Already in therapy" };
  }

  // Check if territory has healers (scholars/priests)
  const territory = await ctx.db.get(character.territoryId);
  if (!territory) {
    return { success: false, message: "Territory not found" };
  }

  // Need technology (education) or happiness (community healers) for therapy
  if (territory.technology < 30 && territory.happiness < 30) {
    return {
      success: false,
      message: "No healers available - need technology or happiness above 30",
    };
  }

  await ctx.db.patch(characterId, {
    mentalHealth: {
      ...mentalHealth,
      inTherapy: true,
    },
  });

  return {
    success: true,
    message: `${character.name} has begun treatment with a healer.`,
  };
}

/**
 * Establish healing sanctuary in territory
 */
export async function establishHealingSanctuary(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  tick: number
): Promise<{ success: boolean; message: string }> {
  const territory = await ctx.db.get(territoryId);
  if (!territory) {
    return { success: false, message: "Territory not found" };
  }

  // Cost: wealth and requires technology/happiness
  if (territory.wealth < 500) {
    return { success: false, message: "Not enough wealth (need 500)" };
  }

  if (territory.technology < 40 && territory.happiness < 40) {
    return {
      success: false,
      message: "Need technology or happiness above 40",
    };
  }

  // Deduct cost
  await ctx.db.patch(territoryId, {
    wealth: territory.wealth - 500,
  });

  // Put all characters in therapy
  const characters = await ctx.db
    .query("characters")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .filter((q) => q.eq(q.field("isAlive"), true))
    .collect();

  for (const character of characters) {
    if (character.mentalHealth && !character.mentalHealth.inTherapy) {
      await ctx.db.patch(character._id, {
        mentalHealth: {
          ...character.mentalHealth,
          inTherapy: true,
        },
      });
    }
  }

  // Record memory
  const agent = await ctx.db
    .query("agents")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .first();

  if (agent) {
    await ctx.db.insert("agentMemories", {
      agentId: agent._id,
      territoryId,
      memoryType: "victory",
      tick,
      description:
        "Established a healing sanctuary where the troubled may find peace.",
      emotionalWeight: 10,
      salience: 60,
      timesReferenced: 0,
    });
  }

  return {
    success: true,
    message: "A healing sanctuary has been established for those in need.",
  };
}

/**
 * Exile a mad character
 */
export async function exileMadCharacter(
  ctx: MutationCtx,
  characterId: Id<"characters">,
  tick: number
): Promise<{ success: boolean; message: string }> {
  const character = await ctx.db.get(characterId);
  if (!character) {
    return { success: false, message: "Character not found" };
  }

  if (!character.mentalHealth?.madness) {
    return { success: false, message: "Character is not mad" };
  }

  // Mark as exiled (effectively removes from territory)
  await ctx.db.patch(characterId, {
    isAlive: false, // For simplicity, exile = removal
    deathTick: tick,
    deathCause: "exile",
  });

  // Record memory
  const agent = await ctx.db
    .query("agents")
    .withIndex("by_territory", (q) => q.eq("territoryId", character.territoryId))
    .first();

  if (agent) {
    await ctx.db.insert("agentMemories", {
      agentId: agent._id,
      territoryId: character.territoryId,
      memoryType: "crisis",
      tick,
      description: `${character.name}, driven mad by ${character.mentalHealth.madness}, was exiled from the realm.`,
      emotionalWeight: -15,
      salience: 65,
      timesReferenced: 0,
    });
  }

  return {
    success: true,
    message: `${character.name} has been exiled due to their madness.`,
  };
}

/**
 * Get mental health summary for AI
 */
export async function getMentalHealthSummary(
  ctx: QueryCtx,
  territoryId: Id<"territories">
): Promise<string> {
  const characters = await ctx.db
    .query("characters")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .filter((q) => q.eq(q.field("isAlive"), true))
    .collect();

  let traumatized = 0;
  let depressed = 0;
  let ptsd = 0;
  let mad = 0;
  let inTherapy = 0;

  for (const character of characters) {
    if (!character.mentalHealth) continue;

    if (character.mentalHealth.trauma > 50) traumatized++;
    if (character.mentalHealth.depression > 50) depressed++;
    if (character.mentalHealth.ptsd) ptsd++;
    if (character.mentalHealth.madness) mad++;
    if (character.mentalHealth.inTherapy) inTherapy++;
  }

  const total = characters.length;

  if (traumatized === 0 && depressed === 0 && ptsd === 0 && mad === 0) {
    return "Mental health: Population appears mentally healthy.";
  }

  let summary = "Mental health concerns: ";
  const issues: string[] = [];

  if (traumatized > 0) issues.push(`${traumatized} traumatized`);
  if (depressed > 0) issues.push(`${depressed} depressed`);
  if (ptsd > 0) issues.push(`${ptsd} with PTSD`);
  if (mad > 0) issues.push(`${mad} suffering madness`);

  summary += issues.join(", ");

  if (inTherapy > 0) {
    summary += `. ${inTherapy} receiving treatment.`;
  }

  return summary;
}
