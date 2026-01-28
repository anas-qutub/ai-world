/**
 * Marriage System
 *
 * Manages marriages including political alliances, love marriages,
 * divorce, widowhood, and marital dynamics.
 */

import { MutationCtx, QueryCtx } from "../_generated/server";
import { Id, Doc } from "../_generated/dataModel";
import { endRomance } from "./romance";

// Marriage types
export type MarriageType = "political" | "love" | "arranged" | "forced";

export type MarriageStatus = "active" | "widowed" | "divorced" | "annulled";

/**
 * Find any active romance between two characters
 */
async function findRomance(
  ctx: QueryCtx,
  char1Id: Id<"characters">,
  char2Id: Id<"characters">
): Promise<Doc<"romances"> | null> {
  const romance1 = await ctx.db
    .query("romances")
    .withIndex("by_lover1", (q) => q.eq("lover1Id", char1Id))
    .filter((q) => q.and(
      q.eq(q.field("lover2Id"), char2Id),
      q.eq(q.field("status"), "active")
    ))
    .first();

  if (romance1) return romance1;

  const romance2 = await ctx.db
    .query("romances")
    .withIndex("by_lover1", (q) => q.eq("lover1Id", char2Id))
    .filter((q) => q.and(
      q.eq(q.field("lover2Id"), char1Id),
      q.eq(q.field("status"), "active")
    ))
    .first();

  return romance2;
}

/**
 * Arrange a political marriage
 */
export async function arrangePoliticalMarriage(
  ctx: MutationCtx,
  spouse1Id: Id<"characters">,
  spouse2Id: Id<"characters">,
  tick: number,
  allianceTerritoryId?: Id<"territories">,
  dowry?: number
): Promise<{ success: boolean; marriageId?: Id<"marriages">; message: string }> {
  const spouse1 = await ctx.db.get(spouse1Id);
  const spouse2 = await ctx.db.get(spouse2Id);

  if (!spouse1 || !spouse2) {
    return { success: false, message: "Character not found" };
  }

  if (!spouse1.isAlive || !spouse2.isAlive) {
    return { success: false, message: "Cannot marry deceased characters" };
  }

  if (spouse1.isMarried || spouse2.isMarried) {
    return { success: false, message: "One or both parties are already married" };
  }

  // Check gender compatibility (optional, depends on culture)
  // For simplicity, allowing any combination

  // Deduct dowry if specified
  if (dowry && dowry > 0) {
    const territory = await ctx.db.get(spouse1.territoryId);
    if (!territory || territory.wealth < dowry) {
      return { success: false, message: "Not enough wealth for dowry" };
    }
    await ctx.db.patch(spouse1.territoryId, {
      wealth: territory.wealth - dowry,
    });

    // Add dowry to receiving territory if different
    if (spouse2.territoryId !== spouse1.territoryId) {
      const receivingTerritory = await ctx.db.get(spouse2.territoryId);
      if (receivingTerritory) {
        await ctx.db.patch(spouse2.territoryId, {
          wealth: receivingTerritory.wealth + dowry,
        });
      }
    }
  }

  // RELIGION INFLUENCE: Even political marriages are influenced by faith
  let maritalHappiness = 50; // Neutral start for political marriages

  // Check if spouses share the same faith
  if (spouse1.faith && spouse2.faith) {
    if (spouse1.faith === spouse2.faith) {
      // Same faith = smoother political marriage
      maritalHappiness = Math.min(100, maritalHappiness + 10);
    } else {
      // Interfaith political marriage - more tension
      maritalHappiness = Math.max(20, maritalHappiness - 15);
    }
  }

  // Religious blessing from territory's state religion
  const territory = await ctx.db.get(spouse1.territoryId);
  if (territory) {
    const stateReligion = await ctx.db
      .query("religions")
      .filter((q: any) => q.eq(q.field("isStateReligion"), spouse1.territoryId))
      .first();

    if (stateReligion) {
      maritalHappiness = Math.min(100, maritalHappiness + 5);
    }
  }

  // Create marriage
  const marriageId = await ctx.db.insert("marriages", {
    territoryId: spouse1.territoryId,
    spouse1Id,
    spouse2Id,
    marriageType: "political",
    marriageTick: tick,
    status: "active",
    allianceTerritoryId,
    dowryPaid: dowry,
    childrenIds: [],
    maritalHappiness,
  });

  // Update character records
  await ctx.db.patch(spouse1Id, {
    spouseId: spouse2Id,
    marriageId,
    isMarried: true,
  });
  await ctx.db.patch(spouse2Id, {
    spouseId: spouse1Id,
    marriageId,
    isMarried: true,
  });

  // End any active romance between them
  const romance = await findRomance(ctx, spouse1Id, spouse2Id);
  if (romance) {
    await endRomance(ctx, romance._id, "marriage", tick);
  }

  // Create alliance if specified
  if (allianceTerritoryId && allianceTerritoryId !== spouse1.territoryId) {
    await createMarriageAlliance(ctx, spouse1.territoryId, allianceTerritoryId);
  }

  return {
    success: true,
    marriageId,
    message: `Political marriage arranged between ${spouse1.name} and ${spouse2.name}.`,
  };
}

/**
 * Love marriage (from romance)
 */
export async function loveMarriage(
  ctx: MutationCtx,
  spouse1Id: Id<"characters">,
  spouse2Id: Id<"characters">,
  tick: number
): Promise<{ success: boolean; marriageId?: Id<"marriages">; message: string }> {
  const spouse1 = await ctx.db.get(spouse1Id);
  const spouse2 = await ctx.db.get(spouse2Id);

  if (!spouse1 || !spouse2) {
    return { success: false, message: "Character not found" };
  }

  if (!spouse1.isAlive || !spouse2.isAlive) {
    return { success: false, message: "Cannot marry deceased characters" };
  }

  if (spouse1.isMarried || spouse2.isMarried) {
    return { success: false, message: "One or both parties are already married" };
  }

  // Check for existing romance
  const romance = await findRomance(ctx, spouse1Id, spouse2Id);
  let maritalHappiness = 50;

  if (romance) {
    // Higher happiness based on romance passion/intimacy
    maritalHappiness = Math.floor((romance.passion + romance.intimacy) / 2);
  }

  // RELIGION INFLUENCE: Shared faith strengthens marriages
  // Most marriages in history were religious ceremonies - this reflects that
  const territory = await ctx.db.get(spouse1.territoryId);
  let religiousBlessing = false;
  let faithCompatibility: "same" | "different" | "none" = "none";

  // Check if spouses share the same faith
  if (spouse1.faith && spouse2.faith) {
    if (spouse1.faith === spouse2.faith) {
      faithCompatibility = "same";
      // Same faith = stronger bond, blessed by their god
      maritalHappiness = Math.min(100, maritalHappiness + 15);
    } else {
      faithCompatibility = "different";
      // Interfaith marriage - potential for conflict
      maritalHappiness = Math.max(10, maritalHappiness - 10);
    }
  }

  // Religious ceremony blessing from territory's state religion
  if (territory) {
    const stateReligion = await ctx.db
      .query("religions")
      .filter((q: any) => q.eq(q.field("isStateReligion"), spouse1.territoryId))
      .first();

    if (stateReligion) {
      religiousBlessing = true;
      // Marriage blessed by priests = happiness bonus
      maritalHappiness = Math.min(100, maritalHappiness + 10);

      // Check if marriage aligns with religious practices
      if (stateReligion.practices?.includes("Marriage ceremonies")) {
        // Religion explicitly values marriage ceremonies
        maritalHappiness = Math.min(100, maritalHappiness + 5);
      }

      // Pious couples get extra blessing
      const avgPiety = ((spouse1.piety || 0) + (spouse2.piety || 0)) / 2;
      if (avgPiety > 50) {
        maritalHappiness = Math.min(100, maritalHappiness + Math.floor(avgPiety / 10));
      }
    }
  }

  // Create marriage
  const marriageId = await ctx.db.insert("marriages", {
    territoryId: spouse1.territoryId,
    spouse1Id,
    spouse2Id,
    marriageType: "love",
    marriageTick: tick,
    status: "active",
    childrenIds: [],
    maritalHappiness,
  });

  // Update character records
  await ctx.db.patch(spouse1Id, {
    spouseId: spouse2Id,
    marriageId,
    isMarried: true,
  });
  await ctx.db.patch(spouse2Id, {
    spouseId: spouse1Id,
    marriageId,
    isMarried: true,
  });

  // End romance (it's now marriage)
  if (romance) {
    await endRomance(ctx, romance._id, "marriage", tick);
  }

  return {
    success: true,
    marriageId,
    message: `${spouse1.name} and ${spouse2.name} have married for love!`,
  };
}

/**
 * Create alliance from marriage
 */
async function createMarriageAlliance(
  ctx: MutationCtx,
  territory1Id: Id<"territories">,
  territory2Id: Id<"territories">
): Promise<void> {
  // Find or create relationship
  let relationship = await ctx.db
    .query("relationships")
    .withIndex("by_territories", (q) =>
      q.eq("territory1Id", territory1Id).eq("territory2Id", territory2Id)
    )
    .first();

  if (!relationship) {
    relationship = await ctx.db
      .query("relationships")
      .withIndex("by_territories", (q) =>
        q.eq("territory1Id", territory2Id).eq("territory2Id", territory1Id)
      )
      .first();
  }

  if (relationship) {
    // Improve existing relationship
    await ctx.db.patch(relationship._id, {
      trust: Math.min(100, relationship.trust + 30),
      hasAlliance: true,
      status: "allied",
    });
  }
}

/**
 * Process marriages each tick
 */
export async function processMarriages(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  tick: number
): Promise<{ events: Array<{ type: string; description: string }> }> {
  const events: Array<{ type: string; description: string }> = [];

  const marriages = await ctx.db
    .query("marriages")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .filter((q) => q.eq(q.field("status"), "active"))
    .collect();

  for (const marriage of marriages) {
    const spouse1 = await ctx.db.get(marriage.spouse1Id);
    const spouse2 = await ctx.db.get(marriage.spouse2Id);

    // Check for widowhood
    if (!spouse1?.isAlive || !spouse2?.isAlive) {
      const survivor = spouse1?.isAlive ? spouse1 : spouse2;
      const deceased = spouse1?.isAlive ? spouse2 : spouse1;

      await ctx.db.patch(marriage._id, { status: "widowed" });

      if (survivor) {
        await ctx.db.patch(survivor._id, {
          isMarried: false,
          spouseId: undefined,
          // Keep marriageId for records
        });

        // Grief affects mental health
        const mentalHealth = survivor.mentalHealth || {
          sanity: 80, trauma: 0, depression: 0, anxiety: 0, ptsd: false, inTherapy: false,
        };
        await ctx.db.patch(survivor._id, {
          mentalHealth: {
            ...mentalHealth,
            depression: Math.min(100, mentalHealth.depression + 40),
            trauma: Math.min(100, mentalHealth.trauma + 25),
            lastTraumaticEvent: `Death of spouse ${deceased?.name}`,
            lastTraumaticEventTick: tick,
          },
        });

        events.push({
          type: "widowed",
          description: `${survivor.name} is now widowed after the death of ${deceased?.name}.`,
        });
      }
      continue;
    }

    // Update marital happiness naturally
    let happinessChange = 0;

    // Love marriages maintain higher baseline
    if (marriage.marriageType === "love") {
      happinessChange += 1;
    }

    // Political marriages can improve or decline
    if (marriage.marriageType === "political") {
      // Slowly improves as they get to know each other
      happinessChange += Math.random() * 2 - 0.5; // -0.5 to +1.5
    }

    // Character traits affect marriage
    const avgLoyalty = (spouse1.traits.loyalty + spouse2.traits.loyalty) / 2;
    const avgCompassion = (spouse1.traits.compassion + spouse2.traits.compassion) / 2;
    const avgPride = (spouse1.traits.pride + spouse2.traits.pride) / 2;

    happinessChange += (avgLoyalty - 50) * 0.02;
    happinessChange += (avgCompassion - 50) * 0.01;
    happinessChange -= (avgPride - 50) * 0.01;

    const newHappiness = Math.max(0, Math.min(100, marriage.maritalHappiness + happinessChange));

    // Check for divorce risk (unhappy marriages)
    if (newHappiness < 20) {
      const divorceChance = (20 - newHappiness) * 0.005; // Up to 10% per tick at 0 happiness
      if (Math.random() < divorceChance) {
        await handleDivorce(ctx, marriage, spouse1, spouse2, tick);
        events.push({
          type: "divorce",
          description: `${spouse1.name} and ${spouse2.name} have divorced due to irreconcilable differences.`,
        });
        continue;
      }
    }

    // Children chance (for active marriages)
    if (tick % 12 === 0) { // Check once per year
      const childChance = calculateChildChance(marriage, spouse1, spouse2);
      if (Math.random() < childChance) {
        events.push({
          type: "pregnancy",
          description: `${spouse1.name} and ${spouse2.name} are expecting a child!`,
        });
        // Actual child creation handled by character system
      }
    }

    await ctx.db.patch(marriage._id, { maritalHappiness: newHappiness });
  }

  return { events };
}

/**
 * Calculate chance of having a child
 */
function calculateChildChance(
  marriage: Doc<"marriages">,
  spouse1: Doc<"characters">,
  spouse2: Doc<"characters">
): number {
  // Base chance
  let chance = 0.15; // 15% per year

  // Adjusted by marital happiness
  chance *= (marriage.maritalHappiness / 100) + 0.3;

  // Adjusted by age (if we had age data)
  // Adjusted by existing children
  chance *= Math.pow(0.8, marriage.childrenIds.length); // Decreases with more children

  return Math.max(0, Math.min(0.3, chance)); // Cap at 30%
}

/**
 * Handle divorce
 */
async function handleDivorce(
  ctx: MutationCtx,
  marriage: Doc<"marriages">,
  spouse1: Doc<"characters">,
  spouse2: Doc<"characters">,
  tick: number
): Promise<void> {
  // Update marriage status
  await ctx.db.patch(marriage._id, { status: "divorced" });

  // Update both characters
  await ctx.db.patch(spouse1._id, {
    isMarried: false,
    spouseId: undefined,
  });
  await ctx.db.patch(spouse2._id, {
    isMarried: false,
    spouseId: undefined,
  });

  // Break alliance if political marriage
  if (marriage.allianceTerritoryId) {
    // Reduce trust between territories
    const relationship = await ctx.db
      .query("relationships")
      .withIndex("by_territory1", (q) => q.eq("territory1Id", spouse1.territoryId))
      .filter((q) => q.eq(q.field("territory2Id"), marriage.allianceTerritoryId))
      .first();

    if (relationship) {
      await ctx.db.patch(relationship._id, {
        trust: Math.max(-100, relationship.trust - 20),
        hasAlliance: false,
        status: "tense",
      });
    }
  }
}

/**
 * Annul a marriage
 */
export async function annulMarriage(
  ctx: MutationCtx,
  marriageId: Id<"marriages">,
  tick: number
): Promise<{ success: boolean; message: string }> {
  const marriage = await ctx.db.get(marriageId);
  if (!marriage) {
    return { success: false, message: "Marriage not found" };
  }

  if (marriage.status !== "active") {
    return { success: false, message: "Marriage is not active" };
  }

  const spouse1 = await ctx.db.get(marriage.spouse1Id);
  const spouse2 = await ctx.db.get(marriage.spouse2Id);

  await ctx.db.patch(marriageId, { status: "annulled" });

  if (spouse1) {
    await ctx.db.patch(spouse1._id, {
      isMarried: false,
      spouseId: undefined,
    });
  }
  if (spouse2) {
    await ctx.db.patch(spouse2._id, {
      isMarried: false,
      spouseId: undefined,
    });
  }

  return {
    success: true,
    message: `Marriage between ${spouse1?.name || "unknown"} and ${spouse2?.name || "unknown"} has been annulled.`,
  };
}

/**
 * Add child to marriage
 */
export async function addChildToMarriage(
  ctx: MutationCtx,
  marriageId: Id<"marriages">,
  childId: Id<"characters">
): Promise<void> {
  const marriage = await ctx.db.get(marriageId);
  if (!marriage) return;

  await ctx.db.patch(marriageId, {
    childrenIds: [...marriage.childrenIds, childId],
    maritalHappiness: Math.min(100, marriage.maritalHappiness + 10), // Children boost happiness
  });
}

/**
 * Get marriage summary for AI
 */
export async function getMarriageSummary(
  ctx: QueryCtx,
  territoryId: Id<"territories">
): Promise<string> {
  const marriages = await ctx.db
    .query("marriages")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .filter((q) => q.eq(q.field("status"), "active"))
    .collect();

  if (marriages.length === 0) {
    return "No active marriages in the court.";
  }

  const summaries: string[] = [];
  for (const m of marriages) {
    const spouse1 = await ctx.db.get(m.spouse1Id);
    const spouse2 = await ctx.db.get(m.spouse2Id);

    if (spouse1 && spouse2) {
      let desc = `${spouse1.name} & ${spouse2.name}: ${m.marriageType}`;
      desc += ` (${m.maritalHappiness}% happy, ${m.childrenIds.length} children)`;
      if (m.allianceTerritoryId) desc += " [alliance]";
      summaries.push(desc);
    }
  }

  return `Marriages: ${summaries.join("; ")}.`;
}

/**
 * Find potential marriage candidates for a character
 */
export async function findMarriageCandidates(
  ctx: QueryCtx,
  characterId: Id<"characters">,
  includeForeignTerritories: boolean = false
): Promise<Array<{ character: Doc<"characters">; compatibility: number }>> {
  const character = await ctx.db.get(characterId);
  if (!character) return [];

  // Get unmarried characters
  let candidates: Doc<"characters">[];

  if (includeForeignTerritories) {
    candidates = await ctx.db
      .query("characters")
      .filter((q) => q.and(
        q.eq(q.field("isAlive"), true),
        q.neq(q.field("isMarried"), true)
      ))
      .collect();
  } else {
    candidates = await ctx.db
      .query("characters")
      .withIndex("by_territory", (q) => q.eq("territoryId", character.territoryId))
      .filter((q) => q.and(
        q.eq(q.field("isAlive"), true),
        q.neq(q.field("isMarried"), true)
      ))
      .collect();
  }

  // Filter out self
  candidates = candidates.filter((c) => c._id !== characterId);

  // Calculate compatibility for each
  const results = candidates.map((candidate) => {
    // Simple compatibility based on traits
    const loyaltyMatch = 100 - Math.abs(character.traits.loyalty - candidate.traits.loyalty);
    const ambitionMatch = 100 - Math.abs(character.traits.ambition - candidate.traits.ambition);
    const wisdomMatch = 100 - Math.abs(character.traits.wisdom - candidate.traits.wisdom);

    const compatibility = Math.floor((loyaltyMatch + ambitionMatch + wisdomMatch) / 3);

    return { character: candidate, compatibility };
  });

  // Sort by compatibility
  results.sort((a, b) => b.compatibility - a.compatibility);

  return results.slice(0, 10); // Return top 10
}
