// Technology tree definitions
// Each technology unlocks new capabilities and leads to advancement through eras

/**
 * Skill requirement for a technology to emerge organically.
 * Technologies unlock when enough of your population has practical skill in related areas.
 */
export interface TechSkillRequirement {
  skill: string; // "smithing", "farming", "literacy", etc.
  minExpertPercent?: number; // % of population that must be experts (70+ skill)
  minSkilledPercent?: number; // % that must be skilled (30+ skill)
  minAverageLevel?: number; // Average skill level among skilled workers
}

export interface TechDefinition {
  techId: string;
  name: string;
  description: string;
  era: "stone_age" | "bronze_age" | "iron_age" | "medieval" | "renaissance" | "industrial" | "modern" | "atomic";
  category: "military" | "economy" | "society" | "science";
  prerequisites: string[];
  knowledgeCost: number;
  unlocks: Array<{
    type: "building" | "unit" | "action" | "bonus";
    id: string;
    description: string;
  }>;
  // NEW: Organic knowledge requirements
  // Technologies emerge when your population has enough practical skill
  requiredSkills?: TechSkillRequirement[];
  // Skills that give bonus progress (even if not required)
  relatedSkills?: string[];
  // If true, this tech is innate (humans have known it for millennia)
  isInnate?: boolean;
}

export const TECH_TREE: TechDefinition[] = [
  // =============================================
  // STONE AGE TECHNOLOGIES (Starting Era)
  // =============================================

  // =============================================
  // INNATE KNOWLEDGE - Known for millennia, no skill requirements
  // =============================================
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
    isInnate: true, // Humans have controlled fire for 400,000+ years
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
    isInnate: true, // Stone tools for 2+ million years
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
    isInnate: true, // Basic hunting is instinctive
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
    isInnate: true, // Foraging is instinctive
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
    isInnate: true, // Basic shelter is instinctive
  },
  // =============================================
  // STONE AGE - LEARNABLE (requires some skill development)
  // =============================================
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
    // Requires charismatic leaders
    requiredSkills: [
      { skill: "persuasion", minSkilledPercent: 5 },
    ],
    relatedSkills: ["negotiation"],
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
    requiredSkills: [
      { skill: "persuasion", minSkilledPercent: 10 },
    ],
    relatedSkills: ["history"],
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
    requiredSkills: [
      { skill: "melee", minSkilledPercent: 10 },
    ],
    relatedSkills: ["tactics"],
  },
  {
    techId: "woodworking",
    name: "Woodworking",
    description: "Shaping wood with stone axes, creating planks and beams",
    era: "stone_age",
    category: "economy",
    prerequisites: ["stone_tools"],
    knowledgeCost: 25,
    unlocks: [
      { type: "bonus", id: "wood_efficiency", description: "+30% wood from gathering" },
      { type: "bonus", id: "shelter_quality", description: "+20% shelter durability" },
      { type: "action", id: "craft_axe", description: "Can craft stone axes" },
    ],
    requiredSkills: [
      { skill: "carpentry", minSkilledPercent: 10, minAverageLevel: 30 },
    ],
  },
  {
    techId: "pottery",
    name: "Pottery",
    description: "Shaping and firing clay vessels for storage and cooking",
    era: "stone_age",
    category: "economy",
    prerequisites: ["fire_making", "gathering"],
    knowledgeCost: 30,
    unlocks: [
      { type: "bonus", id: "food_storage", description: "+25% food preservation" },
      { type: "bonus", id: "water_storage", description: "Can store water safely" },
      { type: "building", id: "pottery_workshop", description: "Can build pottery workshop" },
    ],
    // Pottery requires skilled hands at shaping materials
    requiredSkills: [
      { skill: "tailoring", minSkilledPercent: 10 },
    ],
    relatedSkills: ["smithing"],
  },
  {
    techId: "weaving",
    name: "Weaving",
    description: "Creating cloth, rope, and nets from plant fibers",
    era: "stone_age",
    category: "economy",
    prerequisites: ["gathering"],
    knowledgeCost: 25,
    unlocks: [
      { type: "bonus", id: "clothing", description: "+10% cold resistance" },
      { type: "bonus", id: "fishing_nets", description: "+20% fishing yield" },
      { type: "action", id: "make_rope", description: "Can craft rope and cordage" },
    ],
    requiredSkills: [
      { skill: "tailoring", minSkilledPercent: 10, minAverageLevel: 30 },
    ],
  },
  {
    techId: "fishing",
    name: "Fishing",
    description: "Techniques for catching fish with spears, traps, and nets",
    era: "stone_age",
    category: "economy",
    prerequisites: ["hunting", "weaving"],
    knowledgeCost: 30,
    unlocks: [
      { type: "bonus", id: "fish_food", description: "+40% food from fishing" },
      { type: "action", id: "fish", description: "Can organize fishing expeditions" },
    ],
    requiredSkills: [
      { skill: "farming", minSkilledPercent: 15, minAverageLevel: 40 },
    ],
    relatedSkills: ["animalcare"],
  },
  {
    techId: "rafts",
    name: "Rafts & Canoes",
    description: "Simple watercraft from logs and animal skins",
    era: "stone_age",
    category: "economy",
    prerequisites: ["woodworking", "fishing"],
    knowledgeCost: 35,
    unlocks: [
      { type: "bonus", id: "river_travel", description: "Can travel on rivers" },
      { type: "bonus", id: "coastal_fishing", description: "+30% coastal food gathering" },
    ],
    requiredSkills: [
      { skill: "carpentry", minSkilledPercent: 15, minAverageLevel: 45 },
    ],
  },

  // =============================================
  // BRONZE AGE TECHNOLOGIES
  // Requires skilled workers (10-20% of population)
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
    // Major breakthrough - needs experienced farmers
    requiredSkills: [
      { skill: "farming", minSkilledPercent: 20, minExpertPercent: 10, minAverageLevel: 50 },
    ],
    relatedSkills: ["animalcare"],
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
    requiredSkills: [
      { skill: "animalcare", minSkilledPercent: 15, minExpertPercent: 5 },
    ],
    relatedSkills: ["farming"],
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
    // Critical tech - requires expert smiths
    requiredSkills: [
      { skill: "smithing", minExpertPercent: 10, minAverageLevel: 50 },
    ],
    relatedSkills: ["mining", "carpentry"],
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
    // Rare skill - needs very literate people
    requiredSkills: [
      { skill: "literacy", minExpertPercent: 5, minAverageLevel: 60 },
    ],
    relatedSkills: ["history", "theology"],
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
    requiredSkills: [
      { skill: "trading", minSkilledPercent: 15, minAverageLevel: 45 },
    ],
    relatedSkills: ["negotiation", "mathematics"],
  },
  {
    techId: "sailing",
    name: "Sailing",
    description: "Building ships with sails for sea travel and trade",
    era: "bronze_age",
    category: "economy",
    prerequisites: ["rafts", "weaving", "woodworking"],
    knowledgeCost: 60,
    unlocks: [
      { type: "building", id: "harbor", description: "Can build harbors" },
      { type: "bonus", id: "sea_trade", description: "+50% trade income from coastal routes" },
      { type: "action", id: "sea_exploration", description: "Can explore by sea" },
    ],
    // Requires expert carpenters who can build ships
    requiredSkills: [
      { skill: "carpentry", minExpertPercent: 10, minAverageLevel: 55 },
    ],
    relatedSkills: ["tailoring"],
  },
  {
    techId: "carpentry",
    name: "Carpentry",
    description: "Advanced woodworking with bronze tools for furniture and buildings",
    era: "bronze_age",
    category: "economy",
    prerequisites: ["woodworking", "bronze_working"],
    knowledgeCost: 45,
    unlocks: [
      { type: "bonus", id: "wood_buildings", description: "+40% building quality" },
      { type: "bonus", id: "furniture", description: "+5 happiness from comfort" },
      { type: "action", id: "craft_furniture", description: "Can craft furniture" },
    ],
    requiredSkills: [
      { skill: "carpentry", minSkilledPercent: 20, minExpertPercent: 8 },
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
    requiredSkills: [
      { skill: "masonry", minSkilledPercent: 15, minExpertPercent: 5 },
    ],
    relatedSkills: ["carpentry"],
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
    requiredSkills: [
      { skill: "tactics", minSkilledPercent: 10, minExpertPercent: 5 },
      { skill: "melee", minSkilledPercent: 15 },
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
    requiredSkills: [
      { skill: "animalcare", minExpertPercent: 10, minAverageLevel: 55 },
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
    requiredSkills: [
      { skill: "law", minSkilledPercent: 10, minExpertPercent: 5 },
      { skill: "literacy", minSkilledPercent: 15 },
    ],
  },

  // =============================================
  // IRON AGE TECHNOLOGIES
  // Requires experts (10-15% of population with 70+ skill)
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
    // Advanced metallurgy - needs expert smiths
    requiredSkills: [
      { skill: "smithing", minExpertPercent: 15, minAverageLevel: 60 },
    ],
    relatedSkills: ["mining"],
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
    requiredSkills: [
      { skill: "ranged", minSkilledPercent: 15, minExpertPercent: 8 },
      { skill: "carpentry", minSkilledPercent: 10 },
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
    requiredSkills: [
      { skill: "masonry", minExpertPercent: 10, minAverageLevel: 55 },
    ],
    relatedSkills: ["mining"],
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
    requiredSkills: [
      { skill: "tactics", minExpertPercent: 10, minAverageLevel: 55 },
      { skill: "engineering", minSkilledPercent: 10 },
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
    requiredSkills: [
      { skill: "trading", minExpertPercent: 10, minAverageLevel: 55 },
      { skill: "mathematics", minSkilledPercent: 15 },
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
    // Deep thinking - needs literate scholars
    requiredSkills: [
      { skill: "literacy", minExpertPercent: 8 },
      { skill: "theology", minSkilledPercent: 10 },
    ],
    relatedSkills: ["history"],
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
    requiredSkills: [
      { skill: "engineering", minExpertPercent: 10, minAverageLevel: 60 },
      { skill: "mathematics", minExpertPercent: 8 },
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
    requiredSkills: [
      { skill: "medicine", minExpertPercent: 8, minAverageLevel: 55 },
    ],
    relatedSkills: ["literacy"],
  },

  // =============================================
  // MEDIEVAL TECHNOLOGIES
  // Requires master craftsmen (15%+ experts)
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
    // Pinnacle of metallurgy - needs legendary smiths
    requiredSkills: [
      { skill: "smithing", minExpertPercent: 18, minAverageLevel: 70 },
    ],
    relatedSkills: ["engineering"],
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
    requiredSkills: [
      { skill: "masonry", minExpertPercent: 15, minAverageLevel: 65 },
      { skill: "engineering", minExpertPercent: 10 },
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
    requiredSkills: [
      { skill: "trading", minExpertPercent: 12 },
      { skill: "negotiation", minSkilledPercent: 15 },
    ],
    relatedSkills: ["smithing", "carpentry", "tailoring"],
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
    requiredSkills: [
      { skill: "mathematics", minExpertPercent: 12 },
      { skill: "trading", minExpertPercent: 15 },
      { skill: "literacy", minSkilledPercent: 20 },
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
    requiredSkills: [
      { skill: "animalcare", minExpertPercent: 15, minAverageLevel: 65 },
      { skill: "melee", minExpertPercent: 12 },
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
    requiredSkills: [
      { skill: "engineering", minExpertPercent: 15, minAverageLevel: 70 },
      { skill: "masonry", minExpertPercent: 12 },
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
    requiredSkills: [
      { skill: "literacy", minExpertPercent: 15, minAverageLevel: 70 },
      { skill: "history", minSkilledPercent: 15 },
      { skill: "theology", minSkilledPercent: 12 },
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
    requiredSkills: [
      { skill: "persuasion", minExpertPercent: 12 },
      { skill: "history", minExpertPercent: 10 },
    ],
    relatedSkills: ["literacy"],
  },

  // =============================================
  // RENAISSANCE TECHNOLOGIES
  // The age of discovery, scientific revolution, and early firearms
  // =============================================

  {
    techId: "printing_press",
    name: "Printing Press",
    description: "Movable type printing for mass production of books",
    era: "renaissance",
    category: "science",
    prerequisites: ["universities", "steel_working"],
    knowledgeCost: 130,
    unlocks: [
      { type: "bonus", id: "literacy_spread", description: "+100% literacy spread rate" },
      { type: "bonus", id: "research_boost", description: "+40% research speed" },
      { type: "building", id: "printing_house", description: "Can build printing houses" },
    ],
    requiredSkills: [
      { skill: "printing", minExpertPercent: 10, minAverageLevel: 60 },
      { skill: "metallurgy", minSkilledPercent: 15 },
    ],
    relatedSkills: ["literacy"],
  },
  {
    techId: "gunpowder",
    name: "Gunpowder",
    description: "Explosive powder for weapons and mining",
    era: "renaissance",
    category: "military",
    prerequisites: ["steel_working", "universities"],
    knowledgeCost: 140,
    unlocks: [
      { type: "unit", id: "musketeer", description: "Can train musketeers" },
      { type: "bonus", id: "mining_efficiency", description: "+50% mining yield" },
    ],
    requiredSkills: [
      { skill: "explosives", minExpertPercent: 8, minAverageLevel: 55 },
      { skill: "chemistry", minSkilledPercent: 15 },
    ],
    relatedSkills: ["alchemy"],
  },
  {
    techId: "cannon",
    name: "Cannon",
    description: "Large gunpowder artillery for siege and naval warfare",
    era: "renaissance",
    category: "military",
    prerequisites: ["gunpowder", "siege_warfare"],
    knowledgeCost: 150,
    unlocks: [
      { type: "unit", id: "cannon", description: "Can build cannons" },
      { type: "bonus", id: "siege_power", description: "+200% siege effectiveness" },
    ],
    requiredSkills: [
      { skill: "gunsmithing", minExpertPercent: 10, minAverageLevel: 60 },
      { skill: "ballistics", minSkilledPercent: 12 },
    ],
    relatedSkills: ["smithing"],
  },
  {
    techId: "scientific_method",
    name: "Scientific Method",
    description: "Systematic experimentation and empirical observation",
    era: "renaissance",
    category: "science",
    prerequisites: ["universities", "printing_press"],
    knowledgeCost: 160,
    unlocks: [
      { type: "bonus", id: "research_mastery", description: "+75% research efficiency" },
      { type: "building", id: "laboratory", description: "Can build laboratories" },
    ],
    requiredSkills: [
      { skill: "physics", minExpertPercent: 8, minAverageLevel: 55 },
      { skill: "mathematics", minExpertPercent: 12 },
    ],
    relatedSkills: ["chemistry", "biology"],
  },
  {
    techId: "optics_tech",
    name: "Optics",
    description: "Understanding of light, lenses, and telescopes",
    era: "renaissance",
    category: "science",
    prerequisites: ["scientific_method"],
    knowledgeCost: 145,
    unlocks: [
      { type: "bonus", id: "naval_spotting", description: "+50% naval detection range" },
      { type: "action", id: "astronomical_observation", description: "Can make astronomical discoveries" },
    ],
    requiredSkills: [
      { skill: "optics", minExpertPercent: 10, minAverageLevel: 55 },
      { skill: "glassmaking", minExpertPercent: 8 },
    ],
  },
  {
    techId: "ocean_navigation",
    name: "Ocean Navigation",
    description: "Advanced navigation for transoceanic voyages",
    era: "renaissance",
    category: "economy",
    prerequisites: ["sailing", "optics_tech"],
    knowledgeCost: 155,
    unlocks: [
      { type: "action", id: "ocean_exploration", description: "Can explore distant lands" },
      { type: "bonus", id: "naval_range", description: "+200% naval range" },
    ],
    requiredSkills: [
      { skill: "navigation", minExpertPercent: 12, minAverageLevel: 60 },
      { skill: "cartography", minExpertPercent: 10 },
    ],
    relatedSkills: ["astronomy"],
  },
  {
    techId: "galleon",
    name: "Galleon",
    description: "Large multi-deck sailing ships for trade and war",
    era: "renaissance",
    category: "military",
    prerequisites: ["ocean_navigation", "cannon"],
    knowledgeCost: 165,
    unlocks: [
      { type: "unit", id: "galleon", description: "Can build galleons" },
      { type: "bonus", id: "naval_power", description: "+100% naval combat strength" },
    ],
    requiredSkills: [
      { skill: "naval_architecture", minExpertPercent: 10, minAverageLevel: 60 },
      { skill: "carpentry", minExpertPercent: 15 },
    ],
  },
  {
    techId: "star_fort",
    name: "Star Fort",
    description: "Cannon-resistant fortifications with angular bastions",
    era: "renaissance",
    category: "military",
    prerequisites: ["advanced_fortifications", "cannon"],
    knowledgeCost: 170,
    unlocks: [
      { type: "building", id: "star_fort", description: "Can build star forts" },
      { type: "bonus", id: "cannon_resistance", description: "+150% fortification vs artillery" },
    ],
    requiredSkills: [
      { skill: "fortification_modern", minExpertPercent: 10, minAverageLevel: 60 },
      { skill: "engineering", minExpertPercent: 15 },
    ],
  },
  {
    techId: "anatomy_tech",
    name: "Anatomy",
    description: "Scientific study of body structure through dissection",
    era: "renaissance",
    category: "science",
    prerequisites: ["medicine", "scientific_method"],
    knowledgeCost: 150,
    unlocks: [
      { type: "bonus", id: "surgery_success", description: "+50% surgery success rate" },
      { type: "bonus", id: "death_reduction", description: "-40% death rate" },
    ],
    requiredSkills: [
      { skill: "anatomy", minExpertPercent: 8, minAverageLevel: 55 },
      { skill: "surgery", minExpertPercent: 10 },
    ],
  },

  // =============================================
  // INDUSTRIAL TECHNOLOGIES
  // Steam power, factories, and mass production
  // =============================================

  {
    techId: "steam_power",
    name: "Steam Power",
    description: "Harnessing steam for mechanical work",
    era: "industrial",
    category: "science",
    prerequisites: ["scientific_method", "steel_working"],
    knowledgeCost: 200,
    unlocks: [
      { type: "building", id: "steam_factory", description: "Can build steam-powered factories" },
      { type: "bonus", id: "industrial_production", description: "+200% factory output" },
    ],
    requiredSkills: [
      { skill: "steam_engineering", minExpertPercent: 10, minAverageLevel: 60 },
      { skill: "thermodynamics", minExpertPercent: 8 },
    ],
    relatedSkills: ["mechanics"],
  },
  {
    techId: "industrialization",
    name: "Industrialization",
    description: "Factory-based mass production",
    era: "industrial",
    category: "economy",
    prerequisites: ["steam_power", "banking"],
    knowledgeCost: 220,
    unlocks: [
      { type: "bonus", id: "mass_production", description: "+300% goods production" },
      { type: "action", id: "industrialize", description: "Can industrialize territories" },
    ],
    requiredSkills: [
      { skill: "machine_tools", minExpertPercent: 12, minAverageLevel: 60 },
      { skill: "mechanics", minExpertPercent: 10 },
    ],
    relatedSkills: ["steel_production"],
  },
  {
    techId: "railway",
    name: "Railway",
    description: "Steam-powered rail transportation",
    era: "industrial",
    category: "economy",
    prerequisites: ["steam_power", "steel_working"],
    knowledgeCost: 210,
    unlocks: [
      { type: "building", id: "railway_station", description: "Can build railway stations" },
      { type: "bonus", id: "logistics", description: "+100% trade range and army movement" },
    ],
    requiredSkills: [
      { skill: "railways", minExpertPercent: 10, minAverageLevel: 58 },
      { skill: "steam_engineering", minSkilledPercent: 15 },
    ],
  },
  {
    techId: "telegraph",
    name: "Telegraph",
    description: "Electrical long-distance communication",
    era: "industrial",
    category: "science",
    prerequisites: ["scientific_method"],
    knowledgeCost: 180,
    unlocks: [
      { type: "bonus", id: "communication", description: "Instant coordination across territories" },
      { type: "bonus", id: "intelligence", description: "+50% espionage effectiveness" },
    ],
    requiredSkills: [
      { skill: "telegraphy", minExpertPercent: 8, minAverageLevel: 55 },
      { skill: "physics", minSkilledPercent: 15 },
    ],
  },
  {
    techId: "rifling",
    name: "Rifling",
    description: "Spiral grooves in gun barrels for accuracy",
    era: "industrial",
    category: "military",
    prerequisites: ["gunpowder", "industrialization"],
    knowledgeCost: 190,
    unlocks: [
      { type: "unit", id: "rifleman", description: "Can train riflemen" },
      { type: "bonus", id: "accuracy", description: "+100% ranged accuracy" },
    ],
    requiredSkills: [
      { skill: "gunsmithing", minExpertPercent: 12, minAverageLevel: 65 },
      { skill: "machine_tools", minSkilledPercent: 15 },
    ],
  },
  {
    techId: "ironclad",
    name: "Ironclad Ships",
    description: "Steam-powered armored warships",
    era: "industrial",
    category: "military",
    prerequisites: ["steam_power", "galleon", "steel_working"],
    knowledgeCost: 230,
    unlocks: [
      { type: "unit", id: "ironclad", description: "Can build ironclad warships" },
      { type: "bonus", id: "naval_dominance", description: "+200% naval combat vs wooden ships" },
    ],
    requiredSkills: [
      { skill: "naval_architecture", minExpertPercent: 12, minAverageLevel: 65 },
      { skill: "steel_production", minSkilledPercent: 15 },
    ],
  },
  {
    techId: "industrial_chemistry",
    name: "Industrial Chemistry",
    description: "Large-scale chemical production",
    era: "industrial",
    category: "science",
    prerequisites: ["scientific_method", "industrialization"],
    knowledgeCost: 200,
    unlocks: [
      { type: "building", id: "chemical_plant", description: "Can build chemical plants" },
      { type: "bonus", id: "fertilizer", description: "+100% farm yield" },
    ],
    requiredSkills: [
      { skill: "industrial_chemistry", minExpertPercent: 10, minAverageLevel: 60 },
      { skill: "chemistry", minExpertPercent: 12 },
    ],
  },
  {
    techId: "electricity",
    name: "Electricity",
    description: "Harnessing electrical power for light and machines",
    era: "industrial",
    category: "science",
    prerequisites: ["telegraph", "industrialization"],
    knowledgeCost: 240,
    unlocks: [
      { type: "building", id: "power_plant", description: "Can build power plants" },
      { type: "bonus", id: "night_productivity", description: "+50% productivity (electric lights)" },
    ],
    requiredSkills: [
      { skill: "electrical_engineering", minExpertPercent: 10, minAverageLevel: 60 },
      { skill: "physics", minExpertPercent: 12 },
    ],
  },

  // =============================================
  // MODERN TECHNOLOGIES
  // Combustion engines, flight, and early electronics
  // =============================================

  {
    techId: "combustion_engine",
    name: "Combustion Engine",
    description: "Internal combustion engines for vehicles",
    era: "modern",
    category: "science",
    prerequisites: ["electricity", "industrial_chemistry"],
    knowledgeCost: 280,
    unlocks: [
      { type: "unit", id: "motorized_unit", description: "Can build motorized vehicles" },
      { type: "bonus", id: "speed", description: "+100% army movement speed" },
    ],
    requiredSkills: [
      { skill: "internal_combustion", minExpertPercent: 10, minAverageLevel: 60 },
      { skill: "mechanics", minExpertPercent: 12 },
    ],
  },
  {
    techId: "flight",
    name: "Flight",
    description: "Heavier-than-air powered flight",
    era: "modern",
    category: "science",
    prerequisites: ["combustion_engine"],
    knowledgeCost: 300,
    unlocks: [
      { type: "unit", id: "airplane", description: "Can build airplanes" },
      { type: "bonus", id: "reconnaissance", description: "+100% reconnaissance range" },
    ],
    requiredSkills: [
      { skill: "aviation", minExpertPercent: 10, minAverageLevel: 60 },
      { skill: "physics", minExpertPercent: 12 },
    ],
  },
  {
    techId: "radio",
    name: "Radio",
    description: "Wireless communication through electromagnetic waves",
    era: "modern",
    category: "science",
    prerequisites: ["electricity"],
    knowledgeCost: 260,
    unlocks: [
      { type: "bonus", id: "coordination", description: "+50% military coordination" },
      { type: "action", id: "propaganda_broadcast", description: "Can broadcast propaganda" },
    ],
    requiredSkills: [
      { skill: "radio", minExpertPercent: 10, minAverageLevel: 58 },
      { skill: "electronics", minSkilledPercent: 15 },
    ],
  },
  {
    techId: "mass_production",
    name: "Mass Production",
    description: "Assembly line manufacturing",
    era: "modern",
    category: "economy",
    prerequisites: ["electricity", "industrialization"],
    knowledgeCost: 290,
    unlocks: [
      { type: "bonus", id: "production_mastery", description: "+400% factory output" },
      { type: "bonus", id: "cost_reduction", description: "-50% unit production cost" },
    ],
    requiredSkills: [
      { skill: "assembly_line", minExpertPercent: 12, minAverageLevel: 60 },
      { skill: "machine_tools", minExpertPercent: 15 },
    ],
  },
  {
    techId: "tank",
    name: "Tank",
    description: "Armored fighting vehicles",
    era: "modern",
    category: "military",
    prerequisites: ["combustion_engine", "rifling"],
    knowledgeCost: 320,
    unlocks: [
      { type: "unit", id: "tank", description: "Can build tanks" },
      { type: "bonus", id: "breakthrough", description: "+200% breakthrough attack" },
    ],
    requiredSkills: [
      { skill: "tank_warfare", minExpertPercent: 10, minAverageLevel: 58 },
      { skill: "automotive", minExpertPercent: 12 },
    ],
  },
  {
    techId: "fighter_aircraft",
    name: "Fighter Aircraft",
    description: "Military aircraft for air combat",
    era: "modern",
    category: "military",
    prerequisites: ["flight", "radio"],
    knowledgeCost: 340,
    unlocks: [
      { type: "unit", id: "fighter", description: "Can build fighter planes" },
      { type: "bonus", id: "air_superiority", description: "+100% air combat" },
    ],
    requiredSkills: [
      { skill: "air_combat", minExpertPercent: 10, minAverageLevel: 60 },
      { skill: "aviation", minExpertPercent: 15 },
    ],
  },
  {
    techId: "bomber",
    name: "Bomber Aircraft",
    description: "Aircraft for strategic bombing",
    era: "modern",
    category: "military",
    prerequisites: ["fighter_aircraft", "mass_production"],
    knowledgeCost: 360,
    unlocks: [
      { type: "unit", id: "bomber", description: "Can build bombers" },
      { type: "action", id: "strategic_bombing", description: "Can bomb enemy infrastructure" },
    ],
    requiredSkills: [
      { skill: "aviation", minExpertPercent: 15, minAverageLevel: 65 },
      { skill: "ballistics", minExpertPercent: 12 },
    ],
  },
  {
    techId: "submarine",
    name: "Submarine",
    description: "Underwater warships",
    era: "modern",
    category: "military",
    prerequisites: ["ironclad", "electricity"],
    knowledgeCost: 350,
    unlocks: [
      { type: "unit", id: "submarine", description: "Can build submarines" },
      { type: "bonus", id: "naval_stealth", description: "+100% naval stealth attacks" },
    ],
    requiredSkills: [
      { skill: "submarine_warfare", minExpertPercent: 10, minAverageLevel: 60 },
      { skill: "electronics", minExpertPercent: 10 },
    ],
  },
  {
    techId: "radar",
    name: "Radar",
    description: "Radio detection and ranging",
    era: "modern",
    category: "military",
    prerequisites: ["radio", "flight"],
    knowledgeCost: 330,
    unlocks: [
      { type: "bonus", id: "early_warning", description: "+200% air attack warning" },
      { type: "bonus", id: "naval_detection", description: "+100% naval detection" },
    ],
    requiredSkills: [
      { skill: "radar", minExpertPercent: 10, minAverageLevel: 60 },
      { skill: "electronics", minExpertPercent: 12 },
    ],
  },
  {
    techId: "antibiotics",
    name: "Antibiotics",
    description: "Medicines to fight bacterial infections",
    era: "modern",
    category: "science",
    prerequisites: ["industrial_chemistry", "anatomy_tech"],
    knowledgeCost: 280,
    unlocks: [
      { type: "bonus", id: "health", description: "-60% death rate from disease" },
      { type: "bonus", id: "military_medicine", description: "+50% wounded soldier recovery" },
    ],
    requiredSkills: [
      { skill: "biology", minExpertPercent: 12, minAverageLevel: 65 },
      { skill: "chemistry", minExpertPercent: 15 },
    ],
  },

  // =============================================
  // ATOMIC TECHNOLOGIES
  // Nuclear power, rockets, computers, and nuclear weapons
  // =============================================

  {
    techId: "nuclear_fission",
    name: "Nuclear Fission",
    description: "Splitting atoms to release massive energy",
    era: "atomic",
    category: "science",
    prerequisites: ["industrial_chemistry", "electricity"],
    knowledgeCost: 400,
    unlocks: [
      { type: "building", id: "nuclear_reactor", description: "Can build nuclear power plants" },
      { type: "bonus", id: "power_abundance", description: "+1000% power generation" },
    ],
    requiredSkills: [
      { skill: "nuclear_physics", minExpertPercent: 10, minAverageLevel: 65 },
      { skill: "physics", minExpertPercent: 15 },
    ],
    relatedSkills: ["chemistry"],
  },
  {
    techId: "atomic_bomb",
    name: "Atomic Bomb",
    description: "Nuclear fission weapon of mass destruction",
    era: "atomic",
    category: "military",
    prerequisites: ["nuclear_fission", "bomber"],
    knowledgeCost: 500,
    unlocks: [
      { type: "unit", id: "atomic_bomb", description: "Can build atomic bombs" },
      { type: "action", id: "nuclear_strike", description: "Can launch nuclear attacks" },
    ],
    requiredSkills: [
      { skill: "nuclear_weapons", minExpertPercent: 10, minAverageLevel: 70 },
      { skill: "nuclear_physics", minExpertPercent: 12 },
    ],
    relatedSkills: ["explosives"],
  },
  {
    techId: "hydrogen_bomb",
    name: "Hydrogen Bomb",
    description: "Thermonuclear fusion weapon",
    era: "atomic",
    category: "military",
    prerequisites: ["atomic_bomb", "rocketry"],
    knowledgeCost: 600,
    unlocks: [
      { type: "unit", id: "hydrogen_bomb", description: "Can build hydrogen bombs" },
      { type: "bonus", id: "nuclear_supremacy", description: "+1000% nuclear weapon yield" },
    ],
    requiredSkills: [
      { skill: "nuclear_weapons", minExpertPercent: 15, minAverageLevel: 75 },
      { skill: "nuclear_physics", minExpertPercent: 15 },
    ],
  },
  {
    techId: "rocketry",
    name: "Rocketry",
    description: "Liquid and solid fuel rockets",
    era: "atomic",
    category: "science",
    prerequisites: ["flight", "industrial_chemistry"],
    knowledgeCost: 380,
    unlocks: [
      { type: "unit", id: "rocket_artillery", description: "Can build rocket artillery" },
      { type: "bonus", id: "artillery_range", description: "+200% artillery range" },
    ],
    requiredSkills: [
      { skill: "rocketry", minExpertPercent: 10, minAverageLevel: 60 },
      { skill: "ballistics", minExpertPercent: 12 },
    ],
  },
  {
    techId: "jet_engine",
    name: "Jet Engine",
    description: "Jet propulsion for aircraft",
    era: "atomic",
    category: "science",
    prerequisites: ["flight", "rocketry"],
    knowledgeCost: 420,
    unlocks: [
      { type: "unit", id: "jet_fighter", description: "Can build jet fighters" },
      { type: "bonus", id: "air_speed", description: "+200% aircraft speed" },
    ],
    requiredSkills: [
      { skill: "jet_propulsion", minExpertPercent: 10, minAverageLevel: 65 },
      { skill: "thermodynamics", minExpertPercent: 12 },
    ],
  },
  {
    techId: "icbm",
    name: "ICBM",
    description: "Intercontinental ballistic missiles",
    era: "atomic",
    category: "military",
    prerequisites: ["rocketry", "atomic_bomb"],
    knowledgeCost: 550,
    unlocks: [
      { type: "unit", id: "icbm", description: "Can build ICBMs" },
      { type: "action", id: "nuclear_deterrence", description: "Can establish nuclear deterrence" },
    ],
    requiredSkills: [
      { skill: "missile_systems", minExpertPercent: 10, minAverageLevel: 65 },
      { skill: "rocketry", minExpertPercent: 15 },
    ],
    relatedSkills: ["nuclear_delivery"],
  },
  {
    techId: "computers",
    name: "Computers",
    description: "Electronic computing machines",
    era: "atomic",
    category: "science",
    prerequisites: ["electricity", "radar"],
    knowledgeCost: 400,
    unlocks: [
      { type: "bonus", id: "calculation", description: "+100% research speed" },
      { type: "bonus", id: "encryption", description: "+100% espionage defense" },
    ],
    requiredSkills: [
      { skill: "computing", minExpertPercent: 10, minAverageLevel: 65 },
      { skill: "electronics", minExpertPercent: 15 },
    ],
    relatedSkills: ["mathematics"],
  },
  {
    techId: "space_program",
    name: "Space Program",
    description: "Manned and unmanned space exploration",
    era: "atomic",
    category: "science",
    prerequisites: ["rocketry", "computers"],
    knowledgeCost: 480,
    unlocks: [
      { type: "action", id: "satellite_launch", description: "Can launch satellites" },
      { type: "bonus", id: "global_surveillance", description: "+200% global intelligence" },
    ],
    requiredSkills: [
      { skill: "rocketry", minExpertPercent: 15, minAverageLevel: 70 },
      { skill: "computing", minExpertPercent: 12 },
    ],
  },
  {
    techId: "nuclear_submarine",
    name: "Nuclear Submarine",
    description: "Nuclear-powered submarines with unlimited range",
    era: "atomic",
    category: "military",
    prerequisites: ["submarine", "nuclear_fission"],
    knowledgeCost: 450,
    unlocks: [
      { type: "unit", id: "nuclear_submarine", description: "Can build nuclear submarines" },
      { type: "bonus", id: "second_strike", description: "Guaranteed nuclear retaliation capability" },
    ],
    requiredSkills: [
      { skill: "nuclear_engineering", minExpertPercent: 10, minAverageLevel: 65 },
      { skill: "submarine_warfare", minExpertPercent: 12 },
    ],
  },
  {
    techId: "aircraft_carrier",
    name: "Aircraft Carrier",
    description: "Mobile airfields at sea",
    era: "atomic",
    category: "military",
    prerequisites: ["jet_engine", "radar"],
    knowledgeCost: 440,
    unlocks: [
      { type: "unit", id: "carrier", description: "Can build aircraft carriers" },
      { type: "bonus", id: "naval_air_power", description: "+200% naval air projection" },
    ],
    requiredSkills: [
      { skill: "naval_architecture", minExpertPercent: 15, minAverageLevel: 70 },
      { skill: "aviation", minExpertPercent: 15 },
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
