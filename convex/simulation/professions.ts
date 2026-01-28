import { MutationCtx, QueryCtx } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";
import { recordSkillPractice } from "./collectiveKnowledge";

// =============================================
// PROFESSION & SKILLS SYSTEM
// =============================================
// Characters have professions that determine their role in society
// and skills that grow with practice and education.

// Profession categories and their associated skills
// Organized by era - earlier professions available first, later ones unlock with technology
export const PROFESSION_CATEGORIES = {
  // PRIMITIVE ERA
  gathering: ["gatherer", "hunter", "woodcutter", "quarryman"],

  // ANCIENT ERA
  leadership: ["ruler", "noble", "administrator", "tax_collector", "diplomat"],
  military: ["soldier", "general", "guard", "mercenary", "archer", "cavalry_soldier"],
  religious: ["priest", "monk", "oracle"],
  crafts: ["blacksmith", "carpenter", "mason", "weaver", "potter", "jeweler", "tanner", "toolmaker"],
  knowledge: ["scholar", "teacher", "scribe", "physician", "engineer", "alchemist", "astronomer"],
  commerce: ["merchant", "trader", "banker", "innkeeper"],
  agriculture: ["farmer", "herder", "fisherman", "irrigator", "brewer"],
  labor: ["miner", "laborer", "servant"],
  justice: ["judge", "lawkeeper"],

  // MEDIEVAL ERA
  medieval_crafts: ["armorsmith", "weaponsmith", "glassmaker", "clockmaker"],
  medieval_military: ["knight", "siege_engineer"],
  medieval_knowledge: ["metallurgist", "cartographer", "navigator"],

  // RENAISSANCE ERA
  renaissance_crafts: ["gunsmith", "printer", "optician"],
  renaissance_military: ["artillerist", "naval_officer"],
  renaissance_knowledge: ["chemist", "physicist", "biologist", "anatomist"],

  // INDUSTRIAL ERA
  industrial: ["steam_engineer", "machinist", "factory_worker", "railway_worker", "telegraph_operator"],
  industrial_knowledge: ["industrial_chemist", "mechanical_engineer"],

  // MODERN ERA
  modern_industrial: ["electrician", "automotive_worker", "aircraft_mechanic", "radio_operator"],
  modern_military: ["tank_crew", "pilot", "submarine_crew"],
  modern_knowledge: ["electrical_engineer", "electronics_technician"],

  // ATOMIC ERA
  atomic: ["nuclear_engineer", "rocket_scientist", "computer_scientist", "missile_technician"],

  // OTHER
  other: ["artisan", "entertainer", "slave", "unemployed"],
};

// Skills required and developed by each profession
// Era indicates when this profession becomes available
export const PROFESSION_SKILLS: Record<string, {
  requiredSkills: Partial<Record<string, number>>;
  developedSkills: string[];
  productionType?: string;
  productionAmount?: number;
  era?: string; // primitive, ancient, classical, medieval, renaissance, industrial, modern, atomic
}> = {
  // =============================================
  // PRIMITIVE ERA - Gathering & Survival
  // =============================================
  gatherer: {
    requiredSkills: {},
    developedSkills: ["foraging", "herbalism"],
    productionType: "food",
    productionAmount: 3,
    era: "primitive",
  },
  hunter: {
    requiredSkills: { hunting: 10 },
    developedSkills: ["hunting", "ranged", "leatherworking"],
    productionType: "food",
    productionAmount: 3,
    era: "primitive",
  },
  woodcutter: {
    requiredSkills: {},
    developedSkills: ["woodcutting", "woodworking"],
    productionType: "wood",
    productionAmount: 4,
    era: "primitive",
  },
  quarryman: {
    requiredSkills: {},
    developedSkills: ["quarrying", "stoneworking"],
    productionType: "stone",
    productionAmount: 3,
    era: "primitive",
  },

  // =============================================
  // ANCIENT ERA - Specialized Crafts & Agriculture
  // =============================================

  // Leadership
  ruler: {
    requiredSkills: { literacy: 30, persuasion: 40 },
    developedSkills: ["persuasion", "diplomacy", "negotiation", "law", "administration"],
    era: "ancient",
  },
  noble: {
    requiredSkills: { literacy: 20 },
    developedSkills: ["persuasion", "negotiation", "history"],
    era: "ancient",
  },
  administrator: {
    requiredSkills: { literacy: 40, mathematics: 30 },
    developedSkills: ["literacy", "mathematics", "law", "administration"],
    era: "ancient",
  },
  tax_collector: {
    requiredSkills: { mathematics: 40 },
    developedSkills: ["mathematics", "persuasion", "negotiation"],
    era: "ancient",
  },
  diplomat: {
    requiredSkills: { literacy: 40, persuasion: 50, negotiation: 40 },
    developedSkills: ["persuasion", "negotiation", "diplomacy", "history"],
    era: "classical",
  },

  // Military
  soldier: {
    requiredSkills: { melee: 20 },
    developedSkills: ["melee", "ranged", "tactics"],
    era: "ancient",
  },
  general: {
    requiredSkills: { tactics: 50, melee: 30, literacy: 30 },
    developedSkills: ["tactics", "persuasion", "siege_warfare"],
    era: "ancient",
  },
  guard: {
    requiredSkills: { melee: 15 },
    developedSkills: ["melee"],
    era: "ancient",
  },
  mercenary: {
    requiredSkills: { melee: 30, ranged: 20 },
    developedSkills: ["melee", "ranged", "tactics", "negotiation"],
    era: "ancient",
  },
  archer: {
    requiredSkills: { ranged: 30 },
    developedSkills: ["ranged", "archery"],
    era: "ancient",
  },
  cavalry_soldier: {
    requiredSkills: { melee: 30, animalcare: 30 },
    developedSkills: ["melee", "cavalry", "animalcare"],
    era: "ancient",
  },

  // Religious
  priest: {
    requiredSkills: { theology: 40, literacy: 30 },
    developedSkills: ["theology", "persuasion", "literacy"],
    era: "ancient",
  },
  monk: {
    requiredSkills: { theology: 30, literacy: 40 },
    developedSkills: ["theology", "literacy", "history", "medicine", "herbalism"],
    era: "ancient",
  },
  oracle: {
    requiredSkills: { theology: 60 },
    developedSkills: ["theology", "persuasion", "astronomy"],
    era: "ancient",
  },

  // Crafts
  blacksmith: {
    requiredSkills: { smithing: 30, smelting: 20 },
    developedSkills: ["smithing", "smelting", "toolmaking"],
    productionType: "military_equipment",
    productionAmount: 2,
    era: "ancient",
  },
  carpenter: {
    requiredSkills: { carpentry: 30, woodworking: 30 },
    developedSkills: ["carpentry", "construction"],
    productionType: "wood_goods",
    productionAmount: 3,
    era: "ancient",
  },
  mason: {
    requiredSkills: { masonry: 30, stoneworking: 30 },
    developedSkills: ["masonry", "construction", "fortification"],
    productionType: "construction",
    productionAmount: 2,
    era: "ancient",
  },
  weaver: {
    requiredSkills: { weaving: 30 },
    developedSkills: ["weaving", "tailoring"],
    productionType: "cloth",
    productionAmount: 4,
    era: "ancient",
  },
  potter: {
    requiredSkills: { pottery: 20 },
    developedSkills: ["pottery", "ceramics"],
    productionType: "pottery",
    productionAmount: 5,
    era: "ancient",
  },
  jeweler: {
    requiredSkills: { smithing: 40 },
    developedSkills: ["smithing", "ceramics"],
    productionType: "luxury_goods",
    productionAmount: 1,
    era: "ancient",
  },
  tanner: {
    requiredSkills: { leatherworking: 30 },
    developedSkills: ["leatherworking"],
    productionType: "leather",
    productionAmount: 3,
    era: "ancient",
  },
  toolmaker: {
    requiredSkills: { smithing: 40, toolmaking: 30 },
    developedSkills: ["toolmaking", "smithing"],
    productionType: "tools",
    productionAmount: 2,
    era: "ancient",
  },

  // Knowledge
  scholar: {
    requiredSkills: { literacy: 60, mathematics: 40 },
    developedSkills: ["literacy", "mathematics", "history", "philosophy"],
    era: "ancient",
  },
  teacher: {
    requiredSkills: { literacy: 50, persuasion: 30 },
    developedSkills: ["literacy", "persuasion", "history"],
    era: "ancient",
  },
  scribe: {
    requiredSkills: { literacy: 50 },
    developedSkills: ["literacy", "mathematics", "history"],
    era: "ancient",
  },
  physician: {
    requiredSkills: { medicine: 40, herbalism: 30, literacy: 30 },
    developedSkills: ["medicine", "herbalism", "surgery"],
    era: "ancient",
  },
  engineer: {
    requiredSkills: { engineering: 40, mathematics: 50 },
    developedSkills: ["engineering", "mathematics", "construction", "architecture"],
    era: "classical",
  },
  alchemist: {
    requiredSkills: { herbalism: 40, smelting: 30, literacy: 40 },
    developedSkills: ["alchemy", "herbalism", "medicine"],
    era: "classical",
  },
  astronomer: {
    requiredSkills: { mathematics: 50, literacy: 40 },
    developedSkills: ["astronomy", "mathematics", "navigation"],
    era: "ancient",
  },

  // Commerce
  merchant: {
    requiredSkills: { trading: 30, mathematics: 20 },
    developedSkills: ["trading", "negotiation", "mathematics"],
    era: "ancient",
  },
  trader: {
    requiredSkills: { trading: 20 },
    developedSkills: ["trading", "negotiation"],
    era: "ancient",
  },
  banker: {
    requiredSkills: { mathematics: 50, trading: 40, literacy: 40, banking: 30 },
    developedSkills: ["mathematics", "trading", "banking", "negotiation"],
    era: "medieval",
  },
  innkeeper: {
    requiredSkills: { trading: 20, persuasion: 20 },
    developedSkills: ["trading", "persuasion", "brewing"],
    era: "ancient",
  },

  // Agriculture
  farmer: {
    requiredSkills: { farming: 20, foraging: 20 },
    developedSkills: ["farming", "animalcare", "irrigation"],
    productionType: "food",
    productionAmount: 5,
    era: "ancient",
  },
  herder: {
    requiredSkills: { animalcare: 30 },
    developedSkills: ["animalcare", "veterinary"],
    productionType: "food",
    productionAmount: 3,
    era: "ancient",
  },
  fisherman: {
    requiredSkills: { fishing: 20 },
    developedSkills: ["fishing", "navigation"],
    productionType: "food",
    productionAmount: 4,
    era: "ancient",
  },
  irrigator: {
    requiredSkills: { farming: 40, construction: 30 },
    developedSkills: ["irrigation", "engineering"],
    productionType: "infrastructure",
    productionAmount: 1,
    era: "ancient",
  },
  brewer: {
    requiredSkills: { farming: 30, brewing: 20 },
    developedSkills: ["brewing", "farming"],
    productionType: "alcohol",
    productionAmount: 3,
    era: "ancient",
  },

  // Labor
  miner: {
    requiredSkills: { quarrying: 30, mining: 20 },
    developedSkills: ["mining", "quarrying"],
    productionType: "ore",
    productionAmount: 3,
    era: "ancient",
  },
  laborer: {
    requiredSkills: {},
    developedSkills: ["construction"],
    productionType: "labor",
    productionAmount: 2,
    era: "primitive",
  },
  servant: {
    requiredSkills: {},
    developedSkills: [],
    era: "ancient",
  },

  // Justice
  judge: {
    requiredSkills: { law: 60, literacy: 50, philosophy: 30 },
    developedSkills: ["law", "persuasion", "administration"],
    era: "ancient",
  },
  lawkeeper: {
    requiredSkills: { law: 30, melee: 20 },
    developedSkills: ["law", "melee"],
    era: "ancient",
  },

  // =============================================
  // MEDIEVAL ERA - Advanced Crafts
  // =============================================
  armorsmith: {
    requiredSkills: { blacksmithing: 50 },
    developedSkills: ["armorsmithing", "blacksmithing"],
    productionType: "armor",
    productionAmount: 1,
    era: "medieval",
  },
  weaponsmith: {
    requiredSkills: { blacksmithing: 50 },
    developedSkills: ["weaponsmithing", "blacksmithing"],
    productionType: "weapons",
    productionAmount: 1,
    era: "medieval",
  },
  glassmaker: {
    requiredSkills: { ceramics: 50, smelting: 40 },
    developedSkills: ["glassmaking", "ceramics"],
    productionType: "glass",
    productionAmount: 2,
    era: "medieval",
  },
  clockmaker: {
    requiredSkills: { smithing: 60, mathematics: 50 },
    developedSkills: ["clockmaking", "mathematics"],
    productionType: "clocks",
    productionAmount: 1,
    era: "medieval",
  },
  knight: {
    requiredSkills: { melee: 50, cavalry: 40, tactics: 30 },
    developedSkills: ["melee", "cavalry", "tactics", "siege_warfare"],
    era: "medieval",
  },
  siege_engineer: {
    requiredSkills: { engineering: 50, construction: 40, siege_engineering: 30 },
    developedSkills: ["siege_engineering", "siege_warfare", "fortification"],
    era: "medieval",
  },
  metallurgist: {
    requiredSkills: { alchemy: 50, smithing: 50 },
    developedSkills: ["metallurgy", "alchemy", "smelting"],
    era: "medieval",
  },
  cartographer: {
    requiredSkills: { navigation: 40, mathematics: 50 },
    developedSkills: ["cartography", "navigation", "mathematics"],
    era: "medieval",
  },
  navigator: {
    requiredSkills: { astronomy: 40, mathematics: 40, shipwright: 30 },
    developedSkills: ["navigation", "astronomy", "naval_combat"],
    era: "medieval",
  },

  // =============================================
  // RENAISSANCE ERA - Science & Firearms
  // =============================================
  gunsmith: {
    requiredSkills: { blacksmithing: 60, chemistry: 40 },
    developedSkills: ["gunsmithing", "explosives", "blacksmithing"],
    productionType: "firearms",
    productionAmount: 1,
    era: "renaissance",
  },
  printer: {
    requiredSkills: { literacy: 60, metallurgy: 40 },
    developedSkills: ["printing", "literacy"],
    productionType: "books",
    productionAmount: 5,
    era: "renaissance",
  },
  optician: {
    requiredSkills: { glassmaking: 50, physics: 40 },
    developedSkills: ["optics", "glassmaking", "physics"],
    productionType: "lenses",
    productionAmount: 2,
    era: "renaissance",
  },
  artillerist: {
    requiredSkills: { gunsmithing: 40, ballistics: 40, mathematics: 40 },
    developedSkills: ["ballistics", "explosives", "siege_warfare"],
    era: "renaissance",
  },
  naval_officer: {
    requiredSkills: { navigation: 50, naval_combat: 40, tactics: 40 },
    developedSkills: ["naval_combat", "navigation", "tactics"],
    era: "renaissance",
  },
  chemist: {
    requiredSkills: { alchemy: 70, mathematics: 50 },
    developedSkills: ["chemistry", "alchemy", "explosives"],
    era: "renaissance",
  },
  physicist: {
    requiredSkills: { mathematics: 60, philosophy: 40 },
    developedSkills: ["physics", "mathematics", "mechanics"],
    era: "renaissance",
  },
  biologist: {
    requiredSkills: { medicine: 50, herbalism: 50 },
    developedSkills: ["biology", "medicine", "anatomy"],
    era: "renaissance",
  },
  anatomist: {
    requiredSkills: { surgery: 50, biology: 40 },
    developedSkills: ["anatomy", "surgery", "medicine"],
    era: "renaissance",
  },

  // =============================================
  // INDUSTRIAL ERA - Machines & Mass Production
  // =============================================
  steam_engineer: {
    requiredSkills: { thermodynamics: 50, blacksmithing: 60 },
    developedSkills: ["steam_engineering", "thermodynamics", "mechanics"],
    productionType: "engines",
    productionAmount: 1,
    era: "industrial",
  },
  machinist: {
    requiredSkills: { toolmaking: 70, mechanics: 50 },
    developedSkills: ["machine_tools", "mechanics", "steel_production"],
    productionType: "machines",
    productionAmount: 1,
    era: "industrial",
  },
  factory_worker: {
    requiredSkills: { machine_tools: 30 },
    developedSkills: ["machine_tools", "assembly_line"],
    productionType: "goods",
    productionAmount: 5,
    era: "industrial",
  },
  railway_worker: {
    requiredSkills: { steam_engineering: 30, construction: 40 },
    developedSkills: ["railways", "steam_engineering"],
    productionType: "infrastructure",
    productionAmount: 2,
    era: "industrial",
  },
  telegraph_operator: {
    requiredSkills: { physics: 40, literacy: 50 },
    developedSkills: ["telegraphy", "literacy"],
    era: "industrial",
  },
  industrial_chemist: {
    requiredSkills: { chemistry: 70 },
    developedSkills: ["industrial_chemistry", "chemistry"],
    productionType: "chemicals",
    productionAmount: 3,
    era: "industrial",
  },
  mechanical_engineer: {
    requiredSkills: { physics: 60, engineering: 60 },
    developedSkills: ["mechanics", "thermodynamics", "engineering"],
    era: "industrial",
  },

  // =============================================
  // MODERN ERA - Electricity & Vehicles
  // =============================================
  electrician: {
    requiredSkills: { physics: 50, electrical_engineering: 40 },
    developedSkills: ["electrical_engineering", "electronics"],
    productionType: "electrical",
    productionAmount: 2,
    era: "modern",
  },
  automotive_worker: {
    requiredSkills: { internal_combustion: 40, machine_tools: 50 },
    developedSkills: ["automotive", "internal_combustion", "assembly_line"],
    productionType: "vehicles",
    productionAmount: 1,
    era: "modern",
  },
  aircraft_mechanic: {
    requiredSkills: { internal_combustion: 50, aviation: 40 },
    developedSkills: ["aviation", "internal_combustion", "mechanics"],
    productionType: "aircraft",
    productionAmount: 1,
    era: "modern",
  },
  radio_operator: {
    requiredSkills: { electrical_engineering: 40 },
    developedSkills: ["radio", "electronics"],
    era: "modern",
  },
  tank_crew: {
    requiredSkills: { automotive: 40, tactics: 40 },
    developedSkills: ["tank_warfare", "tactics", "automotive"],
    era: "modern",
  },
  pilot: {
    requiredSkills: { aviation: 50, tactics: 30 },
    developedSkills: ["aviation", "air_combat", "navigation"],
    era: "modern",
  },
  submarine_crew: {
    requiredSkills: { naval_combat: 40, electronics: 30 },
    developedSkills: ["submarine_warfare", "naval_combat", "electronics"],
    era: "modern",
  },
  electrical_engineer: {
    requiredSkills: { physics: 70, mechanics: 60 },
    developedSkills: ["electrical_engineering", "electronics", "radio"],
    era: "modern",
  },
  electronics_technician: {
    requiredSkills: { electrical_engineering: 60 },
    developedSkills: ["electronics", "radar", "radio"],
    era: "modern",
  },

  // =============================================
  // ATOMIC ERA - Nuclear & Space
  // =============================================
  nuclear_engineer: {
    requiredSkills: { nuclear_physics: 60, electrical_engineering: 70 },
    developedSkills: ["nuclear_engineering", "nuclear_physics"],
    productionType: "nuclear_power",
    productionAmount: 10,
    era: "atomic",
  },
  rocket_scientist: {
    requiredSkills: { aviation: 70, ballistics: 70 },
    developedSkills: ["rocketry", "jet_propulsion", "ballistics"],
    productionType: "rockets",
    productionAmount: 1,
    era: "atomic",
  },
  computer_scientist: {
    requiredSkills: { electronics: 70, mathematics: 80 },
    developedSkills: ["computing", "electronics", "mathematics"],
    era: "atomic",
  },
  missile_technician: {
    requiredSkills: { rocketry: 60, electronics: 60 },
    developedSkills: ["missile_systems", "rocketry", "electronics"],
    productionType: "missiles",
    productionAmount: 1,
    era: "atomic",
  },

  // =============================================
  // OTHER - All Eras
  // =============================================
  artisan: {
    requiredSkills: {},
    developedSkills: ["pottery", "weaving", "woodworking"],
    productionType: "goods",
    productionAmount: 2,
    era: "primitive",
  },
  entertainer: {
    requiredSkills: { persuasion: 30 },
    developedSkills: ["persuasion"],
    era: "ancient",
  },
  slave: {
    requiredSkills: {},
    developedSkills: [],
    productionType: "labor",
    productionAmount: 3,
    era: "ancient",
  },
  unemployed: {
    requiredSkills: {},
    developedSkills: [],
    era: "primitive",
  },
};

// Default skills for new characters
// All primitive-era skills start with some base level
// More advanced skills start at 0 and must be developed
export const DEFAULT_SKILLS: Record<string, number> = {
  // PRIMITIVE ERA - Gathering & Survival (everyone knows basics)
  foraging: 20,
  hunting: 15,
  fishing: 10,
  woodcutting: 15,
  quarrying: 5,

  // PRIMITIVE ERA - Basic Crafts
  stoneworking: 10,
  woodworking: 15,
  pottery: 10,
  weaving: 10,
  leatherworking: 5,

  // PRIMITIVE ERA - Combat
  melee: 15,
  ranged: 10,

  // PRIMITIVE ERA - Social
  persuasion: 20,

  // ANCIENT ERA - These start at 0 or low levels
  // Agriculture (basic farming from foraging knowledge)
  farming: 15,
  animalcare: 10,
  herbalism: 5,
  brewing: 0,
  irrigation: 0,
  veterinary: 0,

  // Ancient Crafts
  carpentry: 5,
  masonry: 0,
  smelting: 0,
  smithing: 0,
  tailoring: 5,
  ceramics: 0,
  toolmaking: 0,

  // Construction
  construction: 0,
  fortification: 0,
  architecture: 0,
  shipwright: 0,
  siege_engineering: 0,

  // Combat - Advanced
  tactics: 0,
  cavalry: 0,
  archery: 0,
  naval_combat: 0,
  siege_warfare: 0,

  // Knowledge
  literacy: 0,
  mathematics: 0,
  astronomy: 0,
  medicine: 0,
  surgery: 0,
  engineering: 0,
  alchemy: 0,
  philosophy: 0,
  history: 0,
  law: 0,
  theology: 5,
  navigation: 0,
  cartography: 0,

  // Social - Advanced
  negotiation: 10,
  diplomacy: 0,
  trading: 10,
  banking: 0,
  administration: 0,
  espionage: 0,
  propaganda: 0,

  // Medieval specializations
  blacksmithing: 0,
  armorsmithing: 0,
  weaponsmithing: 0,
  glassmaking: 0,
  clockmaking: 0,
  mining: 0,
  metallurgy: 0,
  castle_building: 0,

  // Renaissance
  chemistry: 0,
  physics: 0,
  biology: 0,
  anatomy: 0,
  optics: 0,
  printing: 0,
  gunsmithing: 0,
  explosives: 0,
  ballistics: 0,
  fortification_modern: 0,
  naval_architecture: 0,

  // Industrial
  mechanics: 0,
  thermodynamics: 0,
  steam_engineering: 0,
  machine_tools: 0,
  industrial_chemistry: 0,
  steel_production: 0,
  railways: 0,
  telegraphy: 0,
  photography: 0,

  // Modern
  electrical_engineering: 0,
  internal_combustion: 0,
  automotive: 0,
  aviation: 0,
  radio: 0,
  electronics: 0,
  radar: 0,
  assembly_line: 0,
  tank_warfare: 0,
  air_combat: 0,
  submarine_warfare: 0,

  // Atomic
  nuclear_physics: 0,
  nuclear_engineering: 0,
  nuclear_weapons: 0,
  rocketry: 0,
  computing: 0,
  missile_systems: 0,
  jet_propulsion: 0,
  nuclear_delivery: 0,
};

/**
 * Initialize skills for a new character based on their social class
 */
export function initializeSkills(
  socialClass: string,
  age: number
): Record<string, number> {
  const skills = { ...DEFAULT_SKILLS };

  // Modify based on social class
  switch (socialClass) {
    case "noble":
      // Nobles receive education and martial training
      skills.literacy = 40;
      skills.mathematics = 30;
      skills.history = 30;
      skills.persuasion = 50;
      skills.negotiation = 40;
      skills.diplomacy = 20;
      skills.melee = 35; // Noble martial training
      skills.cavalry = 25;
      skills.law = 20;
      skills.administration = 15;
      break;

    case "warrior":
      // Warriors focus on combat skills
      skills.melee = 45;
      skills.ranged = 35;
      skills.tactics = 25;
      skills.hunting = 30;
      skills.archery = 20;
      break;

    case "merchant":
      // Merchants know trade and numbers
      skills.trading = 55;
      skills.mathematics = 45;
      skills.negotiation = 50;
      skills.literacy = 35;
      skills.persuasion = 40;
      skills.banking = 10;
      break;

    case "craftsman":
      // Craftsmen have basic production skills
      skills.woodworking = 40;
      skills.carpentry = 35;
      skills.smithing = 25;
      skills.masonry = 20;
      skills.pottery = 30;
      skills.weaving = 30;
      skills.toolmaking = 15;
      break;

    case "farmer":
      // Farmers know agriculture and animal care
      skills.farming = 55;
      skills.foraging = 40;
      skills.animalcare = 40;
      skills.herbalism = 25;
      skills.irrigation = 15;
      skills.woodcutting = 30;
      skills.carpentry = 15;
      break;

    case "laborer":
      // Laborers have basic physical skills
      skills.woodcutting = 35;
      skills.quarrying = 25;
      skills.construction = 15;
      skills.mining = 10;
      break;

    case "priest":
      // Priests focus on religious and scholarly pursuits
      skills.theology = 50;
      skills.literacy = 45;
      skills.persuasion = 40;
      skills.history = 30;
      skills.herbalism = 25;
      skills.medicine = 15;
      break;

    case "scholar":
      // Scholars have advanced knowledge skills
      skills.literacy = 60;
      skills.mathematics = 50;
      skills.history = 40;
      skills.philosophy = 30;
      skills.astronomy = 20;
      skills.law = 20;
      break;

    case "slave":
      // Slaves start with lower skills due to lack of education
      // Only reduce non-primitive skills
      const primitiveSkills = ["foraging", "hunting", "fishing", "woodcutting", "melee", "ranged", "persuasion"];
      Object.keys(skills).forEach((key) => {
        if (!primitiveSkills.includes(key)) {
          skills[key] = Math.max(0, (skills[key] || 0) - 10);
        }
      });
      break;
  }

  // Age affects skill levels (experience over time)
  // Only apply bonus to skills that are > 0 (already being developed)
  const ageBonus = Math.min(15, Math.floor((age - 16) / 5) * 2);
  Object.keys(skills).forEach((key) => {
    if (skills[key] > 0) {
      skills[key] = Math.min(100, skills[key] + ageBonus);
    }
  });

  return skills;
}

/**
 * Assign a profession to a character
 */
export async function assignProfession(
  ctx: MutationCtx,
  characterId: Id<"characters">,
  profession: string,
  tick: number,
  researchedTechs: string[] = []
): Promise<{ success: boolean; message: string }> {
  const character = await ctx.db.get(characterId);
  if (!character || !character.isAlive) {
    return { success: false, message: "Character not found or deceased" };
  }

  const professionConfig = PROFESSION_SKILLS[profession];
  if (!professionConfig) {
    return { success: false, message: "Unknown profession" };
  }

  // Check if the profession's era is available
  const professionEra = professionConfig.era || "primitive";
  const availableEras = getAvailableEras(researchedTechs);
  if (!availableEras.includes(professionEra)) {
    return {
      success: false,
      message: `The ${profession} profession requires more advanced technology (${professionEra} era)`,
    };
  }

  // Check skill requirements
  const skills = (character.skills as Record<string, number>) || DEFAULT_SKILLS;
  for (const [skill, required] of Object.entries(professionConfig.requiredSkills)) {
    const currentSkill = skills[skill] || 0;
    if (currentSkill < required) {
      return {
        success: false,
        message: `Insufficient ${skill} skill (${currentSkill}/${required})`,
      };
    }
  }

  await ctx.db.patch(characterId, {
    profession: profession as any,
    professionStartTick: tick,
    professionYearsExperience: 0,
  });

  return {
    success: true,
    message: `${character.name} is now a ${profession}`,
  };
}

/**
 * Grow skills based on profession practice
 * Also feeds collective knowledge system for organic technology emergence
 */
export async function developSkills(
  ctx: MutationCtx,
  characterId: Id<"characters">,
  tick: number
): Promise<{ skillImprovements: Array<{ skill: string; improvement: number }> }> {
  const character = await ctx.db.get(characterId);
  if (!character || !character.isAlive || !character.profession) {
    return { skillImprovements: [] };
  }

  const professionConfig = PROFESSION_SKILLS[character.profession];
  if (!professionConfig) return { skillImprovements: [] };

  const skills = (character.skills as Record<string, number>) || { ...DEFAULT_SKILLS };
  let skillsChanged = false;
  const skillImprovements: Array<{ skill: string; improvement: number }> = [];

  // Each tick, small chance to improve developed skills
  for (const skillName of professionConfig.developedSkills) {
    const currentSkill = skills[skillName] || 0;
    if (currentSkill >= 100) continue;

    // Higher skills are harder to improve
    // Base chance is higher for primitive/basic skills
    const baseDifficulty = getSkillDifficulty(skillName);
    const improvementChance = (0.15 / baseDifficulty) * (1 - currentSkill / 100);

    if (Math.random() < improvementChance) {
      const improvement = 1;
      skills[skillName] = Math.min(100, currentSkill + improvement);
      skillsChanged = true;

      // Track the improvement for collective knowledge
      skillImprovements.push({ skill: skillName, improvement });

      // Feed skill practice into collective knowledge system
      // This is what makes technologies emerge organically!
      await recordSkillPractice(
        ctx,
        character.territoryId,
        skillName,
        improvement
      );
    }
  }

  // Update experience
  const yearsExperience = (character.professionYearsExperience || 0) + (1 / 12); // Monthly ticks

  if (skillsChanged || tick % 12 === 0) {
    await ctx.db.patch(characterId, {
      skills,
      professionYearsExperience: yearsExperience,
    });
  }

  return { skillImprovements };
}

/**
 * Get the difficulty multiplier for a skill based on its era
 * Earlier skills are easier to improve
 */
function getSkillDifficulty(skillName: string): number {
  // Import SKILL_MAP from collectiveKnowledge would create circular dep
  // Use simple lookup instead
  const skillEras: Record<string, number> = {
    // Primitive - easy
    foraging: 1, hunting: 1, fishing: 1, woodcutting: 1, quarrying: 1,
    stoneworking: 1, woodworking: 1, pottery: 1, weaving: 1, leatherworking: 1,
    melee: 1, ranged: 1, persuasion: 1, herbalism: 1.2,

    // Ancient - moderate
    carpentry: 1.2, masonry: 1.3, smelting: 1.4, smithing: 1.5, tailoring: 1.2,
    ceramics: 1.3, toolmaking: 1.4, construction: 1.3, fortification: 1.4,
    farming: 1.2, animalcare: 1.2, irrigation: 1.4, brewing: 1.3,
    tactics: 1.5, cavalry: 1.5, archery: 1.4,
    literacy: 1.5, mathematics: 1.5, astronomy: 1.6, medicine: 1.5,
    history: 1.3, law: 1.4, theology: 1.3, trading: 1.2, negotiation: 1.3,

    // Classical - harder
    architecture: 1.6, shipwright: 1.5, siege_engineering: 1.7,
    engineering: 1.7, alchemy: 1.7, philosophy: 1.6, navigation: 1.5,
    cartography: 1.6, surgery: 1.8, veterinary: 1.5, naval_combat: 1.6,
    siege_warfare: 1.7, diplomacy: 1.5, administration: 1.5, espionage: 1.6,

    // Medieval - challenging
    blacksmithing: 1.8, armorsmithing: 1.9, weaponsmithing: 1.9,
    glassmaking: 1.8, clockmaking: 2.0, mining: 1.7, metallurgy: 2.0,
    castle_building: 2.0, banking: 1.7, propaganda: 1.7,

    // Renaissance - difficult
    chemistry: 2.2, physics: 2.3, biology: 2.1, anatomy: 2.2, optics: 2.2,
    printing: 2.0, gunsmithing: 2.2, explosives: 2.3, ballistics: 2.3,
    fortification_modern: 2.2, naval_architecture: 2.2,

    // Industrial - very difficult
    mechanics: 2.5, thermodynamics: 2.6, steam_engineering: 2.5,
    machine_tools: 2.5, industrial_chemistry: 2.6, steel_production: 2.5,
    railways: 2.4, telegraphy: 2.4, photography: 2.3,

    // Modern - expert level
    electrical_engineering: 2.8, internal_combustion: 2.7, automotive: 2.6,
    aviation: 2.8, radio: 2.6, electronics: 2.8, radar: 2.9, assembly_line: 2.4,
    tank_warfare: 2.5, air_combat: 2.8, submarine_warfare: 2.8,

    // Atomic - master level
    nuclear_physics: 3.0, nuclear_engineering: 3.2, nuclear_weapons: 3.5,
    rocketry: 3.0, computing: 3.0, missile_systems: 3.2, jet_propulsion: 3.0,
    nuclear_delivery: 3.5,
  };

  return skillEras[skillName] || 1.5;
}

/**
 * Get production output from a character based on their profession
 */
export function getProductionOutput(character: Doc<"characters">): {
  type: string | null;
  amount: number;
  quality: number;
} {
  if (!character.profession || !character.isAlive) {
    return { type: null, amount: 0, quality: 0 };
  }

  const config = PROFESSION_SKILLS[character.profession];
  if (!config?.productionType) {
    return { type: null, amount: 0, quality: 0 };
  }

  // Base production modified by skill level
  const skills = (character.skills as Record<string, number>) || DEFAULT_SKILLS;
  const relevantSkill = config.developedSkills[0];
  const skillLevel = relevantSkill ? (skills[relevantSkill] || 0) : 50;

  // Quality based on skill (0-100)
  const quality = skillLevel;

  // Amount modified by experience
  const experience = character.professionYearsExperience || 0;
  const experienceBonus = Math.min(50, experience * 2); // Up to 50% bonus
  const amount = Math.round(
    (config.productionAmount || 1) * (1 + experienceBonus / 100) * (1 + skillLevel / 200)
  );

  return {
    type: config.productionType,
    amount,
    quality,
  };
}

/**
 * Process all professions in a territory (called per tick)
 */
export async function processProfessions(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  tick: number
): Promise<{ foodProduced: number; goodsProduced: number }> {
  const characters = await ctx.db
    .query("characters")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .filter((q) => q.eq(q.field("isAlive"), true))
    .collect();

  let foodProduced = 0;
  let goodsProduced = 0;

  for (const character of characters) {
    // Develop skills
    await developSkills(ctx, character._id, tick);

    // Get production
    const output = getProductionOutput(character);
    if (output.type === "food") {
      foodProduced += output.amount;
    } else if (output.type) {
      goodsProduced += output.amount;
    }
  }

  return { foodProduced, goodsProduced };
}

/**
 * Get best profession for a character based on their skills
 * Optionally filter by available era (based on technology)
 */
export function suggestProfession(
  skills: Record<string, number>,
  availableEras: string[] = ["primitive", "ancient"]
): { profession: string; score: number; era: string }[] {
  const suggestions: { profession: string; score: number; era: string }[] = [];

  for (const [profession, config] of Object.entries(PROFESSION_SKILLS)) {
    // Skip professions from eras that aren't available yet
    const professionEra = config.era || "primitive";
    if (!availableEras.includes(professionEra)) continue;

    let score = 0;
    let meetsRequirements = true;

    // Check requirements
    for (const [skill, required] of Object.entries(config.requiredSkills)) {
      const current = skills[skill] || 0;
      if (current < required) {
        meetsRequirements = false;
        break;
      }
      score += current - required; // Bonus for exceeding requirements
    }

    if (!meetsRequirements) continue;

    // Bonus for having high levels in developed skills
    for (const skillName of config.developedSkills) {
      score += (skills[skillName] || 0) / 2;
    }

    suggestions.push({ profession, score, era: professionEra });
  }

  return suggestions.sort((a, b) => b.score - a.score).slice(0, 5);
}

/**
 * Get the available eras based on researched technologies
 */
export function getAvailableEras(researchedTechs: string[]): string[] {
  const eras = ["primitive"]; // Always available

  // Check for technologies that unlock new eras
  if (researchedTechs.some(t => ["agriculture", "bronze_working", "writing"].includes(t))) {
    eras.push("ancient");
  }
  if (researchedTechs.some(t => ["iron_working", "philosophy", "engineering"].includes(t))) {
    eras.push("classical");
  }
  if (researchedTechs.some(t => ["feudalism", "castle_building", "steel"].includes(t))) {
    eras.push("medieval");
  }
  if (researchedTechs.some(t => ["printing_press", "gunpowder", "scientific_method"].includes(t))) {
    eras.push("renaissance");
  }
  if (researchedTechs.some(t => ["steam_power", "industrialization", "electricity"].includes(t))) {
    eras.push("industrial");
  }
  if (researchedTechs.some(t => ["radio", "flight", "mass_production"].includes(t))) {
    eras.push("modern");
  }
  if (researchedTechs.some(t => ["nuclear_fission", "rocketry", "computers"].includes(t))) {
    eras.push("atomic");
  }

  return eras;
}

/**
 * Auto-assign professions to characters without one
 */
export async function autoAssignProfessions(
  ctx: MutationCtx,
  territoryId: Id<"territories">,
  tick: number,
  researchedTechs: string[] = []
): Promise<number> {
  const characters = await ctx.db
    .query("characters")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .filter((q) =>
      q.and(
        q.eq(q.field("isAlive"), true),
        q.eq(q.field("profession"), undefined)
      )
    )
    .collect();

  let assigned = 0;
  const availableEras = getAvailableEras(researchedTechs);

  for (const character of characters) {
    // Skip rulers and special roles
    if (character.role === "ruler" || character.role === "heir") {
      await ctx.db.patch(character._id, {
        profession: character.role === "ruler" ? "ruler" : "noble",
        professionStartTick: tick,
        professionYearsExperience: 0,
        skills: character.skills || initializeSkills("noble", character.age),
      });
      assigned++;
      continue;
    }

    // Initialize skills if not present
    const skills = (character.skills as Record<string, number>) || initializeSkills("farmer", character.age);

    // Find best profession based on skills and available eras
    const suggestions = suggestProfession(skills, availableEras);
    if (suggestions.length > 0) {
      await ctx.db.patch(character._id, {
        profession: suggestions[0].profession as any,
        professionStartTick: tick,
        professionYearsExperience: 0,
        skills,
      });
      assigned++;
    } else {
      // Default to gatherer (primitive) or farmer (ancient)
      const defaultProfession = availableEras.includes("ancient") ? "farmer" : "gatherer";
      await ctx.db.patch(character._id, {
        profession: defaultProfession as any,
        professionStartTick: tick,
        professionYearsExperience: 0,
        skills,
      });
      assigned++;
    }
  }

  return assigned;
}

/**
 * Get profession distribution in a territory
 */
export async function getProfessionDistribution(
  ctx: QueryCtx,
  territoryId: Id<"territories">
): Promise<Record<string, number>> {
  const characters = await ctx.db
    .query("characters")
    .withIndex("by_territory", (q) => q.eq("territoryId", territoryId))
    .filter((q) => q.eq(q.field("isAlive"), true))
    .collect();

  const distribution: Record<string, number> = {};

  for (const character of characters) {
    const profession = character.profession || "unemployed";
    distribution[profession] = (distribution[profession] || 0) + 1;
  }

  return distribution;
}
