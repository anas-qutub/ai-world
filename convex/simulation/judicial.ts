import { MutationCtx, QueryCtx } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";
import { recordMemory } from "./memory";

// =============================================
// JUDICIAL SYSTEM
// =============================================
// Laws, courts, trials, and punishments that maintain order in society.

// Crime severity and default punishments
export const CRIME_DEFINITIONS = {
  theft: {
    description: "Taking property that belongs to another",
    baseSeverity: 3,
    defaultPunishment: "fine",
    fineMultiplier: 2, // 2x value stolen
    imprisonmentTicks: 6,
  },
  assault: {
    description: "Physical attack on another person",
    baseSeverity: 4,
    defaultPunishment: "imprisonment",
    fineMultiplier: 0,
    imprisonmentTicks: 12,
  },
  murder: {
    description: "Unlawful killing of another person",
    baseSeverity: 10,
    defaultPunishment: "execution",
    fineMultiplier: 0,
    imprisonmentTicks: 120, // Life
  },
  treason: {
    description: "Betrayal of one's territory or ruler",
    baseSeverity: 10,
    defaultPunishment: "execution",
    fineMultiplier: 0,
    imprisonmentTicks: 120,
  },
  heresy: {
    description: "Speaking against the state religion",
    baseSeverity: 5,
    defaultPunishment: "exile",
    fineMultiplier: 0,
    imprisonmentTicks: 24,
  },
  desertion: {
    description: "Abandoning military duty",
    baseSeverity: 6,
    defaultPunishment: "imprisonment",
    fineMultiplier: 0,
    imprisonmentTicks: 36,
  },
  adultery: {
    description: "Unfaithfulness in marriage",
    baseSeverity: 2,
    defaultPunishment: "fine",
    fineMultiplier: 0,
    imprisonmentTicks: 3,
  },
  fraud: {
    description: "Deception for personal gain",
    baseSeverity: 4,
    defaultPunishment: "imprisonment",
    fineMultiplier: 3,
    imprisonmentTicks: 18,
  },
  smuggling: {
    description: "Illegal import/export of goods",
    baseSeverity: 3,
    defaultPunishment: "fine",
    fineMultiplier: 5,
    imprisonmentTicks: 12,
  },
  bribery: {
    description: "Offering payment for illegal favors",
    baseSeverity: 5,
    defaultPunishment: "imprisonment",
    fineMultiplier: 3,
    imprisonmentTicks: 24,
  },
  tax_evasion: {
    description: "Failing to pay required taxes",
    baseSeverity: 4,
    defaultPunishment: "fine",
    fineMultiplier: 4,
    imprisonmentTicks: 12,
  },
  vandalism: {
    description: "Willful destruction of property",
    baseSeverity: 2,
    defaultPunishment: "fine",
    fineMultiplier: 3,
    imprisonmentTicks: 3,
  },
  arson: {
    description: "Deliberately setting fire to property",
    baseSeverity: 7,
    defaultPunishment: "imprisonment",
    fineMultiplier: 0,
    imprisonmentTicks: 48,
  },
  kidnapping: {
    description: "Unlawfully taking and holding a person",
    baseSeverity: 8,
    defaultPunishment: "imprisonment",
    fineMultiplier: 0,
    imprisonmentTicks: 60,
  },
  sedition: {
    description: "Inciting rebellion against authority",
    baseSeverity: 9,
    defaultPunishment: "execution",
    fineMultiplier: 0,
    imprisonmentTicks: 120,
  },
};

// Law code severity modifiers
export const SEVERITY_MODIFIERS = {
  lenient: {
    punishmentMultiplier: 0.5,
    fineMultiplier: 0.5,
    imprisonmentMultiplier: 0.5,
    executionThreshold: 10, // Only for severity 10+ crimes
    happinessBonus: 5,
    crimeRate: 1.3, // 30% more crime
  },
  moderate: {
    punishmentMultiplier: 1.0,
    fineMultiplier: 1.0,
    imprisonmentMultiplier: 1.0,
    executionThreshold: 9,
    happinessBonus: 0,
    crimeRate: 1.0,
  },
  harsh: {
    punishmentMultiplier: 1.5,
    fineMultiplier: 1.5,
    imprisonmentMultiplier: 1.5,
    executionThreshold: 7,
    happinessBonus: -5,
    crimeRate: 0.7,
  },
  draconian: {
    punishmentMultiplier: 2.0,
    fineMultiplier: 2.0,
    imprisonmentMultiplier: 2.0,
    executionThreshold: 5,
    happinessBonus: -15,
    crimeRate: 0.5,
  },
};

/**
 * Establish a law code for a territory
 */
export async function establishLawCode(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  name: string,
  severity: keyof typeof SEVERITY_MODIFIERS,
  enactedByRulerId: Id<"characters">,
  tick: number,
  rights?: {
    rightToTrial?: boolean;
    rightToAppeal?: boolean;
    rightToDefense?: boolean;
    presumptionOfInnocence?: boolean;
    noblePrivilege?: boolean;
  }
): Promise<{ success: boolean; lawCodeId?: Id<"lawCodes">; message: string }> {
  const territory = await ctx.db.get(territoryId);
  const ruler = await ctx.db.get(enactedByRulerId);

  if (!territory) {
    return { success: false, message: "Territory not found" };
  }
  if (!ruler || !ruler.isAlive) {
    return { success: false, message: "Ruler not found or deceased" };
  }

  // Build laws from crime definitions
  const laws = Object.entries(CRIME_DEFINITIONS).map(([crimeType, def]) => ({
    crimeType,
    description: def.description,
    basePunishment: def.defaultPunishment,
    punishmentSeverity: def.baseSeverity,
    finAmount: def.fineMultiplier > 0 ? def.fineMultiplier * 10 : undefined,
    imprisonmentTicks: def.imprisonmentTicks,
  }));

  const lawCodeId = await ctx.db.insert("lawCodes", {
    territoryId,
    name,
    enactedTick: tick,
    enactedByRulerId,
    severity,
    laws,
    citizenRights: {
      rightToTrial: rights?.rightToTrial ?? true,
      rightToAppeal: rights?.rightToAppeal ?? false,
      rightToDefense: rights?.rightToDefense ?? true,
      presumptionOfInnocence: rights?.presumptionOfInnocence ?? false,
      noblePrivilege: rights?.noblePrivilege ?? true,
    },
    enforcementStrength: 50,
    corruptionLevel: 30,
  });

  // Record memory
  const agent = await ctx.db
    .query("agents")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .first();

  if (agent) {
    await recordMemory(ctx, agent._id, {
      type: "victory",
      description: `${name} was established, bringing ${severity} justice to our lands.`,
      emotionalWeight: 30,
    });
  }

  return {
    success: true,
    lawCodeId,
    message: `${name} has been established with ${severity} justice`,
  };
}

/**
 * Report a crime
 */
export async function reportCrime(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  accusedId: Id<"characters">,
  crimeType: keyof typeof CRIME_DEFINITIONS,
  description: string,
  tick: number,
  victimId?: Id<"characters">,
  witnesses?: Id<"characters">[]
): Promise<{ success: boolean; crimeId?: Id<"crimes">; message: string }> {
  const accused = await ctx.db.get(accusedId);
  if (!accused || !accused.isAlive) {
    return { success: false, message: "Accused not found or deceased" };
  }

  // Calculate evidence strength based on witnesses
  const evidenceStrength = Math.min(100, 30 + (witnesses?.length || 0) * 20);

  const crimeId = await ctx.db.insert("crimes", {
    territoryId,
    accusedId,
    victimId,
    crimeType,
    description,
    tick,
    witnesses: witnesses || [],
    evidenceStrength,
    status: "reported",
    trialId: undefined,
    verdict: undefined,
    sentence: undefined,
  });

  return {
    success: true,
    crimeId,
    message: `${accused.name} has been accused of ${crimeType}`,
  };
}

/**
 * Begin a trial
 */
export async function beginTrial(
  ctx: MutationCtx,
  crimeId: Id<"crimes">,
  judgeId: Id<"characters">,
  tick: number,
  prosecutorId?: Id<"characters">,
  defenseId?: Id<"characters">
): Promise<{ success: boolean; trialId?: Id<"trials">; message: string }> {
  const crime = await ctx.db.get(crimeId);
  const judge = await ctx.db.get(judgeId);

  if (!crime) {
    return { success: false, message: "Crime not found" };
  }
  if (!judge || !judge.isAlive) {
    return { success: false, message: "Judge not found or deceased" };
  }

  // Check judge qualifications
  const lawSkill = judge.skills?.law || 0;
  if (lawSkill < 30 && judge.role !== "ruler") {
    return { success: false, message: "Judge needs law skill (30+) or be ruler" };
  }

  const trialId = await ctx.db.insert("trials", {
    territoryId: crime.territoryId,
    crimeId,
    accusedId: crime.accusedId,
    judgeId,
    prosecutorId,
    defenseId,
    startTick: tick,
    endTick: undefined,
    status: "scheduled",
    proceedings: [],
    verdict: undefined,
    sentence: undefined,
    trialFairness: 50 + (judge.traits.justice || 50) / 5,
    publicOpinion: 0,
  });

  await ctx.db.patch(crimeId, {
    status: "awaiting_trial",
    trialId,
  });

  const accused = await ctx.db.get(crime.accusedId);

  return {
    success: true,
    trialId,
    message: `Trial for ${accused?.name || "unknown"} has been scheduled`,
  };
}

/**
 * Process a trial proceeding
 */
export async function processTrialProceeding(
  ctx: MutationCtx,
  trialId: Id<"trials">,
  event: string,
  description: string,
  impactOnVerdict: number,
  tick: number
): Promise<{ success: boolean; message: string }> {
  const trial = await ctx.db.get(trialId);
  if (!trial) {
    return { success: false, message: "Trial not found" };
  }

  if (trial.status === "verdict_reached" || trial.status === "closed") {
    return { success: false, message: "Trial already concluded" };
  }

  const newProceedings = [
    ...trial.proceedings,
    { tick, event, description, impactOnVerdict },
  ];

  await ctx.db.patch(trialId, {
    proceedings: newProceedings,
    status: "in_progress",
  });

  return {
    success: true,
    message: `Proceeding recorded: ${event}`,
  };
}

/**
 * Render a verdict
 */
export async function renderVerdict(
  ctx: MutationCtx,
  trialId: Id<"trials">,
  tick: number
): Promise<{ success: boolean; verdict: string; sentence?: string; message: string }> {
  const trial = await ctx.db.get(trialId);
  if (!trial) {
    return { success: false, verdict: "", message: "Trial not found" };
  }

  const crime = await ctx.db.get(trial.crimeId);
  if (!crime) {
    return { success: false, verdict: "", message: "Crime record not found" };
  }

  const accused = await ctx.db.get(trial.accusedId);
  const judge = await ctx.db.get(trial.judgeId);
  const lawCode = await ctx.db
    .query("lawCodes")
    .withIndex("by_territory", (q) => q.eq("territoryId", trial.territoryId))
    .first();

  // Calculate verdict based on evidence, proceedings, and fairness
  let verdictScore = crime.evidenceStrength;

  // Add proceeding impacts
  for (const proc of trial.proceedings) {
    verdictScore += proc.impactOnVerdict;
  }

  // Judge bias
  if (judge) {
    const justiceTrait = judge.traits.justice || 50;
    if (justiceTrait < 30) {
      // Unjust judge may be swayed by other factors
      verdictScore += (Math.random() - 0.5) * 30;
    }
  }

  // Corruption effect
  if (lawCode && lawCode.corruptionLevel > 50) {
    // Corrupt system - wealthy accused may get off
    verdictScore -= lawCode.corruptionLevel / 5;
  }

  // Noble privilege
  if (lawCode?.citizenRights.noblePrivilege && accused?.role === "noble") {
    verdictScore -= 20;
  }

  // Determine verdict
  const verdict = verdictScore >= 50 ? "guilty" : "innocent";

  let sentence: string | undefined;
  if (verdict === "guilty" && lawCode) {
    const crimeConfig = CRIME_DEFINITIONS[crime.crimeType as keyof typeof CRIME_DEFINITIONS];
    const severityMod = SEVERITY_MODIFIERS[lawCode.severity];

    if (crimeConfig.baseSeverity >= severityMod.executionThreshold) {
      sentence = "execution";
    } else if (crimeConfig.defaultPunishment === "imprisonment") {
      const ticks = Math.round(crimeConfig.imprisonmentTicks * severityMod.imprisonmentMultiplier);
      sentence = `imprisonment for ${Math.round(ticks / 12)} years`;
    } else if (crimeConfig.defaultPunishment === "exile") {
      sentence = "exile";
    } else {
      const fine = Math.round((crimeConfig.fineMultiplier || 1) * 10 * severityMod.fineMultiplier);
      sentence = `fine of ${fine} wealth`;
    }
  }

  // Update trial
  await ctx.db.patch(trialId, {
    status: "verdict_reached",
    endTick: tick,
    verdict,
    sentence,
    publicOpinion: verdict === "guilty" && crime.evidenceStrength > 70 ? 30 :
                   verdict === "innocent" && crime.evidenceStrength > 70 ? -30 : 0,
  });

  // Update crime
  await ctx.db.patch(crime._id, {
    status: verdict === "guilty" ? "convicted" : "acquitted",
    verdict,
    sentence,
  });

  // Apply sentence
  if (verdict === "guilty" && accused && sentence) {
    await applySentence(ctx, accused._id, sentence, tick);

    // Record criminal record
    const record = accused.criminalRecord || [];
    record.push({
      crime: crime.crimeType,
      tick,
      verdict: "guilty",
      punishment: sentence,
    });
    await ctx.db.patch(accused._id, { criminalRecord: record });
  }

  return {
    success: true,
    verdict,
    sentence,
    message: `${accused?.name || "The accused"} found ${verdict}${sentence ? `. Sentence: ${sentence}` : ""}`,
  };
}

/**
 * Apply a sentence to a character
 */
async function applySentence(
  ctx: MutationCtx,
  characterId: Id<"characters">,
  sentence: string,
  tick: number
): Promise<void> {
  const character = await ctx.db.get(characterId);
  if (!character) return;

  if (sentence === "execution") {
    await ctx.db.patch(characterId, {
      isAlive: false,
      deathTick: tick,
      deathCause: "executed by order of the court",
    });
  } else if (sentence === "exile") {
    await ctx.db.patch(characterId, {
      isExiled: true,
      exileTick: tick,
      exileReason: "judicial exile",
    });
  } else if (sentence.includes("imprisonment")) {
    // Parse years from sentence
    const match = sentence.match(/(\d+) years?/);
    const years = match ? parseInt(match[1]) : 1;

    await ctx.db.patch(characterId, {
      isImprisoned: true,
      prisonStartTick: tick,
      prisonSentenceTicks: years * 12,
    });
  }
  // Fines are handled by wealth deduction elsewhere
}

/**
 * Process imprisoned characters
 */
export async function processImprisoned(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  tick: number
): Promise<Array<{ type: string; description: string }>> {
  const events: Array<{ type: string; description: string }> = [];

  const imprisoned = await ctx.db
    .query("characters")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .filter((q) =>
      q.and(
        q.eq(q.field("isAlive"), true),
        q.eq(q.field("isImprisoned"), true)
      )
    )
    .collect();

  // Get prison conditions
  const prison = await ctx.db
    .query("prisons")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .first();

  for (const prisoner of imprisoned) {
    const startTick = prisoner.prisonStartTick || tick;
    const sentenceTicks = prisoner.prisonSentenceTicks || 12;
    const ticksServed = tick - startTick;

    // Check for release
    if (ticksServed >= sentenceTicks) {
      await ctx.db.patch(prisoner._id, {
        isImprisoned: false,
        prisonStartTick: undefined,
        prisonSentenceTicks: undefined,
      });

      events.push({
        type: "release",
        description: `${prisoner.name} has been released from prison after serving their sentence.`,
      });
      continue;
    }

    // Prison conditions affect survival
    if (prison) {
      let deathChance = 0;

      switch (prison.conditions) {
        case "dungeon":
          deathChance = 0.02; // 2% per tick
          break;
        case "harsh":
          deathChance = 0.005;
          break;
        case "standard":
          deathChance = 0.001;
          break;
        case "humane":
          deathChance = 0.0001;
          break;
      }

      // Age increases death chance
      if (prisoner.age > 50) {
        deathChance *= 1.5;
      }

      if (Math.random() < deathChance) {
        await ctx.db.patch(prisoner._id, {
          isAlive: false,
          deathTick: tick,
          deathCause: "died in prison",
        });

        events.push({
          type: "death",
          description: `${prisoner.name} died in prison under ${prison.conditions} conditions.`,
        });
      }
    }

    // Escape attempts (rare)
    if (prison && Math.random() < prison.escapeRisk / 1000) {
      await ctx.db.patch(prisoner._id, {
        isImprisoned: false,
        prisonStartTick: undefined,
        prisonSentenceTicks: undefined,
      });

      events.push({
        type: "escape",
        description: `${prisoner.name} has escaped from prison!`,
      });
    }
  }

  return events;
}

/**
 * Pardon a criminal
 */
export async function pardonCriminal(
  ctx: MutationCtx,
  crimeId: Id<"crimes">,
  pardonedBy: Id<"characters">
): Promise<{ success: boolean; message: string }> {
  const crime = await ctx.db.get(crimeId);
  const pardoner = await ctx.db.get(pardonedBy);

  if (!crime) {
    return { success: false, message: "Crime not found" };
  }
  if (!pardoner || !pardoner.isAlive) {
    return { success: false, message: "Pardoner not found or deceased" };
  }

  // Only rulers can pardon
  if (pardoner.role !== "ruler") {
    return { success: false, message: "Only rulers can issue pardons" };
  }

  const accused = await ctx.db.get(crime.accusedId);

  await ctx.db.patch(crime._id, {
    status: "pardoned",
    verdict: "pardoned",
  });

  // Release from prison if imprisoned
  if (accused?.isImprisoned) {
    await ctx.db.patch(accused._id, {
      isImprisoned: false,
      prisonStartTick: undefined,
      prisonSentenceTicks: undefined,
    });
  }

  // End exile if exiled
  if (accused?.isExiled) {
    await ctx.db.patch(accused._id, {
      isExiled: false,
      exileTick: undefined,
      exileReason: undefined,
    });
  }

  return {
    success: true,
    message: `${accused?.name || "The criminal"} has been pardoned by ${pardoner.name}`,
  };
}

/**
 * Build a prison
 */
export async function buildPrison(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  name: string,
  conditions: "humane" | "standard" | "harsh" | "dungeon",
  capacity: number
): Promise<{ success: boolean; prisonId?: Id<"prisons">; message: string }> {
  const territory = await ctx.db.get(territoryId);
  if (!territory) {
    return { success: false, message: "Territory not found" };
  }

  const cost = conditions === "humane" ? 100 :
               conditions === "standard" ? 60 :
               conditions === "harsh" ? 40 : 20;

  if (territory.wealth < cost) {
    return { success: false, message: `Not enough wealth (need ${cost})` };
  }

  const escapeRisk = conditions === "humane" ? 30 :
                     conditions === "standard" ? 20 :
                     conditions === "harsh" ? 10 : 5;

  const rehabilitationRate = conditions === "humane" ? 60 :
                             conditions === "standard" ? 30 :
                             conditions === "harsh" ? 10 : 0;

  const deathRate = conditions === "humane" ? 1 :
                    conditions === "standard" ? 5 :
                    conditions === "harsh" ? 15 : 30;

  const prisonId = await ctx.db.insert("prisons", {
    name,
    territoryId,
    capacity,
    currentInmates: 0,
    conditions,
    guardCount: Math.ceil(capacity / 10),
    escapeRisk,
    rehabilitationRate,
    deathRate,
    wardenId: undefined,
  });

  await ctx.db.patch(territoryId, {
    wealth: territory.wealth - cost,
  });

  return {
    success: true,
    prisonId,
    message: `${name} has been built with ${conditions} conditions`,
  };
}

/**
 * Get justice statistics for a territory
 */
export async function getJusticeStats(
  ctx: QueryCtx,
  territoryId: Id<"territories">
): Promise<{
  hasLawCode: boolean;
  lawCodeName?: string;
  severity?: string;
  activeCrimes: number;
  pendingTrials: number;
  imprisoned: number;
  executionsThisYear: number;
}> {
  const lawCode = await ctx.db
    .query("lawCodes")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .first();

  const crimes = await ctx.db
    .query("crimes")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .filter((q) =>
      q.or(
        q.eq(q.field("status"), "reported"),
        q.eq(q.field("status"), "investigating"),
        q.eq(q.field("status"), "awaiting_trial"),
        q.eq(q.field("status"), "on_trial")
      )
    )
    .collect();

  const trials = await ctx.db
    .query("trials")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .filter((q) =>
      q.or(
        q.eq(q.field("status"), "scheduled"),
        q.eq(q.field("status"), "in_progress"),
        q.eq(q.field("status"), "deliberation")
      )
    )
    .collect();

  const imprisoned = await ctx.db
    .query("characters")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .filter((q) =>
      q.and(
        q.eq(q.field("isAlive"), true),
        q.eq(q.field("isImprisoned"), true)
      )
    )
    .collect();

  // Count recent executions (would need to track this properly)
  const executionsThisYear = 0; // Placeholder

  return {
    hasLawCode: !!lawCode,
    lawCodeName: lawCode?.name,
    severity: lawCode?.severity,
    activeCrimes: crimes.length,
    pendingTrials: trials.length,
    imprisoned: imprisoned.length,
    executionsThisYear,
  };
}
