import { MutationCtx, QueryCtx } from "../_generated/server";
import { Id, Doc } from "../_generated/dataModel";
import { recordMemory } from "./memory";

// =============================================
// ORGANIC AI GROWTH - EMERGENT GOALS SYSTEM
// =============================================
// AIs develop personal motivations beyond survival based on their experiences.

// Goal type definitions
export type GoalType =
  // Revenge goals
  | "avenge_defeat"     // Avenge a major military defeat
  | "avenge_betrayal"   // Punish a betrayer
  | "reclaim_territory" // Take back lost lands
  // Protection goals
  | "protect_ally"      // Defend a grateful ally
  | "secure_borders"    // Build impenetrable defenses
  | "eliminate_threat"  // Remove an existential threat
  // Legacy goals
  | "build_wonder"      // Create something lasting
  | "spread_culture"    // Cultural dominance
  | "forge_empire"      // Build the greatest civilization
  | "achieve_peace"     // End all wars
  // Survival goals
  | "escape_elimination"// Survive near-death
  | "recover_prosperity";// Return to former glory

// Goal status
export type GoalStatus = "active" | "achieved" | "abandoned" | "impossible";

// Goal structure (matches schema)
export interface EmergentGoal {
  goalType: GoalType;
  targetTerritoryId?: Id<"territories">;
  targetDescription?: string;
  originTick: number;
  originReason: string;
  originMemoryId?: Id<"agentMemories">;
  progress: number;
  priority: number;
  status: GoalStatus;
  achievedAtTick?: number;
  achievementDescription?: string;
}

// Goal trigger thresholds
const GOAL_TRIGGERS = {
  // Survival triggers
  ELIMINATION_POPULATION_THRESHOLD: 5,   // Below this triggers escape_elimination
  PROSPERITY_LOSS_THRESHOLD: 0.3,        // Pop below 30% of peak triggers recovery

  // Revenge triggers
  DEFEAT_MILITARY_LOSS_THRESHOLD: 0.3,   // Lost 30% military triggers avenge_defeat
  BETRAYAL_TRUST_DROP_THRESHOLD: -40,    // Trust drop of 40+ triggers avenge_betrayal

  // Protection triggers
  ALLY_HELP_THRESHOLD: 50,               // Helped with 50+ value triggers protect_ally
  INVASION_COUNT_THRESHOLD: 3,           // Invaded 3+ times triggers secure_borders
  THREAT_POWER_RATIO: 1.5,               // Enemy 1.5x stronger triggers eliminate_threat

  // Legacy triggers
  PROSPERITY_TIER_THRESHOLD: 4,          // Tier 4+ can trigger legacy goals
  INFLUENCE_THRESHOLD: 80,               // High influence can trigger spread_culture
  HIGH_RELIGIOSITY_THRESHOLD: 70,        // Religious civs more likely to spread_culture
};

// Priority weights
const BASE_PRIORITIES: Record<GoalType, number> = {
  escape_elimination: 90,    // Survival is paramount
  recover_prosperity: 70,
  avenge_defeat: 65,
  avenge_betrayal: 60,
  eliminate_threat: 55,
  protect_ally: 50,
  secure_borders: 50,
  reclaim_territory: 45,
  forge_empire: 40,
  spread_culture: 35,
  build_wonder: 30,
  achieve_peace: 35,
};

/**
 * Check if conditions warrant creating a new goal
 */
export async function checkForGoalTriggers(
  ctx: MutationCtx,
  agentId: Id<"agents">,
  territory: Doc<"territories">,
  recentMemories: Doc<"agentMemories">[]
): Promise<void> {
  const agent = await ctx.db.get(agentId);
  if (!agent) return;

  const world = await ctx.db.query("world").first();
  const currentTick = world?.tick || 0;

  const existingGoals = agent.emergentGoals || [];

  // Don't create duplicate active goals of the same type
  const activeGoalTypes = new Set(
    existingGoals.filter(g => g.status === "active").map(g => g.goalType)
  );

  const newGoals: EmergentGoal[] = [];

  // === SURVIVAL TRIGGERS ===

  // 1. Near elimination - highest priority
  if (territory.population < GOAL_TRIGGERS.ELIMINATION_POPULATION_THRESHOLD && !activeGoalTypes.has("escape_elimination")) {
    newGoals.push({
      goalType: "escape_elimination",
      originTick: currentTick,
      originReason: `Population critically low at ${territory.population}. Survival is at stake.`,
      progress: 0,
      priority: BASE_PRIORITIES.escape_elimination,
      status: "active",
    });
  }

  // 2. Check for major defeats in recent memories
  const defeatMemories = recentMemories.filter(m =>
    m.memoryType === "defeat" && m.emotionalWeight < -50
  );
  for (const defeat of defeatMemories) {
    if (defeat.targetTerritoryId && !activeGoalTypes.has("avenge_defeat")) {
      newGoals.push({
        goalType: "avenge_defeat",
        targetTerritoryId: defeat.targetTerritoryId,
        targetDescription: "the ones who defeated us",
        originTick: currentTick,
        originReason: defeat.description,
        originMemoryId: defeat._id,
        progress: 0,
        priority: BASE_PRIORITIES.avenge_defeat + Math.abs(defeat.emotionalWeight) / 10,
        status: "active",
      });
      activeGoalTypes.add("avenge_defeat");
    }
  }

  // 3. Check for betrayals
  const betrayalMemories = recentMemories.filter(m =>
    m.memoryType === "betrayal" && m.emotionalWeight < -40
  );
  for (const betrayal of betrayalMemories) {
    if (betrayal.targetTerritoryId && !activeGoalTypes.has("avenge_betrayal")) {
      newGoals.push({
        goalType: "avenge_betrayal",
        targetTerritoryId: betrayal.targetTerritoryId,
        targetDescription: "the betrayers",
        originTick: currentTick,
        originReason: betrayal.description,
        originMemoryId: betrayal._id,
        progress: 0,
        priority: BASE_PRIORITIES.avenge_betrayal + Math.abs(betrayal.emotionalWeight) / 10,
        status: "active",
      });
      activeGoalTypes.add("avenge_betrayal");
    }
  }

  // 4. Check for help received (triggers protect_ally)
  const helpMemories = recentMemories.filter(m =>
    m.memoryType === "help" && m.emotionalWeight > GOAL_TRIGGERS.ALLY_HELP_THRESHOLD
  );
  for (const help of helpMemories) {
    if (help.targetTerritoryId && !activeGoalTypes.has("protect_ally")) {
      newGoals.push({
        goalType: "protect_ally",
        targetTerritoryId: help.targetTerritoryId,
        targetDescription: "our saviors",
        originTick: currentTick,
        originReason: help.description,
        originMemoryId: help._id,
        progress: 0,
        priority: BASE_PRIORITIES.protect_ally + help.emotionalWeight / 10,
        status: "active",
      });
      activeGoalTypes.add("protect_ally");
    }
  }

  // 5. Check personality for cultural spread (high religiosity)
  if (agent.personalityParams) {
    const religiosity = agent.personalityParams.religiosity || 50;
    if (religiosity >= GOAL_TRIGGERS.HIGH_RELIGIOSITY_THRESHOLD &&
        territory.influence >= GOAL_TRIGGERS.INFLUENCE_THRESHOLD &&
        !activeGoalTypes.has("spread_culture")) {
      newGoals.push({
        goalType: "spread_culture",
        originTick: currentTick,
        originReason: `With influence at ${territory.influence.toFixed(0)} and strong faith, spreading our culture becomes a calling.`,
        progress: 0,
        priority: BASE_PRIORITIES.spread_culture + religiosity / 5,
        status: "active",
      });
    }
  }

  // 6. Check prosperity tier for legacy goals
  const prosperity = await ctx.db
    .query("prosperityTiers")
    .withIndex("by_territory", (q) => q.eq("territoryId", territory._id))
    .first();

  if (prosperity && prosperity.currentTier >= GOAL_TRIGGERS.PROSPERITY_TIER_THRESHOLD) {
    // High prosperity can trigger forge_empire or achieve_peace
    if (!activeGoalTypes.has("forge_empire") && !activeGoalTypes.has("achieve_peace")) {
      // Aggressive civs go for empire, peaceful ones for peace
      const aggression = agent.personalityParams?.aggression || 50;
      if (aggression >= 60) {
        newGoals.push({
          goalType: "forge_empire",
          originTick: currentTick,
          originReason: `Prosperity at tier ${prosperity.currentTier}. The time has come to build an empire.`,
          progress: 0,
          priority: BASE_PRIORITIES.forge_empire,
          status: "active",
        });
      } else if (aggression <= 40) {
        newGoals.push({
          goalType: "achieve_peace",
          originTick: currentTick,
          originReason: `Prosperity at tier ${prosperity.currentTier}. Perhaps lasting peace is possible.`,
          progress: 0,
          priority: BASE_PRIORITIES.achieve_peace,
          status: "active",
        });
      }
    }
  }

  // 7. Check for invasion count (triggers secure_borders)
  const warMemories = recentMemories.filter(m => m.memoryType === "war" && m.emotionalWeight < 0);
  if (warMemories.length >= GOAL_TRIGGERS.INVASION_COUNT_THRESHOLD && !activeGoalTypes.has("secure_borders")) {
    newGoals.push({
      goalType: "secure_borders",
      originTick: currentTick,
      originReason: `Invaded ${warMemories.length} times. Defenses must be strengthened.`,
      progress: 0,
      priority: BASE_PRIORITIES.secure_borders + warMemories.length * 5,
      status: "active",
    });
  }

  // Save new goals
  if (newGoals.length > 0) {
    const updatedGoals = [...existingGoals, ...newGoals];
    await ctx.db.patch(agentId, { emergentGoals: updatedGoals });
  }
}

/**
 * Update goal progress based on current state
 */
export async function updateGoalProgress(
  ctx: MutationCtx,
  agentId: Id<"agents">,
  territory: Doc<"territories">
): Promise<void> {
  const agent = await ctx.db.get(agentId);
  if (!agent || !agent.emergentGoals) return;

  const updatedGoals = [...agent.emergentGoals];
  let changed = false;

  for (let i = 0; i < updatedGoals.length; i++) {
    const goal = updatedGoals[i];
    if (goal.status !== "active") continue;

    let newProgress = goal.progress;

    switch (goal.goalType) {
      case "escape_elimination":
        // Progress based on population recovery
        newProgress = Math.min(100, (territory.population / 20) * 100);
        break;

      case "recover_prosperity":
        // Progress based on returning to prosperity
        const prosperity = await ctx.db
          .query("prosperityTiers")
          .withIndex("by_territory", (q) => q.eq("territoryId", territory._id))
          .first();
        newProgress = prosperity ? (prosperity.currentTier / 3) * 100 : 0;
        break;

      case "secure_borders":
        // Progress based on fortification level
        const fort = await ctx.db
          .query("fortifications")
          .withIndex("by_territory", (q) => q.eq("territoryId", territory._id))
          .first();
        const fortLevel = fort ? fort.level : 0;
        newProgress = Math.min(100, (fortLevel / 4) * 100);
        break;

      case "forge_empire":
        // Progress based on domination victory progress
        const allTerritories = await ctx.db.query("territories").collect();
        const totalPop = allTerritories.reduce((sum, t) => sum + t.population, 0);
        const popPercent = totalPop > 0 ? (territory.population / totalPop) * 100 : 0;
        newProgress = Math.min(100, (popPercent / 60) * 100); // 60% needed for domination
        break;

      case "spread_culture":
        // Progress based on influence
        newProgress = Math.min(100, (territory.influence / 200) * 100);
        break;

      case "achieve_peace":
        // Progress based on number of allies and absence of wars
        const relationships = await ctx.db
          .query("relationships")
          .withIndex("by_territory1", (q) => q.eq("territory1Id", territory._id))
          .collect();
        const relationships2 = await ctx.db
          .query("relationships")
          .withIndex("by_territory2", (q) => q.eq("territory2Id", territory._id))
          .collect();
        const allRels = [...relationships, ...relationships2];
        const allies = allRels.filter(r => r.hasAlliance).length;
        const wars = allRels.filter(r => r.status === "at_war").length;

        if (wars > 0) {
          newProgress = 0;
        } else {
          newProgress = Math.min(100, (allies / 3) * 100);
        }
        break;

      case "avenge_defeat":
      case "avenge_betrayal":
      case "eliminate_threat":
        // Progress based on target's decline
        if (goal.targetTerritoryId) {
          const target = await ctx.db.get(goal.targetTerritoryId);
          if (target) {
            if ((target as any).isEliminated) {
              newProgress = 100;
            } else {
              // Compare relative power
              const ourPower = territory.military + territory.population;
              const theirPower = target.military + target.population;
              if (ourPower > theirPower) {
                newProgress = Math.min(90, 50 + ((ourPower - theirPower) / theirPower) * 40);
              }
            }
          }
        }
        break;

      case "protect_ally":
        // Check if ally is thriving
        if (goal.targetTerritoryId) {
          const ally = await ctx.db.get(goal.targetTerritoryId);
          if (ally && !(ally as any).isEliminated) {
            // Ally surviving = progress
            newProgress = Math.min(100, 50 + (ally.happiness / 2));
          } else if (ally && (ally as any).isEliminated) {
            // Ally eliminated = failure
            updatedGoals[i] = { ...goal, status: "impossible" };
            changed = true;
            continue;
          }
        }
        break;
    }

    if (newProgress !== goal.progress) {
      updatedGoals[i] = { ...goal, progress: Math.min(100, newProgress) };
      changed = true;
    }
  }

  if (changed) {
    await ctx.db.patch(agentId, { emergentGoals: updatedGoals });
  }
}

/**
 * Check if any goals have been achieved
 */
export async function checkGoalAchievement(
  ctx: MutationCtx,
  agentId: Id<"agents">
): Promise<string[]> {
  const agent = await ctx.db.get(agentId);
  if (!agent || !agent.emergentGoals) return [];

  const world = await ctx.db.query("world").first();
  const currentTick = world?.tick || 0;

  const updatedGoals = [...agent.emergentGoals];
  const achievements: string[] = [];
  let changed = false;

  for (let i = 0; i < updatedGoals.length; i++) {
    const goal = updatedGoals[i];
    if (goal.status !== "active") continue;

    // Check achievement conditions
    let achieved = false;
    let achievementDesc = "";

    switch (goal.goalType) {
      case "escape_elimination":
        if (goal.progress >= 100) {
          achieved = true;
          achievementDesc = "We have survived our darkest hour. The civilization lives on.";
        }
        break;

      case "recover_prosperity":
        if (goal.progress >= 100) {
          achieved = true;
          achievementDesc = "We have returned to prosperity. Our former glory is restored.";
        }
        break;

      case "secure_borders":
        if (goal.progress >= 100) {
          achieved = true;
          achievementDesc = "Our borders are now impenetrable. We stand defended.";
        }
        break;

      case "forge_empire":
        if (goal.progress >= 100) {
          achieved = true;
          achievementDesc = "We have forged a great empire. Our dominion is supreme.";
        }
        break;

      case "spread_culture":
        if (goal.progress >= 100) {
          achieved = true;
          achievementDesc = "Our culture has spread across the world. Our influence is eternal.";
        }
        break;

      case "achieve_peace":
        if (goal.progress >= 100) {
          achieved = true;
          achievementDesc = "We have achieved lasting peace. War is no more.";
        }
        break;

      case "avenge_defeat":
      case "avenge_betrayal":
      case "eliminate_threat":
        if (goal.progress >= 100) {
          achieved = true;
          achievementDesc = `Vengeance is ours. ${goal.targetDescription || "The enemy"} has been defeated.`;
        }
        break;

      case "protect_ally":
        // Ongoing goal - check if ally survives long enough
        if (goal.progress >= 80) {
          achieved = true;
          achievementDesc = `We have protected our ally. They thrive because of our support.`;
        }
        break;
    }

    if (achieved) {
      updatedGoals[i] = {
        ...goal,
        status: "achieved",
        achievedAtTick: currentTick,
        achievementDescription: achievementDesc,
      };
      achievements.push(`GOAL ACHIEVED: ${goal.goalType.replace(/_/g, " ").toUpperCase()} - ${achievementDesc}`);
      changed = true;

      // =============================================
      // ORGANIC AI GROWTH - Record victory memory
      // =============================================
      // Goal achievements are significant victories that should be remembered
      const emotionalWeight = goal.goalType.includes("avenge") ? 70 : 60; // Revenge is sweeter
      await recordMemory(ctx, agentId, {
        type: "victory",
        targetTerritoryId: goal.targetTerritoryId,
        description: `We achieved our goal: ${goal.goalType.replace(/_/g, " ")}! ${achievementDesc}`,
        emotionalWeight, // Strong positive memory
      });
    }
  }

  if (changed) {
    await ctx.db.patch(agentId, { emergentGoals: updatedGoals });
  }

  return achievements;
}

/**
 * Abandon impossible goals
 */
export async function pruneImpossibleGoals(
  ctx: MutationCtx,
  agentId: Id<"agents">
): Promise<void> {
  const agent = await ctx.db.get(agentId);
  if (!agent || !agent.emergentGoals) return;

  const updatedGoals = [...agent.emergentGoals];
  let changed = false;

  for (let i = 0; i < updatedGoals.length; i++) {
    const goal = updatedGoals[i];
    if (goal.status !== "active") continue;

    // Check if target territory was eliminated
    if (goal.targetTerritoryId) {
      const target = await ctx.db.get(goal.targetTerritoryId);
      if (!target) {
        // Target no longer exists
        if (["protect_ally"].includes(goal.goalType)) {
          updatedGoals[i] = { ...goal, status: "impossible" };
          changed = true;
        } else if (["avenge_defeat", "avenge_betrayal", "eliminate_threat"].includes(goal.goalType)) {
          // Revenge goals are achieved if target is gone
          updatedGoals[i] = { ...goal, status: "achieved", achievementDescription: "Target no longer exists." };
          changed = true;
        }
      }
    }

    // Goals older than 200 ticks with low progress might be abandoned
    const world = await ctx.db.query("world").first();
    const ticksActive = (world?.tick || 0) - goal.originTick;
    if (ticksActive > 200 && goal.progress < 20) {
      updatedGoals[i] = { ...goal, status: "abandoned" };
      changed = true;
    }
  }

  if (changed) {
    await ctx.db.patch(agentId, { emergentGoals: updatedGoals });
  }
}

/**
 * Format goals for inclusion in AI prompts
 */
export function formatGoalsForPrompt(
  goals: EmergentGoal[],
  currentTick: number
): string {
  const activeGoals = goals.filter(g => g.status === "active");

  if (activeGoals.length === 0) {
    return "No specific goals beyond survival and prosperity.";
  }

  // Sort by priority
  activeGoals.sort((a, b) => b.priority - a.priority);

  const lines: string[] = [];

  for (const goal of activeGoals) {
    const ticksSinceOrigin = currentTick - goal.originTick;
    const yearsActive = Math.floor(ticksSinceOrigin / 12);
    const ageStr = yearsActive > 0 ? `${yearsActive} year${yearsActive > 1 ? 's' : ''} old` : "new";

    const goalName = goal.goalType.replace(/_/g, " ").toUpperCase();
    const progressBar = generateProgressBar(goal.progress);

    let line = `${goal.priority >= 70 ? "**" : ""}${goalName}${goal.priority >= 70 ? "**" : ""} (Priority: ${goal.priority})`;
    line += `\n   ${goal.targetDescription ? `Target: ${goal.targetDescription}` : ""}`;
    line += `\n   Progress: ${progressBar} ${goal.progress.toFixed(0)}%`;
    line += `\n   Origin (${ageStr}): "${goal.originReason}"`;

    lines.push(line);
  }

  return lines.join("\n\n");
}

/**
 * Generate a simple progress bar
 */
function generateProgressBar(progress: number): string {
  const filled = Math.round(progress / 10);
  const empty = 10 - filled;
  return "[" + "█".repeat(filled) + "░".repeat(empty) + "]";
}

/**
 * Get the highest priority active goal
 */
export function getTopGoal(goals: EmergentGoal[]): EmergentGoal | null {
  const activeGoals = goals.filter(g => g.status === "active");
  if (activeGoals.length === 0) return null;

  return activeGoals.reduce((top, current) =>
    current.priority > top.priority ? current : top
  );
}

/**
 * Get goals targeting a specific territory
 */
export function getGoalsTargeting(
  goals: EmergentGoal[],
  targetTerritoryId: Id<"territories">
): EmergentGoal[] {
  return goals.filter(g =>
    g.status === "active" && g.targetTerritoryId === targetTerritoryId
  );
}
