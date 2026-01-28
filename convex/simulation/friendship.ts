/**
 * Friendship System
 *
 * Manages non-romantic bonds between characters, including formation,
 * effects on loyalty and mental health, and shared experiences.
 */

import { MutationCtx, QueryCtx } from "../_generated/server";
import { Id, Doc } from "../_generated/dataModel";

// Friendship types
export type FriendshipType =
  | "acquaintance"
  | "friend"
  | "close_friend"
  | "best_friend"
  | "sworn_brother";

// Thresholds for friendship tiers
const FRIENDSHIP_THRESHOLDS = {
  acquaintance: 0,
  friend: 30,
  close_friend: 60,
  best_friend: 85,
  sworn_brother: 95,
};

// Friendship formation triggers
export type FriendshipTrigger =
  | "worked_together"
  | "fought_together"
  | "survived_disaster"
  | "childhood_friends"
  | "mentorship"
  | "saved_life"
  | "shared_hardship"
  | "political_alliance"
  | "common_enemy";

// Strength gain per trigger
const TRIGGER_STRENGTH_GAIN: Record<FriendshipTrigger, number> = {
  worked_together: 5,
  fought_together: 15,
  survived_disaster: 20,
  childhood_friends: 25,
  mentorship: 10,
  saved_life: 40,
  shared_hardship: 15,
  political_alliance: 8,
  common_enemy: 12,
};

// Friendship effects
const FRIENDSHIP_EFFECTS: Record<FriendshipType, {
  loyaltyBonus: number;
  mentalHealthBonus: number;
  plotResistance: number;
}> = {
  acquaintance: { loyaltyBonus: 2, mentalHealthBonus: 1, plotResistance: 5 },
  friend: { loyaltyBonus: 5, mentalHealthBonus: 3, plotResistance: 15 },
  close_friend: { loyaltyBonus: 10, mentalHealthBonus: 7, plotResistance: 30 },
  best_friend: { loyaltyBonus: 20, mentalHealthBonus: 15, plotResistance: 50 },
  sworn_brother: { loyaltyBonus: 40, mentalHealthBonus: 25, plotResistance: 80 },
};

/**
 * Create a new friendship
 */
export async function createFriendship(
  ctx: MutationCtx,
  character1Id: Id<"characters">,
  character2Id: Id<"characters">,
  trigger: FriendshipTrigger,
  tick: number
): Promise<{ success: boolean; friendshipId?: Id<"friendships">; message: string }> {
  // Get both characters
  const char1 = await ctx.db.get(character1Id);
  const char2 = await ctx.db.get(character2Id);

  if (!char1 || !char2) {
    return { success: false, message: "Character not found" };
  }

  if (!char1.isAlive || !char2.isAlive) {
    return { success: false, message: "Cannot befriend deceased characters" };
  }

  if (char1.territoryId !== char2.territoryId) {
    // Allow cross-territory friendships but they're rarer
  }

  // Check if friendship already exists
  const existingFriendship = await findFriendship(ctx, character1Id, character2Id);

  if (existingFriendship) {
    // Strengthen existing friendship
    const strengthGain = TRIGGER_STRENGTH_GAIN[trigger];
    const newStrength = Math.min(100, existingFriendship.strength + strengthGain);
    const newType = getFriendshipType(newStrength);

    // Add shared experience
    const sharedExperiences = [
      ...existingFriendship.sharedExperiences,
      trigger,
    ];

    await ctx.db.patch(existingFriendship._id, {
      strength: newStrength,
      friendshipType: newType,
      sharedExperiences,
      lastInteractionTick: tick,
      loyaltyBonus: FRIENDSHIP_EFFECTS[newType].loyaltyBonus,
      mentalHealthBonus: FRIENDSHIP_EFFECTS[newType].mentalHealthBonus,
    });

    return {
      success: true,
      friendshipId: existingFriendship._id,
      message: `Friendship between ${char1.name} and ${char2.name} deepened to ${newType.replace("_", " ")}.`,
    };
  }

  // Create new friendship
  const initialStrength = TRIGGER_STRENGTH_GAIN[trigger];
  const friendshipType = getFriendshipType(initialStrength);
  const effects = FRIENDSHIP_EFFECTS[friendshipType];

  const friendshipId = await ctx.db.insert("friendships", {
    territoryId: char1.territoryId,
    character1Id,
    character2Id,
    friendshipType,
    strength: initialStrength,
    sharedExperiences: [trigger],
    startTick: tick,
    lastInteractionTick: tick,
    loyaltyBonus: effects.loyaltyBonus,
    mentalHealthBonus: effects.mentalHealthBonus,
  });

  // Update character friend counts
  await ctx.db.patch(character1Id, {
    friendCount: (char1.friendCount || 0) + 1,
  });
  await ctx.db.patch(character2Id, {
    friendCount: (char2.friendCount || 0) + 1,
  });

  return {
    success: true,
    friendshipId,
    message: `${char1.name} and ${char2.name} have become ${friendshipType.replace("_", " ")}s through ${trigger.replace("_", " ")}.`,
  };
}

/**
 * Get friendship type based on strength
 */
function getFriendshipType(strength: number): FriendshipType {
  if (strength >= FRIENDSHIP_THRESHOLDS.sworn_brother) return "sworn_brother";
  if (strength >= FRIENDSHIP_THRESHOLDS.best_friend) return "best_friend";
  if (strength >= FRIENDSHIP_THRESHOLDS.close_friend) return "close_friend";
  if (strength >= FRIENDSHIP_THRESHOLDS.friend) return "friend";
  return "acquaintance";
}

/**
 * Find existing friendship between two characters
 */
async function findFriendship(
  ctx: QueryCtx,
  character1Id: Id<"characters">,
  character2Id: Id<"characters">
): Promise<Doc<"friendships"> | null> {
  // Check both directions
  const friendship1 = await ctx.db
    .query("friendships")
    .withIndex("by_character1", (q) => q.eq("character1Id", character1Id))
    .filter((q) => q.eq(q.field("character2Id"), character2Id))
    .first();

  if (friendship1) return friendship1;

  const friendship2 = await ctx.db
    .query("friendships")
    .withIndex("by_character1", (q) => q.eq("character1Id", character2Id))
    .filter((q) => q.eq(q.field("character2Id"), character1Id))
    .first();

  return friendship2;
}

/**
 * Process friendships each tick (decay, interactions)
 */
export async function processFriendships(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  tick: number
): Promise<{ events: Array<{ type: string; description: string }> }> {
  const events: Array<{ type: string; description: string }> = [];

  const friendships = await ctx.db
    .query("friendships")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .collect();

  for (const friendship of friendships) {
    // Check if characters are still alive
    const char1 = await ctx.db.get(friendship.character1Id);
    const char2 = await ctx.db.get(friendship.character2Id);

    if (!char1?.isAlive || !char2?.isAlive) {
      // Handle death of friend
      if (char1?.isAlive && !char2?.isAlive) {
        await handleFriendDeath(ctx, char1, char2!, friendship, tick);
        events.push({
          type: "friend_death",
          description: `${char1.name} mourns the loss of their ${friendship.friendshipType.replace("_", " ")}, ${char2!.name}.`,
        });
      } else if (!char1?.isAlive && char2?.isAlive) {
        await handleFriendDeath(ctx, char2, char1!, friendship, tick);
        events.push({
          type: "friend_death",
          description: `${char2.name} mourns the loss of their ${friendship.friendshipType.replace("_", " ")}, ${char1!.name}.`,
        });
      }

      // Delete the friendship
      await ctx.db.delete(friendship._id);
      continue;
    }

    // Natural decay of friendship without interaction
    const ticksSinceInteraction = tick - friendship.lastInteractionTick;
    if (ticksSinceInteraction > 6) {
      // Decay if no interaction for 6+ months
      const decay = Math.floor((ticksSinceInteraction - 6) * 0.5);
      const newStrength = Math.max(0, friendship.strength - decay);

      if (newStrength === 0) {
        // Friendship faded
        await ctx.db.delete(friendship._id);
        await ctx.db.patch(friendship.character1Id, {
          friendCount: Math.max(0, (char1.friendCount || 1) - 1),
        });
        await ctx.db.patch(friendship.character2Id, {
          friendCount: Math.max(0, (char2.friendCount || 1) - 1),
        });
        events.push({
          type: "friendship_faded",
          description: `${char1.name} and ${char2.name}'s friendship has faded.`,
        });
      } else {
        const newType = getFriendshipType(newStrength);
        const effects = FRIENDSHIP_EFFECTS[newType];

        if (newType !== friendship.friendshipType) {
          events.push({
            type: "friendship_weakened",
            description: `${char1.name} and ${char2.name}'s friendship has weakened to ${newType.replace("_", " ")}.`,
          });
        }

        await ctx.db.patch(friendship._id, {
          strength: newStrength,
          friendshipType: newType,
          loyaltyBonus: effects.loyaltyBonus,
          mentalHealthBonus: effects.mentalHealthBonus,
        });
      }
    }
  }

  return { events };
}

/**
 * Handle the death of a friend
 */
async function handleFriendDeath(
  ctx: MutationCtx,
  survivor: Doc<"characters">,
  deceased: Doc<"characters">,
  friendship: Doc<"friendships">,
  tick: number
): Promise<void> {
  // Update survivor's mental health
  const mentalHealth = survivor.mentalHealth || {
    sanity: 80,
    trauma: 0,
    depression: 0,
    anxiety: 0,
    ptsd: false,
    inTherapy: false,
  };

  // Trauma proportional to friendship strength
  const traumaGain = Math.floor(friendship.strength * 0.3);
  const depressionGain = Math.floor(friendship.strength * 0.4);

  await ctx.db.patch(survivor._id, {
    mentalHealth: {
      ...mentalHealth,
      trauma: Math.min(100, mentalHealth.trauma + traumaGain),
      depression: Math.min(100, mentalHealth.depression + depressionGain),
      sanity: Math.max(0, mentalHealth.sanity - traumaGain * 0.5),
      lastTraumaticEvent: `Death of ${friendship.friendshipType.replace("_", " ")} ${deceased.name}`,
      lastTraumaticEventTick: tick,
    },
    friendCount: Math.max(0, (survivor.friendCount || 1) - 1),
    // Clear best friend if this was them
    bestFriendId: survivor.bestFriendId === deceased._id ? undefined : survivor.bestFriendId,
  });
}

/**
 * Make characters best friends
 */
export async function makeBestFriends(
  ctx: MutationCtx,
  character1Id: Id<"characters">,
  character2Id: Id<"characters">,
  tick: number
): Promise<{ success: boolean; message: string }> {
  const char1 = await ctx.db.get(character1Id);
  const char2 = await ctx.db.get(character2Id);

  if (!char1 || !char2) {
    return { success: false, message: "Character not found" };
  }

  // Find or create friendship
  let friendship = await findFriendship(ctx, character1Id, character2Id);

  if (!friendship) {
    const result = await createFriendship(
      ctx,
      character1Id,
      character2Id,
      "childhood_friends",
      tick
    );
    if (!result.success) {
      return result;
    }
    friendship = await ctx.db.get(result.friendshipId!);
  }

  if (!friendship) {
    return { success: false, message: "Failed to create friendship" };
  }

  // Upgrade to best friends
  const effects = FRIENDSHIP_EFFECTS.best_friend;
  await ctx.db.patch(friendship._id, {
    strength: 90,
    friendshipType: "best_friend",
    loyaltyBonus: effects.loyaltyBonus,
    mentalHealthBonus: effects.mentalHealthBonus,
    lastInteractionTick: tick,
  });

  // Set as each other's best friends
  await ctx.db.patch(character1Id, { bestFriendId: character2Id });
  await ctx.db.patch(character2Id, { bestFriendId: character1Id });

  return {
    success: true,
    message: `${char1.name} and ${char2.name} are now best friends.`,
  };
}

/**
 * Sworn brotherhood ceremony
 */
export async function swearBrotherhood(
  ctx: MutationCtx,
  character1Id: Id<"characters">,
  character2Id: Id<"characters">,
  tick: number
): Promise<{ success: boolean; message: string }> {
  const char1 = await ctx.db.get(character1Id);
  const char2 = await ctx.db.get(character2Id);

  if (!char1 || !char2) {
    return { success: false, message: "Character not found" };
  }

  // Find or create friendship
  let friendship = await findFriendship(ctx, character1Id, character2Id);

  if (!friendship) {
    const result = await createFriendship(ctx, character1Id, character2Id, "saved_life", tick);
    if (!result.success) {
      return result;
    }
    friendship = await ctx.db.get(result.friendshipId!);
  }

  if (!friendship) {
    return { success: false, message: "Failed to create friendship" };
  }

  // Must already be close friends
  if (friendship.strength < 60) {
    return {
      success: false,
      message: "Must be close friends before swearing brotherhood",
    };
  }

  // Upgrade to sworn brotherhood
  const effects = FRIENDSHIP_EFFECTS.sworn_brother;
  await ctx.db.patch(friendship._id, {
    strength: 100,
    friendshipType: "sworn_brother",
    loyaltyBonus: effects.loyaltyBonus,
    mentalHealthBonus: effects.mentalHealthBonus,
    lastInteractionTick: tick,
    sharedExperiences: [...friendship.sharedExperiences, "sworn_brotherhood"],
  });

  // Set as each other's best friends
  await ctx.db.patch(character1Id, { bestFriendId: character2Id });
  await ctx.db.patch(character2Id, { bestFriendId: character1Id });

  return {
    success: true,
    message: `${char1.name} and ${char2.name} have sworn an oath of brotherhood. They are bound by blood and honor.`,
  };
}

/**
 * Get all friendships for a character
 */
export async function getCharacterFriendships(
  ctx: QueryCtx,
  characterId: Id<"characters">
): Promise<Array<{ friendId: Id<"characters">; friendName: string; type: FriendshipType; strength: number }>> {
  const friendships1 = await ctx.db
    .query("friendships")
    .withIndex("by_character1", (q) => q.eq("character1Id", characterId))
    .collect();

  const friendships2 = await ctx.db
    .query("friendships")
    .withIndex("by_character2", (q) => q.eq("character2Id", characterId))
    .collect();

  const result: Array<{
    friendId: Id<"characters">;
    friendName: string;
    type: FriendshipType;
    strength: number;
  }> = [];

  for (const f of friendships1) {
    const friend = await ctx.db.get(f.character2Id);
    if (friend) {
      result.push({
        friendId: f.character2Id,
        friendName: friend.name,
        type: f.friendshipType,
        strength: f.strength,
      });
    }
  }

  for (const f of friendships2) {
    const friend = await ctx.db.get(f.character1Id);
    if (friend) {
      result.push({
        friendId: f.character1Id,
        friendName: friend.name,
        type: f.friendshipType,
        strength: f.strength,
      });
    }
  }

  return result;
}

/**
 * Check if friendship prevents plotting against
 */
export async function checkFriendshipPlotResistance(
  ctx: QueryCtx,
  plotterId: Id<"characters">,
  targetId: Id<"characters">
): Promise<{ resists: boolean; reason?: string }> {
  const friendship = await findFriendship(ctx, plotterId, targetId);

  if (!friendship) {
    return { resists: false };
  }

  const resistance = FRIENDSHIP_EFFECTS[friendship.friendshipType].plotResistance;
  const roll = Math.random() * 100;

  if (roll < resistance) {
    return {
      resists: true,
      reason: `Their ${friendship.friendshipType.replace("_", " ")} bond prevents betrayal`,
    };
  }

  return { resists: false };
}

/**
 * Get friendship summary for AI
 */
export async function getFriendshipSummary(
  ctx: QueryCtx,
  characterId: Id<"characters">
): Promise<string> {
  const character = await ctx.db.get(characterId);
  if (!character) return "Character not found";

  const friendships = await getCharacterFriendships(ctx, characterId);

  if (friendships.length === 0) {
    return `${character.name} has no close friends.`;
  }

  const bestFriend = friendships.find((f) => f.type === "best_friend" || f.type === "sworn_brother");
  const closeFriends = friendships.filter((f) => f.type === "close_friend");

  let summary = "";

  if (bestFriend) {
    summary += `${character.name}'s ${bestFriend.type.replace("_", " ")} is ${bestFriend.friendName}. `;
  }

  if (closeFriends.length > 0) {
    summary += `Close friends: ${closeFriends.map((f) => f.friendName).join(", ")}. `;
  }

  summary += `Total friends: ${friendships.length}.`;

  return summary;
}
