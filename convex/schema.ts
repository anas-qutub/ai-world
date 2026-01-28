import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Global simulation state
  world: defineTable({
    tick: v.number(),
    year: v.number(),
    month: v.number(), // 1-12
    season: v.optional(v.union(
      v.literal("spring"),
      v.literal("summer"),
      v.literal("autumn"),
      v.literal("winter")
    )), // Calculated from month
    speed: v.union(
      v.literal("paused"),
      v.literal("1x"),
      v.literal("10x"),
      v.literal("100x")
    ),
    status: v.union(
      v.literal("initializing"),
      v.literal("running"),
      v.literal("paused")
    ),
    lastTickAt: v.optional(v.number()), // timestamp
    // Technology era for global events
    currentEra: v.optional(v.string()), // "stone_age", "bronze_age", "iron_age", "medieval"
  }),

  // Territories (continents) with resources
  territories: defineTable({
    name: v.string(),
    color: v.string(), // hex color for map
    // Resources (0-100 scale unless noted)
    population: v.number(), // actual people count
    wealth: v.number(),
    food: v.number(),
    technology: v.number(),
    military: v.number(),
    happiness: v.number(),
    influence: v.number(),
    knowledge: v.number(),
    // Governance - starts as "none" (tribal), can evolve
    governance: v.optional(v.string()), // "none", "council", "chief", "democracy", "dictatorship", "theocracy", etc.
    leaderName: v.optional(v.string()), // Name of leader if applicable
    governmentName: v.optional(v.string()), // What they call their system
    // Cultural identity
    tribeName: v.optional(v.string()), // What they call themselves
    flag: v.optional(v.string()), // Description of their flag/symbol
    originStory: v.optional(v.string()), // Their creation myth / how they began
    // Language - structured storage
    languageNotes: v.optional(v.string()), // General notes about their language
    languageWords: v.optional(v.array(v.object({
      word: v.string(), // The invented word
      meaning: v.string(), // What it means
      type: v.optional(v.string()), // greeting, noun, verb, phrase, etc.
    }))),
    // Traditions and customs
    traditions: v.optional(v.array(v.object({
      name: v.string(), // Name of the tradition
      description: v.string(), // What it involves
      createdAtTick: v.optional(v.number()),
    }))),
    beliefs: v.optional(v.string()), // Their spiritual/philosophical beliefs
    // Natural resources unique to this territory
    naturalResources: v.optional(v.array(v.string())), // e.g., ["gold", "iron", "wheat"]
    // Accumulated civil unrest (natural tension system)
    unrest: v.optional(v.number()), // 0-∞, builds when happiness < expectations
    // Survival mechanics - Basic
    woodStockpile: v.optional(v.number()), // Wood for building and heating
    shelterCapacity: v.optional(v.number()), // How many people can be housed
    preservedFood: v.optional(v.number()), // Food preserved for winter (doesn't decay)

    // Survival mechanics - Water
    water: v.optional(v.object({
      stored: v.number(),           // Water in storage
      wells: v.number(),            // Number of wells
      hasRiver: v.boolean(),        // Access to river
      quality: v.number(),          // Water quality 0-100
    })),

    // Survival mechanics - Clothing
    clothing: v.optional(v.object({
      supply: v.number(),           // Clothing units available
      condition: v.number(),        // Average condition 0-100
    })),

    // Survival mechanics - Sanitation
    sanitation: v.optional(v.object({
      wasteLevel: v.number(),       // Accumulated waste
      sewerCapacity: v.number(),    // Waste handling capacity
      latrines: v.number(),         // Number of latrines
    })),

    // Survival mechanics - Food Preservation
    preservation: v.optional(v.object({
      preservedFood: v.number(),    // Preserved food amount
      salt: v.number(),             // Salt for preservation
      smokehouses: v.number(),      // Number of smokehouses
    })),

    // Survival mechanics - Medicine
    medicine: v.optional(v.object({
      herbs: v.number(),            // Medicinal herbs
    })),

    // Sick population tracking
    sickPopulation: v.optional(v.number()), // People currently sick

    // Survival Technology Discoveries
    discoveries: v.optional(v.object({
      discovered: v.array(v.string()),      // Tech IDs that have been discovered
      inProgress: v.array(v.object({
        techId: v.string(),
        progress: v.number(),               // 0-100
        startTick: v.number(),
      })),
      recentDiscovery: v.optional(v.object({
        techId: v.string(),
        tick: v.number(),
        discoveredBy: v.optional(v.string()), // Character name
      })),
    }))
    // Competition tracking - elimination mechanics
    isEliminated: v.optional(v.boolean()), // Territory has been eliminated
    eliminatedAtTick: v.optional(v.number()), // When they were eliminated
    lowPopulationStreak: v.optional(v.number()), // Consecutive ticks with pop < 5

    // =============================================
    // HUMAN LIFE SYSTEMS - GENDER DYNAMICS
    // =============================================
    genderRoles: v.optional(v.object({
      womenCanWork: v.boolean(),      // Women allowed in workforce
      womenCanOwn: v.boolean(),       // Women can own property
      womenCanRule: v.boolean(),      // Women can be rulers
      womenCanFight: v.boolean(),     // Women can serve in military
      progressLevel: v.number(),      // 0-100, how progressive
      lastReformTick: v.optional(v.number()),
    })),

    // =============================================
    // HUMAN LIFE SYSTEMS - WAR DEMOGRAPHICS
    // =============================================
    fightingPopulation: v.optional(v.object({
      eligibleMen: v.number(),        // Men 16-50 available
      eligibleWomen: v.number(),      // Women 16-50 (if allowed to fight)
      currentSoldiers: v.number(),    // Currently enlisted
      reserves: v.number(),           // Trained but not active
      casualties: v.number(),         // Lost in current/recent war
      widows: v.number(),             // Women who lost husbands to war
      orphans: v.number(),            // Children who lost fathers to war
      warWeariness: v.number(),       // 0-100, population tired of war
      lastConscriptionTick: v.optional(v.number()),
      emergencyMeasures: v.optional(v.union(
        v.literal("none"),
        v.literal("expanded_age"),    // 14-60 instead of 16-50
        v.literal("women_conscripted"), // Women forced to fight
        v.literal("child_soldiers")   // Terrible option, massive happiness penalty
      )),
    })),

    // =============================================
    // HUMAN LIFE SYSTEMS - ESPIONAGE
    // =============================================
    spyNetwork: v.optional(v.object({
      spymasterId: v.optional(v.id("characters")),
      budget: v.number(),             // Wealth allocated to espionage
      counterIntelligence: v.number(), // 0-100, ability to detect enemy spies
      knownEnemySpies: v.number(),    // Number of enemy spies detected
      ownSpiesActive: v.number(),     // Number of spies deployed
    })),
  }).index("by_name", ["name"]),

  // AI agent configuration per territory
  agents: defineTable({
    territoryId: v.id("territories"),
    provider: v.union(
      v.literal("anthropic"),
      v.literal("openai"),
      v.literal("xai")
    ),
    model: v.string(),
    personality: v.string(), // short description / archetype name
    systemPrompt: v.string(), // full system prompt
    lastDecisionAt: v.optional(v.number()),
    // Personality parameters for competitive AI differentiation (0-100 scale)
    personalityParams: v.optional(v.object({
      // === CORE STRATEGIC ===
      aggression: v.number(),      // 0-100: War tendency, prefers military solutions
      riskTolerance: v.number(),   // 0-100: Takes gambles vs safe plays
      cooperation: v.number(),     // 0-100: Trade/alliance friendly
      militarism: v.number(),      // 0-100: Military vs economic focus
      expansionism: v.number(),    // 0-100: Territory/population growth priority
      innovation: v.number(),      // 0-100: Tech research priority

      // === GOVERNANCE & POWER ===
      centralization: v.number(),  // 0-100: Local autonomy vs absolute central control
      authoritarianism: v.number(), // 0-100: Democratic/council vs autocratic rule

      // === ECONOMIC PHILOSOPHY ===
      taxation: v.number(),        // 0-100: Light taxes vs heavy extraction
      frugality: v.number(),       // 0-100: Extravagant spending vs austere savings
      mercantilism: v.number(),    // 0-100: Free trade vs protectionist hoarding

      // === SOCIAL & CULTURAL ===
      religiosity: v.number(),     // 0-100: Secular governance vs theocratic rule
      traditionalism: v.number(),  // 0-100: Progressive reform vs ancestral ways
      xenophobia: v.number(),      // 0-100: Cosmopolitan inclusive vs isolationist hostile

      // === LEADERSHIP PSYCHOLOGY ===
      paranoia: v.number(),        // 0-100: Trusting vs constant purges/spies
      ruthlessness: v.number(),    // 0-100: Merciful forgiving vs cruel examples
      patience: v.number(),        // 0-100: Short-term gains vs generational planning
      pragmatism: v.number(),      // 0-100: Idealistic principles vs "ends justify means"

      // === STRATEGIC MINDSET ===
      opportunism: v.number(),     // 0-100: Principled/predictable vs seizes any advantage
      defensiveness: v.number(),   // 0-100: Offensive preemptive vs fortress reactive
    })),
    // =============================================
    // EMERGENT GOALS - What drives the AI beyond survival
    // =============================================
    emergentGoals: v.optional(v.array(v.object({
      goalType: v.union(
        // Revenge goals
        v.literal("avenge_defeat"),     // Avenge a major military defeat
        v.literal("avenge_betrayal"),   // Punish a betrayer
        v.literal("reclaim_territory"), // Take back lost lands
        // Protection goals
        v.literal("protect_ally"),      // Defend a grateful ally
        v.literal("secure_borders"),    // Build impenetrable defenses
        v.literal("eliminate_threat"),  // Remove an existential threat
        // Legacy goals
        v.literal("build_wonder"),      // Create something lasting
        v.literal("spread_culture"),    // Cultural dominance
        v.literal("forge_empire"),      // Build the greatest civilization
        v.literal("achieve_peace"),     // End all wars
        // Survival goals
        v.literal("escape_elimination"),// Survive near-death
        v.literal("recover_prosperity") // Return to former glory
      ),

      // Target (if applicable)
      targetTerritoryId: v.optional(v.id("territories")),
      targetDescription: v.optional(v.string()),

      // Origin
      originTick: v.number(),
      originReason: v.string(),
      originMemoryId: v.optional(v.id("agentMemories")),

      // Progress
      progress: v.number(), // 0-100

      // Priority (how much this drives decisions)
      priority: v.number(), // 0-100

      // Status
      status: v.union(
        v.literal("active"),
        v.literal("achieved"),
        v.literal("abandoned"),
        v.literal("impossible")
      ),

      // Achievement
      achievedAtTick: v.optional(v.number()),
      achievementDescription: v.optional(v.string()),
    }))),
  }).index("by_territory", ["territoryId"]),

  // =============================================
  // ORGANIC AI GROWTH - MEMORY SYSTEM
  // =============================================

  // Agent memories - key events that shape AI personalities
  agentMemories: defineTable({
    agentId: v.id("agents"),
    territoryId: v.id("territories"),

    // Memory content
    memoryType: v.union(
      v.literal("war"),           // Wars fought
      v.literal("betrayal"),      // Times betrayed
      v.literal("alliance"),      // Alliances formed/broken
      v.literal("trade"),         // Major trade deals
      v.literal("crisis"),        // Survived crises (famine, plague)
      v.literal("victory"),       // Major victories
      v.literal("defeat"),        // Major defeats
      v.literal("gift"),          // Gifts received/given
      v.literal("insult"),        // Diplomatic insults
      v.literal("help"),          // Help received in crisis
      v.literal("conquest"),      // Territories conquered/lost
      v.literal("character_death") // Important character deaths
    ),

    // Who was involved
    targetTerritoryId: v.optional(v.id("territories")),
    characterId: v.optional(v.id("characters")),

    // What happened
    tick: v.number(),
    description: v.string(),

    // Emotional weight (-100 to +100, negative = bad memory)
    emotionalWeight: v.number(),

    // Does this memory fade over time?
    salience: v.number(), // 0-100, decreases over time unless reinforced

    // Has this memory been referenced in decisions?
    timesReferenced: v.number(),
    lastReferencedTick: v.optional(v.number()),
  })
    .index("by_agent", ["agentId"])
    .index("by_territory", ["territoryId"])
    .index("by_type", ["memoryType"])
    .index("by_target", ["targetTerritoryId"]),

  // =============================================
  // ORGANIC AI GROWTH - GRUDGES & GRATITUDE
  // =============================================

  // Civilization bonds - persistent emotional relationships
  civilizationBonds: defineTable({
    // The two civilizations involved
    fromTerritoryId: v.id("territories"),
    toTerritoryId: v.id("territories"),

    // Bond type (positive or negative)
    bondType: v.union(
      // Negative bonds (grudges)
      v.literal("blood_debt"),      // They killed our people
      v.literal("betrayal_grudge"), // They betrayed an alliance
      v.literal("theft_grudge"),    // They stole/raided from us
      v.literal("insult_grudge"),   // Unresolved insult
      v.literal("conquest_grudge"), // They conquered our lands
      // Positive bonds (gratitude)
      v.literal("savior_debt"),     // They saved us in crisis
      v.literal("gift_gratitude"),  // They gave generous gifts
      v.literal("alliance_bond"),   // Long faithful alliance
      v.literal("trade_bond"),      // Prosperous trade history
      v.literal("honor_respect")    // They showed honor in war
    ),

    // Intensity (-100 to +100, negative = grudge, positive = gratitude)
    intensity: v.number(),

    // Origin
    originTick: v.number(),
    originDescription: v.string(),
    originMemoryId: v.optional(v.id("agentMemories")),

    // Can this pass to successors?
    isHereditary: v.boolean(),
    generationsPassed: v.number(), // How many rulers it has survived

    // Status
    status: v.union(
      v.literal("active"),
      v.literal("dormant"),     // Temporarily inactive
      v.literal("resolved"),    // Formally resolved
      v.literal("forgotten")    // Faded from memory
    ),

    // Resolution tracking
    resolutionAttempts: v.optional(v.array(v.object({
      tick: v.number(),
      attempt: v.string(),
      outcome: v.string(),
    }))),

    // Decay
    lastReinforcedTick: v.number(),
  })
    .index("by_from", ["fromTerritoryId"])
    .index("by_to", ["toTerritoryId"])
    .index("by_type", ["bondType"])
    .index("by_status", ["status"]),

  // Bilateral relationships between territories
  relationships: defineTable({
    territory1Id: v.id("territories"),
    territory2Id: v.id("territories"),
    trust: v.number(), // -100 to +100
    status: v.union(
      v.literal("neutral"),
      v.literal("friendly"),
      v.literal("allied"),
      v.literal("tense"),
      v.literal("hostile"),
      v.literal("at_war")
    ),
    hasTradeAgreement: v.boolean(),
    hasAlliance: v.boolean(),
    lastInteractionTick: v.optional(v.number()),
    // War resolution tracking
    pendingPeaceOffer: v.optional(v.id("territories")), // Which territory offered peace
    peaceOfferTerms: v.optional(v.string()), // Description of the peace terms
    warStartTick: v.optional(v.number()), // When the war started
    surrenderedTo: v.optional(v.id("territories")), // If one side surrendered
    // Deep simulation additions
    warExhaustion: v.optional(v.number()), // 0-100, accumulated war fatigue
    warScore: v.optional(v.number()), // -100 to +100, who's winning
    // Organic war emergence tracking
    warCasusBelli: v.optional(v.string()), // Reason for war (casus belli)
    lastAttackedBy: v.optional(v.id("territories")), // Who attacked last
    lastAttackedTick: v.optional(v.number()), // When last attack occurred
    recentIncidents: v.optional(v.number()), // Count of recent border incidents
    lastIncidentTick: v.optional(v.number()), // When last incident occurred
  })
    .index("by_territories", ["territory1Id", "territory2Id"])
    .index("by_territory1", ["territory1Id"])
    .index("by_territory2", ["territory2Id"]),

  // AI decision history
  decisions: defineTable({
    territoryId: v.id("territories"),
    tick: v.number(),
    action: v.string(), // action type
    targetTerritoryId: v.optional(v.id("territories")),
    reasoning: v.string(), // AI's explanation
    parameters: v.optional(v.any()), // action-specific params
    effects: v.optional(v.any()), // what changed as a result
    createdAt: v.number(),
  })
    .index("by_territory", ["territoryId"])
    .index("by_tick", ["tick"])
    .index("by_territory_tick", ["territoryId", "tick"]),

  // Activity log for feed
  events: defineTable({
    tick: v.number(),
    type: v.union(
      v.literal("decision"),
      v.literal("trade"),
      v.literal("alliance"),
      v.literal("war"),
      v.literal("disaster"),
      v.literal("breakthrough"),
      v.literal("crisis"),
      v.literal("population_boom"),
      v.literal("system"),
      v.literal("milestone"),      // First-to achievements
      v.literal("world_event"),    // Global events (plagues, famines, etc.)
      v.literal("nuclear")         // Nuclear-related events
    ),
    territoryId: v.optional(v.id("territories")),
    targetTerritoryId: v.optional(v.id("territories")),
    title: v.string(),
    description: v.string(),
    severity: v.union(
      v.literal("info"),
      v.literal("positive"),
      v.literal("negative"),
      v.literal("critical")
    ),
    createdAt: v.number(),
  })
    .index("by_tick", ["tick"])
    .index("by_territory", ["territoryId"])
    .index("by_created", ["createdAt"]),

  // =============================================
  // DEEP SIMULATION SYSTEM - PHASE 1: ECONOMY
  // =============================================

  // Resource deposits with depletion
  resources: defineTable({
    territoryId: v.id("territories"),
    type: v.string(), // "iron_ore", "timber", "wheat", "gold", etc.
    quantity: v.number(), // Current available amount
    maxQuantity: v.number(), // Maximum capacity
    regenerationRate: v.number(), // Per tick regeneration (0 for non-renewable)
    depletionLevel: v.number(), // 0-100, affects extraction efficiency
    discovered: v.boolean(), // Whether territory knows about this deposit
  })
    .index("by_territory", ["territoryId"])
    .index("by_type", ["type"]),

  // Production buildings
  buildings: defineTable({
    territoryId: v.id("territories"),
    type: v.string(), // "farm", "mine", "workshop", "barracks", "market", "academy"
    name: v.optional(v.string()), // Custom name if given
    level: v.number(), // 1-5
    workers: v.number(), // Assigned workers
    maxWorkers: v.number(), // Maximum worker capacity
    outputPerTick: v.number(), // Base production rate
    maintenanceCost: v.number(), // Food/wealth upkeep per tick
    condition: v.number(), // 0-100, degrades over time
    constructedAtTick: v.number(),
  })
    .index("by_territory", ["territoryId"])
    .index("by_type", ["type"]),

  // Market prices (supply/demand dynamics)
  marketPrices: defineTable({
    territoryId: v.id("territories"),
    resourceType: v.string(),
    currentPrice: v.number(), // Base price multiplier (1.0 = normal)
    supply: v.number(), // Available for sale
    demand: v.number(), // Desired by population
    lastUpdatedTick: v.number(),
  })
    .index("by_territory", ["territoryId"])
    .index("by_resource", ["resourceType"]),

  // =============================================
  // DEEP SIMULATION SYSTEM - PHASE 2: TRADE
  // =============================================

  // Trade routes between territories
  tradeRoutes: defineTable({
    territory1Id: v.id("territories"),
    territory2Id: v.id("territories"),
    distance: v.number(), // Ticks to travel
    risk: v.number(), // 0-100 caravan loss chance per trip
    isActive: v.boolean(),
    establishedAtTick: v.number(),
    totalTradeVolume: v.number(), // Cumulative goods traded
  })
    .index("by_territory1", ["territory1Id"])
    .index("by_territory2", ["territory2Id"]),

  // Moving caravans
  caravans: defineTable({
    originId: v.id("territories"),
    destinationId: v.id("territories"),
    goods: v.array(v.object({
      type: v.string(),
      quantity: v.number(),
      purchasePrice: v.number(),
    })),
    departedTick: v.number(),
    arrivalTick: v.number(),
    status: v.union(
      v.literal("traveling"),
      v.literal("arrived"),
      v.literal("raided"),
      v.literal("lost")
    ),
    guardStrength: v.number(), // Military protection
  })
    .index("by_origin", ["originId"])
    .index("by_destination", ["destinationId"])
    .index("by_status", ["status"]),

  // =============================================
  // DEEP SIMULATION SYSTEM - PHASE 3: DEMOGRAPHICS
  // =============================================

  // Age distribution per territory
  demographics: defineTable({
    territoryId: v.id("territories"),
    children: v.number(), // Ages 0-14
    adults: v.number(), // Ages 15-49
    elderly: v.number(), // Ages 50+
    birthRate: v.number(), // Per 1000 adults per tick
    deathRate: v.number(), // Per 1000 population per tick
    immigrationRate: v.number(), // Net migration
    lastUpdatedTick: v.number(),
  }).index("by_territory", ["territoryId"]),

  // Social classes with needs and productivity
  socialClasses: defineTable({
    territoryId: v.id("territories"),
    className: v.string(), // "noble", "warrior", "merchant", "craftsman", "farmer", "slave"
    population: v.number(),
    happiness: v.number(), // 0-100
    productivityModifier: v.number(), // 0.5-2.0
    wealthShare: v.number(), // Percentage of territory wealth owned
    politicalPower: v.number(), // 0-100, influence on decisions
  })
    .index("by_territory", ["territoryId"])
    .index("by_class", ["className"]),

  // Internal factions that can rebel
  factions: defineTable({
    territoryId: v.id("territories"),
    name: v.string(),
    type: v.string(), // "political", "religious", "economic", "military", "ethnic"
    ideology: v.optional(v.string()), // What they believe
    power: v.number(), // 0-100, political influence
    happiness: v.number(), // 0-100, satisfaction with current state
    rebellionRisk: v.number(), // 0-100, chance of uprising
    memberCount: v.number(),
    leaderId: v.optional(v.string()), // Name of faction leader
    foundedAtTick: v.number(),
  })
    .index("by_territory", ["territoryId"])
    .index("by_type", ["type"]),

  // Active rebellions
  rebellions: defineTable({
    territoryId: v.id("territories"),
    factionId: v.id("factions"),
    startedAtTick: v.number(),
    strength: v.number(), // 0-100
    demands: v.string(),
    status: v.union(
      v.literal("active"),
      v.literal("suppressed"),
      v.literal("successful"),
      v.literal("negotiated")
    ),
  })
    .index("by_territory", ["territoryId"])
    .index("by_status", ["status"]),

  // Spreading diseases
  diseases: defineTable({
    name: v.string(),
    type: v.string(), // "plague", "fever", "pox", "cholera"
    mortalityRate: v.number(), // Percentage of infected who die
    spreadRate: v.number(), // How fast it spreads
    affectedTerritories: v.array(v.id("territories")),
    originTerritoryId: v.id("territories"),
    startedAtTick: v.number(),
    status: v.union(
      v.literal("spreading"),
      v.literal("contained"),
      v.literal("ended")
    ),
  })
    .index("by_status", ["status"])
    .index("by_origin", ["originTerritoryId"]),

  // =============================================
  // DEEP SIMULATION SYSTEM - PHASE 4: MILITARY
  // =============================================

  // Armies as distinct entities
  armies: defineTable({
    territoryId: v.id("territories"), // Owner
    name: v.string(),
    locationId: v.id("territories"), // Current location
    units: v.array(v.object({
      type: v.string(), // "militia", "infantry", "cavalry", "archer", "siege"
      count: v.number(),
      experience: v.number(), // 0-100
      morale: v.number(), // 0-100
      equipment: v.number(), // 0-100, quality of gear
    })),
    supplies: v.number(), // Days of food/supplies
    status: v.union(
      v.literal("garrison"),
      v.literal("marching"),
      v.literal("besieging"),
      v.literal("battling"),
      v.literal("retreating"),
      v.literal("disbanded")
    ),
    commanderName: v.optional(v.string()),
    createdAtTick: v.number(),
  })
    .index("by_territory", ["territoryId"])
    .index("by_location", ["locationId"])
    .index("by_status", ["status"]),

  // Active sieges
  sieges: defineTable({
    attackerArmyId: v.id("armies"),
    defenderTerritoryId: v.id("territories"),
    defenderArmyId: v.optional(v.id("armies")),
    fortificationLevel: v.number(), // Starting defense
    currentDefense: v.number(), // Current defense HP
    progress: v.number(), // 0-100, siege progress
    startedAtTick: v.number(),
    status: v.union(
      v.literal("ongoing"),
      v.literal("assault"),
      v.literal("breached"),
      v.literal("lifted"),
      v.literal("successful")
    ),
  })
    .index("by_defender", ["defenderTerritoryId"])
    .index("by_attacker", ["attackerArmyId"]),

  // Defensive structures
  fortifications: defineTable({
    territoryId: v.id("territories"),
    type: v.string(), // "palisade", "wooden_wall", "stone_wall", "castle", "fortress"
    level: v.number(), // 1-5
    health: v.number(), // 0-100
    maxHealth: v.number(),
    defenseBonus: v.number(), // Multiplier for defenders
    constructedAtTick: v.number(),
    lastRepairedTick: v.optional(v.number()),
  }).index("by_territory", ["territoryId"]),

  // Battle records
  battles: defineTable({
    attackerTerritoryId: v.id("territories"),
    defenderTerritoryId: v.id("territories"),
    attackerArmyId: v.id("armies"),
    defenderArmyId: v.optional(v.id("armies")),
    locationId: v.id("territories"),
    tick: v.number(),
    attackerLosses: v.number(),
    defenderLosses: v.number(),
    winner: v.union(v.literal("attacker"), v.literal("defender"), v.literal("draw")),
    description: v.string(),
  })
    .index("by_tick", ["tick"])
    .index("by_attacker", ["attackerTerritoryId"])
    .index("by_defender", ["defenderTerritoryId"]),

  // =============================================
  // DEEP SIMULATION SYSTEM - PHASE 5: TECHNOLOGY
  // =============================================

  // Territory tech progress
  technologies: defineTable({
    territoryId: v.id("territories"),
    techId: v.string(),
    researched: v.boolean(),
    researchProgress: v.number(), // 0-100
    researchStartedTick: v.optional(v.number()),
    researchedAtTick: v.optional(v.number()),
  })
    .index("by_territory", ["territoryId"])
    .index("by_tech", ["techId"]),

  // Static tech tree definitions (seeded once)
  techTree: defineTable({
    techId: v.string(),
    name: v.string(),
    description: v.string(),
    era: v.string(), // "stone_age", "bronze_age", "iron_age", "medieval"
    category: v.string(), // "military", "economy", "society", "science"
    prerequisites: v.array(v.string()), // Required tech IDs
    knowledgeCost: v.number(), // Knowledge points to research
    unlocks: v.array(v.object({
      type: v.string(), // "building", "unit", "action", "bonus"
      id: v.string(),
      description: v.string(),
    })),
  })
    .index("by_era", ["era"])
    .index("by_category", ["category"]),

  // =============================================
  // ORGANIC KNOWLEDGE PROGRESSION SYSTEM
  // =============================================

  // Population skill aggregation - tracks collective knowledge per territory
  // Technologies unlock when enough of your population has skill in related areas
  populationSkills: defineTable({
    territoryId: v.id("territories"),
    skillType: v.string(), // "smithing", "farming", "literacy", "carpentry", etc.

    // Population counts at each skill tier
    noviceCount: v.number(),     // 0-29 skill (learning)
    skilledCount: v.number(),    // 30-69 skill (competent)
    expertCount: v.number(),     // 70-89 skill (master)
    legendaryCount: v.number(),  // 90+ skill (genius)

    // Percentages (calculated from territory population)
    skilledPercent: v.number(),  // % of population that is skilled+
    expertPercent: v.number(),   // % of population that is expert+

    // Aggregate stats
    totalSkillPoints: v.number(),    // Sum of all skill levels
    averageLevel: v.number(),        // Average among all with this skill
    averageExpertLevel: v.number(),  // Average among experts only

    // Knowledge accumulation
    collectiveKnowledge: v.number(), // Grows as people practice (0-1000+)
    knowledgeGainThisTick: v.number(),

    lastUpdatedTick: v.number(),
  })
    .index("by_territory", ["territoryId"])
    .index("by_skill", ["skillType"])
    .index("by_territory_skill", ["territoryId", "skillType"]),

  // =============================================
  // ENGAGEMENT SYSTEMS - PHASE 6
  // =============================================

  // Characters with deep psychology
  characters: defineTable({
    territoryId: v.id("territories"),

    // Identity
    name: v.string(),
    title: v.string(), // "King", "General", "Advisor", "Heir", "Rival"
    role: v.union(
      v.literal("ruler"),
      v.literal("heir"),
      v.literal("general"),
      v.literal("advisor"),
      v.literal("rival"),
      v.literal("rebel_leader")
    ),

    // Lifecycle
    birthTick: v.number(),
    deathTick: v.optional(v.number()),
    deathCause: v.optional(v.string()),
    isAlive: v.boolean(),
    age: v.number(), // Current age in years (characters don't die of old age)

    // Health & Wounds (characters can be wounded in war, need medication to heal)
    isWounded: v.optional(v.boolean()),      // Currently wounded
    woundSeverity: v.optional(v.number()),   // 1-100, higher = more severe
    woundedAtTick: v.optional(v.number()),   // When they were wounded
    woundCause: v.optional(v.string()),      // "battle", "assassination_attempt", "accident"
    healingProgress: v.optional(v.number()), // 0-100, healing progress with medication
    medicationTested: v.optional(v.array(v.object({
      medicationType: v.string(),            // "herbal", "surgical", "experimental", "spiritual"
      tick: v.number(),
      effectiveness: v.number(),             // 0-100, how well it worked
      sideEffects: v.optional(v.string()),   // Any negative effects
    }))),

    // Exile status
    isExiled: v.optional(v.boolean()),       // Currently in exile
    exileTick: v.optional(v.number()),       // When they were exiled
    exileReason: v.optional(v.string()),     // Why they were exiled

    // Family & Population Origin
    parentId: v.optional(v.id("characters")), // Reference to parent character (for dynasty tracking)
    isFromPopulation: v.optional(v.boolean()), // True if spawned from population growth (not initial setup)
    lifeStage: v.optional(v.union(
      v.literal("child"),   // Under 16 years
      v.literal("adult"),   // 16-59 years
      v.literal("elder")    // 60+ years
    )),

    // PSYCHOLOGY - Core Traits (0-100)
    traits: v.object({
      // Power & Ambition
      ambition: v.number(),     // Desire for power. High = plots for throne
      greed: v.number(),        // Desire for wealth. High = embezzles, corrupt

      // Moral Character
      loyalty: v.number(),      // Faithfulness. Low = will betray
      honor: v.number(),        // Sense of duty/integrity. High = keeps oaths
      cruelty: v.number(),      // Ruthlessness. High = executes rivals
      compassion: v.number(),   // Empathy. High = merciful decisions
      justice: v.number(),      // Fairness to subjects. High = fair laws, reduces unrest
      generosity: v.number(),   // Willingness to share wealth. High = beloved but costly

      // Mental Traits
      cunning: v.number(),      // Scheming ability. High = plots succeed
      wisdom: v.number(),       // Good judgment. High = better decisions
      paranoia: v.number(),     // Suspicion. High = purges advisors
      vigilance: v.number(),    // Awareness of threats. High = detects plots early

      // Emotional Traits
      courage: v.number(),      // Bravery. High = leads battles personally
      pride: v.number(),        // Self-regard. High = won't back down, easily insulted
      wrath: v.number(),        // Anger/vengefulness. High = holds grudges

      // Social Traits
      charisma: v.number(),     // Likability. High = inspires loyalty
      diplomacy: v.number(),    // Negotiation skill. High = better deals

      // Combat Traits
      strength: v.number(),     // Physical/military prowess. Grows with kills, boosts combat
    }),

    // Combat experience tracking
    killCount: v.optional(v.number()),        // Total enemies killed in battle
    battlesParticipated: v.optional(v.number()), // Battles personally fought in
    duelsWon: v.optional(v.number()),         // One-on-one combat victories

    // Current emotional state (temporary, changes based on events)
    emotionalState: v.object({
      hope: v.number(),         // 0-100, optimism about the future
      fear: v.number(),         // 0-100, anxiety about threats
      shame: v.number(),        // 0-100, guilt from failures/dishonor
      despair: v.number(),      // 0-100, hopelessness
      contentment: v.number(),  // 0-100, satisfaction with life
      rage: v.number(),         // 0-100, active anger
    }),

    // Hidden Agenda (what they secretly want)
    secretGoal: v.optional(v.union(
      v.literal("seize_throne"),
      v.literal("accumulate_wealth"),
      v.literal("revenge"),
      v.literal("protect_family"),
      v.literal("foreign_allegiance"),
      v.literal("religious_dominance"),
      v.literal("independence"),
      v.literal("glory"),
      v.literal("none")
    )),
    secretGoalTarget: v.optional(v.string()),

    // Relationships with other characters
    relationships: v.array(v.object({
      characterId: v.id("characters"),
      type: v.union(
        v.literal("ally"),
        v.literal("enemy"),
        v.literal("rival"),
        v.literal("lover"),
        v.literal("mentor"),
        v.literal("puppet"),
        v.literal("friend"),
        v.literal("nemesis")
      ),
      strength: v.number(), // -100 to 100
      isSecret: v.boolean(),
    })),

    // Active plots (secret schemes)
    activePlots: v.array(v.object({
      plotType: v.string(), // "coup", "assassination", "embezzlement", "sabotage", "defection"
      targetId: v.optional(v.id("characters")),
      startTick: v.number(),
      progressPercent: v.number(), // 0-100, triggers when reaches 100
      discovered: v.boolean(),
      conspirators: v.array(v.id("characters")),
    })),

    // For rulers
    coronationTick: v.optional(v.number()),
    dynastyName: v.optional(v.string()),
    dynastyGeneration: v.optional(v.number()),

    // =============================================
    // RULER LEGITIMACY & POPULAR TRUST
    // =============================================
    // How the ruler gained power (affects starting legitimacy)
    legitimacySource: v.optional(v.union(
      v.literal("inheritance"),    // Rightful heir - high legitimacy
      v.literal("election"),       // Chosen by council/people - medium-high
      v.literal("conquest"),       // Won through war - medium
      v.literal("coup"),           // Seized power violently - low
      v.literal("rebellion"),      // Rose from rebellion - low
      v.literal("appointment"),    // Appointed by external power - varies
      v.literal("divine_mandate"), // Religious claim - high if people believe
      v.literal("founding")        // Founded the civilization - very high
    )),

    // Legitimacy: How valid their claim to rule is (0-100)
    // Affects: rebellion risk, coup success, diplomatic respect
    legitimacy: v.optional(v.number()),

    // Popular Trust: How much the people trust THIS ruler (0-100)
    // Different from territory happiness - tracks ruler's personal reputation
    popularTrust: v.optional(v.number()),

    // Track record that affects trust
    trustRecord: v.optional(v.object({
      promisesKept: v.number(),      // Alliances honored, treaties kept
      promisesBroken: v.number(),    // Betrayals, broken deals
      warsWon: v.number(),
      warsLost: v.number(),
      crisesSurvived: v.number(),    // Famines, plagues overcome
      crisesFailed: v.number(),      // Disasters that killed many
      corruptionScandals: v.number(), // Embezzlement, court corruption exposed
      popularDecisions: v.number(),  // Decisions that helped people
      unpopularDecisions: v.number(), // Harsh taxes, conscription, etc.
    })),

    // Reign stats (for rulers, calculated on death)
    reignSummary: v.optional(v.object({
      yearsReigned: v.number(),
      warsStarted: v.number(),
      warsWon: v.number(),
      plotsSurvived: v.number(),
      advisorsExecuted: v.number(),
      obituary: v.string(),
    })),

    // Notable deeds that build reputation
    deeds: v.array(v.object({
      tick: v.number(),
      description: v.string(),
      type: v.string(), // "heroic", "villainous", "wise", "foolish", "merciful", "cruel"
    })),

    // =============================================
    // PROFESSION & SKILLS SYSTEM
    // =============================================
    // Primary profession (what they do for a living)
    profession: v.optional(v.union(
      // Leadership/Administrative
      v.literal("ruler"),
      v.literal("noble"),
      v.literal("administrator"),
      v.literal("tax_collector"),
      v.literal("diplomat"),
      // Military
      v.literal("soldier"),
      v.literal("general"),
      v.literal("guard"),
      v.literal("mercenary"),
      // Religious
      v.literal("priest"),
      v.literal("monk"),
      v.literal("oracle"),
      // Crafts
      v.literal("blacksmith"),
      v.literal("carpenter"),
      v.literal("mason"),
      v.literal("weaver"),
      v.literal("potter"),
      v.literal("jeweler"),
      // Knowledge
      v.literal("scholar"),
      v.literal("teacher"),
      v.literal("scribe"),
      v.literal("physician"),
      v.literal("engineer"),
      v.literal("alchemist"),
      // Commerce
      v.literal("merchant"),
      v.literal("trader"),
      v.literal("banker"),
      v.literal("innkeeper"),
      // Agriculture
      v.literal("farmer"),
      v.literal("herder"),
      v.literal("fisherman"),
      v.literal("hunter"),
      // Labor
      v.literal("miner"),
      v.literal("laborer"),
      v.literal("servant"),
      // Justice
      v.literal("judge"),
      v.literal("lawkeeper"),
      // Other
      v.literal("artisan"),
      v.literal("entertainer"),
      v.literal("slave"),
      v.literal("unemployed")
    )),
    professionStartTick: v.optional(v.number()),
    professionYearsExperience: v.optional(v.number()),

    // Skills (0-100, grow with practice and education)
    skills: v.optional(v.object({
      // Combat skills
      melee: v.number(),        // Sword, axe, close combat
      ranged: v.number(),       // Bow, crossbow, throwing
      tactics: v.number(),      // Military strategy
      // Craft skills
      smithing: v.number(),     // Metalworking
      carpentry: v.number(),    // Woodworking
      masonry: v.number(),      // Stonework, construction
      tailoring: v.number(),    // Cloth, leather
      // Knowledge skills
      literacy: v.number(),     // Reading and writing
      mathematics: v.number(),  // Numbers, accounting
      medicine: v.number(),     // Healing, surgery
      engineering: v.number(),  // Building, machines
      law: v.number(),          // Legal knowledge
      theology: v.number(),     // Religious knowledge
      history: v.number(),      // Historical knowledge
      // Social skills
      persuasion: v.number(),   // Convincing others
      intimidation: v.number(), // Scaring others
      negotiation: v.number(),  // Dealmaking
      // Trade skills
      trading: v.number(),      // Buying/selling
      farming: v.number(),      // Agriculture
      animalcare: v.number(),   // Herding, husbandry
      mining: v.number(),       // Resource extraction
    })),

    // =============================================
    // EDUCATION & LITERACY
    // =============================================
    isLiterate: v.optional(v.boolean()),
    educationLevel: v.optional(v.union(
      v.literal("none"),           // Cannot read/write
      v.literal("basic"),          // Can read simple texts
      v.literal("intermediate"),   // Can read complex texts, basic math
      v.literal("advanced"),       // Scholar-level education
      v.literal("master")          // Expert in a field
    )),
    educationField: v.optional(v.string()), // "military", "religious", "law", "medicine", "engineering"
    currentlyStudying: v.optional(v.boolean()),
    teacherId: v.optional(v.id("characters")),
    studyProgress: v.optional(v.number()), // 0-100 toward next education level
    apprenticeMasterId: v.optional(v.id("characters")), // For craft apprenticeships

    // =============================================
    // RELIGION
    // =============================================
    faith: v.optional(v.id("religions")), // Which religion they follow
    piety: v.optional(v.number()),        // 0-100, devotion level
    religiousRank: v.optional(v.union(
      v.literal("layperson"),
      v.literal("acolyte"),
      v.literal("priest"),
      v.literal("high_priest"),
      v.literal("prophet")
    )),

    // =============================================
    // GUILD MEMBERSHIP
    // =============================================
    guildId: v.optional(v.id("guilds")),
    guildRank: v.optional(v.union(
      v.literal("apprentice"),
      v.literal("journeyman"),
      v.literal("master"),
      v.literal("grandmaster")
    )),
    guildJoinTick: v.optional(v.number()),

    // =============================================
    // JUDICIAL STATUS
    // =============================================
    criminalRecord: v.optional(v.array(v.object({
      crime: v.string(),
      tick: v.number(),
      verdict: v.string(), // "guilty", "innocent", "pardoned"
      punishment: v.optional(v.string()),
    }))),
    isImprisoned: v.optional(v.boolean()),
    prisonSentenceTicks: v.optional(v.number()),
    prisonStartTick: v.optional(v.number()),

    // =============================================
    // HUMAN LIFE SYSTEMS - GENDER & DEMOGRAPHICS
    // =============================================
    gender: v.optional(v.union(v.literal("male"), v.literal("female"))),
    canFight: v.optional(v.boolean()),     // Based on gender rules + age
    fightingAge: v.optional(v.boolean()),  // True if 16-50 for men (default rules)

    // =============================================
    // HUMAN LIFE SYSTEMS - MARRIAGE
    // =============================================
    spouseId: v.optional(v.id("characters")),
    marriageId: v.optional(v.id("marriages")),
    isMarried: v.optional(v.boolean()),

    // =============================================
    // HUMAN LIFE SYSTEMS - MENTAL HEALTH
    // =============================================
    mentalHealth: v.optional(v.object({
      sanity: v.number(),           // 0-100, overall mental stability
      trauma: v.number(),           // 0-100, accumulated trauma
      depression: v.number(),       // 0-100, sadness/hopelessness
      anxiety: v.number(),          // 0-100, worry/fear
      ptsd: v.boolean(),            // Has PTSD from traumatic events
      madness: v.optional(v.union(
        v.literal("paranoid"),      // Sees plots everywhere
        v.literal("megalomaniac"),  // Believes they are destined for greatness
        v.literal("violent"),       // Prone to violent outbursts
        v.literal("delusional"),    // Believes false things
        v.literal("depressive"),    // Deep chronic depression
        v.literal("manic")          // Extreme mood swings
      )),
      inTherapy: v.boolean(),
      therapyProgress: v.optional(v.number()), // 0-100
      lastTraumaticEvent: v.optional(v.string()),
      lastTraumaticEventTick: v.optional(v.number()),
    })),

    // =============================================
    // HUMAN LIFE SYSTEMS - ADDICTION
    // =============================================
    hasAddiction: v.optional(v.boolean()),
    addictionType: v.optional(v.string()),
    addictionId: v.optional(v.id("addictions")),

    // =============================================
    // HUMAN LIFE SYSTEMS - FRIENDSHIP
    // =============================================
    bestFriendId: v.optional(v.id("characters")),
    friendCount: v.optional(v.number()),
  })
    .index("by_territory", ["territoryId"])
    .index("by_role", ["role"])
    .index("by_alive", ["isAlive"])
    .index("by_profession", ["profession"])
    .index("by_guild", ["guildId"])
    .index("by_gender", ["gender"]),

  // Succession events for drama
  successionEvents: defineTable({
    territoryId: v.id("territories"),
    tick: v.number(),

    deceasedRulerId: v.id("characters"),
    newRulerId: v.id("characters"),

    successionType: v.union(
      v.literal("peaceful"),
      v.literal("coup"),
      v.literal("civil_war"),
      v.literal("assassination"),
      v.literal("election"),
      v.literal("conquest")
    ),

    // Drama details
    plottersExecuted: v.number(),
    civilWarCasualties: v.optional(v.number()),
    narrative: v.string(),
  })
    .index("by_territory", ["territoryId"])
    .index("by_tick", ["tick"]),

  // Named wars with chronicles
  wars: defineTable({
    name: v.string(), // "The War of Iron Rivers"

    // Participants
    aggressorId: v.id("territories"),
    defenderId: v.id("territories"),

    // Leaders at war start (for narrative)
    aggressorRulerId: v.optional(v.id("characters")),
    defenderRulerId: v.optional(v.id("characters")),

    // Timeline
    startTick: v.number(),
    endTick: v.optional(v.number()),

    // Cause
    causeType: v.string(), // "territorial", "revenge", "succession", "trade", "religion", "honor"
    causeDescription: v.string(),

    // Statistics
    casualties: v.object({
      aggressor: v.number(),
      defender: v.number(),
    }),

    majorBattles: v.array(v.object({
      name: v.string(),
      tick: v.number(),
      winner: v.string(),
      casualties: v.number(),
      description: v.optional(v.string()),
    })),

    // Outcome
    outcome: v.optional(v.string()),
    peaceTerms: v.optional(v.string()),
    narrative: v.optional(v.string()),

    status: v.union(v.literal("active"), v.literal("ended")),
  })
    .index("by_aggressor", ["aggressorId"])
    .index("by_defender", ["defenderId"])
    .index("by_status", ["status"]),

  // Leaderboard snapshots
  leaderboardSnapshots: defineTable({
    tick: v.number(),
    category: v.string(), // "population", "military", "wealth", "technology", "happiness", "influence", "knowledge"

    rankings: v.array(v.object({
      territoryId: v.id("territories"),
      territoryName: v.string(),
      value: v.number(),
      rank: v.number(),
      previousRank: v.optional(v.number()),
      change: v.optional(v.number()), // Rank change (+1 = moved up, -1 = moved down)
    })),
  })
    .index("by_tick", ["tick"])
    .index("by_category", ["category"]),

  // Streaks
  streaks: defineTable({
    territoryId: v.id("territories"),
    streakType: v.string(), // "peace", "dynasty", "winning", "prosperity", "alliance", "expansion"
    startTick: v.number(),
    currentLength: v.number(), // In ticks (months)
    isActive: v.boolean(),
    endTick: v.optional(v.number()),
    endReason: v.optional(v.string()),
  })
    .index("by_territory", ["territoryId"])
    .index("by_type", ["streakType"])
    .index("by_active", ["isActive"]),

  // Records
  records: defineTable({
    recordType: v.string(), // "longest_peace", "bloodiest_war", "longest_dynasty", "highest_population", etc.
    territoryId: v.id("territories"),
    territoryName: v.string(),
    value: v.number(),
    setAtTick: v.number(),
    rulerId: v.optional(v.id("characters")),
    rulerName: v.optional(v.string()),
    description: v.optional(v.string()),
  })
    .index("by_type", ["recordType"])
    .index("by_territory", ["territoryId"]),

  // Tension indicators
  tensionIndicators: defineTable({
    territoryId: v.id("territories"),
    tick: v.number(),

    // Probabilities (0-100)
    warLikelihood: v.number(),
    coupLikelihood: v.number(),
    famineLikelihood: v.number(),
    successionCrisisLikelihood: v.number(),
    rebellionLikelihood: v.number(),

    // Active countdowns
    countdowns: v.array(v.object({
      type: v.string(),
      label: v.string(),
      ticksRemaining: v.number(),
    })),

    // Brewing conflicts
    brewingConflicts: v.array(v.object({
      targetId: v.id("territories"),
      likelihood: v.number(),
      reason: v.string(),
    })),
  })
    .index("by_territory", ["territoryId"])
    .index("by_tick", ["tick"]),

  // Rivalries between specific characters/territories
  rivalries: defineTable({
    // Between specific characters (not just territories)
    character1Id: v.id("characters"),
    character2Id: v.id("characters"),

    territory1Id: v.id("territories"),
    territory2Id: v.id("territories"),

    // Grudge details
    intensity: v.number(), // 0-100
    rivalryType: v.string(), // "blood_feud", "territorial", "personal", "honor", "betrayal"

    reasons: v.array(v.object({
      reason: v.string(),
      tick: v.number(),
      description: v.string(),
      intensityAdded: v.number(),
    })),

    // Can pass to successors
    isHereditary: v.boolean(),

    status: v.union(v.literal("active"), v.literal("resolved"), v.literal("dormant")),
    startTick: v.number(),
    endTick: v.optional(v.number()),
  })
    .index("by_territory1", ["territory1Id"])
    .index("by_territory2", ["territory2Id"])
    .index("by_status", ["status"]),

  // Yearly chronicles (recaps)
  chronicles: defineTable({
    year: v.number(),

    globalSummary: v.string(),

    territoryHighlights: v.array(v.object({
      territoryId: v.id("territories"),
      territoryName: v.string(),
      headline: v.string(),
      events: v.array(v.string()),
    })),

    majorEvents: v.array(v.object({
      title: v.string(),
      description: v.string(),
      impactScore: v.number(), // 1-10
      tick: v.number(),
    })),

    rulerChanges: v.array(v.object({
      territoryId: v.id("territories"),
      territoryName: v.string(),
      oldRuler: v.string(),
      newRuler: v.string(),
      cause: v.string(),
    })),

    warSummaries: v.array(v.object({
      warName: v.string(),
      status: v.string(), // "started", "ongoing", "ended"
      description: v.string(),
    })),

    recordsBroken: v.array(v.object({
      recordType: v.string(),
      territoryName: v.string(),
      oldValue: v.optional(v.number()),
      newValue: v.number(),
    })),
  }).index("by_year", ["year"]),

  // =============================================
  // COMPETITIVE ARENA - MATCH FRAMEWORK
  // =============================================

  // Match tracking for competitive games
  matches: defineTable({
    startTick: v.number(),
    endTick: v.optional(v.number()),
    status: v.union(
      v.literal("running"),
      v.literal("ended")
    ),
    // Victory information
    victoryType: v.optional(v.union(
      v.literal("domination"),     // 60%+ of total population
      v.literal("elimination"),    // Last civilization standing
      v.literal("cultural"),       // Influence reaches 200+
      v.literal("scientific")      // Technology reaches 150+
    )),
    winnerId: v.optional(v.id("territories")),
    winnerName: v.optional(v.string()),
    // Final scores for all participants
    finalScores: v.optional(v.array(v.object({
      territoryId: v.id("territories"),
      territoryName: v.string(),
      powerScore: v.number(),
      population: v.number(),
      military: v.number(),
      wealth: v.number(),
      technology: v.number(),
      influence: v.number(),
      knowledge: v.number(),
      happiness: v.number(),
      rank: v.number(),
      wasEliminated: v.boolean(),
    }))),
    // Match narrative
    matchNarrative: v.optional(v.string()),
    keyMoments: v.optional(v.array(v.object({
      tick: v.number(),
      title: v.string(),
      description: v.string(),
    }))),
  })
    .index("by_status", ["status"])
    .index("by_start", ["startTick"]),

  // Power score history for tracking trends
  powerScoreHistory: defineTable({
    tick: v.number(),
    territoryId: v.id("territories"),
    territoryName: v.string(),
    powerScore: v.number(),
    // Component breakdown
    populationScore: v.number(),
    militaryScore: v.number(),
    wealthScore: v.number(),
    technologyScore: v.number(),
    influenceScore: v.number(),
    knowledgeScore: v.number(),
    happinessScore: v.number(),
    allianceBonus: v.number(),
  })
    .index("by_tick", ["tick"])
    .index("by_territory", ["territoryId"])
    .index("by_territory_tick", ["territoryId", "tick"]),

  // Prosperity tiers - progression toward golden age
  prosperityTiers: defineTable({
    territoryId: v.id("territories"),

    // Current tier (0-5)
    // 0: Struggling, 1: Stable, 2: Growing, 3: Flourishing, 4: Prosperous, 5: Golden Age
    currentTier: v.number(),
    tierName: v.string(),

    // Progress toward next tier (0-100)
    progressToNextTier: v.number(),

    // How long at current tier (in ticks)
    ticksAtCurrentTier: v.number(),

    // Tier history
    tierHistory: v.array(v.object({
      tier: v.number(),
      tierName: v.string(),
      enteredTick: v.number(),
      exitedTick: v.optional(v.number()),
      exitReason: v.optional(v.string()),
    })),

    // Complacency (builds during prosperity, breeds problems)
    complacencyLevel: v.number(), // 0-100, increases at higher tiers

    // Decadence (corruption that builds during golden ages)
    decadenceLevel: v.number(), // 0-100, triggers plots and rebellions

    // Stability modifiers
    stabilityFactors: v.object({
      economicStability: v.number(), // 0-100
      socialHarmony: v.number(),     // 0-100
      militaryReadiness: v.number(), // 0-100
      politicalUnity: v.number(),    // 0-100
    }),
  }).index("by_territory", ["territoryId"]),

  // =============================================
  // RELIGION SYSTEM
  // =============================================
  religions: defineTable({
    name: v.string(),
    foundingTerritoryId: v.id("territories"),
    foundedTick: v.number(),
    founderId: v.optional(v.id("characters")),

    // Beliefs and practices
    deity: v.string(),               // "The Sun God", "The Great Spirit", etc.
    beliefs: v.array(v.string()),    // Core tenets
    practices: v.array(v.string()),  // Rituals, holidays
    holySymbol: v.optional(v.string()),

    // Structure
    organizationType: v.union(
      v.literal("decentralized"),    // No hierarchy, local priests
      v.literal("hierarchical"),     // Pope/high priest structure
      v.literal("monastic"),         // Monastery-based
      v.literal("shamanic")          // Individual spiritual leaders
    ),

    // Spread and influence
    followerCount: v.number(),
    territoriesPresent: v.array(v.id("territories")),

    // Doctrine effects on society
    doctrineEffects: v.object({
      fertilityBonus: v.number(),    // Affects birth rate
      militaryBonus: v.number(),     // Holy warriors
      happinessBonus: v.number(),    // Community, hope
      educationBonus: v.number(),    // Monasteries, schools
      wealthPenalty: v.number(),     // Tithing, poverty vows
    }),

    // Tolerance
    tolerance: v.number(),           // 0-100, how accepting of other faiths
    conversionZeal: v.number(),      // 0-100, how actively they convert others

    // Status
    isStateReligion: v.optional(v.id("territories")), // Which territory has this as state religion
  })
    .index("by_territory", ["foundingTerritoryId"])
    .index("by_name", ["name"]),

  // Temples and holy sites
  temples: defineTable({
    name: v.string(),
    religionId: v.id("religions"),
    territoryId: v.id("territories"),

    // Building info
    level: v.number(),               // 1-5
    condition: v.number(),           // 0-100
    constructionTick: v.number(),

    // Staff
    highPriestId: v.optional(v.id("characters")),
    priestCount: v.number(),

    // Influence
    localInfluence: v.number(),      // 0-100, affects local faith
    pilgrimageDestination: v.boolean(),

    // Wealth
    treasury: v.number(),            // Temple's own wealth
    titheRate: v.number(),           // % collected from faithful

    // Type
    templeType: v.union(
      v.literal("shrine"),           // Small, 1 priest
      v.literal("temple"),           // Medium, 3-5 priests
      v.literal("cathedral"),        // Large, 10+ priests
      v.literal("monastery"),        // Monks, education focus
      v.literal("oracle")            // Divination, prophecy
    ),
  })
    .index("by_religion", ["religionId"])
    .index("by_territory", ["territoryId"]),

  // =============================================
  // GUILD SYSTEM
  // =============================================
  guilds: defineTable({
    name: v.string(),
    territoryId: v.id("territories"),
    foundedTick: v.number(),

    // Type
    guildType: v.union(
      v.literal("blacksmiths"),
      v.literal("masons"),
      v.literal("carpenters"),
      v.literal("weavers"),
      v.literal("merchants"),
      v.literal("miners"),
      v.literal("farmers"),
      v.literal("physicians"),
      v.literal("scribes"),
      v.literal("entertainers")
    ),

    // Leadership
    guildMasterId: v.optional(v.id("characters")),
    councilMemberIds: v.array(v.id("characters")),

    // Membership
    memberCount: v.number(),
    apprenticeCount: v.number(),
    journeymanCount: v.number(),
    masterCount: v.number(),

    // Economics
    treasury: v.number(),
    dues: v.number(),                // Monthly dues per member
    minimumWage: v.number(),         // What members must be paid
    priceControls: v.optional(v.object({
      minimumPrice: v.number(),
      maximumPrice: v.number(),
    })),

    // Quality and standards
    qualityStandard: v.number(),     // 0-100, affects product quality
    trainingQuality: v.number(),     // 0-100, how good apprenticeships are

    // Political power
    politicalInfluence: v.number(),  // 0-100, affects city decisions
    relationshipWithRuler: v.number(), // -100 to 100

    // Monopoly status
    hasMonopoly: v.boolean(),        // Exclusive rights to trade
    monopolyGrantedTick: v.optional(v.number()),

    // Guild hall
    hasGuildHall: v.boolean(),
    guildHallLevel: v.optional(v.number()),
  })
    .index("by_territory", ["territoryId"])
    .index("by_type", ["guildType"]),

  // =============================================
  // EDUCATION SYSTEM
  // =============================================
  schools: defineTable({
    name: v.string(),
    territoryId: v.id("territories"),
    foundedTick: v.number(),

    // Type
    schoolType: v.union(
      v.literal("primary"),          // Basic literacy, numbers
      v.literal("secondary"),        // Advanced reading, history
      v.literal("university"),       // Specialized knowledge
      v.literal("military_academy"), // Combat training
      v.literal("religious_school"), // Theological education
      v.literal("trade_school"),     // Craft training
      v.literal("medical_school"),   // Physician training
      v.literal("law_school")        // Legal training
    ),

    // Staff
    headmasterId: v.optional(v.id("characters")),
    teacherIds: v.array(v.id("characters")),
    teacherCount: v.number(),

    // Students
    studentIds: v.array(v.id("characters")),
    studentCapacity: v.number(),
    currentEnrollment: v.number(),

    // Quality
    educationQuality: v.number(),    // 0-100
    reputation: v.number(),          // 0-100

    // Resources
    treasury: v.number(),
    tuitionCost: v.number(),         // Cost per student per tick
    librarySize: v.number(),         // Number of books/scrolls

    // Requirements
    minimumLiteracy: v.number(),     // Required to enroll
    minimumAge: v.number(),

    // Curriculum
    subjectsTaught: v.array(v.string()), // "literacy", "mathematics", "law", etc.
    graduationRequirements: v.number(), // Study progress needed to graduate
  })
    .index("by_territory", ["territoryId"])
    .index("by_type", ["schoolType"]),

  // =============================================
  // JUDICIAL SYSTEM
  // =============================================
  lawCodes: defineTable({
    territoryId: v.id("territories"),
    name: v.string(),                // "The Code of Hammurabi", etc.
    enactedTick: v.number(),
    enactedByRulerId: v.id("characters"),

    // Severity
    severity: v.union(
      v.literal("lenient"),          // Fines, community service
      v.literal("moderate"),         // Imprisonment, exile
      v.literal("harsh"),            // Corporal punishment, execution
      v.literal("draconian")         // Death for most crimes
    ),

    // Laws defined
    laws: v.array(v.object({
      crimeType: v.string(),         // "theft", "murder", "treason", "heresy"
      description: v.string(),
      basePunishment: v.string(),    // "fine", "imprisonment", "exile", "execution"
      punishmentSeverity: v.number(), // 1-10
      finAmount: v.optional(v.number()),
      imprisonmentTicks: v.optional(v.number()),
    })),

    // Rights
    citizenRights: v.object({
      rightToTrial: v.boolean(),
      rightToAppeal: v.boolean(),
      rightToDefense: v.boolean(),
      presumptionOfInnocence: v.boolean(),
      noblePrivilege: v.boolean(),   // Nobles get lighter sentences
    }),

    // Enforcement
    enforcementStrength: v.number(), // 0-100, how well laws are enforced
    corruptionLevel: v.number(),     // 0-100, bribery effectiveness
  })
    .index("by_territory", ["territoryId"]),

  // Crimes committed
  crimes: defineTable({
    territoryId: v.id("territories"),
    accusedId: v.id("characters"),
    victimId: v.optional(v.id("characters")),

    // Crime details
    crimeType: v.union(
      v.literal("theft"),
      v.literal("assault"),
      v.literal("murder"),
      v.literal("treason"),
      v.literal("heresy"),
      v.literal("desertion"),
      v.literal("adultery"),
      v.literal("fraud"),
      v.literal("smuggling"),
      v.literal("bribery"),
      v.literal("tax_evasion"),
      v.literal("vandalism"),
      v.literal("arson"),
      v.literal("kidnapping"),
      v.literal("sedition")
    ),
    description: v.string(),
    tick: v.number(),

    // Evidence
    witnesses: v.array(v.id("characters")),
    evidenceStrength: v.number(),    // 0-100

    // Status
    status: v.union(
      v.literal("reported"),
      v.literal("investigating"),
      v.literal("awaiting_trial"),
      v.literal("on_trial"),
      v.literal("convicted"),
      v.literal("acquitted"),
      v.literal("dismissed"),
      v.literal("pardoned")
    ),

    // Resolution
    trialId: v.optional(v.id("trials")),
    verdict: v.optional(v.string()),
    sentence: v.optional(v.string()),
  })
    .index("by_territory", ["territoryId"])
    .index("by_accused", ["accusedId"])
    .index("by_status", ["status"]),

  // Trials
  trials: defineTable({
    territoryId: v.id("territories"),
    crimeId: v.id("crimes"),
    accusedId: v.id("characters"),

    // Court
    judgeId: v.id("characters"),
    prosecutorId: v.optional(v.id("characters")),
    defenseId: v.optional(v.id("characters")),

    // Timeline
    startTick: v.number(),
    endTick: v.optional(v.number()),

    // Status
    status: v.union(
      v.literal("scheduled"),
      v.literal("in_progress"),
      v.literal("deliberation"),
      v.literal("verdict_reached"),
      v.literal("appealed"),
      v.literal("closed")
    ),

    // Proceedings
    proceedings: v.array(v.object({
      tick: v.number(),
      event: v.string(),             // "witness_testimony", "evidence_presented", "closing_arguments"
      description: v.string(),
      impactOnVerdict: v.number(),   // -100 to 100 (negative = helps defense)
    })),

    // Outcome
    verdict: v.optional(v.union(
      v.literal("guilty"),
      v.literal("innocent"),
      v.literal("mistrial")
    )),
    sentence: v.optional(v.string()),

    // Fairness
    trialFairness: v.number(),       // 0-100, affected by corruption, evidence
    publicOpinion: v.number(),       // -100 to 100, did people think it was just
  })
    .index("by_territory", ["territoryId"])
    .index("by_accused", ["accusedId"])
    .index("by_judge", ["judgeId"]),

  // Prisons
  prisons: defineTable({
    name: v.string(),
    territoryId: v.id("territories"),

    // Capacity
    capacity: v.number(),
    currentInmates: v.number(),

    // Conditions
    conditions: v.union(
      v.literal("humane"),           // Rehabilitation focus
      v.literal("standard"),         // Basic needs met
      v.literal("harsh"),            // Minimal comfort
      v.literal("dungeon")           // Terrible conditions
    ),

    // Security
    guardCount: v.number(),
    escapeRisk: v.number(),          // 0-100

    // Effects
    rehabilitationRate: v.number(),  // 0-100, chance to reform
    deathRate: v.number(),           // 0-100, inmates dying

    // Staff
    wardenId: v.optional(v.id("characters")),
  })
    .index("by_territory", ["territoryId"]),

  // =============================================
  // VIEWER ENGAGEMENT SYSTEMS
  // =============================================

  // First-To Milestone Achievements
  milestones: defineTable({
    milestoneId: v.string(),         // "pop_100", "tech_writing", etc.
    territoryId: v.id("territories"),
    territoryName: v.string(),
    achievedAtTick: v.number(),
    achievedAtYear: v.number(),
    points: v.number(),              // Victory points awarded
    category: v.string(),            // "technology", "population", etc.
  })
    .index("by_milestone", ["milestoneId"])
    .index("by_territory", ["territoryId"])
    .index("by_category", ["category"]),

  // World Events - global events affecting civilizations
  worldEvents: defineTable({
    eventId: v.string(),             // "great_plague", "gold_rush", etc.
    startTick: v.number(),
    endTick: v.number(),
    isActive: v.boolean(),
    affectedTerritoryIds: v.array(v.id("territories")),
    severity: v.string(),            // "minor", "major", "catastrophic"
  })
    .index("by_active", ["isActive"])
    .index("by_event", ["eventId"]),

  // Rise and Fall - tracks prosperity cycles per territory
  riseAndFall: defineTable({
    territoryId: v.id("territories"),
    status: v.string(),              // "stable", "golden_age", "crisis", etc.
    decadenceLevel: v.number(),      // 0-100
    corruptionLevel: v.number(),     // 0-100
    goldenAgeTicks: v.number(),      // Ticks remaining in golden age
    collapseRisk: v.number(),        // 0-100 probability
    underdogBonus: v.number(),       // 0-50 bonus for small civs
    reforms: v.array(v.string()),    // Active reforms implemented
    lastStatusChange: v.number(),    // Tick of last status change
    activeCrisis: v.optional(v.string()), // Current crisis type if any
  })
    .index("by_territory", ["territoryId"])
    .index("by_status", ["status"]),

  // =============================================
  // ENDGAME TENSIONS - NUCLEAR DYNAMICS
  // =============================================

  // Nuclear arsenal tracking
  nuclearArsenals: defineTable({
    territoryId: v.id("territories"),
    warheads: v.number(),            // Number of nuclear weapons
    deliverySystems: v.number(),     // Missiles/bombers capable of delivery
    productionRate: v.number(),      // Warheads per tick when producing
    isProducing: v.boolean(),        // Currently building nukes
    firstNukeTick: v.optional(v.number()), // When they got their first nuke
    nukesUsed: v.number(),           // Total nukes launched
    targetedBy: v.array(v.id("territories")), // Who is targeting them
  })
    .index("by_territory", ["territoryId"]),

  // Arms race tracking between specific territories
  armsRaces: defineTable({
    territory1Id: v.id("territories"),
    territory2Id: v.id("territories"),
    startTick: v.number(),
    intensity: v.number(),           // 0-100, how heated
    nuclearTension: v.number(),      // 0-100, risk of nuclear war
    closeCalls: v.array(v.object({   // Near-miss incidents
      tick: v.number(),
      description: v.string(),
      tensionAdded: v.number(),
    })),
    isActive: v.boolean(),
  })
    .index("by_territory1", ["territory1Id"])
    .index("by_territory2", ["territory2Id"])
    .index("by_active", ["isActive"]),

  // Doomsday clock - global nuclear tension
  doomsdayClock: defineTable({
    minutesToMidnight: v.number(),   // 0-12, lower = more danger
    lastMovement: v.number(),        // Tick of last change
    movementReason: v.string(),      // Why it moved
    allTimeLowest: v.number(),       // Closest to midnight ever
    allTimeLowestTick: v.optional(v.number()),
  }),

  // =============================================
  // HUMAN LIFE SYSTEMS - MARRIAGE & DYNASTIES
  // =============================================

  // Marriage records
  marriages: defineTable({
    territoryId: v.id("territories"),
    spouse1Id: v.id("characters"),
    spouse2Id: v.id("characters"),
    marriageType: v.union(
      v.literal("political"),
      v.literal("love"),
      v.literal("arranged"),
      v.literal("forced")
    ),
    marriageTick: v.number(),
    status: v.union(
      v.literal("active"),
      v.literal("widowed"),
      v.literal("divorced"),
      v.literal("annulled")
    ),
    allianceTerritoryId: v.optional(v.id("territories")), // For political marriages
    dowryPaid: v.optional(v.number()),
    childrenIds: v.array(v.id("characters")),
    maritalHappiness: v.number(), // 0-100, affects character happiness
  })
    .index("by_territory", ["territoryId"])
    .index("by_spouse1", ["spouse1Id"])
    .index("by_spouse2", ["spouse2Id"])
    .index("by_status", ["status"]),

  // Dynasty family trees
  dynastyTrees: defineTable({
    territoryId: v.id("territories"),
    dynastyName: v.string(),
    founderId: v.id("characters"),
    foundedTick: v.number(),
    currentHeadId: v.optional(v.id("characters")),
    totalGenerations: v.number(),
    inheritanceRule: v.union(
      v.literal("primogeniture"),  // Eldest child inherits
      v.literal("agnatic"),        // Eldest male inherits
      v.literal("elective"),       // Council chooses heir
      v.literal("seniority")       // Oldest member inherits
    ),
    prestige: v.number(), // 0-1000, dynasty's accumulated glory
    motto: v.optional(v.string()),
    coatOfArms: v.optional(v.string()),
  })
    .index("by_territory", ["territoryId"])
    .index("by_founder", ["founderId"]),

  // =============================================
  // HUMAN LIFE SYSTEMS - ROMANCE
  // =============================================

  // Romantic relationships
  romances: defineTable({
    territoryId: v.id("territories"),
    lover1Id: v.id("characters"),
    lover2Id: v.id("characters"),
    romanceType: v.union(
      v.literal("courtship"),    // Formal wooing
      v.literal("romance"),      // Love affair
      v.literal("affair"),       // Secret relationship
      v.literal("unrequited")    // One-sided love
    ),
    isSecret: v.boolean(),
    attraction: v.number(),      // 0-100, physical attraction
    passion: v.number(),         // 0-100, intensity of feelings
    intimacy: v.number(),        // 0-100, emotional closeness
    startTick: v.number(),
    isAdulterous: v.boolean(),   // One or both are married to others
    status: v.union(
      v.literal("active"),
      v.literal("ended_mutual"),
      v.literal("ended_breakup"),
      v.literal("ended_marriage") // Romance led to marriage
    ),
    endTick: v.optional(v.number()),
    endReason: v.optional(v.string()),
  })
    .index("by_territory", ["territoryId"])
    .index("by_lover1", ["lover1Id"])
    .index("by_lover2", ["lover2Id"])
    .index("by_status", ["status"]),

  // =============================================
  // HUMAN LIFE SYSTEMS - WEATHER & SEASONS
  // =============================================

  // Weather per territory
  weather: defineTable({
    territoryId: v.id("territories"),
    currentWeather: v.union(
      v.literal("clear"),
      v.literal("cloudy"),
      v.literal("rain"),
      v.literal("heavy_rain"),
      v.literal("thunderstorm"),
      v.literal("snow"),
      v.literal("blizzard"),
      v.literal("drought"),
      v.literal("heat_wave"),
      v.literal("fog"),
      v.literal("monsoon")
    ),
    temperature: v.number(),     // In abstract units, 0=freezing, 50=mild, 100=scorching
    weatherStartTick: v.number(),
    expectedEndTick: v.number(),
    isExtreme: v.boolean(),      // Is this dangerous weather?
    // Modifiers (percentage, e.g., -20 = 20% worse, +10 = 10% better)
    farmingModifier: v.number(),
    militaryModifier: v.number(),
    travelModifier: v.number(),
    moodModifier: v.number(),
  }).index("by_territory", ["territoryId"]),

  // =============================================
  // HUMAN LIFE SYSTEMS - INFRASTRUCTURE
  // =============================================

  // Infrastructure projects
  infrastructure: defineTable({
    territoryId: v.id("territories"),
    type: v.union(
      v.literal("road"),
      v.literal("bridge"),
      v.literal("aqueduct"),
      v.literal("wall"),
      v.literal("harbor"),
      v.literal("lighthouse"),
      v.literal("sewers")
    ),
    name: v.optional(v.string()),
    level: v.number(),           // 1-5
    connectsTo: v.optional(v.id("territories")), // For roads/bridges
    condition: v.number(),       // 0-100, degrades over time
    constructedAtTick: v.number(),
    maintenanceCost: v.number(), // Wealth per tick
    isUnderConstruction: v.boolean(),
    constructionProgress: v.number(), // 0-100
    constructionStartTick: v.optional(v.number()),
    // Effects
    tradeBonus: v.optional(v.number()),
    defenseBonus: v.optional(v.number()),
    healthBonus: v.optional(v.number()),
    happinessBonus: v.optional(v.number()),
  })
    .index("by_territory", ["territoryId"])
    .index("by_type", ["type"]),

  // =============================================
  // HUMAN LIFE SYSTEMS - NATURAL DISASTERS
  // =============================================

  // Active disasters
  disasters: defineTable({
    territoryId: v.id("territories"),
    type: v.union(
      v.literal("earthquake"),
      v.literal("flood"),
      v.literal("volcanic_eruption"),
      v.literal("tsunami"),
      v.literal("wildfire"),
      v.literal("landslide")
    ),
    severity: v.union(
      v.literal("minor"),
      v.literal("moderate"),
      v.literal("major"),
      v.literal("catastrophic")
    ),
    startTick: v.number(),
    endTick: v.number(),
    populationCasualties: v.number(),
    buildingsDestroyed: v.number(),
    infrastructureDamaged: v.array(v.id("infrastructure")),
    recoveryProgress: v.number(), // 0-100
    status: v.union(
      v.literal("active"),
      v.literal("recovering"),
      v.literal("recovered")
    ),
    traumaticMemoryCreated: v.boolean(), // Has this created trauma for characters?
  })
    .index("by_territory", ["territoryId"])
    .index("by_type", ["type"])
    .index("by_status", ["status"]),

  // =============================================
  // HUMAN LIFE SYSTEMS - EXPLORATION
  // =============================================

  // Expeditions to explore unknown lands
  expeditions: defineTable({
    originTerritoryId: v.id("territories"),
    targetDirection: v.optional(v.union(
      v.literal("north"),
      v.literal("south"),
      v.literal("east"),
      v.literal("west"),
      v.literal("overseas")
    )),
    leaderId: v.optional(v.id("characters")),
    explorerCount: v.number(),
    soldierCount: v.number(),
    supplies: v.number(),        // Days of food/water
    departureTick: v.number(),
    expectedReturnTick: v.number(),
    status: v.union(
      v.literal("preparing"),
      v.literal("traveling"),
      v.literal("exploring"),
      v.literal("returning"),
      v.literal("completed"),
      v.literal("lost")          // Expedition lost, never returned
    ),
    discoveries: v.array(v.object({
      type: v.string(),          // "resource", "landmark", "tribe", "ruins"
      description: v.string(),
      value: v.number(),         // How valuable the discovery is
      tick: v.number(),
    })),
    casualtyCount: v.number(),
    journalEntries: v.optional(v.array(v.object({
      tick: v.number(),
      entry: v.string(),
    }))),
  })
    .index("by_origin", ["originTerritoryId"])
    .index("by_leader", ["leaderId"])
    .index("by_status", ["status"]),

  // =============================================
  // HUMAN LIFE SYSTEMS - FRIENDSHIPS
  // =============================================

  // Non-romantic bonds between characters
  friendships: defineTable({
    territoryId: v.id("territories"),
    character1Id: v.id("characters"),
    character2Id: v.id("characters"),
    friendshipType: v.union(
      v.literal("acquaintance"),
      v.literal("friend"),
      v.literal("close_friend"),
      v.literal("best_friend"),
      v.literal("sworn_brother")  // Unbreakable loyalty
    ),
    strength: v.number(),        // 0-100
    sharedExperiences: v.array(v.string()), // "fought_together", "survived_famine", etc.
    startTick: v.number(),
    lastInteractionTick: v.number(),
    // Effects
    loyaltyBonus: v.number(),    // How much this friendship affects loyalty
    mentalHealthBonus: v.number(), // Friends help mental health recovery
  })
    .index("by_territory", ["territoryId"])
    .index("by_character1", ["character1Id"])
    .index("by_character2", ["character2Id"]),

  // =============================================
  // HUMAN LIFE SYSTEMS - ESPIONAGE
  // =============================================

  // Spy agents
  spies: defineTable({
    ownerTerritoryId: v.id("territories"),
    targetTerritoryId: v.id("territories"),
    characterId: v.optional(v.id("characters")), // If spy is a named character
    codename: v.string(),
    skill: v.number(),           // 0-100, espionage ability
    cover: v.union(
      v.literal("merchant"),
      v.literal("diplomat"),
      v.literal("servant"),
      v.literal("scholar"),
      v.literal("traveler")
    ),
    mission: v.union(
      v.literal("gather_intel"),
      v.literal("sabotage"),
      v.literal("assassinate"),
      v.literal("steal_tech"),
      v.literal("incite_rebellion")
    ),
    infiltrationLevel: v.number(), // 0-100, how deep they've penetrated
    discoveryRisk: v.number(),   // 0-100, chance of being caught
    status: v.union(
      v.literal("active"),
      v.literal("extracted"),
      v.literal("captured"),
      v.literal("executed"),
      v.literal("turned")        // Became double agent
    ),
    intelligence: v.array(v.object({
      type: v.string(),          // "military", "economic", "political"
      info: v.string(),
      tick: v.number(),
      accuracy: v.number(),      // 0-100, how accurate the intel is
    })),
    deployedTick: v.number(),
    lastReportTick: v.optional(v.number()),
  })
    .index("by_owner", ["ownerTerritoryId"])
    .index("by_target", ["targetTerritoryId"])
    .index("by_status", ["status"]),

  // =============================================
  // HUMAN LIFE SYSTEMS - ADDICTIONS
  // =============================================

  // Character addictions
  addictions: defineTable({
    characterId: v.id("characters"),
    territoryId: v.id("territories"),
    type: v.union(
      v.literal("alcohol"),
      v.literal("gambling"),
      v.literal("opium"),
      v.literal("other")
    ),
    severity: v.union(
      v.literal("mild"),
      v.literal("moderate"),
      v.literal("severe"),
      v.literal("crippling")
    ),
    startTick: v.number(),
    lastIndulgeTick: v.number(),
    withdrawalLevel: v.number(), // 0-100, increases when not indulging
    functionalityImpact: v.number(), // 0-100, how much it affects their duties
    wealthDrain: v.number(),     // Wealth consumed per tick
    isSecret: v.boolean(),
    recoveryAttempts: v.number(),
    inRecovery: v.boolean(),
    recoveryProgress: v.optional(v.number()), // 0-100
  })
    .index("by_character", ["characterId"])
    .index("by_territory", ["territoryId"])
    .index("by_type", ["type"]),

  // =============================================
  // ECONOMY SYSTEM
  // =============================================

  // Territory treasury - actual money and reserves
  treasury: defineTable({
    territoryId: v.id("territories"),
    // Metal reserves (raw materials for coins)
    goldReserves: v.number(),      // Actual gold bars/ingots
    silverReserves: v.number(),    // Actual silver
    copperReserves: v.number(),    // Copper for small coins
    // Minted currency in circulation
    goldCoins: v.number(),         // High value
    silverCoins: v.number(),       // Medium value
    copperCoins: v.number(),       // Low value (daily transactions)
    // Paper money (unlocked later)
    bankNotes: v.optional(v.number()),
    // Debt
    totalDebt: v.number(),         // Money owed
    debtInterestRate: v.number(),  // Annual interest %
    // Economic health
    creditRating: v.number(),      // 0-100, affects loan terms
    inflationRate: v.number(),     // Current inflation %
    // Currency integrity
    debasementLevel: v.number(),   // 0-100, how debased the currency is
    // Economic phase
    economicPhase: v.union(
      v.literal("barter"),
      v.literal("commodity"),
      v.literal("coined"),
      v.literal("banking"),
      v.literal("paper"),
      v.literal("modern")
    ),
    // Monthly tracking
    lastMonthIncome: v.number(),
    lastMonthExpenses: v.number(),
    lastMonthBalance: v.number(),
  })
    .index("by_territory", ["territoryId"]),

  // Tax policy for each territory
  taxPolicy: defineTable({
    territoryId: v.id("territories"),
    // Tax rates (0-100)
    landTaxRate: v.number(),       // Tax on landowners
    tradeTaxRate: v.number(),      // Tax on merchants/trade
    pollTaxRate: v.number(),       // Per-person tax
    incomeTaxRate: v.number(),     // Tax on earnings (advanced)
    luxuryTaxRate: v.number(),     // Tax on luxuries
    // Collection
    collectionEfficiency: v.number(), // 0-100, how much actually collected
    taxEvaders: v.number(),        // Estimated evaders
    // Effects
    happinessImpact: v.number(),   // How much taxes hurt happiness
    // Special
    taxExemptions: v.array(v.string()), // Who is exempt (nobles, clergy, etc.)
    lastCollectionTick: v.number(),
    lastCollectionAmount: v.number(),
  })
    .index("by_territory", ["territoryId"]),

  // Loans - money borrowed or lent
  loans: defineTable({
    borrowerTerritoryId: v.id("territories"),
    lenderType: v.union(
      v.literal("merchant_guild"),
      v.literal("temple"),
      v.literal("foreign_territory"),
      v.literal("noble_family"),
      v.literal("bank")
    ),
    lenderTerritoryId: v.optional(v.id("territories")), // If foreign loan
    lenderName: v.string(),        // Name of lending institution
    principalAmount: v.number(),   // Original loan amount
    remainingAmount: v.number(),   // Amount still owed
    interestRate: v.number(),      // Annual interest %
    monthlyPayment: v.number(),    // Required monthly payment
    startTick: v.number(),
    dueByTick: v.number(),         // When loan must be repaid
    status: v.union(
      v.literal("active"),
      v.literal("paid"),
      v.literal("defaulted"),
      v.literal("renegotiated")
    ),
    missedPayments: v.number(),    // Number of missed payments
    collateral: v.optional(v.string()), // What's pledged as security
  })
    .index("by_borrower", ["borrowerTerritoryId"])
    .index("by_status", ["status"]),

  // Currency definitions (for different civilizations)
  currencies: defineTable({
    territoryId: v.id("territories"),
    name: v.string(),              // "Denarius", "Drachma", etc.
    symbol: v.optional(v.string()), // "₳", "Ð", etc.
    // Coin types
    goldCoinName: v.string(),      // "Aureus"
    silverCoinName: v.string(),    // "Denarius"
    copperCoinName: v.string(),    // "As"
    // Metal content (purity)
    goldPurity: v.number(),        // 0-100, higher = more valuable
    silverPurity: v.number(),
    copperPurity: v.number(),
    // Exchange rates (relative to base)
    goldToSilverRatio: v.number(), // How many silver = 1 gold
    silverToCopperRatio: v.number(),
    // Trust
    foreignAcceptance: v.number(), // 0-100, how trusted abroad
    counterfeiting: v.number(),    // 0-100, counterfeit prevalence
    // History
    foundedTick: v.number(),
    lastReformTick: v.optional(v.number()),
  })
    .index("by_territory", ["territoryId"]),

  // Economic history for tracking trends
  economicHistory: defineTable({
    territoryId: v.id("territories"),
    tick: v.number(),
    // Snapshot
    totalWealth: v.number(),
    inflation: v.number(),
    unemployment: v.number(),
    tradeBalance: v.number(),      // Exports - Imports
    taxRevenue: v.number(),
    militarySpending: v.number(),
    debtLevel: v.number(),
    // Prices (for inflation tracking)
    foodPrice: v.number(),
    goodsPrice: v.number(),
    laborPrice: v.number(),
  })
    .index("by_territory", ["territoryId"])
    .index("by_tick", ["tick"]),

  // Banks (when banking is unlocked)
  banks: defineTable({
    territoryId: v.id("territories"),
    name: v.string(),
    type: v.union(
      v.literal("merchant_bank"),
      v.literal("temple_bank"),
      v.literal("state_bank"),
      v.literal("private_bank")
    ),
    foundedTick: v.number(),
    // Assets
    deposits: v.number(),          // Money deposited by citizens
    reserves: v.number(),          // Actual money held
    loansOutstanding: v.number(),  // Money lent out
    // Rates
    depositInterestRate: v.number(),
    loanInterestRate: v.number(),
    reserveRatio: v.number(),      // % of deposits kept as reserves
    // Health
    stability: v.number(),         // 0-100
    publicTrust: v.number(),       // 0-100
    // Status
    status: v.union(
      v.literal("active"),
      v.literal("struggling"),
      v.literal("bankrupt"),
      v.literal("seized")
    ),
  })
    .index("by_territory", ["territoryId"]),

  // Trade agreements (more detailed than tradeRoutes)
  tradeAgreements: defineTable({
    territory1Id: v.id("territories"),
    territory2Id: v.id("territories"),
    agreementType: v.union(
      v.literal("free_trade"),
      v.literal("preferential"),
      v.literal("tariff_reduction"),
      v.literal("monopoly_grant"),
      v.literal("embargo")
    ),
    // Terms
    tariffRate: v.number(),        // Import tax %
    quotas: v.optional(v.object({
      goods: v.number(),
      food: v.number(),
      luxuries: v.number(),
    })),
    // Duration
    startTick: v.number(),
    expiryTick: v.optional(v.number()),
    status: v.union(
      v.literal("active"),
      v.literal("expired"),
      v.literal("violated"),
      v.literal("cancelled")
    ),
    // Value
    totalTradeValue: v.number(),   // Cumulative trade under agreement
  })
    .index("by_territory1", ["territory1Id"])
    .index("by_territory2", ["territory2Id"]),

  // Wages and labor market
  laborMarket: defineTable({
    territoryId: v.id("territories"),
    // Wage levels
    unskilledWage: v.number(),     // Daily wage for unskilled labor
    skilledWage: v.number(),       // Daily wage for craftsmen
    professionalWage: v.number(),  // Wage for professionals
    soldierPay: v.number(),        // Military pay
    // Employment
    unemploymentRate: v.number(),  // 0-100
    laborShortage: v.boolean(),    // True if not enough workers
    // Conditions
    averageWorkHours: v.number(),  // Hours per day
    workConditions: v.union(
      v.literal("harsh"),
      v.literal("poor"),
      v.literal("fair"),
      v.literal("good"),
      v.literal("excellent")
    ),
    // Guilds influence
    guildWageControl: v.number(),  // 0-100, how much guilds control wages
    lastUpdatedTick: v.number(),
  })
    .index("by_territory", ["territoryId"]),

  // Price controls (when implemented)
  priceControls: defineTable({
    territoryId: v.id("territories"),
    goodType: v.string(),          // "bread", "grain", "iron", etc.
    controlType: v.union(
      v.literal("maximum"),        // Price ceiling
      v.literal("minimum"),        // Price floor
      v.literal("fixed")           // Exact price
    ),
    controlledPrice: v.number(),
    marketPrice: v.number(),       // What price would be without control
    effectivenesss: v.number(),    // 0-100, how well enforced
    blackMarketSize: v.number(),   // 0-100, illegal trade volume
    startTick: v.number(),
    status: v.union(
      v.literal("active"),
      v.literal("suspended"),
      v.literal("abolished")
    ),
  })
    .index("by_territory", ["territoryId"]),
});
