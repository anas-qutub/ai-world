/**
 * Romance System
 *
 * Manages romantic relationships between characters including attraction,
 * courtship, affairs, jealousy, and relationship progression.
 */

import { MutationCtx, QueryCtx } from "../_generated/server";
import { Id, Doc } from "../_generated/dataModel";

// Romance types
export type RomanceType = "courtship" | "romance" | "affair" | "unrequited";

export type RomanceStatus =
  | "active"
  | "ended_mutual"
  | "ended_breakup"
  | "ended_marriage";

// Attraction factors (0-100 contribution each)
interface AttractionFactors {
  physicalAttraction: number;    // Base physical chemistry
  intellectualMatch: number;      // Wisdom/cunning compatibility
  powerAttraction: number;        // Ambition/political power
  emotionalCompatibility: number; // Charisma/personality match
  socialStatus: number;           // Role/class matching
}

/**
 * Calculate attraction between two characters
 */
export function calculateAttraction(
  char1: Doc<"characters">,
  char2: Doc<"characters">
): { attraction: number; factors: AttractionFactors } {
  const factors: AttractionFactors = {
    physicalAttraction: 0,
    intellectualMatch: 0,
    powerAttraction: 0,
    emotionalCompatibility: 0,
    socialStatus: 0,
  };

  // Physical attraction (random chemistry + some trait influence)
  factors.physicalAttraction = Math.random() * 50 + 25; // 25-75 base

  // Intellectual match (wisdom and cunning similarity)
  const wisdomDiff = Math.abs(char1.traits.wisdom - char2.traits.wisdom);
  const cunningDiff = Math.abs(char1.traits.cunning - char2.traits.cunning);
  factors.intellectualMatch = Math.max(0, 100 - wisdomDiff - cunningDiff);

  // Power attraction (ambitious people attracted to power)
  const avgAmbition = (char1.traits.ambition + char2.traits.ambition) / 2;
  const roleValues: Record<string, number> = {
    ruler: 100,
    heir: 80,
    general: 70,
    advisor: 60,
    rival: 50,
    rebel_leader: 40,
  };
  const char1Power = roleValues[char1.role] || 30;
  const char2Power = roleValues[char2.role] || 30;
  factors.powerAttraction = ((char1Power + char2Power) / 2) * (avgAmbition / 100);

  // Emotional compatibility (charisma and diplomacy)
  const charismaDiff = Math.abs(char1.traits.charisma - char2.traits.charisma);
  factors.emotionalCompatibility = Math.max(0, 100 - charismaDiff);

  // Social status (same roles attract)
  factors.socialStatus = char1.role === char2.role ? 80 : 50;

  // Calculate weighted average
  const attraction = Math.floor(
    factors.physicalAttraction * 0.25 +
    factors.intellectualMatch * 0.2 +
    factors.powerAttraction * 0.2 +
    factors.emotionalCompatibility * 0.25 +
    factors.socialStatus * 0.1
  );

  return { attraction, factors };
}

/**
 * Start a courtship
 */
export async function startCourtship(
  ctx: MutationCtx,
  pursuer: Id<"characters">,
  pursued: Id<"characters">,
  tick: number
): Promise<{ success: boolean; romanceId?: Id<"romances">; message: string }> {
  const char1 = await ctx.db.get(pursuer);
  const char2 = await ctx.db.get(pursued);

  if (!char1 || !char2) {
    return { success: false, message: "Character not found" };
  }

  if (!char1.isAlive || !char2.isAlive) {
    return { success: false, message: "Cannot court deceased characters" };
  }

  // Check if either is already married
  const isMarried1 = char1.isMarried;
  const isMarried2 = char2.isMarried;

  if (isMarried1 || isMarried2) {
    return { success: false, message: "Cannot court a married person openly" };
  }

  // Check for existing romance
  const existingRomance = await findRomance(ctx, pursuer, pursued);
  if (existingRomance) {
    return { success: false, message: "Romance already exists" };
  }

  // Calculate attraction
  const { attraction } = calculateAttraction(char1, char2);

  // Check if pursued accepts
  const acceptanceChance = attraction + char1.traits.charisma - char2.traits.pride;
  if (Math.random() * 100 > acceptanceChance) {
    return {
      success: false,
      message: `${char2.name} has rejected ${char1.name}'s advances.`,
    };
  }

  // Create romance
  const romanceId = await ctx.db.insert("romances", {
    territoryId: char1.territoryId,
    lover1Id: pursuer,
    lover2Id: pursued,
    romanceType: "courtship",
    isSecret: false,
    attraction,
    passion: Math.floor(attraction * 0.5), // Starts low
    intimacy: 20, // Just beginning
    startTick: tick,
    isAdulterous: false,
    status: "active",
  });

  return {
    success: true,
    romanceId,
    message: `${char1.name} has begun courting ${char2.name}.`,
  };
}

/**
 * Start a secret affair
 */
export async function startAffair(
  ctx: MutationCtx,
  lover1Id: Id<"characters">,
  lover2Id: Id<"characters">,
  tick: number
): Promise<{ success: boolean; romanceId?: Id<"romances">; message: string }> {
  const char1 = await ctx.db.get(lover1Id);
  const char2 = await ctx.db.get(lover2Id);

  if (!char1 || !char2) {
    return { success: false, message: "Character not found" };
  }

  // Affairs require at least one married party
  const isMarried1 = char1.isMarried;
  const isMarried2 = char2.isMarried;

  if (!isMarried1 && !isMarried2) {
    // Not an affair, just start a romance
    return startCourtship(ctx, lover1Id, lover2Id, tick);
  }

  // Check for existing romance
  const existingRomance = await findRomance(ctx, lover1Id, lover2Id);
  if (existingRomance) {
    return { success: false, message: "Romance already exists" };
  }

  // Calculate attraction
  const { attraction } = calculateAttraction(char1, char2);

  // Affairs require higher attraction
  if (attraction < 60) {
    return {
      success: false,
      message: "Not enough attraction to risk an affair",
    };
  }

  // Create affair
  const romanceId = await ctx.db.insert("romances", {
    territoryId: char1.territoryId,
    lover1Id,
    lover2Id,
    romanceType: "affair",
    isSecret: true,
    attraction,
    passion: Math.floor(attraction * 0.8), // Affairs are passionate
    intimacy: 30,
    startTick: tick,
    isAdulterous: true,
    status: "active",
  });

  return {
    success: true,
    romanceId,
    message: `A secret affair has begun between ${char1.name} and ${char2.name}.`,
  };
}

/**
 * Find existing romance between two characters
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
 * Process romances each tick
 */
export async function processRomances(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  tick: number
): Promise<{ events: Array<{ type: string; description: string }> }> {
  const events: Array<{ type: string; description: string }> = [];

  const romances = await ctx.db
    .query("romances")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .filter((q) => q.eq(q.field("status"), "active"))
    .collect();

  for (const romance of romances) {
    const char1 = await ctx.db.get(romance.lover1Id);
    const char2 = await ctx.db.get(romance.lover2Id);

    if (!char1?.isAlive || !char2?.isAlive) {
      // End romance if someone died
      await ctx.db.patch(romance._id, {
        status: "ended_breakup",
        endTick: tick,
        endReason: "death",
      });
      events.push({
        type: "romance_ended",
        description: `The romance between ${char1?.name || "unknown"} and ${char2?.name || "unknown"} has ended tragically.`,
      });
      continue;
    }

    // Natural progression of romance
    const passionChange = Math.random() * 10 - 3; // -3 to +7
    const intimacyChange = Math.random() * 5 + 1;  // +1 to +6

    const newPassion = Math.max(0, Math.min(100, romance.passion + passionChange));
    const newIntimacy = Math.min(100, romance.intimacy + intimacyChange);

    // Check for romance type progression
    let newType = romance.romanceType;
    if (romance.romanceType === "courtship" && newIntimacy > 50 && newPassion > 60) {
      newType = "romance";
      events.push({
        type: "romance_deepened",
        description: `The courtship between ${char1.name} and ${char2.name} has blossomed into true romance.`,
      });
    }

    // Check for affair discovery
    if (romance.isSecret && romance.isAdulterous) {
      const discoveryChance = (100 - romance.intimacy) * 0.02; // Newer affairs more likely caught
      if (Math.random() < discoveryChance) {
        events.push({
          type: "affair_discovered",
          description: `The secret affair between ${char1.name} and ${char2.name} has been discovered!`,
        });
        // Mark as no longer secret
        await ctx.db.patch(romance._id, { isSecret: false });

        // This should trigger scandal effects elsewhere
        await triggerScandalEffects(ctx, romance, char1, char2, tick);
      }
    }

    // Check for breakup due to low passion/intimacy
    if (newPassion < 20 && newIntimacy < 30) {
      const breakupChance = 0.1; // 10% chance per tick
      if (Math.random() < breakupChance) {
        await ctx.db.patch(romance._id, {
          status: "ended_mutual",
          endTick: tick,
          endReason: "passion faded",
        });
        events.push({
          type: "romance_ended",
          description: `${char1.name} and ${char2.name}'s romance has quietly ended.`,
        });
        continue;
      }
    }

    // Check if romance should lead to marriage proposal
    if (!romance.isAdulterous && newIntimacy > 85 && newPassion > 70) {
      // High chance of marriage proposal
      if (Math.random() < 0.2) {
        events.push({
          type: "marriage_proposal",
          description: `${char1.name} and ${char2.name}'s love has deepened. A marriage may be forthcoming.`,
        });
        // Actual marriage handled by marriage system
      }
    }

    // Update romance
    await ctx.db.patch(romance._id, {
      passion: newPassion,
      intimacy: newIntimacy,
      romanceType: newType,
    });
  }

  // Check for jealousy triggers
  await checkJealousy(ctx, territoryId, tick, events);

  return { events };
}

/**
 * Trigger scandal effects when affair is discovered
 */
async function triggerScandalEffects(
  ctx: MutationCtx,
  romance: Doc<"romances">,
  char1: Doc<"characters">,
  char2: Doc<"characters">,
  tick: number
): Promise<void> {
  // Find spouses and trigger jealousy/rage
  if (char1.isMarried && char1.spouseId) {
    const spouse = await ctx.db.get(char1.spouseId);
    if (spouse) {
      // Spouse gets emotional damage
      const mentalHealth = spouse.mentalHealth || {
        sanity: 80, trauma: 0, depression: 0, anxiety: 0, ptsd: false, inTherapy: false,
      };
      await ctx.db.patch(spouse._id, {
        mentalHealth: {
          ...mentalHealth,
          trauma: Math.min(100, mentalHealth.trauma + 30),
          depression: Math.min(100, mentalHealth.depression + 40),
          lastTraumaticEvent: `Betrayal by ${char1.name}`,
          lastTraumaticEventTick: tick,
        },
        emotionalState: {
          ...spouse.emotionalState,
          rage: Math.min(100, spouse.emotionalState.rage + 50),
          shame: Math.min(100, spouse.emotionalState.shame + 30),
        },
      });
    }
  }

  if (char2.isMarried && char2.spouseId) {
    const spouse = await ctx.db.get(char2.spouseId);
    if (spouse) {
      const mentalHealth = spouse.mentalHealth || {
        sanity: 80, trauma: 0, depression: 0, anxiety: 0, ptsd: false, inTherapy: false,
      };
      await ctx.db.patch(spouse._id, {
        mentalHealth: {
          ...mentalHealth,
          trauma: Math.min(100, mentalHealth.trauma + 30),
          depression: Math.min(100, mentalHealth.depression + 40),
          lastTraumaticEvent: `Betrayal by ${char2.name}`,
          lastTraumaticEventTick: tick,
        },
        emotionalState: {
          ...spouse.emotionalState,
          rage: Math.min(100, spouse.emotionalState.rage + 50),
          shame: Math.min(100, spouse.emotionalState.shame + 30),
        },
      });
    }
  }

  // Lower happiness for territory (scandal spreads)
  const territory = await ctx.db.get(romance.territoryId);
  if (territory) {
    await ctx.db.patch(territory._id, {
      happiness: Math.max(0, territory.happiness - 5),
    });
  }

  // INTERCONNECTION: Affair discovery cascades trauma to children
  // Children of the adulterous parents also suffer psychological damage
  const marriages = await ctx.db
    .query("marriages")
    .withIndex("by_territory", (q: any) => q.eq("territoryId", romance.territoryId))
    .filter((q: any) => q.eq(q.field("status"), "active"))
    .collect();

  // Find children of affected marriages
  const affectedChildren: string[] = [];
  for (const marriage of marriages) {
    const isAffectedMarriage =
      (marriage.spouse1Id === char1._id || marriage.spouse2Id === char1._id) ||
      (marriage.spouse1Id === char2._id || marriage.spouse2Id === char2._id);

    if (isAffectedMarriage && marriage.childrenIds.length > 0) {
      for (const childId of marriage.childrenIds) {
        const child = await ctx.db.get(childId);
        if (child && child.isAlive) {
          // Children suffer less trauma than spouses but still affected
          const childMentalHealth = child.mentalHealth || {
            sanity: 80, trauma: 0, depression: 0, anxiety: 0, ptsd: false, inTherapy: false,
          };

          // Younger children affected more
          const ageModifier = child.age < 12 ? 1.5 : child.age < 18 ? 1.2 : 1.0;
          const traumaIncrease = Math.floor(15 * ageModifier);
          const anxietyIncrease = Math.floor(20 * ageModifier);

          await ctx.db.patch(child._id, {
            mentalHealth: {
              ...childMentalHealth,
              trauma: Math.min(100, childMentalHealth.trauma + traumaIncrease),
              anxiety: Math.min(100, childMentalHealth.anxiety + anxietyIncrease),
              depression: Math.min(100, childMentalHealth.depression + 10),
              lastTraumaticEvent: "Discovered parent's affair",
              lastTraumaticEventTick: tick,
            },
            emotionalState: {
              ...child.emotionalState,
              shame: Math.min(100, child.emotionalState.shame + 20),
              fear: Math.min(100, child.emotionalState.fear + 15),
            },
          });
          affectedChildren.push(child.name);
        }
      }
    }
  }
}

/**
 * Check for jealousy between characters
 */
async function checkJealousy(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  tick: number,
  events: Array<{ type: string; description: string }>
): Promise<void> {
  // Get all active romances in territory
  const romances = await ctx.db
    .query("romances")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .filter((q) => q.eq(q.field("status"), "active"))
    .collect();

  // Build a map of who is romantically involved
  const involvedChars = new Set<string>();
  for (const r of romances) {
    involvedChars.add(r.lover1Id);
    involvedChars.add(r.lover2Id);
  }

  // Check characters who might be jealous
  const characters = await ctx.db
    .query("characters")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .filter((q) => q.eq(q.field("isAlive"), true))
    .collect();

  for (const char of characters) {
    // Check if they have unrequited love
    for (const romance of romances) {
      // Skip if they're in the romance
      if (romance.lover1Id === char._id || romance.lover2Id === char._id) continue;

      // Check if they have a relationship with either lover
      const hasRelationship1 = char.relationships.find(
        (r) => r.characterId === romance.lover1Id && (r.type === "lover" || r.type === "friend")
      );
      const hasRelationship2 = char.relationships.find(
        (r) => r.characterId === romance.lover2Id && (r.type === "lover" || r.type === "friend")
      );

      if (hasRelationship1 || hasRelationship2) {
        // Potential jealousy
        const jealousyChance = char.traits.wrath * 0.01 + char.traits.pride * 0.005;
        if (Math.random() < jealousyChance) {
          const target = hasRelationship1 ? romance.lover1Id : romance.lover2Id;
          const rival = hasRelationship1 ? romance.lover2Id : romance.lover1Id;

          // Add rivalry/enemy relationship
          const targetChar = await ctx.db.get(target);
          const rivalChar = await ctx.db.get(rival);

          if (targetChar && rivalChar) {
            events.push({
              type: "jealousy",
              description: `${char.name} is jealous of ${targetChar.name}'s relationship with ${rivalChar.name}.`,
            });

            // Increase wrath
            await ctx.db.patch(char._id, {
              emotionalState: {
                ...char.emotionalState,
                rage: Math.min(100, char.emotionalState.rage + 20),
              },
            });
          }
        }
      }
    }
  }
}

/**
 * End a romance
 */
export async function endRomance(
  ctx: MutationCtx,
  romanceId: Id<"romances">,
  reason: "mutual" | "breakup" | "marriage",
  tick: number
): Promise<{ success: boolean; message: string }> {
  const romance = await ctx.db.get(romanceId);
  if (!romance) {
    return { success: false, message: "Romance not found" };
  }

  const statusMap: Record<string, RomanceStatus> = {
    mutual: "ended_mutual",
    breakup: "ended_breakup",
    marriage: "ended_marriage",
  };

  await ctx.db.patch(romanceId, {
    status: statusMap[reason],
    endTick: tick,
    endReason: reason,
  });

  const char1 = await ctx.db.get(romance.lover1Id);
  const char2 = await ctx.db.get(romance.lover2Id);

  return {
    success: true,
    message: `Romance between ${char1?.name || "unknown"} and ${char2?.name || "unknown"} has ended.`,
  };
}

/**
 * Encourage a match between two characters (AI action)
 */
export async function encourageMatch(
  ctx: MutationCtx,
  char1Id: Id<"characters">,
  char2Id: Id<"characters">,
  tick: number
): Promise<{ success: boolean; message: string }> {
  const char1 = await ctx.db.get(char1Id);
  const char2 = await ctx.db.get(char2Id);

  if (!char1 || !char2) {
    return { success: false, message: "Character not found" };
  }

  // Check if either is already in a romance
  const existingRomance = await findRomance(ctx, char1Id, char2Id);
  if (existingRomance) {
    // Boost the romance
    await ctx.db.patch(existingRomance._id, {
      intimacy: Math.min(100, existingRomance.intimacy + 10),
      passion: Math.min(100, existingRomance.passion + 5),
    });
    return {
      success: true,
      message: `Encouraged the relationship between ${char1.name} and ${char2.name}.`,
    };
  }

  // Start a new courtship with boosted chances
  return startCourtship(ctx, char1Id, char2Id, tick);
}

/**
 * Forbid a relationship (AI action)
 */
export async function forbidRelationship(
  ctx: MutationCtx,
  char1Id: Id<"characters">,
  char2Id: Id<"characters">,
  tick: number
): Promise<{ success: boolean; message: string }> {
  const romance = await findRomance(ctx, char1Id, char2Id);

  if (!romance) {
    return { success: false, message: "No relationship to forbid" };
  }

  // Force end the romance
  await ctx.db.patch(romance._id, {
    status: "ended_breakup",
    endTick: tick,
    endReason: "forbidden by ruler",
  });

  const char1 = await ctx.db.get(char1Id);
  const char2 = await ctx.db.get(char2Id);

  // Characters become unhappy
  if (char1) {
    await ctx.db.patch(char1Id, {
      emotionalState: {
        ...char1.emotionalState,
        despair: Math.min(100, char1.emotionalState.despair + 30),
        rage: Math.min(100, char1.emotionalState.rage + 20),
      },
    });
  }
  if (char2) {
    await ctx.db.patch(char2Id, {
      emotionalState: {
        ...char2.emotionalState,
        despair: Math.min(100, char2.emotionalState.despair + 30),
        rage: Math.min(100, char2.emotionalState.rage + 20),
      },
    });
  }

  return {
    success: true,
    message: `Forbidden the relationship between ${char1?.name || "unknown"} and ${char2?.name || "unknown"}.`,
  };
}

/**
 * Get romance summary for AI
 */
export async function getRomanceSummary(
  ctx: QueryCtx,
  territoryId: Id<"territories">
): Promise<string> {
  const romances = await ctx.db
    .query("romances")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .filter((q) => q.eq(q.field("status"), "active"))
    .collect();

  if (romances.length === 0) {
    return "No active romances in the court.";
  }

  const summaries: string[] = [];
  for (const r of romances) {
    const char1 = await ctx.db.get(r.lover1Id);
    const char2 = await ctx.db.get(r.lover2Id);

    if (char1 && char2) {
      let desc = `${char1.name} & ${char2.name}: ${r.romanceType}`;
      if (r.isSecret) desc += " (secret)";
      if (r.isAdulterous) desc += " (affair)";
      summaries.push(desc);
    }
  }

  return `Active romances: ${summaries.join("; ")}.`;
}
