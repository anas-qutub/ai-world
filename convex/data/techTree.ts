// Technology tree definitions
// Each technology unlocks new capabilities and leads to advancement through eras

export interface TechDefinition {
  techId: string;
  name: string;
  description: string;
  era: "stone_age" | "bronze_age" | "iron_age" | "medieval";
  category: "military" | "economy" | "society" | "science";
  prerequisites: string[];
  knowledgeCost: number;
  unlocks: Array<{
    type: "building" | "unit" | "action" | "bonus";
    id: string;
    description: string;
  }>;
}

export const TECH_TREE: TechDefinition[] = [
  // =============================================
  // STONE AGE TECHNOLOGIES (Starting Era)
  // =============================================

  // Basic survival
  {
    techId: "fire_making",
    name: "Fire Making",
    description: "Control of fire for warmth, cooking, and protection",
    era: "stone_age",
    category: "science",
    prerequisites: [],
    knowledgeCost: 20,
    unlocks: [
      { type: "bonus", id: "food_preservation", description: "+10% food preservation" },
      { type: "bonus", id: "happiness_warmth", description: "+5 happiness from warmth" },
    ],
  },
  {
    techId: "stone_tools",
    name: "Stone Tools",
    description: "Crafting basic tools from stone for hunting and building",
    era: "stone_age",
    category: "economy",
    prerequisites: [],
    knowledgeCost: 15,
    unlocks: [
      { type: "bonus", id: "tool_efficiency", description: "+15% worker productivity" },
      { type: "action", id: "craft_tools", description: "Can craft basic tools" },
    ],
  },
  {
    techId: "hunting",
    name: "Hunting Techniques",
    description: "Organized group hunting for larger game",
    era: "stone_age",
    category: "economy",
    prerequisites: ["stone_tools"],
    knowledgeCost: 25,
    unlocks: [
      { type: "bonus", id: "hunting_food", description: "+20% food from hunting" },
      { type: "unit", id: "hunter", description: "Can train hunters" },
    ],
  },
  {
    techId: "gathering",
    name: "Gathering Knowledge",
    description: "Understanding of edible plants and seasonal patterns",
    era: "stone_age",
    category: "economy",
    prerequisites: [],
    knowledgeCost: 20,
    unlocks: [
      { type: "bonus", id: "food_gathering", description: "+15% food from gathering" },
      { type: "action", id: "forage", description: "More effective foraging" },
    ],
  },
  {
    techId: "primitive_shelter",
    name: "Primitive Shelter",
    description: "Construction of basic shelters from natural materials",
    era: "stone_age",
    category: "economy",
    prerequisites: [],
    knowledgeCost: 20,
    unlocks: [
      { type: "building", id: "hut", description: "Can build simple huts" },
      { type: "bonus", id: "shelter_happiness", description: "+10 happiness" },
    ],
  },
  {
    techId: "tribal_organization",
    name: "Tribal Organization",
    description: "Basic social structures and leadership",
    era: "stone_age",
    category: "society",
    prerequisites: [],
    knowledgeCost: 30,
    unlocks: [
      { type: "action", id: "establish_council", description: "Can form elder council" },
      { type: "action", id: "establish_chief", description: "Can appoint chief" },
    ],
  },
  {
    techId: "oral_tradition",
    name: "Oral Tradition",
    description: "Passing knowledge through stories and songs",
    era: "stone_age",
    category: "society",
    prerequisites: ["tribal_organization"],
    knowledgeCost: 25,
    unlocks: [
      { type: "bonus", id: "knowledge_retention", description: "-50% knowledge decay" },
      { type: "action", id: "create_tradition", description: "Can establish traditions" },
    ],
  },
  {
    techId: "primitive_warfare",
    name: "Primitive Warfare",
    description: "Basic combat techniques with clubs and spears",
    era: "stone_age",
    category: "military",
    prerequisites: ["stone_tools", "hunting"],
    knowledgeCost: 30,
    unlocks: [
      { type: "unit", id: "militia", description: "Can raise militia" },
      { type: "action", id: "raid", description: "Can raid other territories" },
    ],
  },

  // =============================================
  // BRONZE AGE TECHNOLOGIES
  // =============================================

  {
    techId: "agriculture",
    name: "Agriculture",
    description: "Cultivation of crops and planned farming",
    era: "bronze_age",
    category: "economy",
    prerequisites: ["gathering", "stone_tools"],
    knowledgeCost: 50,
    unlocks: [
      { type: "building", id: "farm", description: "Can build farms" },
      { type: "bonus", id: "food_production", description: "+100% food production" },
    ],
  },
  {
    techId: "animal_husbandry",
    name: "Animal Husbandry",
    description: "Domestication of animals for food and labor",
    era: "bronze_age",
    category: "economy",
    prerequisites: ["hunting", "agriculture"],
    knowledgeCost: 45,
    unlocks: [
      { type: "building", id: "pasture", description: "Can build pastures" },
      { type: "bonus", id: "livestock_food", description: "+50% food from livestock" },
    ],
  },
  {
    techId: "bronze_working",
    name: "Bronze Working",
    description: "Smelting copper and tin to create bronze",
    era: "bronze_age",
    category: "science",
    prerequisites: ["fire_making", "stone_tools"],
    knowledgeCost: 60,
    unlocks: [
      { type: "building", id: "forge", description: "Can build bronze forge" },
      { type: "bonus", id: "tool_quality", description: "+30% tool effectiveness" },
    ],
  },
  {
    techId: "writing",
    name: "Writing",
    description: "Recording information through symbols and scripts",
    era: "bronze_age",
    category: "society",
    prerequisites: ["oral_tradition"],
    knowledgeCost: 70,
    unlocks: [
      { type: "building", id: "academy", description: "Can establish academies" },
      { type: "bonus", id: "research_speed", description: "+25% research speed" },
    ],
  },
  {
    techId: "trade",
    name: "Trade",
    description: "Organized exchange of goods between communities",
    era: "bronze_age",
    category: "economy",
    prerequisites: ["agriculture", "tribal_organization"],
    knowledgeCost: 50,
    unlocks: [
      { type: "building", id: "market", description: "Can build markets" },
      { type: "action", id: "establish_trade_route", description: "Can establish trade routes" },
    ],
  },
  {
    techId: "construction",
    name: "Construction",
    description: "Advanced building techniques with mud brick and wood",
    era: "bronze_age",
    category: "economy",
    prerequisites: ["primitive_shelter", "bronze_working"],
    knowledgeCost: 55,
    unlocks: [
      { type: "building", id: "workshop", description: "Can build workshops" },
      { type: "building", id: "wooden_wall", description: "Can build wooden walls" },
    ],
  },
  {
    techId: "military_training",
    name: "Military Training",
    description: "Professional soldiers and organized tactics",
    era: "bronze_age",
    category: "military",
    prerequisites: ["primitive_warfare", "bronze_working"],
    knowledgeCost: 60,
    unlocks: [
      { type: "building", id: "barracks", description: "Can build barracks" },
      { type: "unit", id: "infantry", description: "Can train infantry" },
    ],
  },
  {
    techId: "horse_riding",
    name: "Horse Riding",
    description: "Domestication and riding of horses",
    era: "bronze_age",
    category: "military",
    prerequisites: ["animal_husbandry"],
    knowledgeCost: 55,
    unlocks: [
      { type: "unit", id: "cavalry", description: "Can train cavalry" },
      { type: "bonus", id: "movement_speed", description: "+50% army movement speed" },
    ],
  },
  {
    techId: "law_codes",
    name: "Law Codes",
    description: "Written laws and formal justice systems",
    era: "bronze_age",
    category: "society",
    prerequisites: ["writing", "tribal_organization"],
    knowledgeCost: 65,
    unlocks: [
      { type: "action", id: "establish_democracy", description: "Can establish democracy" },
      { type: "bonus", id: "stability", description: "+15% faction stability" },
    ],
  },

  // =============================================
  // IRON AGE TECHNOLOGIES
  // =============================================

  {
    techId: "iron_working",
    name: "Iron Working",
    description: "Smelting and forging iron tools and weapons",
    era: "iron_age",
    category: "science",
    prerequisites: ["bronze_working"],
    knowledgeCost: 80,
    unlocks: [
      { type: "bonus", id: "weapon_quality", description: "+50% military effectiveness" },
      { type: "bonus", id: "tool_durability", description: "+40% tool durability" },
    ],
  },
  {
    techId: "archery",
    name: "Advanced Archery",
    description: "Composite bows and organized archer units",
    era: "iron_age",
    category: "military",
    prerequisites: ["military_training", "iron_working"],
    knowledgeCost: 70,
    unlocks: [
      { type: "unit", id: "archer", description: "Can train archer units" },
      { type: "bonus", id: "ranged_combat", description: "+30% ranged damage" },
    ],
  },
  {
    techId: "masonry",
    name: "Masonry",
    description: "Building with cut stone blocks",
    era: "iron_age",
    category: "economy",
    prerequisites: ["construction", "iron_working"],
    knowledgeCost: 75,
    unlocks: [
      { type: "building", id: "stone_wall", description: "Can build stone walls" },
      { type: "bonus", id: "building_durability", description: "+50% building health" },
    ],
  },
  {
    techId: "siege_warfare",
    name: "Siege Warfare",
    description: "Tactics and equipment for attacking fortifications",
    era: "iron_age",
    category: "military",
    prerequisites: ["military_training", "construction"],
    knowledgeCost: 85,
    unlocks: [
      { type: "unit", id: "siege", description: "Can build siege equipment" },
      { type: "action", id: "lay_siege", description: "Can lay siege to fortifications" },
    ],
  },
  {
    techId: "currency",
    name: "Currency",
    description: "Standardized money for trade and taxation",
    era: "iron_age",
    category: "economy",
    prerequisites: ["trade", "iron_working"],
    knowledgeCost: 70,
    unlocks: [
      { type: "bonus", id: "trade_efficiency", description: "+40% trade income" },
      { type: "action", id: "set_tax_rate", description: "Can adjust taxation" },
    ],
  },
  {
    techId: "philosophy",
    name: "Philosophy",
    description: "Systematic study of knowledge and ethics",
    era: "iron_age",
    category: "science",
    prerequisites: ["writing", "law_codes"],
    knowledgeCost: 90,
    unlocks: [
      { type: "bonus", id: "research_boost", description: "+35% research effectiveness" },
      { type: "action", id: "establish_theocracy", description: "Can establish theocracy" },
    ],
  },
  {
    techId: "engineering",
    name: "Engineering",
    description: "Applied mathematics and mechanical principles",
    era: "iron_age",
    category: "science",
    prerequisites: ["masonry", "philosophy"],
    knowledgeCost: 95,
    unlocks: [
      { type: "bonus", id: "construction_speed", description: "+50% building speed" },
      { type: "building", id: "aqueduct", description: "Can build aqueducts" },
    ],
  },
  {
    techId: "medicine",
    name: "Medicine",
    description: "Understanding of diseases and healing",
    era: "iron_age",
    category: "science",
    prerequisites: ["philosophy"],
    knowledgeCost: 80,
    unlocks: [
      { type: "bonus", id: "death_rate", description: "-30% death rate" },
      { type: "action", id: "quarantine", description: "Can quarantine diseases" },
    ],
  },

  // =============================================
  // MEDIEVAL TECHNOLOGIES
  // =============================================

  {
    techId: "steel_working",
    name: "Steel Working",
    description: "Production of high-quality steel",
    era: "medieval",
    category: "science",
    prerequisites: ["iron_working", "engineering"],
    knowledgeCost: 100,
    unlocks: [
      { type: "bonus", id: "weapon_mastery", description: "+75% military power" },
      { type: "bonus", id: "armor_quality", description: "+50% unit defense" },
    ],
  },
  {
    techId: "castle_building",
    name: "Castle Building",
    description: "Advanced defensive fortification architecture",
    era: "medieval",
    category: "military",
    prerequisites: ["masonry", "siege_warfare"],
    knowledgeCost: 110,
    unlocks: [
      { type: "building", id: "castle", description: "Can build castles" },
      { type: "bonus", id: "defense_bonus", description: "+100% fortification defense" },
    ],
  },
  {
    techId: "guilds",
    name: "Guilds",
    description: "Organized craftsmen and professional associations",
    era: "medieval",
    category: "economy",
    prerequisites: ["currency", "law_codes"],
    knowledgeCost: 90,
    unlocks: [
      { type: "bonus", id: "production", description: "+50% workshop output" },
      { type: "action", id: "class_reform", description: "Can reform social classes" },
    ],
  },
  {
    techId: "banking",
    name: "Banking",
    description: "Financial institutions and credit systems",
    era: "medieval",
    category: "economy",
    prerequisites: ["guilds", "currency"],
    knowledgeCost: 100,
    unlocks: [
      { type: "bonus", id: "wealth_growth", description: "+25% passive wealth growth" },
      { type: "bonus", id: "trade_range", description: "+100% trade route distance" },
    ],
  },
  {
    techId: "heavy_cavalry",
    name: "Heavy Cavalry",
    description: "Armored mounted knights",
    era: "medieval",
    category: "military",
    prerequisites: ["horse_riding", "steel_working"],
    knowledgeCost: 105,
    unlocks: [
      { type: "unit", id: "knight", description: "Can train knights" },
      { type: "bonus", id: "cavalry_charge", description: "+100% cavalry attack" },
    ],
  },
  {
    techId: "advanced_fortifications",
    name: "Advanced Fortifications",
    description: "Complex defensive systems with multiple walls",
    era: "medieval",
    category: "military",
    prerequisites: ["castle_building", "engineering"],
    knowledgeCost: 120,
    unlocks: [
      { type: "building", id: "fortress", description: "Can build fortresses" },
      { type: "bonus", id: "siege_resistance", description: "+75% siege resistance" },
    ],
  },
  {
    techId: "universities",
    name: "Universities",
    description: "Centers of higher learning and research",
    era: "medieval",
    category: "science",
    prerequisites: ["philosophy", "guilds"],
    knowledgeCost: 110,
    unlocks: [
      { type: "building", id: "university", description: "Can build universities" },
      { type: "bonus", id: "research_mastery", description: "+50% research speed" },
    ],
  },
  {
    techId: "nationalism",
    name: "Nationalism",
    description: "Unified national identity and loyalty",
    era: "medieval",
    category: "society",
    prerequisites: ["law_codes", "philosophy"],
    knowledgeCost: 95,
    unlocks: [
      { type: "bonus", id: "unity", description: "-50% rebellion risk" },
      { type: "bonus", id: "morale", description: "+25% military morale" },
    ],
  },
];

// Get starting technologies (no prerequisites)
export function getStartingTechnologies(): TechDefinition[] {
  return TECH_TREE.filter((tech) => tech.prerequisites.length === 0);
}

// Get technologies available for an era
export function getTechnologiesForEra(era: string): TechDefinition[] {
  return TECH_TREE.filter((tech) => tech.era === era);
}

// Get technology by ID
export function getTechnologyById(techId: string): TechDefinition | undefined {
  return TECH_TREE.find((tech) => tech.techId === techId);
}

// Get technologies unlocked by researching a specific tech
export function getUnlockedTechnologies(researchedTechIds: Set<string>): TechDefinition[] {
  return TECH_TREE.filter((tech) => {
    if (researchedTechIds.has(tech.techId)) return false;
    return tech.prerequisites.every((prereq) => researchedTechIds.has(prereq));
  });
}
