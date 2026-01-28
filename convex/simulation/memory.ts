import { MutationCtx, QueryCtx } from "../_generated/server";
import { Id, Doc } from "../_generated/dataModel";

// =============================================
// ORGANIC AI GROWTH - MEMORY SYSTEM
// =============================================
// AIs remember key events and reference their own history when making decisions.
// Memories fade over time unless reinforced by being referenced.

// Memory type definitions
export type MemoryType =
  | "war"
  | "betrayal"
  | "alliance"
  | "trade"
  | "crisis"
  | "victory"
  | "defeat"
  | "gift"
  | "insult"
  | "help"
  | "conquest"
  | "character_death";

// Memory salience decay constants
const TICK_DECAY = 0.5;           // Lose 0.5 salience per tick
const EMOTIONAL_WEIGHT_FACTOR = 0.1; // Stronger emotions decay slower
const REFERENCE_BOOST = 15;       // Boost when memory is referenced
const MIN_SALIENCE = 10;          // Memory "forgotten" when below this
const INITIAL_SALIENCE = 100;     // Starting salience for new memories

/**
 * Record a new memory for an agent
 */
export async function recordMemory(
  ctx: MutationCtx,
  agentId: Id<"agents">,
  memory: {
    type: MemoryType;
    targetTerritoryId?: Id<"territories">;
    characterId?: Id<"characters">;
    description: string;
    emotionalWeight: number; // -100 to +100
  }
): Promise<Id<"agentMemories">> {
  const agent = await ctx.db.get(agentId);
  if (!agent) {
    throw new Error("Agent not found");
  }

  const world = await ctx.db.query("world").first();
  const currentTick = world?.tick || 0;

  // Create the memory
  const memoryId = await ctx.db.insert("agentMemories", {
    agentId,
    territoryId: agent.territoryId,
    memoryType: memory.type,
    targetTerritoryId: memory.targetTerritoryId,
    characterId: memory.characterId,
    tick: currentTick,
    description: memory.description,
    emotionalWeight: Math.max(-100, Math.min(100, memory.emotionalWeight)),
    salience: INITIAL_SALIENCE,
    timesReferenced: 0,
    lastReferencedTick: undefined,
  });

  return memoryId;
}

/**
 * Retrieve relevant memories for decision-making
 * Returns memories sorted by relevance (salience * emotional intensity)
 */
export async function getRelevantMemories(
  ctx: QueryCtx,
  agentId: Id<"agents">,
  context: {
    targetTerritoryId?: Id<"territories">;
    decisionType?: string;
    limit?: number;
  }
): Promise<Doc<"agentMemories">[]> {
  const limit = context.limit || 10;

  // Get all memories for this agent
  let memories = await ctx.db
    .query("agentMemories")
    .withIndex("by_agent", (q) => q.eq("agentId", agentId))
    .collect();

  // Filter out forgotten memories
  memories = memories.filter(m => m.salience >= MIN_SALIENCE);

  // If targeting a specific territory, boost those memories
  if (context.targetTerritoryId) {
    memories = memories.map(m => ({
      ...m,
      _relevanceBoost: m.targetTerritoryId === context.targetTerritoryId ? 50 : 0,
    }));
  }

  // If decision type is provided, boost relevant memory types
  const decisionTypeToMemoryType: Record<string, MemoryType[]> = {
    "war": ["war", "victory", "defeat", "betrayal", "conquest"],
    "diplomacy": ["alliance", "betrayal", "gift", "insult", "trade"],
    "trade": ["trade", "gift", "theft_grudge" as any, "alliance"],
    "alliance": ["alliance", "help", "betrayal", "war"],
    "defense": ["war", "defeat", "conquest", "victory"],
  };

  if (context.decisionType && decisionTypeToMemoryType[context.decisionType]) {
    const relevantTypes = decisionTypeToMemoryType[context.decisionType];
    memories = memories.map(m => ({
      ...m,
      _relevanceBoost: ((m as any)._relevanceBoost || 0) +
        (relevantTypes.includes(m.memoryType) ? 30 : 0),
    }));
  }

  // Sort by relevance score: salience * |emotionalWeight| + boosts
  memories.sort((a, b) => {
    const scoreA = a.salience * (Math.abs(a.emotionalWeight) / 100) + ((a as any)._relevanceBoost || 0);
    const scoreB = b.salience * (Math.abs(b.emotionalWeight) / 100) + ((b as any)._relevanceBoost || 0);
    return scoreB - scoreA;
  });

  return memories.slice(0, limit);
}

/**
 * Get memories about a specific target territory
 */
export async function getMemoriesAboutTerritory(
  ctx: QueryCtx,
  agentId: Id<"agents">,
  targetTerritoryId: Id<"territories">,
  limit: number = 5
): Promise<Doc<"agentMemories">[]> {
  const memories = await ctx.db
    .query("agentMemories")
    .withIndex("by_agent", (q) => q.eq("agentId", agentId))
    .collect();

  return memories
    .filter(m => m.targetTerritoryId === targetTerritoryId && m.salience >= MIN_SALIENCE)
    .sort((a, b) => b.salience - a.salience)
    .slice(0, limit);
}

/**
 * Get the strongest emotional memories (most impactful)
 */
export async function getStrongestMemories(
  ctx: QueryCtx,
  agentId: Id<"agents">,
  limit: number = 5
): Promise<Doc<"agentMemories">[]> {
  const memories = await ctx.db
    .query("agentMemories")
    .withIndex("by_agent", (q) => q.eq("agentId", agentId))
    .collect();

  return memories
    .filter(m => m.salience >= MIN_SALIENCE)
    .sort((a, b) => Math.abs(b.emotionalWeight) - Math.abs(a.emotionalWeight))
    .slice(0, limit);
}

/**
 * Decay memories over time (call each tick)
 * Memories fade unless they're reinforced by being referenced
 */
export async function decayMemories(
  ctx: MutationCtx,
  agentId: Id<"agents">,
  currentTick: number
): Promise<void> {
  const memories = await ctx.db
    .query("agentMemories")
    .withIndex("by_agent", (q) => q.eq("agentId", agentId))
    .collect();

  for (const memory of memories) {
    // Skip already forgotten memories
    if (memory.salience < MIN_SALIENCE) continue;

    // Calculate decay: stronger emotions decay slower
    const emotionalDecayResistance = Math.abs(memory.emotionalWeight) * EMOTIONAL_WEIGHT_FACTOR;
    const decay = Math.max(0, TICK_DECAY - emotionalDecayResistance);

    // Calculate new salience
    const newSalience = Math.max(0, memory.salience - decay);

    // Update if changed significantly
    if (Math.abs(newSalience - memory.salience) > 0.01) {
      await ctx.db.patch(memory._id, { salience: newSalience });
    }
  }
}

/**
 * Reinforce a memory when it's referenced in a decision
 */
export async function reinforceMemory(
  ctx: MutationCtx,
  memoryId: Id<"agentMemories">
): Promise<void> {
  const memory = await ctx.db.get(memoryId);
  if (!memory) return;

  const world = await ctx.db.query("world").first();
  const currentTick = world?.tick || 0;

  await ctx.db.patch(memoryId, {
    salience: Math.min(100, memory.salience + REFERENCE_BOOST),
    timesReferenced: memory.timesReferenced + 1,
    lastReferencedTick: currentTick,
  });
}

/**
 * Calculate the overall emotional attitude toward a territory based on memories
 * Returns a number from -100 (hatred) to +100 (deep affection)
 */
export async function getEmotionalAttitude(
  ctx: QueryCtx,
  agentId: Id<"agents">,
  targetTerritoryId: Id<"territories">
): Promise<number> {
  const memories = await getMemoriesAboutTerritory(ctx, agentId, targetTerritoryId, 20);

  if (memories.length === 0) return 0;

  // Weight emotional attitudes by salience
  let totalWeight = 0;
  let weightedSum = 0;

  for (const memory of memories) {
    const weight = memory.salience / 100;
    weightedSum += memory.emotionalWeight * weight;
    totalWeight += weight;
  }

  return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
}

/**
 * Format memories for inclusion in AI prompts
 */
export function formatMemoriesForPrompt(
  memories: Doc<"agentMemories">[],
  currentTick: number
): string {
  if (memories.length === 0) {
    return "No significant memories yet. Your history is just beginning.";
  }

  const lines: string[] = [];

  for (const memory of memories) {
    const ticksAgo = currentTick - memory.tick;
    const yearsAgo = Math.floor(ticksAgo / 12);
    const timeStr = yearsAgo > 0 ? `${yearsAgo} year${yearsAgo > 1 ? 's' : ''} ago` : `${ticksAgo} month${ticksAgo > 1 ? 's' : ''} ago`;

    // Determine emotional intensity description
    const intensity = Math.abs(memory.emotionalWeight);
    const isPositive = memory.emotionalWeight > 0;
    let emotionalDesc: string;

    if (intensity >= 80) {
      emotionalDesc = isPositive ? "CHERISHED MEMORY" : "TRAUMATIC MEMORY";
    } else if (intensity >= 60) {
      emotionalDesc = isPositive ? "FOND MEMORY" : "PAINFUL MEMORY";
    } else if (intensity >= 40) {
      emotionalDesc = isPositive ? "Good memory" : "Bad memory";
    } else if (intensity >= 20) {
      emotionalDesc = isPositive ? "Pleasant" : "Unpleasant";
    } else {
      emotionalDesc = "Fading memory";
    }

    // Determine vividness based on salience
    let vividness: string;
    if (memory.salience >= 80) {
      vividness = "VIVID";
    } else if (memory.salience >= 50) {
      vividness = "Clear";
    } else if (memory.salience >= MIN_SALIENCE) {
      vividness = "Fading";
    } else {
      vividness = "Almost forgotten";
    }

    const typeLabel = memory.memoryType.toUpperCase().replace('_', ' ');
    lines.push(`- [${timeStr}] ${typeLabel}: "${memory.description}" (${emotionalDesc}, ${vividness})`);
  }

  return lines.join("\n");
}

/**
 * Get summary statistics about an agent's memories
 */
export async function getMemoryStats(
  ctx: QueryCtx,
  agentId: Id<"agents">
): Promise<{
  totalMemories: number;
  activeMemories: number;
  positiveMemories: number;
  negativeMemories: number;
  averageSalience: number;
  mostReferencedType: MemoryType | null;
}> {
  const memories = await ctx.db
    .query("agentMemories")
    .withIndex("by_agent", (q) => q.eq("agentId", agentId))
    .collect();

  const activeMemories = memories.filter(m => m.salience >= MIN_SALIENCE);
  const positiveMemories = activeMemories.filter(m => m.emotionalWeight > 0);
  const negativeMemories = activeMemories.filter(m => m.emotionalWeight < 0);

  // Count memory types
  const typeCounts: Record<string, number> = {};
  for (const memory of activeMemories) {
    typeCounts[memory.memoryType] = (typeCounts[memory.memoryType] || 0) + 1;
  }

  const mostReferencedType = Object.entries(typeCounts)
    .sort(([, a], [, b]) => b - a)[0]?.[0] as MemoryType | null;

  const averageSalience = activeMemories.length > 0
    ? activeMemories.reduce((sum, m) => sum + m.salience, 0) / activeMemories.length
    : 0;

  return {
    totalMemories: memories.length,
    activeMemories: activeMemories.length,
    positiveMemories: positiveMemories.length,
    negativeMemories: negativeMemories.length,
    averageSalience: Math.round(averageSalience),
    mostReferencedType,
  };
}
