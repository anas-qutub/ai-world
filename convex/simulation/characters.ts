import { internalMutation, query, MutationCtx } from "../_generated/server";
import { v } from "convex/values";
import { Doc, Id } from "../_generated/dataModel";
import { inheritBonds, createBond } from "./bonds";
import { recordMemory } from "./memory";
import { initializeRulerLegitimacy } from "./rulerLegitimacy";
import { DEFAULT_SKILLS, initializeSkills } from "./professions";
import { SKILL_TYPES } from "./collectiveKnowledge";

// =============================================
// CHARACTER NAME GENERATION
// =============================================

const NAME_PREFIXES = [
  "Aelric", "Bjorn", "Cassius", "Draven", "Einar", "Fenris", "Godfrey", "Harald",
  "Ivar", "Jorah", "Kael", "Lucius", "Magnus", "Nikolai", "Odin", "Ragnar",
  "Sigurd", "Theron", "Ulric", "Viktor", "Wulfric", "Xander", "Yorick", "Zephyr",
  "Alaric", "Brennan", "Cedric", "Darius", "Edmund", "Felix", "Gareth", "Hector",
  "Aldara", "Brenna", "Cassandra", "Diana", "Elena", "Freya", "Gwendolyn", "Helena",
  "Isolde", "Jocelyn", "Kira", "Lyra", "Morgana", "Nadia", "Ophelia", "Priscilla",
  "Quinn", "Rowena", "Selena", "Thalia", "Una", "Vivienne", "Wren", "Yara", "Zara",
];

const TITLES = {
  ruler: ["King", "Queen", "Chief", "High Chief", "Lord Protector", "Emperor", "Empress", "Supreme Leader"],
  heir: ["Crown Prince", "Crown Princess", "Heir Apparent", "Prince", "Princess"],
  general: ["General", "War Chief", "Marshal", "Commander", "Warlord"],
  advisor: ["High Advisor", "Chancellor", "Vizier", "Sage", "Oracle", "Minister"],
  rival: ["Lord", "Lady", "Duke", "Duchess", "Count", "Countess"],
  rebel_leader: ["Rebel Leader", "Revolutionary", "Insurgent Chief", "Freedom Fighter"],
};

const DYNASTY_SUFFIXES = [
  "the Great", "the Wise", "the Bold", "the Cruel", "the Cunning", "the Just",
  "the Merciless", "the Peaceful", "the Conqueror", "the Builder", "the Pious",
  "the Magnificent", "the Terrible", "the Fearless", "the Shrewd",
];

// =============================================
// CHARACTER PRIORITIES SYSTEM
// =============================================
// Every human's first instinct is SURVIVAL - this is universal.
// After survival is secured, priorities differ by role/class.
// A ruler and a laborer both need to eat, but after that their concerns diverge.

export type PriorityLevel = "critical" | "high" | "medium" | "low";

export interface CharacterPriority {
  name: string;
  description: string;
  level: PriorityLevel;
  satisfiedWhen: string; // Condition description
}

// Universal survival priorities - EVERYONE has these first
const UNIVERSAL_SURVIVAL_PRIORITIES: CharacterPriority[] = [
  {
    name: "survival_food",
    description: "I need food to survive",
    level: "critical",
    satisfiedWhen: "territory.food > 30",
  },
  {
    name: "survival_shelter",
    description: "I need shelter from the elements",
    level: "critical",
    satisfiedWhen: "territory.shelterCapacity >= territory.population",
  },
  {
    name: "survival_safety",
    description: "I need to feel safe from threats",
    level: "critical",
    satisfiedWhen: "not at war OR territory.military > 30",
  },
];

// Role-specific priorities (after survival is met)
export const CHARACTER_PRIORITIES: Record<string, CharacterPriority[]> = {
  // RULER - Cares about power, legacy, the realm's prosperity
  ruler: [
    ...UNIVERSAL_SURVIVAL_PRIORITIES,
    {
      name: "maintain_power",
      description: "I must maintain my grip on power",
      level: "high",
      satisfiedWhen: "legitimacy > 50 AND no active rebellions",
    },
    {
      name: "legacy",
      description: "I want to be remembered as great",
      level: "high",
      satisfiedWhen: "territory.influence > 50 OR territory.population > 100",
    },
    {
      name: "realm_prosperity",
      description: "My people must prosper for my rule to be secure",
      level: "high",
      satisfiedWhen: "territory.happiness > 50 AND territory.wealth > 40",
    },
    {
      name: "succession",
      description: "I need an heir to continue my dynasty",
      level: "medium",
      satisfiedWhen: "has living heir",
    },
    {
      name: "expansion",
      description: "A great ruler expands their domain",
      level: "medium",
      satisfiedWhen: "territory.influence > 80",
    },
    {
      name: "diplomacy",
      description: "Alliances strengthen my position",
      level: "medium",
      satisfiedWhen: "has at least one alliance",
    },
  ],

  // HEIR - Cares about preparing to rule, proving themselves
  heir: [
    ...UNIVERSAL_SURVIVAL_PRIORITIES,
    {
      name: "prove_worthy",
      description: "I must prove I am worthy to inherit",
      level: "high",
      satisfiedWhen: "has military experience OR high wisdom",
    },
    {
      name: "learn_rulership",
      description: "I must learn the art of ruling",
      level: "high",
      satisfiedWhen: "education level advanced OR has advisor mentor",
    },
    {
      name: "build_support",
      description: "I need allies for when I take power",
      level: "medium",
      satisfiedWhen: "has positive relationships with generals/advisors",
    },
    {
      name: "stay_alive",
      description: "I must survive to inherit (rivals may plot against me)",
      level: "high",
      satisfiedWhen: "no active plots against me",
    },
  ],

  // GENERAL - Cares about military strength, honor, victory
  general: [
    ...UNIVERSAL_SURVIVAL_PRIORITIES,
    {
      name: "military_strength",
      description: "Our army must be strong",
      level: "high",
      satisfiedWhen: "territory.military > 60",
    },
    {
      name: "defend_territory",
      description: "I must protect our lands from invasion",
      level: "high",
      satisfiedWhen: "fortification level adequate OR not at war",
    },
    {
      name: "glory_in_battle",
      description: "I seek honor through victory",
      level: "medium",
      satisfiedWhen: "has recent military victory",
    },
    {
      name: "soldiers_welfare",
      description: "My soldiers must be fed and equipped",
      level: "high",
      satisfiedWhen: "army upkeep is met",
    },
    {
      name: "loyalty_to_ruler",
      description: "I serve at the pleasure of my ruler",
      level: "medium",
      satisfiedWhen: "ruler legitimacy > 40",
    },
  ],

  // ADVISOR - Cares about knowledge, influence, wise counsel
  advisor: [
    ...UNIVERSAL_SURVIVAL_PRIORITIES,
    {
      name: "knowledge",
      description: "Knowledge is power - I must keep learning",
      level: "high",
      satisfiedWhen: "territory.knowledge > 50 OR has library",
    },
    {
      name: "influence_ruler",
      description: "My counsel must be heard and heeded",
      level: "high",
      satisfiedWhen: "ruler follows advice frequently",
    },
    {
      name: "realm_stability",
      description: "A stable realm allows for prosperity",
      level: "medium",
      satisfiedWhen: "happiness > 40 AND no rebellions",
    },
    {
      name: "technological_progress",
      description: "Progress benefits all",
      level: "medium",
      satisfiedWhen: "technology > 30",
    },
  ],

  // RIVAL - Cares about wealth, power, undermining the ruler
  rival: [
    ...UNIVERSAL_SURVIVAL_PRIORITIES,
    {
      name: "accumulate_wealth",
      description: "Wealth is the foundation of power",
      level: "high",
      satisfiedWhen: "personal wealth high",
    },
    {
      name: "build_faction",
      description: "I need supporters for my ambitions",
      level: "high",
      satisfiedWhen: "has faction with 10+ supporters",
    },
    {
      name: "undermine_ruler",
      description: "The current ruler is unfit - I could do better",
      level: "medium",
      satisfiedWhen: "ruler legitimacy < 50",
    },
    {
      name: "seize_opportunity",
      description: "When the moment comes, I must be ready",
      level: "medium",
      satisfiedWhen: "has active plot OR ruler is weak",
    },
  ],

  // COMMONER/WORKER - Cares about basic needs, family, community
  commoner: [
    ...UNIVERSAL_SURVIVAL_PRIORITIES,
    {
      name: "feed_family",
      description: "My family must not go hungry",
      level: "high",
      satisfiedWhen: "territory.food > 50",
    },
    {
      name: "steady_work",
      description: "I need work to provide for my family",
      level: "high",
      satisfiedWhen: "has profession OR unemployment low",
    },
    {
      name: "fair_treatment",
      description: "I want to be treated fairly by those above me",
      level: "medium",
      satisfiedWhen: "territory.happiness > 40",
    },
    {
      name: "community",
      description: "My neighbors and I look out for each other",
      level: "medium",
      satisfiedWhen: "social cohesion high",
    },
    {
      name: "children_future",
      description: "I want a better life for my children",
      level: "medium",
      satisfiedWhen: "has school access",
    },
  ],

  // MERCHANT - Cares about trade, wealth, economic opportunity
  merchant: [
    ...UNIVERSAL_SURVIVAL_PRIORITIES,
    {
      name: "profit",
      description: "Trade must be profitable",
      level: "high",
      satisfiedWhen: "has active trade routes",
    },
    {
      name: "market_access",
      description: "I need access to markets",
      level: "high",
      satisfiedWhen: "has trade agreements",
    },
    {
      name: "guild_standing",
      description: "My reputation in the guild matters",
      level: "medium",
      satisfiedWhen: "guild rank journeyman or higher",
    },
    {
      name: "stable_currency",
      description: "Economic stability helps trade",
      level: "medium",
      satisfiedWhen: "no economic crisis",
    },
  ],

  // PRIEST - Cares about faith, piety, religious influence
  priest: [
    ...UNIVERSAL_SURVIVAL_PRIORITIES,
    {
      name: "spread_faith",
      description: "I must spread the word of the divine",
      level: "high",
      satisfiedWhen: "religion has many followers",
    },
    {
      name: "temple_maintenance",
      description: "The temples must be maintained",
      level: "high",
      satisfiedWhen: "has functioning temple",
    },
    {
      name: "piety_of_people",
      description: "The people must be devout",
      level: "medium",
      satisfiedWhen: "average piety > 40",
    },
    {
      name: "religious_influence",
      description: "Faith should guide the ruler's decisions",
      level: "medium",
      satisfiedWhen: "has state religion",
    },
  ],

  // SCHOLAR - Cares about knowledge, learning, discovery
  scholar: [
    ...UNIVERSAL_SURVIVAL_PRIORITIES,
    {
      name: "pursue_knowledge",
      description: "I live to learn and discover",
      level: "high",
      satisfiedWhen: "territory.knowledge > 60",
    },
    {
      name: "access_to_books",
      description: "I need books and scrolls to study",
      level: "high",
      satisfiedWhen: "has library with books",
    },
    {
      name: "teach_others",
      description: "Knowledge should be shared",
      level: "medium",
      satisfiedWhen: "is teacher OR has students",
    },
    {
      name: "research_funding",
      description: "Research requires resources",
      level: "medium",
      satisfiedWhen: "territory.wealth > 30",
    },
  ],

  // WARRIOR - Cares about strength, combat, honor
  warrior: [
    ...UNIVERSAL_SURVIVAL_PRIORITIES,
    {
      name: "combat_readiness",
      description: "I must always be ready to fight",
      level: "high",
      satisfiedWhen: "has weapons AND good health",
    },
    {
      name: "protect_tribe",
      description: "My strength protects my people",
      level: "high",
      satisfiedWhen: "territory is defended",
    },
    {
      name: "earn_glory",
      description: "Glory in battle brings honor",
      level: "medium",
      satisfiedWhen: "has kills OR battle experience",
    },
    {
      name: "follow_commander",
      description: "I serve my general loyally",
      level: "medium",
      satisfiedWhen: "has assigned general",
    },
  ],

};

// =============================================
// EMERGENT REBELLION - Not a role, but a state
// =============================================
// Rebellion is not a role - it emerges from circumstances.
// Any character can become rebellious based on:
// - Low loyalty to ruler (< 30)
// - High ambition (> 70) + being passed over
// - Personal grievance (family member executed, lands seized)
// - Ideological opposition (ruler's policies violate their values)
// - Economic hardship blamed on ruler
// - Being humiliated or wronged
//
// When evaluating if a character might rebel, check:
// 1. grievances array on character
// 2. loyalty trait < 40
// 3. ambition > 60 AND not in power
// 4. ruler legitimacy < 30 AND character honor > 60

/**
 * Get a character's current priorities based on their role and situation
 * For rebel_leader, priorities are generated dynamically based on WHY they rebelled
 */
export function getCharacterPriorities(
  character: Doc<"characters">,
  territory: Doc<"territories">
): CharacterPriority[] {
  const role = character.profession || character.role || "commoner";

  // Special handling for rebel_leader - priorities based on circumstances, not fixed
  if (role === "rebel_leader") {
    return generateRebelPriorities(character, territory);
  }

  const priorities = CHARACTER_PRIORITIES[role] || CHARACTER_PRIORITIES.commoner;

  // Evaluate which priorities are satisfied vs unmet
  return priorities.map(p => ({
    ...p,
    // Could add dynamic evaluation here based on actual territory state
  }));
}

/**
 * Generate rebel priorities dynamically based on WHY they rebelled
 * Rebellion is emergent - their goals reflect their grievances
 */
function generateRebelPriorities(
  character: Doc<"characters">,
  territory: Doc<"territories">
): CharacterPriority[] {
  const priorities: CharacterPriority[] = [
    // Survival is ALWAYS first, even for rebels
    ...UNIVERSAL_SURVIVAL_PRIORITIES,
  ];

  // Core rebel priority - overthrow the current order
  priorities.push({
    name: "overthrow_ruler",
    description: "The current ruler must fall - by force if necessary",
    level: "high",
    satisfiedWhen: "rebellion succeeds",
  });

  // Add priorities based on character traits and circumstances
  const traits = character.traits;

  // High ambition rebels want power for themselves
  if (traits.ambition > 60) {
    priorities.push({
      name: "seize_power",
      description: "I will take the throne for myself",
      level: "high",
      satisfiedWhen: "becomes ruler",
    });
  }

  // Honorable rebels want justice
  if (traits.honor > 60) {
    priorities.push({
      name: "restore_justice",
      description: "I fight for what is right, not personal gain",
      level: "high",
      satisfiedWhen: "just ruler on throne",
    });
  }

  // Compassionate rebels fight for the people
  if (traits.compassion > 50) {
    priorities.push({
      name: "free_the_people",
      description: "The people suffer under tyranny - I must free them",
      level: "high",
      satisfiedWhen: "people's happiness > 60",
    });
  }

  // Vengeful rebels (high wrath or low loyalty after betrayal)
  if (traits.wrath > 60 || traits.loyalty < 20) {
    priorities.push({
      name: "vengeance",
      description: "I will make them pay for what they did",
      level: "high",
      satisfiedWhen: "target punished or dead",
    });
  }

  // Self-preservation - rebels must stay alive
  priorities.push({
    name: "avoid_capture",
    description: "I must stay hidden from the ruler's hunters",
    level: "high",
    satisfiedWhen: "not captured or in hiding",
  });

  // Build support
  priorities.push({
    name: "gather_supporters",
    description: "I need more people behind my cause",
    level: "medium",
    satisfiedWhen: "rebel faction grows",
  });

  return priorities;
}

/**
 * Get the most urgent unmet priority for a character
 */
export function getMostUrgentPriority(
  character: Doc<"characters">,
  territory: Doc<"territories">
): CharacterPriority | null {
  const priorities = getCharacterPriorities(character, territory);

  // Check survival priorities first (always)
  for (const p of priorities) {
    if (p.level === "critical") {
      // Check if this survival need is unmet
      if (p.name === "survival_food" && territory.food < 30) return p;
      if (p.name === "survival_shelter" && (territory.shelterCapacity || 0) < territory.population) return p;
      if (p.name === "survival_safety" && territory.military < 20) return p;
    }
  }

  // Then check high priorities
  for (const p of priorities) {
    if (p.level === "high") {
      // These would need more complex evaluation based on actual state
      return p; // Return first unmet high priority
    }
  }

  return null;
}

/**
 * Describe a character's priorities in natural language for AI prompts
 */
export function describePriorities(character: Doc<"characters">, territory?: Doc<"territories">): string {
  const role = character.profession || character.role || "commoner";

  // For rebel_leader, use dynamic priorities based on their traits/circumstances
  let priorities: CharacterPriority[];
  if (role === "rebel_leader" && territory) {
    priorities = generateRebelPriorities(character, territory);
  } else {
    priorities = CHARACTER_PRIORITIES[role] || CHARACTER_PRIORITIES.commoner;
  }

  const critical = priorities.filter(p => p.level === "critical").map(p => p.description);
  const high = priorities.filter(p => p.level === "high").map(p => p.description);
  const medium = priorities.filter(p => p.level === "medium").map(p => p.description);

  // Special description for rebels
  if (role === "rebel_leader") {
    const traits = character.traits;
    let rebelType = "revolutionary";
    if (traits.ambition > 70) rebelType = "ambitious usurper";
    else if (traits.honor > 60) rebelType = "righteous rebel";
    else if (traits.compassion > 60) rebelType = "champion of the people";
    else if (traits.wrath > 60) rebelType = "vengeful insurgent";

    return `As a ${rebelType}, ${character.name}'s priorities are:
SURVIVAL (always first): ${critical.join(", ")}
THE CAUSE: ${high.join(", ")}
BUILDING SUPPORT: ${medium.join(", ")}`;
  }

  return `As a ${role}, ${character.name}'s priorities are:
SURVIVAL (always first): ${critical.join(", ")}
PRIMARY CONCERNS: ${high.join(", ")}
SECONDARY CONCERNS: ${medium.join(", ")}`;
}

// =============================================
// TRAIT GENERATION
// =============================================

function randomTrait(min: number = 20, max: number = 80): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomEmotionalState(): Doc<"characters">["emotionalState"] {
  return {
    hope: randomTrait(40, 70),
    fear: randomTrait(10, 40),
    shame: randomTrait(0, 20),
    despair: randomTrait(0, 20),
    contentment: randomTrait(40, 70),
    rage: randomTrait(0, 30),
  };
}

function generateTraits(role: string): Doc<"characters">["traits"] {
  const baseTraits = {
    ambition: randomTrait(),
    greed: randomTrait(),
    loyalty: randomTrait(),
    honor: randomTrait(),
    cruelty: randomTrait(10, 60),
    compassion: randomTrait(),
    justice: randomTrait(),        // Fairness to subjects
    generosity: randomTrait(),     // Willingness to share wealth
    cunning: randomTrait(),
    wisdom: randomTrait(),
    paranoia: randomTrait(10, 50),
    vigilance: randomTrait(),      // Awareness of threats/plots
    courage: randomTrait(),
    pride: randomTrait(),
    wrath: randomTrait(10, 50),
    charisma: randomTrait(),
    diplomacy: randomTrait(),
    strength: randomTrait(20, 60), // Physical/military prowess - starts lower, grows with kills
  };

  // Adjust traits based on role
  switch (role) {
    case "ruler":
      baseTraits.ambition = Math.min(100, baseTraits.ambition + 20);
      baseTraits.charisma = Math.min(100, baseTraits.charisma + 15);
      baseTraits.justice = Math.min(100, baseTraits.justice + 10);
      baseTraits.vigilance = Math.min(100, baseTraits.vigilance + 10);
      break;
    case "heir":
      baseTraits.pride = Math.min(100, baseTraits.pride + 15);
      baseTraits.generosity = Math.min(100, baseTraits.generosity + 10); // Heirs often generous to win favor
      break;
    case "general":
      baseTraits.courage = Math.min(100, baseTraits.courage + 25);
      baseTraits.wrath = Math.min(100, baseTraits.wrath + 15);
      baseTraits.strength = Math.min(100, baseTraits.strength + 25); // Generals are strong fighters
      baseTraits.vigilance = Math.min(100, baseTraits.vigilance + 15);
      break;
    case "advisor":
      baseTraits.wisdom = Math.min(100, baseTraits.wisdom + 20);
      baseTraits.cunning = Math.min(100, baseTraits.cunning + 15);
      baseTraits.vigilance = Math.min(100, baseTraits.vigilance + 10);
      break;
    case "rival":
      baseTraits.ambition = Math.min(100, baseTraits.ambition + 30);
      baseTraits.loyalty = Math.max(0, baseTraits.loyalty - 20);
      break;
    case "rebel_leader":
      baseTraits.courage = Math.min(100, baseTraits.courage + 20);
      baseTraits.loyalty = Math.max(0, baseTraits.loyalty - 30);
      baseTraits.ambition = Math.min(100, baseTraits.ambition + 25);
      baseTraits.strength = Math.min(100, baseTraits.strength + 15); // Rebels are hardened fighters
      break;
  }

  return baseTraits;
}

// =============================================
// SECRET GOAL GENERATION
// =============================================

type SecretGoal = "seize_throne" | "accumulate_wealth" | "revenge" | "protect_family" |
  "foreign_allegiance" | "religious_dominance" | "independence" | "glory" | "none";

function generateSecretGoal(role: string, traits: Doc<"characters">["traits"]): SecretGoal {
  // Probability weighted by traits
  if (role === "ruler") {
    return "none"; // Rulers already have power
  }

  if (traits.ambition > 70 && traits.loyalty < 40) {
    return Math.random() < 0.6 ? "seize_throne" : "independence";
  }

  if (traits.greed > 70) {
    return "accumulate_wealth";
  }

  if (traits.wrath > 60 && Math.random() < 0.3) {
    return "revenge";
  }

  if (traits.compassion > 70) {
    return "protect_family";
  }

  if (traits.pride > 70 && traits.courage > 60) {
    return "glory";
  }

  if (Math.random() < 0.5) {
    return "none";
  }

  const goals: SecretGoal[] = [
    "accumulate_wealth", "protect_family", "glory", "independence", "none"
  ];
  return goals[Math.floor(Math.random() * goals.length)];
}

// =============================================
// SKILL INHERITANCE FROM SOCIETY
// =============================================
// New characters inherit some knowledge from their society.
// Children learn from their community - a civilization of skilled smiths
// produces children who understand the basics of metalworking.

/**
 * Generate initial skills for a new character based on:
 * 1. Parent skills (if known) - 25% inheritance
 * 2. Society average - 10% of community knowledge
 * 3. Social class baseline
 * 4. Random variance for individual talent
 */
async function generateSkillsWithInheritance(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  socialClass: string,
  age: number,
  parentIds?: Id<"characters">[]
): Promise<typeof DEFAULT_SKILLS> {
  // Start with class-based skills
  const skills = initializeSkills(socialClass, age);

  // Get society's collective knowledge
  const populationSkills = await ctx.db
    .query("populationSkills")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .collect();

  const societySkills = new Map(
    populationSkills.map((ps) => [ps.skillType, ps.averageLevel])
  );

  // Apply society bonus - people learn from their community
  // 10% of society average for each skill
  for (const skillType of SKILL_TYPES) {
    const societyAvg = societySkills.get(skillType) || 0;
    const societyBonus = Math.floor(societyAvg * 0.1);

    const currentSkill = skills[skillType as keyof typeof skills] || 0;
    skills[skillType as keyof typeof skills] = Math.min(
      30, // Cap inherited skills at 30 (must develop beyond through practice)
      currentSkill + societyBonus
    );
  }

  // Apply parent inheritance if known (25% of parent skills)
  if (parentIds && parentIds.length > 0) {
    const parents = await Promise.all(
      parentIds.map((id) => ctx.db.get(id))
    );

    const validParents = parents.filter(
      (p): p is NonNullable<typeof p> => p !== null && p.skills !== undefined
    );

    if (validParents.length > 0) {
      for (const skillType of SKILL_TYPES) {
        let parentTotal = 0;
        for (const parent of validParents) {
          const parentSkill = (parent.skills as Record<string, number>)?.[skillType] || 0;
          parentTotal += parentSkill;
        }
        const parentAvg = parentTotal / validParents.length;
        const parentBonus = Math.floor(parentAvg * 0.25);

        const currentSkill = skills[skillType as keyof typeof skills] || 0;
        skills[skillType as keyof typeof skills] = Math.min(
          40, // Parent inheritance can push slightly higher
          currentSkill + parentBonus
        );
      }
    }
  }

  // Add random variance (-5 to +5) for individual talent
  for (const skillType of Object.keys(skills) as (keyof typeof skills)[]) {
    const variance = Math.floor(Math.random() * 11) - 5;
    skills[skillType] = Math.max(0, Math.min(100, skills[skillType] + variance));
  }

  return skills;
}

// =============================================
// CHARACTER CREATION
// =============================================

type CharacterRole = "ruler" | "heir" | "general" | "advisor" | "rival" | "rebel_leader";

export async function createCharacterInternal(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  role: CharacterRole,
  tick: number,
  name?: string,
  dynastyName?: string,
  dynastyGeneration?: number
): Promise<Id<"characters">> {
  const characterName = name || NAME_PREFIXES[Math.floor(Math.random() * NAME_PREFIXES.length)];
  const titles = TITLES[role];
  const title = titles[Math.floor(Math.random() * titles.length)];
  const traits = generateTraits(role);
  const secretGoal = generateSecretGoal(role, traits);

  // Age varies by role
  let age = 30;
  switch (role) {
    case "ruler":
      age = Math.floor(Math.random() * 30) + 30; // 30-60
      break;
    case "heir":
      age = Math.floor(Math.random() * 15) + 15; // 15-30
      break;
    case "general":
      age = Math.floor(Math.random() * 20) + 35; // 35-55
      break;
    case "advisor":
      age = Math.floor(Math.random() * 25) + 40; // 40-65
      break;
    case "rival":
      age = Math.floor(Math.random() * 25) + 25; // 25-50
      break;
    case "rebel_leader":
      age = Math.floor(Math.random() * 20) + 25; // 25-45
      break;
  }

  // Generate skills with society inheritance
  // Map roles to social classes for skill initialization
  const socialClassMap: Record<CharacterRole, string> = {
    ruler: "noble",
    heir: "noble",
    general: "warrior",
    advisor: "noble",
    rival: "noble",
    rebel_leader: "warrior",
  };
  const socialClass = socialClassMap[role];
  const skills = await generateSkillsWithInheritance(
    ctx,
    territoryId,
    socialClass,
    age
  );

  const characterId = await ctx.db.insert("characters", {
    territoryId,
    name: characterName,
    title,
    role,
    birthTick: tick - (age * 12), // Convert years to ticks (months)
    isAlive: true,
    age,
    traits,
    emotionalState: randomEmotionalState(),
    secretGoal,
    relationships: [],
    activePlots: [],
    dynastyName,
    dynastyGeneration,
    coronationTick: role === "ruler" ? tick : undefined,
    deeds: [],
    skills, // Skills inherited from society
  });

  return characterId;
}

// Keep the internalMutation wrapper for external calls
export const createCharacter = internalMutation({
  args: {
    territoryId: v.id("territories"),
    role: v.union(
      v.literal("ruler"),
      v.literal("heir"),
      v.literal("general"),
      v.literal("advisor"),
      v.literal("rival"),
      v.literal("rebel_leader")
    ),
    name: v.optional(v.string()),
    tick: v.number(),
    dynastyName: v.optional(v.string()),
    dynastyGeneration: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return createCharacterInternal(
      ctx,
      args.territoryId,
      args.role,
      args.tick,
      args.name,
      args.dynastyName,
      args.dynastyGeneration
    );
  },
});

// =============================================
// CHARACTER SPAWNING FROM POPULATION
// =============================================

// Extended roles for population-based characters
type ExtendedRole = "ruler" | "heir" | "general" | "advisor" | "rival" | "rebel_leader" | "noble_child" | "commoner" | "merchant" | "scholar" | "warrior" | "priest";

const EXTENDED_TITLES: Record<string, string[]> = {
  noble_child: ["Young Lord", "Young Lady", "Noble Scion", "Prince", "Princess"],
  commoner: ["Citizen", "Peasant", "Villager", "Freeman", "Freewoman"],
  merchant: ["Merchant", "Trader", "Shopkeeper", "Guild Member"],
  scholar: ["Scholar", "Scribe", "Sage", "Learned One"],
  warrior: ["Warrior", "Soldier", "Fighter", "Guard Captain"],
  priest: ["Priest", "Priestess", "Acolyte", "Holy One"],
};

/**
 * Create a character that can start as a child or commoner
 */
async function createPopulationCharacter(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  role: ExtendedRole,
  tick: number,
  age: number,
  parentId?: Id<"characters">,
  dynastyName?: string,
  dynastyGeneration?: number
): Promise<Id<"characters">> {
  const characterName = NAME_PREFIXES[Math.floor(Math.random() * NAME_PREFIXES.length)];
  const titles = EXTENDED_TITLES[role] || TITLES[role as keyof typeof TITLES] || ["Citizen"];
  const title = titles[Math.floor(Math.random() * titles.length)];

  // Generate traits - children inherit some traits from parents
  let traits = generateTraits(role === "noble_child" ? "heir" : "advisor");

  if (parentId) {
    const parent = await ctx.db.get(parentId);
    if (parent && parent.traits) {
      // Children inherit 50% of parent traits with some variation
      traits = {
        ambition: Math.min(100, Math.max(0, Math.floor((traits.ambition + parent.traits.ambition) / 2) + randomTrait(-10, 10))),
        cunning: Math.min(100, Math.max(0, Math.floor((traits.cunning + parent.traits.cunning) / 2) + randomTrait(-10, 10))),
        honor: Math.min(100, Math.max(0, Math.floor((traits.honor + parent.traits.honor) / 2) + randomTrait(-10, 10))),
        cruelty: Math.min(100, Math.max(0, Math.floor((traits.cruelty + parent.traits.cruelty) / 2) + randomTrait(-10, 10))),
        loyalty: Math.min(100, Math.max(0, Math.floor((traits.loyalty + parent.traits.loyalty) / 2) + randomTrait(-10, 10))),
        paranoia: Math.min(100, Math.max(0, Math.floor((traits.paranoia + parent.traits.paranoia) / 2) + randomTrait(-10, 10))),
        greed: Math.min(100, Math.max(0, Math.floor((traits.greed + parent.traits.greed) / 2) + randomTrait(-10, 10))),
        piety: Math.min(100, Math.max(0, Math.floor((traits.piety + parent.traits.piety) / 2) + randomTrait(-10, 10))),
        courage: Math.min(100, Math.max(0, Math.floor((traits.courage + parent.traits.courage) / 2) + randomTrait(-10, 10))),
        wisdom: Math.min(100, Math.max(0, Math.floor((traits.wisdom + parent.traits.wisdom) / 2) + randomTrait(-10, 10))),
        charisma: Math.min(100, Math.max(0, Math.floor((traits.charisma + parent.traits.charisma) / 2) + randomTrait(-10, 10))),
        wrath: Math.min(100, Math.max(0, Math.floor((traits.wrath + parent.traits.wrath) / 2) + randomTrait(-10, 10))),
        diligence: Math.min(100, Math.max(0, Math.floor((traits.diligence + parent.traits.diligence) / 2) + randomTrait(-10, 10))),
        temperance: Math.min(100, Math.max(0, Math.floor((traits.temperance + parent.traits.temperance) / 2) + randomTrait(-10, 10))),
        justice: Math.min(100, Math.max(0, Math.floor((traits.justice + parent.traits.justice) / 2) + randomTrait(-10, 10))),
        creativity: Math.min(100, Math.max(0, Math.floor((traits.creativity + parent.traits.creativity) / 2) + randomTrait(-10, 10))),
        strength: Math.min(100, Math.max(0, Math.floor((traits.strength + parent.traits.strength) / 2) + randomTrait(-10, 10))),
        vigilance: Math.min(100, Math.max(0, Math.floor((traits.vigilance + parent.traits.vigilance) / 2) + randomTrait(-10, 10))),
      };
    }
  }

  // Generate skills with parent and society inheritance
  // Map extended roles to social classes for skill initialization
  const extendedSocialClassMap: Record<ExtendedRole, string> = {
    ruler: "noble",
    heir: "noble",
    general: "warrior",
    advisor: "noble",
    rival: "noble",
    rebel_leader: "warrior",
    noble_child: "noble",
    commoner: "farmer",
    merchant: "merchant",
    scholar: "noble",
    warrior: "warrior",
    priest: "noble",
  };
  const socialClass = extendedSocialClassMap[role];
  const parentIds = parentId ? [parentId] : undefined;
  const skills = await generateSkillsWithInheritance(
    ctx,
    territoryId,
    socialClass,
    age,
    parentIds
  );

  const characterId = await ctx.db.insert("characters", {
    territoryId,
    name: characterName,
    title,
    role: role === "noble_child" ? "heir" : (["commoner", "merchant", "scholar", "warrior", "priest"].includes(role) ? "advisor" : role) as any,
    birthTick: tick - (age * 12),
    isAlive: true,
    age,
    traits,
    emotionalState: randomEmotionalState(),
    secretGoal: "none",
    relationships: parentId ? [{ characterId: parentId, type: "parent" as any, intensity: 80 }] : [],
    activePlots: [],
    dynastyName,
    dynastyGeneration,
    deeds: [],
    skills, // Skills inherited from parents and society
    // Track parent for dynasty
    parentId,
    // Track if this is a population-spawned character
    isFromPopulation: true,
    // Track current life stage
    lifeStage: age < 16 ? "child" : age < 60 ? "adult" : "elder",
  });

  return characterId;
}

/**
 * Process dynasty births - rulers and heirs can have children
 */
export async function processDynastyBirths(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  tick: number
): Promise<Array<{ type: string; description: string }>> {
  const events: Array<{ type: string; description: string }> = [];

  // Get all living adults of the ruling dynasty
  const characters = await ctx.db
    .query("characters")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .filter((q) => q.and(
      q.eq(q.field("isAlive"), true),
      q.or(
        q.eq(q.field("role"), "ruler"),
        q.eq(q.field("role"), "heir")
      )
    ))
    .collect();

  for (const character of characters) {
    // Only adults of childbearing age (16-50) can have children
    if (character.age < 16 || character.age > 50) continue;

    // Check if they already have too many children (max 5 per character)
    const existingChildren = await ctx.db
      .query("characters")
      .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
      .filter((q) => q.eq(q.field("parentId" as any), character._id))
      .collect();

    if (existingChildren.length >= 5) continue;

    // Birth chance: 2% per month for adults, modified by traits
    let birthChance = 0.02;

    // Piety increases birth chance slightly
    birthChance += (character.traits.piety || 50) / 5000;

    // Recent births reduce chance (cooldown of ~12 months)
    const recentBirth = existingChildren.find(c => (tick - c.birthTick) < 12);
    if (recentBirth) birthChance = 0;

    if (Math.random() < birthChance) {
      const childAge = 0;
      const generation = (character.dynastyGeneration || 1) + 1;

      const childId = await createPopulationCharacter(
        ctx,
        territoryId,
        "noble_child",
        tick,
        childAge,
        character._id,
        character.dynastyName,
        generation
      );

      const child = await ctx.db.get(childId);

      events.push({
        type: "dynasty_birth",
        description: `${character.name} has welcomed a new child, ${child?.name}! The ${character.dynastyName || "royal"} line grows stronger.`,
      });

      // If there's no heir and this is a ruler's child, they become heir apparent
      const currentHeir = characters.find(c => c.role === "heir" && c._id !== character._id);
      if (!currentHeir && character.role === "ruler") {
        await ctx.db.patch(childId, {
          role: "heir",
          title: "Crown Prince",
        });
      }
    }
  }

  return events;
}

/**
 * Process rising stars - talented individuals emerge from population
 */
export async function processRisingStars(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  tick: number
): Promise<Array<{ type: string; description: string }>> {
  const events: Array<{ type: string; description: string }> = [];

  const territory = await ctx.db.get(territoryId);
  if (!territory) return events;

  // Get current named characters
  const existingCharacters = await ctx.db
    .query("characters")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .filter((q) => q.eq(q.field("isAlive"), true))
    .collect();

  const hasGeneral = existingCharacters.some(c => c.role === "general");
  const hasAdvisor = existingCharacters.some(c => c.role === "advisor");
  const hasRival = existingCharacters.some(c => c.role === "rival");
  const advisorCount = existingCharacters.filter(c => c.role === "advisor").length;

  // Population threshold - need at least 50 people for rising stars
  if (territory.population < 50) return events;

  // Chance scales with population (larger population = more talent pool)
  const baseChance = Math.min(0.05, territory.population / 5000); // Max 5% per tick

  // Spawn a general if none exists
  if (!hasGeneral && Math.random() < baseChance * 2) {
    const age = Math.floor(Math.random() * 15) + 25; // 25-40
    await createPopulationCharacter(ctx, territoryId, "warrior", tick, age);

    // Promote the best warrior to general
    const warriors = await ctx.db
      .query("characters")
      .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
      .filter((q) => q.and(
        q.eq(q.field("isAlive"), true),
        q.eq(q.field("isFromPopulation" as any), true)
      ))
      .collect();

    const bestWarrior = warriors
      .filter(w => w.age >= 20)
      .sort((a, b) => (b.traits.courage + b.traits.strength) - (a.traits.courage + a.traits.strength))[0];

    if (bestWarrior) {
      await ctx.db.patch(bestWarrior._id, {
        role: "general",
        title: TITLES.general[Math.floor(Math.random() * TITLES.general.length)],
      });

      events.push({
        type: "rising_star",
        description: `${bestWarrior.name} has risen through the ranks to become our new ${bestWarrior.title || "General"}! Their courage and strength are unmatched.`,
      });
    }
  }

  // Spawn an advisor if none or few exist (max 3 advisors)
  if (advisorCount < 3 && Math.random() < baseChance) {
    const age = Math.floor(Math.random() * 20) + 30; // 30-50
    const scholarType = Math.random() < 0.5 ? "scholar" : "merchant";

    const scholarId = await createPopulationCharacter(ctx, territoryId, scholarType, tick, age);
    const scholar = await ctx.db.get(scholarId);

    if (scholar && (scholar.traits.wisdom > 60 || scholar.traits.cunning > 60)) {
      await ctx.db.patch(scholarId, {
        role: "advisor",
        title: TITLES.advisor[Math.floor(Math.random() * TITLES.advisor.length)],
      });

      events.push({
        type: "rising_star",
        description: `${scholar.name}, a wise ${scholarType}, has been recognized for their intellect and appointed as an advisor to the realm.`,
      });
    }
  }

  // Spawn a rival if none exists (ambitious noble or merchant)
  if (!hasRival && territory.population > 100 && Math.random() < baseChance * 0.5) {
    const age = Math.floor(Math.random() * 20) + 30; // 30-50
    const rivalId = await createPopulationCharacter(ctx, territoryId, "merchant", tick, age);
    const rival = await ctx.db.get(rivalId);

    if (rival && rival.traits.ambition > 50) {
      await ctx.db.patch(rivalId, {
        role: "rival",
        title: TITLES.rival[Math.floor(Math.random() * TITLES.rival.length)],
        secretGoal: generateSecretGoal("rival", rival.traits),
      });

      events.push({
        type: "rising_star",
        description: `${rival.name} has accumulated enough wealth and influence to become a notable rival to the ruling power.`,
      });
    }
  }

  // Spawn priests if religion exists
  const religion = await ctx.db
    .query("religions")
    .withIndex("by_territory", (q) => q.eq("foundingTerritoryId", territoryId))
    .first();

  if (religion && Math.random() < baseChance * 0.3) {
    const age = Math.floor(Math.random() * 30) + 20; // 20-50
    const priestId = await createPopulationCharacter(ctx, territoryId, "priest", tick, age);
    const priest = await ctx.db.get(priestId);

    if (priest) {
      await ctx.db.patch(priestId, {
        faith: religion._id,
        piety: Math.max(50, priest.traits.piety || 50),
        religiousRank: "acolyte",
      });

      events.push({
        type: "rising_star",
        description: `${priest.name} has devoted their life to ${religion.name} and joined the priesthood.`,
      });
    }
  }

  return events;
}

/**
 * Process character maturation - children grow up and can take on roles
 */
export async function processCharacterMaturation(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  tick: number
): Promise<Array<{ type: string; description: string }>> {
  const events: Array<{ type: string; description: string }> = [];

  const characters = await ctx.db
    .query("characters")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .filter((q) => q.eq(q.field("isAlive"), true))
    .collect();

  for (const character of characters) {
    const currentAge = Math.floor((tick - character.birthTick) / 12);
    const previousLifeStage = (character as any).lifeStage;

    // Update age if changed
    if (currentAge !== character.age) {
      await ctx.db.patch(character._id, { age: currentAge });
    }

    // Determine life stage
    let newLifeStage = "adult";
    if (currentAge < 16) newLifeStage = "child";
    else if (currentAge >= 60) newLifeStage = "elder";

    // Check for coming of age (turning 16)
    if (previousLifeStage === "child" && newLifeStage === "adult") {
      await ctx.db.patch(character._id, { lifeStage: "adult" as any });

      // Noble children can now be considered for important roles
      if (character.dynastyName) {
        events.push({
          type: "coming_of_age",
          description: `${character.name} of the ${character.dynastyName} has come of age! They are now ready to serve the realm.`,
        });

        // Check if we need an heir
        const ruler = characters.find(c => c.role === "ruler");
        const heir = characters.find(c => c.role === "heir" && c._id !== character._id);

        if (ruler && !heir && (character as any).parentId === ruler._id) {
          await ctx.db.patch(character._id, {
            role: "heir",
            title: "Crown Prince",
          });
          events.push({
            type: "heir_named",
            description: `${character.name} has been formally named as heir to ${ruler.name}!`,
          });
        }
      }
    }

    // Elders gain wisdom
    if (previousLifeStage === "adult" && newLifeStage === "elder") {
      await ctx.db.patch(character._id, {
        lifeStage: "elder" as any,
        traits: {
          ...character.traits,
          wisdom: Math.min(100, character.traits.wisdom + 10),
        }
      });

      events.push({
        type: "elder",
        description: `${character.name} has entered their elder years. Their wisdom is now legendary.`,
      });
    }
  }

  return events;
}

/**
 * Get dynasty tree for a territory
 */
export async function getDynastyTree(
  ctx: MutationCtx,
  territoryId: Id<"territories">
): Promise<{
  ruler: Doc<"characters"> | null;
  heirs: Doc<"characters">[];
  children: Doc<"characters">[];
  generations: number;
}> {
  const characters = await ctx.db
    .query("characters")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .filter((q) => q.eq(q.field("isAlive"), true))
    .collect();

  const ruler = characters.find(c => c.role === "ruler") || null;
  const heirs = characters.filter(c => c.role === "heir");
  const children = characters.filter(c => (c as any).lifeStage === "child");

  const maxGeneration = Math.max(...characters.map(c => c.dynastyGeneration || 1), 1);

  return {
    ruler,
    heirs,
    children,
    generations: maxGeneration,
  };
}

// =============================================
// CHARACTER LIFECYCLE
// =============================================

// Characters do NOT die of old age - they can only die from:
// - Famine/starvation
// - Being killed (execution, assassination, war)
// - Failed medication experiments (rare)
// - Other circumstances

export async function processCharacterAging(
  ctx: MutationCtx,
  tick: number
): Promise<Array<{ type: string; characterId: Id<"characters">; description: string }>> {
  const characters = await ctx.db
    .query("characters")
    .withIndex("by_alive", (q) => q.eq("isAlive", true))
    .collect();

  const events: Array<{ type: string; characterId: Id<"characters">; description: string }> = [];

  for (const character of characters) {
    // Age characters (1 tick = 1 month, so every 12 ticks = 1 year)
    const newAge = Math.floor((tick - character.birthTick) / 12);

    if (newAge !== character.age) {
      await ctx.db.patch(character._id, { age: newAge });
    }

    // NO OLD AGE DEATH - Characters live until killed by circumstances
    // This makes each character more valuable and their deaths more meaningful

    // Process wounded characters - they need medication to heal
    if (character.isWounded) {
      const woundEvents = await processWoundedCharacter(ctx, character, tick);
      events.push(...woundEvents);
    }
  }

  return events;
}

// =============================================
// WOUND & HEALING SYSTEM
// =============================================

// Medication types with their properties
const MEDICATION_TYPES = {
  herbal: {
    name: "Herbal Remedies",
    baseEffectiveness: 40,
    riskOfDeath: 0.02,      // 2% chance of fatal reaction
    riskOfSideEffects: 0.15, // 15% chance of side effects
    healingPerTick: 8,
    sideEffects: ["fever", "weakness", "hallucinations", "nausea"],
  },
  surgical: {
    name: "Surgical Treatment",
    baseEffectiveness: 60,
    riskOfDeath: 0.08,      // 8% chance of dying from surgery
    riskOfSideEffects: 0.25,
    healingPerTick: 15,
    sideEffects: ["infection", "permanent scar", "reduced mobility", "chronic pain"],
  },
  experimental: {
    name: "Experimental Medicine",
    baseEffectiveness: 75,
    riskOfDeath: 0.15,      // 15% chance - high risk, high reward
    riskOfSideEffects: 0.35,
    healingPerTick: 25,
    sideEffects: ["organ damage", "madness", "dependency", "strange visions", "personality change"],
  },
  spiritual: {
    name: "Spiritual Healing",
    baseEffectiveness: 30,
    riskOfDeath: 0.01,      // Very safe but less effective
    riskOfSideEffects: 0.05,
    healingPerTick: 5,
    sideEffects: ["religious fervor", "prophetic dreams"],
  },
  rest: {
    name: "Rest & Natural Healing",
    baseEffectiveness: 20,
    riskOfDeath: 0,         // No risk, but slow
    riskOfSideEffects: 0,
    healingPerTick: 2,
    sideEffects: [],
  },
};

/**
 * Wound a character (from war, assassination attempt, etc.)
 */
export async function woundCharacter(
  ctx: MutationCtx,
  characterId: Id<"characters">,
  severity: number,
  cause: string,
  tick: number
): Promise<{ success: boolean; description: string }> {
  const character = await ctx.db.get(characterId);
  if (!character || !character.isAlive) {
    return { success: false, description: "Character not found or already dead" };
  }

  // If already wounded, wounds stack (but cap at 100)
  const currentSeverity = character.woundSeverity || 0;
  const newSeverity = Math.min(100, currentSeverity + severity);

  // Very severe wounds (90+) can be immediately fatal
  if (newSeverity >= 95 && Math.random() < 0.3) {
    await ctx.db.patch(characterId, {
      isAlive: false,
      deathTick: tick,
      deathCause: `fatal wounds from ${cause}`,
    });
    return {
      success: true,
      description: `${character.title} ${character.name} succumbed to fatal wounds from ${cause}.`,
    };
  }

  await ctx.db.patch(characterId, {
    isWounded: true,
    woundSeverity: newSeverity,
    woundedAtTick: tick,
    woundCause: cause,
    healingProgress: 0,
  });

  return {
    success: true,
    description: `${character.title} ${character.name} was wounded in ${cause} (severity: ${newSeverity}).`,
  };
}

/**
 * Apply medication to a wounded character
 */
export async function applyMedication(
  ctx: MutationCtx,
  characterId: Id<"characters">,
  medicationType: keyof typeof MEDICATION_TYPES,
  tick: number
): Promise<{ success: boolean; description: string; died?: boolean }> {
  const character = await ctx.db.get(characterId);
  if (!character || !character.isAlive) {
    return { success: false, description: "Character not found or already dead" };
  }

  if (!character.isWounded) {
    return { success: false, description: "Character is not wounded" };
  }

  const medication = MEDICATION_TYPES[medicationType];

  // Calculate actual effectiveness (varies by ±20%)
  const effectivenessVariance = (Math.random() - 0.5) * 40;
  const actualEffectiveness = Math.max(10, Math.min(100, medication.baseEffectiveness + effectivenessVariance));

  // Check for death from treatment
  if (Math.random() < medication.riskOfDeath) {
    await ctx.db.patch(characterId, {
      isAlive: false,
      deathTick: tick,
      deathCause: `complications from ${medication.name.toLowerCase()}`,
    });

    // Record the failed treatment
    const medications = character.medicationTested || [];
    medications.push({
      medicationType,
      tick,
      effectiveness: 0,
      sideEffects: "fatal",
    });

    return {
      success: true,
      died: true,
      description: `${character.title} ${character.name} died from complications during ${medication.name.toLowerCase()} treatment.`,
    };
  }

  // Check for side effects
  let sideEffect: string | undefined;
  if (Math.random() < medication.riskOfSideEffects && medication.sideEffects.length > 0) {
    sideEffect = medication.sideEffects[Math.floor(Math.random() * medication.sideEffects.length)];
  }

  // Record the treatment
  const medications = character.medicationTested || [];
  medications.push({
    medicationType,
    tick,
    effectiveness: actualEffectiveness,
    sideEffects: sideEffect,
  });

  // Calculate healing progress
  const newHealingProgress = Math.min(100, (character.healingProgress || 0) + medication.healingPerTick);

  await ctx.db.patch(characterId, {
    healingProgress: newHealingProgress,
    medicationTested: medications,
  });

  let description = `${character.title} ${character.name} received ${medication.name.toLowerCase()} (${actualEffectiveness}% effective).`;
  if (sideEffect) {
    description += ` Side effect: ${sideEffect}.`;
  }
  if (newHealingProgress >= 100) {
    description += ` They have fully recovered!`;
  }

  return { success: true, description };
}

/**
 * Process wounded characters each tick
 */
async function processWoundedCharacter(
  ctx: MutationCtx,
  character: Doc<"characters">,
  tick: number
): Promise<Array<{ type: string; characterId: Id<"characters">; description: string }>> {
  const events: Array<{ type: string; characterId: Id<"characters">; description: string }> = [];

  if (!character.isWounded) return events;

  const healingProgress = character.healingProgress || 0;
  const woundSeverity = character.woundSeverity || 50;

  // Natural slow healing (rest)
  const naturalHealing = MEDICATION_TYPES.rest.healingPerTick;
  const newProgress = Math.min(100, healingProgress + naturalHealing);

  // Check if healed
  if (newProgress >= 100) {
    await ctx.db.patch(character._id, {
      isWounded: false,
      woundSeverity: 0,
      healingProgress: 0,
      woundCause: undefined,
      woundedAtTick: undefined,
    });

    events.push({
      type: "healed",
      characterId: character._id,
      description: `${character.title} ${character.name} has recovered from their wounds.`,
    });
  } else {
    // Update healing progress
    await ctx.db.patch(character._id, {
      healingProgress: newProgress,
    });

    // Severe untreated wounds can worsen (without medication)
    const ticksWounded = tick - (character.woundedAtTick || tick);
    const recentMedication = (character.medicationTested || []).some(
      m => tick - m.tick < 6 // Medication in last 6 ticks
    );

    if (!recentMedication && woundSeverity > 60 && ticksWounded > 12) {
      // Untreated severe wounds can become fatal
      if (Math.random() < 0.05) { // 5% chance per tick
        await ctx.db.patch(character._id, {
          isAlive: false,
          deathTick: tick,
          deathCause: `untreated wounds from ${character.woundCause || "injury"}`,
        });

        events.push({
          type: "death",
          characterId: character._id,
          description: `${character.title} ${character.name} died from untreated wounds.`,
        });
      }
    }
  }

  return events;
}

/**
 * Kill a character from famine (circumstantial death)
 */
export async function killFromFamine(
  ctx: MutationCtx,
  characterId: Id<"characters">,
  tick: number
): Promise<{ success: boolean; description: string }> {
  const character = await ctx.db.get(characterId);
  if (!character || !character.isAlive) {
    return { success: false, description: "Character not found or already dead" };
  }

  await ctx.db.patch(characterId, {
    isAlive: false,
    deathTick: tick,
    deathCause: "starvation during famine",
  });

  return {
    success: true,
    description: `${character.title} ${character.name} perished during the great famine.`,
  };
}

/**
 * Kill a character (execution, assassination, etc.)
 */
export async function killCharacter(
  ctx: MutationCtx,
  characterId: Id<"characters">,
  cause: string,
  tick: number
): Promise<{ success: boolean; description: string }> {
  const character = await ctx.db.get(characterId);
  if (!character || !character.isAlive) {
    return { success: false, description: "Character not found or already dead" };
  }

  await ctx.db.patch(characterId, {
    isAlive: false,
    deathTick: tick,
    deathCause: cause,
  });

  return {
    success: true,
    description: `${character.title} ${character.name} died from ${cause}.`,
  };
}

// =============================================
// ADDITIONAL DEATH CAUSES
// =============================================

/**
 * Accident types with descriptions and base fatality rates
 */
const ACCIDENT_TYPES = {
  hunting: {
    descriptions: [
      "was gored by a wild boar during a hunt",
      "fell from their horse while hunting",
      "was mauled by a bear in the forest",
      "drowned crossing a river during a hunt",
      "was struck by a stray arrow during a hunt",
    ],
    baseFatality: 0.15,
    dangerModifier: (char: Doc<"characters">) => char.age > 50 ? 0.1 : 0,
  },
  construction: {
    descriptions: [
      "was crushed when scaffolding collapsed",
      "fell from a great height while inspecting construction",
      "was struck by falling stones at a building site",
    ],
    baseFatality: 0.1,
    dangerModifier: () => 0,
  },
  travel: {
    descriptions: [
      "died when their ship was lost in a storm",
      "perished crossing treacherous mountain passes",
      "was killed by bandits on the road",
      "fell from a cliff during a mountain journey",
      "succumbed to exposure during a long journey",
    ],
    baseFatality: 0.12,
    dangerModifier: (char: Doc<"characters">) => char.age > 60 ? 0.08 : 0,
  },
  tournament: {
    descriptions: [
      "was fatally wounded in a jousting tournament",
      "died from wounds sustained in a melee",
      "was trampled by horses during a tournament",
    ],
    baseFatality: 0.08,
    dangerModifier: (char: Doc<"characters">) => {
      const strength = char.traits.strength || 50;
      return strength < 30 ? 0.1 : strength > 70 ? -0.05 : 0;
    },
  },
  fire: {
    descriptions: [
      "perished when their chambers caught fire",
      "died trying to escape a burning building",
      "suffocated from smoke in a palace fire",
    ],
    baseFatality: 0.2,
    dangerModifier: (char: Doc<"characters">) => char.age > 60 ? 0.15 : 0,
  },
};

/**
 * Kill a character in an accident
 */
export async function killInAccident(
  ctx: MutationCtx,
  characterId: Id<"characters">,
  accidentType: keyof typeof ACCIDENT_TYPES,
  tick: number
): Promise<{ success: boolean; description: string; died: boolean }> {
  const character = await ctx.db.get(characterId);
  if (!character || !character.isAlive) {
    return { success: false, description: "Character not found or already dead", died: false };
  }

  const accident = ACCIDENT_TYPES[accidentType];
  const fatalityChance = accident.baseFatality + accident.dangerModifier(character);

  // Roll for death
  if (Math.random() < fatalityChance) {
    const description = accident.descriptions[Math.floor(Math.random() * accident.descriptions.length)];

    await ctx.db.patch(characterId, {
      isAlive: false,
      deathTick: tick,
      deathCause: `accident: ${description}`,
    });

    return {
      success: true,
      died: true,
      description: `${character.title} ${character.name} ${description}.`,
    };
  }

  // Survived but may be wounded
  if (Math.random() < 0.3) {
    await ctx.db.patch(characterId, {
      isWounded: true,
      woundSeverity: Math.floor(Math.random() * 30) + 20,
      woundCause: `${accidentType} accident`,
    });

    return {
      success: true,
      died: false,
      description: `${character.title} ${character.name} was injured in a ${accidentType} accident but survived.`,
    };
  }

  return {
    success: true,
    died: false,
    description: `${character.title} ${character.name} narrowly escaped a ${accidentType} accident.`,
  };
}

/**
 * Disease types with mortality rates
 */
const DISEASE_TYPES = {
  plague: {
    names: ["the Black Death", "the Great Plague", "the Sweating Sickness"],
    baseMortality: 0.4,
    ageModifier: (age: number) => age > 50 ? 0.2 : age < 20 ? 0.1 : 0,
  },
  fever: {
    names: ["a burning fever", "the marsh fever", "camp fever"],
    baseMortality: 0.2,
    ageModifier: (age: number) => age > 60 ? 0.15 : 0,
  },
  consumption: {
    names: ["consumption", "the wasting disease", "lung rot"],
    baseMortality: 0.25,
    ageModifier: () => 0,
  },
  dysentery: {
    names: ["the bloody flux", "camp sickness", "the runs"],
    baseMortality: 0.15,
    ageModifier: (age: number) => age > 50 ? 0.1 : 0,
  },
  pox: {
    names: ["the pox", "smallpox", "the spotted death"],
    baseMortality: 0.3,
    ageModifier: (age: number) => age < 15 ? 0.1 : age > 50 ? 0.15 : 0,
  },
};

/**
 * Infect a character with disease (may lead to death)
 */
export async function infectWithDisease(
  ctx: MutationCtx,
  characterId: Id<"characters">,
  diseaseType: keyof typeof DISEASE_TYPES,
  tick: number
): Promise<{ success: boolean; description: string; died: boolean }> {
  const character = await ctx.db.get(characterId);
  if (!character || !character.isAlive) {
    return { success: false, description: "Character not found or already dead", died: false };
  }

  const disease = DISEASE_TYPES[diseaseType];
  const diseaseName = disease.names[Math.floor(Math.random() * disease.names.length)];
  const mortalityChance = disease.baseMortality + disease.ageModifier(character.age);

  // Check for death
  if (Math.random() < mortalityChance) {
    await ctx.db.patch(characterId, {
      isAlive: false,
      deathTick: tick,
      deathCause: `succumbed to ${diseaseName}`,
    });

    return {
      success: true,
      died: true,
      description: `${character.title} ${character.name} succumbed to ${diseaseName} after a brief illness.`,
    };
  }

  // Survived - may be weakened
  return {
    success: true,
    died: false,
    description: `${character.title} ${character.name} recovered from ${diseaseName}.`,
  };
}

/**
 * Kill a character through poisoning
 */
export async function poisonCharacter(
  ctx: MutationCtx,
  characterId: Id<"characters">,
  poisonerInfo: { known: boolean; suspectId?: Id<"characters"> },
  tick: number
): Promise<{ success: boolean; description: string; died: boolean }> {
  const character = await ctx.db.get(characterId);
  if (!character || !character.isAlive) {
    return { success: false, description: "Character not found or already dead", died: false };
  }

  // Vigilant characters have a chance to detect poison
  const vigilance = character.traits.vigilance || 50;
  const detectionChance = vigilance / 200; // 0-50% based on vigilance

  if (Math.random() < detectionChance) {
    // Poison detected, not consumed
    return {
      success: true,
      died: false,
      description: `${character.title} ${character.name}'s vigilance saved them - poison was detected in their food.`,
    };
  }

  // Poison consumed - determine effect
  const poisonStrength = 0.5 + Math.random() * 0.3; // 50-80% lethal

  if (Math.random() < poisonStrength) {
    // Fatal poisoning
    let deathCause = "poisoning";
    if (poisonerInfo.known && poisonerInfo.suspectId) {
      const poisoner = await ctx.db.get(poisonerInfo.suspectId);
      if (poisoner) {
        deathCause = `poisoning (suspected: ${poisoner.name})`;
      }
    }

    await ctx.db.patch(characterId, {
      isAlive: false,
      deathTick: tick,
      deathCause,
    });

    const poisonDescriptions = [
      "collapsed at dinner and never recovered",
      "was found dead in their chambers",
      "died in agony after drinking wine",
      "perished after a brief, mysterious illness",
    ];

    return {
      success: true,
      died: true,
      description: `${character.title} ${character.name} ${poisonDescriptions[Math.floor(Math.random() * poisonDescriptions.length)]}.`,
    };
  }

  // Survived but weakened
  await ctx.db.patch(characterId, {
    isWounded: true,
    woundSeverity: Math.floor(Math.random() * 40) + 30,
    woundCause: "suspected poisoning",
  });

  return {
    success: true,
    died: false,
    description: `${character.title} ${character.name} fell gravely ill from suspected poisoning but survived.`,
  };
}

/**
 * Exile a character (they may die in exile or return later)
 */
export async function exileCharacter(
  ctx: MutationCtx,
  characterId: Id<"characters">,
  reason: string,
  tick: number
): Promise<{ success: boolean; description: string }> {
  const character = await ctx.db.get(characterId);
  if (!character || !character.isAlive) {
    return { success: false, description: "Character not found or already dead" };
  }

  await ctx.db.patch(characterId, {
    isExiled: true,
    exileTick: tick,
    exileReason: reason,
  });

  return {
    success: true,
    description: `${character.title} ${character.name} has been exiled for ${reason}.`,
  };
}

/**
 * Process exiled characters - they may die in exile
 */
export async function processExiledCharacters(
  ctx: MutationCtx,
  tick: number
): Promise<Array<{ type: string; description: string }>> {
  const exiledCharacters = await ctx.db
    .query("characters")
    .filter((q) =>
      q.and(
        q.eq(q.field("isAlive"), true),
        q.eq(q.field("isExiled"), true)
      )
    )
    .collect();

  const events: Array<{ type: string; description: string }> = [];

  for (const character of exiledCharacters) {
    const ticksInExile = tick - (character.exileTick || tick);

    // Base death chance increases with time in exile
    const baseDeathChance = 0.01 + (ticksInExile * 0.002); // 1% base + 0.2% per tick
    const ageModifier = character.age > 50 ? 0.02 : 0;

    if (Math.random() < baseDeathChance + ageModifier) {
      const exileDeaths = [
        "died alone in exile, far from home",
        "perished from hardship in foreign lands",
        "was killed by bandits while in exile",
        "succumbed to illness in exile",
        "died of a broken heart in exile",
      ];

      await ctx.db.patch(character._id, {
        isAlive: false,
        deathTick: tick,
        deathCause: exileDeaths[Math.floor(Math.random() * exileDeaths.length)],
      });

      events.push({
        type: "death",
        description: `${character.title} ${character.name} ${exileDeaths[Math.floor(Math.random() * exileDeaths.length)]}.`,
      });
    }
  }

  return events;
}

/**
 * Kill a character from exposure (winter/harsh conditions)
 */
export async function killFromExposure(
  ctx: MutationCtx,
  characterId: Id<"characters">,
  tick: number,
  conditions: string = "the harsh winter"
): Promise<{ success: boolean; description: string }> {
  const character = await ctx.db.get(characterId);
  if (!character || !character.isAlive) {
    return { success: false, description: "Character not found or already dead" };
  }

  await ctx.db.patch(characterId, {
    isAlive: false,
    deathTick: tick,
    deathCause: `exposure to ${conditions}`,
  });

  return {
    success: true,
    description: `${character.title} ${character.name} perished from exposure to ${conditions}.`,
  };
}

/**
 * Kill a character in a natural disaster
 */
export async function killInDisaster(
  ctx: MutationCtx,
  characterId: Id<"characters">,
  disasterType: "earthquake" | "flood" | "fire" | "storm" | "landslide" | "volcanic",
  tick: number
): Promise<{ success: boolean; description: string }> {
  const character = await ctx.db.get(characterId);
  if (!character || !character.isAlive) {
    return { success: false, description: "Character not found or already dead" };
  }

  const disasterDescriptions: Record<string, string[]> = {
    earthquake: [
      "was crushed when their palace collapsed in the earthquake",
      "perished when the ground opened beneath them",
      "was killed by falling debris during the great earthquake",
    ],
    flood: [
      "drowned in the great flood",
      "was swept away by floodwaters",
      "perished when the river broke its banks",
    ],
    fire: [
      "perished in the great fire",
      "was trapped and burned in the conflagration",
      "died from smoke when fire engulfed the city",
    ],
    storm: [
      "was struck by lightning during the great storm",
      "was killed when the storm collapsed their dwelling",
      "perished in the hurricane's fury",
    ],
    landslide: [
      "was buried by the landslide",
      "perished when the hillside gave way",
      "was crushed by falling rocks and mud",
    ],
    volcanic: [
      "was consumed by volcanic fire",
      "suffocated in the ash cloud",
      "was buried under volcanic debris",
    ],
  };

  const descriptions = disasterDescriptions[disasterType];
  const description = descriptions[Math.floor(Math.random() * descriptions.length)];

  await ctx.db.patch(characterId, {
    isAlive: false,
    deathTick: tick,
    deathCause: `natural disaster: ${description}`,
  });

  return {
    success: true,
    description: `${character.title} ${character.name} ${description}.`,
  };
}

/**
 * Execute a character (public execution by ruler)
 */
export async function executeCharacter(
  ctx: MutationCtx,
  characterId: Id<"characters">,
  method: "beheading" | "hanging" | "burning" | "drowning" | "impalement",
  crime: string,
  tick: number
): Promise<{ success: boolean; description: string }> {
  const character = await ctx.db.get(characterId);
  if (!character || !character.isAlive) {
    return { success: false, description: "Character not found or already dead" };
  }

  const methodDescriptions: Record<string, string> = {
    beheading: "was beheaded in the public square",
    hanging: "was hanged before a jeering crowd",
    burning: "was burned at the stake",
    drowning: "was drowned in the river",
    impalement: "was impaled as a warning to others",
  };

  await ctx.db.patch(characterId, {
    isAlive: false,
    deathTick: tick,
    deathCause: `executed (${method}) for ${crime}`,
  });

  return {
    success: true,
    description: `${character.title} ${character.name} ${methodDescriptions[method]} for ${crime}.`,
  };
}

/**
 * Check for random accidents during a tick (call for high-risk characters)
 */
export async function checkForAccidents(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  tick: number
): Promise<Array<{ type: string; description: string }>> {
  const characters = await ctx.db
    .query("characters")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .filter((q) => q.eq(q.field("isAlive"), true))
    .collect();

  const events: Array<{ type: string; description: string }> = [];

  for (const character of characters) {
    // Very low base chance of accident
    const baseChance = 0.002; // 0.2% per tick

    // Certain traits increase accident risk
    const courageBonus = character.traits.courage > 70 ? 0.002 : 0; // Brave = reckless
    const ageBonus = character.age > 60 ? 0.001 : 0;

    if (Math.random() < baseChance + courageBonus + ageBonus) {
      // Random accident type
      const accidentTypes: Array<keyof typeof ACCIDENT_TYPES> = [
        "hunting", "travel", "fire"
      ];
      const accidentType = accidentTypes[Math.floor(Math.random() * accidentTypes.length)];

      const result = await killInAccident(ctx, character._id, accidentType, tick);
      if (result.died) {
        events.push({
          type: "death",
          description: result.description,
        });
      } else if (result.description.includes("injured")) {
        events.push({
          type: "injury",
          description: result.description,
        });
      }
    }
  }

  return events;
}

// =============================================
// EMOTIONAL STATE UPDATES
// =============================================

export const updateEmotionalState = internalMutation({
  args: {
    characterId: v.id("characters"),
    changes: v.object({
      hope: v.optional(v.number()),
      fear: v.optional(v.number()),
      shame: v.optional(v.number()),
      despair: v.optional(v.number()),
      contentment: v.optional(v.number()),
      rage: v.optional(v.number()),
    }),
  },
  handler: async (ctx, args) => {
    const character = await ctx.db.get(args.characterId);
    if (!character) return;

    const newState = { ...character.emotionalState };

    for (const [key, delta] of Object.entries(args.changes)) {
      if (delta !== undefined) {
        const currentValue = newState[key as keyof typeof newState] || 50;
        newState[key as keyof typeof newState] = Math.max(0, Math.min(100, currentValue + delta));
      }
    }

    await ctx.db.patch(args.characterId, { emotionalState: newState });
  },
});

// =============================================
// PROSPERITY EFFECTS ON CHARACTERS
// =============================================

export async function applyCharacterProsperityEffects(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  prosperityTier: number,
  tick: number
): Promise<Array<{ type: string; description: string }>> {
  const characters = await ctx.db
    .query("characters")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .filter((q) => q.eq(q.field("isAlive"), true))
    .collect();

  const events: Array<{ type: string; description: string }> = [];

  for (const character of characters) {
    if (character.role === "ruler") continue; // Ruler is content

    // High prosperity breeds ambition in ambitious characters
    if (prosperityTier >= 3 && character.traits.ambition > 60) {
      // Prosperity makes ambitious characters think "I could do even better"
      const newEmotionalState = { ...character.emotionalState };

      // Increase hope (opportunity) but also fear of missing out
      newEmotionalState.hope = Math.min(100, newEmotionalState.hope + 5);

      // If already ambitious and cunning, they might start plotting
      if (character.traits.cunning > 50 && character.traits.loyalty < 50) {
        // Check if they're already plotting
        const hasPlot = character.activePlots.length > 0;

        if (!hasPlot && Math.random() < 0.1) {
          // Start a plot during prosperity (complacency breeds treachery)
          const newPlots = [...character.activePlots, {
            plotType: character.traits.greed > 60 ? "embezzlement" : "coup",
            startTick: tick,
            progressPercent: 5,
            discovered: false,
            conspirators: [],
          }];

          await ctx.db.patch(character._id, {
            activePlots: newPlots,
            emotionalState: newEmotionalState,
          });

          events.push({
            type: "plot_started",
            description: `${character.title} ${character.name} has begun scheming during the time of prosperity.`,
          });
        }
      }
    }

    // Golden age (tier 5) makes everyone complacent
    if (prosperityTier >= 4) {
      // Generals become soft
      if (character.role === "general" && Math.random() < 0.05) {
        const newTraits = { ...character.traits };
        newTraits.courage = Math.max(10, newTraits.courage - 2);
        await ctx.db.patch(character._id, { traits: newTraits });
      }

      // Advisors become corrupt
      if (character.role === "advisor" && character.traits.greed > 50 && Math.random() < 0.05) {
        const newTraits = { ...character.traits };
        newTraits.greed = Math.min(100, newTraits.greed + 3);
        newTraits.loyalty = Math.max(0, newTraits.loyalty - 2);
        await ctx.db.patch(character._id, { traits: newTraits });
      }
    }
  }

  return events;
}

// =============================================
// CHARACTER QUERIES
// =============================================

export const getCharactersByTerritory = query({
  args: { territoryId: v.id("territories") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("characters")
      .withIndex("by_territory", (q) => q.eq("territoryId", args.territoryId))
      .filter((q) => q.eq(q.field("isAlive"), true))
      .collect();
  },
});

export const getRuler = query({
  args: { territoryId: v.id("territories") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("characters")
      .withIndex("by_territory", (q) => q.eq("territoryId", args.territoryId))
      .filter((q) =>
        q.and(
          q.eq(q.field("isAlive"), true),
          q.eq(q.field("role"), "ruler")
        )
      )
      .first();
  },
});

export const getCharacterById = query({
  args: { characterId: v.id("characters") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.characterId);
  },
});

// =============================================
// TRAIT DESCRIPTION HELPERS
// =============================================

export function getTraitDescription(trait: string, value: number): string {
  const descriptions: Record<string, { low: string; mid: string; high: string }> = {
    ambition: {
      low: "content with their station",
      mid: "moderately ambitious",
      high: "burning with ambition",
    },
    greed: {
      low: "generous and content",
      mid: "practical about wealth",
      high: "consumed by greed",
    },
    loyalty: {
      low: "untrustworthy",
      mid: "pragmatic loyalty",
      high: "fiercely loyal",
    },
    honor: {
      low: "dishonorable",
      mid: "practical about honor",
      high: "bound by honor",
    },
    cruelty: {
      low: "merciful",
      mid: "pragmatic",
      high: "cruel and ruthless",
    },
    compassion: {
      low: "cold-hearted",
      mid: "practical compassion",
      high: "deeply compassionate",
    },
    cunning: {
      low: "simple and direct",
      mid: "reasonably shrewd",
      high: "masterfully cunning",
    },
    wisdom: {
      low: "foolish",
      mid: "reasonably wise",
      high: "profoundly wise",
    },
    paranoia: {
      low: "trusting",
      mid: "cautious",
      high: "deeply paranoid",
    },
    courage: {
      low: "cowardly",
      mid: "brave when needed",
      high: "fearlessly courageous",
    },
    pride: {
      low: "humble",
      mid: "appropriately proud",
      high: "consumed by pride",
    },
    wrath: {
      low: "peaceful",
      mid: "can be angered",
      high: "wrathful and vengeful",
    },
    charisma: {
      low: "off-putting",
      mid: "reasonably likable",
      high: "magnetically charismatic",
    },
    diplomacy: {
      low: "tactless",
      mid: "diplomatic when needed",
      high: "masterful diplomat",
    },
    justice: {
      low: "unjust and arbitrary",
      mid: "fair when convenient",
      high: "renowned for justice",
    },
    generosity: {
      low: "miserly",
      mid: "reasonably generous",
      high: "legendarily generous",
    },
    vigilance: {
      low: "oblivious to threats",
      mid: "reasonably alert",
      high: "ever-watchful",
    },
    strength: {
      low: "physically weak",
      mid: "capable fighter",
      high: "legendary warrior",
    },
  };

  const desc = descriptions[trait];
  if (!desc) return "unknown";

  if (value < 35) return desc.low;
  if (value < 65) return desc.mid;
  return desc.high;
}

export function getEmotionalStateDescription(state: Doc<"characters">["emotionalState"]): string {
  const dominant: string[] = [];

  if (state.hope > 70) dominant.push("hopeful");
  if (state.fear > 70) dominant.push("fearful");
  if (state.shame > 50) dominant.push("ashamed");
  if (state.despair > 50) dominant.push("despairing");
  if (state.contentment > 70) dominant.push("content");
  if (state.rage > 60) dominant.push("angry");

  if (dominant.length === 0) {
    if (state.contentment > 50) return "stable";
    return "troubled";
  }

  return dominant.join(", ");
}

// =============================================
// COMBAT EXPERIENCE & STRENGTH
// =============================================

/**
 * Record a kill and increase character's strength
 * Strength grows with combat experience, making them more formidable
 */
export async function recordKill(
  ctx: MutationCtx,
  characterId: Id<"characters">,
  killCount: number = 1,
  isBattleParticipation: boolean = true
): Promise<void> {
  const character = await ctx.db.get(characterId);
  if (!character || !character.isAlive) return;

  const currentKills = character.killCount || 0;
  const currentBattles = character.battlesParticipated || 0;
  const newKills = currentKills + killCount;
  const newBattles = isBattleParticipation ? currentBattles + 1 : currentBattles;

  // Calculate strength increase from kills
  // Diminishing returns - first kills matter more
  // Formula: +2 strength for first 10 kills, +1 for next 20, +0.5 after that
  let strengthIncrease = 0;
  if (newKills <= 10) {
    strengthIncrease = killCount * 2;
  } else if (newKills <= 30) {
    strengthIncrease = killCount * 1;
  } else {
    strengthIncrease = killCount * 0.5;
  }

  // Battle participation also grants small strength bonus
  if (isBattleParticipation) {
    strengthIncrease += 1;
  }

  const newStrength = Math.min(100, character.traits.strength + strengthIncrease);

  await ctx.db.patch(characterId, {
    killCount: newKills,
    battlesParticipated: newBattles,
    traits: {
      ...character.traits,
      strength: Math.round(newStrength),
    },
  });
}

/**
 * Record a duel victory - significant strength boost
 */
export async function recordDuelVictory(
  ctx: MutationCtx,
  winnerId: Id<"characters">,
  loserId: Id<"characters">
): Promise<void> {
  const winner = await ctx.db.get(winnerId);
  const loser = await ctx.db.get(loserId);
  if (!winner) return;

  const currentDuels = winner.duelsWon || 0;

  // Duels give more strength than regular kills - personal combat mastery
  const strengthIncrease = 5;
  const newStrength = Math.min(100, winner.traits.strength + strengthIncrease);

  await ctx.db.patch(winnerId, {
    duelsWon: currentDuels + 1,
    killCount: (winner.killCount || 0) + 1,
    traits: {
      ...winner.traits,
      strength: Math.round(newStrength),
    },
  });

  // Add a deed for notable duels
  if (loser && (loser.role === "ruler" || loser.role === "general")) {
    const newDeeds = [...winner.deeds, {
      tick: Date.now(), // Should pass in tick
      description: `Defeated ${loser.title} ${loser.name} in single combat`,
      type: "heroic",
    }];
    await ctx.db.patch(winnerId, { deeds: newDeeds });
  }
}

/**
 * Get strength-based combat bonus for a character
 */
export function getStrengthCombatBonus(character: Doc<"characters">): number {
  const strength = character.traits.strength;
  const kills = character.killCount || 0;
  const duels = character.duelsWon || 0;

  // Base bonus from strength
  let bonus = (strength - 50) / 10; // -5 to +5 from strength

  // Bonus from kill experience (reputation/skill)
  bonus += Math.min(5, kills / 10); // Up to +5 from kills

  // Bonus from duel victories (proven personal combat)
  bonus += Math.min(3, duels); // Up to +3 from duels

  return Math.round(bonus * 10) / 10;
}

// =============================================
// RULER DEATH AND SUCCESSION
// =============================================

export const handleRulerDeath = internalMutation({
  args: {
    characterId: v.id("characters"),
    tick: v.number(),
    deathCause: v.string(),
    killerTerritoryId: v.optional(v.id("territories")), // Who killed the ruler (if applicable)
  },
  handler: async (ctx, args) => {
    const ruler = await ctx.db.get(args.characterId);
    if (!ruler || ruler.role !== "ruler") return { success: false, error: "Not a ruler" };

    // Mark ruler as dead
    await ctx.db.patch(args.characterId, {
      isAlive: false,
      deathTick: args.tick,
      deathCause: args.deathCause,
    });

    // =============================================
    // ORGANIC AI GROWTH - Blood debt for killed ruler
    // =============================================
    // If a ruler was killed by an enemy, record a blood debt
    if (args.killerTerritoryId) {
      const killerTerritory = await ctx.db.get(args.killerTerritoryId);

      // Create a blood debt bond - killing a ruler is the worst offense
      await createBond(
        ctx,
        ruler.territoryId,
        args.killerTerritoryId,
        "blood_debt",
        90, // Maximum intensity - killing a ruler is unforgivable
        `${killerTerritory?.name || "The enemy"} killed our beloved ${ruler.title} ${ruler.name}! This blood debt will echo through generations!`,
        true // Always hereditary - regicide is never forgotten
      );

      // Record memory for the victim's civilization
      const victimAgent = await ctx.db
        .query("agents")
        .withIndex("by_territory", (q) => q.eq("territoryId", ruler.territoryId))
        .first();

      if (victimAgent) {
        await recordMemory(ctx, victimAgent._id, {
          type: "character_death",
          targetTerritoryId: args.killerTerritoryId,
          characterId: args.characterId,
          description: `${killerTerritory?.name || "The enemy"} MURDERED our ${ruler.title} ${ruler.name}! This atrocity will NEVER be forgotten!`,
          emotionalWeight: -95, // Maximum negative - ruler death by enemy is traumatic
        });
      }

      // Record memory for the killer's civilization (victory/conquest memory)
      const killerTerritoryIdLocal = args.killerTerritoryId; // Local variable for TypeScript narrowing
      const killerAgent = await ctx.db
        .query("agents")
        .withIndex("by_territory", (q) => q.eq("territoryId", killerTerritoryIdLocal))
        .first();

      if (killerAgent) {
        const victimTerritory = await ctx.db.get(ruler.territoryId);
        await recordMemory(ctx, killerAgent._id, {
          type: "victory",
          targetTerritoryId: ruler.territoryId,
          characterId: args.characterId,
          description: `We killed ${ruler.title} ${ruler.name} of ${victimTerritory?.name || "the enemy"}! A great victory!`,
          emotionalWeight: 70, // Positive for the killer
        });
      }
    }

    // Calculate reign summary
    const yearsReigned = ruler.coronationTick
      ? Math.floor((args.tick - ruler.coronationTick) / 12)
      : 0;

    const obituary = `${ruler.title} ${ruler.name} ruled for ${yearsReigned} years before ${args.deathCause}.`;

    await ctx.db.patch(args.characterId, {
      reignSummary: {
        yearsReigned,
        warsStarted: 0, // TODO: Track these
        warsWon: 0,
        plotsSurvived: 0,
        advisorsExecuted: 0,
        obituary,
      },
    });

    // Find heir
    const heir = await ctx.db
      .query("characters")
      .withIndex("by_territory", (q) => q.eq("territoryId", ruler.territoryId))
      .filter((q) =>
        q.and(
          q.eq(q.field("isAlive"), true),
          q.eq(q.field("role"), "heir")
        )
      )
      .first();

    let successionType: "peaceful" | "coup" | "civil_war" | "election" = "peaceful";
    let newRulerId: Id<"characters"> | null = null;
    let plottersExecuted = 0;
    let civilWarCasualties: number | undefined;

    if (heir && heir.traits.loyalty > 50) {
      // Peaceful succession
      successionType = "peaceful";
      newRulerId = heir._id;

      // Promote heir to ruler
      await ctx.db.patch(heir._id, {
        role: "ruler",
        title: ruler.title, // Inherit title
        coronationTick: args.tick,
        dynastyGeneration: (ruler.dynastyGeneration || 1) + 1,
      });

      // Initialize legitimacy - inheritance is highly legitimate
      await initializeRulerLegitimacy(ctx, heir._id, "inheritance", args.tick);
    } else {
      // Check for ambitious characters who might seize power
      const candidates = await ctx.db
        .query("characters")
        .withIndex("by_territory", (q) => q.eq("territoryId", ruler.territoryId))
        .filter((q) => q.eq(q.field("isAlive"), true))
        .collect();

      const ambitiousCandidates = candidates.filter(
        (c) => c.traits.ambition > 60 && c._id !== args.characterId
      );

      if (ambitiousCandidates.length >= 2) {
        // Civil war between candidates
        successionType = "civil_war";
        civilWarCasualties = Math.floor(Math.random() * 1000) + 500;

        // The one with highest (courage + cunning + military experience) wins
        const winner = ambitiousCandidates.reduce((best, current) => {
          const bestScore = best.traits.courage + best.traits.cunning;
          const currentScore = current.traits.courage + current.traits.cunning;
          return currentScore > bestScore ? current : best;
        });

        newRulerId = winner._id;

        // Promote winner
        await ctx.db.patch(winner._id, {
          role: "ruler",
          title: "Lord Protector", // Not legitimate ruler
          coronationTick: args.tick,
        });

        // Initialize legitimacy - civil war victor has low legitimacy
        await initializeRulerLegitimacy(ctx, winner._id, "conquest", args.tick);

        // Kill some losers
        for (const loser of ambitiousCandidates) {
          if (loser._id !== winner._id && Math.random() < 0.5) {
            await ctx.db.patch(loser._id, {
              isAlive: false,
              deathTick: args.tick,
              deathCause: "killed in succession war",
            });
          }
        }
      } else if (ambitiousCandidates.length === 1) {
        // Single ambitious character seizes power
        successionType = "coup";
        newRulerId = ambitiousCandidates[0]._id;

        await ctx.db.patch(ambitiousCandidates[0]._id, {
          role: "ruler",
          title: "Usurper",
          coronationTick: args.tick,
        });

        // Initialize legitimacy - coup has lowest legitimacy
        await initializeRulerLegitimacy(ctx, ambitiousCandidates[0]._id, "coup", args.tick);
      } else if (heir) {
        // Heir exists but had low loyalty - contested succession
        successionType = "peaceful";
        newRulerId = heir._id;

        await ctx.db.patch(heir._id, {
          role: "ruler",
          title: ruler.title,
          coronationTick: args.tick,
          dynastyGeneration: (ruler.dynastyGeneration || 1) + 1,
        });

        // Initialize legitimacy - contested inheritance is less legitimate
        await initializeRulerLegitimacy(ctx, heir._id, "inheritance", args.tick);
      } else {
        // No heir, create a new ruler
        newRulerId = await ctx.db.insert("characters", {
          territoryId: ruler.territoryId,
          name: NAME_PREFIXES[Math.floor(Math.random() * NAME_PREFIXES.length)],
          title: "Chief",
          role: "ruler",
          birthTick: args.tick - (35 * 12),
          isAlive: true,
          age: 35,
          traits: generateTraits("ruler"),
          emotionalState: randomEmotionalState(),
          secretGoal: "none",
          relationships: [],
          activePlots: [],
          coronationTick: args.tick,
          deeds: [],
        });
        successionType = "election";

        // Initialize legitimacy - election is reasonably legitimate
        await initializeRulerLegitimacy(ctx, newRulerId, "election", args.tick);
      }
    }

    // Record succession event
    if (newRulerId) {
      const newRuler = await ctx.db.get(newRulerId);
      const narrative = buildSuccessionNarrative(
        ruler,
        newRuler!,
        successionType,
        args.deathCause,
        civilWarCasualties
      );

      await ctx.db.insert("successionEvents", {
        territoryId: ruler.territoryId,
        tick: args.tick,
        deceasedRulerId: args.characterId,
        newRulerId,
        successionType,
        plottersExecuted,
        civilWarCasualties,
        narrative,
      });

      // =============================================
      // ORGANIC AI GROWTH - Inherit bonds to new ruler
      // =============================================
      // Hereditary bonds (grudges, gratitude) pass to the new ruler
      // but with reduced intensity
      await inheritBonds(ctx, ruler.territoryId);
    }

    return {
      success: true,
      successionType,
      newRulerId,
      civilWarCasualties,
    };
  },
});

function buildSuccessionNarrative(
  oldRuler: Doc<"characters">,
  newRuler: Doc<"characters">,
  successionType: string,
  deathCause: string,
  civilWarCasualties?: number
): string {
  switch (successionType) {
    case "peaceful":
      return `Following the ${deathCause} of ${oldRuler.title} ${oldRuler.name}, ${newRuler.title} ${newRuler.name} ascended to power in a peaceful transition.`;
    case "coup":
      return `Upon learning of ${oldRuler.title} ${oldRuler.name}'s ${deathCause}, ${newRuler.name} seized power in a swift coup, declaring themselves ${newRuler.title}.`;
    case "civil_war":
      return `The ${deathCause} of ${oldRuler.title} ${oldRuler.name} sparked a bloody civil war. After ${civilWarCasualties} casualties, ${newRuler.name} emerged victorious as ${newRuler.title}.`;
    case "election":
      return `With no clear heir after ${oldRuler.title} ${oldRuler.name}'s ${deathCause}, the people chose ${newRuler.name} to lead them.`;
    default:
      return `${newRuler.title} ${newRuler.name} came to power following the ${deathCause} of ${oldRuler.title} ${oldRuler.name}.`;
  }
}

// =============================================
// ADD DEED TO CHARACTER
// =============================================

export const addDeed = internalMutation({
  args: {
    characterId: v.id("characters"),
    tick: v.number(),
    description: v.string(),
    type: v.string(),
  },
  handler: async (ctx, args) => {
    const character = await ctx.db.get(args.characterId);
    if (!character) return;

    const newDeeds = [...character.deeds, {
      tick: args.tick,
      description: args.description,
      type: args.type,
    }];

    // Keep only last 20 deeds
    if (newDeeds.length > 20) {
      newDeeds.shift();
    }

    await ctx.db.patch(args.characterId, { deeds: newDeeds });
  },
});
