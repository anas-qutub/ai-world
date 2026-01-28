import { Doc, Id } from "../_generated/dataModel";
import { MutationCtx } from "../_generated/server";
import { recordMemory } from "./memory";

// =============================================
// RULER LEGITIMACY & POPULAR TRUST SYSTEM
// =============================================
// Tracks how legitimate a ruler's claim is and how much
// the people trust them personally (separate from happiness).

// Legitimacy starting values based on how ruler gained power
export const LEGITIMACY_BY_SOURCE: Record<string, { base: number; variance: number }> = {
  inheritance: { base: 85, variance: 10 },    // Rightful heir - very legitimate
  founding: { base: 90, variance: 5 },        // Founded civilization - highest
  divine_mandate: { base: 80, variance: 15 }, // Religious claim - high if believed
  election: { base: 70, variance: 10 },       // Chosen by people/council
  appointment: { base: 60, variance: 15 },    // External appointment - varies
  conquest: { base: 50, variance: 15 },       // Won through war
  coup: { base: 30, variance: 10 },           // Seized power violently
  rebellion: { base: 35, variance: 10 },      // Rose from rebellion
};

// Trust modifiers for various events
export const TRUST_MODIFIERS = {
  // Positive events
  war_won: 15,
  war_won_defensive: 20,        // Defending homeland is more impressive
  crisis_survived: 10,          // Famine, plague, etc.
  prosperity_increased: 5,      // Tier advancement
  promise_kept: 8,              // Alliance honored, treaty kept
  popular_decision: 5,          // Decisions that help people
  long_peace: 2,                // Per year of peace (max +20)
  corruption_punished: 10,      // Rooting out corrupt officials

  // Negative events
  war_lost: -20,
  war_lost_defensive: -25,      // Failing to defend is worse
  crisis_failed: -15,           // Many died in disaster
  prosperity_declined: -8,      // Tier dropped
  promise_broken: -15,          // Betrayal, broken alliance
  unpopular_decision: -8,       // Harsh taxes, conscription
  corruption_scandal: -12,      // Court corruption exposed
  massacre: -25,                // Killing own people
  tyranny: -10,                 // Cruel/oppressive actions
};

// Trust decay/recovery rates
const TRUST_NATURAL_RECOVERY = 0.5;  // Trust slowly recovers if nothing bad happens
const TRUST_DECAY_RATE = 0.3;        // Trust slowly decays if ruler does nothing notable
const LEGITIMACY_CONSOLIDATION = 0.5; // Legitimacy slowly increases over peaceful reign

/**
 * Initialize legitimacy and trust for a new ruler
 */
export async function initializeRulerLegitimacy(
  ctx: MutationCtx,
  characterId: Id<"characters">,
  legitimacySource: string,
  tick: number
): Promise<void> {
  const character = await ctx.db.get(characterId);
  if (!character || character.role !== "ruler") return;

  const sourceConfig = LEGITIMACY_BY_SOURCE[legitimacySource] || LEGITIMACY_BY_SOURCE.election;

  // Calculate starting legitimacy with variance
  const legitimacy = Math.max(0, Math.min(100,
    sourceConfig.base + (Math.random() * 2 - 1) * sourceConfig.variance
  ));

  // Starting trust is influenced by legitimacy and charisma
  const charismaBonus = (character.traits.charisma - 50) * 0.3;
  const startingTrust = Math.max(20, Math.min(80,
    50 + (legitimacy - 50) * 0.3 + charismaBonus
  ));

  await ctx.db.patch(characterId, {
    legitimacySource: legitimacySource as any,
    legitimacy: Math.round(legitimacy),
    popularTrust: Math.round(startingTrust),
    trustRecord: {
      promisesKept: 0,
      promisesBroken: 0,
      warsWon: 0,
      warsLost: 0,
      crisesSurvived: 0,
      crisesFailed: 0,
      corruptionScandals: 0,
      popularDecisions: 0,
      unpopularDecisions: 0,
    },
  });
}

/**
 * Modify ruler's popular trust based on an event
 */
export async function modifyRulerTrust(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  event: keyof typeof TRUST_MODIFIERS,
  customModifier?: number
): Promise<{ success: boolean; oldTrust?: number; newTrust?: number; ruler?: string }> {
  // Find the ruler
  const ruler = await ctx.db
    .query("characters")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .filter((q) =>
      q.and(
        q.eq(q.field("isAlive"), true),
        q.eq(q.field("role"), "ruler")
      )
    )
    .first();

  if (!ruler) {
    return { success: false };
  }

  const oldTrust = ruler.popularTrust || 50;
  const modifier = customModifier ?? TRUST_MODIFIERS[event];
  const newTrust = Math.max(0, Math.min(100, oldTrust + modifier));

  // Update trust record
  const trustRecord = ruler.trustRecord || {
    promisesKept: 0,
    promisesBroken: 0,
    warsWon: 0,
    warsLost: 0,
    crisesSurvived: 0,
    crisesFailed: 0,
    corruptionScandals: 0,
    popularDecisions: 0,
    unpopularDecisions: 0,
  };

  // Update specific record fields based on event
  if (event === "war_won" || event === "war_won_defensive") {
    trustRecord.warsWon++;
  } else if (event === "war_lost" || event === "war_lost_defensive") {
    trustRecord.warsLost++;
  } else if (event === "crisis_survived") {
    trustRecord.crisesSurvived++;
  } else if (event === "crisis_failed") {
    trustRecord.crisesFailed++;
  } else if (event === "promise_kept") {
    trustRecord.promisesKept++;
  } else if (event === "promise_broken") {
    trustRecord.promisesBroken++;
  } else if (event === "corruption_scandal") {
    trustRecord.corruptionScandals++;
  } else if (event === "popular_decision") {
    trustRecord.popularDecisions++;
  } else if (event === "unpopular_decision") {
    trustRecord.unpopularDecisions++;
  }

  await ctx.db.patch(ruler._id, {
    popularTrust: Math.round(newTrust),
    trustRecord,
  });

  // Record memory if significant change
  if (Math.abs(modifier) >= 10) {
    const agent = await ctx.db
      .query("agents")
      .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
      .first();

    if (agent) {
      const description = modifier > 0
        ? `The people's trust in ${ruler.title} ${ruler.name} has grown. (${event.replace(/_/g, " ")})`
        : `The people's trust in ${ruler.title} ${ruler.name} has fallen. (${event.replace(/_/g, " ")})`;

      await recordMemory(ctx, agent._id, {
        type: modifier > 0 ? "victory" : "crisis",
        description,
        emotionalWeight: modifier,
      });
    }
  }

  return {
    success: true,
    oldTrust,
    newTrust: Math.round(newTrust),
    ruler: `${ruler.title} ${ruler.name}`,
  };
}

/**
 * Process legitimacy and trust changes each tick
 */
export async function processRulerLegitimacy(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  tick: number
): Promise<void> {
  const ruler = await ctx.db
    .query("characters")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .filter((q) =>
      q.and(
        q.eq(q.field("isAlive"), true),
        q.eq(q.field("role"), "ruler")
      )
    )
    .first();

  if (!ruler) return;

  const territory = await ctx.db.get(territoryId);
  if (!territory) return;

  let legitimacy = ruler.legitimacy ?? 50;
  let trust = ruler.popularTrust ?? 50;

  // =============================================
  // LEGITIMACY CONSOLIDATION
  // =============================================
  // Legitimacy slowly increases during peaceful reign (max 90 for non-inheritance)
  const maxLegitimacy = ruler.legitimacySource === "inheritance" ? 100 :
                        ruler.legitimacySource === "founding" ? 100 :
                        ruler.legitimacySource === "divine_mandate" ? 95 :
                        ruler.legitimacySource === "election" ? 90 : 80;

  // Check if at peace
  const relationships = await ctx.db.query("relationships").collect();
  const atWar = relationships.some(
    (r) =>
      (r.territory1Id === territoryId || r.territory2Id === territoryId) &&
      r.status === "at_war"
  );

  if (!atWar && legitimacy < maxLegitimacy) {
    legitimacy = Math.min(maxLegitimacy, legitimacy + LEGITIMACY_CONSOLIDATION);
  }

  // =============================================
  // TRUST BASED ON CURRENT CONDITIONS
  // =============================================

  // Trust affected by territory happiness
  const happinessEffect = (territory.happiness - 50) * 0.02;

  // Trust affected by prosperity
  const foodPerCapita = territory.food / Math.max(1, territory.population);
  const prosperityEffect = foodPerCapita > 1.5 ? 0.5 : foodPerCapita < 0.5 ? -1 : 0;

  // War exhaustion damages trust
  let warExhaustionEffect = 0;
  for (const rel of relationships) {
    if ((rel.territory1Id === territoryId || rel.territory2Id === territoryId) &&
        rel.status === "at_war" && rel.warExhaustion) {
      warExhaustionEffect -= rel.warExhaustion * 0.01;
    }
  }

  // Natural trust recovery/decay
  const trustChange = happinessEffect + prosperityEffect + warExhaustionEffect;
  trust = Math.max(0, Math.min(100, trust + trustChange));

  // Save updates
  await ctx.db.patch(ruler._id, {
    legitimacy: Math.round(legitimacy * 10) / 10,
    popularTrust: Math.round(trust * 10) / 10,
  });
}

/**
 * Calculate rebellion modifier based on ruler's legitimacy and trust
 * Lower legitimacy and trust = higher rebellion risk
 */
export function calculateRulerRebellionModifier(
  legitimacy: number,
  trust: number
): number {
  // Both legitimacy and trust contribute to stability
  // Low values increase rebellion risk

  const legitimacyFactor = (50 - legitimacy) / 50; // -1 to +1
  const trustFactor = (50 - trust) / 50; // -1 to +1

  // Combined effect (trust matters more for rebellions)
  const modifier = (legitimacyFactor * 0.4 + trustFactor * 0.6) * 30;

  return Math.max(-20, Math.min(40, modifier)); // Cap at -20 to +40
}

/**
 * Calculate coup success modifier based on ruler's legitimacy and trust
 * Lower values make coups more likely to succeed
 */
export function calculateCoupSuccessModifier(
  legitimacy: number,
  trust: number
): number {
  // Low trust means people won't defend the ruler
  // Low legitimacy means the coup seems more justified

  const legitimacyFactor = (100 - legitimacy) / 100; // 0 to 1
  const trustFactor = (100 - trust) / 100; // 0 to 1

  // Combined effect
  return (legitimacyFactor * 0.3 + trustFactor * 0.7) * 40; // 0 to 40 bonus
}

/**
 * Get ruler status summary for AI prompts
 */
export function getRulerStatusSummary(
  ruler: Doc<"characters">
): {
  legitimacyStatus: string;
  trustStatus: string;
  warnings: string[];
} {
  const legitimacy = ruler.legitimacy ?? 50;
  const trust = ruler.popularTrust ?? 50;
  const warnings: string[] = [];

  // Legitimacy status
  let legitimacyStatus: string;
  if (legitimacy >= 80) {
    legitimacyStatus = "Unquestioned authority";
  } else if (legitimacy >= 60) {
    legitimacyStatus = "Accepted ruler";
  } else if (legitimacy >= 40) {
    legitimacyStatus = "Disputed claim";
    warnings.push("Legitimacy questioned - vulnerable to challenges");
  } else if (legitimacy >= 20) {
    legitimacyStatus = "Widely contested";
    warnings.push("LOW LEGITIMACY - High risk of coup or rebellion");
  } else {
    legitimacyStatus = "Illegitimate usurper";
    warnings.push("CRITICAL: Seen as illegitimate - rebellion imminent");
  }

  // Trust status
  let trustStatus: string;
  if (trust >= 80) {
    trustStatus = "Beloved by the people";
  } else if (trust >= 60) {
    trustStatus = "Trusted leader";
  } else if (trust >= 40) {
    trustStatus = "Mixed reputation";
    warnings.push("Trust eroding - improve conditions or face unrest");
  } else if (trust >= 20) {
    trustStatus = "Distrusted";
    warnings.push("LOW TRUST - People may support rebels");
  } else {
    trustStatus = "Hated tyrant";
    warnings.push("CRITICAL: Deeply hated - overthrow likely");
  }

  return { legitimacyStatus, trustStatus, warnings };
}

/**
 * Format ruler legitimacy info for AI prompts
 */
export function formatRulerLegitimacyForPrompt(
  ruler: Doc<"characters">
): string {
  const legitimacy = ruler.legitimacy ?? 50;
  const trust = ruler.popularTrust ?? 50;
  const source = ruler.legitimacySource || "unknown";
  const record = ruler.trustRecord;

  const { legitimacyStatus, trustStatus, warnings } = getRulerStatusSummary(ruler);

  let output = `## RULER'S STANDING WITH THE PEOPLE\n\n`;
  output += `**${ruler.title} ${ruler.name}**\n`;
  output += `- Claim to Power: ${source.replace(/_/g, " ")}\n`;
  output += `- Legitimacy: ${legitimacy.toFixed(0)}% (${legitimacyStatus})\n`;
  output += `- Popular Trust: ${trust.toFixed(0)}% (${trustStatus})\n`;

  if (record) {
    output += `\n**Track Record:**\n`;
    if (record.warsWon > 0 || record.warsLost > 0) {
      output += `- Wars: ${record.warsWon} won, ${record.warsLost} lost\n`;
    }
    if (record.crisesSurvived > 0 || record.crisesFailed > 0) {
      output += `- Crises: ${record.crisesSurvived} survived, ${record.crisesFailed} mishandled\n`;
    }
    if (record.promisesKept > 0 || record.promisesBroken > 0) {
      output += `- Promises: ${record.promisesKept} kept, ${record.promisesBroken} broken\n`;
    }
    if (record.corruptionScandals > 0) {
      output += `- Corruption scandals: ${record.corruptionScandals}\n`;
    }
  }

  if (warnings.length > 0) {
    output += `\n**⚠️ WARNINGS:**\n`;
    for (const warning of warnings) {
      output += `- ${warning}\n`;
    }
  }

  return output;
}
