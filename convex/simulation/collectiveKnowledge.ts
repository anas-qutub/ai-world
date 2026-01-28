/**
 * Organic Knowledge Progression System
 *
 * Technologies unlock when enough people in society have practical skill in related areas.
 * You can't "decide" to invent bronze working - you need enough skilled smiths
 * practicing their craft until someone figures it out naturally.
 */

import { MutationCtx, QueryCtx } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";

// Skill tiers based on skill level
export const SKILL_TIERS = {
  NOVICE: { min: 0, max: 29, name: "Novice" },
  SKILLED: { min: 30, max: 69, name: "Skilled" },
  EXPERT: { min: 70, max: 89, name: "Expert" },
  LEGENDARY: { min: 90, max: 100, name: "Legendary" },
} as const;

// =============================================
// COMPREHENSIVE SKILL SYSTEM
// Organized by era tier and category
// =============================================

// Era tiers for skills
export type SkillEra = "primitive" | "ancient" | "classical" | "medieval" | "renaissance" | "industrial" | "modern" | "atomic";

// Skill categories
export type SkillCategory = "gathering" | "crafting" | "construction" | "agriculture" | "combat" | "knowledge" | "social" | "industrial";

// Skill metadata
export interface SkillDefinition {
  id: string;
  name: string;
  category: SkillCategory;
  era: SkillEra;
  description: string;
  prerequisites?: { skill: string; minLevel: number }[];
}

// All skill definitions organized by category and era
export const SKILL_DEFINITIONS: SkillDefinition[] = [
  // =============================================
  // TIER 1: GATHERING & SURVIVAL (Primitive)
  // =============================================
  { id: "foraging", name: "Foraging", category: "gathering", era: "primitive",
    description: "Finding edible plants, berries, roots, and nuts" },
  { id: "hunting", name: "Hunting", category: "gathering", era: "primitive",
    description: "Tracking and killing animals for food and materials" },
  { id: "fishing", name: "Fishing", category: "gathering", era: "primitive",
    description: "Catching fish from rivers, lakes, and coasts" },
  { id: "woodcutting", name: "Woodcutting", category: "gathering", era: "primitive",
    description: "Felling trees and processing timber" },
  { id: "quarrying", name: "Quarrying", category: "gathering", era: "primitive",
    description: "Extracting stone and basic minerals" },

  // =============================================
  // TIER 2: BASIC CRAFTING (Primitive → Ancient)
  // =============================================
  { id: "stoneworking", name: "Stoneworking", category: "crafting", era: "primitive",
    description: "Shaping stone into tools and weapons",
    prerequisites: [{ skill: "quarrying", minLevel: 20 }] },
  { id: "woodworking", name: "Woodworking", category: "crafting", era: "primitive",
    description: "Basic shaping of wood for tools and shelter",
    prerequisites: [{ skill: "woodcutting", minLevel: 20 }] },
  { id: "pottery", name: "Pottery", category: "crafting", era: "primitive",
    description: "Shaping clay into vessels for storage and cooking" },
  { id: "weaving", name: "Weaving", category: "crafting", era: "primitive",
    description: "Creating cloth, baskets, and rope from fibers" },
  { id: "leatherworking", name: "Leatherworking", category: "crafting", era: "primitive",
    description: "Processing animal hides into leather",
    prerequisites: [{ skill: "hunting", minLevel: 30 }] },

  // =============================================
  // TIER 3: SPECIALIZED CRAFTS (Ancient)
  // =============================================
  { id: "carpentry", name: "Carpentry", category: "crafting", era: "ancient",
    description: "Advanced woodworking for buildings and furniture",
    prerequisites: [{ skill: "woodworking", minLevel: 40 }] },
  { id: "masonry", name: "Masonry", category: "construction", era: "ancient",
    description: "Building with cut stone and mortar",
    prerequisites: [{ skill: "stoneworking", minLevel: 40 }] },
  { id: "smelting", name: "Smelting", category: "crafting", era: "ancient",
    description: "Extracting metals from ore using heat" },
  { id: "smithing", name: "Smithing", category: "crafting", era: "ancient",
    description: "Forging metal into tools, weapons, and armor",
    prerequisites: [{ skill: "smelting", minLevel: 30 }] },
  { id: "tailoring", name: "Tailoring", category: "crafting", era: "ancient",
    description: "Making fitted clothing from cloth and leather",
    prerequisites: [{ skill: "weaving", minLevel: 40 }] },
  { id: "ceramics", name: "Ceramics", category: "crafting", era: "ancient",
    description: "Advanced pottery with glazing and decoration",
    prerequisites: [{ skill: "pottery", minLevel: 50 }] },
  { id: "toolmaking", name: "Toolmaking", category: "crafting", era: "ancient",
    description: "Creating specialized tools for various trades",
    prerequisites: [{ skill: "smithing", minLevel: 30 }] },

  // =============================================
  // TIER 4: CONSTRUCTION & ARCHITECTURE
  // =============================================
  { id: "construction", name: "Construction", category: "construction", era: "ancient",
    description: "Building houses, workshops, and basic structures",
    prerequisites: [{ skill: "carpentry", minLevel: 30 }] },
  { id: "fortification", name: "Fortification", category: "construction", era: "ancient",
    description: "Building defensive walls, towers, and gates",
    prerequisites: [{ skill: "masonry", minLevel: 40 }] },
  { id: "architecture", name: "Architecture", category: "construction", era: "classical",
    description: "Designing complex buildings and monuments",
    prerequisites: [{ skill: "construction", minLevel: 50 }, { skill: "mathematics", minLevel: 40 }] },
  { id: "shipwright", name: "Shipwright", category: "construction", era: "ancient",
    description: "Building seaworthy vessels",
    prerequisites: [{ skill: "carpentry", minLevel: 50 }] },
  { id: "siege_engineering", name: "Siege Engineering", category: "construction", era: "classical",
    description: "Building siege weapons and defensive structures",
    prerequisites: [{ skill: "fortification", minLevel: 50 }, { skill: "engineering", minLevel: 40 }] },

  // =============================================
  // TIER 5: AGRICULTURE & ANIMAL HUSBANDRY
  // =============================================
  { id: "farming", name: "Farming", category: "agriculture", era: "ancient",
    description: "Cultivating crops for food",
    prerequisites: [{ skill: "foraging", minLevel: 30 }] },
  { id: "animalcare", name: "Animal Husbandry", category: "agriculture", era: "ancient",
    description: "Domesticating and breeding animals",
    prerequisites: [{ skill: "hunting", minLevel: 30 }] },
  { id: "irrigation", name: "Irrigation", category: "agriculture", era: "ancient",
    description: "Building water systems for crops",
    prerequisites: [{ skill: "farming", minLevel: 40 }] },
  { id: "herbalism", name: "Herbalism", category: "agriculture", era: "primitive",
    description: "Knowledge of medicinal plants",
    prerequisites: [{ skill: "foraging", minLevel: 40 }] },
  { id: "brewing", name: "Brewing", category: "agriculture", era: "ancient",
    description: "Fermenting grains and fruits into alcohol",
    prerequisites: [{ skill: "farming", minLevel: 30 }] },
  { id: "veterinary", name: "Veterinary", category: "agriculture", era: "classical",
    description: "Treating animal diseases and injuries",
    prerequisites: [{ skill: "animalcare", minLevel: 50 }, { skill: "medicine", minLevel: 30 }] },

  // =============================================
  // TIER 6: COMBAT SKILLS
  // =============================================
  { id: "melee", name: "Melee Combat", category: "combat", era: "primitive",
    description: "Fighting with clubs, spears, and close-range weapons" },
  { id: "ranged", name: "Ranged Combat", category: "combat", era: "primitive",
    description: "Fighting with thrown weapons and bows" },
  { id: "tactics", name: "Tactics", category: "combat", era: "ancient",
    description: "Military strategy and battlefield command",
    prerequisites: [{ skill: "melee", minLevel: 40 }] },
  { id: "cavalry", name: "Cavalry", category: "combat", era: "ancient",
    description: "Fighting from horseback",
    prerequisites: [{ skill: "animalcare", minLevel: 50 }, { skill: "melee", minLevel: 40 }] },
  { id: "archery", name: "Archery", category: "combat", era: "ancient",
    description: "Advanced bow techniques and accuracy",
    prerequisites: [{ skill: "ranged", minLevel: 50 }] },
  { id: "naval_combat", name: "Naval Combat", category: "combat", era: "classical",
    description: "Fighting at sea, boarding, and naval tactics",
    prerequisites: [{ skill: "shipwright", minLevel: 30 }, { skill: "tactics", minLevel: 40 }] },
  { id: "siege_warfare", name: "Siege Warfare", category: "combat", era: "classical",
    description: "Attacking and defending fortifications",
    prerequisites: [{ skill: "tactics", minLevel: 50 }, { skill: "siege_engineering", minLevel: 30 }] },

  // =============================================
  // TIER 7: KNOWLEDGE & SCIENCE (Classical)
  // =============================================
  { id: "literacy", name: "Literacy", category: "knowledge", era: "ancient",
    description: "Reading and writing" },
  { id: "mathematics", name: "Mathematics", category: "knowledge", era: "ancient",
    description: "Numbers, geometry, and calculation",
    prerequisites: [{ skill: "literacy", minLevel: 30 }] },
  { id: "astronomy", name: "Astronomy", category: "knowledge", era: "ancient",
    description: "Study of celestial bodies and navigation",
    prerequisites: [{ skill: "mathematics", minLevel: 40 }] },
  { id: "medicine", name: "Medicine", category: "knowledge", era: "ancient",
    description: "Healing wounds and treating illness",
    prerequisites: [{ skill: "herbalism", minLevel: 40 }] },
  { id: "surgery", name: "Surgery", category: "knowledge", era: "classical",
    description: "Cutting operations and bone-setting",
    prerequisites: [{ skill: "medicine", minLevel: 60 }] },
  { id: "engineering", name: "Engineering", category: "knowledge", era: "classical",
    description: "Applied mathematics for building and machines",
    prerequisites: [{ skill: "mathematics", minLevel: 50 }, { skill: "construction", minLevel: 40 }] },
  { id: "alchemy", name: "Alchemy", category: "knowledge", era: "classical",
    description: "Early chemistry, potions, and metallurgical experiments",
    prerequisites: [{ skill: "herbalism", minLevel: 40 }, { skill: "smelting", minLevel: 40 }] },
  { id: "philosophy", name: "Philosophy", category: "knowledge", era: "classical",
    description: "Logic, ethics, and systematic thinking",
    prerequisites: [{ skill: "literacy", minLevel: 60 }] },
  { id: "history", name: "History", category: "knowledge", era: "ancient",
    description: "Recording and studying the past",
    prerequisites: [{ skill: "literacy", minLevel: 40 }] },
  { id: "law", name: "Law", category: "knowledge", era: "ancient",
    description: "Legal codes and justice systems",
    prerequisites: [{ skill: "literacy", minLevel: 50 }] },
  { id: "theology", name: "Theology", category: "knowledge", era: "ancient",
    description: "Religious study and doctrine" },
  { id: "navigation", name: "Navigation", category: "knowledge", era: "classical",
    description: "Finding your way by stars, maps, and instruments",
    prerequisites: [{ skill: "astronomy", minLevel: 40 }, { skill: "mathematics", minLevel: 40 }] },
  { id: "cartography", name: "Cartography", category: "knowledge", era: "classical",
    description: "Making accurate maps",
    prerequisites: [{ skill: "navigation", minLevel: 40 }, { skill: "mathematics", minLevel: 50 }] },

  // =============================================
  // TIER 8: SOCIAL & GOVERNANCE
  // =============================================
  { id: "persuasion", name: "Persuasion", category: "social", era: "primitive",
    description: "Convincing others through speech" },
  { id: "negotiation", name: "Negotiation", category: "social", era: "ancient",
    description: "Making deals and resolving disputes",
    prerequisites: [{ skill: "persuasion", minLevel: 40 }] },
  { id: "diplomacy", name: "Diplomacy", category: "social", era: "classical",
    description: "Managing relations between nations",
    prerequisites: [{ skill: "negotiation", minLevel: 50 }, { skill: "literacy", minLevel: 40 }] },
  { id: "trading", name: "Trading", category: "social", era: "ancient",
    description: "Buying and selling goods for profit" },
  { id: "banking", name: "Banking", category: "social", era: "medieval",
    description: "Managing money, loans, and investments",
    prerequisites: [{ skill: "trading", minLevel: 60 }, { skill: "mathematics", minLevel: 50 }] },
  { id: "administration", name: "Administration", category: "social", era: "classical",
    description: "Managing organizations and bureaucracies",
    prerequisites: [{ skill: "literacy", minLevel: 50 }, { skill: "law", minLevel: 40 }] },
  { id: "espionage", name: "Espionage", category: "social", era: "classical",
    description: "Gathering secret information",
    prerequisites: [{ skill: "persuasion", minLevel: 50 }] },
  { id: "propaganda", name: "Propaganda", category: "social", era: "medieval",
    description: "Influencing public opinion",
    prerequisites: [{ skill: "persuasion", minLevel: 60 }, { skill: "literacy", minLevel: 50 }] },

  // =============================================
  // TIER 9: MEDIEVAL SPECIALIZATIONS
  // =============================================
  { id: "blacksmithing", name: "Blacksmithing", category: "crafting", era: "medieval",
    description: "Advanced iron and steel working",
    prerequisites: [{ skill: "smithing", minLevel: 60 }] },
  { id: "armorsmithing", name: "Armorsmithing", category: "crafting", era: "medieval",
    description: "Crafting metal armor and chainmail",
    prerequisites: [{ skill: "blacksmithing", minLevel: 50 }] },
  { id: "weaponsmithing", name: "Weaponsmithing", category: "crafting", era: "medieval",
    description: "Forging high-quality weapons",
    prerequisites: [{ skill: "blacksmithing", minLevel: 50 }] },
  { id: "glassmaking", name: "Glassmaking", category: "crafting", era: "medieval",
    description: "Creating glass objects and windows",
    prerequisites: [{ skill: "ceramics", minLevel: 50 }, { skill: "smelting", minLevel: 40 }] },
  { id: "clockmaking", name: "Clockmaking", category: "crafting", era: "medieval",
    description: "Building mechanical timekeeping devices",
    prerequisites: [{ skill: "smithing", minLevel: 60 }, { skill: "mathematics", minLevel: 50 }] },
  { id: "mining", name: "Deep Mining", category: "gathering", era: "medieval",
    description: "Extracting ore from deep underground",
    prerequisites: [{ skill: "quarrying", minLevel: 50 }] },
  { id: "metallurgy", name: "Metallurgy", category: "knowledge", era: "medieval",
    description: "Scientific study of metals and alloys",
    prerequisites: [{ skill: "alchemy", minLevel: 50 }, { skill: "smithing", minLevel: 50 }] },
  { id: "castle_building", name: "Castle Building", category: "construction", era: "medieval",
    description: "Designing and building massive fortifications",
    prerequisites: [{ skill: "architecture", minLevel: 60 }, { skill: "fortification", minLevel: 60 }] },

  // =============================================
  // TIER 10: RENAISSANCE ADVANCEMENTS
  // =============================================
  { id: "chemistry", name: "Chemistry", category: "knowledge", era: "renaissance",
    description: "Scientific study of substances and reactions",
    prerequisites: [{ skill: "alchemy", minLevel: 70 }, { skill: "mathematics", minLevel: 50 }] },
  { id: "physics", name: "Physics", category: "knowledge", era: "renaissance",
    description: "Study of matter, energy, and forces",
    prerequisites: [{ skill: "mathematics", minLevel: 60 }, { skill: "philosophy", minLevel: 40 }] },
  { id: "biology", name: "Biology", category: "knowledge", era: "renaissance",
    description: "Study of living organisms",
    prerequisites: [{ skill: "medicine", minLevel: 50 }, { skill: "herbalism", minLevel: 50 }] },
  { id: "anatomy", name: "Anatomy", category: "knowledge", era: "renaissance",
    description: "Detailed knowledge of body structure",
    prerequisites: [{ skill: "surgery", minLevel: 50 }, { skill: "biology", minLevel: 40 }] },
  { id: "optics", name: "Optics", category: "knowledge", era: "renaissance",
    description: "Study of light and lenses",
    prerequisites: [{ skill: "glassmaking", minLevel: 50 }, { skill: "physics", minLevel: 40 }] },
  { id: "printing", name: "Printing", category: "crafting", era: "renaissance",
    description: "Mass-producing written materials",
    prerequisites: [{ skill: "literacy", minLevel: 60 }, { skill: "metallurgy", minLevel: 40 }] },
  { id: "gunsmithing", name: "Gunsmithing", category: "crafting", era: "renaissance",
    description: "Building firearms and cannons",
    prerequisites: [{ skill: "blacksmithing", minLevel: 60 }, { skill: "chemistry", minLevel: 40 }] },
  { id: "explosives", name: "Explosives", category: "knowledge", era: "renaissance",
    description: "Creating and using gunpowder and bombs",
    prerequisites: [{ skill: "chemistry", minLevel: 50 }] },
  { id: "ballistics", name: "Ballistics", category: "knowledge", era: "renaissance",
    description: "Science of projectile motion",
    prerequisites: [{ skill: "physics", minLevel: 50 }, { skill: "mathematics", minLevel: 60 }] },
  { id: "fortification_modern", name: "Modern Fortification", category: "construction", era: "renaissance",
    description: "Star forts and cannon-resistant walls",
    prerequisites: [{ skill: "castle_building", minLevel: 50 }, { skill: "ballistics", minLevel: 40 }] },
  { id: "naval_architecture", name: "Naval Architecture", category: "construction", era: "renaissance",
    description: "Designing large sailing warships",
    prerequisites: [{ skill: "shipwright", minLevel: 70 }, { skill: "engineering", minLevel: 50 }] },

  // =============================================
  // TIER 11: INDUSTRIAL REVOLUTION
  // =============================================
  { id: "mechanics", name: "Mechanics", category: "knowledge", era: "industrial",
    description: "Study of machines and motion",
    prerequisites: [{ skill: "physics", minLevel: 60 }, { skill: "engineering", minLevel: 60 }] },
  { id: "thermodynamics", name: "Thermodynamics", category: "knowledge", era: "industrial",
    description: "Study of heat and energy",
    prerequisites: [{ skill: "physics", minLevel: 70 }, { skill: "chemistry", minLevel: 50 }] },
  { id: "steam_engineering", name: "Steam Engineering", category: "industrial", era: "industrial",
    description: "Building and operating steam engines",
    prerequisites: [{ skill: "thermodynamics", minLevel: 50 }, { skill: "blacksmithing", minLevel: 60 }] },
  { id: "machine_tools", name: "Machine Tools", category: "industrial", era: "industrial",
    description: "Precision manufacturing equipment",
    prerequisites: [{ skill: "toolmaking", minLevel: 70 }, { skill: "mechanics", minLevel: 50 }] },
  { id: "industrial_chemistry", name: "Industrial Chemistry", category: "industrial", era: "industrial",
    description: "Large-scale chemical production",
    prerequisites: [{ skill: "chemistry", minLevel: 70 }] },
  { id: "steel_production", name: "Steel Production", category: "industrial", era: "industrial",
    description: "Mass-producing high-quality steel",
    prerequisites: [{ skill: "metallurgy", minLevel: 60 }, { skill: "industrial_chemistry", minLevel: 40 }] },
  { id: "railways", name: "Railways", category: "industrial", era: "industrial",
    description: "Building and operating rail networks",
    prerequisites: [{ skill: "steam_engineering", minLevel: 50 }, { skill: "steel_production", minLevel: 40 }] },
  { id: "telegraphy", name: "Telegraphy", category: "industrial", era: "industrial",
    description: "Long-distance electrical communication",
    prerequisites: [{ skill: "physics", minLevel: 60 }] },
  { id: "photography", name: "Photography", category: "industrial", era: "industrial",
    description: "Capturing images with light",
    prerequisites: [{ skill: "optics", minLevel: 50 }, { skill: "chemistry", minLevel: 50 }] },

  // =============================================
  // TIER 12: ELECTRICAL & MODERN
  // =============================================
  { id: "electrical_engineering", name: "Electrical Engineering", category: "industrial", era: "modern",
    description: "Harnessing electricity for power and machines",
    prerequisites: [{ skill: "physics", minLevel: 70 }, { skill: "mechanics", minLevel: 60 }] },
  { id: "internal_combustion", name: "Internal Combustion", category: "industrial", era: "modern",
    description: "Engines powered by burning fuel",
    prerequisites: [{ skill: "thermodynamics", minLevel: 60 }, { skill: "industrial_chemistry", minLevel: 50 }] },
  { id: "automotive", name: "Automotive", category: "industrial", era: "modern",
    description: "Designing and building motor vehicles",
    prerequisites: [{ skill: "internal_combustion", minLevel: 50 }, { skill: "steel_production", minLevel: 50 }] },
  { id: "aviation", name: "Aviation", category: "industrial", era: "modern",
    description: "Building and flying aircraft",
    prerequisites: [{ skill: "internal_combustion", minLevel: 60 }, { skill: "physics", minLevel: 70 }] },
  { id: "radio", name: "Radio", category: "industrial", era: "modern",
    description: "Wireless communication",
    prerequisites: [{ skill: "electrical_engineering", minLevel: 50 }] },
  { id: "electronics", name: "Electronics", category: "industrial", era: "modern",
    description: "Controlling electrical signals",
    prerequisites: [{ skill: "electrical_engineering", minLevel: 60 }] },
  { id: "radar", name: "Radar", category: "industrial", era: "modern",
    description: "Detection using radio waves",
    prerequisites: [{ skill: "radio", minLevel: 60 }, { skill: "electronics", minLevel: 50 }] },
  { id: "assembly_line", name: "Assembly Line", category: "industrial", era: "modern",
    description: "Mass production techniques",
    prerequisites: [{ skill: "machine_tools", minLevel: 60 }] },
  { id: "tank_warfare", name: "Tank Warfare", category: "combat", era: "modern",
    description: "Fighting with armored vehicles",
    prerequisites: [{ skill: "automotive", minLevel: 50 }, { skill: "tactics", minLevel: 60 }] },
  { id: "air_combat", name: "Air Combat", category: "combat", era: "modern",
    description: "Fighting in the skies",
    prerequisites: [{ skill: "aviation", minLevel: 60 }, { skill: "tactics", minLevel: 50 }] },
  { id: "submarine_warfare", name: "Submarine Warfare", category: "combat", era: "modern",
    description: "Undersea combat and stealth",
    prerequisites: [{ skill: "naval_architecture", minLevel: 60 }, { skill: "electronics", minLevel: 40 }] },

  // =============================================
  // TIER 13: ATOMIC AGE
  // =============================================
  { id: "nuclear_physics", name: "Nuclear Physics", category: "knowledge", era: "atomic",
    description: "Study of atomic nuclei and radiation",
    prerequisites: [{ skill: "physics", minLevel: 80 }, { skill: "chemistry", minLevel: 70 }] },
  { id: "nuclear_engineering", name: "Nuclear Engineering", category: "industrial", era: "atomic",
    description: "Building nuclear reactors",
    prerequisites: [{ skill: "nuclear_physics", minLevel: 60 }, { skill: "electrical_engineering", minLevel: 70 }] },
  { id: "nuclear_weapons", name: "Nuclear Weapons", category: "combat", era: "atomic",
    description: "Building atomic and hydrogen bombs",
    prerequisites: [{ skill: "nuclear_physics", minLevel: 70 }, { skill: "explosives", minLevel: 60 }] },
  { id: "rocketry", name: "Rocketry", category: "industrial", era: "atomic",
    description: "Building rockets and missiles",
    prerequisites: [{ skill: "aviation", minLevel: 70 }, { skill: "ballistics", minLevel: 70 }] },
  { id: "computing", name: "Computing", category: "knowledge", era: "atomic",
    description: "Building and programming computers",
    prerequisites: [{ skill: "electronics", minLevel: 70 }, { skill: "mathematics", minLevel: 80 }] },
  { id: "missile_systems", name: "Missile Systems", category: "combat", era: "atomic",
    description: "Guided missiles and ICBMs",
    prerequisites: [{ skill: "rocketry", minLevel: 60 }, { skill: "electronics", minLevel: 60 }] },
  { id: "jet_propulsion", name: "Jet Propulsion", category: "industrial", era: "atomic",
    description: "Jet engines and supersonic flight",
    prerequisites: [{ skill: "aviation", minLevel: 70 }, { skill: "thermodynamics", minLevel: 70 }] },
  { id: "nuclear_delivery", name: "Nuclear Delivery", category: "combat", era: "atomic",
    description: "Deploying nuclear weapons via bombers or missiles",
    prerequisites: [{ skill: "nuclear_weapons", minLevel: 50 }, { skill: "missile_systems", minLevel: 50 }] },
];

// Extract just the skill IDs for the array
export const SKILL_TYPES = SKILL_DEFINITIONS.map(s => s.id);

export type SkillType = string;

// Map skill IDs to their definitions for quick lookup
export const SKILL_MAP = new Map<string, SkillDefinition>(
  SKILL_DEFINITIONS.map(s => [s.id, s])
);

/**
 * Check if a character can learn a skill based on prerequisites
 */
export function canLearnSkill(
  skillId: string,
  currentSkills: Record<string, number>
): { canLearn: boolean; missingPrereqs: string[] } {
  const skill = SKILL_MAP.get(skillId);
  if (!skill) return { canLearn: false, missingPrereqs: ["Unknown skill"] };

  if (!skill.prerequisites || skill.prerequisites.length === 0) {
    return { canLearn: true, missingPrereqs: [] };
  }

  const missingPrereqs: string[] = [];
  for (const prereq of skill.prerequisites) {
    const currentLevel = currentSkills[prereq.skill] || 0;
    if (currentLevel < prereq.minLevel) {
      const prereqDef = SKILL_MAP.get(prereq.skill);
      missingPrereqs.push(`${prereqDef?.name || prereq.skill} ${prereq.minLevel}+`);
    }
  }

  return { canLearn: missingPrereqs.length === 0, missingPrereqs };
}

/**
 * Get skills available at a given era
 */
export function getSkillsByEra(era: SkillEra): SkillDefinition[] {
  const eraOrder: SkillEra[] = ["primitive", "ancient", "classical", "medieval", "renaissance", "industrial", "modern", "atomic"];
  const eraIndex = eraOrder.indexOf(era);
  return SKILL_DEFINITIONS.filter(s => eraOrder.indexOf(s.era) <= eraIndex);
}

/**
 * Get skills by category
 */
export function getSkillsByCategory(category: SkillCategory): SkillDefinition[] {
  return SKILL_DEFINITIONS.filter(s => s.category === category);
}

/**
 * Classify a skill level into a tier
 */
export function getSkillTier(level: number): keyof typeof SKILL_TIERS {
  if (level >= SKILL_TIERS.LEGENDARY.min) return "LEGENDARY";
  if (level >= SKILL_TIERS.EXPERT.min) return "EXPERT";
  if (level >= SKILL_TIERS.SKILLED.min) return "SKILLED";
  return "NOVICE";
}

/**
 * Aggregate all character skills into population-level statistics.
 * Called each tick to update the populationSkills table.
 */
export async function aggregatePopulationSkills(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  tick: number
): Promise<void> {
  // Get territory for total population
  const territory = await ctx.db.get(territoryId);
  if (!territory) return;

  const totalPopulation = territory.population;
  if (totalPopulation <= 0) return;

  // Get all living characters in this territory
  const characters = await ctx.db
    .query("characters")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .filter((q) => q.eq(q.field("isAlive"), true))
    .collect();

  // Aggregate skills by type
  const skillAggregates: Map<
    string,
    {
      noviceCount: number;
      skilledCount: number;
      expertCount: number;
      legendaryCount: number;
      totalPoints: number;
      expertPoints: number;
      count: number;
      expertCount2: number;
    }
  > = new Map();

  // Initialize all skill types
  for (const skillType of SKILL_TYPES) {
    skillAggregates.set(skillType, {
      noviceCount: 0,
      skilledCount: 0,
      expertCount: 0,
      legendaryCount: 0,
      totalPoints: 0,
      expertPoints: 0,
      count: 0,
      expertCount2: 0,
    });
  }

  // Aggregate from all characters
  for (const character of characters) {
    if (!character.skills) continue;

    const skills = character.skills as Record<string, number>;

    for (const [skillName, skillLevel] of Object.entries(skills)) {
      if (typeof skillLevel !== "number") continue;

      const aggregate = skillAggregates.get(skillName);
      if (!aggregate) continue;

      aggregate.count++;
      aggregate.totalPoints += skillLevel;

      const tier = getSkillTier(skillLevel);
      switch (tier) {
        case "NOVICE":
          aggregate.noviceCount++;
          break;
        case "SKILLED":
          aggregate.skilledCount++;
          break;
        case "EXPERT":
          aggregate.expertCount++;
          aggregate.expertCount2++;
          aggregate.expertPoints += skillLevel;
          break;
        case "LEGENDARY":
          aggregate.legendaryCount++;
          aggregate.expertCount2++;
          aggregate.expertPoints += skillLevel;
          break;
      }
    }
  }

  // Update or create populationSkills records
  for (const skillType of SKILL_TYPES) {
    const agg = skillAggregates.get(skillType);
    if (!agg) continue;
    // Calculate percentages based on total population
    const skilledPlus =
      agg.skilledCount + agg.expertCount + agg.legendaryCount;
    const expertPlus = agg.expertCount + agg.legendaryCount;

    const skilledPercent =
      totalPopulation > 0 ? (skilledPlus / totalPopulation) * 100 : 0;
    const expertPercent =
      totalPopulation > 0 ? (expertPlus / totalPopulation) * 100 : 0;

    const averageLevel = agg.count > 0 ? agg.totalPoints / agg.count : 0;
    const averageExpertLevel =
      agg.expertCount2 > 0 ? agg.expertPoints / agg.expertCount2 : 0;

    // Find existing record
    const existing = await ctx.db
      .query("populationSkills")
      .withIndex("by_territory_skill", (q) =>
        q.eq("territoryId", territoryId).eq("skillType", skillType)
      )
      .first();

    const previousKnowledge = existing?.collectiveKnowledge ?? 0;

    // Calculate knowledge gain this tick based on skill practice
    // More skilled workers = more knowledge gain
    const knowledgeGain =
      agg.noviceCount * 0.1 +
      agg.skilledCount * 0.5 +
      agg.expertCount * 1.5 +
      agg.legendaryCount * 3.0;

    const newKnowledge = previousKnowledge + knowledgeGain;

    if (existing) {
      await ctx.db.patch(existing._id, {
        noviceCount: agg.noviceCount,
        skilledCount: agg.skilledCount,
        expertCount: agg.expertCount,
        legendaryCount: agg.legendaryCount,
        skilledPercent,
        expertPercent,
        totalSkillPoints: agg.totalPoints,
        averageLevel,
        averageExpertLevel,
        collectiveKnowledge: newKnowledge,
        knowledgeGainThisTick: knowledgeGain,
        lastUpdatedTick: tick,
      });
    } else {
      await ctx.db.insert("populationSkills", {
        territoryId,
        skillType,
        noviceCount: agg.noviceCount,
        skilledCount: agg.skilledCount,
        expertCount: agg.expertCount,
        legendaryCount: agg.legendaryCount,
        skilledPercent,
        expertPercent,
        totalSkillPoints: agg.totalPoints,
        averageLevel,
        averageExpertLevel,
        collectiveKnowledge: newKnowledge,
        knowledgeGainThisTick: knowledgeGain,
        lastUpdatedTick: tick,
      });
    }
  }
}

/**
 * Record skill practice and update collective knowledge.
 * Called when any character improves a skill.
 */
export async function recordSkillPractice(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  skillType: string,
  improvement: number
): Promise<void> {
  // Find the population skills record
  const popSkill = await ctx.db
    .query("populationSkills")
    .withIndex("by_territory_skill", (q) =>
      q.eq("territoryId", territoryId).eq("skillType", skillType)
    )
    .first();

  if (popSkill) {
    // Add to collective knowledge based on improvement
    // Larger improvements = more knowledge gain
    const knowledgeBonus = improvement * 0.5;
    await ctx.db.patch(popSkill._id, {
      collectiveKnowledge: popSkill.collectiveKnowledge + knowledgeBonus,
      knowledgeGainThisTick: popSkill.knowledgeGainThisTick + knowledgeBonus,
    });
  }
}

/**
 * Tech requirement definition
 */
export interface TechSkillRequirement {
  skill: string;
  minExpertPercent?: number; // % of population that must be experts (70+ skill)
  minSkilledPercent?: number; // % that must be skilled (30+ skill)
  minAverageLevel?: number; // Average skill level among skilled workers
}

/**
 * Check if a territory meets the skill requirements for a technology.
 */
export async function checkTechRequirements(
  ctx: QueryCtx,
  territoryId: Id<"territories">,
  requirements: TechSkillRequirement[]
): Promise<{
  met: boolean;
  progress: number;
  missing: string[];
  details: Array<{
    skill: string;
    required: { expertPercent?: number; skilledPercent?: number; avgLevel?: number };
    current: { expertPercent: number; skilledPercent: number; avgLevel: number };
    satisfied: boolean;
  }>;
}> {
  if (!requirements || requirements.length === 0) {
    return { met: true, progress: 100, missing: [], details: [] };
  }

  const details: Array<{
    skill: string;
    required: { expertPercent?: number; skilledPercent?: number; avgLevel?: number };
    current: { expertPercent: number; skilledPercent: number; avgLevel: number };
    satisfied: boolean;
  }> = [];
  const missing: string[] = [];
  let totalProgress = 0;
  let requirementCount = 0;

  for (const req of requirements) {
    const popSkill = await ctx.db
      .query("populationSkills")
      .withIndex("by_territory_skill", (q) =>
        q.eq("territoryId", territoryId).eq("skillType", req.skill)
      )
      .first();

    const currentExpertPercent = popSkill?.expertPercent ?? 0;
    const currentSkilledPercent = popSkill?.skilledPercent ?? 0;
    const currentAvgLevel = popSkill?.averageLevel ?? 0;

    let requirementMet = true;
    let reqProgress = 0;
    let reqCount = 0;

    // Check expert percentage
    if (req.minExpertPercent !== undefined && req.minExpertPercent > 0) {
      requirementCount++;
      reqCount++;
      const progress = Math.min(
        100,
        (currentExpertPercent / req.minExpertPercent) * 100
      );
      totalProgress += progress;
      reqProgress += progress;
      if (currentExpertPercent < req.minExpertPercent) {
        requirementMet = false;
        missing.push(
          `${req.skill}: need ${req.minExpertPercent.toFixed(1)}% experts, have ${currentExpertPercent.toFixed(1)}%`
        );
      }
    }

    // Check skilled percentage
    if (req.minSkilledPercent !== undefined && req.minSkilledPercent > 0) {
      requirementCount++;
      reqCount++;
      const progress = Math.min(
        100,
        (currentSkilledPercent / req.minSkilledPercent) * 100
      );
      totalProgress += progress;
      reqProgress += progress;
      if (currentSkilledPercent < req.minSkilledPercent) {
        requirementMet = false;
        missing.push(
          `${req.skill}: need ${req.minSkilledPercent.toFixed(1)}% skilled, have ${currentSkilledPercent.toFixed(1)}%`
        );
      }
    }

    // Check average level
    if (req.minAverageLevel !== undefined && req.minAverageLevel > 0) {
      requirementCount++;
      reqCount++;
      const progress = Math.min(
        100,
        (currentAvgLevel / req.minAverageLevel) * 100
      );
      totalProgress += progress;
      reqProgress += progress;
      if (currentAvgLevel < req.minAverageLevel) {
        requirementMet = false;
        missing.push(
          `${req.skill}: need avg level ${req.minAverageLevel}, have ${currentAvgLevel.toFixed(1)}`
        );
      }
    }

    details.push({
      skill: req.skill,
      required: {
        expertPercent: req.minExpertPercent,
        skilledPercent: req.minSkilledPercent,
        avgLevel: req.minAverageLevel,
      },
      current: {
        expertPercent: currentExpertPercent,
        skilledPercent: currentSkilledPercent,
        avgLevel: currentAvgLevel,
      },
      satisfied: requirementMet,
    });
  }

  const overallProgress =
    requirementCount > 0 ? totalProgress / requirementCount : 100;

  return {
    met: missing.length === 0,
    progress: Math.round(overallProgress),
    missing,
    details,
  };
}

/**
 * Calculate the research progress bonus based on population skills.
 * The more experts you have above the threshold, the faster you progress.
 */
export function calculateSkillBonus(
  requirements: TechSkillRequirement[],
  popSkills: Map<string, Doc<"populationSkills">>
): number {
  if (!requirements || requirements.length === 0) {
    return 3; // Base progress for techs with no skill requirements
  }

  let totalBonus = 0;
  let bonusCount = 0;

  for (const req of requirements) {
    const popSkill = popSkills.get(req.skill);
    if (!popSkill) continue;

    // Base progress from meeting requirements
    let bonus = 3;

    // Bonus from having MORE than required experts
    if (req.minExpertPercent !== undefined && req.minExpertPercent > 0) {
      const expertSurplus = popSkill.expertPercent - req.minExpertPercent;
      if (expertSurplus > 0) {
        bonus += expertSurplus * 0.5; // +0.5 progress per % over threshold
      }
    }

    // Bonus from average skill level of experts
    if (popSkill.averageExpertLevel > 70) {
      bonus += (popSkill.averageExpertLevel - 70) * 0.1;
    }

    // Bonus from collective knowledge accumulation
    bonus += Math.min(5, popSkill.collectiveKnowledge / 200);

    totalBonus += bonus;
    bonusCount++;
  }

  return bonusCount > 0 ? totalBonus / bonusCount : 3;
}

/**
 * Get a summary of population skills for a territory (for AI prompts).
 */
export async function getKnowledgeSummary(
  ctx: QueryCtx,
  territoryId: Id<"territories">
): Promise<{
  strongAreas: Array<{
    skill: string;
    skilledCount: number;
    expertCount: number;
    averageLevel: number;
  }>;
  weakAreas: Array<{
    skill: string;
    skilledCount: number;
    expertCount: number;
    averageLevel: number;
  }>;
  allSkills: Map<string, Doc<"populationSkills">>;
}> {
  const allSkills = await ctx.db
    .query("populationSkills")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .collect();

  const skillMap = new Map<string, Doc<"populationSkills">>();
  for (const skill of allSkills) {
    skillMap.set(skill.skillType, skill);
  }

  // Sort skills by expertise level
  const sorted = [...allSkills].sort(
    (a, b) => b.expertPercent - a.expertPercent
  );

  const strongAreas = sorted
    .filter((s) => s.expertPercent >= 5 || s.skilledPercent >= 15)
    .slice(0, 5)
    .map((s) => ({
      skill: s.skillType,
      skilledCount: s.skilledCount,
      expertCount: s.expertCount,
      averageLevel: s.averageLevel,
    }));

  const weakAreas = sorted
    .filter((s) => s.expertPercent < 5 && s.skilledPercent < 15 && s.skilledCount > 0)
    .slice(-3)
    .map((s) => ({
      skill: s.skillType,
      skilledCount: s.skilledCount,
      expertCount: s.expertCount,
      averageLevel: s.averageLevel,
    }));

  return { strongAreas, weakAreas, allSkills: skillMap };
}

/**
 * Apply knowledge decay when skilled workers die.
 * Called when characters die to reduce collective knowledge.
 */
export async function applyKnowledgeDecay(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  deceasedCharacter: Doc<"characters">
): Promise<void> {
  if (!deceasedCharacter.skills) return;

  const skills = deceasedCharacter.skills as Record<string, number>;

  for (const [skillName, skillLevel] of Object.entries(skills)) {
    if (typeof skillLevel !== "number") continue;

    const popSkill = await ctx.db
      .query("populationSkills")
      .withIndex("by_territory_skill", (q) =>
        q.eq("territoryId", territoryId).eq("skillType", skillName)
      )
      .first();

    if (!popSkill) continue;

    // Decay proportional to the character's skill level
    // Losing an expert hurts more than losing a novice
    const tier = getSkillTier(skillLevel);
    let decayFactor = 0.01; // 1% for novice

    switch (tier) {
      case "SKILLED":
        decayFactor = 0.02;
        break;
      case "EXPERT":
        decayFactor = 0.05;
        break;
      case "LEGENDARY":
        decayFactor = 0.1;
        break;
    }

    const newKnowledge = Math.max(
      0,
      popSkill.collectiveKnowledge * (1 - decayFactor)
    );

    await ctx.db.patch(popSkill._id, {
      collectiveKnowledge: newKnowledge,
    });
  }
}
