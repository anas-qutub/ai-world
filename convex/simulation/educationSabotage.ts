import { MutationCtx, QueryCtx } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";
import { recordMemory } from "./memory";

// =============================================
// EDUCATION SABOTAGE & DISRUPTION SYSTEM
// =============================================
// Civilizations can disrupt rival education systems through:
// - Espionage (burn libraries, assassinate scholars)
// - Warfare (destroy schools during sieges)
// - Covert ops (spread misinformation, steal knowledge)
// - Economic warfare (bribe scholars to defect)

// =============================================
// SABOTAGE MISSION TYPES
// =============================================

export type EducationSabotageType =
  | "burn_library"           // Destroy stored knowledge
  | "sabotage_school"        // Disrupt education operations
  | "assassinate_scholar"    // Kill key knowledge holders
  | "steal_scrolls"          // Take their knowledge for yourself
  | "spread_misinformation"  // Corrupt their knowledge base
  | "poison_teachers"        // Incapacitate educators
  | "bribe_scholar_defect"   // Recruit their best minds
  | "destroy_university"     // Major blow to advanced learning
  | "kidnap_apprentices"     // Steal their future workforce
  | "burn_trade_school"      // Cripple their skilled labor pipeline
  | "infiltrate_academy"     // Plant agent for long-term disruption
  | "forge_credentials"      // Create incompetent "experts"
  | "incite_student_riot"    // Turn students against teachers
  | "corrupt_curriculum";    // Introduce flawed teachings

export interface SabotageResult {
  success: boolean;
  detected: boolean;
  message: string;
  knowledgeLost?: number;
  schoolsDestroyed?: number;
  scholarsKilled?: number;
  scrollsStolen?: number;
  misinformationSpread?: boolean;
  scholarDefected?: boolean;
  warDeclared?: boolean;  // If caught, may cause war
}

// Sabotage difficulty and effects
const SABOTAGE_CONFIG: Record<EducationSabotageType, {
  baseDifficulty: number;    // 0-100, higher = harder
  detectChance: number;      // Base chance of being caught
  knowledgeDamage: number;   // How much knowledge is lost
  happinessDamage: number;   // Impact on target happiness
  relationsDamage: number;   // Trust lost if detected
  warRisk: number;           // Chance this causes war if detected
  description: string;
}> = {
  burn_library: {
    baseDifficulty: 60,
    detectChance: 40,
    knowledgeDamage: 25,
    happinessDamage: 15,
    relationsDamage: 50,
    warRisk: 30,
    description: "Burn their library to ashes, destroying generations of accumulated knowledge",
  },
  sabotage_school: {
    baseDifficulty: 40,
    detectChance: 30,
    knowledgeDamage: 10,
    happinessDamage: 10,
    relationsDamage: 30,
    warRisk: 15,
    description: "Damage school buildings, scatter students, disrupt education for months",
  },
  assassinate_scholar: {
    baseDifficulty: 70,
    detectChance: 50,
    knowledgeDamage: 15,
    happinessDamage: 20,
    relationsDamage: 60,
    warRisk: 40,
    description: "Kill a key scholar, eliminating irreplaceable expertise",
  },
  steal_scrolls: {
    baseDifficulty: 50,
    detectChance: 35,
    knowledgeDamage: 10,
    happinessDamage: 5,
    relationsDamage: 40,
    warRisk: 20,
    description: "Steal valuable scrolls and texts, taking their knowledge for yourself",
  },
  spread_misinformation: {
    baseDifficulty: 45,
    detectChance: 20,
    knowledgeDamage: 8,
    happinessDamage: 5,
    relationsDamage: 25,
    warRisk: 10,
    description: "Introduce false knowledge that will set their progress back",
  },
  poison_teachers: {
    baseDifficulty: 55,
    detectChance: 45,
    knowledgeDamage: 12,
    happinessDamage: 25,
    relationsDamage: 55,
    warRisk: 35,
    description: "Poison teachers to incapacitate or kill educators",
  },
  bribe_scholar_defect: {
    baseDifficulty: 65,
    detectChance: 40,
    knowledgeDamage: 5,
    happinessDamage: 10,
    relationsDamage: 35,
    warRisk: 15,
    description: "Bribe a scholar to defect to your civilization with their knowledge",
  },
  destroy_university: {
    baseDifficulty: 80,
    detectChance: 60,
    knowledgeDamage: 40,
    happinessDamage: 30,
    relationsDamage: 70,
    warRisk: 60,
    description: "Destroy their university, crippling advanced learning for years",
  },
  kidnap_apprentices: {
    baseDifficulty: 50,
    detectChance: 45,
    knowledgeDamage: 5,
    happinessDamage: 20,
    relationsDamage: 45,
    warRisk: 25,
    description: "Kidnap promising apprentices to work for your civilization",
  },
  burn_trade_school: {
    baseDifficulty: 55,
    detectChance: 35,
    knowledgeDamage: 15,
    happinessDamage: 15,
    relationsDamage: 40,
    warRisk: 20,
    description: "Burn their trade school, crippling skilled worker production",
  },
  infiltrate_academy: {
    baseDifficulty: 70,
    detectChance: 25,
    knowledgeDamage: 3,
    happinessDamage: 0,
    relationsDamage: 50,
    warRisk: 30,
    description: "Plant a long-term agent in their academy to continuously disrupt",
  },
  forge_credentials: {
    baseDifficulty: 55,
    detectChance: 30,
    knowledgeDamage: 5,
    happinessDamage: 5,
    relationsDamage: 20,
    warRisk: 5,
    description: "Create fake credentials for incompetent 'experts' to harm their workforce",
  },
  incite_student_riot: {
    baseDifficulty: 50,
    detectChance: 35,
    knowledgeDamage: 5,
    happinessDamage: 15,
    relationsDamage: 30,
    warRisk: 10,
    description: "Incite students to riot against their teachers and institutions",
  },
  corrupt_curriculum: {
    baseDifficulty: 60,
    detectChance: 15,
    knowledgeDamage: 12,
    happinessDamage: 0,
    relationsDamage: 40,
    warRisk: 15,
    description: "Subtly corrupt their teachings with flawed methods and false information",
  },
};

// =============================================
// EXECUTE SABOTAGE MISSION
// =============================================

export async function executeEducationSabotage(
  ctx: MutationCtx,
  attackerTerritoryId: Id<"territories">,
  targetTerritoryId: Id<"territories">,
  sabotageType: EducationSabotageType,
  spyId?: Id<"spies">,
  tick: number = 0
): Promise<SabotageResult> {
  const attacker = await ctx.db.get(attackerTerritoryId);
  const target = await ctx.db.get(targetTerritoryId);

  if (!attacker || !target) {
    return { success: false, detected: false, message: "Territory not found" };
  }

  const config = SABOTAGE_CONFIG[sabotageType];

  // Get spy skill if using a spy
  let spySkill = 50; // Default skill for non-spy operations
  let spy: Doc<"spies"> | null = null;
  if (spyId) {
    spy = await ctx.db.get(spyId);
    if (spy) {
      spySkill = spy.skill;
    }
  }

  // Calculate success chance
  const skillModifier = (spySkill - 50) / 2; // +/- 25% based on skill
  const successChance = Math.max(10, Math.min(90,
    (100 - config.baseDifficulty) + skillModifier
  ));

  // Calculate detection chance
  const targetCounterIntel = target.spyNetwork?.counterIntelligence || 10;
  const detectionChance = Math.max(5, Math.min(95,
    config.detectChance + (targetCounterIntel / 2) - (spySkill / 4)
  ));

  // Roll for success
  const successRoll = Math.random() * 100;
  const success = successRoll < successChance;

  // Roll for detection (can be detected even if successful)
  const detectionRoll = Math.random() * 100;
  const detected = detectionRoll < detectionChance;

  const result: SabotageResult = {
    success,
    detected,
    message: "",
  };

  if (success) {
    // Apply sabotage effects
    await applySabotageEffects(ctx, target, sabotageType, config, result, tick);
    result.message = `${sabotageType.replace(/_/g, " ")} successful! ${config.description}`;

    // Attacker gains from certain sabotage types
    if (sabotageType === "steal_scrolls") {
      await ctx.db.patch(attackerTerritoryId, {
        knowledge: Math.min(100, attacker.knowledge + 5),
      });
      result.scrollsStolen = 5;
    }

    if (sabotageType === "bribe_scholar_defect") {
      result.scholarDefected = await processScholarDefection(ctx, targetTerritoryId, attackerTerritoryId, tick);
      if (result.scholarDefected) {
        await ctx.db.patch(attackerTerritoryId, {
          knowledge: Math.min(100, attacker.knowledge + 8),
        });
      }
    }

    // Record memory for attacker
    const attackerAgent = await ctx.db
      .query("agents")
      .withIndex("by_territory", (q: any) => q.eq("territoryId", attackerTerritoryId))
      .first();
    if (attackerAgent) {
      await recordMemory(ctx, attackerAgent._id, {
        type: "victory",
        description: `Our agents successfully executed ${sabotageType.replace(/_/g, " ")} against ${target.name}!`,
        emotionalWeight: 30,
        targetTerritoryId,
      });
    }
  } else {
    result.message = `${sabotageType.replace(/_/g, " ")} failed! The mission was unsuccessful.`;

    // If spy was used and mission failed, they may be captured
    if (spy && Math.random() < 0.3) {
      await ctx.db.patch(spy._id, {
        status: "captured",
        discoveryRisk: 100,
      });
      result.message += " Your spy was captured!";
    }
  }

  if (detected) {
    // Handle detection consequences
    await handleDetection(ctx, attackerTerritoryId, targetTerritoryId, sabotageType, config, result, tick);
  }

  return result;
}

// =============================================
// APPLY SABOTAGE EFFECTS
// =============================================

async function applySabotageEffects(
  ctx: MutationCtx,
  target: Doc<"territories">,
  sabotageType: EducationSabotageType,
  config: typeof SABOTAGE_CONFIG[EducationSabotageType],
  result: SabotageResult,
  tick: number
): Promise<void> {
  // Apply knowledge damage
  if (config.knowledgeDamage > 0) {
    await ctx.db.patch(target._id, {
      knowledge: Math.max(0, target.knowledge - config.knowledgeDamage),
    });
    result.knowledgeLost = config.knowledgeDamage;
  }

  // Apply happiness damage
  if (config.happinessDamage > 0) {
    await ctx.db.patch(target._id, {
      happiness: Math.max(0, target.happiness - config.happinessDamage),
    });
  }

  // Type-specific effects
  switch (sabotageType) {
    case "burn_library":
    case "destroy_university":
    case "burn_trade_school":
    case "sabotage_school":
      await destroySchools(ctx, target._id, sabotageType, result);
      break;

    case "assassinate_scholar":
    case "poison_teachers":
      await killEducators(ctx, target._id, sabotageType, result);
      break;

    case "spread_misinformation":
    case "corrupt_curriculum":
      await applyMisinformation(ctx, target._id, tick);
      result.misinformationSpread = true;
      break;

    case "kidnap_apprentices":
      await removeApprentices(ctx, target._id, result);
      break;

    case "incite_student_riot":
      await causeStudentRiot(ctx, target._id, tick);
      break;

    case "infiltrate_academy":
      await plantAcademyAgent(ctx, target._id, tick);
      break;

    case "forge_credentials":
      await createFakeExperts(ctx, target._id, tick);
      break;
  }

  // Record trauma for target territory
  const targetAgent = await ctx.db
    .query("agents")
    .withIndex("by_territory", (q: any) => q.eq("territoryId", target._id))
    .first();
  if (targetAgent) {
    await recordMemory(ctx, targetAgent._id, {
      type: "crisis",
      description: `Our education system was sabotaged! ${sabotageType.replace(/_/g, " ")} caused severe damage.`,
      emotionalWeight: -40,
    });
  }
}

// =============================================
// SPECIFIC SABOTAGE IMPLEMENTATIONS
// =============================================

async function destroySchools(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  sabotageType: EducationSabotageType,
  result: SabotageResult
): Promise<void> {
  const schools = await ctx.db
    .query("schools")
    .withIndex("by_territory", (q: any) => q.eq("territoryId", territoryId))
    .collect();

  if (schools.length === 0) return;

  // Determine which schools to target based on sabotage type
  let targetSchools: typeof schools = [];

  switch (sabotageType) {
    case "burn_library":
      targetSchools = schools.filter(s => s.schoolType === "library" as any);
      break;
    case "destroy_university":
      targetSchools = schools.filter(s => s.schoolType === "university");
      break;
    case "burn_trade_school":
      targetSchools = schools.filter(s => s.schoolType === "trade_school");
      break;
    case "sabotage_school":
      // Target a random school
      targetSchools = [schools[Math.floor(Math.random() * schools.length)]];
      break;
  }

  // If no specific type found, target any school
  if (targetSchools.length === 0 && schools.length > 0) {
    targetSchools = [schools[Math.floor(Math.random() * schools.length)]];
  }

  // Destroy or damage the schools
  for (const school of targetSchools) {
    if (sabotageType === "destroy_university" || sabotageType === "burn_library") {
      // Complete destruction
      await ctx.db.delete(school._id);
      result.schoolsDestroyed = (result.schoolsDestroyed || 0) + 1;
    } else {
      // Partial damage - reduce quality and enrollment
      await ctx.db.patch(school._id, {
        educationQuality: Math.max(10, school.educationQuality - 30),
        currentEnrollment: Math.max(0, school.currentEnrollment - 5),
      });
    }
  }
}

async function killEducators(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  sabotageType: EducationSabotageType,
  result: SabotageResult
): Promise<void> {
  const educators = await ctx.db
    .query("characters")
    .withIndex("by_territory", (q: any) => q.eq("territoryId", territoryId))
    .filter((q: any) => q.and(
      q.eq(q.field("isAlive"), true),
      q.or(
        q.eq(q.field("profession"), "scholar"),
        q.eq(q.field("profession"), "teacher"),
        q.eq(q.field("profession"), "scribe")
      )
    ))
    .collect();

  if (educators.length === 0) return;

  // Target 1-3 educators based on sabotage type
  const targetCount = sabotageType === "assassinate_scholar" ? 1 : Math.min(3, educators.length);
  const targets = educators
    .sort(() => Math.random() - 0.5)
    .slice(0, targetCount);

  for (const target of targets) {
    if (sabotageType === "assassinate_scholar") {
      // Kill the scholar
      await ctx.db.patch(target._id, {
        isAlive: false,
        deathTick: Date.now(),
        causeOfDeath: "assassination",
      });
      result.scholarsKilled = (result.scholarsKilled || 0) + 1;
    } else {
      // Poison - incapacitate for a while
      await ctx.db.patch(target._id, {
        mentalHealth: {
          ...(target.mentalHealth || {
            sanity: 100,
            trauma: 0,
            depression: 0,
            anxiety: 0,
            ptsd: false,
            inTherapy: false,
          }),
          sanity: Math.max(0, (target.mentalHealth?.sanity || 100) - 40),
          trauma: Math.min(100, (target.mentalHealth?.trauma || 0) + 30),
        },
      });
    }
  }
}

async function applyMisinformation(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  tick: number
): Promise<void> {
  // Create a misinformation record that will affect learning
  const territory = await ctx.db.get(territoryId);
  if (!territory) return;

  // Reduce knowledge over time through corrupted teachings
  await ctx.db.patch(territoryId, {
    knowledge: Math.max(0, territory.knowledge - 5),
  });

  // Mark schools as having corrupted curriculum
  const schools = await ctx.db
    .query("schools")
    .withIndex("by_territory", (q: any) => q.eq("territoryId", territoryId))
    .collect();

  for (const school of schools) {
    await ctx.db.patch(school._id, {
      educationQuality: Math.max(20, school.educationQuality - 15),
    });
  }
}

async function removeApprentices(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  result: SabotageResult
): Promise<void> {
  const apprentices = await ctx.db
    .query("characters")
    .withIndex("by_territory", (q: any) => q.eq("territoryId", territoryId))
    .filter((q: any) => q.and(
      q.eq(q.field("isAlive"), true),
      q.neq(q.field("apprenticeMasterId"), undefined)
    ))
    .collect();

  if (apprentices.length === 0) return;

  // Kidnap 1-3 apprentices
  const targetCount = Math.min(3, apprentices.length);
  const targets = apprentices
    .sort(() => Math.random() - 0.5)
    .slice(0, targetCount);

  for (const apprentice of targets) {
    // Remove them from their master and territory (they become "missing")
    await ctx.db.patch(apprentice._id, {
      apprenticeMasterId: undefined,
      isAlive: false, // Effectively removed
      causeOfDeath: "kidnapped",
    });
  }
}

async function causeStudentRiot(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  tick: number
): Promise<void> {
  const territory = await ctx.db.get(territoryId);
  if (!territory) return;

  // Cause unrest
  await ctx.db.patch(territoryId, {
    happiness: Math.max(0, territory.happiness - 10),
  });

  // Temporarily close schools (reduce enrollment)
  const schools = await ctx.db
    .query("schools")
    .withIndex("by_territory", (q: any) => q.eq("territoryId", territoryId))
    .collect();

  for (const school of schools) {
    await ctx.db.patch(school._id, {
      currentEnrollment: Math.max(0, school.currentEnrollment - 3),
    });
  }
}

async function plantAcademyAgent(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  tick: number
): Promise<void> {
  // Create a hidden saboteur that will slowly degrade education
  // This is tracked through a territory flag
  const territory = await ctx.db.get(territoryId);
  if (!territory) return;

  // Mark territory as having an infiltrator
  // In a full implementation, this would create a special record
  await ctx.db.patch(territoryId, {
    knowledge: Math.max(0, territory.knowledge - 2),
  });
}

async function createFakeExperts(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  tick: number
): Promise<void> {
  // Create characters with fake high skills that will actually harm production
  const territory = await ctx.db.get(territoryId);
  if (!territory) return;

  // This causes gradual degradation as fake experts mess things up
  await ctx.db.patch(territoryId, {
    knowledge: Math.max(0, territory.knowledge - 3),
  });
}

async function processScholarDefection(
  ctx: MutationCtx,
  fromTerritoryId: Id<"territories">,
  toTerritoryId: Id<"territories">,
  tick: number
): Promise<boolean> {
  const scholars = await ctx.db
    .query("characters")
    .withIndex("by_territory", (q: any) => q.eq("territoryId", fromTerritoryId))
    .filter((q: any) => q.and(
      q.eq(q.field("isAlive"), true),
      q.eq(q.field("profession"), "scholar")
    ))
    .collect();

  if (scholars.length === 0) return false;

  // Pick a random scholar to defect
  const defector = scholars[Math.floor(Math.random() * scholars.length)];

  // Move them to the new territory
  await ctx.db.patch(defector._id, {
    territoryId: toTerritoryId,
  });

  return true;
}

// =============================================
// HANDLE DETECTION
// =============================================

async function handleDetection(
  ctx: MutationCtx,
  attackerTerritoryId: Id<"territories">,
  targetTerritoryId: Id<"territories">,
  sabotageType: EducationSabotageType,
  config: typeof SABOTAGE_CONFIG[EducationSabotageType],
  result: SabotageResult,
  tick: number
): Promise<void> {
  const attacker = await ctx.db.get(attackerTerritoryId);
  const target = await ctx.db.get(targetTerritoryId);

  if (!attacker || !target) return;

  result.message += ` WARNING: Your involvement was detected by ${target.name}!`;

  // Damage relations
  const relationship = await ctx.db
    .query("relationships")
    .filter((q: any) => q.or(
      q.and(
        q.eq(q.field("territory1Id"), attackerTerritoryId),
        q.eq(q.field("territory2Id"), targetTerritoryId)
      ),
      q.and(
        q.eq(q.field("territory1Id"), targetTerritoryId),
        q.eq(q.field("territory2Id"), attackerTerritoryId)
      )
    ))
    .first();

  if (relationship) {
    await ctx.db.patch(relationship._id, {
      trust: Math.max(-100, relationship.trust - config.relationsDamage),
    });
  }

  // Check if this triggers war
  const warRoll = Math.random() * 100;
  if (warRoll < config.warRisk) {
    result.warDeclared = true;
    result.message += ` ${target.name} has declared WAR in retaliation!`;

    if (relationship) {
      await ctx.db.patch(relationship._id, {
        status: "at_war",
        warExhaustion: 0,
        warStartTick: tick,
        warCasusBelli: `Education sabotage: ${sabotageType.replace(/_/g, " ")}`,
      });
    }

    // Create war event
    await ctx.db.insert("events", {
      tick,
      type: "war",
      territoryId: targetTerritoryId,
      targetTerritoryId: attackerTerritoryId,
      title: "War Declared - Sabotage Retaliation!",
      description: `${target.name} has declared war on ${attacker.name} after discovering their involvement in ${sabotageType.replace(/_/g, " ")}!`,
      severity: "critical",
      createdAt: Date.now(),
    });
  }

  // Record memory for target
  const targetAgent = await ctx.db
    .query("agents")
    .withIndex("by_territory", (q: any) => q.eq("territoryId", targetTerritoryId))
    .first();
  if (targetAgent) {
    await recordMemory(ctx, targetAgent._id, {
      type: "betrayal",
      description: `We discovered that ${attacker.name} sabotaged our education system through ${sabotageType.replace(/_/g, " ")}! This treachery will not be forgotten.`,
      emotionalWeight: -60,
      targetTerritoryId: attackerTerritoryId,
    });
  }
}

// =============================================
// CHECK VULNERABILITY
// =============================================

export async function getEducationVulnerability(
  ctx: QueryCtx,
  territoryId: Id<"territories">
): Promise<{
  overallVulnerability: number;
  vulnerableTargets: Array<{
    type: string;
    name: string;
    vulnerability: number;
  }>;
  counterIntelligence: number;
}> {
  const territory = await ctx.db.get(territoryId);
  if (!territory) {
    return { overallVulnerability: 0, vulnerableTargets: [], counterIntelligence: 0 };
  }

  const schools = await ctx.db
    .query("schools")
    .withIndex("by_territory", (q: any) => q.eq("territoryId", territoryId))
    .collect();

  const scholars = await ctx.db
    .query("characters")
    .withIndex("by_territory", (q: any) => q.eq("territoryId", territoryId))
    .filter((q: any) => q.and(
      q.eq(q.field("isAlive"), true),
      q.or(
        q.eq(q.field("profession"), "scholar"),
        q.eq(q.field("profession"), "teacher")
      )
    ))
    .collect();

  const counterIntel = territory.spyNetwork?.counterIntelligence || 10;
  const vulnerableTargets: Array<{ type: string; name: string; vulnerability: number }> = [];

  // Add schools as targets
  for (const school of schools) {
    const vulnerability = Math.max(10, 70 - counterIntel - school.educationQuality / 2);
    vulnerableTargets.push({
      type: school.schoolType,
      name: school.name,
      vulnerability,
    });
  }

  // Add key scholars as targets
  for (const scholar of scholars.slice(0, 5)) {
    const vulnerability = Math.max(10, 60 - counterIntel);
    vulnerableTargets.push({
      type: "scholar",
      name: scholar.name,
      vulnerability,
    });
  }

  const overallVulnerability = vulnerableTargets.length > 0
    ? vulnerableTargets.reduce((sum, t) => sum + t.vulnerability, 0) / vulnerableTargets.length
    : 0;

  return {
    overallVulnerability,
    vulnerableTargets,
    counterIntelligence: counterIntel,
  };
}
