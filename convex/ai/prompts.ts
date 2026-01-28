import { Doc, Id } from "../_generated/dataModel";
import { getSurvivalStatus, calculateWinterFuelRequirement, calculateShelterDeficit, Season, SEASONAL_EFFECTS } from "../simulation/survival";
import { getRulerStatusSummary } from "../simulation/rulerLegitimacy";
import { CHARACTER_PRIORITIES, describePriorities } from "../simulation/characters";

// =============================================
// ENGAGEMENT SYSTEM - CHARACTER & INTRIGUE CONTEXT
// =============================================

export interface CharacterContext {
  id: Id<"characters">;
  name: string;
  title: string;
  role: string;
  age: number;
  traits: {
    ambition: number;
    greed: number;
    loyalty: number;
    honor: number;
    cruelty: number;
    compassion: number;
    cunning: number;
    wisdom: number;
    paranoia: number;
    courage: number;
    pride: number;
    wrath: number;
    charisma: number;
    diplomacy: number;
    // New ruler traits
    justice?: number;
    generosity?: number;
    vigilance?: number;
    strength?: number;
  };
  emotionalState: {
    hope: number;
    fear: number;
    shame: number;
    despair: number;
    contentment: number;
    rage: number;
  };
  secretGoal?: string;
  isPlotting: boolean;
  plotType?: string;
  // Ruler legitimacy & trust
  legitimacySource?: string;
  legitimacy?: number;
  popularTrust?: number;
  trustRecord?: {
    promisesKept: number;
    promisesBroken: number;
    warsWon: number;
    warsLost: number;
    crisesSurvived: number;
    crisesFailed: number;
    corruptionScandals: number;
    popularDecisions: number;
    unpopularDecisions: number;
  };
  // Combat experience
  killCount?: number;
  battlesParticipated?: number;
  duelsWon?: number;
}

export interface TensionContext {
  warLikelihood: number;
  coupLikelihood: number;
  famineLikelihood: number;
  successionCrisisLikelihood: number;
  rebellionLikelihood: number;
  brewingConflicts: Array<{
    targetName: string;
    likelihood: number;
    reason: string;
  }>;
}

export interface RivalryContext {
  opponentName: string;
  opponentTerritory: string;
  intensity: number;
  rivalryType: string;
  reasons: string[];
  isHereditary: boolean;
}

export interface ProsperityContext {
  currentTier: number;
  tierName: string;
  progressToNextTier: number;
  ticksAtCurrentTier: number;
  complacencyLevel: number;
  decadenceLevel: number;
  stabilityFactors: {
    economicStability: number;
    socialHarmony: number;
    militaryReadiness: number;
    politicalUnity: number;
  };
}

// =============================================
// ORGANIC AI GROWTH - MEMORY, BONDS, GOALS
// =============================================

export interface MemoryContext {
  memories: Array<{
    type: string;
    description: string;
    emotionalWeight: number;
    salience: number;
    ticksAgo: number;
    targetTerritoryName?: string;
  }>;
  formattedMemories: string;
}

export interface BondsContext {
  grudges: string;
  gratitude: string;
}

export interface EmergentGoalContext {
  goalType: string;
  targetDescription?: string;
  originReason: string;
  progress: number;
  priority: number;
}

export interface OrganicGrowthContext {
  memories?: MemoryContext;
  bonds?: BondsContext;
  goals?: EmergentGoalContext[];
}

// =============================================
// ORGANIC KNOWLEDGE PROGRESSION CONTEXT
// =============================================
// Technologies emerge organically when your population develops practical skills.

export interface PopulationSkillContext {
  skillType: string;
  skilledCount: number;
  expertCount: number;
  averageLevel: number;
  expertPercent: number;
  skilledPercent: number;
}

export interface TechProgressContext {
  techId: string;
  techName: string;
  progress: number;
  requirementsMet: boolean;
  missingRequirements: string[];
}

export interface KnowledgeContext {
  strongAreas: PopulationSkillContext[];  // Skills with good expertise
  weakAreas: PopulationSkillContext[];    // Skills needing development
  approachingTechs: TechProgressContext[]; // Techs close to discovery
  recentBreakthroughs: string[];           // Recently discovered techs
}

// AI Personality parameters for competitive differentiation
export interface PersonalityParams {
  // Core Strategic
  aggression: number;      // 0-100: War tendency
  riskTolerance: number;   // 0-100: Gambles vs safe plays
  cooperation: number;     // 0-100: Trade/alliance friendly
  militarism: number;      // 0-100: Military vs economic focus
  expansionism: number;    // 0-100: Territory growth priority
  innovation: number;      // 0-100: Tech research priority
  // Governance & Power
  centralization: number;  // 0-100: Local autonomy vs absolute central control
  authoritarianism: number; // 0-100: Democratic/council vs autocratic rule
  // Economic Philosophy
  taxation: number;        // 0-100: Light taxes vs heavy extraction
  frugality: number;       // 0-100: Extravagant spending vs austere savings
  mercantilism: number;    // 0-100: Free trade vs protectionist hoarding
  // Social & Cultural
  religiosity: number;     // 0-100: Secular governance vs theocratic rule
  traditionalism: number;  // 0-100: Progressive reform vs ancestral ways
  xenophobia: number;      // 0-100: Cosmopolitan inclusive vs isolationist hostile
  // Leadership Psychology
  paranoia: number;        // 0-100: Trusting vs constant purges/spies
  ruthlessness: number;    // 0-100: Merciful forgiving vs cruel examples
  patience: number;        // 0-100: Short-term gains vs generational planning
  pragmatism: number;      // 0-100: Idealistic principles vs "ends justify means"
  // Strategic Mindset
  opportunism: number;     // 0-100: Principled/predictable vs seizes any advantage
  defensiveness: number;   // 0-100: Offensive preemptive vs fortress reactive
}

export interface EngagementContext {
  ruler?: CharacterContext;
  heir?: CharacterContext;
  courtMembers: CharacterContext[];
  tensions?: TensionContext;
  rivalries: RivalryContext[];
  prosperity?: ProsperityContext;
  suspectedPlots: number;
  recentSuccession?: {
    type: string;
    narrative: string;
  };
}

export const AVAILABLE_ACTIONS = [
  // === BASIC SURVIVAL ACTIONS ===
  {
    id: "gather_food",
    name: "Gather Food",
    description: "Send your people to hunt, fish, or forage for food. Output varies by season!",
    effects: "+8 Food, +1 Knowledge (learning about the land)",
  },
  {
    id: "gather_wood",
    name: "Gather Wood",
    description: "Send your people to collect firewood from the forests. ESSENTIAL for building shelters and surviving winter!",
    effects: "+10 Wood, -1 Happiness (hard labor), +0.5 Knowledge",
  },
  {
    id: "build_houses",
    name: "Build Houses",
    description: "Construct shelters to protect your people from the elements. CRITICAL before winter!",
    effects: "+20 Shelter Capacity, -15 Wood. People without shelter die from exposure in winter!",
  },
  {
    id: "preserve_food",
    name: "Preserve Food",
    description: "Smoke, dry, or salt food to preserve it for winter when foraging is difficult",
    effects: "-15 Fresh Food, +15 Preserved Food (doesn't decay), -5 Wood (for smoking)",
  },
  {
    id: "stockpile_fuel",
    name: "Stockpile Fuel",
    description: "Prioritize gathering and storing wood specifically for winter heating",
    effects: "+1 Happiness (feeling prepared), +0.5 Knowledge (survival skills)",
  },
  {
    id: "build_shelter",
    name: "Build Shelter",
    description: "Construct shelters and improve living conditions",
    effects: "+5 Happiness, +2 Wealth (assets)",
  },
  {
    id: "explore_land",
    name: "Explore the Land",
    description: "Send scouts to explore and map your territory",
    effects: "+4 Knowledge, +2 Influence (claiming territory)",
  },
  {
    id: "develop_tools",
    name: "Develop Tools",
    description: "Craft better tools and discover new techniques",
    effects: "+5 Technology, +2 Knowledge",
  },
  {
    id: "grow_community",
    name: "Grow the Community",
    description: "Focus on families, children, and expanding your tribe",
    effects: "+3 Population (over time), +2 Happiness",
  },
  {
    id: "train_warriors",
    name: "Train Warriors",
    description: "Prepare some members for defense and protection",
    effects: "+4 Military, -1 Food (feeding warriors)",
  },
  {
    id: "rest",
    name: "Rest and Recover",
    description: "Let your people rest, heal, and bond",
    effects: "+3 Happiness, +1 Food (conservation)",
  },

  // === CULTURE & IDENTITY ACTIONS ===
  {
    id: "create_culture",
    name: "Create Culture",
    description: "Develop language, stories, traditions, art, or design symbols/flags. FORMAT your reasoning to include: NEW WORDS like \"Kairu\" means \"hello\", TRADITIONS like \"The Harvest Dance: we celebrate with...\", FLAGS like \"Our flag shows...\", BELIEFS like \"We believe in...\"",
    effects: "+6 Influence, +3 Happiness, +2 Knowledge",
  },
  {
    id: "name_tribe",
    name: "Name Your People",
    description: "Give your tribe an official name and identity. Include the tribe name AND an origin story: \"We call ourselves the X. Our people came from...\"",
    effects: "+4 Influence, +3 Happiness. Provide the name clearly in your reasoning!",
  },

  // === GOVERNANCE ACTIONS ===
  {
    id: "establish_council",
    name: "Establish Elder Council",
    description: "Form a council of elders who make decisions together through discussion",
    effects: "Creates council governance. +3 Knowledge, +2 Happiness. Balanced but slow decisions.",
  },
  {
    id: "establish_chief",
    name: "Appoint a Chief",
    description: "Choose one person to lead the tribe. Name them in your reasoning!",
    effects: "Creates chiefdom. +3 Military, +2 Influence. Fast decisions, depends on leader quality.",
  },
  {
    id: "establish_democracy",
    name: "Establish Democracy",
    description: "All adults vote on major decisions. Create rules for how voting works.",
    effects: "Creates democracy. +5 Happiness, +3 Knowledge. Slow but people feel heard.",
  },
  {
    id: "establish_dictatorship",
    name: "Seize Power",
    description: "One person takes absolute control by force or manipulation. Name them!",
    effects: "Creates dictatorship. +5 Military, -5 Happiness. Very fast decisions, risk of rebellion.",
  },
  {
    id: "establish_theocracy",
    name: "Rule by Spiritual Leader",
    description: "A spiritual leader or shaman guides all decisions through faith/visions.",
    effects: "Creates theocracy. +4 Influence, +3 Happiness. Decisions guided by beliefs.",
  },
  {
    id: "change_government",
    name: "Reform Government",
    description: "Change your system of governance to something new. Describe the change!",
    effects: "Transition period: -2 Happiness temporarily. New system takes effect.",
  },

  // === DIPLOMACY ACTIONS ===
  {
    id: "send_scouts",
    name: "Send Scouts to Others",
    description: "Send people to observe or make contact with another tribe",
    effects: "Discover information, may improve or worsen relations",
    requiresTarget: true,
  },
  {
    id: "share_knowledge",
    name: "Share Knowledge",
    description: "Offer to teach another tribe something you've learned",
    effects: "+15 Trust with target, both gain +2 Knowledge",
    requiresTarget: true,
  },
  {
    id: "trade_goods",
    name: "Trade Goods",
    description: "Exchange resources with another tribe",
    effects: "Creates trade relationship, mutual benefits",
    requiresTarget: true,
  },
  {
    id: "show_strength",
    name: "Show Strength",
    description: "Display your warriors to intimidate or warn others",
    effects: "-10 Trust with target, may prevent conflict",
    requiresTarget: true,
  },
  {
    id: "raid",
    name: "Raid",
    description: "Attack another tribe to take their resources (risky!)",
    effects: "Potential gains but creates enemies, costs lives",
    requiresTarget: true,
  },

  // === WAR RESOLUTION ACTIONS ===
  {
    id: "propose_peace",
    name: "Propose Peace",
    description: "Offer to end hostilities with another tribe. May require concessions.",
    effects: "If accepted: War ends, relations improve. Describe what peace terms you offer.",
    requiresTarget: true,
  },
  {
    id: "accept_peace",
    name: "Accept Peace",
    description: "Accept a peace offer from another tribe that has proposed it.",
    effects: "War ends, relations become neutral. Both tribes can rebuild.",
    requiresTarget: true,
  },
  {
    id: "surrender",
    name: "Surrender",
    description: "Admit defeat and submit to another tribe. Humiliating but ends the conflict.",
    effects: "War ends. Lose wealth/influence, but save your people from more death.",
    requiresTarget: true,
  },
  {
    id: "demand_surrender",
    name: "Demand Surrender",
    description: "Demand that a weaker enemy surrenders to you.",
    effects: "If they're weak enough, they may surrender. May backfire if they're proud.",
    requiresTarget: true,
  },
  {
    id: "form_alliance",
    name: "Form Alliance",
    description: "Propose a formal alliance with a friendly tribe for mutual defense.",
    effects: "Creates alliance: +10 Military bonus, automatic trade, mutual protection.",
    requiresTarget: true,
  },

  // =============================================
  // DEEP SIMULATION - ECONOMY ACTIONS
  // =============================================
  {
    id: "build_farm",
    name: "Build Farm",
    description: "Construct agricultural infrastructure to produce food sustainably",
    effects: "Creates farm building. Produces food each tick based on workers assigned.",
  },
  {
    id: "build_mine",
    name: "Build Mine",
    description: "Construct a mine to extract valuable resources from the earth",
    effects: "Creates mine building. Requires mining technology. Extracts resources.",
  },
  {
    id: "build_workshop",
    name: "Build Workshop",
    description: "Construct a workshop to process raw materials into goods",
    effects: "Creates workshop. Converts raw resources into valuable tools/goods.",
  },
  {
    id: "build_market",
    name: "Build Market",
    description: "Construct a marketplace to facilitate trade and commerce",
    effects: "Creates market. Boosts trade income and wealth generation.",
  },
  {
    id: "set_tax_rate",
    name: "Adjust Taxation",
    description: "Modify the tax rate on your population and trade",
    effects: "Higher taxes = more wealth but less happiness. Lower taxes = happier people.",
  },
  {
    id: "prospect_resources",
    name: "Prospect for Resources",
    description: "Send scouts to discover new resource deposits in your territory",
    effects: "May discover new resource deposits (iron, gold, etc.). Based on knowledge.",
  },

  // =============================================
  // DEEP SIMULATION - TRADE ACTIONS
  // =============================================
  {
    id: "establish_trade_route",
    name: "Establish Trade Route",
    description: "Create a formal trade route with another territory",
    effects: "Enables sending caravans. Distance and risk depend on relationship.",
    requiresTarget: true,
  },
  {
    id: "send_caravan",
    name: "Send Trade Caravan",
    description: "Dispatch goods to another territory for profit",
    effects: "Sends goods to sell. Returns with wealth. Risk of raids on route.",
    requiresTarget: true,
  },
  {
    id: "raid_caravan",
    name: "Raid Enemy Caravans",
    description: "Attack caravans belonging to or traveling to an enemy",
    effects: "Steal goods and wealth. Damages relations. May fail if guarded.",
    requiresTarget: true,
  },
  {
    id: "patrol_routes",
    name: "Patrol Trade Routes",
    description: "Assign military to protect trade routes from bandits",
    effects: "Reduces risk of caravan loss. Uses military resources.",
  },

  // =============================================
  // DEEP SIMULATION - DEMOGRAPHICS ACTIONS
  // =============================================
  {
    id: "promote_births",
    name: "Promote Population Growth",
    description: "Encourage families to have more children through incentives",
    effects: "+20% birth rate. Requires adequate food and happiness.",
  },
  {
    id: "class_reform",
    name: "Reform Social Classes",
    description: "Change wealth distribution or rights between social classes",
    effects: "redistribute_wealth, expand_rights, or strengthen_hierarchy. Affects class happiness.",
  },
  {
    id: "appease_faction",
    name: "Appease Faction",
    description: "Reduce a faction's rebellion risk through gold, concessions, or promises",
    effects: "Lowers rebellion risk. Gold is fast but costly. Concessions give them power.",
  },
  {
    id: "suppress_faction",
    name: "Suppress Faction",
    description: "Use military force to crush a rebellious faction",
    effects: "Risky. If successful, reduces faction power. If failed, faction grows stronger.",
  },
  {
    id: "quarantine",
    name: "Declare Quarantine",
    description: "Close borders and trade routes to prevent disease spread",
    effects: "Reduces disease spread. Closes all trade routes. -10 happiness from isolation.",
  },

  // =============================================
  // DEEP SIMULATION - MILITARY ACTIONS
  // =============================================
  {
    id: "raise_militia",
    name: "Raise Militia",
    description: "Quickly conscript local civilians into a fighting force",
    effects: "Creates army quickly. Cheap but weak. Max 20% of population.",
  },
  {
    id: "recruit_soldiers",
    name: "Recruit Professional Soldiers",
    description: "Train and equip professional military units",
    effects: "Adds soldiers to army. Infantry, cavalry, or archers. Requires wealth.",
  },
  {
    id: "build_fortifications",
    name: "Build Fortifications",
    description: "Construct defensive walls and structures",
    effects: "Palisade -> Wooden Wall -> Stone Wall -> Castle. Increases defense.",
  },
  {
    id: "move_army",
    name: "Move Army",
    description: "Relocate an army to another territory",
    effects: "Army marches to new location. Consumes supplies. Takes time.",
    requiresTarget: true,
  },
  {
    id: "lay_siege",
    name: "Lay Siege",
    description: "Begin a siege against an enemy fortification",
    effects: "Gradually damages enemy defenses. Can assault once breached. Costly.",
    requiresTarget: true,
  },
  {
    id: "assault_walls",
    name: "Storm the Walls",
    description: "Launch a direct assault on enemy fortifications (risky!)",
    effects: "Attempt to capture immediately. High casualties even if successful.",
    requiresTarget: true,
  },
  {
    id: "supply_army",
    name: "Resupply Army",
    description: "Send supplies to reinforce a distant army",
    effects: "Restores army supplies. Costs food. Prevents desertion.",
  },

  // =============================================
  // ORGANIC KNOWLEDGE PROGRESSION ACTIONS
  // Technologies emerge organically when your people develop practical skills.
  // Instead of "researching" technology, you encourage skill practice.
  // =============================================
  {
    id: "encourage_craft",
    name: "Encourage Craft Practice",
    description: "Focus your people on practicing a specific skill (smithing, farming, carpentry, etc.)",
    effects: "+20% skill gain for chosen skill this tick. Specify skill in target.",
  },
  {
    id: "apprenticeship_program",
    name: "Start Apprenticeship Program",
    description: "Have your experts teach their skills to younger workers",
    effects: "Experts train apprentices. Faster skill spread but reduces expert productivity for 3 ticks.",
  },
  {
    id: "knowledge_festival",
    name: "Hold Knowledge Festival",
    description: "Celebrate and share knowledge across your society through demonstrations and competitions",
    effects: "+10 collective knowledge in all areas. Costs 10 food, 5 wealth. Boosts happiness.",
  },
  {
    id: "share_technology",
    name: "Share Technology with Ally",
    description: "Teach an allied territory one of your discovered technologies",
    effects: "Ally gains 50% research progress. Improves trust significantly.",
    requiresTarget: true,
  },
  {
    id: "steal_technology",
    name: "Steal Technology (Espionage)",
    description: "Attempt to steal technological secrets from another territory",
    effects: "If successful, gain their tech. Risk of discovery damages relations.",
    requiresTarget: true,
  },
  {
    id: "establish_academy",
    name: "Establish Academy",
    description: "Build a center of learning to spread knowledge faster",
    effects: "Creates academy building. +skill gain rate. Requires writing technology.",
  },

  // =============================================
  // SKILL-BASED ACTIONS
  // These actions require minimum skill levels in your population
  // They unlock automatically when you have enough skilled/expert workers
  // =============================================

  // === ADVANCED CRAFTING (Requires Expert Craftsmen) ===
  {
    id: "forge_quality_weapons",
    name: "Forge Quality Weapons",
    description: "Have your master smiths create exceptional weapons",
    effects: "+30% weapon quality for army. Requires 10% expert smithing.",
    requiredSkills: { smithing: { minExpertPercent: 10 } },
  },
  {
    id: "forge_quality_armor",
    name: "Forge Quality Armor",
    description: "Have your master smiths create superior armor",
    effects: "+30% armor quality for army. Requires 15% expert smithing.",
    requiredSkills: { smithing: { minExpertPercent: 15 } },
  },
  {
    id: "build_warships",
    name: "Build Warships",
    description: "Construct seaworthy military vessels",
    effects: "Creates naval military unit. Requires expert shipwrights.",
    requiredSkills: { shipwright: { minExpertPercent: 10 }, carpentry: { minSkilledPercent: 20 } },
  },
  {
    id: "construct_siege_equipment",
    name: "Construct Siege Equipment",
    description: "Build rams, catapults, and siege towers",
    effects: "+50% siege effectiveness. Requires expert engineers.",
    requiredSkills: { siege_engineering: { minExpertPercent: 8 }, carpentry: { minSkilledPercent: 15 } },
  },

  // === ADVANCED AGRICULTURE (Requires Expert Farmers) ===
  {
    id: "advanced_irrigation",
    name: "Build Advanced Irrigation",
    description: "Construct sophisticated water management systems",
    effects: "+50% farm output. Requires irrigation expertise.",
    requiredSkills: { irrigation: { minExpertPercent: 8 }, farming: { minSkilledPercent: 20 } },
  },
  {
    id: "selective_breeding",
    name: "Selective Animal Breeding",
    description: "Improve livestock through careful breeding programs",
    effects: "+30% animal productivity. Requires veterinary knowledge.",
    requiredSkills: { veterinary: { minExpertPercent: 8 }, animalcare: { minSkilledPercent: 20 } },
  },

  // === MILITARY TACTICS (Requires Expert Tacticians) ===
  {
    id: "flanking_maneuver",
    name: "Execute Flanking Maneuver",
    description: "Use advanced tactics to outmaneuver enemy forces",
    effects: "+40% combat advantage. Requires expert tacticians.",
    requiredSkills: { tactics: { minExpertPercent: 10 } },
    requiresTarget: true,
  },
  {
    id: "train_elite_guard",
    name: "Train Elite Guard",
    description: "Create an elite bodyguard unit for your ruler",
    effects: "Creates elite military unit. +50% defense vs assassination.",
    requiredSkills: { melee: { minExpertPercent: 15 }, tactics: { minSkilledPercent: 20 } },
  },
  {
    id: "cavalry_charge",
    name: "Cavalry Charge Training",
    description: "Train cavalry in devastating charge tactics",
    effects: "+50% cavalry charge damage. Requires expert cavalry.",
    requiredSkills: { cavalry: { minExpertPercent: 10 }, animalcare: { minSkilledPercent: 15 } },
  },
  {
    id: "naval_blockade",
    name: "Naval Blockade",
    description: "Use your navy to blockade enemy ports",
    effects: "Cuts enemy sea trade. Requires naval combat expertise.",
    requiredSkills: { naval_combat: { minExpertPercent: 10 }, navigation: { minSkilledPercent: 15 } },
    requiresTarget: true,
  },

  // === KNOWLEDGE & SCIENCE (Requires Scholars) ===
  {
    id: "scientific_expedition",
    name: "Scientific Expedition",
    description: "Send scholars to study natural phenomena",
    effects: "+20 knowledge in chosen field. Requires literacy experts.",
    requiredSkills: { literacy: { minExpertPercent: 10 }, mathematics: { minSkilledPercent: 15 } },
  },
  {
    id: "medical_research",
    name: "Conduct Medical Research",
    description: "Have physicians study diseases and treatments",
    effects: "-20% death rate from disease. Requires medical experts.",
    requiredSkills: { medicine: { minExpertPercent: 8 }, herbalism: { minSkilledPercent: 15 } },
  },
  {
    id: "astronomical_observation",
    name: "Astronomical Observation",
    description: "Have astronomers study the stars for navigation and calendars",
    effects: "+navigation bonus, better crop timing. Requires astronomy expertise.",
    requiredSkills: { astronomy: { minExpertPercent: 8 }, mathematics: { minSkilledPercent: 15 } },
  },
  {
    id: "philosophical_debates",
    name: "Hold Philosophical Debates",
    description: "Scholars debate ideas to advance understanding",
    effects: "+30% research speed. Requires philosophy expertise.",
    requiredSkills: { philosophy: { minExpertPercent: 8 }, literacy: { minSkilledPercent: 20 } },
  },

  // === ADVANCED CONSTRUCTION (Requires Engineers) ===
  {
    id: "build_aqueduct",
    name: "Build Aqueduct",
    description: "Construct water supply infrastructure for cities",
    effects: "+population capacity, +health. Requires engineering expertise.",
    requiredSkills: { engineering: { minExpertPercent: 10 }, masonry: { minSkilledPercent: 20 } },
  },
  {
    id: "build_grand_monument",
    name: "Build Grand Monument",
    description: "Construct an impressive monument to your civilization",
    effects: "+20 influence, +10 happiness. Requires architecture expertise.",
    requiredSkills: { architecture: { minExpertPercent: 10 }, masonry: { minExpertPercent: 10 } },
  },
  {
    id: "fortify_harbor",
    name: "Fortify Harbor",
    description: "Build defensive structures to protect your port",
    effects: "+50% harbor defense. Requires fortification expertise.",
    requiredSkills: { fortification: { minExpertPercent: 10 }, engineering: { minSkilledPercent: 15 } },
  },

  // === ESPIONAGE & DIPLOMACY (Requires Social Skills) ===
  {
    id: "infiltrate_court",
    name: "Infiltrate Enemy Court",
    description: "Plant spies in an enemy's court for intelligence",
    effects: "Gain intel on enemy plans. Requires espionage expertise.",
    requiredSkills: { espionage: { minExpertPercent: 8 }, persuasion: { minSkilledPercent: 20 } },
    requiresTarget: true,
  },
  {
    id: "diplomatic_mission",
    name: "Send Diplomatic Mission",
    description: "Send skilled diplomats to negotiate complex treaties",
    effects: "+20 trust gain, better trade terms. Requires diplomacy expertise.",
    requiredSkills: { diplomacy: { minExpertPercent: 8 }, negotiation: { minSkilledPercent: 20 } },
    requiresTarget: true,
  },
  {
    id: "propaganda_campaign",
    name: "Launch Propaganda Campaign",
    description: "Spread your ideology through persuasive messaging",
    effects: "+influence in target territory. Requires propaganda expertise.",
    requiredSkills: { propaganda: { minExpertPercent: 8 }, literacy: { minSkilledPercent: 15 } },
    requiresTarget: true,
  },

  // === INDUSTRIAL ERA ACTIONS (Requires Advanced Skills) ===
  {
    id: "build_factory",
    name: "Build Factory",
    description: "Construct a steam-powered manufacturing facility",
    effects: "+200% goods production. Requires steam engineering expertise.",
    requiredSkills: { steam_engineering: { minExpertPercent: 10 }, machine_tools: { minSkilledPercent: 15 } },
  },
  {
    id: "build_railway",
    name: "Build Railway",
    description: "Construct a railway line for fast transport",
    effects: "+100% trade speed, +50% army movement. Requires railway expertise.",
    requiredSkills: { railways: { minExpertPercent: 10 }, steel_production: { minSkilledPercent: 15 } },
    requiresTarget: true,
  },
  {
    id: "electrify_territory",
    name: "Electrify Territory",
    description: "Build power grid and electric infrastructure",
    effects: "+50% productivity, +happiness. Requires electrical engineering expertise.",
    requiredSkills: { electrical_engineering: { minExpertPercent: 10 }, physics: { minSkilledPercent: 15 } },
  },

  // === MODERN/ATOMIC ERA ACTIONS (Requires Cutting-Edge Skills) ===
  {
    id: "develop_aircraft",
    name: "Develop Aircraft",
    description: "Design and build military or civilian aircraft",
    effects: "Creates air force capability. Requires aviation expertise.",
    requiredSkills: { aviation: { minExpertPercent: 10 }, internal_combustion: { minSkilledPercent: 15 } },
  },
  {
    id: "launch_satellite",
    name: "Launch Satellite",
    description: "Put a satellite into orbit for communications and reconnaissance",
    effects: "+global intelligence, +communication. Requires rocketry expertise.",
    requiredSkills: { rocketry: { minExpertPercent: 12 }, computing: { minSkilledPercent: 15 } },
  },
  {
    id: "nuclear_research",
    name: "Conduct Nuclear Research",
    description: "Research nuclear technology for power or weapons",
    effects: "Progress toward nuclear technology. Requires nuclear physics expertise.",
    requiredSkills: { nuclear_physics: { minExpertPercent: 10 }, physics: { minExpertPercent: 15 } },
  },
  {
    id: "develop_missile_program",
    name: "Develop Missile Program",
    description: "Create ballistic missiles for military purposes",
    effects: "Creates missile capability. Requires missile systems expertise.",
    requiredSkills: { missile_systems: { minExpertPercent: 10 }, rocketry: { minExpertPercent: 12 } },
  },

  // =============================================
  // ENGAGEMENT SYSTEM - CHARACTER & INTRIGUE ACTIONS
  // =============================================
  {
    id: "execute_character",
    name: "Execute Suspected Traitor",
    description: "Execute a court member suspected of plotting against you. They may be innocent!",
    effects: "Removes character. If innocent: -10 happiness, other characters fear you. If guilty: +5 stability.",
  },
  {
    id: "investigate_plot",
    name: "Investigate Suspected Plot",
    description: "Spend resources to uncover conspiracies in your court",
    effects: "May discover plots (chance based on your paranoia vs their cunning). Costs 5 wealth.",
  },
  {
    id: "bribe_character",
    name: "Bribe Court Member",
    description: "Pay off a potentially disloyal court member to secure their loyalty",
    effects: "Target loyalty +20, but greed +10. Costs 10 wealth. May backfire if they're too ambitious.",
  },
  {
    id: "arrange_marriage",
    name: "Arrange Political Marriage",
    description: "Marry your heir to another ruler's family for alliance",
    effects: "Creates or strengthens alliance. May reduce rivalry. Heir's loyalty may change.",
    requiresTarget: true,
  },
  {
    id: "name_heir",
    name: "Name Official Heir",
    description: "Designate an official successor to reduce succession crisis risk",
    effects: "-30% succession crisis likelihood. Other ambitious characters may start plotting.",
  },
  {
    id: "found_dynasty",
    name: "Found Dynasty",
    description: "Establish a named dynasty for your bloodline to build legacy",
    effects: "+10 influence. Enables inheritance tracking. Creates lasting legacy.",
  },
  {
    id: "purge_court",
    name: "Purge the Court",
    description: "Execute multiple suspected traitors at once (paranoid/desperate action)",
    effects: "Removes all characters with loyalty < 40. May kill innocents. -15 happiness, +fear.",
  },
  {
    id: "hold_feast",
    name: "Hold Grand Feast",
    description: "Host a celebration to improve morale and court loyalty",
    effects: "+5 happiness, +10 loyalty for all court. Costs 15 wealth, 10 food. Reduces tensions.",
  },
  {
    id: "address_decadence",
    name: "Address Decadence",
    description: "Implement austerity measures to combat corruption and excess",
    effects: "-20 decadence, -5 happiness (temporary). Reduces plot chances from prosperity.",
  },
  {
    id: "treat_wounded",
    name: "Treat Wounded Characters",
    description: "Apply medication to wounded court members. Characters wounded in war need treatment to heal.",
    effects: "Choose treatment type: herbal (safe, slow), surgical (moderate risk, faster), experimental (risky but effective), spiritual (safest, slowest). Failed treatments can kill!",
  },
  {
    id: "declare_vendetta",
    name: "Declare Vendetta",
    description: "Publicly declare a blood feud against a rival who wronged you",
    effects: "Creates hereditary rivalry. +10 military motivation vs target. Cannot make peace easily.",
    requiresTarget: true,
  },
  {
    id: "seek_reconciliation",
    name: "Seek Reconciliation",
    description: "Attempt to resolve a rivalry through diplomacy or compensation",
    effects: "May reduce rivalry intensity if both parties willing. Requires concessions.",
    requiresTarget: true,
  },

  // =============================================
  // SOCIETY SYSTEMS - RELIGION
  // =============================================
  {
    id: "found_religion",
    name: "Found Religion",
    description: "Establish a new religion with its own deity, beliefs, and practices",
    effects: "Creates new religion. +10 happiness, +5 influence. Needs a name and deity concept.",
  },
  {
    id: "build_temple",
    name: "Build Temple",
    description: "Construct a place of worship (shrine, temple, cathedral, monastery, or oracle)",
    effects: "Costs wealth based on size. Spreads religion, provides happiness bonus, collects tithes.",
  },
  {
    id: "declare_state_religion",
    name: "Declare State Religion",
    description: "Make a religion the official faith of your territory",
    effects: "+5 happiness for followers, may anger non-believers. Religious bonuses apply to all.",
  },
  {
    id: "ordain_priest",
    name: "Ordain Priest",
    description: "Elevate a pious character to religious office",
    effects: "Character becomes priest. Can perform ceremonies, convert followers, serve at temple.",
  },
  {
    id: "hold_religious_festival",
    name: "Hold Religious Festival",
    description: "Celebrate a holy day with feasts and ceremonies",
    effects: "+8 happiness, +5 piety for followers. Costs food and wealth.",
  },

  // =============================================
  // SOCIETY SYSTEMS - EDUCATION
  // =============================================
  {
    id: "build_school",
    name: "Build School",
    description: "Establish an educational institution (primary, secondary, university, military academy, trade school, medical school, law school, religious school)",
    effects: "Costs wealth. Provides education, increases literacy, trains skilled workers.",
  },
  {
    id: "enroll_student",
    name: "Enroll Student",
    description: "Send a character to study at a school",
    effects: "Character gains skills over time. Must meet age and literacy requirements.",
  },
  {
    id: "hire_teacher",
    name: "Hire Teacher",
    description: "Assign a literate character to teach at a school",
    effects: "Improves school quality. Teacher must have 50+ literacy.",
  },
  {
    id: "expand_library",
    name: "Expand Library",
    description: "Add books and scrolls to a school's library",
    effects: "Costs wealth. Improves education quality and research speed.",
  },

  // =============================================
  // SOCIETY SYSTEMS - GUILDS
  // =============================================
  {
    id: "found_guild",
    name: "Found Guild",
    description: "Establish a craft or trade guild (blacksmiths, masons, merchants, etc.)",
    effects: "Creates guild with monopoly potential. Requires master-level craftsman as founder.",
  },
  {
    id: "join_guild",
    name: "Join Guild",
    description: "Have a character join an appropriate guild based on their profession",
    effects: "Character gains access to guild training, protection, and advancement opportunities.",
  },
  {
    id: "grant_monopoly",
    name: "Grant Guild Monopoly",
    description: "Give a guild exclusive rights to trade their goods",
    effects: "Guild gains +20 political influence. May anger non-guild craftsmen.",
  },
  {
    id: "build_guild_hall",
    name: "Build Guild Hall",
    description: "Construct a headquarters for a guild",
    effects: "Costs guild treasury. Improves training quality and political influence.",
  },

  // =============================================
  // SOCIETY SYSTEMS - JUDICIAL
  // =============================================
  {
    id: "establish_law_code",
    name: "Establish Law Code",
    description: "Create a formal legal system with defined crimes and punishments",
    effects: "Choose severity: lenient (happy but more crime), moderate, harsh, or draconian (fear but order).",
  },
  {
    id: "report_crime",
    name: "Report Crime",
    description: "Accuse someone of a crime (theft, assault, murder, treason, heresy, etc.)",
    effects: "Begins investigation. May lead to trial if evidence is strong.",
  },
  {
    id: "hold_trial",
    name: "Hold Trial",
    description: "Try an accused person before a judge",
    effects: "Requires judge with law skill or ruler. Verdict based on evidence and fairness.",
  },
  {
    id: "pardon_criminal",
    name: "Pardon Criminal",
    description: "Ruler forgives a convicted person",
    effects: "Criminal released from prison/exile. May improve or damage reputation.",
  },
  {
    id: "build_prison",
    name: "Build Prison",
    description: "Construct a facility to hold criminals",
    effects: "Choose conditions: humane (costly but rehabilitates), standard, harsh, or dungeon (cheap but deadly).",
  },
  {
    id: "appoint_judge",
    name: "Appoint Judge",
    description: "Assign a character with law knowledge to serve as judge",
    effects: "Character becomes judge. Handles trials. Justice trait affects fairness.",
  },
];

export interface RelationshipContext {
  territoryName: string;
  trust: number;
  status: string;
  hasTradeAgreement: boolean;
  hasAlliance: boolean;
}

export interface WorldContext {
  year: number;
  month: number;
  tick: number;
}

// =============================================
// ENGAGEMENT CONTEXT BUILDER
// =============================================

function getTraitDescription(value: number): string {
  if (value >= 90) return "Extreme";
  if (value >= 75) return "Very High";
  if (value >= 60) return "High";
  if (value >= 40) return "Moderate";
  if (value >= 25) return "Low";
  if (value >= 10) return "Very Low";
  return "Minimal";
}

function getEmotionalSummary(state: CharacterContext["emotionalState"]): string {
  const dominant: string[] = [];
  if (state.rage > 60) dominant.push("furious");
  if (state.fear > 60) dominant.push("fearful");
  if (state.despair > 60) dominant.push("despairing");
  if (state.shame > 60) dominant.push("ashamed");
  if (state.hope > 60) dominant.push("hopeful");
  if (state.contentment > 60) dominant.push("content");

  if (dominant.length === 0) {
    if (state.contentment > 40 && state.hope > 40) return "stable and calm";
    if (state.fear > 40 || state.despair > 40) return "uneasy";
    return "neutral";
  }
  return dominant.join(", ");
}

function getTopTraits(traits: CharacterContext["traits"]): string[] {
  const traitList = Object.entries(traits)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 3);

  return traitList.map(t => `${t.name} (${t.value})`);
}

function buildEngagementSection(context?: EngagementContext): string {
  if (!context) return "";

  const sections: string[] = [];

  // === YOUR RULER ===
  if (context.ruler) {
    const r = context.ruler;
    const topTraits = getTopTraits(r.traits);
    const mood = getEmotionalSummary(r.emotionalState);

    sections.push(`## Your Ruler: ${r.name} the ${r.title}

- **Age:** ${r.age} years old
- **Mood:** Currently ${mood}
- **Defining Traits:** ${topTraits.join(", ")}
- **Ambition:** ${getTraitDescription(r.traits.ambition)} (${r.traits.ambition})
- **Loyalty:** ${getTraitDescription(r.traits.loyalty)} (${r.traits.loyalty})
- **Cunning:** ${getTraitDescription(r.traits.cunning)} (${r.traits.cunning})
- **Paranoia:** ${getTraitDescription(r.traits.paranoia)} (${r.traits.paranoia})
${r.secretGoal && r.secretGoal !== "none" ? `- **Secret Desire:** ${formatSecretGoal(r.secretGoal)}` : ""}`);

    // Add ruler legitimacy and trust if available
    if (r.legitimacy !== undefined || r.popularTrust !== undefined) {
      const legitimacy = r.legitimacy ?? 50;
      const trust = r.popularTrust ?? 50;

      // Get status descriptions
      const legitimacyStatus = legitimacy >= 80 ? "Unquestioned authority" :
                              legitimacy >= 60 ? "Accepted ruler" :
                              legitimacy >= 40 ? "Disputed claim" :
                              legitimacy >= 20 ? "Widely contested" : "Illegitimate usurper";

      const trustStatus = trust >= 80 ? "Beloved by the people" :
                         trust >= 60 ? "Trusted leader" :
                         trust >= 40 ? "Mixed reputation" :
                         trust >= 20 ? "Distrusted" : "Hated tyrant";

      let legitimacySection = `
### Ruler's Standing with the People

- **Claim to Power:** ${r.legitimacySource?.replace(/_/g, " ") || "unknown"}
- **Legitimacy:** ${legitimacy.toFixed(0)}% (${legitimacyStatus})
- **Popular Trust:** ${trust.toFixed(0)}% (${trustStatus})`;

      if (r.trustRecord) {
        const rec = r.trustRecord;
        const recordEntries: string[] = [];
        if (rec.warsWon > 0 || rec.warsLost > 0) recordEntries.push(`Wars: ${rec.warsWon} won, ${rec.warsLost} lost`);
        if (rec.crisesSurvived > 0 || rec.crisesFailed > 0) recordEntries.push(`Crises: ${rec.crisesSurvived} survived, ${rec.crisesFailed} mishandled`);
        if (rec.promisesKept > 0 || rec.promisesBroken > 0) recordEntries.push(`Promises: ${rec.promisesKept} kept, ${rec.promisesBroken} broken`);
        if (rec.corruptionScandals > 0) recordEntries.push(`Corruption scandals: ${rec.corruptionScandals}`);

        if (recordEntries.length > 0) {
          legitimacySection += `
- **Track Record:** ${recordEntries.join("; ")}`;
        }
      }

      // Add warnings for low legitimacy/trust
      const warnings: string[] = [];
      if (legitimacy < 40) warnings.push("LOW LEGITIMACY - vulnerable to challenges and coups");
      if (trust < 40) warnings.push("LOW TRUST - people may support rebels");
      if (legitimacy < 20) warnings.push("CRITICAL: Seen as illegitimate usurper");
      if (trust < 20) warnings.push("CRITICAL: Deeply hated - overthrow likely");

      if (warnings.length > 0) {
        legitimacySection += `

⚠️ **WARNINGS:**
${warnings.map(w => `- ${w}`).join("\n")}`;
      }

      sections.push(legitimacySection);
    }

    // Add ruler's priorities - what drives their decisions dynamically based on CHARACTER_PRIORITIES
    const rulerPriorities = CHARACTER_PRIORITIES.ruler || [];
    const criticalPriorities = rulerPriorities.filter(p => p.level === "critical");
    const highPriorities = rulerPriorities.filter(p => p.level === "high");
    const mediumPriorities = rulerPriorities.filter(p => p.level === "medium");

    let prioritiesSection = `### What ${r.name} Cares About (Priorities)

**🔴 SURVIVAL (CRITICAL - Always First):**
${criticalPriorities.map((p, i) => `${i + 1}. ${p.description}`).join("\n")}
- *"Before I can pursue greatness, my people must survive. Dead subjects build no empires."*

**🟠 PRIMARY CONCERNS (High Priority):**
${highPriorities.map((p, i) => `${i + 1}. **${p.name.replace(/_/g, " ").toUpperCase()}** - ${p.description}`).join("\n")}

**🟡 SECONDARY CONCERNS (Medium Priority):**
${mediumPriorities.map((p, i) => `${i + 1}. ${p.description}`).join("\n")}`;

    // Add personality-driven priorities
    if (r.traits.ambition > 70) {
      prioritiesSection += `\n\n**⚡ PERSONAL DRIVE (High Ambition):** I will be remembered as a conqueror!`;
    }
    if (r.traits.paranoia > 60) {
      prioritiesSection += `\n\n**⚠️ CONSTANT VIGILANCE (High Paranoia):** I must root out threats before they strike.`;
    }
    if (r.traits.compassion > 60) {
      prioritiesSection += `\n\n**💚 CARING HEART (High Compassion):** My people's wellbeing matters more than glory.`;
    }

    prioritiesSection += `\n\n*My decisions will reflect these priorities in order. Survival first, then power, then glory.*`;
    sections.push(prioritiesSection);
  }

  // === HEIR ===
  if (context.heir) {
    const h = context.heir;
    const dangerLevel = h.traits.ambition > 70 && h.traits.loyalty < 40 ? "⚠️ DANGEROUS" :
                        h.traits.ambition > 50 && h.traits.loyalty < 50 ? "⚡ Watch closely" :
                        "Loyal";

    // Get heir's priorities
    const heirPriorities = CHARACTER_PRIORITIES.heir || [];
    const heirHighPriorities = heirPriorities.filter(p => p.level === "high").slice(0, 3);

    sections.push(`### Your Heir: ${h.name}
- **Age:** ${h.age} | **Loyalty:** ${h.traits.loyalty} | **Ambition:** ${h.traits.ambition}
- **Assessment:** ${dangerLevel}
${h.isPlotting ? `- ⚠️ **SUSPECTED OF PLOTTING** (${h.plotType})` : ""}

**What ${h.name} Cares About:**
${heirHighPriorities.map(p => `- ${p.description}`).join("\n")}
${h.traits.ambition > 70 ? `- *"I am ready to rule. Perhaps sooner than expected..."*` : `- *"I will honor my duty when the time comes."*"}`}`);
  }

  // === COURT INTRIGUE ===
  if (context.courtMembers.length > 0) {
    const suspiciousMembers = context.courtMembers.filter(
      m => m.traits.loyalty < 50 || m.traits.ambition > 60 || m.isPlotting
    );

    if (suspiciousMembers.length > 0 || context.suspectedPlots > 0) {
      let courtSection = `## Court Intrigue

**Suspected plots against you:** ${context.suspectedPlots}
`;

      for (const member of suspiciousMembers) {
        const warnings: string[] = [];
        if (member.traits.loyalty < 30) warnings.push("very disloyal");
        else if (member.traits.loyalty < 50) warnings.push("questionable loyalty");
        if (member.traits.ambition > 80) warnings.push("extremely ambitious");
        else if (member.traits.ambition > 60) warnings.push("ambitious");
        if (member.traits.greed > 70) warnings.push("greedy");
        if (member.isPlotting) warnings.push(`PLOTTING ${member.plotType?.toUpperCase()}`);

        if (warnings.length > 0) {
          // Get role-specific priorities for this member
          const memberRole = member.role.toLowerCase();
          const memberPriorities = CHARACTER_PRIORITIES[memberRole] || CHARACTER_PRIORITIES.commoner;
          const topPriority = memberPriorities.filter(p => p.level === "high")[0];

          courtSection += `
**${member.title} ${member.name}** (${member.role})
- Cunning: ${member.traits.cunning} | Loyalty: ${member.traits.loyalty} | Ambition: ${member.traits.ambition}
- ⚠️ Concerns: ${warnings.join(", ")}
- What drives them: *"${topPriority?.description || "Survival above all else"}"*`;
        }
      }

      sections.push(courtSection);
    }
  }

  // === TENSIONS ===
  if (context.tensions) {
    const t = context.tensions;
    const highTensions: string[] = [];

    if (t.coupLikelihood > 40) highTensions.push(`Coup: ${t.coupLikelihood}%`);
    if (t.rebellionLikelihood > 40) highTensions.push(`Rebellion: ${t.rebellionLikelihood}%`);
    if (t.famineLikelihood > 40) highTensions.push(`Famine: ${t.famineLikelihood}%`);
    if (t.successionCrisisLikelihood > 40) highTensions.push(`Succession Crisis: ${t.successionCrisisLikelihood}%`);

    if (highTensions.length > 0 || t.brewingConflicts.length > 0) {
      let tensionSection = `## Tension Indicators

${highTensions.length > 0 ? `**Internal Threats:**
${highTensions.map(h => `- ${h}`).join("\n")}` : "Internal situation stable."}
`;

      if (t.brewingConflicts.length > 0) {
        tensionSection += `
**Brewing Conflicts:**
${t.brewingConflicts.map(c => `- War with ${c.targetName}: ${c.likelihood}% likely (${c.reason})`).join("\n")}`;
      }

      sections.push(tensionSection);
    }
  }

  // === RIVALRIES ===
  if (context.rivalries.length > 0) {
    const activeRivalries = context.rivalries.filter(r => r.intensity > 20);

    if (activeRivalries.length > 0) {
      let rivalrySection = `## Your Rivals & Feuds
`;
      for (const rivalry of activeRivalries) {
        const intensityDesc = rivalry.intensity >= 80 ? "🔥 BLOOD FEUD" :
                             rivalry.intensity >= 60 ? "⚔️ Bitter enemies" :
                             rivalry.intensity >= 40 ? "😠 Strong rivalry" :
                             "😤 Tension";

        rivalrySection += `
**${rivalry.opponentName}** of ${rivalry.opponentTerritory} - ${intensityDesc} (${rivalry.intensity}/100)
- Type: ${rivalry.rivalryType}${rivalry.isHereditary ? " (HEREDITARY - passes to heirs)" : ""}
- Causes: ${rivalry.reasons.slice(-2).join("; ")}`;
      }

      sections.push(rivalrySection);
    }
  }

  // === PROSPERITY ===
  if (context.prosperity) {
    const p = context.prosperity;
    const tierEmoji = ["😰", "😐", "🙂", "😊", "🌟", "👑"][p.currentTier] || "❓";

    let prosperitySection = `## Prosperity: ${tierEmoji} ${p.tierName} (Tier ${p.currentTier}/5)

- **Progress to next tier:** ${p.progressToNextTier}%
- **Time at current tier:** ${Math.floor(p.ticksAtCurrentTier / 12)} years`;

    if (p.complacencyLevel > 30 || p.decadenceLevel > 20) {
      prosperitySection += `

**⚠️ Warnings:**`;
      if (p.complacencyLevel > 30) {
        prosperitySection += `
- Complacency: ${p.complacencyLevel}/100 (${p.complacencyLevel > 60 ? "DANGEROUS - people grow lazy" : "Growing - watch for stagnation"})`;
      }
      if (p.decadenceLevel > 20) {
        prosperitySection += `
- Decadence: ${p.decadenceLevel}/100 (${p.decadenceLevel > 50 ? "CRITICAL - corruption breeds plots!" : "Rising - excess is taking hold"})`;
      }
    }

    // Stability factors
    const stability = p.stabilityFactors;
    const weakFactors: string[] = [];
    if (stability.economicStability < 40) weakFactors.push("Economy fragile");
    if (stability.socialHarmony < 40) weakFactors.push("Social unrest");
    if (stability.militaryReadiness < 40) weakFactors.push("Military weak");
    if (stability.politicalUnity < 40) weakFactors.push("Political division");

    if (weakFactors.length > 0) {
      prosperitySection += `
- **Weak points:** ${weakFactors.join(", ")}`;
    }

    sections.push(prosperitySection);
  }

  // === RECENT SUCCESSION ===
  if (context.recentSuccession) {
    sections.push(`## Recent Succession Event

**Type:** ${context.recentSuccession.type}
${context.recentSuccession.narrative}`);
  }

  return sections.length > 0 ? sections.join("\n\n") : "";
}

// =============================================
// ORGANIC KNOWLEDGE PROGRESSION SECTION
// =============================================
// Shows the AI what skills their people have and what technologies
// are naturally emerging from accumulated knowledge.

function buildKnowledgeSection(context?: KnowledgeContext): string {
  if (!context) return "";

  const sections: string[] = [];

  sections.push(`## YOUR PEOPLE'S KNOWLEDGE

*Technologies emerge ORGANICALLY when your people develop practical skills. You cannot "decide" to invent bronze working - you need enough skilled smiths practicing their craft until someone figures it out.*`);

  // Strong areas - skills with good expertise
  if (context.strongAreas && context.strongAreas.length > 0) {
    const strongLines = context.strongAreas.map(s =>
      `- **${s.skillType}:** ${s.skilledCount} skilled workers, ${s.expertCount} experts (avg: ${Math.round(s.averageLevel)})`
    );
    sections.push(`### Strong Areas
Your civilization excels in these skills:
${strongLines.join("\n")}`);
  }

  // Weak areas - skills needing development
  if (context.weakAreas && context.weakAreas.length > 0) {
    const weakLines = context.weakAreas.map(s =>
      `- **${s.skillType}:** Only ${s.skilledCount} people practice this (avg: ${Math.round(s.averageLevel)})`
    );
    sections.push(`### Weak Areas
These skills need more practitioners:
${weakLines.join("\n")}`);
  }

  // Technologies approaching discovery
  if (context.approachingTechs && context.approachingTechs.length > 0) {
    const techLines = context.approachingTechs.map(t => {
      if (t.requirementsMet) {
        return `- **${t.techName}:** ${t.progress}% progress - Discovery imminent!`;
      } else {
        return `- **${t.techName}:** ${t.progress}% progress - Need: ${t.missingRequirements.slice(0, 2).join(", ")}`;
      }
    });
    sections.push(`### Technologies Emerging
Your people are close to discovering:
${techLines.join("\n")}

*To accelerate discovery, encourage practice in the required skills or start apprenticeship programs!*`);
  }

  // Recent breakthroughs
  if (context.recentBreakthroughs && context.recentBreakthroughs.length > 0) {
    sections.push(`### Recent Breakthroughs!
${context.recentBreakthroughs.map(t => `- Your people discovered: **${t}**`).join("\n")}`);
  }

  return sections.join("\n\n");
}

// Build survival knowledge section for AI prompt
function buildSurvivalSection(
  territory: Doc<"territories">,
  month: number
): string {
  // Calculate current season
  const season: Season = month === 12 || month === 1 || month === 2 ? "winter"
    : month >= 3 && month <= 5 ? "spring"
    : month >= 6 && month <= 8 ? "summer"
    : "autumn";

  const survivalStatus = getSurvivalStatus(territory, season);
  const population = territory.population;
  const shelterCapacity = (territory as any).shelterCapacity || 0;
  const woodStockpile = (territory as any).woodStockpile || 0;
  const preservedFood = (territory as any).preservedFood || 0;
  const winterFuelNeeded = calculateWinterFuelRequirement(population);
  const shelterDeficit = calculateShelterDeficit(population, shelterCapacity);

  const seasonalEffects = SEASONAL_EFFECTS[season];

  // Build season-specific advice
  let seasonAdvice = "";
  switch (season) {
    case "winter":
      seasonAdvice = `
**WINTER CONDITIONS:**
- Food consumption is 50% HIGHER (people need more to stay warm)
- Foraging yields are 50% LOWER (nature is dormant)
- Farm output is 80% LOWER (nothing grows)
- People without shelter face 5% death rate from exposure EACH MONTH
- Shelters need wood for heating - ${(seasonalEffects.fuelConsumptionPerPerson * population).toFixed(1)} wood/month
${shelterDeficit > 0 ? `\n⚠️ ${shelterDeficit} PEOPLE WILL DIE FROM EXPOSURE without shelter!` : ""}
${woodStockpile < winterFuelNeeded / 3 ? `\n⚠️ NOT ENOUGH WOOD FOR HEATING! People may freeze even in shelters!` : ""}`;
      break;
    case "autumn":
      seasonAdvice = `
**AUTUMN - WINTER IS COMING:**
- This is your LAST CHANCE to prepare for winter!
- Harvest season: Farm output is 30% HIGHER
- Gather wood NOW or face death in winter
- Build houses NOW or your people will freeze
- Preserve food NOW for the lean winter months
${shelterDeficit > 0 ? `\n⚠️ WARNING: ${shelterDeficit} people lack shelter! Build houses IMMEDIATELY!` : ""}
${woodStockpile < winterFuelNeeded ? `\n⚠️ WARNING: Need ${(winterFuelNeeded - woodStockpile).toFixed(0)} more wood to survive winter!` : ""}`;
      break;
    case "spring":
      seasonAdvice = `
**SPRING CONDITIONS:**
- Nature awakens - foraging returns to normal
- Some exposure risk at night (1% death rate for unsheltered)
- Light heating needed (${(seasonalEffects.fuelConsumptionPerPerson * population).toFixed(1)} wood/month)
- Good time to build and prepare for next year`;
      break;
    case "summer":
      seasonAdvice = `
**SUMMER CONDITIONS:**
- Food consumption is 10% LOWER (warm weather)
- Foraging yields are 20% HIGHER (nature is abundant)
- Farm output is 20% HIGHER (growing season)
- No exposure risk - even sleeping outside is safe
- No heating needed
- BEST time to stockpile resources for winter!`;
      break;
  }

  // Determine the most critical survival action needed
  let criticalAction = "";
  if (shelterDeficit > 0) {
    criticalAction = `🚨 **CRITICAL: ${shelterDeficit} people have NO SHELTER!**
→ YOU MUST choose "build_houses" THIS TURN or they will die!
→ Expected deaths if ignored: ${Math.ceil(shelterDeficit * (seasonalEffects.exposureDeathRate || 0.01))} people per month`;
  } else if (season === "winter" && woodStockpile < winterFuelNeeded / 3) {
    criticalAction = `🚨 **CRITICAL: NOT ENOUGH WOOD FOR HEATING!**
→ YOU MUST choose "gather_wood" THIS TURN or people will freeze!
→ Have: ${woodStockpile.toFixed(0)} wood, Need: ${winterFuelNeeded.toFixed(0)} wood`;
  } else if (territory.food < 20) {
    criticalAction = `🚨 **CRITICAL: FOOD STORES ALMOST EMPTY!**
→ YOU MUST choose "gather_food" THIS TURN or people will starve!
→ Current food: ${territory.food.toFixed(0)}/100`;
  } else if (season === "autumn" && shelterDeficit > 0) {
    criticalAction = `⚠️ **WARNING: ${shelterDeficit} people lack shelter for winter!**
→ STRONGLY RECOMMENDED: "build_houses" before winter arrives!`;
  } else if (season === "autumn" && woodStockpile < winterFuelNeeded) {
    criticalAction = `⚠️ **WARNING: Not enough wood stockpiled for winter!**
→ STRONGLY RECOMMENDED: "gather_wood" before winter arrives!
→ Have: ${woodStockpile.toFixed(0)} wood, Need: ${winterFuelNeeded.toFixed(0)} wood`;
  }

  return `## 🔥 SURVIVAL STATUS 🔥

${criticalAction ? `${criticalAction}\n` : ""}
${seasonAdvice}

### Your Survival Resources:
- **Population:** ${population} people
- **Shelter Capacity:** ${shelterCapacity} (${shelterDeficit > 0 ? `⚠️ ${shelterDeficit} UNSHELTERED` : "✓ All sheltered"})
- **Wood Stockpile:** ${woodStockpile.toFixed(0)} units ${season === "winter" || season === "autumn" ? `(need ${winterFuelNeeded.toFixed(0)} for winter)` : ""}
- **Food:** ${territory.food.toFixed(0)}/100 ${territory.food < 20 ? "⚠️ CRITICAL" : territory.food < 40 ? "⚠️ LOW" : "✓ OK"}
- **Preserved Food:** ${preservedFood.toFixed(0)} units (doesn't decay in winter)
- **Winter Readiness:** ${survivalStatus.winterReadiness}

${survivalStatus.urgentNeeds.length > 0 ? `### ⚠️ URGENT SURVIVAL NEEDS (DO THESE FIRST!):
${survivalStatus.urgentNeeds.map(need => `- **${need}**`).join("\n")}` : "### ✓ Basic survival needs are met - you may pursue other goals"}

### Survival Tips:
- **Fire requires wood** - Without wood, even sheltered people can freeze in winter
- **Build shelters BEFORE winter** - Each house costs 15 wood, shelters 20 people
- **Preserve food in autumn** - Fresh food spoils, preserved food lasts all winter
- **Wood regenerates slowly** - Forests regrow ~2 wood/month, faster in spring/summer
- **Plan ahead** - Winter lasts 3 months (December-February)
`;
}

function formatSecretGoal(goal: string): string {
  const goalDescriptions: Record<string, string> = {
    seize_throne: "Covets the throne for themselves",
    accumulate_wealth: "Obsessed with amassing riches",
    revenge: "Seeks vengeance for past wrongs",
    protect_family: "Will do anything to protect their family",
    foreign_allegiance: "Secretly loyal to a foreign power",
    religious_dominance: "Wants to impose their faith",
    independence: "Dreams of breaking away",
    glory: "Craves personal glory and fame",
    none: "No hidden agenda",
  };
  return goalDescriptions[goal] || goal;
}

export function buildDecisionPrompt(
  territory: Doc<"territories">,
  relationships: RelationshipContext[],
  recentDecisions: Array<{ action: string; reasoning: string; tick: number }>,
  worldContext: WorldContext,
  otherTerritories: Array<{ name: string; resources: Doc<"territories"> }>,
  engagementContext?: EngagementContext,
  personalityParams?: PersonalityParams,
  organicGrowthContext?: OrganicGrowthContext,
  knowledgeContext?: KnowledgeContext
): string {
  const seasonNames = ["Early Winter", "Late Winter", "Early Spring", "Spring", "Late Spring", "Early Summer", "Summer", "Late Summer", "Early Autumn", "Autumn", "Late Autumn", "Winter"];
  const seasonDisplay = seasonNames[worldContext.month - 1];
  const year = worldContext.tick; // Each tick is a "moon" or month

  // Build survival section
  const survivalSection = buildSurvivalSection(territory, worldContext.month);

  // Build knowledge section (organic tech progression)
  const knowledgeSection = buildKnowledgeSection(knowledgeContext);

  // Get governance and identity info
  const tribeName = (territory as any).tribeName || "unnamed tribe";
  const governance = (territory as any).governance || "none";
  const leaderName = (territory as any).leaderName;
  const governmentName = (territory as any).governmentName;
  const languageNotes = (territory as any).languageNotes;
  const languageWords = (territory as any).languageWords as Array<{word: string; meaning: string; type?: string}> | undefined;
  const flag = (territory as any).flag;
  const traditions = (territory as any).traditions as Array<{name: string; description: string}> | undefined;
  const originStory = (territory as any).originStory;
  const beliefs = (territory as any).beliefs;
  const naturalResources = (territory as any).naturalResources as string[] | undefined;

  const governanceDisplay = governance === "none"
    ? "No formal government (tribal/informal)"
    : `${governmentName || governance}${leaderName ? ` - Leader: ${leaderName}` : ""}`;

  const prompt = `
# The Story So Far

**Time:** ${seasonDisplay}, Year ${Math.floor(year / 12) + 1} (Moon ${year})

You are guiding your small tribe. Everything you build, every word you create, every tradition you establish - it all starts with you.

## Your People: ${tribeName !== "unnamed tribe" ? `The ${tribeName}` : "Your Tribe (not yet named)"}

- **Population:** ${territory.population} people
- **Government:** ${governanceDisplay}
- **Food Stores:** ${territory.food.toFixed(0)}/100 (${territory.food < 20 ? "CRITICAL - people may starve!" : territory.food < 40 ? "Low - need to gather more" : territory.food > 70 ? "Abundant" : "Adequate"})
- **Shelter/Wealth:** ${territory.wealth.toFixed(0)}/100
- **Tools/Technology:** ${territory.technology.toFixed(0)}/100
- **Warriors:** ${territory.military.toFixed(0)}/100
- **Morale:** ${territory.happiness.toFixed(0)}/100
- **Cultural Identity:** ${territory.influence.toFixed(0)}/100
- **Wisdom/Knowledge:** ${territory.knowledge.toFixed(0)}/100
${naturalResources && naturalResources.length > 0 ? `- **Natural Resources:** ${naturalResources.join(", ")} (unique to your land!)` : ""}

${personalityParams ? buildPersonalitySection(personalityParams) : ""}

${organicGrowthContext ? buildOrganicGrowthSection(organicGrowthContext) : ""}

${tribeName !== "unnamed tribe" || languageWords?.length || flag || traditions?.length || beliefs ? `### Your Culture
${tribeName !== "unnamed tribe" ? `- **Name:** The ${tribeName}` : "- *Tribe not yet named*"}
${originStory ? `- **Origin:** ${originStory}` : ""}
${languageNotes ? `- **Language:** ${languageNotes}` : ""}
${languageWords && languageWords.length > 0 ? `- **Words we know:** ${languageWords.map(w => `"${w.word}" (${w.meaning})`).join(", ")}` : ""}
${flag ? `- **Flag/Symbol:** ${flag}` : ""}
${traditions && traditions.length > 0 ? `- **Traditions:** ${traditions.map(t => t.name).join(", ")}` : ""}
${beliefs ? `- **Beliefs:** ${beliefs}` : ""}
` : "*Your tribe has no established cultural identity yet. Consider naming your people and developing traditions!*"}

${survivalSection}

${buildEngagementSection(engagementContext)}

${knowledgeSection}

${buildCompetitionSection(territory, otherTerritories)}

## Other Tribes (What You Know)

${otherTerritories.map(t => {
  const isEliminated = (t.resources as any).isEliminated;
  if (isEliminated) {
    return `**The people of ${t.name}:** ELIMINATED - Their civilization has fallen.`;
  }
  return `**The people of ${t.name}:**
- About ${t.resources.population} people
- They seem ${t.resources.happiness > 60 ? "content" : t.resources.happiness > 40 ? "uncertain" : "troubled"}
- ${t.resources.military > territory.military ? "They appear stronger than us" : t.resources.military < territory.military ? "We are stronger than them" : "Similar strength to us"}
- Tech level: ${t.resources.technology} | Influence: ${t.resources.influence}`;
}).join("\n")}

## Relations with Other Tribes

${relationships.length > 0 ? relationships.map(r => {
  let statusInfo = r.status === "neutral" ? "Strangers" : r.status === "friendly" ? "Friendly" : r.status === "allied" ? "Close friends/allies (+10 military bonus each!)" : r.status === "tense" ? "Wary of each other" : r.status === "hostile" ? "Enemies" : r.status === "at_war" ? "AT WAR" : r.status;
  let extras = [];
  if (r.hasTradeAgreement) extras.push("Trading");
  if (r.hasAlliance) extras.push("Alliance (+military bonus)");
  // Note: pendingPeaceOffer info would need to be passed through - for now show war status
  return `**${r.territoryName}:**
- Feeling: ${getTrustDescription(r.trust)}
- Status: ${statusInfo}
${extras.length > 0 ? `- Agreements: ${extras.join(", ")}` : ""}`;
}).join("\n\n") : "You have not yet made contact with the other tribes."}

## Recent Events

${recentDecisions.length > 0 ? recentDecisions.map(d => `- Moon ${d.tick}: ${d.reasoning}`).join("\n") : "Your tribe has just formed. Everything begins now."}

# What Will You Do?

Available choices:

${AVAILABLE_ACTIONS.map(a => `**${a.name}** (${a.id})
${a.description}
→ ${a.effects}${(a as any).requiresTarget ? " [Must choose target: North America, Europe, Africa, Asia, South America, or Australia]" : ""}`).join("\n\n")}

# Your Response - SURVIVAL FIRST, THEN COMPETE!

## ⚠️ SURVIVAL IS NON-NEGOTIABLE - READ THIS FIRST!

**Before ANY other action, ask yourself these questions in order:**

1. **SHELTER CHECK:** Do ALL your people have shelter?
   - If NO → You MUST choose "build_houses" or people WILL DIE from exposure
   - People without shelter die at 5% per month in winter, 1-2% in spring/autumn

2. **FUEL CHECK:** Do you have enough wood for winter heating?
   - If NO and autumn/winter → You MUST choose "gather_wood" or people WILL FREEZE
   - Even sheltered people die without fire in winter

3. **FOOD CHECK:** Will your food last through winter?
   - If food < 30 → You MUST choose "gather_food" or people WILL STARVE
   - Winter foraging gives 50% less food - prepare in autumn!

**ONLY after survival needs are met should you consider:**
4. **COMPETITION** - How does this action help you WIN? Which victory path are you pursuing?
5. **YOUR PERSONALITY** - Make decisions that align with your strategic personality traits!
6. **THREATS & OPPORTUNITIES** - Who's ahead? Who can you ally with? Who must you stop?

**REMEMBER: Dead people can't win. A civilization reduced to 0 population is ELIMINATED.**

BE CREATIVE in your reasoning! Use words from your developing language. Reference your tribe's name, beliefs, or traditions. Tell the story of your people SURVIVING and then COMPETING for victory.

Respond with ONLY a JSON object:
{
  "action": "action_id",
  "target": "territory_name or null",
  "reasoning": "A narrative explanation from your tribe's perspective. Be creative! Explain how this helps you WIN!"
}`;

  return prompt;
}

function getTrustDescription(trust: number): string {
  if (trust >= 75) return "Deep bond, like family";
  if (trust >= 50) return "Strong friendship";
  if (trust >= 25) return "Friendly, warming to each other";
  if (trust >= 0) return "Neutral, cautious";
  if (trust >= -25) return "Suspicious, uneasy";
  if (trust >= -50) return "Distrustful, tense";
  if (trust >= -75) return "Hostile, dangerous";
  return "Enemies, hatred";
}

// Helper to describe personality trait level
function getPersonalityLevel(value: number): string {
  if (value >= 80) return "EXTREMELY HIGH";
  if (value >= 60) return "HIGH";
  if (value >= 40) return "MODERATE";
  if (value >= 20) return "LOW";
  return "VERY LOW";
}

// Build personality context section for AI prompt
function buildPersonalitySection(params: PersonalityParams): string {
  return `## YOUR EVOLVED PERSONALITY (Shaped by YOUR choices and experiences!)

**These traits have EMERGED from your civilization's history - they reflect WHO YOU'VE BECOME based on the decisions you've made and events you've experienced.**

### STRATEGIC MINDSET
| Trait | Level | What This Means For You |
|-------|-------|------------------------|
| **Aggression** | ${getPersonalityLevel(params.aggression)} (${params.aggression}) | ${params.aggression >= 60 ? "Prefer military solutions. Show strength." : params.aggression <= 40 ? "Seek peaceful solutions. War is last resort." : "Fight when necessary, peace when possible."} |
| **Risk Tolerance** | ${getPersonalityLevel(params.riskTolerance)} (${params.riskTolerance}) | ${params.riskTolerance >= 60 ? "Fortune favors the bold. Take big risks." : params.riskTolerance <= 40 ? "Steady progress. Avoid gambles." : "Calculated risks when worthwhile."} |
| **Cooperation** | ${getPersonalityLevel(params.cooperation)} (${params.cooperation}) | ${params.cooperation >= 60 ? "Build alliances! Everyone is a potential friend." : params.cooperation <= 40 ? "Trust no one. Self-reliance is strength." : "Alliances are tools, not dependencies."} |
| **Militarism** | ${getPersonalityLevel(params.militarism)} (${params.militarism}) | ${params.militarism >= 60 ? "Army is civilization's foundation. Build it!" : params.militarism <= 40 ? "Minimal military. Invest elsewhere." : "Balanced defense - not over, not under."} |
| **Expansionism** | ${getPersonalityLevel(params.expansionism)} (${params.expansionism}) | ${params.expansionism >= 60 ? "Grow! Claim your place in the world." : params.expansionism <= 40 ? "Quality over quantity. Small but strong." : "Steady growth without overextension."} |
| **Innovation** | ${getPersonalityLevel(params.innovation)} (${params.innovation}) | ${params.innovation >= 60 ? "Technology is power! Research everything." : params.innovation <= 40 ? "Practical tech only. No ivory towers." : "Strategic research, not research for its own sake."} |
| **Defensiveness** | ${getPersonalityLevel(params.defensiveness)} (${params.defensiveness}) | ${params.defensiveness >= 60 ? "Fortress mentality. Walls before swords." : params.defensiveness <= 40 ? "Offense is best defense. Strike first." : "Balanced posture - defend or attack as needed."} |
| **Opportunism** | ${getPersonalityLevel(params.opportunism)} (${params.opportunism}) | ${params.opportunism >= 60 ? "Seize every advantage! Hesitation is defeat." : params.opportunism <= 40 ? "Principled and predictable. Honor matters." : "Take opportunities that align with your values."} |

### HOW YOU GOVERN
| Trait | Level | Your Ruling Style |
|-------|-------|------------------|
| **Centralization** | ${getPersonalityLevel(params.centralization)} (${params.centralization}) | ${params.centralization >= 60 ? "All power flows from you. Central command." : params.centralization <= 40 ? "Distributed power. Local leaders decide locally." : "Balance central authority with local autonomy."} |
| **Authoritarianism** | ${getPersonalityLevel(params.authoritarianism)} (${params.authoritarianism}) | ${params.authoritarianism >= 60 ? "You decide. Your word is law." : params.authoritarianism <= 40 ? "Councils, consensus, democracy. Shared power." : "Listen to advisors but make final calls."} |
| **Paranoia** | ${getPersonalityLevel(params.paranoia)} (${params.paranoia}) | ${params.paranoia >= 60 ? "Trust no one. Spies everywhere. Purge plotters." : params.paranoia <= 40 ? "Trust your people. Loyalty assumed until proven otherwise." : "Watchful but not obsessive. Verify then trust."} |
| **Ruthlessness** | ${getPersonalityLevel(params.ruthlessness)} (${params.ruthlessness}) | ${params.ruthlessness >= 60 ? "Make examples of enemies. Mercy is weakness." : params.ruthlessness <= 40 ? "Merciful ruler. Forgiveness builds loyalty." : "Firm but fair. Punishment fits the crime."} |
| **Patience** | ${getPersonalityLevel(params.patience)} (${params.patience}) | ${params.patience >= 60 ? "Think in generations. Plant trees you won't sit under." : params.patience <= 40 ? "Act now! Short-term gains matter." : "Balance immediate needs with long-term vision."} |
| **Pragmatism** | ${getPersonalityLevel(params.pragmatism)} (${params.pragmatism}) | ${params.pragmatism >= 60 ? "Results matter, not methods. Ends justify means." : params.pragmatism <= 40 ? "Principles first. Some things are never acceptable." : "Flexible on methods, firm on core values."} |

### YOUR ECONOMIC PHILOSOPHY
| Trait | Level | How You Manage Resources |
|-------|-------|-------------------------|
| **Taxation** | ${getPersonalityLevel(params.taxation)} (${params.taxation}) | ${params.taxation >= 60 ? "Heavy taxes. The state needs resources to function." : params.taxation <= 40 ? "Light taxes. Let people keep their earnings." : "Fair taxation. Take what's needed, no more."} |
| **Frugality** | ${getPersonalityLevel(params.frugality)} (${params.frugality}) | ${params.frugality >= 60 ? "Save everything. Stockpile for hard times." : params.frugality <= 40 ? "Spend freely. Investment drives growth." : "Balanced budgets. Save some, spend some."} |
| **Mercantilism** | ${getPersonalityLevel(params.mercantilism)} (${params.mercantilism}) | ${params.mercantilism >= 60 ? "Hoard resources. Protect domestic production." : params.mercantilism <= 40 ? "Free trade! Open markets benefit everyone." : "Strategic trade. Protect key industries only."} |

### YOUR CULTURAL VALUES
| Trait | Level | What Your Society Believes |
|-------|-------|---------------------------|
| **Religiosity** | ${getPersonalityLevel(params.religiosity)} (${params.religiosity}) | ${params.religiosity >= 60 ? "Faith guides governance. The gods/spirits matter." : params.religiosity <= 40 ? "Secular rule. Reason over superstition." : "Respect traditions but govern practically."} |
| **Traditionalism** | ${getPersonalityLevel(params.traditionalism)} (${params.traditionalism}) | ${params.traditionalism >= 60 ? "The old ways work. Honor ancestors." : params.traditionalism <= 40 ? "Embrace change! Progress requires new ideas." : "Respect traditions but adapt when needed."} |
| **Xenophobia** | ${getPersonalityLevel(params.xenophobia)} (${params.xenophobia}) | ${params.xenophobia >= 60 ? "Outsiders are threats. Your people first!" : params.xenophobia <= 40 ? "Welcome strangers. Diversity is strength." : "Cautious with outsiders but not hostile."} |

---
**EVERY DECISION YOU MAKE SHOULD REFLECT THESE VALUES!**
- ${params.aggression >= 60 ? "When threatened, your instinct is to FIGHT." : params.aggression <= 40 ? "When threatened, your instinct is to NEGOTIATE." : "You assess threats carefully before responding."}
- ${params.cooperation >= 60 ? "You actively seek ALLIANCES and TRADE DEALS." : params.cooperation <= 40 ? "You prefer INDEPENDENCE and SELF-SUFFICIENCY." : "You form partnerships when mutually beneficial."}
- ${params.ruthlessness >= 60 ? "Your enemies should FEAR you." : params.ruthlessness <= 40 ? "Even enemies can become friends through MERCY." : "Justice is firm but not cruel."}
- ${params.patience >= 60 ? "You play the LONG GAME." : params.patience <= 40 ? "You seize IMMEDIATE opportunities." : "You balance short and long-term thinking."}`;
}

// Build competition status section showing victory progress
function buildCompetitionSection(
  territory: Doc<"territories">,
  otherTerritories: Array<{ name: string; resources: Doc<"territories"> }>
): string {
  // Calculate active territories (not eliminated)
  const activeTerritories = [territory, ...otherTerritories.map(o => o.resources)].filter(
    t => !(t as any).isEliminated
  );
  const totalPop = activeTerritories.reduce((sum, t) => sum + t.population, 0);
  const yourPopPercent = totalPop > 0 ? Math.round((territory.population / totalPop) * 100) : 0;

  // Victory progress percentages
  const dominationProgress = Math.min(100, Math.round((yourPopPercent / 60) * 100));
  const culturalProgress = Math.min(100, Math.round((territory.influence / 200) * 100));
  const scientificProgress = Math.min(100, Math.round((territory.technology / 150) * 100));

  // Find the leader in each category
  const popLeader = activeTerritories.reduce((max, t) => t.population > max.population ? t : max);
  const influenceLeader = activeTerritories.reduce((max, t) => t.influence > max.influence ? t : max);
  const techLeader = activeTerritories.reduce((max, t) => t.technology > max.technology ? t : max);

  // Build alert messages
  const alerts: string[] = [];
  if (yourPopPercent >= 40) alerts.push("**CLOSE TO DOMINATION!** Push for 60% population!");
  if (territory.influence >= 150) alerts.push("**CLOSE TO CULTURAL VICTORY!** Build more influence!");
  if (territory.technology >= 100) alerts.push("**CLOSE TO SCIENTIFIC VICTORY!** Keep researching!");
  if (territory.population < 10) alerts.push("**WARNING: LOW POPULATION!** If you fall below 5 for 12 months, you'll be ELIMINATED!");

  const eliminatedCount = [territory, ...otherTerritories.map(o => o.resources)].filter(
    t => (t as any).isEliminated
  ).length;

  return `## COMPETITION STATUS - THIS IS A RACE TO WIN!

**VICTORY CONDITIONS:**
- **Domination**: Control 60%+ of world population (You: ${yourPopPercent}%, need 60%) [${dominationProgress}%]
- **Cultural**: Reach 200+ Influence (You: ${Math.round(territory.influence)}/200) [${culturalProgress}%]
- **Scientific**: Reach 150+ Technology (You: ${Math.round(territory.technology)}/150) [${scientificProgress}%]
- **Elimination**: Be the last civilization standing

**Current Standings:**
- Population Leader: ${(popLeader as any).tribeName || popLeader.name} (${popLeader.population})${popLeader._id === territory._id ? " (YOU!)" : ""}
- Influence Leader: ${(influenceLeader as any).tribeName || influenceLeader.name} (${Math.round(influenceLeader.influence)})${influenceLeader._id === territory._id ? " (YOU!)" : ""}
- Technology Leader: ${(techLeader as any).tribeName || techLeader.name} (${Math.round(techLeader.technology)})${techLeader._id === territory._id ? " (YOU!)" : ""}

**Active Civilizations:** ${activeTerritories.length}${eliminatedCount > 0 ? ` (${eliminatedCount} eliminated)` : ""}

${alerts.length > 0 ? alerts.join("\n") : ""}`;
}

// =============================================
// ORGANIC AI GROWTH - BUILD CONTEXT SECTIONS
// =============================================

function buildOrganicGrowthSection(context: OrganicGrowthContext): string {
  const sections: string[] = [];

  // === MEMORIES SECTION ===
  if (context.memories && context.memories.memories.length > 0) {
    sections.push(`## 🧠 YOUR MEMORIES
Recent significant events that shape your worldview:

${context.memories.formattedMemories}

*These memories influence how you view other civilizations. Reference them in your decisions!*`);
  }

  // === BONDS SECTION ===
  if (context.bonds) {
    const hasGrudges = context.bonds.grudges !== "No active grudges.";
    const hasGratitude = context.bonds.gratitude !== "No debts of gratitude.";

    if (hasGrudges || hasGratitude) {
      let bondsSection = `## 💔 YOUR BONDS WITH OTHER CIVILIZATIONS

`;
      if (hasGrudges) {
        bondsSection += `**GRUDGES (unresolved grievances):**
${context.bonds.grudges}

`;
      }

      if (hasGratitude) {
        bondsSection += `**GRATITUDE (debts of honor):**
${context.bonds.gratitude}

`;
      }

      bondsSection += `*These bonds persist across generations. Grudges demand action; gratitude demands loyalty.*`;
      sections.push(bondsSection);
    }
  }

  // === GOALS SECTION ===
  if (context.goals && context.goals.length > 0) {
    const activeGoals = context.goals.filter(g => (g as any).status === "active" || !("status" in g));

    if (activeGoals.length > 0) {
      let goalsSection = `## 🎯 YOUR CURRENT GOALS
What drives you beyond mere survival:

`;
      // Sort by priority
      activeGoals.sort((a, b) => b.priority - a.priority);

      for (let i = 0; i < Math.min(activeGoals.length, 5); i++) {
        const goal = activeGoals[i];
        const goalName = goal.goalType.replace(/_/g, " ").toUpperCase();
        const progressBar = generateProgressBar(goal.progress);

        goalsSection += `${i + 1}. **${goalName}** (Priority: ${goal.priority})
`;
        if (goal.targetDescription) {
          goalsSection += `   Target: ${goal.targetDescription}
`;
        }
        goalsSection += `   Progress: ${progressBar} ${goal.progress.toFixed(0)}%
   "${goal.originReason}"

`;
      }

      goalsSection += `*These goals drive your long-term strategy. Pursue them relentlessly!*`;
      sections.push(goalsSection);
    }
  }

  return sections.length > 0 ? sections.join("\n\n") : "";
}

function generateProgressBar(progress: number): string {
  const filled = Math.round(progress / 10);
  const empty = 10 - filled;
  return "[" + "█".repeat(filled) + "░".repeat(empty) + "]";
}
