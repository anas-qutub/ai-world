/**
 * Dynasty System
 *
 * Handles family trees, inheritance rules, succession, and prestige.
 */

import { MutationCtx, QueryCtx } from "../_generated/server";
import { Id, Doc } from "../_generated/dataModel";

// Inheritance rule types
export type InheritanceRule = "primogeniture" | "agnatic" | "elective" | "seniority";

/**
 * Create a new dynasty
 */
export async function createDynasty(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  founderId: Id<"characters">,
  dynastyName: string,
  tick: number,
  inheritanceRule: InheritanceRule = "primogeniture"
): Promise<Id<"dynastyTrees">> {
  const founder = await ctx.db.get(founderId);
  if (!founder) throw new Error("Founder not found");

  const dynastyId = await ctx.db.insert("dynastyTrees", {
    territoryId,
    dynastyName,
    founderId,
    foundedTick: tick,
    currentHeadId: founderId,
    totalGenerations: 1,
    inheritanceRule,
    prestige: 50, // Starting prestige
    motto: "",
    coatOfArms: "",
  });

  // Update founder's dynasty reference if field exists
  // The founder becomes the first head of the dynasty

  return dynastyId;
}

/**
 * Get dynasty by territory
 */
export async function getDynastyByTerritory(
  ctx: QueryCtx,
  territoryId: Id<"territories">
): Promise<Doc<"dynastyTrees"> | null> {
  return await ctx.db
    .query("dynastyTrees")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .first();
}

/**
 * Get all dynasty members (characters related to dynasty)
 */
export async function getDynastyMembers(
  ctx: QueryCtx,
  dynastyId: Id<"dynastyTrees">
): Promise<Doc<"characters">[]> {
  const dynasty = await ctx.db.get(dynastyId);
  if (!dynasty) return [];

  // Get founder and their descendants through marriages
  const members: Doc<"characters">[] = [];
  const processedIds = new Set<string>();
  const territoryId = dynasty.territoryId; // Capture to avoid null checks in nested function

  async function addMemberAndFamily(characterId: Id<"characters">) {
    if (processedIds.has(characterId)) return;
    processedIds.add(characterId);

    const character = await ctx.db.get(characterId);
    if (!character) return;

    members.push(character);

    // Find children through marriages
    const marriages = await ctx.db
      .query("marriages")
      .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
      .collect();

    for (const marriage of marriages) {
      if (marriage.spouse1Id === characterId || marriage.spouse2Id === characterId) {
        // Add spouse
        const spouseId = marriage.spouse1Id === characterId ? marriage.spouse2Id : marriage.spouse1Id;
        if (!processedIds.has(spouseId)) {
          processedIds.add(spouseId);
          const spouse = await ctx.db.get(spouseId);
          if (spouse) members.push(spouse);
        }

        // Add children
        for (const childId of marriage.childrenIds) {
          await addMemberAndFamily(childId);
        }
      }
    }
  }

  await addMemberAndFamily(dynasty.founderId);
  return members;
}

/**
 * Calculate succession order based on inheritance rule
 */
export async function calculateSuccession(
  ctx: QueryCtx,
  dynastyId: Id<"dynastyTrees">
): Promise<Array<{ characterId: Id<"characters">; priority: number; reason: string }>> {
  const dynasty = await ctx.db.get(dynastyId);
  if (!dynasty) return [];

  const currentHead = dynasty.currentHeadId ? await ctx.db.get(dynasty.currentHeadId) : null;
  if (!currentHead) return [];

  const candidates: Array<{ characterId: Id<"characters">; priority: number; reason: string }> = [];

  // Get all living dynasty members
  const members = await getDynastyMembers(ctx, dynastyId);
  const livingMembers = members.filter((m) => m.isAlive);

  // Find children of current head
  const marriages = await ctx.db
    .query("marriages")
    .withIndex("by_territory", (q) => q.eq("territoryId", dynasty.territoryId))
    .collect();

  const headMarriage = marriages.find(
    (m) =>
      (m.spouse1Id === currentHead._id || m.spouse2Id === currentHead._id) &&
      m.status === "active"
  );

  const children: Doc<"characters">[] = [];
  if (headMarriage) {
    for (const childId of headMarriage.childrenIds) {
      const child = await ctx.db.get(childId);
      if (child && child.isAlive) {
        children.push(child);
      }
    }
  }

  // Sort children by age (older first)
  children.sort((a, b) => a.birthTick - b.birthTick);

  switch (dynasty.inheritanceRule) {
    case "primogeniture":
      // Eldest child inherits regardless of gender
      children.forEach((child, index) => {
        candidates.push({
          characterId: child._id,
          priority: index + 1,
          reason: index === 0 ? "Eldest child" : `${index + 1}${getOrdinalSuffix(index + 1)} child`,
        });
      });
      break;

    case "agnatic":
      // Only males inherit, eldest first
      const maleChildren = children.filter((c) => c.gender === "male");
      maleChildren.forEach((child, index) => {
        candidates.push({
          characterId: child._id,
          priority: index + 1,
          reason: index === 0 ? "Eldest son" : `${index + 1}${getOrdinalSuffix(index + 1)} son`,
        });
      });

      // If no male children, look for male relatives
      if (maleChildren.length === 0) {
        const maleRelatives = livingMembers.filter(
          (m) => m.gender === "male" && m._id !== currentHead._id
        );
        maleRelatives.forEach((relative, index) => {
          candidates.push({
            characterId: relative._id,
            priority: 100 + index,
            reason: "Male relative",
          });
        });
      }
      break;

    case "seniority":
      // Oldest living member inherits
      const sortedByAge = livingMembers
        .filter((m) => m._id !== currentHead._id)
        .sort((a, b) => a.birthTick - b.birthTick);

      sortedByAge.forEach((member, index) => {
        candidates.push({
          characterId: member._id,
          priority: index + 1,
          reason: index === 0 ? "Eldest living member" : "Senior member",
        });
      });
      break;

    case "elective":
      // All adult members are candidates, sorted by prestige/competence
      const adults = livingMembers.filter(
        (m) => m._id !== currentHead._id && m.age >= 16
      );

      // Score by competence traits (traits are numeric values)
      const scored = adults.map((member) => {
        let score = 0;
        if (member.traits.wisdom > 70) score += 20; // intelligent
        if (member.traits.diplomacy > 70) score += 15; // charismatic
        if (member.traits.courage > 70) score += 10; // brave
        if (member.traits.ambition > 70) score += 10; // ambitious
        if (member.traits.cruelty > 70) score -= 10; // cruel
        if (member.traits.courage < 30) score -= 15; // cowardly
        return { member, score };
      });

      scored.sort((a, b) => b.score - a.score);

      scored.forEach(({ member }, index) => {
        candidates.push({
          characterId: member._id,
          priority: index + 1,
          reason: index === 0 ? "Most capable candidate" : "Eligible candidate",
        });
      });
      break;
  }

  return candidates;
}

/**
 * Process succession when head dies
 */
export async function processSuccession(
  ctx: MutationCtx,
  dynastyId: Id<"dynastyTrees">,
  tick: number
): Promise<{
  newHead: Id<"characters"> | null;
  message: string;
}> {
  const dynasty = await ctx.db.get(dynastyId);
  if (!dynasty) {
    return { newHead: null, message: "Dynasty not found" };
  }

  const succession = await calculateSuccession(ctx, dynastyId);

  if (succession.length === 0) {
    // Dynasty ends - no heirs
    await ctx.db.patch(dynastyId, {
      currentHeadId: undefined,
    });

    return {
      newHead: null,
      message: `The ${dynasty.dynastyName} dynasty has ended - no heirs remain.`,
    };
  }

  const heir = succession[0];
  const heirCharacter = await ctx.db.get(heir.characterId);

  // Update dynasty
  await ctx.db.patch(dynastyId, {
    currentHeadId: heir.characterId,
    totalGenerations: dynasty.totalGenerations + 1,
  });

  // Record memory for AI agent
  const agent = await ctx.db
    .query("agents")
    .withIndex("by_territory", (q) => q.eq("territoryId", dynasty.territoryId))
    .first();

  if (agent) {
    await ctx.db.insert("agentMemories", {
      agentId: agent._id,
      territoryId: dynasty.territoryId,
      memoryType: "crisis",
      tick,
      description: `${heirCharacter?.name || "A new ruler"} has become head of the ${dynasty.dynastyName} dynasty. ${heir.reason}.`,
      emotionalWeight: 0,
      salience: 85,
      timesReferenced: 0,
    });
  }

  return {
    newHead: heir.characterId,
    message: `${heirCharacter?.name || "Unknown"} becomes the new head of the ${dynasty.dynastyName} dynasty. ${heir.reason}.`,
  };
}

/**
 * Change inheritance rule
 */
export async function setInheritanceRule(
  ctx: MutationCtx,
  dynastyId: Id<"dynastyTrees">,
  newRule: InheritanceRule,
  tick: number
): Promise<{ success: boolean; message: string }> {
  const dynasty = await ctx.db.get(dynastyId);
  if (!dynasty) {
    return { success: false, message: "Dynasty not found" };
  }

  const oldRule = dynasty.inheritanceRule;

  await ctx.db.patch(dynastyId, {
    inheritanceRule: newRule,
  });

  // This can cause unrest if it disinherits someone
  const ruleNames: Record<InheritanceRule, string> = {
    primogeniture: "Eldest Child Inheritance",
    agnatic: "Male-Only Inheritance",
    elective: "Elective Succession",
    seniority: "Seniority-Based Succession",
  };

  // Record memory
  const agent = await ctx.db
    .query("agents")
    .withIndex("by_territory", (q) => q.eq("territoryId", dynasty.territoryId))
    .first();

  if (agent) {
    await ctx.db.insert("agentMemories", {
      agentId: agent._id,
      territoryId: dynasty.territoryId,
      memoryType: "crisis",
      tick,
      description: `Changed succession law from ${ruleNames[oldRule]} to ${ruleNames[newRule]}.`,
      emotionalWeight: -10, // Can cause some unrest
      salience: 70,
      timesReferenced: 0,
    });
  }

  return {
    success: true,
    message: `Inheritance law changed to ${ruleNames[newRule]}`,
  };
}

/**
 * Legitimize a bastard (illegitimate child)
 */
export async function legitimizeBastard(
  ctx: MutationCtx,
  dynastyId: Id<"dynastyTrees">,
  characterId: Id<"characters">,
  tick: number
): Promise<{ success: boolean; message: string }> {
  const dynasty = await ctx.db.get(dynastyId);
  if (!dynasty) {
    return { success: false, message: "Dynasty not found" };
  }

  const character = await ctx.db.get(characterId);
  if (!character) {
    return { success: false, message: "Character not found" };
  }

  // Check if character is a bastard (using honor < 30 as proxy for illegitimate)
  // In a real implementation, there would be a specific field for legitimacy
  // For now, we just mark them as legitimized by increasing their honor
  if (character.traits.honor >= 50) {
    return { success: false, message: "Character does not need legitimization" };
  }

  // Legitimize by increasing honor to acceptable levels
  await ctx.db.patch(characterId, {
    traits: {
      ...character.traits,
      honor: Math.max(50, character.traits.honor + 30),
    },
  });

  // This costs prestige
  await ctx.db.patch(dynastyId, {
    prestige: Math.max(0, dynasty.prestige - 10),
  });

  // Record memory
  const agent = await ctx.db
    .query("agents")
    .withIndex("by_territory", (q) => q.eq("territoryId", dynasty.territoryId))
    .first();

  if (agent) {
    await ctx.db.insert("agentMemories", {
      agentId: agent._id,
      territoryId: dynasty.territoryId,
      memoryType: "victory",
      tick,
      description: `${character.name} has been legitimized and can now inherit.`,
      emotionalWeight: 5,
      salience: 75,
      timesReferenced: 0,
    });
  }

  return {
    success: true,
    message: `${character.name} has been legitimized and may now be considered for succession.`,
  };
}

/**
 * Add prestige to dynasty
 */
export async function addPrestige(
  ctx: MutationCtx,
  dynastyId: Id<"dynastyTrees">,
  amount: number,
  reason: string
): Promise<void> {
  const dynasty = await ctx.db.get(dynastyId);
  if (!dynasty) return;

  const newPrestige = Math.max(0, Math.min(100, dynasty.prestige + amount));
  await ctx.db.patch(dynastyId, {
    prestige: newPrestige,
  });
}

/**
 * Process dynasties each tick
 */
export async function processDynasties(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  tick: number
): Promise<{ events: Array<{ type: string; description: string }> }> {
  const events: Array<{ type: string; description: string }> = [];

  const dynasty = await getDynastyByTerritory(ctx, territoryId);
  if (!dynasty) return { events };

  // Check if current head is still alive
  if (dynasty.currentHeadId) {
    const currentHead = await ctx.db.get(dynasty.currentHeadId);

    if (!currentHead || !currentHead.isAlive) {
      // Head has died - trigger succession
      const result = await processSuccession(ctx, dynasty._id, tick);
      events.push({
        type: "succession",
        description: result.message,
      });
    }
  }

  // Prestige decay/growth based on territory state
  const territory = await ctx.db.get(territoryId);
  if (territory) {
    let prestigeChange = 0;

    // Prestige grows with prosperity
    if (territory.happiness > 70) prestigeChange += 0.1;
    if (territory.population > 10000) prestigeChange += 0.1;

    // Prestige decays with problems
    if (territory.happiness < 30) prestigeChange -= 0.2;
    if (territory.population < 100) prestigeChange -= 0.3;

    if (prestigeChange !== 0) {
      await addPrestige(ctx, dynasty._id, prestigeChange, "Territory status");
    }
  }

  // Check for potential succession crises (multiple strong claimants)
  if (dynasty.inheritanceRule === "elective" && Math.random() < 0.01) {
    const succession = await calculateSuccession(ctx, dynasty._id);
    if (succession.length >= 3) {
      events.push({
        type: "succession_tension",
        description: `Tensions rise in the ${dynasty.dynastyName} dynasty as multiple candidates vie for succession.`,
      });
    }
  }

  return { events };
}

/**
 * Get dynasty summary for AI
 */
export async function getDynastySummary(
  ctx: QueryCtx,
  territoryId: Id<"territories">
): Promise<string> {
  const dynasty = await getDynastyByTerritory(ctx, territoryId);
  if (!dynasty) {
    return "No ruling dynasty established.";
  }

  const currentHead = dynasty.currentHeadId ? await ctx.db.get(dynasty.currentHeadId) : null;
  const succession = await calculateSuccession(ctx, dynasty._id);
  const heir = succession.length > 0 ? await ctx.db.get(succession[0].characterId) : null;

  const ruleNames: Record<InheritanceRule, string> = {
    primogeniture: "eldest child",
    agnatic: "eldest male",
    elective: "elected",
    seniority: "eldest member",
  };

  let summary = `The ${dynasty.dynastyName} dynasty (Generation ${dynasty.totalGenerations}, Prestige: ${dynasty.prestige}). `;
  summary += `Current head: ${currentHead?.name || "None"}. `;
  summary += `Succession: ${ruleNames[dynasty.inheritanceRule]}. `;
  summary += `Heir: ${heir?.name || "None designated"}.`;

  return summary;
}

// Helper function for ordinal suffixes
function getOrdinalSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}
