import { MutationCtx, QueryCtx } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";

// =============================================
// PROFESSION SKILLS FOR SPECIALIZED ACTIONS
// =============================================
// Not just anyone can build a well or perform surgery.
// Civilizations need workers with the right skills.
// Skills are developed through:
// - Profession experience (working in the field)
// - Education (schools, libraries, tutors)
// - Apprenticeship (learning from masters)
// - Passed down from previous generations (via education)

// =============================================
// SKILL REQUIREMENTS FOR ACTIONS
// =============================================

export interface SkillRequirement {
  skillType: string;        // The skill needed
  minLevel: number;         // Minimum skill level (0-100)
  preferredProfession?: string;  // Profession most likely to have this skill
}

export interface ActionSkillRequirements {
  actionId: string;
  description: string;
  requirements: SkillRequirement[];
  minWorkersNeeded: number;  // How many skilled workers needed
  successBonus: number;      // Extra success % per skill point above minimum
}

// Actions that require specific skills
export const ACTION_SKILL_REQUIREMENTS: ActionSkillRequirements[] = [
  // =============================================
  // WATER INFRASTRUCTURE
  // =============================================
  {
    actionId: "dig_well",
    description: "Digging a well requires knowledge of where to dig and construction skills",
    requirements: [
      { skillType: "masonry", minLevel: 20, preferredProfession: "mason" },
      { skillType: "engineering", minLevel: 15, preferredProfession: "engineer" },
    ],
    minWorkersNeeded: 2,
    successBonus: 0.5,  // +0.5% success per skill point above min
  },
  {
    actionId: "build_cistern",
    description: "Building water storage requires advanced construction knowledge",
    requirements: [
      { skillType: "masonry", minLevel: 40, preferredProfession: "mason" },
      { skillType: "engineering", minLevel: 30, preferredProfession: "engineer" },
    ],
    minWorkersNeeded: 3,
    successBonus: 0.3,
  },
  {
    actionId: "build_aqueduct",
    description: "Aqueducts require sophisticated engineering",
    requirements: [
      { skillType: "masonry", minLevel: 60, preferredProfession: "mason" },
      { skillType: "engineering", minLevel: 70, preferredProfession: "engineer" },
      { skillType: "mathematics", minLevel: 40, preferredProfession: "scholar" },
    ],
    minWorkersNeeded: 10,
    successBonus: 0.2,
  },

  // =============================================
  // SANITATION INFRASTRUCTURE
  // =============================================
  {
    actionId: "build_latrine",
    description: "Basic sanitation requires carpentry and planning",
    requirements: [
      { skillType: "carpentry", minLevel: 15, preferredProfession: "carpenter" },
    ],
    minWorkersNeeded: 1,
    successBonus: 1.0,
  },
  {
    actionId: "build_sewer",
    description: "Sewer systems require advanced engineering",
    requirements: [
      { skillType: "masonry", minLevel: 50, preferredProfession: "mason" },
      { skillType: "engineering", minLevel: 60, preferredProfession: "engineer" },
    ],
    minWorkersNeeded: 8,
    successBonus: 0.2,
  },

  // =============================================
  // FOOD PRESERVATION
  // =============================================
  {
    actionId: "build_smokehouse",
    description: "Smokehouses require carpentry and fire management",
    requirements: [
      { skillType: "carpentry", minLevel: 25, preferredProfession: "carpenter" },
      { skillType: "farming", minLevel: 20, preferredProfession: "farmer" },
    ],
    minWorkersNeeded: 2,
    successBonus: 0.5,
  },
  {
    actionId: "preserve_food",
    description: "Food preservation requires knowledge of salting and smoking",
    requirements: [
      { skillType: "farming", minLevel: 30, preferredProfession: "farmer" },
    ],
    minWorkersNeeded: 1,
    successBonus: 0.8,
  },

  // =============================================
  // MEDICINE
  // =============================================
  {
    actionId: "gather_herbs",
    description: "Identifying medicinal herbs requires training",
    requirements: [
      { skillType: "medicine", minLevel: 15, preferredProfession: "physician" },
    ],
    minWorkersNeeded: 1,
    successBonus: 1.0,
  },
  {
    actionId: "treat_wounds",
    description: "Wound treatment requires medical knowledge",
    requirements: [
      { skillType: "medicine", minLevel: 25, preferredProfession: "physician" },
    ],
    minWorkersNeeded: 1,
    successBonus: 0.8,
  },
  {
    actionId: "train_healer",
    description: "Training healers requires advanced medical knowledge",
    requirements: [
      { skillType: "medicine", minLevel: 50, preferredProfession: "physician" },
      { skillType: "literacy", minLevel: 30, preferredProfession: "scholar" },
    ],
    minWorkersNeeded: 1,
    successBonus: 0.3,
  },
  {
    actionId: "perform_surgery",
    description: "Surgery requires exceptional medical skill",
    requirements: [
      { skillType: "medicine", minLevel: 75, preferredProfession: "physician" },
      { skillType: "literacy", minLevel: 40, preferredProfession: "scholar" },
    ],
    minWorkersNeeded: 1,
    successBonus: 0.2,
  },

  // =============================================
  // CLOTHING
  // =============================================
  {
    actionId: "make_clothing",
    description: "Making quality clothing requires tailoring skills",
    requirements: [
      { skillType: "tailoring", minLevel: 20, preferredProfession: "weaver" },
    ],
    minWorkersNeeded: 1,
    successBonus: 1.0,
  },
  {
    actionId: "build_loom",
    description: "Building a loom requires carpentry",
    requirements: [
      { skillType: "carpentry", minLevel: 35, preferredProfession: "carpenter" },
    ],
    minWorkersNeeded: 1,
    successBonus: 0.5,
  },

  // =============================================
  // SHELTER & CONSTRUCTION
  // =============================================
  {
    actionId: "build_houses",
    description: "Building permanent housing requires construction skills",
    requirements: [
      { skillType: "carpentry", minLevel: 30, preferredProfession: "carpenter" },
      { skillType: "masonry", minLevel: 25, preferredProfession: "mason" },
    ],
    minWorkersNeeded: 3,
    successBonus: 0.4,
  },
  {
    actionId: "build_stone_buildings",
    description: "Stone construction requires masonry expertise",
    requirements: [
      { skillType: "masonry", minLevel: 55, preferredProfession: "mason" },
      { skillType: "engineering", minLevel: 40, preferredProfession: "engineer" },
    ],
    minWorkersNeeded: 5,
    successBonus: 0.3,
  },
  {
    actionId: "build_walls",
    description: "Defensive walls require significant construction expertise",
    requirements: [
      { skillType: "masonry", minLevel: 60, preferredProfession: "mason" },
      { skillType: "engineering", minLevel: 50, preferredProfession: "engineer" },
    ],
    minWorkersNeeded: 10,
    successBonus: 0.2,
  },

  // =============================================
  // METALWORKING
  // =============================================
  {
    actionId: "forge_tools",
    description: "Making metal tools requires smithing",
    requirements: [
      { skillType: "smithing", minLevel: 30, preferredProfession: "blacksmith" },
    ],
    minWorkersNeeded: 1,
    successBonus: 0.5,
  },
  {
    actionId: "forge_weapons",
    description: "Forging weapons requires skilled smithing",
    requirements: [
      { skillType: "smithing", minLevel: 45, preferredProfession: "blacksmith" },
    ],
    minWorkersNeeded: 1,
    successBonus: 0.3,
  },
  {
    actionId: "forge_armor",
    description: "Making armor requires expert smithing",
    requirements: [
      { skillType: "smithing", minLevel: 60, preferredProfession: "blacksmith" },
    ],
    minWorkersNeeded: 1,
    successBonus: 0.2,
  },

  // =============================================
  // KNOWLEDGE & EDUCATION
  // =============================================
  {
    actionId: "establish_school",
    description: "Creating a school requires educated teachers",
    requirements: [
      { skillType: "literacy", minLevel: 50, preferredProfession: "teacher" },
      { skillType: "mathematics", minLevel: 30, preferredProfession: "scholar" },
    ],
    minWorkersNeeded: 2,
    successBonus: 0.4,
  },
  {
    actionId: "build_library",
    description: "Libraries require literate scholars to organize knowledge",
    requirements: [
      { skillType: "literacy", minLevel: 60, preferredProfession: "scribe" },
      { skillType: "history", minLevel: 40, preferredProfession: "scholar" },
    ],
    minWorkersNeeded: 2,
    successBonus: 0.3,
  },
  {
    actionId: "establish_university",
    description: "Universities require the highest level of scholarship",
    requirements: [
      { skillType: "literacy", minLevel: 75, preferredProfession: "scholar" },
      { skillType: "mathematics", minLevel: 60, preferredProfession: "scholar" },
      { skillType: "engineering", minLevel: 50, preferredProfession: "engineer" },
    ],
    minWorkersNeeded: 5,
    successBonus: 0.2,
  },

  // =============================================
  // INFRASTRUCTURE
  // =============================================
  {
    actionId: "build_road",
    description: "Roads require planning and construction",
    requirements: [
      { skillType: "engineering", minLevel: 25, preferredProfession: "engineer" },
      { skillType: "masonry", minLevel: 20, preferredProfession: "mason" },
    ],
    minWorkersNeeded: 5,
    successBonus: 0.4,
  },
  {
    actionId: "build_bridge",
    description: "Bridges require advanced engineering",
    requirements: [
      { skillType: "engineering", minLevel: 45, preferredProfession: "engineer" },
      { skillType: "carpentry", minLevel: 35, preferredProfession: "carpenter" },
    ],
    minWorkersNeeded: 5,
    successBonus: 0.3,
  },
  {
    actionId: "build_harbor",
    description: "Harbors require maritime engineering knowledge",
    requirements: [
      { skillType: "engineering", minLevel: 50, preferredProfession: "engineer" },
      { skillType: "masonry", minLevel: 40, preferredProfession: "mason" },
    ],
    minWorkersNeeded: 8,
    successBonus: 0.2,
  },
];

// =============================================
// SKILL CHECK FUNCTIONS
// =============================================

/**
 * Get skill requirements for an action
 */
export function getActionRequirements(actionId: string): ActionSkillRequirements | undefined {
  return ACTION_SKILL_REQUIREMENTS.find(a => a.actionId === actionId);
}

/**
 * Check if a territory has workers capable of performing an action
 */
export async function canPerformAction(
  ctx: QueryCtx,
  territoryId: Id<"territories">,
  actionId: string
): Promise<{
  canPerform: boolean;
  reason?: string;
  availableWorkers: number;
  successChance: number;
  missingSkills: string[];
}> {
  const requirements = getActionRequirements(actionId);

  // No requirements = anyone can do it
  if (!requirements) {
    return {
      canPerform: true,
      availableWorkers: 100,
      successChance: 100,
      missingSkills: [],
    };
  }

  // Get all living characters with skills
  const characters = await ctx.db
    .query("characters")
    .withIndex("by_territory", (q: any) => q.eq("territoryId", territoryId))
    .filter((q: any) => q.eq(q.field("isAlive"), true))
    .collect();

  const missingSkills: string[] = [];
  let qualifiedWorkers = 0;
  let totalSkillBonus = 0;

  // Check each requirement
  for (const req of requirements.requirements) {
    let foundQualified = false;
    let bestSkillLevel = 0;

    for (const char of characters) {
      const skills = char.skills;
      if (!skills) continue;

      // Get the skill level for this requirement
      const skillLevel = (skills as any)[req.skillType] || 0;

      if (skillLevel >= req.minLevel) {
        foundQualified = true;
        if (skillLevel > bestSkillLevel) {
          bestSkillLevel = skillLevel;
        }
      }

      // Bonus if they have the preferred profession
      if (char.profession === req.preferredProfession && skillLevel >= req.minLevel) {
        bestSkillLevel = Math.max(bestSkillLevel, skillLevel + 10);
      }
    }

    if (!foundQualified) {
      missingSkills.push(`${req.skillType} (need level ${req.minLevel})`);
    } else {
      qualifiedWorkers++;
      // Bonus for exceeding requirements
      totalSkillBonus += Math.max(0, bestSkillLevel - req.minLevel) * requirements.successBonus;
    }
  }

  // Calculate result
  const canPerform = missingSkills.length === 0 && qualifiedWorkers >= requirements.minWorkersNeeded;
  const baseSuccessChance = canPerform ? 60 : 0;
  const successChance = Math.min(95, baseSuccessChance + totalSkillBonus);

  return {
    canPerform,
    reason: !canPerform
      ? missingSkills.length > 0
        ? `Missing skilled workers: ${missingSkills.join(", ")}`
        : `Need at least ${requirements.minWorkersNeeded} qualified workers`
      : undefined,
    availableWorkers: qualifiedWorkers,
    successChance,
    missingSkills,
  };
}

/**
 * Get the best workers for an action
 */
export async function getBestWorkersForAction(
  ctx: QueryCtx,
  territoryId: Id<"territories">,
  actionId: string
): Promise<Doc<"characters">[]> {
  const requirements = getActionRequirements(actionId);
  if (!requirements) return [];

  const characters = await ctx.db
    .query("characters")
    .withIndex("by_territory", (q: any) => q.eq("territoryId", territoryId))
    .filter((q: any) => q.eq(q.field("isAlive"), true))
    .collect();

  const scoredWorkers: { char: Doc<"characters">; score: number }[] = [];

  for (const char of characters) {
    const skills = char.skills;
    if (!skills) continue;

    let totalScore = 0;
    let meetsAll = true;

    for (const req of requirements.requirements) {
      const skillLevel = (skills as any)[req.skillType] || 0;

      if (skillLevel < req.minLevel) {
        meetsAll = false;
        break;
      }

      totalScore += skillLevel;

      // Bonus for preferred profession
      if (char.profession === req.preferredProfession) {
        totalScore += 20;
      }
    }

    if (meetsAll) {
      scoredWorkers.push({ char, score: totalScore });
    }
  }

  // Sort by score and return top workers
  scoredWorkers.sort((a, b) => b.score - a.score);
  return scoredWorkers.slice(0, requirements.minWorkersNeeded * 2).map(w => w.char);
}

/**
 * Calculate action success with skill modifiers
 */
export async function calculateActionSuccess(
  ctx: QueryCtx,
  territoryId: Id<"territories">,
  actionId: string
): Promise<{
  success: boolean;
  qualityModifier: number;  // 0.5 to 1.5, affects outcome quality
  leadWorkerId?: Id<"characters">;
  experienceGained: { characterId: Id<"characters">; skillType: string; amount: number }[];
}> {
  const check = await canPerformAction(ctx, territoryId, actionId);

  if (!check.canPerform) {
    return {
      success: false,
      qualityModifier: 0,
      experienceGained: [],
    };
  }

  // Roll for success
  const roll = Math.random() * 100;
  const success = roll < check.successChance;

  // Get workers who participated
  const workers = await getBestWorkersForAction(ctx, territoryId, actionId);
  const requirements = getActionRequirements(actionId);

  // Calculate quality modifier based on worker skills
  let qualityModifier = 1.0;
  if (workers.length > 0 && requirements) {
    let totalExcess = 0;
    for (const worker of workers) {
      const skills = worker.skills;
      if (!skills) continue;

      for (const req of requirements.requirements) {
        const skillLevel = (skills as any)[req.skillType] || 0;
        totalExcess += Math.max(0, skillLevel - req.minLevel);
      }
    }
    // Each 10 points of excess adds 0.05 to quality
    qualityModifier = Math.min(1.5, 1.0 + (totalExcess / 200));
  }

  // Experience gained from performing the action
  const experienceGained: { characterId: Id<"characters">; skillType: string; amount: number }[] = [];

  if (success && requirements) {
    for (const worker of workers.slice(0, requirements.minWorkersNeeded)) {
      for (const req of requirements.requirements) {
        // Workers gain 1-3 skill points for successfully using their skills
        experienceGained.push({
          characterId: worker._id,
          skillType: req.skillType,
          amount: 1 + Math.floor(Math.random() * 3),
        });
      }
    }
  }

  return {
    success,
    qualityModifier,
    leadWorkerId: workers[0]?._id,
    experienceGained,
  };
}

/**
 * Apply experience gained from an action to characters
 */
export async function applyExperienceGain(
  ctx: MutationCtx,
  experienceGained: { characterId: Id<"characters">; skillType: string; amount: number }[]
): Promise<void> {
  for (const exp of experienceGained) {
    const char = await ctx.db.get(exp.characterId);
    if (!char || !char.skills) continue;

    const currentLevel = (char.skills as any)[exp.skillType] || 0;
    const newLevel = Math.min(100, currentLevel + exp.amount);

    await ctx.db.patch(exp.characterId, {
      skills: {
        ...char.skills,
        [exp.skillType]: newLevel,
      },
    });
  }
}

/**
 * Get skills summary for AI prompt
 */
export async function getSkillsSummary(
  ctx: QueryCtx,
  territoryId: Id<"territories">
): Promise<string> {
  const characters = await ctx.db
    .query("characters")
    .withIndex("by_territory", (q: any) => q.eq("territoryId", territoryId))
    .filter((q: any) => q.eq(q.field("isAlive"), true))
    .collect();

  // Aggregate skills across all characters
  const skillTotals: Record<string, { count: number; maxLevel: number; avgLevel: number }> = {};

  for (const char of characters) {
    const skills = char.skills;
    if (!skills) continue;

    for (const [skillType, level] of Object.entries(skills)) {
      if (typeof level !== "number" || level <= 0) continue;

      if (!skillTotals[skillType]) {
        skillTotals[skillType] = { count: 0, maxLevel: 0, avgLevel: 0 };
      }

      skillTotals[skillType].count++;
      skillTotals[skillType].maxLevel = Math.max(skillTotals[skillType].maxLevel, level);
      skillTotals[skillType].avgLevel += level;
    }
  }

  // Calculate averages
  for (const skill of Object.values(skillTotals)) {
    if (skill.count > 0) {
      skill.avgLevel = Math.round(skill.avgLevel / skill.count);
    }
  }

  // Format as summary
  const lines: string[] = [];
  const sortedSkills = Object.entries(skillTotals)
    .filter(([, data]) => data.count > 0)
    .sort((a, b) => b[1].maxLevel - a[1].maxLevel);

  for (const [skillType, data] of sortedSkills.slice(0, 10)) {
    const tier = data.maxLevel >= 70 ? "Expert" : data.maxLevel >= 40 ? "Skilled" : "Novice";
    lines.push(`  ${skillType}: ${data.count} workers (best: ${tier}, level ${data.maxLevel})`);
  }

  if (lines.length === 0) {
    return "Your population lacks specialized skills. Build schools and train apprentices!";
  }

  return "Available skilled workers:\n" + lines.join("\n");
}

/**
 * Check what actions are blocked due to missing skills
 */
export async function getBlockedActions(
  ctx: QueryCtx,
  territoryId: Id<"territories">
): Promise<{ actionId: string; reason: string }[]> {
  const blocked: { actionId: string; reason: string }[] = [];

  for (const req of ACTION_SKILL_REQUIREMENTS) {
    const check = await canPerformAction(ctx, territoryId, req.actionId);
    if (!check.canPerform && check.reason) {
      blocked.push({
        actionId: req.actionId,
        reason: check.reason,
      });
    }
  }

  return blocked;
}
