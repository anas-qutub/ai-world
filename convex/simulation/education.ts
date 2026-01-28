import { MutationCtx, QueryCtx } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";

// =============================================
// EDUCATION & LITERACY SYSTEM
// =============================================
// Characters can attend schools to improve literacy, learn skills,
// and advance their education level.

// Education level requirements and effects
export const EDUCATION_LEVELS = {
  none: {
    literacyRequired: 0,
    skillBonus: 0,
    jobsUnlocked: ["farmer", "laborer", "miner", "herder", "servant", "slave"],
    ticksToAdvance: 0,
  },
  basic: {
    literacyRequired: 20,
    skillBonus: 5,
    jobsUnlocked: ["soldier", "guard", "craftsman", "trader", "innkeeper"],
    ticksToAdvance: 24, // 2 years
  },
  intermediate: {
    literacyRequired: 50,
    skillBonus: 10,
    jobsUnlocked: ["merchant", "scribe", "priest", "administrator"],
    ticksToAdvance: 36, // 3 years
  },
  advanced: {
    literacyRequired: 75,
    skillBonus: 20,
    jobsUnlocked: ["scholar", "physician", "engineer", "judge", "diplomat"],
    ticksToAdvance: 48, // 4 years
  },
  master: {
    literacyRequired: 90,
    skillBonus: 30,
    jobsUnlocked: ["teacher", "alchemist", "general", "oracle"],
    ticksToAdvance: 60, // 5 years
  },
};

// School type configurations
export const SCHOOL_TYPES = {
  primary: {
    subjectsTaught: ["literacy", "mathematics"],
    maxEducationLevel: "basic",
    minimumAge: 6,
    minimumLiteracy: 0,
    baseTuition: 5,
    baseCapacity: 30,
    teacherRatio: 15, // Students per teacher
  },
  secondary: {
    subjectsTaught: ["literacy", "mathematics", "history", "theology"],
    maxEducationLevel: "intermediate",
    minimumAge: 12,
    minimumLiteracy: 20,
    baseTuition: 15,
    baseCapacity: 20,
    teacherRatio: 10,
  },
  university: {
    subjectsTaught: ["literacy", "mathematics", "history", "law", "theology", "engineering"],
    maxEducationLevel: "advanced",
    minimumAge: 16,
    minimumLiteracy: 50,
    baseTuition: 50,
    baseCapacity: 15,
    teacherRatio: 5,
  },
  military_academy: {
    subjectsTaught: ["tactics", "melee", "ranged", "history"],
    maxEducationLevel: "advanced",
    minimumAge: 14,
    minimumLiteracy: 20,
    baseTuition: 30,
    baseCapacity: 25,
    teacherRatio: 8,
  },
  religious_school: {
    subjectsTaught: ["theology", "literacy", "history"],
    maxEducationLevel: "advanced",
    minimumAge: 8,
    minimumLiteracy: 0,
    baseTuition: 0, // Often free
    baseCapacity: 25,
    teacherRatio: 12,
  },
  trade_school: {
    subjectsTaught: ["smithing", "carpentry", "masonry", "tailoring", "trading"],
    maxEducationLevel: "intermediate",
    minimumAge: 12,
    minimumLiteracy: 0,
    baseTuition: 10,
    baseCapacity: 20,
    teacherRatio: 5,
  },
  medical_school: {
    subjectsTaught: ["medicine", "literacy", "theology"],
    maxEducationLevel: "master",
    minimumAge: 18,
    minimumLiteracy: 60,
    baseTuition: 100,
    baseCapacity: 10,
    teacherRatio: 3,
  },
  law_school: {
    subjectsTaught: ["law", "literacy", "persuasion", "history"],
    maxEducationLevel: "master",
    minimumAge: 18,
    minimumLiteracy: 60,
    baseTuition: 80,
    baseCapacity: 15,
    teacherRatio: 5,
  },
};

/**
 * Create a new school
 */
export async function createSchool(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  schoolType: keyof typeof SCHOOL_TYPES,
  name: string,
  tick: number
): Promise<{ success: boolean; schoolId?: Id<"schools">; message: string }> {
  const territory = await ctx.db.get(territoryId);
  if (!territory) {
    return { success: false, message: "Territory not found" };
  }

  const config = SCHOOL_TYPES[schoolType];

  // Check if territory has enough wealth
  if (territory.wealth < 50) {
    return { success: false, message: "Not enough wealth to establish school" };
  }

  const schoolId = await ctx.db.insert("schools", {
    name,
    territoryId,
    foundedTick: tick,
    schoolType,
    headmasterId: undefined,
    teacherIds: [],
    teacherCount: 0,
    studentIds: [],
    studentCapacity: config.baseCapacity,
    currentEnrollment: 0,
    educationQuality: 50,
    reputation: 30,
    treasury: 0,
    tuitionCost: config.baseTuition,
    librarySize: 10,
    minimumLiteracy: config.minimumLiteracy,
    minimumAge: config.minimumAge,
    subjectsTaught: config.subjectsTaught,
    graduationRequirements: 100,
  });

  // Deduct establishment cost
  await ctx.db.patch(territoryId, {
    wealth: territory.wealth - 30,
  });

  return {
    success: true,
    schoolId,
    message: `${name} has been established`,
  };
}

/**
 * Enroll a character in a school
 */
export async function enrollInSchool(
  ctx: MutationCtx,
  characterId: Id<"characters">,
  schoolId: Id<"schools">,
  tick: number
): Promise<{ success: boolean; message: string }> {
  const character = await ctx.db.get(characterId);
  const school = await ctx.db.get(schoolId);

  if (!character || !character.isAlive) {
    return { success: false, message: "Character not found or deceased" };
  }
  if (!school) {
    return { success: false, message: "School not found" };
  }

  // Check age requirement
  if (character.age < school.minimumAge) {
    return { success: false, message: `Must be at least ${school.minimumAge} years old` };
  }

  // Check literacy requirement
  const literacy = character.skills?.literacy || 0;
  if (literacy < school.minimumLiteracy) {
    return { success: false, message: `Literacy too low (${literacy}/${school.minimumLiteracy})` };
  }

  // Check capacity
  if (school.currentEnrollment >= school.studentCapacity) {
    return { success: false, message: "School is at capacity" };
  }

  // Check if already studying
  if (character.currentlyStudying) {
    return { success: false, message: "Already enrolled in education" };
  }

  // Enroll
  await ctx.db.patch(schoolId, {
    studentIds: [...school.studentIds, characterId],
    currentEnrollment: school.currentEnrollment + 1,
  });

  await ctx.db.patch(characterId, {
    currentlyStudying: true,
    studyProgress: 0,
  });

  return {
    success: true,
    message: `${character.name} enrolled in ${school.name}`,
  };
}

/**
 * Process education progress for all students
 */
export async function processEducation(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  tick: number
): Promise<Array<{ type: string; description: string }>> {
  const schools = await ctx.db
    .query("schools")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .collect();

  const events: Array<{ type: string; description: string }> = [];

  for (const school of schools) {
    const config = SCHOOL_TYPES[school.schoolType as keyof typeof SCHOOL_TYPES];
    if (!config) continue;

    // Process each student
    for (const studentId of school.studentIds) {
      const student = await ctx.db.get(studentId);
      if (!student || !student.isAlive) {
        // Remove dead students
        await ctx.db.patch(school._id, {
          studentIds: school.studentIds.filter((id) => id !== studentId),
          currentEnrollment: Math.max(0, school.currentEnrollment - 1),
        });
        continue;
      }

      // Calculate learning progress
      const teacherQuality = school.teacherCount > 0 ? school.educationQuality : 30;
      const libraryBonus = Math.min(20, school.librarySize / 5);
      const intelligenceBonus = (student.traits.wisdom - 50) / 10;

      const progressGain = (teacherQuality / 100) * (3 + libraryBonus / 10 + intelligenceBonus);

      const newProgress = Math.min(100, (student.studyProgress || 0) + progressGain);

      // Improve skills
      const skills = student.skills || {
        melee: 10, ranged: 5, tactics: 5, smithing: 5, carpentry: 10,
        masonry: 5, tailoring: 5, literacy: 0, mathematics: 0, medicine: 0,
        engineering: 0, law: 0, theology: 5, history: 5, persuasion: 15,
        intimidation: 10, negotiation: 10, trading: 10, farming: 20,
        animalcare: 10, mining: 5,
      };

      // Learn subjects taught
      for (const subject of school.subjectsTaught) {
        if (skills[subject as keyof typeof skills] !== undefined) {
          const currentSkill = skills[subject as keyof typeof skills];
          const maxForSchool = school.schoolType === "university" ? 80 :
                              school.schoolType === "medical_school" || school.schoolType === "law_school" ? 90 : 60;

          if (currentSkill < maxForSchool && Math.random() < 0.2) {
            skills[subject as keyof typeof skills] = Math.min(maxForSchool, currentSkill + 1);
          }
        }
      }

      await ctx.db.patch(studentId, {
        studyProgress: newProgress,
        skills,
      });

      // Check for graduation
      if (newProgress >= school.graduationRequirements) {
        // Graduate!
        const newEducationLevel = getNextEducationLevel(student.educationLevel || "none");
        const isLiterate = skills.literacy >= 20;

        await ctx.db.patch(studentId, {
          educationLevel: newEducationLevel as any,
          isLiterate,
          currentlyStudying: false,
          studyProgress: 0,
        });

        // Remove from school
        await ctx.db.patch(school._id, {
          studentIds: school.studentIds.filter((id) => id !== studentId),
          currentEnrollment: Math.max(0, school.currentEnrollment - 1),
        });

        events.push({
          type: "graduation",
          description: `${student.name} graduated from ${school.name} with ${newEducationLevel} education!`,
        });
      }
    }

    // Collect tuition (monthly)
    if (school.tuitionCost > 0 && school.currentEnrollment > 0) {
      const tuitionCollected = school.tuitionCost * school.currentEnrollment;
      await ctx.db.patch(school._id, {
        treasury: school.treasury + tuitionCollected,
      });
    }

    // Pay teachers
    if (school.teacherCount > 0) {
      const teacherWages = school.teacherCount * 5;
      if (school.treasury >= teacherWages) {
        await ctx.db.patch(school._id, {
          treasury: school.treasury - teacherWages,
        });
      }
    }
  }

  return events;
}

/**
 * Get next education level
 */
function getNextEducationLevel(current: string): string {
  const levels = ["none", "basic", "intermediate", "advanced", "master"];
  const currentIndex = levels.indexOf(current);
  if (currentIndex < levels.length - 1) {
    return levels[currentIndex + 1];
  }
  return current;
}

/**
 * Hire a teacher for a school
 */
export async function hireTeacher(
  ctx: MutationCtx,
  schoolId: Id<"schools">,
  teacherId: Id<"characters">
): Promise<{ success: boolean; message: string }> {
  const school = await ctx.db.get(schoolId);
  const teacher = await ctx.db.get(teacherId);

  if (!school) {
    return { success: false, message: "School not found" };
  }
  if (!teacher || !teacher.isAlive) {
    return { success: false, message: "Teacher not found or deceased" };
  }

  // Check teacher qualifications
  const literacy = teacher.skills?.literacy || 0;
  if (literacy < 50) {
    return { success: false, message: "Teacher must be literate (50+ literacy)" };
  }

  // Check if already a teacher
  if (school.teacherIds.includes(teacherId)) {
    return { success: false, message: "Already teaching at this school" };
  }

  await ctx.db.patch(schoolId, {
    teacherIds: [...school.teacherIds, teacherId],
    teacherCount: school.teacherCount + 1,
    educationQuality: Math.min(100, school.educationQuality + 5),
  });

  await ctx.db.patch(teacherId, {
    profession: "teacher" as any,
  });

  return {
    success: true,
    message: `${teacher.name} is now teaching at ${school.name}`,
  };
}

/**
 * Calculate territory literacy rate
 */
export async function getLiteracyRate(
  ctx: QueryCtx,
  territoryId: Id<"territories">
): Promise<{ rate: number; literate: number; total: number }> {
  const characters = await ctx.db
    .query("characters")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .filter((q) => q.eq(q.field("isAlive"), true))
    .collect();

  const total = characters.length;
  const literate = characters.filter((c) => c.isLiterate).length;

  return {
    rate: total > 0 ? (literate / total) * 100 : 0,
    literate,
    total,
  };
}

/**
 * Get education statistics for a territory
 */
export async function getEducationStats(
  ctx: QueryCtx,
  territoryId: Id<"territories">
): Promise<{
  schools: number;
  students: number;
  teachers: number;
  literacyRate: number;
  educationLevels: Record<string, number>;
}> {
  const schools = await ctx.db
    .query("schools")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .collect();

  const characters = await ctx.db
    .query("characters")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .filter((q) => q.eq(q.field("isAlive"), true))
    .collect();

  const educationLevels: Record<string, number> = {
    none: 0,
    basic: 0,
    intermediate: 0,
    advanced: 0,
    master: 0,
  };

  for (const char of characters) {
    const level = char.educationLevel || "none";
    educationLevels[level] = (educationLevels[level] || 0) + 1;
  }

  const literate = characters.filter((c) => c.isLiterate).length;

  return {
    schools: schools.length,
    students: schools.reduce((sum, s) => sum + s.currentEnrollment, 0),
    teachers: schools.reduce((sum, s) => sum + s.teacherCount, 0),
    literacyRate: characters.length > 0 ? (literate / characters.length) * 100 : 0,
    educationLevels,
  };
}

/**
 * Self-study to improve literacy (for characters not in school)
 */
export async function selfStudy(
  ctx: MutationCtx,
  characterId: Id<"characters">
): Promise<{ success: boolean; message: string }> {
  const character = await ctx.db.get(characterId);
  if (!character || !character.isAlive) {
    return { success: false, message: "Character not found or deceased" };
  }

  if (character.currentlyStudying) {
    return { success: false, message: "Already studying" };
  }

  const skills = character.skills || {
    melee: 10, ranged: 5, tactics: 5, smithing: 5, carpentry: 10,
    masonry: 5, tailoring: 5, literacy: 0, mathematics: 0, medicine: 0,
    engineering: 0, law: 0, theology: 5, history: 5, persuasion: 15,
    intimidation: 10, negotiation: 10, trading: 10, farming: 20,
    animalcare: 10, mining: 5,
  };

  // Self-study is slow but possible
  const wisdomBonus = character.traits.wisdom / 100;
  const literacyGain = Math.random() < 0.3 + wisdomBonus * 0.2 ? 1 : 0;

  if (literacyGain > 0 && skills.literacy < 30) { // Self-study caps at 30
    skills.literacy = Math.min(30, skills.literacy + literacyGain);

    await ctx.db.patch(characterId, {
      skills,
      isLiterate: skills.literacy >= 20,
    });

    return {
      success: true,
      message: `${character.name} improved their literacy through self-study`,
    };
  }

  return {
    success: true,
    message: `${character.name} studied but made no progress this time`,
  };
}
