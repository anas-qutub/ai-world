import { MutationCtx, QueryCtx } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";
import { recordMemory } from "./memory";

// =============================================
// KNOWLEDGE TRANSFER SYSTEM
// =============================================
// New generations can learn from:
// 1. Libraries - stored collective knowledge (reading/studying)
// 2. Schools - formal education (teachers pass on skills)
// 3. Apprenticeships - hands-on learning from masters
// 4. Mentorship - one-on-one guidance from experienced characters
//
// This allows civilizations to advance WITHOUT each generation
// having to rediscover everything through crises and experience.

// =============================================
// LIBRARY SYSTEM
// =============================================

export interface Library {
  territoryId: Id<"territories">;
  name: string;
  scrollCount: number;           // Number of scrolls/books
  knowledgeAreas: string[];      // What subjects are covered
  quality: number;               // 0-100, affects learning speed
  maintenanceCost: number;       // Wealth per tick to maintain
  scholarCapacity: number;       // How many can study at once
  currentScholars: number;
}

// Knowledge areas that can be stored in libraries
export const KNOWLEDGE_AREAS = [
  "history",
  "medicine",
  "engineering",
  "mathematics",
  "law",
  "theology",
  "farming",
  "smithing",
  "masonry",
  "carpentry",
  "tailoring",
  "military_tactics",
  "navigation",
  "astronomy",
  "philosophy",
] as const;

// =============================================
// EDUCATION EFFECTIVENESS
// =============================================

export interface EducationEffectiveness {
  method: "library" | "school" | "apprenticeship" | "mentorship";
  baseSkillGainPerTick: number;     // Base skill points gained
  maxSkillReachable: number;         // Maximum skill level achievable
  requiresLiteracy: boolean;         // Does learner need to read?
  teacherRequired: boolean;          // Needs a teacher/master?
  costPerStudent: number;            // Wealth cost per student per tick
}

export const EDUCATION_METHODS: EducationEffectiveness[] = [
  {
    method: "library",
    baseSkillGainPerTick: 0.5,      // Slow but steady self-study
    maxSkillReachable: 60,           // Can become skilled, not expert
    requiresLiteracy: true,
    teacherRequired: false,
    costPerStudent: 1,
  },
  {
    method: "school",
    baseSkillGainPerTick: 1.0,      // Faster with guidance
    maxSkillReachable: 75,           // Can become quite skilled
    requiresLiteracy: false,         // Teacher can teach orally
    teacherRequired: true,
    costPerStudent: 2,
  },
  {
    method: "apprenticeship",
    baseSkillGainPerTick: 1.5,      // Hands-on is fastest
    maxSkillReachable: 90,           // Can become expert
    requiresLiteracy: false,
    teacherRequired: true,           // Master required
    costPerStudent: 3,
  },
  {
    method: "mentorship",
    baseSkillGainPerTick: 2.0,      // One-on-one is best
    maxSkillReachable: 95,           // Can approach mastery
    requiresLiteracy: false,
    teacherRequired: true,
    costPerStudent: 5,
  },
];

// =============================================
// PROCESS KNOWLEDGE TRANSFER
// =============================================

/**
 * Process all knowledge transfer for a territory
 * - Students learn from schools
 * - Apprentices learn from masters
 * - Scholars study in libraries
 * - Children gain basic skills from community
 */
export async function processKnowledgeTransfer(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  tick: number
): Promise<{
  events: { type: string; description: string }[];
  skillsGained: number;
  graduations: number;
}> {
  const events: { type: string; description: string }[] = [];
  let totalSkillsGained = 0;
  let graduations = 0;

  // 1. Process school education
  const schools = await ctx.db
    .query("schools")
    .withIndex("by_territory", (q: any) => q.eq("territoryId", territoryId))
    .collect();

  for (const school of schools) {
    const result = await processSchoolEducation(ctx, school, tick);
    totalSkillsGained += result.skillsGained;
    graduations += result.graduations;
    events.push(...result.events);
  }

  // 2. Process apprenticeships
  const apprenticeResult = await processApprenticeships(ctx, territoryId, tick);
  totalSkillsGained += apprenticeResult.skillsGained;
  events.push(...apprenticeResult.events);

  // 3. Process library self-study
  const libraryResult = await processLibraryStudy(ctx, territoryId, tick);
  totalSkillsGained += libraryResult.skillsGained;
  events.push(...libraryResult.events);

  // 4. Process community knowledge transfer (children learn basics from adults)
  const communityResult = await processCommunityLearning(ctx, territoryId, tick);
  totalSkillsGained += communityResult.skillsGained;

  return { events, skillsGained: totalSkillsGained, graduations };
}

/**
 * Process education at a school
 */
async function processSchoolEducation(
  ctx: MutationCtx,
  school: Doc<"schools">,
  tick: number
): Promise<{
  events: { type: string; description: string }[];
  skillsGained: number;
  graduations: number;
}> {
  const events: { type: string; description: string }[] = [];
  let skillsGained = 0;
  let graduations = 0;

  // Get students at this school
  const students = await ctx.db
    .query("characters")
    .filter((q: any) => q.eq(q.field("currentlyStudying"), true))
    .collect();

  const schoolStudents = students.filter(s =>
    (s as any).schoolId === school._id ||
    school.studentIds.includes(s._id)
  );

  // Get teachers
  const teachers = school.teacherIds.length > 0
    ? await Promise.all(school.teacherIds.map(id => ctx.db.get(id)))
    : [];

  const validTeachers = teachers.filter(t => t && t.isAlive);

  // No teachers = school can't function
  if (validTeachers.length === 0) {
    return { events, skillsGained: 0, graduations: 0 };
  }

  // Calculate teaching quality
  const avgTeacherSkill = validTeachers.reduce((sum, t) => {
    const skills = t!.skills;
    if (!skills) return sum;

    // Get average of all teaching-relevant skills
    const relevantSkills = ["literacy", "mathematics", "history", "law", "theology", "medicine"];
    let total = 0;
    let count = 0;
    for (const skill of relevantSkills) {
      const level = (skills as any)[skill] || 0;
      if (level > 0) {
        total += level;
        count++;
      }
    }
    return sum + (count > 0 ? total / count : 0);
  }, 0) / Math.max(1, validTeachers.length);

  const teachingQuality = (school.educationQuality + avgTeacherSkill) / 200;

  // Process each student
  for (const student of schoolStudents) {
    if (!student.isAlive) continue;

    const skills = student.skills || createDefaultSkills();
    const studyProgress = student.studyProgress || 0;

    // Determine what subjects to teach based on school type
    const subjectsToLearn = getSubjectsForSchoolType(school.schoolType);

    // Calculate skill gain
    const baseGain = EDUCATION_METHODS.find(m => m.method === "school")!.baseSkillGainPerTick;
    const adjustedGain = baseGain * teachingQuality;

    // Apply skill gains
    let studentSkillsGained = 0;
    const updatedSkills = { ...skills };

    for (const subject of subjectsToLearn) {
      const currentLevel = (updatedSkills as any)[subject] || 0;
      const maxFromSchool = 75; // Schools can get you to 75

      if (currentLevel < maxFromSchool) {
        const gain = Math.min(adjustedGain, maxFromSchool - currentLevel);
        (updatedSkills as any)[subject] = currentLevel + gain;
        studentSkillsGained += gain;
      }
    }

    skillsGained += studentSkillsGained;

    // Update study progress
    const newProgress = Math.min(100, studyProgress + (2 + teachingQuality * 3));

    // Check for graduation
    if (newProgress >= 100) {
      graduations++;

      // Determine new education level
      let newEducationLevel = student.educationLevel || "none";
      if (newEducationLevel === "none") newEducationLevel = "basic";
      else if (newEducationLevel === "basic") newEducationLevel = "intermediate";
      else if (newEducationLevel === "intermediate") newEducationLevel = "advanced";

      await ctx.db.patch(student._id, {
        skills: updatedSkills,
        studyProgress: 0,
        currentlyStudying: false,
        educationLevel: newEducationLevel,
        isLiterate: true, // School teaches literacy
      });

      events.push({
        type: "graduation",
        description: `${student.name} has graduated from ${school.name} with ${newEducationLevel} education!`,
      });

      // Update school enrollment
      await ctx.db.patch(school._id, {
        currentEnrollment: Math.max(0, school.currentEnrollment - 1),
        studentIds: school.studentIds.filter(id => id !== student._id),
      });
    } else {
      await ctx.db.patch(student._id, {
        skills: updatedSkills,
        studyProgress: newProgress,
      });
    }
  }

  return { events, skillsGained, graduations };
}

/**
 * Process apprenticeship learning
 */
async function processApprenticeships(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  tick: number
): Promise<{
  events: { type: string; description: string }[];
  skillsGained: number;
}> {
  const events: { type: string; description: string }[] = [];
  let skillsGained = 0;

  // Get characters with apprentice masters
  const apprentices = await ctx.db
    .query("characters")
    .withIndex("by_territory", (q: any) => q.eq("territoryId", territoryId))
    .filter((q: any) => q.eq(q.field("isAlive"), true))
    .collect();

  const apprenticesWithMasters = apprentices.filter(a => a.apprenticeMasterId);

  for (const apprentice of apprenticesWithMasters) {
    const master = await ctx.db.get(apprentice.apprenticeMasterId!);
    if (!master || !master.isAlive || !master.skills) continue;

    // Get master's profession skills
    const masterProfession = master.profession;
    const relevantSkills = getSkillsForProfession(masterProfession);

    const apprenticeSkills = apprentice.skills || createDefaultSkills();
    const updatedSkills = { ...apprenticeSkills };

    const baseGain = EDUCATION_METHODS.find(m => m.method === "apprenticeship")!.baseSkillGainPerTick;

    for (const skillType of relevantSkills) {
      const masterLevel = (master.skills as any)[skillType] || 0;
      const apprenticeLevel = (updatedSkills as any)[skillType] || 0;

      // Apprentice can learn up to 90% of master's skill
      const maxLearnable = Math.floor(masterLevel * 0.9);

      if (apprenticeLevel < maxLearnable) {
        // Learning speed depends on difference and master's teaching ability
        const teachingModifier = ((master.traits.wisdom || 50) + (master.traits.charisma || 50)) / 200;
        const gain = Math.min(baseGain * teachingModifier, maxLearnable - apprenticeLevel);

        (updatedSkills as any)[skillType] = apprenticeLevel + gain;
        skillsGained += gain;
      }
    }

    // Update apprentice
    await ctx.db.patch(apprentice._id, {
      skills: updatedSkills,
      professionYearsExperience: (apprentice.professionYearsExperience || 0) + (1/12), // Monthly increment
    });

    // Check if apprentice is ready to become journeyman (avg skill > 40)
    const avgSkill = relevantSkills.reduce((sum, s) => sum + ((updatedSkills as any)[s] || 0), 0) / relevantSkills.length;
    if (avgSkill >= 40 && apprentice.guildRank === "apprentice") {
      events.push({
        type: "apprentice_promotion",
        description: `${apprentice.name} has learned enough from master ${master.name} to become a journeyman!`,
      });
    }
  }

  return { events, skillsGained };
}

/**
 * Process self-study at libraries
 */
async function processLibraryStudy(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  tick: number
): Promise<{
  events: { type: string; description: string }[];
  skillsGained: number;
}> {
  const events: { type: string; description: string }[] = [];
  let skillsGained = 0;

  // Get all literate characters who might study
  const scholars = await ctx.db
    .query("characters")
    .withIndex("by_territory", (q: any) => q.eq("territoryId", territoryId))
    .filter((q: any) => q.and(
      q.eq(q.field("isAlive"), true),
      q.eq(q.field("isLiterate"), true)
    ))
    .collect();

  // Get knowledge infrastructure (will be used when library table exists)
  const territory = await ctx.db.get(territoryId);
  const knowledgeLevel = territory?.knowledge || 0;

  // Scholars with professions that benefit from reading
  const studyingScholars = scholars.filter(s =>
    s.profession === "scholar" ||
    s.profession === "scribe" ||
    s.profession === "physician" ||
    s.profession === "engineer" ||
    s.profession === "teacher"
  );

  const baseGain = EDUCATION_METHODS.find(m => m.method === "library")!.baseSkillGainPerTick;
  const libraryBonus = Math.min(1.5, 1 + (knowledgeLevel / 100)); // Up to 1.5x from territory knowledge

  for (const scholar of studyingScholars) {
    const skills = scholar.skills || createDefaultSkills();
    const updatedSkills = { ...skills };

    // Scholars study their profession-relevant subjects
    const studySubjects = getSkillsForProfession(scholar.profession);

    for (const subject of studySubjects) {
      const currentLevel = (updatedSkills as any)[subject] || 0;
      const maxFromLibrary = 60; // Self-study caps at 60

      if (currentLevel < maxFromLibrary) {
        const gain = Math.min(
          baseGain * libraryBonus,
          maxFromLibrary - currentLevel
        );
        (updatedSkills as any)[subject] = currentLevel + gain;
        skillsGained += gain;
      }
    }

    await ctx.db.patch(scholar._id, {
      skills: updatedSkills,
    });
  }

  return { events, skillsGained };
}

/**
 * Process community learning - children learn basics from watching adults
 */
async function processCommunityLearning(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  tick: number
): Promise<{ skillsGained: number }> {
  let skillsGained = 0;

  // Get children (under 16)
  const characters = await ctx.db
    .query("characters")
    .withIndex("by_territory", (q: any) => q.eq("territoryId", territoryId))
    .filter((q: any) => q.eq(q.field("isAlive"), true))
    .collect();

  const children = characters.filter(c => (c.age || 0) < 16 && c.lifeStage === "child");
  const adults = characters.filter(c => (c.age || 0) >= 16 && c.isAlive);

  if (adults.length === 0) return { skillsGained: 0 };

  // Calculate what skills are common in the community
  const communitySkills: Record<string, number> = {};
  for (const adult of adults) {
    if (!adult.skills) continue;
    for (const [skill, level] of Object.entries(adult.skills)) {
      if (typeof level !== "number" || level <= 0) continue;
      if (!communitySkills[skill]) communitySkills[skill] = 0;
      communitySkills[skill] = Math.max(communitySkills[skill], level);
    }
  }

  // Children absorb basics (up to 15% of community max)
  for (const child of children) {
    const childSkills = child.skills || createDefaultSkills();
    const updatedSkills = { ...childSkills };

    for (const [skill, maxLevel] of Object.entries(communitySkills)) {
      const currentLevel = (updatedSkills as any)[skill] || 0;
      const learningCap = Math.floor(maxLevel * 0.15); // Children can absorb 15% just by watching

      if (currentLevel < learningCap) {
        const gain = Math.min(0.2, learningCap - currentLevel); // Slow passive learning
        (updatedSkills as any)[skill] = currentLevel + gain;
        skillsGained += gain;
      }
    }

    await ctx.db.patch(child._id, {
      skills: updatedSkills,
    });
  }

  return { skillsGained };
}

// =============================================
// HELPER FUNCTIONS
// =============================================

function createDefaultSkills(): Doc<"characters">["skills"] {
  return {
    melee: 0,
    ranged: 0,
    tactics: 0,
    smithing: 0,
    carpentry: 0,
    masonry: 0,
    tailoring: 0,
    literacy: 0,
    mathematics: 0,
    medicine: 0,
    engineering: 0,
    law: 0,
    theology: 0,
    history: 0,
    persuasion: 0,
    intimidation: 0,
    negotiation: 0,
    trading: 0,
    farming: 0,
    animalcare: 0,
    mining: 0,
  };
}

function getSubjectsForSchoolType(schoolType: Doc<"schools">["schoolType"]): string[] {
  switch (schoolType) {
    case "primary":
      return ["literacy", "mathematics"];
    case "secondary":
      return ["literacy", "mathematics", "history", "law"];
    case "university":
      return ["literacy", "mathematics", "history", "law", "engineering", "medicine"];
    case "military_academy":
      return ["melee", "ranged", "tactics"];
    case "religious_school":
      return ["literacy", "theology", "history"];
    case "trade_school":
      return ["smithing", "carpentry", "masonry", "tailoring", "trading"];
    case "medical_school":
      return ["medicine", "literacy"];
    case "law_school":
      return ["law", "literacy", "history", "persuasion"];
    default:
      return ["literacy"];
  }
}

function getSkillsForProfession(profession?: string): string[] {
  if (!profession) return [];

  const professionSkills: Record<string, string[]> = {
    scholar: ["literacy", "mathematics", "history", "theology"],
    scribe: ["literacy", "history"],
    physician: ["medicine", "literacy"],
    engineer: ["engineering", "mathematics", "masonry"],
    teacher: ["literacy", "mathematics", "history"],
    blacksmith: ["smithing"],
    carpenter: ["carpentry"],
    mason: ["masonry", "engineering"],
    weaver: ["tailoring"],
    farmer: ["farming", "animalcare"],
    merchant: ["trading", "negotiation"],
    soldier: ["melee", "ranged", "tactics"],
    general: ["tactics", "melee"],
    priest: ["theology", "literacy"],
    judge: ["law", "literacy"],
    miner: ["mining"],
  };

  return professionSkills[profession] || [];
}

/**
 * Enroll a child in school
 */
export async function enrollInSchool(
  ctx: MutationCtx,
  characterId: Id<"characters">,
  schoolId: Id<"schools">
): Promise<{ success: boolean; message: string }> {
  const character = await ctx.db.get(characterId);
  const school = await ctx.db.get(schoolId);

  if (!character || !school) {
    return { success: false, message: "Character or school not found" };
  }

  if (!character.isAlive) {
    return { success: false, message: "Character is not alive" };
  }

  if (school.currentEnrollment >= school.studentCapacity) {
    return { success: false, message: "School is at capacity" };
  }

  // Check minimum literacy for some schools
  if (school.minimumLiteracy > 0) {
    const literacy = character.skills?.literacy || 0;
    if (literacy < school.minimumLiteracy) {
      return { success: false, message: `Character needs at least ${school.minimumLiteracy} literacy` };
    }
  }

  // Enroll
  await ctx.db.patch(characterId, {
    currentlyStudying: true,
    studyProgress: 0,
  });

  await ctx.db.patch(schoolId, {
    currentEnrollment: school.currentEnrollment + 1,
    studentIds: [...school.studentIds, characterId],
  });

  return { success: true, message: `${character.name} enrolled in ${school.name}` };
}

/**
 * Assign an apprentice to a master
 */
export async function assignApprentice(
  ctx: MutationCtx,
  apprenticeId: Id<"characters">,
  masterId: Id<"characters">
): Promise<{ success: boolean; message: string }> {
  const apprentice = await ctx.db.get(apprenticeId);
  const master = await ctx.db.get(masterId);

  if (!apprentice || !master) {
    return { success: false, message: "Character not found" };
  }

  if (!apprentice.isAlive || !master.isAlive) {
    return { success: false, message: "Both characters must be alive" };
  }

  if (apprentice.territoryId !== master.territoryId) {
    return { success: false, message: "Characters must be in the same territory" };
  }

  // Master must have reasonable skill
  const masterSkills = master.skills;
  if (!masterSkills) {
    return { success: false, message: "Master has no skills to teach" };
  }

  const relevantSkills = getSkillsForProfession(master.profession);
  const avgMasterSkill = relevantSkills.reduce(
    (sum, s) => sum + ((masterSkills as any)[s] || 0), 0
  ) / Math.max(1, relevantSkills.length);

  if (avgMasterSkill < 40) {
    return { success: false, message: "Master needs at least 40 skill to teach" };
  }

  await ctx.db.patch(apprenticeId, {
    apprenticeMasterId: masterId,
    profession: master.profession,
    guildRank: "apprentice",
  });

  return { success: true, message: `${apprentice.name} is now apprenticed to ${master.name}` };
}

/**
 * Get education summary for AI prompt
 */
export async function getEducationSummary(
  ctx: QueryCtx,
  territoryId: Id<"territories">
): Promise<string> {
  const schools = await ctx.db
    .query("schools")
    .withIndex("by_territory", (q: any) => q.eq("territoryId", territoryId))
    .collect();

  const characters = await ctx.db
    .query("characters")
    .withIndex("by_territory", (q: any) => q.eq("territoryId", territoryId))
    .filter((q: any) => q.eq(q.field("isAlive"), true))
    .collect();

  const literateCount = characters.filter(c => c.isLiterate).length;
  const studyingCount = characters.filter(c => c.currentlyStudying).length;
  const apprenticeCount = characters.filter(c => c.apprenticeMasterId).length;
  const childCount = characters.filter(c => (c.age || 0) < 16).length;

  const lines: string[] = [];

  lines.push(`Literacy: ${literateCount}/${characters.length} can read and write`);

  if (schools.length > 0) {
    lines.push(`Schools: ${schools.length} (${schools.map(s => s.schoolType).join(", ")})`);
    const totalStudents = schools.reduce((sum, s) => sum + s.currentEnrollment, 0);
    const totalCapacity = schools.reduce((sum, s) => sum + s.studentCapacity, 0);
    lines.push(`Students enrolled: ${totalStudents}/${totalCapacity}`);
  } else {
    lines.push("No schools - children learn only from watching adults");
  }

  if (apprenticeCount > 0) {
    lines.push(`Apprentices learning trades: ${apprenticeCount}`);
  }

  if (childCount > 0) {
    const schooledChildren = characters.filter(
      c => (c.age || 0) < 16 && c.currentlyStudying
    ).length;
    if (schooledChildren === 0) {
      lines.push(`Children: ${childCount} (none in school - consider building schools!)`);
    } else {
      lines.push(`Children: ${childCount} (${schooledChildren} in school)`);
    }
  }

  return lines.join("\n");
}
