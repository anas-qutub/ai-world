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
  // Mental Health (NEW - for madness-affected decisions)
  mentalHealth?: {
    sanity: number;
    trauma: number;
    depression: number;
    anxiety: number;
    ptsd: boolean;
    madness?: "paranoid" | "megalomaniac" | "violent" | "delusional" | "depressive" | "manic";
    inTherapy: boolean;
  };
  // Addiction (NEW - affects decision-making)
  addiction?: {
    type: "alcohol" | "gambling" | "opium" | "other";
    severity: "mild" | "moderate" | "severe" | "crippling";
  };
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

// Espionage Intelligence Context - for spy-informed military decisions
export interface EspionageContext {
  activeSpies: number;
  capturedSpies: number;
  counterIntelligence: number;
  intelligence: Array<{
    targetTerritoryName: string;
    intelType: string;
    info: string;
    tickGathered: number;
    reliability: "low" | "medium" | "high";
  }>;
  knownEnemySpies: number;
  // Education sabotage opportunities
  sabotageTargets?: Array<{
    territoryName: string;
    hasLibrary: boolean;
    hasUniversity: boolean;
    hasSchools: number;
    scholarCount: number;
    educationVulnerability: number;  // 0-100, higher = easier to sabotage
    hasSpy: boolean;  // Do we have a spy there?
  }>;
}

// Sabotage Motivation Context - why would we sabotage?
export interface SabotageMotiveContext {
  pressure: number;  // 0-100, how motivated we are to sabotage
  topMotives: Array<{
    reason: string;
    intensity: number;  // 0-100
  }>;
  suggestedTargets: Array<{
    name: string;
    pressure: number;
    reason: string;
    suggestions: string[];
  }>;
}

// Religion Context - faith influences how rulers think and decide
export interface ReligionContext {
  stateReligion?: {
    name: string;
    deity: string;
    beliefs: string[];
    practices: string[];
    tolerance: number;
  };
  rulerPiety: number;
  templeCount: number;
  priestCount: number;
  averagePopulationPiety: number;
}

// Weather Context - current conditions affecting decisions
export interface WeatherContext {
  currentWeather: string;
  temperature: number;
  isExtreme: boolean;
  farmingModifier: number;
  militaryModifier: number;
  travelModifier: number;
  moodModifier: number;
  expectedDuration: number; // ticks until change
}

// Disaster Context - active disasters and recovery
export interface DisasterContext {
  activeDisasters: Array<{
    type: string;
    severity: string;
    casualties: number;
    buildingsDestroyed: number;
    recoveryProgress: number;
  }>;
  recentDisasters: Array<{
    type: string;
    tick: number;
  }>;
  disasterRisk: number; // 0-100
}

// Infrastructure Context - built structures and their effects
export interface InfrastructureContext {
  infrastructure: Array<{
    type: string;
    level: number;
    condition: number;
    isUnderConstruction: boolean;
    constructionProgress?: number;
    connectsTo?: string;
  }>;
  totalBonuses: {
    tradeBonus: number;
    defenseBonus: number;
    travelSpeed: number;
    waterAccess: number;
  };
}

// Marriage & Dynasty Context - succession and alliances
export interface DynastyContext {
  currentDynasty?: {
    name: string;
    generations: number;
    prestige: number;
    inheritanceRule: string;
  };
  successionStatus: {
    hasHeir: boolean;
    heirName?: string;
    heirAge?: number;
    successionRisk: number; // 0-100, risk of crisis
    rivalClaimants: number;
  };
  marriageOpportunities: Array<{
    characterName: string;
    targetTerritory: string;
    allianceValue: number;
    politicalBenefit: string;
  }>;
  activeMarriages: number;
  politicalAlliances: number; // via marriage
}

// Romance Context - love affairs and their consequences
export interface RomanceContext {
  activeRomances: Array<{
    person1: string;
    person2: string;
    type: string; // courtship, romance, affair
    isSecret: boolean;
    isAdulterous: boolean;
    scandalRisk: number;
  }>;
  eligibleBachelors: number;
  eligibleMaidens: number;
  recentScandals: string[];
}

// Friendship Context - character bonds
export interface FriendshipContext {
  notableFriendships: Array<{
    character1: string;
    character2: string;
    type: string; // friend, close_friend, best_friend, sworn_brother
    sharedExperiences: string[];
  }>;
  swornBrotherhoodsCount: number;
  isolatedCharacters: string[]; // characters with no friends
}

// Mental Health Context - psychological state of characters
export interface MentalHealthContext {
  troubledCharacters: Array<{
    name: string;
    role: string;
    issues: {
      sanity: number;
      trauma: number;
      depression: number;
      hasPTSD: boolean;
      madnessType?: string;
    };
    needsTreatment: boolean;
  }>;
  hasHealingSanctuary: boolean;
  averageMorale: number;
  recentTraumas: string[];
}

// Addiction Context - substance abuse problems
export interface AddictionContext {
  addictedCharacters: Array<{
    name: string;
    role: string;
    addictionType: string;
    severity: string;
    functionalityImpact: number;
    wealthDrain: number;
  }>;
  substancesAvailable: string[];
  hasProhibition: boolean;
}

// War Demographics Context - who can fight
export interface WarDemographicsContext {
  fightingPopulation: {
    eligibleMen: number;
    currentSoldiers: number;
    reserves: number;
    percentageOfPopulation: number;
  };
  warCasualties: {
    recentDeaths: number;
    widows: number;
    orphans: number;
    disabledVeterans: number;
  };
  manpowerStatus: string; // "abundant", "adequate", "strained", "critical"
  canConscriptMore: boolean;
}

// Gender Dynamics Context - social roles
export interface GenderContext {
  currentRoles: {
    womenCanWork: boolean;
    womenCanOwn: boolean;
    womenCanRule: boolean;
    womenCanFight: boolean;
    progressLevel: number; // 0-100
  };
  workforceImpact: {
    currentLaborPool: number;
    potentialIfProgressive: number;
    restrictionCost: number; // lost productivity
  };
  socialTension: number; // 0-100, tension from gender issues
}

// Expedition Context - exploration status
export interface ExpeditionContext {
  activeExpeditions: Array<{
    direction: string;
    leaderName?: string;
    explorerCount: number;
    soldierCount: number;
    status: string;
    daysUntilReturn: number;
    discoveries: string[];
  }>;
  unexploredDirections: string[];
  totalDiscoveries: number;
}

// Trade Context - economic activity
export interface TradeContext {
  activeTradeRoutes: Array<{
    partnerTerritory: string;
    goods: string;
    profitability: number;
    isActive: boolean;
  }>;
  caravans: {
    inTransit: number;
    recentArrivals: number;
    recentRaids: number;
  };
  marketPrices: {
    food: number;
    goods: number;
    luxuries: number;
    trend: string; // "rising", "stable", "falling"
  };
}

// Disease Context - health crises
export interface DiseaseContext {
  activeOutbreaks: Array<{
    diseaseName: string;
    severity: string;
    infected: number;
    deaths: number;
    spreadRate: number;
  }>;
  diseaseRisk: {
    level: number; // 0-100
    factors: string[];
  };
  quarantineActive: boolean;
  healerCount: number;
}

// Rebellion Context - internal unrest
export interface RebellionContext {
  factionUnrest: Array<{
    factionName: string;
    unrestLevel: number;
    demands: string[];
    willingness_to_revolt: number;
  }>;
  activeRebellions: Array<{
    factionName: string;
    strength: number;
    controlledAreas: string[];
  }>;
  overallStability: number; // 0-100
  recentGrievances: string[];
}

// Ruler Legitimacy Context - political support
export interface LegitimacyContext {
  ruler: {
    name: string;
    legitimacyScore: number; // 0-100
    popularSupport: number;
    nobleSupport: number;
    militarySupport: number;
  };
  legitimacySources: string[]; // "birthright", "conquest", "election", etc.
  threats: string[]; // "rival claimant", "foreign backed", etc.
  overthrowRisk: number; // 0-100
  recentActions: {
    positive: string[];
    negative: string[];
  };
}

// Economy Context - treasury, taxes, and economic health
export interface EconomyContext {
  treasury: {
    goldCoins: number;
    silverCoins: number;
    copperCoins: number;
    totalWealth: number; // Normalized value
    totalDebt: number;
    creditRating: number; // 0-100
    inflationRate: number; // Percentage
    debasementLevel: number; // 0-100 (currency devaluation)
    economicPhase: "barter" | "commodity" | "coined" | "banking" | "paper" | "modern";
    lastMonthBalance: number; // Income - Expenses
  };
  taxes: {
    landTaxRate: number;
    tradeTaxRate: number;
    pollTaxRate: number;
    luxuryTaxRate: number;
    collectionEfficiency: number;
    taxEvaders: number; // Percentage evading
    happinessImpact: number; // How taxes affect mood
  };
  laborMarket: {
    unskilledWage: number;
    skilledWage: number;
    unemployment: number; // Percentage
    workConditions: "harsh" | "poor" | "fair" | "good" | "excellent";
  };
  activeLoans: Array<{
    lenderType: "merchant" | "noble" | "temple" | "foreign" | "bank";
    amount: number;
    interestRate: number;
    monthsRemaining: number;
  }>;
  economicHealth: "collapsing" | "struggling" | "stable" | "growing" | "booming";
  bankCount: number;
  priceControls: string[]; // Active price controls
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

  // === WATER & SANITATION ===
  {
    id: "dig_well",
    name: "Dig a Well",
    description: "Dig a well to provide reliable water supply. CRITICAL for survival - people die in days without water!",
    effects: "+1 Well (provides 50 water/tick), -10 Wood, -5 Wealth. Water is life!",
  },
  {
    id: "build_latrine",
    name: "Build Latrine",
    description: "Build latrines to improve sanitation and prevent disease",
    effects: "+1 Latrine (handles 10 waste), -5 Wood. Poor sanitation spreads disease!",
  },
  {
    id: "build_sewer",
    name: "Build Sewer System",
    description: "Construct advanced sewer system for large population",
    effects: "+100 Waste Capacity, -15 Wood, -20 Wealth. Major sanitation improvement!",
  },

  // === CLOTHING & PROTECTION ===
  {
    id: "make_clothing",
    name: "Make Clothing",
    description: "Craft clothing to protect from cold. Proper clothing reduces exposure deaths by 70%!",
    effects: "+10 Clothing, -3 Wealth. Essential for winter survival!",
  },

  // === FOOD PRESERVATION ===
  {
    id: "build_smokehouse",
    name: "Build Smokehouse",
    description: "Build a smokehouse to preserve meat and fish for winter",
    effects: "+1 Smokehouse (preserves 50 food), -20 Wood. Preserved food lasts 10x longer!",
  },
  {
    id: "gather_salt",
    name: "Gather Salt",
    description: "Collect salt for preserving food. Coastal areas yield more salt.",
    effects: "+5-10 Salt. Salt preserves food and prevents spoilage.",
  },

  // === MEDICINE & HEALING ===
  {
    id: "gather_herbs",
    name: "Gather Medicinal Herbs",
    description: "Collect healing herbs from the wilderness. More available in spring/summer.",
    effects: "+10-15 Herbs (varies by season). Herbs cure sick population!",
  },
  {
    id: "train_healer",
    name: "Train Healer",
    description: "Train someone in the healing arts to treat the sick",
    effects: "Creates healer character. Healers add +30% healing success!",
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
  // GUT FEELING - INSTINCT-BASED DECISIONS
  // =============================================
  // These are ruler decisions based on intuition about what their people need
  {
    id: "harden_people",
    name: "Harden the People",
    description: "If you feel your people are soft or weak, institute rigorous training and conditioning programs. Mandatory physical training, endurance challenges, and survival exercises for all.",
    effects: "-15 Happiness (harsh training), -10 Wealth (resources), +10 Military potential over time, +stronger workforce. Population becomes more resilient to hardship.",
  },
  {
    id: "strengthen_bloodline",
    name: "Strengthen the Bloodline",
    description: "If you feel training won't fix weakness, focus on the next generation. The ruler should sire many children with the strongest, healthiest partners to create a more capable ruling line.",
    effects: "Ruler has multiple children. +population growth. Children inherit stronger traits. May cause marriage/romance complications. Costs wealth (supporting children).",
  },
  {
    id: "spartan_upbringing",
    name: "Spartan Youth Program",
    description: "Raise children from young age with harsh discipline, physical training, and military education to create a warrior generation.",
    effects: "-20 Happiness, +children with high courage/strength traits. Takes years to see results. Creates loyal, capable warriors.",
  },
  {
    id: "selective_marriages",
    name: "Arrange Strategic Marriages",
    description: "If you believe your bloodline needs strengthening, arrange marriages with the strongest, wisest, or most capable families.",
    effects: "Children gain better trait potential. May improve or damage relations with marriage families. Costs dowries.",
  },
  {
    id: "cull_the_weak",
    name: "Cull the Weak (Ruthless)",
    description: "A dark choice: exile or abandon those who cannot contribute. Reduces burden on resources but damages morale and your legacy.",
    effects: "-Population (weak/elderly), +Food surplus, -30 Happiness, -20 Honor. Your people will remember this cruelty.",
  },
  {
    id: "trust_instincts",
    name: "Follow Your Gut",
    description: "Make a decision purely based on instinct without rational analysis. Sometimes rulers just KNOW what their people need.",
    effects: "Effect varies. Describe in reasoning what your gut tells you to do. The simulation will interpret your instinct.",
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
  // MILITARY EDUCATION TARGETING (During War)
  // =============================================
  {
    id: "raze_enemy_library",
    name: "Raze Enemy Library (Warfare)",
    description: "During war, specifically target and destroy the enemy's library. Destroy their accumulated knowledge forever.",
    effects: "Library burned, -30 knowledge. Creates lasting hatred. Only usable during war.",
    requiresTarget: true,
  },
  {
    id: "capture_enemy_scholars",
    name: "Capture Enemy Scholars (Warfare)",
    description: "During war, capture enemy scholars and bring them back as prisoners to work for you.",
    effects: "Remove 1-3 scholars from enemy, they become YOUR scholars. +10 knowledge for you.",
    requiresTarget: true,
  },
  {
    id: "loot_scrolls_and_texts",
    name: "Loot Scrolls and Texts (Warfare)",
    description: "After victory, systematically loot all valuable texts and scrolls from the defeated territory.",
    effects: "Enemy loses -15 knowledge, YOU gain +10 knowledge. Requires military victory.",
    requiresTarget: true,
  },
  {
    id: "execute_enemy_teachers",
    name: "Execute Enemy Teachers (Warfare - Brutal)",
    description: "Brutally execute enemy teachers and scholars to cripple their education permanently. A war crime that will be remembered.",
    effects: "Kill all educators. -40 knowledge, -30 happiness for enemy. YOU suffer -20 influence (atrocity). Creates blood feud.",
    requiresTarget: true,
  },
  {
    id: "burn_enemy_schools",
    name: "Burn Enemy Schools (Warfare)",
    description: "During war, burn down enemy schools to deny them future skilled workers.",
    effects: "All schools destroyed. Children have nowhere to learn. Long-term civilizational damage.",
    requiresTarget: true,
  },
  {
    id: "demand_scholars_as_tribute",
    name: "Demand Scholars as Tribute (Diplomacy)",
    description: "Demand that a weaker civilization send you their best scholars as tribute.",
    effects: "If they comply, gain 2-3 scholars and +8 knowledge. They lose expertise. May refuse if proud.",
    requiresTarget: true,
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
  // EDUCATION & KNOWLEDGE TRANSFER
  // New generations can learn from schools/libraries instead of
  // rediscovering everything through crisis and experience!
  // =============================================
  {
    id: "establish_school",
    name: "Establish School",
    description: "Build a school to educate children and young adults. Schools teach literacy, mathematics, and practical skills.",
    effects: "Creates school. Children learn skills 3x faster than trial-and-error. Requires 2+ teachers, costs 20 wealth, 15 wood. New generation gains knowledge!",
  },
  {
    id: "build_library",
    name: "Build Library",
    description: "Construct a library to store and preserve knowledge. Literate people can study here to improve skills.",
    effects: "Creates library. Stores collective knowledge. Scholars can self-study up to skill level 60. Costs 30 wealth, 20 wood. Requires scribes.",
  },
  {
    id: "establish_university",
    name: "Establish University",
    description: "Found a university for advanced learning. Produces scholars, engineers, and physicians.",
    effects: "Creates university. Advanced education up to skill 75. Requires existing schools, 50+ wealth, high literacy. Breakthrough chance +25%!",
  },
  {
    id: "assign_apprentice",
    name: "Assign Apprentice",
    description: "Have a master craftsman train a young person in their trade. Apprentices learn faster than schools!",
    effects: "Apprentice learns master's skills. Can reach 90% of master's level. Costs 5 wealth. Specify master's profession in reasoning.",
  },
  {
    id: "hire_teacher",
    name: "Hire Teacher",
    description: "Recruit an educated person to teach at a school or privately tutor children.",
    effects: "Teacher teaches 10-20 students. Students gain +1 skill/tick in taught subjects. Teacher needs literacy 50+.",
  },
  {
    id: "sponsor_scholar",
    name: "Sponsor Scholar",
    description: "Provide wealth and resources for a scholar to dedicate themselves to learning and research.",
    effects: "Scholar studies full-time. +5 knowledge/tick. Can discover new technologies. Costs 10 wealth/tick.",
  },
  {
    id: "copy_scrolls",
    name: "Copy Ancient Scrolls",
    description: "Have scribes copy important texts to preserve and spread knowledge.",
    effects: "+10 to library scrolls. Knowledge becomes harder to lose. Requires scribes with literacy 40+.",
  },
  {
    id: "establish_trade_school",
    name: "Establish Trade School",
    description: "Build a school focused on practical skills: smithing, carpentry, masonry, tailoring.",
    effects: "Creates trade school. Workers learn crafts 2x faster. Essential for building skilled workforce!",
  },

  // =============================================
  // EDUCATION SABOTAGE & COVERT DISRUPTION
  // Sneaky ways to cripple rival civilizations' knowledge systems
  // =============================================
  {
    id: "burn_enemy_library",
    name: "Burn Enemy Library (Espionage)",
    description: "Send agents to burn down a rival's library, destroying generations of accumulated knowledge.",
    effects: "Target loses 25 knowledge, library destroyed. High risk of detection (40%) and war (30%). Requires spy.",
    requiresTarget: true,
  },
  {
    id: "sabotage_enemy_school",
    name: "Sabotage Enemy School (Espionage)",
    description: "Damage a rival's school to disrupt their education for months.",
    effects: "Target school quality -30%, students scattered. Moderate detection risk (30%).",
    requiresTarget: true,
  },
  {
    id: "assassinate_enemy_scholar",
    name: "Assassinate Enemy Scholar (Espionage)",
    description: "Eliminate a key scholar, erasing irreplaceable expertise from their civilization.",
    effects: "Kill 1 scholar/teacher, -15 knowledge. High detection (50%) and war risk (40%).",
    requiresTarget: true,
  },
  {
    id: "steal_enemy_scrolls",
    name: "Steal Enemy Scrolls (Espionage)",
    description: "Steal valuable texts and bring them back to enrich your own knowledge.",
    effects: "Target loses 10 knowledge, YOU gain +5 knowledge. Moderate risk.",
    requiresTarget: true,
  },
  {
    id: "spread_misinformation",
    name: "Spread Misinformation (Espionage)",
    description: "Introduce false knowledge that will corrupt their teachings and set back their progress.",
    effects: "Target's knowledge slowly degrades, school quality drops. Low detection (20%). Subtle but effective.",
    requiresTarget: true,
  },
  {
    id: "poison_enemy_teachers",
    name: "Poison Enemy Teachers (Espionage)",
    description: "Poison teachers to incapacitate or kill their educators.",
    effects: "1-3 teachers incapacitated/killed, -12 knowledge. High detection (45%) and war risk (35%).",
    requiresTarget: true,
  },
  {
    id: "bribe_scholar_to_defect",
    name: "Bribe Scholar to Defect (Espionage)",
    description: "Offer wealth and status to lure a rival's best scholar to join your civilization.",
    effects: "If successful, gain a scholar and +8 knowledge. Target loses expertise. Costs 20 wealth.",
    requiresTarget: true,
  },
  {
    id: "destroy_enemy_university",
    name: "Destroy Enemy University (Espionage)",
    description: "Major operation to destroy a rival's university, crippling advanced learning for years.",
    effects: "University destroyed, -40 knowledge, -30 happiness. Very high risk. Near-certain war if caught.",
    requiresTarget: true,
  },
  {
    id: "kidnap_enemy_apprentices",
    name: "Kidnap Enemy Apprentices (Espionage)",
    description: "Abduct promising young apprentices to work for your civilization instead.",
    effects: "Remove 1-3 apprentices from target. -5 knowledge, -20 happiness for target.",
    requiresTarget: true,
  },
  {
    id: "incite_student_riot",
    name: "Incite Student Riot (Espionage)",
    description: "Secretly encourage students to riot against their teachers and institutions.",
    effects: "Target's happiness -10, schools temporarily disrupted. Low-moderate risk.",
    requiresTarget: true,
  },
  {
    id: "corrupt_enemy_curriculum",
    name: "Corrupt Enemy Curriculum (Espionage)",
    description: "Subtly alter their teachings to include flawed methods and false information.",
    effects: "Gradual knowledge decay, -12 knowledge. Very low detection (15%). Long-term damage.",
    requiresTarget: true,
  },
  {
    id: "infiltrate_enemy_academy",
    name: "Infiltrate Enemy Academy (Espionage)",
    description: "Plant a long-term agent in their academy for continuous disruption and intelligence.",
    effects: "Ongoing slow knowledge drain. Agent provides intel. High initial difficulty but low ongoing risk.",
    requiresTarget: true,
  },

  // =============================================
  // ECONOMIC SABOTAGE
  // =============================================
  {
    id: "poison_enemy_crops",
    name: "Poison Enemy Crops (Sabotage)",
    description: "Introduce crop disease or salt their fields to ruin harvests for seasons.",
    effects: "-25 food, -10 happiness. 30% detection, 25% war risk.",
    requiresTarget: true,
  },
  {
    id: "contaminate_enemy_water",
    name: "Contaminate Water Supply (Sabotage)",
    description: "Poison wells and rivers causing widespread sickness.",
    effects: "-20 happiness, -5 population. Disease outbreak. 40% detection, 40% war risk.",
    requiresTarget: true,
  },
  {
    id: "counterfeit_currency",
    name: "Counterfeit Currency (Sabotage)",
    description: "Flood their markets with fake coins causing economic chaos.",
    effects: "-20 wealth, -10 happiness. Inflation. Requires spy. 35% detection.",
    requiresTarget: true,
  },
  {
    id: "burn_enemy_granaries",
    name: "Burn Enemy Granaries (Sabotage)",
    description: "Set fire to their food storage facilities.",
    effects: "-30 food, -15 happiness. 50% detection, 35% war risk.",
    requiresTarget: true,
  },
  {
    id: "sabotage_enemy_mines",
    name: "Sabotage Enemy Mines (Sabotage)",
    description: "Collapse or flood their mining operations.",
    effects: "-15 wealth, -3 population. 40% detection, 30% war risk.",
    requiresTarget: true,
  },
  {
    id: "burn_enemy_market",
    name: "Burn Enemy Market (Sabotage)",
    description: "Burn down marketplaces and trade infrastructure.",
    effects: "-20 wealth, -10 happiness. 45% detection, 30% war risk.",
    requiresTarget: true,
  },
  {
    id: "introduce_pests",
    name: "Introduce Pests (Sabotage)",
    description: "Release locusts, rats, or other pests to destroy crops.",
    effects: "-20 food. Low detection (20%), low war risk (15%). Subtle but effective.",
    requiresTarget: true,
  },
  {
    id: "bribe_enemy_merchants",
    name: "Bribe Enemy Merchants (Sabotage)",
    description: "Pay merchants to overcharge and exploit their population.",
    effects: "-10 wealth, -15 happiness. Requires spy. 25% detection.",
    requiresTarget: true,
  },
  {
    id: "steal_trade_secrets",
    name: "Steal Trade Secrets (Sabotage)",
    description: "Copy their production methods and trade knowledge.",
    effects: "Target -5 technology, YOU gain +5 knowledge, +3 tech. Requires spy.",
    requiresTarget: true,
  },
  {
    id: "disrupt_enemy_caravans",
    name: "Disrupt Enemy Caravans (Sabotage)",
    description: "Attack or misdirect trade caravans.",
    effects: "-15 wealth. 40% detection, 20% war risk.",
    requiresTarget: true,
  },

  // =============================================
  // MILITARY SABOTAGE
  // =============================================
  {
    id: "poison_army_supplies",
    name: "Poison Army Supplies (Sabotage)",
    description: "Contaminate military food and water supplies.",
    effects: "-20 military. Army sickness. Requires spy. 45% detection, 50% war risk.",
    requiresTarget: true,
  },
  {
    id: "sabotage_enemy_weapons",
    name: "Sabotage Enemy Weapons (Sabotage)",
    description: "Weaken swords, dull blades, damage bows before battle.",
    effects: "-15 military. Weapon quality drops. Requires spy. 35% detection.",
    requiresTarget: true,
  },
  {
    id: "steal_battle_plans",
    name: "Steal Battle Plans (Sabotage)",
    description: "Copy their military strategies and troop positions.",
    effects: "YOU gain military advantage. Requires spy. 40% detection.",
    requiresTarget: true,
  },
  {
    id: "assassinate_enemy_general",
    name: "Assassinate Enemy General (Sabotage)",
    description: "Kill their top military commander.",
    effects: "-25 military. Army disorganized. Requires spy. 55% detection, 60% war risk.",
    requiresTarget: true,
  },
  {
    id: "incite_desertion",
    name: "Incite Desertion (Sabotage)",
    description: "Spread fear and encourage soldiers to flee.",
    effects: "-15 military. Mass desertion. Requires spy. 30% detection.",
    requiresTarget: true,
  },
  {
    id: "spread_camp_disease",
    name: "Spread Camp Disease (Sabotage)",
    description: "Introduce plague into their military camps.",
    effects: "-30 military, -5 population. Devastating. Requires spy. 35% detection, 45% war risk.",
    requiresTarget: true,
  },
  {
    id: "sabotage_enemy_fortifications",
    name: "Sabotage Enemy Fortifications (Sabotage)",
    description: "Secretly weaken walls and defenses before siege.",
    effects: "-10 military. Walls weakened. Requires spy. 40% detection.",
    requiresTarget: true,
  },
  {
    id: "burn_enemy_armory",
    name: "Burn Enemy Armory (Sabotage)",
    description: "Destroy weapon and armor storage.",
    effects: "-20 military. Can't equip new soldiers. 50% detection, 40% war risk.",
    requiresTarget: true,
  },
  {
    id: "disable_siege_equipment",
    name: "Disable Siege Equipment (Sabotage)",
    description: "Break catapults, battering rams, siege towers.",
    effects: "-10 military. Siege capability disabled. Requires spy. 45% detection.",
    requiresTarget: true,
  },
  {
    id: "bribe_soldiers_to_defect",
    name: "Bribe Soldiers to Defect (Sabotage)",
    description: "Pay soldiers to switch sides and join you.",
    effects: "Target -15 military, YOU +8 military. Requires spy. 40% detection, 45% war risk.",
    requiresTarget: true,
  },

  // =============================================
  // POLITICAL SABOTAGE
  // =============================================
  {
    id: "assassinate_enemy_heir",
    name: "Assassinate Enemy Heir (Sabotage)",
    description: "Kill the next in line for the throne causing succession crisis.",
    effects: "-20 happiness, -10 influence. Heir killed. Requires spy. 60% detection, 70% war risk.",
    requiresTarget: true,
  },
  {
    id: "spread_enemy_propaganda",
    name: "Spread Propaganda (Sabotage)",
    description: "Spread lies and rumors about their ruler to undermine legitimacy.",
    effects: "-15 happiness, -10 influence. 25% detection, 15% war risk. Subtle.",
    requiresTarget: true,
  },
  {
    id: "incite_enemy_rebellion",
    name: "Incite Rebellion (Sabotage)",
    description: "Arm and fund rebel groups to destabilize their rule.",
    effects: "-25 happiness, -10 military. Rebellion starts. Requires spy. 45% detection, 50% war risk.",
    requiresTarget: true,
  },
  {
    id: "bribe_enemy_advisors",
    name: "Bribe Enemy Advisors (Sabotage)",
    description: "Corrupt their council to give bad advice.",
    effects: "-10 wealth. Bad decisions follow. Requires spy. 35% detection.",
    requiresTarget: true,
  },
  {
    id: "forge_enemy_documents",
    name: "Forge Documents (Sabotage)",
    description: "Create fake treaties, orders, or letters to cause diplomatic chaos.",
    effects: "-15 influence. Diplomatic chaos. Requires spy. 40% detection.",
    requiresTarget: true,
  },
  {
    id: "frame_noble_for_treason",
    name: "Frame Noble for Treason (Sabotage)",
    description: "Plant evidence to frame a noble for treason causing internal purges.",
    effects: "-10 happiness. Internal purge. Requires spy. 45% detection, 40% war risk.",
    requiresTarget: true,
  },
  {
    id: "support_rival_faction",
    name: "Support Rival Faction (Sabotage)",
    description: "Fund and arm opposition political groups.",
    effects: "-15 happiness. Faction strengthened. Requires spy. 35% detection.",
    requiresTarget: true,
  },
  {
    id: "spread_ruler_rumors",
    name: "Spread Ruler Rumors (Sabotage)",
    description: "Spread rumors of ruler's madness, cruelty, or illegitimacy.",
    effects: "-10 happiness, -15 influence. Low risk (20% detection).",
    requiresTarget: true,
  },
  {
    id: "create_enemy_succession_crisis",
    name: "Create Succession Crisis (Sabotage)",
    description: "Kill or discredit all viable heirs to create power vacuum.",
    effects: "-30 happiness, -20 influence. Requires spy. 50% detection, 55% war risk.",
    requiresTarget: true,
  },
  {
    id: "blackmail_enemy_officials",
    name: "Blackmail Officials (Sabotage)",
    description: "Gather compromising information to control their decisions.",
    effects: "Gain influence over their decisions. Requires spy. 30% detection.",
    requiresTarget: true,
  },

  // =============================================
  // RELIGIOUS SABOTAGE
  // =============================================
  {
    id: "desecrate_enemy_temple",
    name: "Desecrate Temple (Sabotage)",
    description: "Defile and damage their holy sites.",
    effects: "-25 happiness, -15 influence. Temple defiled. 60% detection, 50% war risk.",
    requiresTarget: true,
  },
  {
    id: "assassinate_enemy_priests",
    name: "Assassinate Priests (Sabotage)",
    description: "Kill religious leaders and holy men.",
    effects: "-20 happiness. Priests killed. Requires spy. 50% detection, 45% war risk.",
    requiresTarget: true,
  },
  {
    id: "spread_heresy",
    name: "Spread Heresy (Sabotage)",
    description: "Introduce false religious teachings to cause schism.",
    effects: "-15 happiness. Religious schism. Requires spy. 25% detection.",
    requiresTarget: true,
  },
  {
    id: "steal_holy_relics",
    name: "Steal Holy Relics (Sabotage)",
    description: "Take sacred objects from their temples for yourself.",
    effects: "Target -20 happiness, -10 influence. YOU +10 influence. Requires spy. 55% detection.",
    requiresTarget: true,
  },
  {
    id: "corrupt_religious_texts",
    name: "Corrupt Religious Texts (Sabotage)",
    description: "Subtly alter their holy scriptures over time.",
    effects: "-5 knowledge. Long-term corruption. Requires spy. Low detection (20%).",
    requiresTarget: true,
  },
  {
    id: "support_rival_cult",
    name: "Support Rival Cult (Sabotage)",
    description: "Fund a competing religious movement to divide their faith.",
    effects: "-15 happiness. Cult formed. Requires spy. 35% detection.",
    requiresTarget: true,
  },
  {
    id: "poison_holy_water",
    name: "Poison Holy Water (Sabotage)",
    description: "Contaminate sacred water supplies causing sickness and crisis of faith.",
    effects: "-15 happiness, -3 population. 40% detection, 45% war risk.",
    requiresTarget: true,
  },
  {
    id: "fake_divine_omens",
    name: "Fake Divine Omens (Sabotage)",
    description: "Stage fake supernatural events and bad prophecies.",
    effects: "-20 happiness. Fear spreads. 30% detection, low war risk.",
    requiresTarget: true,
  },

  // =============================================
  // INFRASTRUCTURE SABOTAGE
  // =============================================
  {
    id: "destroy_enemy_bridges",
    name: "Destroy Bridges (Sabotage)",
    description: "Destroy bridges to cut off movement and trade.",
    effects: "-15 wealth. Isolation. 50% detection, 30% war risk.",
    requiresTarget: true,
  },
  {
    id: "block_mountain_passes",
    name: "Block Mountain Passes (Sabotage)",
    description: "Cause rockslides to block trade routes.",
    effects: "-20 wealth. Trade routes closed. 35% detection, 25% war risk.",
    requiresTarget: true,
  },
  {
    id: "burn_enemy_harbor",
    name: "Burn Enemy Harbor (Sabotage)",
    description: "Burn docks, ships, and port facilities.",
    effects: "-25 wealth, -10 military. Naval power crippled. 55% detection, 40% war risk.",
    requiresTarget: true,
  },
  {
    id: "collapse_enemy_mines",
    name: "Collapse Enemy Mines (Sabotage)",
    description: "Cause cave-ins in mining operations.",
    effects: "-15 wealth, -5 population. Mines destroyed. 40% detection, 35% war risk.",
    requiresTarget: true,
  },
  {
    id: "destroy_enemy_aqueducts",
    name: "Destroy Aqueducts (Sabotage)",
    description: "Destroy water supply infrastructure causing crisis.",
    effects: "-20 happiness, -10 food. Water crisis. 45% detection, 40% war risk.",
    requiresTarget: true,
  },
  {
    id: "set_enemy_city_fires",
    name: "Set City Fires (Sabotage)",
    description: "Start fires in populated areas causing mass destruction.",
    effects: "-25 happiness, -20 wealth, -5 population. Devastating. 45% detection, 45% war risk.",
    requiresTarget: true,
  },
  {
    id: "dam_enemy_rivers",
    name: "Dam Rivers (Sabotage)",
    description: "Block rivers to cause flood or drought downstream.",
    effects: "-25 food, -15 happiness. Agricultural disaster. 50% detection, 35% war risk.",
    requiresTarget: true,
  },
  {
    id: "destroy_enemy_roads",
    name: "Destroy Roads (Sabotage)",
    description: "Dig trenches, destroy paving, cut off movement.",
    effects: "-10 wealth. Trade and military movement slowed. 40% detection, 25% war risk.",
    requiresTarget: true,
  },

  // =============================================
  // DEMOGRAPHIC SABOTAGE
  // =============================================
  {
    id: "spread_enemy_plague",
    name: "Spread Plague (Sabotage)",
    description: "Intentionally introduce deadly disease into their population.",
    effects: "-15 population, -30 happiness. Plague outbreak. 35% detection, 60% war risk. DEVASTATING.",
    requiresTarget: true,
  },
  {
    id: "poison_enemy_food_supply",
    name: "Poison Food Supply (Sabotage)",
    description: "Contaminate stored food with poison.",
    effects: "-10 population, -20 happiness, -20 food. Mass poisoning. 45% detection, 50% war risk.",
    requiresTarget: true,
  },
  {
    id: "kidnap_enemy_craftsmen",
    name: "Kidnap Craftsmen (Sabotage)",
    description: "Abduct skilled workers for your own use.",
    effects: "Target -5 technology. Craftsmen now work for YOU. 50% detection, 35% war risk.",
    requiresTarget: true,
  },
  {
    id: "encourage_enemy_emigration",
    name: "Encourage Emigration (Sabotage)",
    description: "Lure their population to leave for your lands.",
    effects: "Target -5 population, -10 happiness. YOU gain population. Requires spy. Low risk (25%).",
    requiresTarget: true,
  },
  {
    id: "assassinate_enemy_healers",
    name: "Assassinate Healers (Sabotage)",
    description: "Kill doctors and healers, especially during plague.",
    effects: "-15 happiness. Healers killed. Disease spreads unchecked. Requires spy. 45% detection.",
    requiresTarget: true,
  },

  // =============================================
  // PSYCHOLOGICAL SABOTAGE
  // =============================================
  {
    id: "spread_terror",
    name: "Spread Terror (Sabotage)",
    description: "Random murders and night attacks to terrorize the population.",
    effects: "-25 happiness. Terror campaign. 40% detection, 35% war risk.",
    requiresTarget: true,
  },
  {
    id: "display_enemy_heads",
    name: "Display Enemy Heads (Sabotage)",
    description: "Gruesome display of killed enemies for intimidation.",
    effects: "-20 happiness, -5 military. Morale crushed. 80% detection (overt), 50% war risk.",
    requiresTarget: true,
  },
  {
    id: "create_bad_omens",
    name: "Create Bad Omens (Sabotage)",
    description: "Stage fake supernatural events and prophesy doom.",
    effects: "-15 happiness. Superstitious fear. Low detection (25%), low war risk.",
    requiresTarget: true,
  },
  {
    id: "conduct_night_raids",
    name: "Night Raids (Sabotage)",
    description: "Attack civilians at night causing sleep deprivation and terror.",
    effects: "-20 happiness, -2 population. Exhaustion and fear. 50% detection, 40% war risk.",
    requiresTarget: true,
  },
  {
    id: "demoralize_with_losses",
    name: "Demoralize with Losses (Sabotage)",
    description: "Exaggerate their casualties to spread defeatism.",
    effects: "-10 happiness, -5 military. Defeatism spreads. Low detection (20%).",
    requiresTarget: true,
  },

  // =============================================
  // SOCIAL SABOTAGE
  // =============================================
  {
    id: "incite_class_warfare",
    name: "Incite Class Warfare (Sabotage)",
    description: "Turn the poor against the rich causing social unrest.",
    effects: "-20 happiness, -10 wealth. Class conflict. Requires spy. 35% detection.",
    requiresTarget: true,
  },
  {
    id: "spread_ethnic_hatred",
    name: "Spread Ethnic Hatred (Sabotage)",
    description: "Inflame tensions between ethnic groups.",
    effects: "-25 happiness. Ethnic tension. Requires spy. 30% detection, 25% war risk.",
    requiresTarget: true,
  },
  {
    id: "corrupt_enemy_youth",
    name: "Corrupt Youth (Sabotage)",
    description: "Spread vice and laziness among young people.",
    effects: "-10 happiness, -5 technology. Future weakened. Requires spy. Low detection (20%).",
    requiresTarget: true,
  },
  {
    id: "undermine_political_marriages",
    name: "Undermine Marriages (Sabotage)",
    description: "Break political marriages and alliances.",
    effects: "-15 influence. Alliances broken. Requires spy. 35% detection, 25% war risk.",
    requiresTarget: true,
  },
  {
    id: "spread_addiction",
    name: "Spread Addiction (Sabotage)",
    description: "Introduce addictive substances to weaken their population.",
    effects: "-15 happiness, -10 wealth. Addiction epidemic. Requires spy. Low detection (25%).",
    requiresTarget: true,
  },
  {
    id: "destroy_cultural_artifacts",
    name: "Destroy Cultural Artifacts (Sabotage)",
    description: "Burn art, destroy statues, erase their cultural identity.",
    effects: "-20 happiness, -20 influence. Identity damaged. 55% detection, 40% war risk.",
    requiresTarget: true,
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
  // TREASURY & FINANCE ACTIONS
  // =============================================
  {
    id: "mint_coins",
    name: "Mint New Coins",
    description: "Order the minting of new coins from your metal reserves",
    effects: "Converts raw gold/silver/copper into coins for trade. Requires coined economy phase.",
  },
  {
    id: "debase_currency",
    name: "Debase Currency",
    description: "Reduce the precious metal content in your coins to stretch your wealth further",
    effects: "Short-term: +coins. Long-term: +inflation, -trade trust. Risky!",
  },
  {
    id: "take_loan",
    name: "Take a Loan",
    description: "Borrow money from merchants, nobles, temples, or foreign powers",
    effects: "Immediate +wealth, but must repay with interest. Default risks war or seizure.",
  },
  {
    id: "repay_loan",
    name: "Repay Loan",
    description: "Pay off outstanding debts to improve credit rating",
    effects: "-wealth (principal + interest), +credit rating, avoids default penalties.",
  },
  {
    id: "raise_taxes",
    name: "Raise Taxes",
    description: "Increase tax rates to boost treasury income",
    effects: "+treasury income, -happiness, risk of tax evasion and unrest.",
  },
  {
    id: "lower_taxes",
    name: "Lower Taxes",
    description: "Reduce tax burden to improve happiness and economic activity",
    effects: "-treasury income, +happiness, +trade activity, +population growth.",
  },
  {
    id: "establish_bank",
    name: "Establish a Bank",
    description: "Found a bank to manage loans, deposits, and currency exchange",
    effects: "Enables banking operations, +wealth generation, requires banking economic phase.",
  },
  {
    id: "set_price_controls",
    name: "Set Price Controls",
    description: "Fix maximum prices for essential goods to protect the poor",
    effects: "+happiness for poor, risk of shortages and black markets.",
  },
  {
    id: "remove_price_controls",
    name: "Remove Price Controls",
    description: "Allow markets to set prices freely",
    effects: "Prices may rise, but supply improves. May anger the poor.",
  },
  {
    id: "increase_wages",
    name: "Increase Minimum Wage",
    description: "Mandate higher wages for workers",
    effects: "+worker happiness, +costs for employers, may reduce employment.",
  },
  {
    id: "crack_down_tax_evaders",
    name: "Crack Down on Tax Evaders",
    description: "Enforce tax collection more strictly",
    effects: "+tax revenue, -happiness among wealthy, risk of noble unrest.",
  },
  {
    id: "grant_tax_exemption",
    name: "Grant Tax Exemption",
    description: "Exempt a group (nobles, clergy, merchants) from certain taxes",
    effects: "+loyalty from exempt group, -treasury income, may anger others.",
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

  // =============================================
  // ENDGAME - NUCLEAR ACTIONS (Atomic Era)
  // =============================================
  {
    id: "start_nuclear_program",
    name: "Start Nuclear Program",
    description: "Begin developing nuclear weapons. Requires nuclear_fission technology. Very expensive but provides ultimate deterrent.",
    effects: "Costs 20 wealth per warhead. Creates global tension. Other civilizations will react with fear.",
    requiredTech: "nuclear_fission",
  },
  {
    id: "stop_nuclear_production",
    name: "Stop Nuclear Production",
    description: "Halt production of nuclear weapons",
    effects: "Stops wealth drain. May ease global tensions. Shows peaceful intent.",
    requiredTech: "nuclear_fission",
  },
  {
    id: "nuclear_strike",
    name: "Launch Nuclear Strike",
    description: "Use nuclear weapons against an enemy. EXTREMELY DESTRUCTIVE. Will likely trigger retaliation if they have nukes (MAD).",
    effects: "Devastates target population/infrastructure. If target has nukes, expect retaliation. Changes history forever.",
    requiresTarget: true,
    requiredTech: "nuclear_fission",
  },
  {
    id: "propose_disarmament",
    name: "Propose Nuclear Disarmament",
    description: "Offer to reduce nuclear arsenals with another nuclear power",
    effects: "If accepted: Both sides reduce warheads. Global tension decreases. Doomsday clock moves back.",
    requiresTarget: true,
    requiredTech: "nuclear_fission",
  },

  // =============================================
  // RISE AND FALL - REFORM ACTIONS
  // =============================================
  {
    id: "implement_reform",
    name: "Implement Reform",
    description: "Address internal decay with structural reforms. Use when facing decadence or crisis. Costs wealth and causes short-term unhappiness but reduces corruption/decadence.",
    effects: "Costs 50 wealth, -20 happiness temporarily. Reduces decadence by 30, corruption by 15. May end crisis.",
  },
  {
    id: "purge_corruption",
    name: "Purge Corruption",
    description: "Root out corrupt officials. Ruthless but effective at reducing corruption.",
    effects: "Reduces corruption significantly. May cause unrest. Ruthless rulers do this better.",
  },
  {
    id: "austerity_measures",
    name: "Austerity Measures",
    description: "Cut spending and live frugally to address economic crisis",
    effects: "-20 wealth spending, -10 happiness. Stops economic bleeding during depression.",
  },
  {
    id: "bread_and_circuses",
    name: "Bread and Circuses",
    description: "Spend wealth on entertainment and food to placate the masses during crisis",
    effects: "-30 wealth, +20 happiness. Temporary fix - doesn't solve underlying problems.",
  },

  // =============================================
  // HUMAN LIFE SYSTEMS - MARRIAGE & DYNASTY
  // =============================================
  {
    id: "arrange_political_marriage",
    name: "Arrange Political Marriage",
    description: "Arrange a marriage between your people and another territory for political alliance. Creates formal bond between civilizations.",
    effects: "Creates marriage alliance. +20 trust with target. Costs 50 gold dowry. Strengthens diplomatic ties.",
    requiresTarget: true,
  },
  {
    id: "set_inheritance_law",
    name: "Set Inheritance Law",
    description: "Establish how power passes to the next generation. Options: primogeniture (eldest child), agnatic (eldest male only), elective (council chooses), seniority (oldest family member).",
    effects: "Changes succession rules. May cause unrest if it disinherits expected heirs. Affects long-term stability.",
  },
  {
    id: "legitimize_bastard",
    name: "Legitimize Bastard",
    description: "Recognize an illegitimate child as a legitimate heir. Allows them to inherit.",
    effects: "-10 dynasty prestige. Child can now be named heir. May anger legitimate heirs.",
  },

  // =============================================
  // HUMAN LIFE SYSTEMS - ROMANCE
  // =============================================
  {
    id: "encourage_match",
    name: "Encourage Match",
    description: "Promote a romantic relationship between two characters. Love can bloom with a little help.",
    effects: "+20 romance progress. Characters may fall in love. Could lead to marriage.",
  },
  {
    id: "forbid_relationship",
    name: "Forbid Relationship",
    description: "Ban an inappropriate relationship (affair, forbidden love, etc.). May cause resentment.",
    effects: "Relationship ends or becomes secret. -10 happiness for involved parties. May create grudge.",
  },

  // =============================================
  // HUMAN LIFE SYSTEMS - INFRASTRUCTURE
  // =============================================
  {
    id: "build_road",
    name: "Build Road",
    description: "Construct a road connecting to another territory. Improves trade and military movement.",
    effects: "Creates road infrastructure. +15% trade income with connected territory. +20% army movement speed.",
    requiresTarget: true,
  },
  {
    id: "build_wall",
    name: "Build Defensive Wall",
    description: "Construct walls around your settlement. Essential for defense.",
    effects: "Creates wall infrastructure. +30% siege defense. -siege_damage_per_tick. Costs wealth to maintain.",
  },
  {
    id: "build_aqueduct_infrastructure",
    name: "Build Aqueduct",
    description: "Construct water supply infrastructure for better sanitation and farming.",
    effects: "Creates aqueduct. +20% farm productivity. -10% disease risk. +5 happiness from clean water.",
  },
  {
    id: "build_harbor",
    name: "Build Harbor",
    description: "Construct a harbor for naval trade and overseas expeditions. Requires coastal territory.",
    effects: "Creates harbor. Enables overseas trade. +25% trade income. Required for overseas expeditions.",
  },

  // =============================================
  // HUMAN LIFE SYSTEMS - EXPLORATION
  // =============================================
  {
    id: "launch_expedition",
    name: "Launch Expedition",
    description: "Send explorers into the unknown. Choose direction: north, south, east, west, or overseas (requires harbor).",
    effects: "Expedition departs. May discover resources, new peoples, ancient ruins. Risk of losses. Returns in 10-25 ticks.",
  },
  {
    id: "establish_colony",
    name: "Establish Colony",
    description: "Settle a new territory based on expedition discoveries. Expands your civilization.",
    effects: "Creates new settlement. Requires successful expedition with fertile land discovery. Costs population and resources.",
  },

  // =============================================
  // HUMAN LIFE SYSTEMS - ESPIONAGE
  // =============================================
  {
    id: "train_spy",
    name: "Train Spy",
    description: "Train a new espionage agent for covert operations. Education level affects spy quality.",
    effects: "Creates spy. Costs 200 gold. Spy skill based on territory education. Takes time to train.",
  },
  {
    id: "deploy_spy",
    name: "Deploy Spy",
    description: "Send a spy to infiltrate another territory. Choose cover (merchant, diplomat, servant, scholar, traveler) and mission (gather_intel, sabotage, steal_tech, incite_rebellion, assassinate).",
    effects: "Spy infiltrates target. Risk of discovery based on target's counter-intelligence. Mission difficulty varies.",
    requiresTarget: true,
  },
  {
    id: "extract_spy",
    name: "Extract Spy",
    description: "Recall a deployed spy before they are discovered. Brings back gathered intelligence.",
    effects: "Spy returns with intel. Extraction has risk of discovery. Better to extract than lose spy.",
  },
  {
    id: "increase_counter_intelligence",
    name: "Increase Counter-Intelligence",
    description: "Invest in detecting and catching enemy spies in your territory.",
    effects: "+10 counter-intelligence. Costs 500 gold. Higher detection chance for enemy spies.",
  },
  {
    id: "execute_captured_spy",
    name: "Execute Captured Spy",
    description: "Execute a captured enemy spy. Sends a message but may provoke retaliation.",
    effects: "Spy dies. -20 trust with spy's origin territory. May deter future espionage.",
  },
  {
    id: "turn_captured_spy",
    name: "Turn Captured Spy",
    description: "Attempt to convert a captured spy into a double agent working for you.",
    effects: "If successful, spy now works for you. Can feed false intel to enemy. Risk of failure.",
  },

  // =============================================
  // HUMAN LIFE SYSTEMS - GENDER & SOCIETY
  // =============================================
  {
    id: "grant_women_rights",
    name: "Grant Women's Rights",
    description: "Progressive reform allowing women more roles in society (work, own property, rule, fight).",
    effects: "+workforce if women can work. Traditionalists may resist. +happiness for progressive citizens.",
  },
  {
    id: "restrict_women_roles",
    name: "Restrict Women's Roles",
    description: "Enforce traditional gender roles. May appeal to conservative elements.",
    effects: "-workforce from women. Traditionalists approve. -happiness for progressive citizens.",
  },

  // =============================================
  // HUMAN LIFE SYSTEMS - WAR DEMOGRAPHICS
  // =============================================
  {
    id: "conscript_reserves",
    name: "Conscript Reserves",
    description: "Call up trained reserves for active military duty. Only fighting-age men (16-50) eligible by default.",
    effects: "Reserves become active soldiers. Reduces civilian workforce. Standard conscription.",
  },
  {
    id: "emergency_conscription",
    name: "Emergency Conscription",
    description: "Desperate measure: expand conscription age to 14-60 or include women (if culture allows).",
    effects: "More soldiers but terrible happiness penalty. Last resort only. -20 happiness.",
  },
  {
    id: "care_for_widows",
    name: "Care for Widows and Orphans",
    description: "Establish support for war widows and orphans. Costly but improves morale.",
    effects: "-wealth per widow/orphan. +15 happiness. Reduces social instability from war losses.",
  },

  // =============================================
  // HUMAN LIFE SYSTEMS - MENTAL HEALTH
  // =============================================
  {
    id: "establish_healing_sanctuary",
    name: "Establish Healing Sanctuary",
    description: "Build a place for mental health treatment. Requires education or piety above 40.",
    effects: "All characters begin therapy. -500 gold. +recovery rate for trauma, depression, PTSD.",
  },
  {
    id: "exile_madman",
    name: "Exile Mad Character",
    description: "Remove a character driven mad from your court. Harsh but may be necessary.",
    effects: "Character exiled. -15 happiness. Removes danger from madness but cold solution.",
  },

  // =============================================
  // HUMAN LIFE SYSTEMS - ADDICTION
  // =============================================
  {
    id: "ban_substances",
    name: "Ban Substances",
    description: "Prohibit alcohol, gambling, or opium. May reduce new addictions but drives existing ones underground.",
    effects: "Prohibition enacted. -new addiction rate. May create black market. Enforcement difficult.",
  },
  {
    id: "tavern_regulation",
    name: "Regulate Taverns",
    description: "Control alcohol access through regulation instead of prohibition. Moderate approach.",
    effects: "Hours restricted, serving rules. Moderate reduction in alcoholism. Less backlash than prohibition.",
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

  // === MENTAL HEALTH & PSYCHOLOGICAL STATE ===
  if (context.ruler?.mentalHealth || context.ruler?.addiction) {
    const r = context.ruler;
    let mentalSection = `### ${r.name}'s State of Mind\n`;

    // Mental health effects on decisions
    if (r.mentalHealth) {
      const mh = r.mentalHealth;

      if (mh.madness) {
        const madnessEffects: Record<string, { icon: string; description: string; biases: string[] }> = {
          paranoid: {
            icon: "👁️",
            description: "Sees conspiracies and threats everywhere",
            biases: [
              "⚠️ You suspect EVERYONE. Even loyal advisors might be plotting against you.",
              "Consider: exile_character, execute_character, increase counter-intelligence",
              "Trust no one. Better to act preemptively than be betrayed.",
              "*Every whisper is about you. Every smile hides a dagger.*"
            ]
          },
          megalomaniac: {
            icon: "👑",
            description: "Delusions of grandeur and destiny",
            biases: [
              "⚠️ You are DESTINED for greatness. Lesser rulers should bow before you.",
              "Consider: declare_war, demand_tribute, expand aggressively",
              "Caution is for the weak. Glory awaits the bold!",
              "*The world will remember your name for eternity.*"
            ]
          },
          violent: {
            icon: "🩸",
            description: "Uncontrollable rage and bloodlust",
            biases: [
              "⚠️ Violence is the ONLY answer they understand.",
              "Consider: execute_character, raid, declare_war, attack",
              "Diplomacy is weakness. Show them your wrath!",
              "*Blood must be spilled. It is the only way.*"
            ]
          },
          delusional: {
            icon: "🌀",
            description: "Disconnected from reality",
            biases: [
              "⚠️ Your perception may not match reality. But who defines reality?",
              "Your visions guide you. Others simply cannot understand.",
              "The voices/signs speak truths others cannot hear.",
              "*What you see is real. The others are blind.*"
            ]
          },
          depressive: {
            icon: "🌑",
            description: "Overwhelming despair and hopelessness",
            biases: [
              "⚠️ Nothing matters. Why bother trying?",
              "Consider: passive actions, maintaining status quo, isolation",
              "Every effort seems futile. The darkness is comforting.",
              "*Let others handle it. You are too weary to care.*"
            ]
          },
          manic: {
            icon: "⚡",
            description: "Extreme energy and impulsive decisions",
            biases: [
              "⚠️ Act NOW! Why wait? Do EVERYTHING at once!",
              "Consider: multiple ambitious projects, risky ventures",
              "Sleep is for the weak! You have endless energy!",
              "*So many ideas! Do them ALL! NOW! FASTER!*"
            ]
          }
        };

        const effect = madnessEffects[mh.madness];
        if (effect) {
          mentalSection += `\n${effect.icon} **MADNESS: ${mh.madness.toUpperCase()}**\n${effect.description}\n\n`;
          mentalSection += `**How this affects your thinking:**\n${effect.biases.map(b => `- ${b}`).join("\n")}\n`;
        }
      }

      // Other mental health issues
      const issues: string[] = [];
      if (mh.trauma > 60) issues.push(`High trauma (${mh.trauma}) - haunted by past events`);
      if (mh.depression > 60) issues.push(`Depression (${mh.depression}) - low motivation`);
      if (mh.anxiety > 60) issues.push(`Anxiety (${mh.anxiety}) - fear of failure`);
      if (mh.ptsd) issues.push("PTSD - flashbacks during crisis situations");
      if (mh.sanity < 40) issues.push(`Low sanity (${mh.sanity}) - struggling to cope`);

      if (issues.length > 0 && !mh.madness) {
        mentalSection += `\n**Psychological Burden:**\n${issues.map(i => `- ${i}`).join("\n")}\n`;
        mentalSection += `*These issues affect decision-making. Consider therapy/healing.*\n`;
      }

      if (mh.inTherapy) {
        mentalSection += `\n✨ *Currently receiving healing/therapy - recovery in progress*\n`;
      }
    }

    // Addiction effects on decisions
    if (r.addiction) {
      const add = r.addiction;
      const addictionBiases: Record<string, string[]> = {
        alcohol: [
          "Judgment impaired by drink",
          "May make rash decisions",
          "Consider: tavern_regulation to address your own vice"
        ],
        gambling: [
          "Attracted to risky ventures",
          "May bet the kingdom's wealth",
          "Every decision feels like a wager"
        ],
        opium: [
          "Disconnected, dreamy thinking",
          "May neglect urgent matters",
          "Reality feels distant and unimportant"
        ],
        other: [
          "Compulsive behaviors affect judgment",
          "May prioritize feeding the habit",
          "Vulnerable to manipulation by suppliers"
        ]
      };

      const severityImpact: Record<string, string> = {
        mild: "Minor impact on judgment",
        moderate: "Noticeable impairment in decision-making",
        severe: "Significantly impaired - poor judgment likely",
        crippling: "CRITICAL - barely functional, desperate for next fix"
      };

      mentalSection += `\n🍷 **ADDICTION: ${add.type.toUpperCase()}** (${add.severity})\n`;
      mentalSection += `- ${severityImpact[add.severity]}\n`;
      mentalSection += `**Effects on your thinking:**\n${addictionBiases[add.type].map(b => `- ${b}`).join("\n")}\n`;
    }

    sections.push(mentalSection);
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
// ESPIONAGE INTELLIGENCE SECTION
// =============================================
// Shows gathered spy intelligence to inform military/diplomatic decisions

function buildEspionageSection(context?: EspionageContext): string {
  if (!context) return "";
  if (context.activeSpies === 0 && context.intelligence.length === 0) return "";

  const sections: string[] = [];

  sections.push(`## 🕵️ SPY NETWORK INTELLIGENCE

*Your spies have gathered the following intelligence. Use this to make informed military and diplomatic decisions.*`);

  // Spy network status
  let networkStatus = `### Network Status
- **Active Agents:** ${context.activeSpies}
- **Captured Agents:** ${context.capturedSpies}
- **Counter-Intelligence:** ${context.counterIntelligence}/100
- **Known Enemy Spies:** ${context.knownEnemySpies}`;
  sections.push(networkStatus);

  // Intelligence reports
  if (context.intelligence.length > 0) {
    const intelByTarget = new Map<string, typeof context.intelligence>();
    for (const intel of context.intelligence) {
      const existing = intelByTarget.get(intel.targetTerritoryName) || [];
      existing.push(intel);
      intelByTarget.set(intel.targetTerritoryName, existing);
    }

    let intelSection = `### Gathered Intelligence\n`;

    for (const [targetName, reports] of intelByTarget) {
      intelSection += `\n**${targetName}:**\n`;
      for (const report of reports.slice(-3)) { // Last 3 reports per target
        const reliabilityIcon = report.reliability === "high" ? "✓" : report.reliability === "medium" ? "?" : "⚠️";
        intelSection += `- ${reliabilityIcon} [${report.intelType}] ${report.info}\n`;
      }
    }

    intelSection += `\n*Use this intelligence to:*
- **Plan attacks** when enemy military is weak
- **Time diplomacy** when enemy is distracted
- **Counter enemy plans** before they execute
- **Exploit weaknesses** in enemy infrastructure or morale

💡 **COMBAT BONUS:** Having active spies in an enemy territory provides up to +25% combat effectiveness when attacking them. Your spies report enemy positions, troop movements, and weak points. The more skilled and infiltrated your spies, the greater the advantage.`;

    sections.push(intelSection);
  } else {
    sections.push(`### No Intelligence Gathered
*Deploy spies to enemy territories to gather intel on their military strength, resources, and plans.*`);
  }

  // Sabotage opportunities - education targets
  if (context.sabotageTargets && context.sabotageTargets.length > 0) {
    let sabotageSection = `### 🔥 SABOTAGE OPPORTUNITIES

*Your spies have identified vulnerable education targets in rival civilizations. Disrupting their knowledge systems can cripple their long-term development.*

| Territory | Education Assets | Vulnerability | Spy in Place? |
|-----------|-----------------|---------------|---------------|`;

    for (const target of context.sabotageTargets) {
      const assets: string[] = [];
      if (target.hasLibrary) assets.push("Library");
      if (target.hasUniversity) assets.push("University");
      if (target.hasSchools > 0) assets.push(`${target.hasSchools} Schools`);
      if (target.scholarCount > 0) assets.push(`${target.scholarCount} Scholars`);

      const vulnLevel = target.educationVulnerability >= 60 ? "HIGH" :
                       target.educationVulnerability >= 40 ? "Medium" : "Low";
      const spyStatus = target.hasSpy ? "✓ Yes" : "✗ No";

      sabotageSection += `
| ${target.territoryName} | ${assets.join(", ") || "None"} | ${vulnLevel} | ${spyStatus} |`;
    }

    sabotageSection += `

**Available Sabotage Actions:**
- \`burn_enemy_library\` - Destroy their accumulated knowledge (requires spy)
- \`sabotage_enemy_school\` - Disrupt education operations
- \`assassinate_enemy_scholar\` - Eliminate key knowledge holders
- \`steal_enemy_scrolls\` - Take their knowledge for yourself
- \`spread_misinformation\` - Corrupt their teachings (subtle, low risk)
- \`bribe_scholar_to_defect\` - Recruit their best minds
- \`destroy_enemy_university\` - Cripple advanced learning (requires spy)

⚠️ **Warning:** Sabotage operations carry risk of detection and may trigger war!`;

    sections.push(sabotageSection);
  }

  return sections.join("\n\n");
}

// =============================================
// SABOTAGE MOTIVATION SECTION
// =============================================
// Shows WHY the civilization might want to sabotage
// This helps make sabotage feel organic and motivated, not random

function buildSabotageSection(context?: SabotageMotiveContext): string {
  if (!context || context.pressure < 15) return "";

  const sections: string[] = [];

  // Header with pressure indicator
  const pressureLevel = context.pressure >= 70 ? "HIGH" :
                        context.pressure >= 40 ? "MODERATE" :
                        context.pressure >= 20 ? "LOW" : "MINIMAL";

  const pressureEmoji = context.pressure >= 70 ? "🔥" :
                        context.pressure >= 40 ? "⚡" : "📊";

  sections.push(`## ${pressureEmoji} COVERT OPERATIONS OPPORTUNITY

*Your advisors sense opportunity for covert action. Sabotage pressure: **${pressureLevel}** (${Math.round(context.pressure)}%)*`);

  // Motivations
  if (context.topMotives && context.topMotives.length > 0) {
    let motiveSection = `### Why We Feel This Way\n`;

    for (const motive of context.topMotives) {
      const intensityBar = "█".repeat(Math.floor(motive.intensity / 20)) + "░".repeat(5 - Math.floor(motive.intensity / 20));
      motiveSection += `- [${intensityBar}] ${motive.reason}\n`;
    }

    motiveSection += `\n*These circumstances are driving your people toward covert action. High motivation + opportunity = likely sabotage.*`;
    sections.push(motiveSection);
  }

  // Suggested targets
  if (context.suggestedTargets && context.suggestedTargets.length > 0) {
    let targetSection = `### Potential Targets

| Territory | Pressure | Primary Motivation | Suggested Operations |
|-----------|----------|-------------------|---------------------|`;

    for (const target of context.suggestedTargets) {
      const pressureColor = target.pressure >= 60 ? "🔴" :
                            target.pressure >= 40 ? "🟡" : "🟢";
      targetSection += `
| ${target.name} | ${pressureColor} ${Math.round(target.pressure)}% | ${target.reason.substring(0, 40)}... | ${target.suggestions.slice(0, 2).join(", ")} |`;
    }

    targetSection += `

**Remember:** Sabotage emerges from *circumstances* - desperation, grudges, rivalry, strategic necessity, religious conflict, or opportunism. Act when the motivation is genuine, not just because you can.`;

    sections.push(targetSection);
  }

  // Warning
  sections.push(`⚠️ **Consequences of Sabotage:**
- Detection can damage relations or trigger war
- Success creates memories/grudges - enemies may retaliate
- Some operations require spies in place
- Religious sabotage against devout enemies has extra risk`);

  return sections.join("\n\n");
}

// =============================================
// WEATHER CONTEXT SECTION
// =============================================

function buildWeatherSection(context?: WeatherContext): string {
  if (!context) return "";

  const weatherEmoji: Record<string, string> = {
    clear: "☀️", cloudy: "☁️", rain: "🌧️", heavy_rain: "⛈️",
    thunderstorm: "🌩️", snow: "❄️", blizzard: "🌨️", drought: "🏜️",
    heat_wave: "🔥", fog: "🌫️", monsoon: "🌊"
  };

  const emoji = weatherEmoji[context.currentWeather] || "🌤️";
  const extremeWarning = context.isExtreme ? " ⚠️ **EXTREME CONDITIONS**" : "";

  let section = `## ${emoji} WEATHER: ${context.currentWeather.replace(/_/g, " ").toUpperCase()}${extremeWarning}

| Factor | Effect |
|--------|--------|
| Farming | ${context.farmingModifier > 0 ? "+" : ""}${context.farmingModifier}% |
| Military | ${context.militaryModifier > 0 ? "+" : ""}${context.militaryModifier}% |
| Travel | ${context.travelModifier > 0 ? "+" : ""}${context.travelModifier}% |
| Mood | ${context.moodModifier > 0 ? "+" : ""}${context.moodModifier}% |

*Expected to last ${context.expectedDuration} more months.*`;

  if (context.isExtreme) {
    section += `\n\n⚠️ **Extreme weather affects all operations. Consider waiting or adapting plans.**`;
  }

  return section;
}

// =============================================
// DISASTER CONTEXT SECTION
// =============================================

function buildDisasterSection(context?: DisasterContext): string {
  if (!context) return "";
  if (context.activeDisasters.length === 0 && context.disasterRisk < 30) return "";

  const sections: string[] = [];

  if (context.activeDisasters.length > 0) {
    let disasterList = `## 🔥 ACTIVE DISASTERS\n\n`;
    for (const d of context.activeDisasters) {
      const severityIcon = d.severity === "catastrophic" ? "💀" : d.severity === "major" ? "🔴" : d.severity === "moderate" ? "🟡" : "🟢";
      disasterList += `### ${severityIcon} ${d.type.replace(/_/g, " ").toUpperCase()}
- Severity: **${d.severity}**
- Casualties: ${d.casualties}
- Buildings Destroyed: ${d.buildingsDestroyed}
- Recovery: ${d.recoveryProgress}%\n\n`;
    }
    sections.push(disasterList);
  }

  if (context.disasterRisk >= 30) {
    const riskLevel = context.disasterRisk >= 70 ? "HIGH" : context.disasterRisk >= 50 ? "MODERATE" : "LOW";
    sections.push(`⚠️ **Disaster Risk: ${riskLevel}** (${context.disasterRisk}%) - Consider preparedness measures.`);
  }

  return sections.join("\n");
}

// =============================================
// INFRASTRUCTURE CONTEXT SECTION
// =============================================

function buildInfrastructureSection(context?: InfrastructureContext): string {
  if (!context || context.infrastructure.length === 0) return "";

  const infraEmoji: Record<string, string> = {
    road: "🛤️", bridge: "🌉", aqueduct: "🚰", wall: "🏰",
    harbor: "⚓", lighthouse: "🗼", sewers: "🚿"
  };

  let section = `## 🏗️ INFRASTRUCTURE

| Structure | Level | Condition | Status |
|-----------|-------|-----------|--------|`;

  for (const i of context.infrastructure) {
    const emoji = infraEmoji[i.type] || "🔧";
    const status = i.isUnderConstruction ? `Building (${i.constructionProgress}%)` : "Active";
    const conditionIcon = i.condition >= 80 ? "✓" : i.condition >= 50 ? "~" : "⚠️";
    section += `\n| ${emoji} ${i.type} | ${i.level} | ${conditionIcon} ${i.condition}% | ${status} |`;
  }

  section += `\n\n**Active Bonuses (applied automatically):**`;
  section += `\n- Trade efficiency: +${context.totalBonuses.tradeBonus}% (affects caravan profits)`;
  section += `\n- Defense strength: +${context.totalBonuses.defenseBonus}% (affects combat outcomes)`;
  section += `\n- Travel speed: +${context.totalBonuses.travelSpeed}% (reduces caravan travel time)`;
  section += `\n- Trade route risk: reduced by infrastructure quality`;

  if (context.totalBonuses.defenseBonus > 0) {
    section += `\n\n💡 Your infrastructure provides combat advantages. Walls and bridges make your territory harder to conquer.`;
  }

  if (context.totalBonuses.tradeBonus > 0) {
    section += `\n💡 Roads and harbors are boosting your trade income. Consider expanding trade routes.`;
  }

  return section;
}

// =============================================
// DYNASTY CONTEXT SECTION
// =============================================

function buildDynastySection(context?: DynastyContext): string {
  if (!context) return "";

  const sections: string[] = [];

  if (context.currentDynasty) {
    sections.push(`## 👑 DYNASTY: ${context.currentDynasty.name}
- Generations: ${context.currentDynasty.generations}
- Prestige: ${context.currentDynasty.prestige}
- Inheritance: ${context.currentDynasty.inheritanceRule}`);
  }

  // Succession status
  const riskLevel = context.successionStatus.successionRisk >= 70 ? "🔴 CRITICAL" :
                    context.successionStatus.successionRisk >= 40 ? "🟡 CONCERNING" : "🟢 STABLE";

  let successionSection = `### Succession Status: ${riskLevel}`;
  if (context.successionStatus.hasHeir) {
    successionSection += `\n- Heir: **${context.successionStatus.heirName}** (age ${context.successionStatus.heirAge})`;
  } else {
    successionSection += `\n- ⚠️ **NO DESIGNATED HEIR** - succession crisis possible!`;
  }
  if (context.successionStatus.rivalClaimants > 0) {
    successionSection += `\n- Rival claimants: ${context.successionStatus.rivalClaimants}`;
  }
  sections.push(successionSection);

  // Marriage opportunities
  if (context.marriageOpportunities.length > 0) {
    let marriages = `### 💒 Marriage Opportunities\n`;
    for (const m of context.marriageOpportunities.slice(0, 3)) {
      marriages += `- **${m.characterName}** → ${m.targetTerritory}: ${m.politicalBenefit}\n`;
    }
    sections.push(marriages);
  }

  return sections.join("\n\n");
}

// =============================================
// ROMANCE CONTEXT SECTION
// =============================================

function buildRomanceSection(context?: RomanceContext): string {
  if (!context) return "";
  if (context.activeRomances.length === 0 && context.recentScandals.length === 0) return "";

  const sections: string[] = [];

  if (context.activeRomances.length > 0) {
    let romances = `## 💕 COURT ROMANCES\n`;
    for (const r of context.activeRomances) {
      const typeIcon = r.type === "affair" ? "🔥" : r.type === "courtship" ? "💐" : "❤️";
      const warning = r.isAdulterous ? " ⚠️ ADULTEROUS" : r.isSecret ? " 🤫 Secret" : "";
      romances += `- ${typeIcon} ${r.person1} & ${r.person2} (${r.type})${warning}\n`;
      if (r.scandalRisk > 50) {
        romances += `  - Scandal risk: ${r.scandalRisk}%\n`;
      }
    }
    sections.push(romances);
  }

  if (context.recentScandals.length > 0) {
    sections.push(`### 😱 Recent Scandals\n${context.recentScandals.map(s => `- ${s}`).join("\n")}`);
  }

  return sections.join("\n\n");
}

// =============================================
// FRIENDSHIP CONTEXT SECTION
// =============================================

function buildFriendshipSection(context?: FriendshipContext): string {
  if (!context) return "";
  if (context.notableFriendships.length === 0) return "";

  let section = `## 🤝 NOTABLE FRIENDSHIPS\n`;

  for (const f of context.notableFriendships.slice(0, 5)) {
    const typeIcon = f.type === "sworn_brother" ? "⚔️" : f.type === "best_friend" ? "💎" : "🤝";
    section += `- ${typeIcon} **${f.character1}** & **${f.character2}** (${f.type.replace(/_/g, " ")})\n`;
  }

  if (context.swornBrotherhoodsCount > 0) {
    section += `\n*${context.swornBrotherhoodsCount} sworn brotherhoods - these bonds are unbreakable.*`;
  }

  if (context.isolatedCharacters.length > 0) {
    section += `\n\n⚠️ **Isolated Characters:** ${context.isolatedCharacters.join(", ")} - they have no close bonds.`;
  }

  return section;
}

// =============================================
// MENTAL HEALTH CONTEXT SECTION
// =============================================

function buildMentalHealthSection(context?: MentalHealthContext): string {
  if (!context) return "";
  if (context.troubledCharacters.length === 0) return "";

  let section = `## 🧠 MENTAL HEALTH CONCERNS\n`;

  // INTERCONNECTION: Check if RULER has mental health issues that affect decision-making
  const rulerWithIssues = context.troubledCharacters.find((c) => c.role === "ruler");
  if (rulerWithIssues) {
    section += `\n### ⚠️ RULER MENTAL STATE WARNING\n`;

    // Madness types affect decisions differently
    if (rulerWithIssues.issues.madnessType) {
      switch (rulerWithIssues.issues.madnessType) {
        case "paranoid":
          section += `**YOUR RULER IS PARANOID.** They see threats everywhere and trust no one.\n`;
          section += `- Decision impact: May overreact to minor threats, suspect allies of betrayal, waste resources on security\n`;
          section += `- Consider: Paranoid decisions often backfire. Avoid hasty accusations or preemptive attacks.\n\n`;
          break;
        case "megalomaniac":
          section += `**YOUR RULER HAS MEGALOMANIA.** They believe they are destined for greatness.\n`;
          section += `- Decision impact: May pursue reckless expansion, underestimate enemies, ignore advisors\n`;
          section += `- Consider: Grand ambitions often lead to overextension. Temper expansion with caution.\n\n`;
          break;
        case "violent":
          section += `**YOUR RULER HAS VIOLENT TENDENCIES.** They prefer force over diplomacy.\n`;
          section += `- Decision impact: May choose war over peace, execute prisoners, alienate allies\n`;
          section += `- Consider: Violence breeds resentment. Diplomatic solutions may serve you better.\n\n`;
          break;
        case "delusional":
          section += `**YOUR RULER IS DELUSIONAL.** They may not perceive reality accurately.\n`;
          section += `- Decision impact: May pursue impossible goals, ignore real threats, waste resources on fantasies\n`;
          section += `- Consider: Ground decisions in reality. Verify information before acting.\n\n`;
          break;
        case "depressive":
          section += `**YOUR RULER SUFFERS FROM DEPRESSIVE MADNESS.** They see only doom.\n`;
          section += `- Decision impact: May neglect opportunities, fail to defend, make defeatist choices\n`;
          section += `- Consider: Depression distorts perception. There may be hope even in dark times.\n\n`;
          break;
        case "manic":
          section += `**YOUR RULER IS IN A MANIC STATE.** They have boundless energy but poor judgment.\n`;
          section += `- Decision impact: May start many projects, make impulsive decisions, overcommit resources\n`;
          section += `- Consider: Manic energy can be destructive. Focus on completing existing tasks.\n\n`;
          break;
      }
    }

    // Severe depression affects decisions
    if (rulerWithIssues.issues.depression > 70) {
      section += `**SEVERE DEPRESSION:** Your ruler struggles to see hope or take decisive action.\n`;
      section += `- May miss opportunities, delay important decisions, choose passive options\n\n`;
    }

    // High trauma affects decisions
    if (rulerWithIssues.issues.trauma > 70) {
      section += `**SEVERE TRAUMA:** Your ruler carries deep wounds that cloud judgment.\n`;
      section += `- May avoid situations similar to past trauma, react emotionally to triggers\n\n`;
    }

    // PTSD affects combat-related decisions
    if (rulerWithIssues.issues.hasPTSD) {
      section += `**PTSD:** Your ruler has post-traumatic stress from past horrors.\n`;
      section += `- Combat and war decisions may be affected by flashbacks and avoidance\n\n`;
    }

    // Low sanity is a general warning
    if (rulerWithIssues.issues.sanity < 30) {
      section += `**⚠️ CRITICAL: RULER SANITY AT ${rulerWithIssues.issues.sanity}%**\n`;
      section += `Your ruler's grip on reality is tenuous. All decisions should be scrutinized.\n`;
      section += `Seek treatment immediately or consider succession before disaster strikes.\n\n`;
    } else if (rulerWithIssues.issues.sanity < 50) {
      section += `**LOW SANITY (${rulerWithIssues.issues.sanity}%):** Your ruler's judgment is impaired.\n`;
      section += `- Decisions may be erratic. Consider treatment at a healing sanctuary.\n\n`;
    }
  }

  // List all troubled characters
  section += `### Court Mental Health Status:\n`;
  for (const c of context.troubledCharacters) {
    let issues: string[] = [];
    if (c.issues.trauma > 50) issues.push(`trauma (${c.issues.trauma}%)`);
    if (c.issues.depression > 50) issues.push(`depression (${c.issues.depression}%)`);
    if (c.issues.hasPTSD) issues.push("PTSD");
    if (c.issues.madnessType) issues.push(`madness: ${c.issues.madnessType}`);
    if (c.issues.sanity < 50) issues.push(`low sanity (${c.issues.sanity}%)`);

    const urgency = c.needsTreatment ? "⚠️ NEEDS HELP" : "";
    section += `- **${c.name}** (${c.role}): ${issues.join(", ")} ${urgency}\n`;
  }

  if (context.hasHealingSanctuary) {
    section += `\n✓ You have a healing sanctuary for treatment.`;
  } else {
    section += `\n⚠️ No healing sanctuary - consider building one for mental health care.`;
  }

  if (context.recentTraumas.length > 0) {
    section += `\n\n**Recent Traumas:** ${context.recentTraumas.slice(0, 3).join("; ")}`;
  }

  return section;
}

// =============================================
// ADDICTION CONTEXT SECTION
// =============================================

function buildAddictionSection(context?: AddictionContext): string {
  if (!context) return "";
  if (context.addictedCharacters.length === 0) return "";

  let section = `## 🍺 ADDICTION PROBLEMS\n`;

  for (const a of context.addictedCharacters) {
    const severityIcon = a.severity === "crippling" ? "💀" : a.severity === "severe" ? "🔴" : a.severity === "moderate" ? "🟡" : "🟢";
    section += `- ${severityIcon} **${a.name}** (${a.role}): ${a.addictionType} addiction (${a.severity})
  - Functionality: -${a.functionalityImpact}% | Wealth drain: ${a.wealthDrain}/month\n`;
  }

  if (context.hasProhibition) {
    section += `\n✓ Prohibition is in effect (mixed results).`;
  }

  return section;
}

// =============================================
// WAR DEMOGRAPHICS CONTEXT SECTION
// =============================================

function buildWarDemographicsSection(context?: WarDemographicsContext): string {
  if (!context) return "";

  const statusIcon = context.manpowerStatus === "critical" ? "🔴" :
                     context.manpowerStatus === "strained" ? "🟡" :
                     context.manpowerStatus === "adequate" ? "🟢" : "💪";

  let section = `## ⚔️ MILITARY MANPOWER: ${statusIcon} ${context.manpowerStatus.toUpperCase()}

| Category | Count |
|----------|-------|
| Eligible Men (16-50) | ${context.fightingPopulation.eligibleMen} |
| Current Soldiers | ${context.fightingPopulation.currentSoldiers} |
| Reserves | ${context.fightingPopulation.reserves} |
| % of Population | ${context.fightingPopulation.percentageOfPopulation}% |`;

  if (context.warCasualties.recentDeaths > 0 || context.warCasualties.widows > 0) {
    section += `\n\n### War's Toll
- Recent deaths: ${context.warCasualties.recentDeaths}
- Widows: ${context.warCasualties.widows}
- Orphans: ${context.warCasualties.orphans}
- Disabled veterans: ${context.warCasualties.disabledVeterans}`;
  }

  if (!context.canConscriptMore) {
    section += `\n\n⚠️ **Cannot conscript more** - manpower exhausted!`;
  }

  return section;
}

// =============================================
// GENDER DYNAMICS CONTEXT SECTION
// =============================================

function buildGenderSection(context?: GenderContext): string {
  if (!context) return "";

  const progressLabel = context.currentRoles.progressLevel >= 80 ? "Progressive" :
                        context.currentRoles.progressLevel >= 50 ? "Moderate" :
                        context.currentRoles.progressLevel >= 20 ? "Traditional" : "Restrictive";

  let section = `## ⚖️ GENDER ROLES: ${progressLabel}

| Right | Status |
|-------|--------|
| Women can work | ${context.currentRoles.womenCanWork ? "✓" : "✗"} |
| Women can own property | ${context.currentRoles.womenCanOwn ? "✓" : "✗"} |
| Women can rule | ${context.currentRoles.womenCanRule ? "✓" : "✗"} |
| Women can fight | ${context.currentRoles.womenCanFight ? "✓" : "✗"} |`;

  if (context.workforceImpact.restrictionCost > 0) {
    section += `\n\n📊 **Workforce Impact:** Current labor pool: ${context.workforceImpact.currentLaborPool}
*If progressive: +${context.workforceImpact.potentialIfProgressive - context.workforceImpact.currentLaborPool} additional workers*`;
  }

  if (context.socialTension > 40) {
    section += `\n\n⚠️ Social tension from gender issues: ${context.socialTension}%`;
  }

  return section;
}

// =============================================
// EXPEDITION CONTEXT SECTION
// =============================================

function buildExpeditionSection(context?: ExpeditionContext): string {
  if (!context) return "";
  if (context.activeExpeditions.length === 0 && context.unexploredDirections.length === 0) return "";

  const sections: string[] = [];

  if (context.activeExpeditions.length > 0) {
    let expeditions = `## 🧭 ACTIVE EXPEDITIONS\n`;
    for (const e of context.activeExpeditions) {
      const statusIcon = e.status === "exploring" ? "🔍" : e.status === "returning" ? "🏠" : e.status === "lost" ? "❓" : "🚶";
      expeditions += `\n### ${statusIcon} ${e.direction.toUpperCase()} Expedition
- Leader: ${e.leaderName || "Unknown"}
- Crew: ${e.explorerCount} explorers, ${e.soldierCount} soldiers
- Status: ${e.status}
- Return in: ${e.daysUntilReturn} months`;
      if (e.discoveries.length > 0) {
        expeditions += `\n- Discoveries: ${e.discoveries.join(", ")}`;
      }
    }
    sections.push(expeditions);
  }

  if (context.unexploredDirections.length > 0) {
    sections.push(`🗺️ **Unexplored Directions:** ${context.unexploredDirections.join(", ")}`);
  }

  return sections.join("\n\n");
}

// =============================================
// TRADE CONTEXT SECTION
// =============================================

function buildTradeSection(context?: TradeContext): string {
  if (!context) return "";

  const sections: string[] = [];

  if (context.activeTradeRoutes.length > 0) {
    let routes = `## 💰 TRADE ROUTES\n\n| Partner | Goods | Profit | Status |
|---------|-------|--------|--------|`;
    for (const r of context.activeTradeRoutes) {
      const profitIcon = r.profitability >= 50 ? "📈" : r.profitability >= 20 ? "📊" : "📉";
      routes += `\n| ${r.partnerTerritory} | ${r.goods} | ${profitIcon} ${r.profitability}% | ${r.isActive ? "Active" : "Inactive"} |`;
    }
    sections.push(routes);
  }

  if (context.caravans.inTransit > 0 || context.caravans.recentRaids > 0) {
    let caravans = `### Caravan Activity
- In transit: ${context.caravans.inTransit}
- Recent arrivals: ${context.caravans.recentArrivals}`;
    if (context.caravans.recentRaids > 0) {
      caravans += `\n- ⚠️ Recent raids: ${context.caravans.recentRaids}`;
    }
    sections.push(caravans);
  }

  const trend = context.marketPrices.trend === "rising" ? "📈" : context.marketPrices.trend === "falling" ? "📉" : "📊";
  sections.push(`### Market Prices ${trend}
Food: ${context.marketPrices.food} | Goods: ${context.marketPrices.goods} | Luxuries: ${context.marketPrices.luxuries}`);

  return sections.join("\n\n");
}

// =============================================
// DISEASE CONTEXT SECTION
// =============================================

function buildDiseaseSection(context?: DiseaseContext): string {
  if (!context) return "";
  if (context.activeOutbreaks.length === 0 && context.diseaseRisk.level < 30) return "";

  const sections: string[] = [];

  if (context.activeOutbreaks.length > 0) {
    let outbreaks = `## 🦠 DISEASE OUTBREAKS\n`;
    for (const o of context.activeOutbreaks) {
      const severityIcon = o.severity === "pandemic" ? "💀" : o.severity === "epidemic" ? "🔴" : "🟡";
      outbreaks += `\n### ${severityIcon} ${o.diseaseName} (${o.severity})
- Infected: ${o.infected}
- Deaths: ${o.deaths}
- Spread rate: ${o.spreadRate}%/month`;
    }
    sections.push(outbreaks);

    if (context.quarantineActive) {
      sections.push(`✓ **Quarantine in effect** - limiting spread.`);
    } else {
      sections.push(`⚠️ No quarantine - disease spreading freely!`);
    }
  }

  if (context.diseaseRisk.level >= 30) {
    sections.push(`### Disease Risk: ${context.diseaseRisk.level}%
Factors: ${context.diseaseRisk.factors.join(", ")}`);
  }

  sections.push(`Healers available: ${context.healerCount}`);

  return sections.join("\n\n");
}

// =============================================
// REBELLION CONTEXT SECTION
// =============================================

function buildRebellionSection(context?: RebellionContext): string {
  if (!context) return "";
  if (context.activeRebellions.length === 0 && context.overallStability >= 70) return "";

  const sections: string[] = [];

  const stabilityIcon = context.overallStability >= 70 ? "🟢" : context.overallStability >= 40 ? "🟡" : "🔴";
  sections.push(`## ⚠️ INTERNAL STABILITY: ${stabilityIcon} ${context.overallStability}%`);

  if (context.activeRebellions.length > 0) {
    let rebellions = `### 🔥 ACTIVE REBELLIONS\n`;
    for (const r of context.activeRebellions) {
      rebellions += `- **${r.factionName}** - Strength: ${r.strength}\n`;
    }
    sections.push(rebellions);
  }

  if (context.factionUnrest.length > 0) {
    let unrest = `### Faction Unrest\n`;
    for (const f of context.factionUnrest.filter(f => f.unrestLevel > 30)) {
      const riskIcon = f.willingness_to_revolt >= 70 ? "🔴" : f.willingness_to_revolt >= 40 ? "🟡" : "🟢";
      unrest += `- ${riskIcon} **${f.factionName}**: ${f.unrestLevel}% unrest
  - Demands: ${f.demands.slice(0, 2).join(", ")}\n`;
    }
    sections.push(unrest);
  }

  if (context.recentGrievances.length > 0) {
    sections.push(`**Recent Grievances:** ${context.recentGrievances.slice(0, 3).join("; ")}`);
  }

  return sections.join("\n\n");
}

// =============================================
// LEGITIMACY CONTEXT SECTION
// =============================================

function buildLegitimacySection(context?: LegitimacyContext): string {
  if (!context) return "";

  const legitimacyIcon = context.ruler.legitimacyScore >= 70 ? "👑" :
                         context.ruler.legitimacyScore >= 40 ? "⚖️" : "⚠️";

  let section = `## ${legitimacyIcon} RULER LEGITIMACY: ${context.ruler.name}

| Support Base | Level |
|--------------|-------|
| Legitimacy Score | ${context.ruler.legitimacyScore}% |
| Popular Support | ${context.ruler.popularSupport}% |
| Noble Support | ${context.ruler.nobleSupport}% |
| Military Support | ${context.ruler.militarySupport}% |

**Legitimacy Sources:** ${context.legitimacySources.join(", ")}`;

  if (context.threats.length > 0) {
    section += `\n\n⚠️ **Threats:** ${context.threats.join(", ")}`;
  }

  if (context.overthrowRisk >= 30) {
    const riskLevel = context.overthrowRisk >= 70 ? "HIGH" : context.overthrowRisk >= 50 ? "MODERATE" : "LOW";
    section += `\n\n🔴 **Overthrow Risk: ${riskLevel}** (${context.overthrowRisk}%)`;
  }

  if (context.recentActions.negative.length > 0) {
    section += `\n\n**Recent unpopular actions:** ${context.recentActions.negative.slice(0, 2).join("; ")}`;
  }

  return section;
}

// =============================================
// ECONOMY & TREASURY SECTION
// =============================================
// Shows the territory's financial health, taxes, and economic decisions

function buildEconomySection(context?: EconomyContext): string {
  if (!context) return "";

  const healthIcon = context.economicHealth === "booming" ? "📈" :
                     context.economicHealth === "growing" ? "📊" :
                     context.economicHealth === "stable" ? "⚖️" :
                     context.economicHealth === "struggling" ? "📉" : "💀";

  const phaseIcon = context.treasury.economicPhase === "modern" ? "🏦" :
                    context.treasury.economicPhase === "paper" ? "📜" :
                    context.treasury.economicPhase === "banking" ? "🏛️" :
                    context.treasury.economicPhase === "coined" ? "🪙" :
                    context.treasury.economicPhase === "commodity" ? "⚖️" : "🔄";

  let section = `## ${healthIcon} ECONOMY: ${context.economicHealth.toUpperCase()}

| Treasury | Amount |
|----------|--------|
| Gold Coins | ${context.treasury.goldCoins} |
| Silver Coins | ${context.treasury.silverCoins} |
| Copper Coins | ${context.treasury.copperCoins} |
| Total Debt | ${context.treasury.totalDebt} |
| Monthly Balance | ${context.treasury.lastMonthBalance >= 0 ? "+" : ""}${context.treasury.lastMonthBalance} |

**Economic Phase:** ${phaseIcon} ${context.treasury.economicPhase.charAt(0).toUpperCase() + context.treasury.economicPhase.slice(1)}
**Credit Rating:** ${context.treasury.creditRating}/100
**Inflation:** ${context.treasury.inflationRate.toFixed(1)}%`;

  if (context.treasury.debasementLevel > 10) {
    section += `\n⚠️ **Currency Debasement:** ${context.treasury.debasementLevel}% (reducing trust in your coins)`;
  }

  // Tax information
  section += `\n\n### Tax Policy
| Tax Type | Rate |
|----------|------|
| Land Tax | ${context.taxes.landTaxRate}% |
| Trade Tax | ${context.taxes.tradeTaxRate}% |
| Poll Tax | ${context.taxes.pollTaxRate}% |
| Luxury Tax | ${context.taxes.luxuryTaxRate}% |

Collection Efficiency: ${context.taxes.collectionEfficiency}%
Tax Evaders: ${context.taxes.taxEvaders}%
Happiness Impact: ${context.taxes.happinessImpact}`;

  // Labor market
  section += `\n\n### Labor Market
- Unskilled Wage: ${context.laborMarket.unskilledWage} coins
- Skilled Wage: ${context.laborMarket.skilledWage} coins
- Unemployment: ${context.laborMarket.unemployment}%
- Work Conditions: ${context.laborMarket.workConditions}`;

  // Active loans
  if (context.activeLoans.length > 0) {
    section += `\n\n### Outstanding Loans`;
    for (const loan of context.activeLoans) {
      section += `\n- ${loan.lenderType}: ${loan.amount} coins at ${loan.interestRate}% (${loan.monthsRemaining} months left)`;
    }
    const totalDebt = context.activeLoans.reduce((sum, l) => sum + l.amount, 0);
    if (totalDebt > context.treasury.totalWealth * 0.5) {
      section += `\n⚠️ **WARNING:** Heavy debt burden!`;
    }
  }

  // Banks
  if (context.bankCount > 0) {
    section += `\n\n🏦 **Banks:** ${context.bankCount} (enabling advanced finance)`;
  }

  // Price controls
  if (context.priceControls.length > 0) {
    section += `\n\n**Active Price Controls:** ${context.priceControls.join(", ")}`;
  }

  // Economic advice based on situation
  section += `\n\n### Economic Considerations`;
  if (context.treasury.inflationRate > 20) {
    section += `\n- 🔴 HIGH INFLATION: Your currency is losing value rapidly. Stop minting/debasing!`;
  }
  if (context.treasury.totalDebt > 0 && context.treasury.creditRating < 30) {
    section += `\n- 🔴 POOR CREDIT: You may not be able to borrow more. Risk of default!`;
  }
  if (context.laborMarket.unemployment > 25) {
    section += `\n- ⚠️ HIGH UNEMPLOYMENT: Many without work. Consider public works or lower taxes.`;
  }
  if (context.economicHealth === "booming") {
    section += `\n- 📈 BOOM TIME: Economy is thriving! Good time to invest or save for hard times.`;
  }

  return section;
}

// =============================================
// RELIGION INFLUENCE SECTION
// =============================================
// Shows how the territory's faith influences decision-making
// Religion has historically been the primary framework for morality and decisions

function buildReligionSection(context?: ReligionContext): string {
  if (!context || !context.stateReligion) return "";

  const sections: string[] = [];
  const religion = context.stateReligion;

  sections.push(`## ⛪ YOUR FAITH: ${religion.name}

*Your people worship ${religion.deity}. Faith shapes everything - from marriage to war, from laws to daily customs. Your decisions should honor your beliefs.*`);

  // Religious beliefs that guide decisions
  if (religion.beliefs && religion.beliefs.length > 0) {
    let beliefGuidance = `### Your Sacred Beliefs\n`;
    beliefGuidance += `These are the truths your people hold sacred:\n\n`;

    for (const belief of religion.beliefs) {
      // Interpret how each belief affects decisions
      let implication = "";

      if (belief.includes("sacred") || belief.includes("protected")) {
        implication = "→ Avoid unnecessary bloodshed and cruelty";
      } else if (belief.includes("afterlife") || belief.includes("rewards")) {
        implication = "→ Your people will sacrifice for the faith, knowing paradise awaits";
      } else if (belief.includes("ancestors")) {
        implication = "→ Honor traditions and protect family honor";
      } else if (belief.includes("Nature") || belief.includes("divine")) {
        implication = "→ Protect the land, avoid excessive exploitation";
      } else if (belief.includes("Strength") || belief.includes("weakness")) {
        implication = "→ Show no weakness, military strength is virtue";
      } else if (belief.includes("Compassion")) {
        implication = "→ Care for the weak and poor, avoid cruelty";
      } else if (belief.includes("Knowledge") || belief.includes("enlightenment")) {
        implication = "→ Build schools and libraries, value scholars";
      } else if (belief.includes("community") || belief.includes("Duty")) {
        implication = "→ Collective good over individual desires";
      } else if (belief.includes("War is holy")) {
        implication = "→ Holy wars against enemies of the faith are righteous";
      } else if (belief.includes("Peace")) {
        implication = "→ Seek diplomatic solutions, war is last resort";
      } else if (belief.includes("ruler") && belief.includes("divine")) {
        implication = "→ Your rule is divinely ordained, rebellion is sin";
      } else if (belief.includes("equal")) {
        implication = "→ Treat all classes fairly, avoid exploitation";
      }

      beliefGuidance += `- **"${belief}"** ${implication}\n`;
    }

    sections.push(beliefGuidance);
  }

  // Religious practices
  if (religion.practices && religion.practices.length > 0) {
    let practiceGuidance = `### Sacred Practices\n`;
    practiceGuidance += `These rituals bind your community together:\n`;

    for (const practice of religion.practices) {
      practiceGuidance += `- ${practice}\n`;
    }

    // Marriage emphasis
    if (religion.practices.includes("Marriage ceremonies")) {
      practiceGuidance += `\n**Marriage is a sacred institution.** Arrange marriages with proper religious ceremony. Same-faith marriages are blessed; interfaith unions may cause tension.`;
    }

    sections.push(practiceGuidance);
  }

  // Tolerance level affects diplomacy
  const toleranceDesc = religion.tolerance > 70 ? "accepting of other faiths" :
                        religion.tolerance > 40 ? "cautiously tolerant of other faiths" :
                        religion.tolerance > 20 ? "suspicious of other faiths" :
                        "hostile to other faiths - they are heretics";

  sections.push(`### Religious Tolerance: ${religion.tolerance}/100
Your religion is **${toleranceDesc}**.
${religion.tolerance < 40 ? "Consider: Convert or conquer those who follow false gods." : "Consider: Trade and diplomacy with other faiths is acceptable."}`);

  // Piety status
  let pietyAdvice = "";
  if (context.rulerPiety > 70) {
    pietyAdvice = `✨ **You are deeply pious (${context.rulerPiety}/100).** Your faith guides every decision. The faithful trust you.`;
  } else if (context.rulerPiety > 40) {
    pietyAdvice = `🙏 **You are moderately pious (${context.rulerPiety}/100).** Faith matters to you, but so do practical concerns.`;
  } else {
    pietyAdvice = `⚠️ **Your piety is low (${context.rulerPiety}/100).** The faithful may question your devotion. Consider building temples or holding religious festivals.`;
  }

  sections.push(`### Your Personal Faith
${pietyAdvice}

**Religious Infrastructure:**
- Temples: ${context.templeCount}
- Priests: ${context.priestCount}
- Average Population Piety: ${Math.round(context.averagePopulationPiety)}/100`);

  return sections.join("\n\n");
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

// =============================================
// EDUCATION & WORKFORCE SKILLS SECTION
// =============================================

export interface EducationContext {
  schools: Array<{ type: string; students: number; capacity: number }>;
  literacyRate: number;
  apprenticeCount: number;
  childrenInSchool: number;
  totalChildren: number;
  skilledWorkers: Record<string, { count: number; maxLevel: number }>;
  blockedActions?: Array<{ actionId: string; reason: string }>;
}

function buildEducationSection(context?: EducationContext): string {
  if (!context) return "";

  const sections: string[] = [];
  sections.push("## 📚 Education & Skilled Workers");

  // Education overview
  const educationLines: string[] = [];
  educationLines.push(`- **Literacy Rate:** ${context.literacyRate.toFixed(0)}% of population can read/write`);

  if (context.schools.length > 0) {
    const schoolSummary = context.schools.map(s => `${s.type} (${s.students}/${s.capacity})`).join(", ");
    educationLines.push(`- **Schools:** ${schoolSummary}`);
  } else {
    educationLines.push("- **Schools:** None - children learn only by watching adults (slow, limited to 15% of adult skill)");
  }

  if (context.apprenticeCount > 0) {
    educationLines.push(`- **Apprentices:** ${context.apprenticeCount} learning from masters (can reach 90% of master's skill)`);
  }

  if (context.totalChildren > 0) {
    const schooled = context.childrenInSchool;
    const unschooled = context.totalChildren - schooled;
    if (unschooled > 0) {
      educationLines.push(`- **Children:** ${context.totalChildren} (${schooled} in school, ${unschooled} NOT in school - consider building schools!)`);
    } else {
      educationLines.push(`- **Children:** ${context.totalChildren} (all in school!)`);
    }
  }

  sections.push(educationLines.join("\n"));

  // Skilled workers summary
  if (Object.keys(context.skilledWorkers).length > 0) {
    const skillLines: string[] = ["### Skilled Workers Available"];
    const sortedSkills = Object.entries(context.skilledWorkers)
      .sort((a, b) => b[1].maxLevel - a[1].maxLevel)
      .slice(0, 8);

    for (const [skill, data] of sortedSkills) {
      const tier = data.maxLevel >= 70 ? "Expert" : data.maxLevel >= 40 ? "Skilled" : "Novice";
      skillLines.push(`- **${skill}:** ${data.count} workers (${tier}, best level: ${data.maxLevel})`);
    }
    sections.push(skillLines.join("\n"));
  } else {
    sections.push("### Skilled Workers: NONE - Your population lacks specialized skills. Build schools and train apprentices!");
  }

  // Blocked actions due to missing skills
  if (context.blockedActions && context.blockedActions.length > 0) {
    const blockedLines: string[] = ["### ⚠️ Actions Blocked (Missing Skills)"];
    for (const blocked of context.blockedActions.slice(0, 5)) {
      blockedLines.push(`- **${blocked.actionId}:** ${blocked.reason}`);
    }
    blockedLines.push("\n*Train workers or hire specialists to unlock these actions!*");
    sections.push(blockedLines.join("\n"));
  }

  sections.push(`### 💡 Education Tips
- **Schools:** Children learn 3x faster than trial-and-error
- **Libraries:** Literate adults can self-study up to level 60
- **Apprenticeships:** Young people can reach 90% of master's skill
- **Universities:** Advanced learning up to level 75, +25% breakthrough chance
- **Knowledge persists:** Next generation inherits what this generation teaches!`);

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
  knowledgeContext?: KnowledgeContext,
  espionageContext?: EspionageContext,
  religionContext?: ReligionContext,
  educationContext?: EducationContext,
  sabotageContext?: SabotageMotiveContext,
  // NEW: 15 additional context systems
  weatherContext?: WeatherContext,
  disasterContext?: DisasterContext,
  infrastructureContext?: InfrastructureContext,
  dynastyContext?: DynastyContext,
  romanceContext?: RomanceContext,
  friendshipContext?: FriendshipContext,
  mentalHealthContext?: MentalHealthContext,
  addictionContext?: AddictionContext,
  warDemographicsContext?: WarDemographicsContext,
  genderContext?: GenderContext,
  expeditionContext?: ExpeditionContext,
  tradeContext?: TradeContext,
  diseaseContext?: DiseaseContext,
  rebellionContext?: RebellionContext,
  legitimacyContext?: LegitimacyContext,
  economyContext?: EconomyContext
): string {
  const seasonNames = ["Early Winter", "Late Winter", "Early Spring", "Spring", "Late Spring", "Early Summer", "Summer", "Late Summer", "Early Autumn", "Autumn", "Late Autumn", "Winter"];
  const seasonDisplay = seasonNames[worldContext.month - 1];
  const year = worldContext.tick; // Each tick is a "moon" or month

  // Build survival section
  const survivalSection = buildSurvivalSection(territory, worldContext.month);

  // Build knowledge section (organic tech progression)
  const knowledgeSection = buildKnowledgeSection(knowledgeContext);

  // Build espionage section (spy intelligence)
  const espionageSection = buildEspionageSection(espionageContext);

  // Build sabotage section (motivations for covert action)
  const sabotageSection = buildSabotageSection(sabotageContext);

  // Build religion section (faith-based guidance)
  const religionSection = buildReligionSection(religionContext);

  // Build all 15 new context sections
  const weatherSection = buildWeatherSection(weatherContext);
  const disasterSection = buildDisasterSection(disasterContext);
  const infrastructureSection = buildInfrastructureSection(infrastructureContext);
  const dynastySection = buildDynastySection(dynastyContext);
  const romanceSection = buildRomanceSection(romanceContext);
  const friendshipSection = buildFriendshipSection(friendshipContext);
  const mentalHealthSection = buildMentalHealthSection(mentalHealthContext);
  const addictionSection = buildAddictionSection(addictionContext);
  const warDemographicsSection = buildWarDemographicsSection(warDemographicsContext);
  const genderSection = buildGenderSection(genderContext);
  const expeditionSection = buildExpeditionSection(expeditionContext);
  const tradeSection = buildTradeSection(tradeContext);
  const diseaseSection = buildDiseaseSection(diseaseContext);
  const rebellionSection = buildRebellionSection(rebellionContext);
  const legitimacySection = buildLegitimacySection(legitimacyContext);
  const economySection = buildEconomySection(economyContext);

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

${buildEducationSection(educationContext)}

${espionageSection}

${sabotageSection}

${religionSection}

${weatherSection}

${disasterSection}

${infrastructureSection}

${dynastySection}

${romanceSection}

${friendshipSection}

${mentalHealthSection}

${addictionSection}

${warDemographicsSection}

${genderSection}

${expeditionSection}

${tradeSection}

${diseaseSection}

${rebellionSection}

${legitimacySection}

${economySection}

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

## 🎯 GUT FEELING DECISIONS - Trust Your Instincts!

**As a ruler, sometimes you just KNOW what your people need without analyzing every detail.**

Ask yourself these instinctive questions:

- **Do my people feel WEAK?** → Consider "harden_people" to toughen them through rigorous training
- **Is our bloodline deteriorating?** → Consider "strengthen_bloodline" to sire strong offspring, or "selective_marriages" for better genetics
- **Are our children too soft?** → Consider "spartan_upbringing" for warrior training from youth
- **Is the population a burden?** → The dark choice of "cull_the_weak" removes the unproductive (high cost to morale)
- **Can't decide rationally?** → Use "trust_instincts" and describe what your gut tells you

**These are gut decisions - they're not always optimal but they're HUMAN. A wise ruler balances logic with instinct. Sometimes you need to feel what's right rather than calculate it.**

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
